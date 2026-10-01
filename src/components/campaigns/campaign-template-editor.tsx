"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "grapesjs";
import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, ExternalLink, ImagePlus, Link2, LoaderCircle, Monitor, Move, Smartphone, Tablet, Trash2, TriangleAlert, Type } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { optimizeEmailHtmlForDelivery } from "@/lib/campaigns/html-utils";
import {
  exportNewsletterHtml,
  grapesNewsletterPluginId,
  hasMeaningfulEditorHtml,
  prepareGrapesEditorHtml,
} from "@/lib/grapes/email-html";
import {
  editorLinksPlugin,
  getLinkHref,
  setupEditorLinks,
  syncCampaignReplyLinks,
} from "@/lib/grapes/editor-links-plugin";
import {
  editorRichTextActions,
  editorToolsPlugin,
  setupEditorTools,
} from "@/lib/grapes/editor-tools-plugin";
import {
  freeLayoutPlugin,
  setupFreeLayout,
} from "@/lib/grapes/free-layout-plugin";
import { isTemplateSlotKey, type TemplateSlots } from "@/lib/templates/slots";
import { cn } from "@/lib/utils";

const SAVE_DEBOUNCE_MS = 400;

type GrapesModule = typeof import("grapesjs");
type NewsletterModule = typeof import("grapesjs-preset-newsletter");

function loadHtmlIntoEditor(editor: Editor, html: string): boolean {
  if (!html.trim()) return false;

  editor.setComponents(html, { asDocument: true });
  refreshEditorCanvas(editor);

  let count = editor.getWrapper()?.components()?.length ?? 0;
  if (count > 0) return true;

  const bodyOnly = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]?.trim();
  if (bodyOnly) {
    editor.setComponents(bodyOnly);
    refreshEditorCanvas(editor);
    count = editor.getWrapper()?.components()?.length ?? 0;
  }

  return count > 0;
}

function refreshEditorCanvas(editor: Editor) {
  editor.refresh();
  const frame = editor.Canvas.getFrameEl();
  if (frame) {
    frame.style.height = "100%";
    frame.removeAttribute("height");
  }
}

function editorHeightFor(container: HTMLElement): string {
  const measured = container.clientHeight;
  return `${Math.max(measured, 720)}px`;
}

export function CampaignTemplateEditor({
  templateId,
  productId,
  productName,
  subject,
  email,
  cta,
  company,
  contactName,
  senderName,
  senderEmail,
  senderCompany,
  slots,
  htmlDraft,
  disabled,
  onSlotsChange,
  onHtmlDraftChange,
}: {
  templateId: string;
  productId?: string;
  productName?: string;
  subject: string;
  email: string;
  cta: string;
  company: string;
  contactName: string;
  senderName: string;
  senderEmail: string;
  senderCompany: string;
  slots: TemplateSlots;
  htmlDraft: string;
  disabled?: boolean;
  onSlotsChange: (slots: TemplateSlots) => void;
  onHtmlDraftChange: (html: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const slotsRef = useRef(slots);
  const subjectRef = useRef(subject);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const htmlDraftRef = useRef(htmlDraft);
  const skipDraftRef = useRef(false);
  const onHtmlDraftChangeRef = useRef(onHtmlDraftChange);
  const onSlotsChangeRef = useRef(onSlotsChange);
  const disabledRef = useRef(disabled);
  const bootstrappingRef = useRef(true);

  onHtmlDraftChangeRef.current = onHtmlDraftChange;
  onSlotsChangeRef.current = onSlotsChange;
  disabledRef.current = disabled;
  slotsRef.current = slots;
  subjectRef.current = subject;
  htmlDraftRef.current = htmlDraft;

  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [resetToken, setResetToken] = useState(0);
  const [linkHref, setLinkHref] = useState("");
  const [hasLinkTarget, setHasLinkTarget] = useState(false);
  const [activeDevice, setActiveDevice] = useState("Desktop");
  const senderEmailRef = useRef(senderEmail);
  const subjectRefProp = useRef(subject);
  const ctaRef = useRef(cta);

  senderEmailRef.current = senderEmail;
  subjectRefProp.current = subject;
  ctaRef.current = cta;

  const renderKey = `${templateId}:${productId ?? ""}:${resetToken}`;

  function scheduleSave(editor: Editor) {
    if (disabledRef.current || bootstrappingRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onHtmlDraftChangeRef.current(
        optimizeEmailHtmlForDelivery(exportNewsletterHtml(editor, subjectRef.current)),
      );
    }, SAVE_DEBOUNCE_MS);
  }

  useEffect(() => {
    let cancelled = false;
    let editor: Editor | null = null;
    let removeResize: (() => void) | undefined;
    let removeLinkListener: (() => void) | undefined;
    const controller = new AbortController();

    async function boot() {
      setPhase("loading");
      setError("");

      try {
        let initialHtml = "";

        if (!skipDraftRef.current && hasMeaningfulEditorHtml(htmlDraftRef.current)) {
          initialHtml = prepareGrapesEditorHtml(htmlDraftRef.current, subjectRef.current);
        } else {
          skipDraftRef.current = false;
          const response = await fetch("/api/render", {
            method: "POST",
            headers: { "content-type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              templateId,
              productId,
              productName,
              subject,
              email,
              cta,
              company,
              contactName,
              senderName,
              senderEmail,
              senderCompany,
              slots: slotsRef.current,
            }),
          });
          const data = await response.json();
          if (cancelled) return;
          if (!response.ok) {
            throw new Error(data.error ?? "Could not render the template.");
          }

          initialHtml = prepareGrapesEditorHtml(data.html ?? "", subjectRef.current);
          if (data.slots && typeof data.slots === "object") {
            const seeded: TemplateSlots = {};
            for (const [key, value] of Object.entries(data.slots as Record<string, string>)) {
              if (isTemplateSlotKey(key)) seeded[key] = value;
            }
            queueMicrotask(() => {
              if (!cancelled) {
                onSlotsChangeRef.current({ ...seeded, ...slotsRef.current });
              }
            });
          }
        }

        if (!initialHtml) {
          throw new Error("The rendered template was empty.");
        }
        if (cancelled) return;

        const container = containerRef.current;
        if (!container) {
          throw new Error("Editor container is not available.");
        }

        const [grapesModule, newsletterModule] = await Promise.all([
          import("grapesjs") as Promise<GrapesModule>,
          import("grapesjs-preset-newsletter") as Promise<NewsletterModule>,
          import("grapesjs/dist/css/grapes.min.css"),
        ]);
        if (cancelled) return;

        const grapesjs = grapesModule.default;
        const newsletterPlugin = newsletterModule.default;
        bootstrappingRef.current = true;
        container.innerHTML = "";
        const editorHeight = editorHeightFor(container);

        editor = grapesjs.init({
          container,
          height: editorHeight,
          width: "auto",
          storageManager: false,
          noticeOnUnload: false,
          showOffsets: true,
          fromElement: false,
          plugins: [newsletterPlugin, editorToolsPlugin, freeLayoutPlugin, editorLinksPlugin],
          pluginsOpts: {
            [grapesNewsletterPluginId]: {
              showBlocksOnLoad: true,
              showStylesOnChange: true,
            },
          },
          richTextEditor: {
            // GrapesJS types only list string actions; objects are supported at runtime.
            actions: editorRichTextActions as unknown as string[],
          },
          assetManager: {
            autoAdd: true,
            multiUpload: false,
            upload: "/api/uploads?format=grapes",
            uploadName: "file",
            beforeUpload(files) {
              if (files.length === 0) return false;
            },
          },
          deviceManager: {
            devices: [
              { name: "Desktop", width: "" },
              { name: "Tablet", width: "768px", widthMedia: "992px" },
              { name: "Mobile", width: "320px", widthMedia: "480px" },
            ],
          },
        });

        const onUpdate = () => {
          if (editor) scheduleSave(editor);
        };
        editor.on("update", onUpdate);

        const onResize = () => {
          if (!editor || !containerRef.current) return;
          refreshEditorCanvas(editor);
        };
        window.addEventListener("resize", onResize);
        removeResize = () => window.removeEventListener("resize", onResize);

        await new Promise<void>((resolve) => {
          editor!.onReady(() => resolve());
        });
        if (cancelled) return;

        if (!loadHtmlIntoEditor(editor, initialHtml)) {
          throw new Error("The template could not be loaded into the editor.");
        }

        setupFreeLayout(editor);
        setupEditorTools(editor);
        removeLinkListener = setupEditorLinks(editor, (anchor) => {
          if (cancelled) return;
          setHasLinkTarget(Boolean(anchor));
          setLinkHref(anchor ? getLinkHref(anchor) : "");
        });
        syncCampaignReplyLinks(editor, {
          senderEmail: senderEmailRef.current,
          subject: subjectRefProp.current,
          ctaLabel: ctaRef.current || "Explore the idea",
          cta: ctaRef.current,
        });
        editorRef.current = editor;

        requestAnimationFrame(() => {
          if (!cancelled && editor) refreshEditorCanvas(editor);
        });

        bootstrappingRef.current = false;
        setPhase("ready");
      } catch (cause) {
        if (cancelled || (cause instanceof Error && cause.name === "AbortError")) return;
        setError(cause instanceof Error ? cause.message : "Could not open the editor.");
        setPhase("error");
      }
    }

    void boot();

    return () => {
      cancelled = true;
      controller.abort();
      removeResize?.();
      removeLinkListener?.();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      editor?.destroy();
      editor = null;
      editorRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderKey]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || phase !== "ready") return;
    syncCampaignReplyLinks(editor, {
      senderEmail,
      subject,
      ctaLabel: cta || "Explore the idea",
      cta,
    });
  }, [senderEmail, subject, cta, phase]);

  if (phase === "error") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-raised p-4 text-sm text-muted-foreground">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Logos and images behave like Canva: click to select, drag to move, use corner handles to
          resize. Double-click text boxes to edit. Use{" "}
          <strong>Bring forward</strong> / <strong>Send back</strong> for layering. Reset layout to
          restore the original template.
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || phase !== "ready"}
            onClick={() => editorRef.current?.runCommand("mx-add-text")}
          >
            <Type className="size-3.5" />
            Add text
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || phase !== "ready"}
            onClick={() => editorRef.current?.runCommand("mx-add-image")}
          >
            <ImagePlus className="size-3.5" />
            Add image
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || phase !== "ready"}
            onClick={() => editorRef.current?.runCommand("mx-align-left")}
            title="Align left"
          >
            <AlignLeft className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || phase !== "ready"}
            onClick={() => editorRef.current?.runCommand("mx-align-center")}
            title="Align center"
          >
            <AlignCenter className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || phase !== "ready"}
            onClick={() => editorRef.current?.runCommand("mx-align-right")}
            title="Align right"
          >
            <AlignRight className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || phase !== "ready"}
            onClick={() => editorRef.current?.runCommand("mx-layer-forward")}
            title="Bring selected layer forward"
          >
            <ArrowUp className="size-3.5" />
            Forward
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || phase !== "ready"}
            onClick={() => editorRef.current?.runCommand("mx-layer-backward")}
            title="Send selected layer backward"
          >
            <ArrowDown className="size-3.5" />
            Back
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || phase !== "ready"}
            onClick={() => editorRef.current?.runCommand("mx-make-free")}
            title="Convert selected text or element to free placement"
          >
            <Move className="size-3.5" />
            Free move
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || phase !== "ready"}
            onClick={() => editorRef.current?.runCommand("mx-delete-selected")}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || phase !== "ready" || !linkHref || linkHref === "#"}
          onClick={() => {
            if (!linkHref || linkHref === "#") return;
            if (linkHref.startsWith("mailto:") || linkHref.startsWith("tel:")) {
              window.location.href = linkHref;
            } else {
              window.open(linkHref, "_blank", "noopener,noreferrer");
            }
          }}
          title="Test the selected link or CTA button"
        >
          <ExternalLink className="size-3.5" />
          Open link
        </Button>
        <div className="ml-1 flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5">
          {(
            [
              ["Desktop", Monitor],
              ["Tablet", Tablet],
              ["Mobile", Smartphone],
            ] as const
          ).map(([name, Icon]) => (
            <Button
              key={name}
              type="button"
              size="sm"
              variant={activeDevice === name ? "primary" : "ghost"}
              className="h-7 px-2"
              disabled={disabled || phase !== "ready"}
              onClick={() => {
                const ed = editorRef.current;
                if (!ed) return;
                ed.setDevice(name);
                setActiveDevice(name);
                refreshEditorCanvas(ed);
              }}
              title={`${name} preview`}
            >
              <Icon className="size-3.5" />
            </Button>
          ))}
        </div>
        <span className="text-[0.6875rem] text-muted-foreground">
          Preview: {activeDevice === "Desktop" ? "full width" : activeDevice === "Tablet" ? "768px" : "320px"}
        </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() => {
              skipDraftRef.current = true;
              htmlDraftRef.current = "";
              onHtmlDraftChangeRef.current("");
              setResetToken((current) => current + 1);
            }}
          >
            Reset layout
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2">
        <Link2 className="size-4 shrink-0 text-accent" />
        <Input
          value={linkHref}
          onChange={(event) => setLinkHref(event.target.value)}
          placeholder={
            hasLinkTarget ? "https://example.com" : "Select a button or link to set its URL"
          }
          disabled={disabled || phase !== "ready" || !hasLinkTarget}
          spellCheck={false}
          className="h-8 min-w-[220px] flex-1"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || phase !== "ready" || !hasLinkTarget}
          onClick={() => {
            const ed = editorRef.current;
            if (!ed) return;
            ed.runCommand("mx-set-link", { href: linkHref });
          }}
        >
          Apply link
        </Button>
      </div>
      <div className="relative">
        {phase === "loading" ? (
          <div className="absolute inset-0 z-20 flex min-h-[720px] items-center justify-center gap-2 rounded-xl border border-border bg-white text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Loading editor…
          </div>
        ) : null}
        <div
          ref={containerRef}
          className={cn(
            "maxreach-grapes-editor overflow-hidden rounded-xl border border-border bg-white shadow-sm",
            disabled && phase === "ready" && "pointer-events-none opacity-80",
          )}
        />
      </div>
    </div>
  );
}
