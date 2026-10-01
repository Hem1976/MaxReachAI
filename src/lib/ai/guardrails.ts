import type { OutreachDraft } from "@/lib/types";

/**
 * GUARDRAILS
 * ==========
 * Two layers sit between the model and the rep:
 *
 *  - `validateDraft` returns blocking problems. These trigger a repair call.
 *  - `reviewDraft` returns non-blocking review flags. These are surfaced in the
 *    UI so the rep checks a claim before sending, rather than silently trusting
 *    it. Nothing here rewrites copy on the rep's behalf.
 */

const PLACEHOLDER = /\[[^\]]{2,40}\]|\{\{[^}]+\}\}|\bTODO\b|\bXXX+\b|\bYour Company\b/i;

/** Claims a local model tends to fabricate. Each one needs human eyes. */
const FABRICATION_PATTERNS: { pattern: RegExp; flag: string }[] = [
  {
    pattern: /\b\d+(?:\.\d+)?\s?%/,
    flag: "Contains a percentage. Maxpro has no approved statistics — remove it or replace it with a qualitative statement.",
  },
  {
    pattern: /(?:[$£€₹]\s?\d|\b\d+\s?(?:usd|inr|eur|gbp|lakh|crore|k per|million|billion)\b)/i,
    flag: "Mentions a monetary figure. Pricing and financial claims must not appear in cold outreach.",
  },
  {
    pattern: /\b\d+(?:\.\d+)?\s?x\b/i,
    flag: "Contains a multiplier claim such as \"3x\". Remove it — there is no approved benchmark behind it.",
  },
  {
    pattern: /\b(?:trusted by|used by|customers like|clients like|companies like)\b[^.]{0,40}\b(?:\d+|[A-Z][a-z]+)/,
    flag: "Reads like social proof or a named customer. Verify before sending.",
  },
  {
    pattern: /\b(?:case study|success story|testimonial|white ?paper)\b/i,
    flag: "References a case study or asset that may not exist.",
  },
  {
    pattern: /\b(?:iso\s?\d+|soc\s?2|gdpr[- ]certified|hipaa[- ]certified|award[- ]winning|certified partner)\b/i,
    flag: "Claims a certification, compliance status or award. Not approved for outreach copy.",
  },
  {
    pattern: /\b(?:integrates? with|integration with|works with)\s+(?:sap|oracle|tally|salesforce|zoho|shopify|netsuite|dynamics|quickbooks)\b/i,
    flag: "Names a specific integration. Confirm it exists before sending.",
  },
  {
    pattern: /\b(?:\d+\s?(?:%|percent)?\s?(?:faster|cheaper|more|less|reduction|increase|savings?))\b/i,
    flag: "Contains a quantified improvement claim. Remove the figure.",
  },
  {
    pattern: /\bwithin\s+\d+\s+(?:days?|weeks?|months?)\b/i,
    flag: "Promises a result within a specific timeframe. Not defensible — remove it.",
  },
  {
    pattern: /\b(?:i|we)\s?(?:'ve|\s+have)?\s+(?:worked|partnered|collaborated|dealt)\s+with\b/i,
    flag: "Claims the sender has worked with other companies. Nothing in the product knowledge supports that — rewrite it.",
  },
  {
    pattern: /\b(?:i|we)\s?(?:'ve|'d|\s+have)?\s+(?:noticed|saw|read|came across|found|been following)\b/i,
    flag: "Claims to have researched the prospect. Only keep this if the rep can actually back it up.",
  },
  {
    pattern: /\b(?:real[- ]?time|ai[- ]powered|machine learning|fully automat(?:ed|ic)|plug[- ]and[- ]play|no[- ]code|out of the box|instantl?y?)\b/i,
    flag: "Describes a capability in words the product knowledge does not use. Reword it to match what the product actually does.",
  },
  {
    pattern: /\b(?:most|many|all)\s+of\s+our\s+(?:customers|clients)\b/i,
    flag: "Generalises about existing customers. Maxpro has no approved customer claims for outreach.",
  },
];

/** Language that undermines a premium B2B tone. Style flags, not factual ones. */
const STYLE_PATTERNS: { pattern: RegExp; flag: string }[] = [
  {
    pattern: /\b(?:revolutionary|cutting[- ]edge|game[- ]?chang(?:er|ing)|seamless(?:ly)?|synergy|leverag(?:e|ing)|best[- ]in[- ]class|world[- ]class|unlock|supercharge|turnkey|one[- ]stop)\b/i,
    flag: "Uses marketing filler language that reads as generic. Consider rewording.",
  },
  {
    pattern: /\bhope this (?:email|message) finds you well\b/i,
    flag: "Opens with a filler greeting. Replace it with a specific first line.",
  },
  {
    pattern: /\b(?:just following up|circling back|bumping this|touching base|wanted to follow up|following up on my (?:previous|last)|did you see my (?:last )?(?:email|message)|had a chance to (?:consider|review|look))\b/i,
    flag: "Uses a follow-up cliché that tends to lower reply rates.",
  },
  { pattern: /!/, flag: "Contains an exclamation mark, which reads informal for this audience." },
];

export interface ValidationProblem {
  field: keyof OutreachDraft | "output";
  message: string;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Blocking checks. Small models get field semantics wrong in predictable ways
 * (an email address in `email`, topic fragments in `subjects`), so each check
 * returns a message the model can act on directly.
 */
export function validateDraft(
  draft: OutreachDraft,
  expected: { minWords: number; maxWords: number; contactFirstName: string },
): ValidationProblem[] {
  const problems: ValidationProblem[] = [];

  const emailWords = wordCount(draft.email);
  if (emailWords < 25) {
    problems.push({
      field: "email",
      message: `The "email" field must contain the complete email body, but it only has ${emailWords} words. Write the full email: greeting, ${expected.minWords} to ${expected.maxWords} words of body, then the sign-off.`,
    });
  } else if (emailWords > expected.maxWords * 1.6) {
    problems.push({
      field: "email",
      message: `The "email" field is ${emailWords} words, far over the ${expected.minWords} to ${expected.maxWords} word target. Rewrite it inside the range.`,
    });
  }

  if (/^\S+@\S+\.\S+$/.test(draft.email.trim()) || /^\(.*\)$/.test(draft.email.trim())) {
    problems.push({
      field: "email",
      message: 'The "email" field must be the email body text, not an email address or a note in brackets.',
    });
  }

  if (PLACEHOLDER.test(draft.email)) {
    problems.push({
      field: "email",
      message: 'The "email" field contains a placeholder. Replace every placeholder with finished copy.',
    });
  }

  if (draft.subjects.length < 3) {
    problems.push({
      field: "subjects",
      message: `"subjects" must contain exactly 3 subject lines, but it has ${draft.subjects.length}.`,
    });
  }

  const badSubjects = draft.subjects.filter((subject) => {
    const words = wordCount(subject);
    return words < 2 || words > 14 || subject.includes("@") || PLACEHOLDER.test(subject);
  });
  if (badSubjects.length > 0) {
    problems.push({
      field: "subjects",
      message: `These are not usable subject lines: ${badSubjects
        .map((s) => `"${s}"`)
        .join(", ")}. Each subject line must be a 3 to 9 word headline, with no placeholders and no email addresses.`,
    });
  }

  const uniqueSubjects = new Set(draft.subjects.map((s) => s.trim().toLowerCase()));
  if (draft.subjects.length >= 3 && uniqueSubjects.size < 3) {
    problems.push({
      field: "subjects",
      message: "The 3 subject lines must be genuinely different from each other.",
    });
  }

  if (wordCount(draft.followUp) < 12) {
    problems.push({
      field: "followUp",
      message: 'The "followUp" field must be a complete short follow-up email of 2 to 4 sentences, starting with a greeting.',
    });
  }

  if (wordCount(draft.painPoint) < 4) {
    problems.push({
      field: "painPoint",
      message: 'The "painPoint" field must be one full sentence describing the business problem.',
    });
  }

  if (wordCount(draft.angle) < 4) {
    problems.push({
      field: "angle",
      message: 'The "angle" field must be one full sentence describing the outreach angle.',
    });
  }

  if (
    expected.contactFirstName &&
    !draft.email.toLowerCase().includes(expected.contactFirstName.toLowerCase())
  ) {
    problems.push({
      field: "email",
      message: `The email must greet the contact by first name (${expected.contactFirstName}).`,
    });
  }

  return problems;
}

/** Non-blocking flags shown next to the draft for the rep to check. */
export function reviewDraft(
  draft: OutreachDraft,
  context?: { contactFirstName?: string },
): string[] {
  const haystack = [
    draft.email,
    draft.followUp,
    draft.followUp2 ?? "",
    ...draft.subjects,
  ].join("\n");
  const flags: string[] = [];

  for (const { pattern, flag } of FABRICATION_PATTERNS) {
    if (pattern.test(haystack)) flags.push(flag);
  }
  for (const { pattern, flag } of STYLE_PATTERNS) {
    if (pattern.test(haystack)) flags.push(flag);
  }
  if (PLACEHOLDER.test(haystack)) {
    flags.push("Contains an unfilled placeholder. Edit it before sending.");
  }

  // The inline follow-up is a by-product of the main generation, so it is the
  // field a small model is most likely to cut short. Flag it rather than paying
  // for a repair round: "Generate Follow-up" rewrites it in a few seconds.
  const first = context?.contactFirstName?.trim();
  if (first && !draft.followUp.toLowerCase().includes(first.toLowerCase())) {
    flags.push(
      `The follow-up does not greet ${first}. Use "Generate Follow-up" to rewrite it.`,
    );
  }

  return Array.from(new Set(flags));
}

/**
 * Local models return subject lines in marketing Title Case however firmly the
 * prompt asks otherwise. Casing is mechanical, so it is corrected here instead
 * of being spent on another generation round.
 */
export function toSentenceCase(subject: string, protectedTerms: Set<string>): string {
  const runs = [...subject.matchAll(/[A-Za-z][A-Za-z']*/g)];
  const meaningful = runs.filter((run) => run[0].length >= 3);
  if (meaningful.length < 3) return subject;

  const capitalised = meaningful
    .slice(1)
    .filter((run) => /^[A-Z]/.test(run[0])).length;
  const isTitleCase = capitalised / Math.max(1, meaningful.length - 1) >= 0.6;
  if (!isTitleCase) return subject;

  let seenFirst = false;
  return subject.replace(/[A-Za-z][A-Za-z']*/g, (word) => {
    if (!seenFirst) {
      seenFirst = true;
      return word;
    }
    // Acronyms (FMCG, AI, BI) and known proper nouns keep their casing.
    if (word === word.toUpperCase() && word.length <= 5) return word;
    // Possessives ("Sciences'") must still match the protected term list.
    if (protectedTerms.has(word.replace(/'/g, "").toLowerCase())) return word;
    return word.charAt(0).toLowerCase() + word.slice(1);
  });
}

/** Removes model artefacts that are never wanted in an email body. */
export function cleanCopy(text: string): string {
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/```$/, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\n)\s*[*•-]\s+/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return normaliseParagraphs(cleaned);
}

/**
 * Models often separate paragraphs with a single newline despite being asked
 * for a blank line, which would collapse the whole body into one block when the
 * MJML template splits it. Promote single newlines to paragraph breaks, keeping
 * a trailing sign-off ("Best," / "Rahul Mehta") together as one block.
 */
function normaliseParagraphs(text: string): string {
  if (/\n\s*\n/.test(text)) return text;

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return text;

  const blocks: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const isSignOff =
      /,$/.test(line) &&
      wordCount(line) <= 3 &&
      index >= lines.length - 2 &&
      index + 1 < lines.length;

    if (isSignOff) {
      blocks.push(`${line}\n${lines[index + 1]}`);
      index += 1;
    } else {
      blocks.push(line);
    }
  }

  return blocks.join("\n\n");
}

/**
 * Small models drop the sign-off often enough that it is worth appending
 * deterministically. This is assembly, not authorship — the name comes from
 * Settings, so nothing is being invented.
 */
export function ensureSignOff(body: string, senderName: string): string {
  const name = senderName.trim();
  if (!name) return body;
  if (body.toLowerCase().includes(name.toLowerCase())) return body;
  return `${body}\n\nBest,\n${name}`;
}

export function cleanSubject(text: string): string {
  return text
    .replace(/^\s*(?:subject|subject line)\s*[:\-–]\s*/i, "")
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/^re\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .replace(/\.$/, "")
    .trim();
}
