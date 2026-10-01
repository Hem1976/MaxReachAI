const EMAIL_SPLIT_PATTERN = /[,;/|]+|\s+and\s+|\r?\n+/i;

/** Strip common wrappers from a single address token. */
function cleanEmailToken(token: string): string {
  return token
    .trim()
    .replace(/^mailto:/i, "")
    .replace(/^<+/, "")
    .replace(/>+$/, "")
    .trim();
}

export function looksLikeEmail(email: string): boolean {
  return /^\S+@\S+\.\S+$/.test(cleanEmailToken(email));
}

/** Split a spreadsheet cell that may contain several addresses. */
export function parseEmailAddresses(raw: string): string[] {
  const text = raw.trim();
  if (!text) return [];

  const seen = new Set<string>();
  const out: string[] = [];

  for (const part of text.split(EMAIL_SPLIT_PATTERN)) {
    const cleaned = cleanEmailToken(part);
    if (!looksLikeEmail(cleaned)) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }

  return out;
}

export function hasDeliverableEmail(raw: string): boolean {
  return parseEmailAddresses(raw).length > 0;
}

export function primaryEmail(raw: string): string {
  return parseEmailAddresses(raw)[0] ?? "";
}
