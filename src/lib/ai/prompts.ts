import { lengths, objectives, tones } from "@/lib/constants";
import type { EmailTemplate } from "@/lib/templates/types";
import type { AppSettings, LeadBrief, OutreachDraft, Product } from "@/lib/types";
import type { RefineAction } from "@/lib/ai/schemas";

/**
 * PROMPTS
 * =======
 * Two rules drive everything here:
 *
 * 1. Grounding. The model only ever sees the Maxpro product knowledge that the
 *    app hands it, and is told explicitly that anything outside that block does
 *    not exist. Product selection happens in code, not in the model.
 *
 * 2. Field literalism. Local 3B-class models happily misread a field called
 *    "email" as an email address and "subjects" as topics, so every field is
 *    spelled out in prose in addition to the JSON schema.
 */

const GUARDRAILS = `ABSOLUTE RULES — these override every other instruction
- Use ONLY the facts inside the PRODUCT KNOWLEDGE block. Treat anything not written there as non-existent.
- NEVER invent or imply: customer names, logos, references, case studies, statistics, percentages, metrics, timeframes for results, pricing, discounts, integrations, certifications, awards, headcount, or company history.
- NEVER write a number that does not appear in the brief or the product knowledge. No "40% faster", no "3x", no "in 30 days", no "trusted by 200 companies".
- If you do not know something about the prospect, stay general. A conservative sentence that is true beats a specific sentence that is invented.
- Empty prospect fields are empty. Do not invent headcount, revenue, tools, locations, or anything that is not written in PROSPECT. Never write "I noticed your 50-person sales team" unless the brief actually states that number.
- Do not claim the product does something the product knowledge does not list.
- NEVER claim experience the sender does not have. Do not write "I have worked with companies like yours", "we work with many distributors", "our customers tell us", "I noticed on your website" or anything similar. You know nothing beyond the brief.
- Write about the problem in general terms ("teams running a field force usually find…"), never as a personal anecdote.
- Do not reference how you found the prospect, and do not pretend to have met them before unless the brief says this is a follow-up.
- No placeholders of any kind. No square brackets, no "[Company]", no "XX", no "TODO", no blanks to fill in. Write finished copy.
- Plain text only. No markdown, no asterisks, no bullet characters, no HTML, no emoji.`;

const FIELD_SPEC = `OUTPUT — reply with one JSON object and nothing else
Each field means exactly this:
- "recommendedProduct": the exact Maxpro product name you pitched, spelled as it appears in PRODUCT KNOWLEDGE. Nothing else in this field.
- "painPoint": ONE sentence naming the business problem this prospect most likely has.
- "angle": ONE sentence explaining the persuasion angle you used, written for the sales rep, not the prospect.
- "subjects": EXACTLY 3 different email SUBJECT LINES. Each one is a short headline of 3 to 9 words. These are not topics, not names, not questions about the prospect's data. No quotation marks. No trailing full stop. Do not start with "Re:".
  Subject line rules: at least one must reference something concrete from the prospect's own situation. Write them in plain sentence case, not Title Case. Do not open with a gerund ("Streamlining", "Improving", "Boosting", "Simplifying") — those read like marketing headlines. Never name the product in more than one of the three.
- "recommendedSubject": whichever of the 3 subject lines is strongest, copied word for word.
- "email": the COMPLETE email body the prospect will read, as plain text. It starts with the greeting line and ends with the sender's name. Put ONE BLANK LINE between every paragraph — press enter twice. This field is never an email address.
- "cta": the single closing ask from the email, as one sentence.
- "followUp": a COMPLETE separate short follow-up email body, 2 to 4 sentences, to send if there is no reply. It also starts with a greeting and ends with the sender's name. It must add a NEW angle, not summarise the first email. Never write "following up", "wanted to follow up", "circling back", "checking in" or "had a chance to consider".
- "followUp2": a COMPLETE second follow-up, shorter than followUp (1 to 3 sentences), with a different angle from both the first email and followUp. Same greeting and sign-off rules. Do not invent new facts to fill it.`;

/** Cached — identical for every generation. */
const SYSTEM_PROMPT = buildSystemPromptBody();

function buildSystemPromptBody(): string {
  return `You are a senior B2B outreach copywriter on the sales team at Maxpro Infotech, an enterprise software company. You write cold and follow-up emails that operations and sales leaders actually reply to.

Your writing is specific, calm and free of marketing language. You never use the words "revolutionary", "cutting edge", "game changing", "seamless", "leverage", "synergy", "solution provider", "best in class" or "unlock". You do not open with "I hope this email finds you well".

${GUARDRAILS}

${FIELD_SPEC}`;
}

export function buildSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

/** Generation prompt — trimmed catalogue fields, not the full product page. */
function formatProductCompact(product: Product): string {
  const problems = product.problemsSolved.slice(0, 4).join("; ");
  const features = product.features.slice(0, 5).join("; ");
  const angles = product.outreachAngles.slice(0, 3).join("; ");
  return `Product: ${product.name}
Category: ${product.category}
Positioning: ${product.tagline}
Problems solved: ${problems}
Capabilities: ${features}
Outreach angles: ${angles}
Suggested ask: ${product.cta}`;
}

function formatProspect(brief: LeadBrief): string {
  const rows = [
    ["Company", brief.company],
    ["Website", brief.website],
    ["Contact name", brief.contactName],
    ["Job title", brief.jobTitle],
    ["Industry", brief.industry],
  ]
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `${label}: ${value}`);

  const notes = brief.notes
    ? `Notes from the rep (the only other thing you know about them): ${brief.notes}`
    : "Notes from the rep: none. You know nothing else about this company, so keep every claim about them general.";

  return [...rows, notes].join("\n");
}

function formatSender(settings: AppSettings): string {
  const name = settings.senderName.trim() || "the Maxpro sales team";
  const title = settings.senderTitle.trim();
  return `Sign as: ${name}${title ? `, ${title}` : ""} at ${settings.companyName || "Maxpro Infotech"}. No phone/address in the body.`;
}

function formatBrief(brief: LeadBrief): string {
  const objective = objectives.find((o) => o.value === brief.objective);
  const tone = tones.find((t) => t.value === brief.tone);
  const length = lengths.find((l) => l.value === brief.length);

  return `Objective: ${objective?.label ?? brief.objective}. Tone: ${tone?.label ?? brief.tone}. Email length: ${length?.words ?? "70 to 110 words"} (${length?.hint ?? "2 short paragraphs"}).`;
}

function compactTemplateStructure(structure: string): string {
  const lines = structure
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.slice(0, 7).join("\n");
}

function productSection(candidates: Product[]): string {
  if (candidates.length === 1) {
    return `PRODUCT KNOWLEDGE — pitch this product only
${formatProductCompact(candidates[0])}`;
  }

  return `PRODUCT KNOWLEDGE — two products could fit. Choose ONE and pitch only that product.

A) ${formatProductCompact(candidates[0])}

B) ${formatProductCompact(candidates[1])}`;
}

export function buildGenerateUserPrompt(input: {
  brief: LeadBrief;
  candidates: Product[];
  template: EmailTemplate;
  settings: AppSettings;
}): string {
  const { brief, candidates, template, settings } = input;

  return `${productSection(candidates)}

PROSPECT
${formatProspect(brief)}

BRIEF
${formatBrief(brief)}

TEMPLATE SHAPE
${compactTemplateStructure(template.structure)}

SENDER
${formatSender(settings)}

Write the JSON object now.`;
}

const refineInstructions: Record<RefineAction, string> = {
  shorter: `TASK — make it shorter
Cut the email down by roughly a third. Remove hedging, adverbs, throat-clearing and any sentence that does not move the reader towards the ask.
Keep the greeting, the ask and the sign-off. Keep the same meaning, product and tone.
Do not introduce any new claim, feature, number or fact.
Return only the "email" field.`,
  "more-persuasive": `TASK — make it more persuasive
Rewrite the email so the problem lands harder and the ask feels easier to say yes to. Sharpen the first line: it should make the reader want to read the second.
Persuasion here means specificity and relevance, not enthusiasm. Do not add urgency, flattery, exclamation marks, social proof, statistics or any new claim.
Every fact must already be present in the current email or the product knowledge.
Also write 3 fresh subject lines and pick the strongest.
Return the "email", "subjects" and "recommendedSubject" fields.`,
  "follow-up": `TASK — write the follow-up
Write a new short follow-up email to send if the email below gets no reply. 2 to 4 sentences.
It must add a different angle rather than repeat the original email. Never write "just following up", "circling back", "bumping this" or "did you see my email".
Start with a greeting and end with the sender's name.
Return only the "followUp" field.`,
};

export function buildRefineSystemPrompt(): string {
  return `You are a senior B2B outreach copywriter at Maxpro Infotech, editing an email that a sales rep is about to send.

${GUARDRAILS}

Reply with one JSON object containing only the requested fields, as plain text. The "email" and "followUp" fields hold complete email bodies, greeting first and sender's name last, with a blank line between paragraphs.`;
}

export function buildRefineUserPrompt(input: {
  action: RefineAction;
  brief: LeadBrief;
  current: OutreachDraft;
  product: Product;
  template: EmailTemplate;
  settings: AppSettings;
}): string {
  const { action, brief, current, product, template, settings } = input;

  return `PRODUCT KNOWLEDGE — the only facts you may use
${formatProductCompact(product)}

PROSPECT
${formatProspect(brief)}

CURRENT SUBJECT
${current.recommendedSubject || current.subjects[0] || ""}

CURRENT EMAIL
${current.email}

TEMPLATE — the shape this email must keep
${template.structure}

SENDER
${formatSender(settings)}

${refineInstructions[action]}

Write the JSON object now.`;
}

/**
 * Sent after a generation fails validation. Repairs are targeted: the model is
 * told exactly what was wrong rather than being asked to try again blind.
 */
export function buildRepairUserPrompt(input: {
  previous: string;
  problems: string[];
}): string {
  return `Your previous reply was rejected. Here it is:

${input.previous}

Problems that must be fixed:
${input.problems.map((problem) => `- ${problem}`).join("\n")}

Write the corrected JSON object now. Keep everything that was already acceptable and fix only what is listed above. Reply with the complete JSON object, all fields included.`;
}
