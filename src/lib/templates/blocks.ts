import type { EmailBlocks, EmailSender } from "@/lib/templates/types";
import { toParagraphs } from "@/lib/templates/text";
import type { Product } from "@/lib/types";

/**
 * Turns one plain-text draft into the named slots a rich skin needs.
 *
 * This runs entirely on output the model has already produced plus the local
 * product knowledge base — there is no second generation here. That matters
 * for two reasons: a richer layout costs no extra latency, and the lists a
 * template renders as "what it handles" are verbatim catalogue copy rather
 * than something the model could have invented.
 */

const GREETING = /^(hi|hello|hey|dear|good (?:morning|afternoon|evening))\b[^.!?]{0,60}[,:]?$/i;

const SIGN_OFF_OPENER =
  /^(best|best regards|regards|kind regards|warm regards|thanks|thank you|sincerely|cheers|all the best|yours sincerely|yours truly)[,.!]?$/i;

/** Splits a body into greeting / substance / sign-off without losing anything. */
function partition(body: string, senderName: string) {
  const paragraphs = toParagraphs(body);
  let greeting = "";
  let start = 0;

  if (paragraphs.length > 0 && GREETING.test(paragraphs[0].trim())) {
    greeting = paragraphs[0].trim();
    start = 1;
  }

  let end = paragraphs.length;
  const name = senderName.trim().toLowerCase();

  // The sign-off is usually one block ("Best,\nRahul Mehta") but models
  // sometimes split it across two. Walk backwards over both shapes.
  while (end > start) {
    const block = paragraphs[end - 1].trim();
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const isSignOff =
      SIGN_OFF_OPENER.test(lines[0] ?? "") ||
      (lines.length <= 2 && name.length > 0 && block.toLowerCase() === name);
    if (!isSignOff) break;
    end -= 1;
  }

  return { greeting, middle: paragraphs.slice(start, end) };
}

function truncate(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).replace(/[\s,;:.-]+$/, "")}…`;
}

export function signatureLines(sender: EmailSender): string[] {
  return [sender.name, sender.title, sender.companyName, sender.email, sender.phone]
    .map((line) => line.trim())
    .filter(Boolean);
}

export interface BuildBlocksInput {
  subject: string;
  body: string;
  cta: string;
  ctaLabel: string;
  productName: string;
  sender: EmailSender;
  /** Supplies the grounded capability and outcome lists. */
  product?: Product;
}

export function buildBlocks(input: BuildBlocksInput): EmailBlocks {
  const { greeting, middle } = partition(input.body, input.sender.name);

  const [intro, ...rest] = middle;
  const cta = input.cta.trim();

  // A skin that renders the ask separately would otherwise show it twice,
  // since the model normally ends the body with the same sentence.
  const paragraphs = rest.filter(
    (paragraph) => cta.length === 0 || paragraph.trim() !== cta,
  );

  return {
    preheader: truncate(intro ?? input.subject, 110),
    eyebrow: input.productName.trim(),
    productCategory: input.product?.category ?? "",
    headline: input.subject.trim(),
    greeting,
    intro: (intro ?? "").trim(),
    paragraphs,
    capabilities: (input.product?.features ?? []).slice(0, 4),
    outcomes: (input.product?.benefits ?? []).slice(0, 3),
    cta,
    ctaLabel: input.ctaLabel.trim() || "Reply to this email",
    signature: signatureLines(input.sender),
    footerNote: [input.sender.companyName.trim(), input.productName.trim()]
      .filter(Boolean)
      .join(" · "),
  };
}
