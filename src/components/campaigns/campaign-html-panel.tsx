"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  FileUp,
  LoaderCircle,
  Pencil,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

import { CampaignTemplateEditor } from "@/components/campaigns/campaign-template-editor";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ensureExternalLinkTargets,
  isLikelyGmailClipped,
  optimizeEmailHtmlForDelivery,
} from "@/lib/campaigns/html-utils";
import {
  replaceVariables,
  VARIABLE_INSERT_OPTIONS,
  type VariableMap,
} from "@/lib/campaigns/variables";
import type { TemplateSlots } from "@/lib/templates/slots";
import { cn } from "@/lib/utils";

type Mode = "preview" | "edit";

function isUserTemplateId(id: string): boolean {
  return id.startsWith("user-") || id === "custom-html";
}

export function CampaignHtmlPanel({
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
  previewValues,
  disabled,
  onHtmlDraftChange,
  onSlotsChange,
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
  previewValues: VariableMap;
  disabled?: boolean;
  onHtmlDraftChange: (html: string) => void;
  onSlotsChange: (slots: TemplateSlots) => void;
}) {
  const [mode, setMode] = useState<Mode>("preview");
  const [advancedEditor, setAdvancedEditor] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [sizeWarning, setSizeWarning] = useState("");
  const [renderedHtml, setRenderedHtml] = useState("");
  const [rendering, setRendering] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadedTemplateRef = useRef("");

  const usesImportedHtml = isUserTemplateId(templateId) || htmlDraft.trim().length > 0;
  const hasHtml = htmlDraft.trim().length > 0;

  useEffect(() => {
    if (!isUserTemplateId(templateId) || templateId === "custom-html") return;
    if (loadedTemplateRef.current === templateId) return;

    let cancelled = false;
    setLoadingTemplate(true);
    setLoadError("");

    void fetch(`/api/user-templates?templateId=${encodeURIComponent(templateId)}`)
      .then(async (response) => {
        const data = (await response.json()) as { html?: string; error?: string };
        if (cancelled) return;
        if (!response.ok || !data.html) {
          throw new Error(data.error ?? "Could not load this template.");
        }
        loadedTemplateRef.current = templateId;
        onHtmlDraftChange(data.html);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Could not load this template.");
      })
      .finally(() => {
        if (!cancelled) setLoadingTemplate(false);
      });

    return () => {
      cancelled = true;
    };
  }, [templateId, onHtmlDraftChange]);

  useEffect(() => {
    if (hasHtml) {
      const prepared = ensureExternalLinkTargets(
        optimizeEmailHtmlForDelivery(replaceVariables(htmlDraft, previewValues)),
      );
      setRenderedHtml(prepared);
      setSizeWarning(
        isLikelyGmailClipped(prepared)
          ? "This HTML is large. Gmail may clip the message and show a blank email. Upload your .html file directly instead of using the advanced visual editor, or remove embedded images."
          : "",
      );
      return;
    }

    let cancelled = false;
    setRendering(true);

    void fetch("/api/render", {
      method: "POST",
      headers: { "content-type": "application/json" },
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
        slots,
      }),
    })
      .then(async (response) => {
        const data = (await response.json()) as { html?: string; error?: string };
        if (cancelled) return;
        if (!response.ok) {
          throw new Error(data.error ?? "Could not render the template.");
        }
        setRenderedHtml(data.html ?? "");
      })
      .catch((error) => {
        if (cancelled) return;
        setRenderedHtml("");
        setLoadError(error instanceof Error ? error.message : "Could not render preview.");
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    hasHtml,
    htmlDraft,
    previewValues,
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
  ]);

  const quickVars = useMemo(
    () => VARIABLE_INSERT_OPTIONS.filter((item) =>
      ["first_name", "company", "sender_name", "product_name"].includes(item.key),
    ),
    [],
  );

  function insertVariable(token: string) {
    onHtmlDraftChange(`${htmlDraft}${token}`);
    setMode("edit");
  }

  function handleFileUpload(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      if (!text.trim()) return;
      const cleaned = optimizeEmailHtmlForDelivery(text);
      onHtmlDraftChange(cleaned);
      setSizeWarning(
        isLikelyGmailClipped(cleaned)
          ? "This file is still over Gmail’s size limit. Remove large embedded images before sending."
          : "",
      );
      setMode("preview");
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border bg-surface-raised px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {usesImportedHtml ? "Your HTML email" : "Email preview"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {usesImportedHtml
                ? "Pick a ready-made design, paste HTML, or upload a file. Use {{first_name}} and {{company}} for personalization."
                : "Preview updates from your template. Import HTML anytime to skip the visual editor."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,.htm,text/html"
              className="hidden"
              disabled={disabled}
              onChange={(event) => {
                handleFileUpload(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="size-3.5" />
              Upload HTML
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "edit" ? "primary" : "outline"}
              disabled={disabled}
              onClick={() => setMode("edit")}
            >
              <Pencil className="size-3.5" />
              {hasHtml ? "Edit HTML" : "Paste HTML"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "preview" ? "primary" : "outline"}
              disabled={disabled}
              onClick={() => setMode("preview")}
            >
              Preview
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {quickVars.map((option) => (
            <Button
              key={option.key}
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              disabled={disabled}
              onClick={() => insertVariable(`{{${option.key}}}`)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {loadError ? (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>{loadError}</span>
        </div>
      ) : null}

      {sizeWarning ? (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>{sizeWarning}</span>
        </div>
      ) : null}

      {mode === "edit" ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={htmlDraft}
            onChange={(event) => onHtmlDraftChange(event.target.value)}
            placeholder="Paste your full HTML email here. You can use {{first_name}}, {{company}}, {{sender_name}}, and other variables."
            disabled={disabled || loadingTemplate}
            className="min-h-[420px] font-mono text-xs leading-relaxed"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            Save the campaign when you are done. This HTML is exactly what Postmark will send.
          </p>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-border bg-white">
          {loadingTemplate || rendering ? (
            <div className="absolute inset-0 z-10 flex min-h-[720px] items-center justify-center gap-2 bg-white/90 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              {loadingTemplate ? "Loading your template…" : "Rendering preview…"}
            </div>
          ) : null}
          {renderedHtml ? (
            <iframe
              title="Email preview"
              srcDoc={renderedHtml}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              className="min-h-[720px] w-full border-0"
            />
          ) : (
            <div className="flex min-h-[320px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
              Choose a template or paste HTML to see a preview.
            </div>
          )}
        </div>
      )}

      {!isUserTemplateId(templateId) ? (
        <div className="rounded-lg border border-dashed border-border">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            disabled={disabled}
            onClick={() => setAdvancedEditor((current) => !current)}
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="size-4" />
              <span>Advanced visual editor (optional)</span>
            </div>
            <ChevronDown
              className={cn("size-4 text-muted-foreground transition-transform", advancedEditor && "rotate-180")}
            />
          </button>
          {advancedEditor ? (
            <div className="border-t border-border p-3">
              <CampaignTemplateEditor
                key={`${templateId}-advanced`}
                templateId={templateId}
                productId={productId}
                productName={productName}
                subject={subject}
                email={email}
                cta={cta}
                company={company}
                contactName={contactName}
                senderName={senderName}
                senderEmail={senderEmail}
                senderCompany={senderCompany}
                slots={slots}
                htmlDraft={htmlDraft}
                disabled={disabled}
                onHtmlDraftChange={onHtmlDraftChange}
                onSlotsChange={onSlotsChange}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
