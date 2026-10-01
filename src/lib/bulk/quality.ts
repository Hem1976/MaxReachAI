import type { BulkLead } from "@/lib/bulk/types";

export interface QualityItem {
  id: string;
  label: string;
  passed: boolean;
}

export interface QualityReport {
  items: QualityItem[];
  passedCount: number;
  score: number;
  ready: boolean;
}

export interface QualityInput {
  company: string;
  industry: string;
  jobTitle: string;
  notes: string;
  productName: string;
  subjects: string[];
  recommendedSubject: string;
  emailBody: string;
  cta: string;
  followUp1: string;
  followUp2: string;
  reviewFlags: string[];
  confidenceScore: number;
}

const FOLLOW_UP_CLICHE =
  /\b(?:just )?follow(?:ing)? up\b|\bcircling back\b|\bchecking in\b|\bbumping this\b/i;

/**
 * Deterministic checks a rep can scan before sending. Nothing here is
 * self-reported by the model — each row is a fact about the brief or the copy.
 */
export function evaluateQuality(input: QualityInput): QualityReport {
  const body = input.emailBody;
  const items: QualityItem[] = [
    {
      id: "company",
      label: "Company identified",
      passed: input.company.trim().length > 1,
    },
    {
      id: "product",
      label: "Product relevant",
      passed: input.productName.trim().length > 0,
    },
    {
      id: "personalization",
      label: "Mentions something real",
      passed: personalizationGrounded(input, body),
    },
    {
      id: "claims",
      label: "No made-up claims",
      passed: input.reviewFlags.length === 0,
    },
    {
      id: "cta",
      label: "Has a next step",
      passed: hasCta(input.cta, body),
    },
    {
      id: "subject",
      label: "Has subject lines",
      passed:
        input.recommendedSubject.trim().length > 0 &&
        input.subjects.filter((subject) => subject.trim()).length >= 3,
    },
    {
      id: "followups",
      label: "Has follow-up emails",
      passed: hasFollowUps(input.followUp1, input.followUp2),
    },
  ];

  const passedCount = items.filter((item) => item.passed).length;
  const score = Math.max(0, Math.min(100, Math.round(input.confidenceScore)));

  return {
    items,
    passedCount,
    score,
    ready: items.every((item) => item.passed),
  };
}

export function qualityFromLead(lead: BulkLead): QualityReport {
  return evaluateQuality({
    company: lead.company,
    industry: lead.industry,
    jobTitle: lead.jobTitle,
    notes: lead.notes,
    productName: lead.productName,
    subjects: lead.subjects,
    recommendedSubject: lead.recommendedSubject,
    emailBody: lead.emailBody,
    cta: lead.cta ?? "",
    followUp1: lead.followUp1,
    followUp2: lead.followUp2,
    reviewFlags: lead.reviewFlags,
    confidenceScore: lead.confidenceScore,
  });
}

function personalizationGrounded(input: QualityInput, body: string): boolean {
  if (!body.trim() || !input.company.trim()) return false;
  if (!mentions(body, input.company)) return false;

  const extras = [input.industry, input.jobTitle, input.notes]
    .map((value) => value.trim())
    .filter((value) => value.length >= 4);

  // A company-only row is still grounded if the email names them and does not
  // invent the rest — the claims check covers invention.
  if (extras.length === 0) return true;

  return extras.some((value) => mentions(body, value));
}

function hasCta(cta: string, email: string): boolean {
  if (cta.trim().length >= 8) return true;
  const tail = email.trim().slice(-420);
  return /\?/.test(tail);
}

function hasFollowUps(first: string, second: string): boolean {
  if (first.trim().length < 24 || second.trim().length < 12) return false;
  return !FOLLOW_UP_CLICHE.test(first) && !FOLLOW_UP_CLICHE.test(second);
}

function mentions(haystack: string, phrase: string): boolean {
  const hay = haystack.toLowerCase();
  const tokens = phrase
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 3);
  if (tokens.length === 0) {
    const needle = phrase.trim().toLowerCase();
    return needle.length > 0 && hay.includes(needle);
  }
  // Require the distinctive tokens, not every stopword in a long notes field.
  const distinctive = tokens.filter(
    (token) => !STOP.has(token) && token.length > 4,
  );
  const check = distinctive.length > 0 ? distinctive.slice(0, 6) : tokens.slice(0, 3);
  const hits = check.filter((token) => hay.includes(token)).length;
  return hits >= Math.min(2, check.length) || (check.length === 1 && hits === 1);
}

const STOP = new Set([
  "about",
  "their",
  "there",
  "which",
  "would",
  "could",
  "still",
  "using",
  "across",
  "through",
  "managed",
  "orders",
  "sales",
  "team",
  "teams",
]);
