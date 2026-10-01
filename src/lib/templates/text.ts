import { DEFAULT_REPLY_EMAIL } from "@/lib/templates/sender-defaults";

/** Plain-text helpers shared by the block builder and the skins. */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const KNOWN_LINKS: Array<{ pattern: RegExp; href: string }> = [
  { pattern: /\bmaxpro(?:\s+infotech)?\s+website\b/gi, href: "https://maxproinfotech.com" },
  { pattern: /\bakshar\s*jobs\s+website\b/gi, href: "https://aksharjobs.com" },
  { pattern: /\baksharjobs\b/gi, href: "https://aksharjobs.com" },
  { pattern: /\blinkedin\b/gi, href: "https://www.linkedin.com/company/maxpro-infotech-limited" },
];

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<]+/gi;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

type LinkHit = { start: number; end: number; href: string; label: string };

function overlaps(hit: LinkHit, start: number, end: number): boolean {
  return start < hit.end && end > hit.start;
}

function trimUrlMatch(raw: string): { hrefSource: string; trailing: string } {
  let hrefSource = raw;
  let trailing = "";
  while (hrefSource.length > 0 && /[),.;:!?]+$/.test(hrefSource)) {
    trailing = hrefSource.slice(-1) + trailing;
    hrefSource = hrefSource.slice(0, -1);
  }
  return { hrefSource, trailing };
}

function safeHttpHref(raw: string): string | null {
  const candidate = /^www\./i.test(raw) ? `https://${raw}` : raw;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function collectHits(value: string): LinkHit[] {
  const hits: LinkHit[] = [];

  for (const match of value.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    const { hrefSource } = trimUrlMatch(match[0]);
    const href = safeHttpHref(hrefSource);
    if (!href) continue;
    hits.push({
      start,
      end: start + hrefSource.length,
      href,
      label: hrefSource,
    });
  }

  for (const match of value.matchAll(EMAIL_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (hits.some((hit) => overlaps(hit, start, end))) continue;
    hits.push({
      start,
      end,
      href: `mailto:${match[0]}`,
      label: match[0],
    });
  }

  for (const known of KNOWN_LINKS) {
    known.pattern.lastIndex = 0;
    for (const match of value.matchAll(known.pattern)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (hits.some((hit) => overlaps(hit, start, end))) continue;
      hits.push({ start, end, href: known.href, label: match[0] });
    }
  }

  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: LinkHit[] = [];
  for (const hit of hits) {
    if (kept.some((existing) => overlaps(existing, hit.start, hit.end))) continue;
    kept.push(hit);
  }
  return kept;
}

function anchor(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}

/**
 * Escapes plain email copy and turns URLs, emails, and known labels
 * (MaxPro Website, Aksharjobs, LinkedIn) into clickable links.
 */
export function formatEmailCopy(value: string): string {
  const hits = collectHits(value);
  let cursor = 0;
  let html = "";
  for (const hit of hits) {
    html += escapeHtml(value.slice(cursor, hit.start));
    html += anchor(hit.href, hit.label);
    cursor = hit.end;
  }
  html += escapeHtml(value.slice(cursor));
  return html.replace(/\n/g, "<br />");
}

/** Resolve the inbox prospects reply to when they click a CTA button. */
export function replyToEmail(senderEmail: string): string {
  const email = senderEmail.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return email;
  return DEFAULT_REPLY_EMAIL;
}

/**
 * CTA buttons open the recipient's mail app addressed to the sender.
 * Meeting-style labels also pre-fill a date/time draft. An https URL in the
 * CTA field is used as-is.
 */
export function ctaButtonHref(input: {
  senderEmail: string;
  subject: string;
  ctaLabel: string;
  cta?: string;
}): string {
  const explicit = (input.cta ?? "").trim();
  if (/^https?:\/\//i.test(explicit)) return explicit;

  const email = replyToEmail(input.senderEmail);
  const params: string[] = [];
  const subject = input.subject.trim();
  if (subject) params.push(`subject=${encodeURIComponent(`Re: ${subject}`)}`);

  const label = input.ctaLabel.toLowerCase();
  if (/\b(time|demo|meeting|walkthrough|book)\b/.test(label)) {
    params.push(
      `body=${encodeURIComponent(
        "Hello,\n\nI would like to suggest a time:\n\nDate:\nTime:\n\nThank you.\n",
      )}`,
    );
  } else if (/\b(explore|reply|conversation|idea|interested|discuss|connect|works)\b/.test(label)) {
    params.push(
      `body=${encodeURIComponent(
        "Hello,\n\nThank you for reaching out. I would like to explore this further.\n\n",
      )}`,
    );
  }

  return params.length > 0 ? `mailto:${email}?${params.join("&")}` : `mailto:${email}`;
}

/** Ensure saved campaign HTML always has working reply mailto links on CTA buttons. */
export function repairCtaMailtoLinks(
  html: string,
  input: { senderEmail: string; subject: string; ctaLabel: string; cta?: string },
): string {
  const href = ctaButtonHref(input);
  if (!href.startsWith("mailto:")) return html;

  return html.replace(
    /<a\b([^>]*?)href=(["'])(?:mailto:[^"']*|#)\2([^>]*?)>([\s\S]*?)<\/a>/gi,
    (full, before, quote, after, inner) => {
      const chunk = `${before}${inner}${after}`.toLowerCase();
      const looksLikeCta =
        /data-slot="cta_label"/i.test(inner) ||
        /→/.test(inner) ||
        /\b(explore|reply|book|demo|see how|start)\b/.test(chunk) ||
        /background\s*:\s*#20a4b8/i.test(before + after);
      if (!looksLikeCta) return full;
      const targetAttr = href.startsWith("mailto:") ? "" : ' target="_blank" rel="noopener noreferrer"';
      return `<a${before}href=${quote}${href}${quote}${targetAttr}${after}>${inner}</a>`;
    },
  );
}

/** Splits plain-text copy into paragraphs, keeping single newlines as breaks. */
export function toParagraphs(body: string): string[] {
  const normalised = body.replace(/\r\n/g, "\n");
  const blocks = normalised
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  // Copy written with single newlines instead of blank lines would otherwise
  // render as one wall of text. This also covers records saved by earlier runs.
  if (blocks.length === 1 && normalised.includes("\n")) {
    return normalised
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  return blocks;
}
