import type { Editor } from "grapesjs";

import { stripEditorChrome } from "@/lib/templates/html/visual-editor";
import { ensureResponsiveEmailHtml } from "@/lib/templates/html/responsive";

const NEWSLETTER_INLINE_CMD = "gjs-get-inlined-html";

export function extractBodyHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return "";
  const bodyMatch = trimmed.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) return bodyMatch[1].trim();
  return trimmed;
}

export function escapeHtmlTitle(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function wrapEmailDocument(bodyHtml: string, subject: string): string {
  const title = escapeHtmlTitle(subject || "Email");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body>${bodyHtml}</body></html>`;
}

/** Normalize saved or rendered HTML for GrapesJS document import. */
export function prepareGrapesEditorHtml(html: string, subject: string): string {
  const cleaned = stripEditorChrome(html).trim();
  if (!cleaned) return "";

  if (/<!doctype/i.test(cleaned) || /<html[\s>]/i.test(cleaned)) {
    return cleaned;
  }

  const body = extractBodyHtml(cleaned);
  if (!body) return "";
  return wrapEmailDocument(body, subject);
}

export function hasMeaningfulEditorHtml(html: string): boolean {
  const prepared = prepareGrapesEditorHtml(html, "Email");
  if (!prepared) return false;

  const body = extractBodyHtml(prepared);
  if (!body) return false;
  if (/<table[\s>]/i.test(body) || /<img[\s>]/i.test(body)) return true;

  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 24;
}

/** Export send-ready HTML from a GrapesJS newsletter editor instance. */
export function exportNewsletterHtml(editor: Editor, subject: string): string {
  const inlined = editor.runCommand(NEWSLETTER_INLINE_CMD);
  if (typeof inlined === "string" && inlined.trim()) {
    const body = extractBodyHtml(inlined);
    return ensureResponsiveEmailHtml(wrapEmailDocument(body || inlined, subject));
  }

  const body = editor.getHtml();
  const css = editor.getCss({ avoidProtected: true }) ?? "";
  const withStyle = css.trim()
    ? `${body}<style>${css}</style>`
    : body;
  return ensureResponsiveEmailHtml(wrapEmailDocument(withStyle, subject));
}

export const grapesNewsletterPluginId = "grapesjs-preset-newsletter";
