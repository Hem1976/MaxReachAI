/** Shared HTML helpers for campaign email preview and delivery (client + server safe). */

/** Gmail clips messages larger than ~102KB. */
export const GMAIL_CLIP_BYTES = 102_000;

/** Drop only large inline images (visual-editor bloat). Keep small logos/icons. */
/** Allow one optimized brand logo inline; still block huge visual-editor images. */
const MAX_INLINE_IMAGE_SRC_CHARS = 20_000;

export function removeBase64Images(html: string): string {
  return html.replace(/<img\b[^>]*\bsrc=["']data:image[^"']+["'][^>]*>/gi, (tag) => {
    const match = tag.match(/\bsrc=["'](data:image[^"']+)["']/i);
    if (!match || match[1].length <= MAX_INLINE_IMAGE_SRC_CHARS) return tag;
    return "";
  });
}

export function ensureExternalLinkTargets(html: string): string {
  return html.replace(
    /<a\b([^>]*?)href=(["'])(https?:\/\/[^"']+)\2([^>]*)>/gi,
    (full, before, quote, href, after) => {
      if (/target\s*=/i.test(before + after)) return full;
      return `<a${before}href=${quote}${href}${quote} target="_blank" rel="noopener noreferrer"${after}>`;
    },
  );
}

/** Strip editor bloat so imported HTML stays small enough for Gmail. */
export function optimizeEmailHtmlForDelivery(html: string): string {
  let out = html.trim();
  if (!out) return out;
  out = removeBase64Images(out);
  out = ensureExternalLinkTargets(out);
  return out;
}

export function emailHtmlByteSize(html: string): number {
  return new TextEncoder().encode(html).length;
}

export function isLikelyGmailClipped(html: string): boolean {
  return emailHtmlByteSize(html) > GMAIL_CLIP_BYTES;
}
