import type { Component, Editor, Plugin } from "grapesjs";

import { ctaButtonHref } from "@/lib/templates/text";

const PLUGIN_ID = "maxreach-editor-links";

export function findAnchorComponent(
  editor: Editor,
  component?: Component | null,
): Component | null {
  let current = component ?? editor.getSelected() ?? null;
  if (!current) return null;

  const nested = current.find("a")?.[0];
  if (nested) return nested;

  while (current) {
    const tag = String(current.get("tagName") ?? "").toLowerCase();
    if (current.is("link") || tag === "a") return current;
    current = current.parent() ?? null;
  }
  return null;
}

export function getLinkHref(component: Component): string {
  const href = String(component.getAttributes().href ?? "").trim();
  return href || "#";
}

export function setLinkHref(component: Component, href: string) {
  const value = href.trim() || "#";
  const attrs: Record<string, string> = { href: value };
  if (value.startsWith("mailto:") || value.startsWith("tel:") || value === "#") {
    attrs.target = "";
    attrs.rel = "";
  } else {
    attrs.target = "_blank";
    attrs.rel = "noopener noreferrer";
  }
  component.addAttributes(attrs);
}

export function syncCampaignReplyLinks(
  editor: Editor,
  input: { senderEmail: string; subject: string; ctaLabel: string; cta?: string },
) {
  const href = ctaButtonHref(input);
  if (!href.startsWith("mailto:")) return;

  const anchors = editor.getWrapper()?.find("a") ?? [];
  for (const anchor of anchors) {
    const el = anchor.getEl();
    const inner = el?.innerHTML?.toLowerCase() ?? "";
    const style = el?.getAttribute("style")?.toLowerCase() ?? "";
    const looksLikeCta =
      inner.includes("data-slot=\"cta_label\"") ||
      inner.includes("→") ||
      /#20a4b8/.test(style) ||
      /\b(explore|reply|book|demo|see how|start)\b/.test(el?.textContent?.toLowerCase() ?? "");
    if (looksLikeCta) setLinkHref(anchor, href);
  }
}

function lockEditableChildren(anchor: Component) {
  anchor.components().forEach((child: Component) => {
    child.set({
      editable: false,
      draggable: false,
      droppable: false,
    });
  });
}

function normalizeAnchors(editor: Editor) {
  const anchors = editor.getWrapper()?.find("a") ?? [];
  for (const anchor of anchors) {
    if (!anchor.is("link")) {
      anchor.set("type", "link");
    }
    lockEditableChildren(anchor);
  }
}

export type LinkTargetListener = (anchor: Component | null) => void;

export function setupEditorLinks(editor: Editor, onTargetChange?: LinkTargetListener) {
  const notify = () => {
    onTargetChange?.(findAnchorComponent(editor));
  };

  editor.on("component:selected", notify);
  editor.on("component:deselected", notify);
  normalizeAnchors(editor);
  notify();

  return () => {
    editor.off("component:selected", notify);
    editor.off("component:deselected", notify);
  };
}

export const editorLinksPlugin: Plugin = (editor) => {
  const dc = editor.DomComponents;

  dc.addType("link", {
    extend: "link",
    model: {
      defaults: {
        name: "Link",
        traits: [
          {
            type: "text",
            name: "href",
            label: "Link URL",
            placeholder: "https://example.com",
          },
          {
            type: "text",
            name: "title",
            label: "Title",
          },
          {
            type: "select",
            name: "target",
            label: "Open in",
            options: [
              { id: "", name: "Same tab" },
              { id: "_blank", name: "New tab" },
            ],
          },
        ],
      },
    },
  });

  editor.Commands.add("mx-set-link", {
    run(ed, _sender, options?: { href?: string }) {
      const anchor = findAnchorComponent(ed);
      if (!anchor) {
        ed.log("Select a button or link first.", { level: "warning" });
        return;
      }
      if (typeof options?.href === "string") {
        setLinkHref(anchor, options.href);
        return;
      }
      const current = getLinkHref(anchor);
      const next = window.prompt(
        "Enter the link URL",
        current === "#" ? "https://" : current,
      );
      if (next !== null) setLinkHref(anchor, next);
    },
  });

  editor.on("component:add", (component) => {
    const parent = component.parent();
    if (parent && (parent.is("link") || parent.get("tagName") === "a")) {
      component.set({ editable: false, draggable: false });
    }
    if (component.is("link") || component.get("tagName") === "a") {
      lockEditableChildren(component);
    }
  });

  editor.on("load", () => normalizeAnchors(editor));

  editor.on("component:selected", (component) => {
    const anchor = findAnchorComponent(editor, component);
    if (!anchor) return;
    lockEditableChildren(anchor);
  });
};

export const editorLinksPluginId = PLUGIN_ID;
