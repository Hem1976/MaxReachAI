import "server-only";

import { lengths } from "@/lib/constants";
import { scoreConfidence } from "@/lib/ai/confidence";
import {
  cleanCopy,
  cleanSubject,
  ensureSignOff,
  reviewDraft,
  toSentenceCase,
  validateDraft,
} from "@/lib/ai/guardrails";
import { chat, OllamaError, type ChatMessage, type OllamaConfig } from "@/lib/ai/ollama";
import {
  buildGenerateUserPrompt,
  buildRefineSystemPrompt,
  buildRefineUserPrompt,
  buildRepairUserPrompt,
  buildSystemPrompt,
} from "@/lib/ai/prompts";
import {
  OUTREACH_JSON_SCHEMA,
  OutreachDraftSchema,
  REFINE_JSON_SCHEMAS,
  RefinePatchSchemas,
  type RefineAction,
} from "@/lib/ai/schemas";
import {
  detectProducts,
  getProduct,
  getProductOrThrow,
  resolveProductName,
  selectProductsForPrompt,
} from "@/lib/products";
import { getTemplateOrDefault } from "@/lib/templates/catalog.server";
import type {
  AppSettings,
  LeadBrief,
  OutreachDraft,
  OutreachResult,
  Product,
} from "@/lib/types";

const MAX_REPAIRS = 2;
const REPAIR_MAX_TOKENS = 680;

function toOllamaConfig(settings: AppSettings): OllamaConfig {
  return {
    baseUrl: settings.ollamaBaseUrl,
    model: settings.model,
    temperature: settings.temperature,
    timeoutMs: settings.requestTimeoutMs,
  };
}

/** Models occasionally wrap JSON in prose or a fence despite the schema. */
function extractJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) {
      throw new OllamaError(
        "bad-response",
        "The model did not return JSON",
        "This usually clears on a retry. If it keeps happening, the model may be too small for structured output — try llama3.1:8b or qwen2.5:7b in Settings.",
      );
    }
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

/**
 * Words that must keep their capitalisation when a subject line is converted
 * out of Title Case: product names, and anything the rep typed about the
 * prospect.
 */
function protectedTerms(brief: LeadBrief, candidates: Product[]): Set<string> {
  const source = [
    ...candidates.map((product) => product.name),
    brief.company,
    brief.contactName,
    brief.industry,
    "Maxpro",
    "Infotech",
  ].join(" ");

  return new Set(
    source
      .split(/[^A-Za-z]+/)
      .filter(Boolean)
      .map((word) => word.toLowerCase()),
  );
}

function normaliseDraft(
  draft: OutreachDraft,
  candidates: Product[],
  protect: Set<string>,
  senderName: string,
): { draft: OutreachDraft; product: Product } {
  const subjects = draft.subjects
    .map((subject) => toSentenceCase(cleanSubject(subject), protect))
    .filter(Boolean)
    .filter((subject, index, all) => all.indexOf(subject) === index)
    .slice(0, 3);

  const recommended = toSentenceCase(cleanSubject(draft.recommendedSubject), protect);
  const recommendedSubject = subjects.includes(recommended)
    ? recommended
    : (subjects[0] ?? recommended);

  // Never let an invented product name reach the rep: snap to the catalogue,
  // falling back to the product we actually put in the prompt.
  const resolved = resolveProductName(draft.recommendedProduct);
  const product =
    resolved && candidates.some((candidate) => candidate.id === resolved.id)
      ? resolved
      : (resolved ?? candidates[0]);

  return {
    product,
    draft: {
      recommendedProduct: product.name,
      painPoint: cleanCopy(draft.painPoint),
      angle: cleanCopy(draft.angle),
      subjects,
      recommendedSubject,
      email: ensureSignOff(cleanCopy(draft.email), senderName),
      cta: cleanCopy(draft.cta),
      followUp: ensureSignOff(cleanCopy(draft.followUp), senderName),
      followUp2: draft.followUp2
        ? ensureSignOff(cleanCopy(draft.followUp2), senderName)
        : "",
    },
  };
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

export interface GenerateOutcome {
  result: OutreachResult;
  /** Populated when a draft shipped despite failing a soft check. */
  warnings: string[];
}

/**
 * Core generator. Deliberately a plain async function taking a brief and
 * settings, so bulk CSV generation can call it in a loop without touching any
 * of this logic.
 */
export async function generateOutreach(input: {
  brief: LeadBrief;
  settings: AppSettings;
}): Promise<GenerateOutcome> {
  const { brief, settings } = input;
  const startedAt = Date.now();

  const { candidates, autoDetected, primary } = selectProductsForPrompt(brief);
  const template = getTemplateOrDefault(brief.templateId);
  const lengthSpec = lengths.find((l) => l.value === brief.length) ?? lengths[0];
  const [minWords, maxWords] = parseWordRange(lengthSpec.words);

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt() },
    {
      role: "user",
      content: buildGenerateUserPrompt({ brief, candidates, template, settings }),
    },
  ];

  const protect = protectedTerms(brief, candidates);
  let attempt = 0;
  let lastProblems: string[] = [];
  let modelName = settings.model;

  while (attempt <= MAX_REPAIRS) {
    const response = await chat(toOllamaConfig(settings), {
      messages,
      format: OUTREACH_JSON_SCHEMA,
      maxTokens: attempt === 0 ? lengthSpec.maxTokens : REPAIR_MAX_TOKENS,
    });
    modelName = response.model;

    const parsed = OutreachDraftSchema.safeParse(extractJson(response.content));

    if (!parsed.success) {
      lastProblems = parsed.error.issues.map(
        (issue) => `Field "${issue.path.join(".") || "root"}": ${issue.message}`,
      );
    } else {
      const { draft, product } = normaliseDraft(
        parsed.data,
        candidates,
        protect,
        settings.senderName,
      );
      const problems = validateDraft(draft, {
        minWords,
        maxWords,
        contactFirstName: firstName(brief.contactName),
      });

      if (problems.length === 0 || attempt === MAX_REPAIRS) {
        const reviewFlags = reviewDraft(draft, {
          contactFirstName: firstName(brief.contactName),
        });
        const detection = autoDetected ? detectProducts(brief) : [];
        const matchScore =
          detection.find((match) => match.product.id === product.id)?.score ?? 0;

        return {
          warnings: problems.map((problem) => problem.message),
          result: {
            ...draft,
            productId: product.id,
            productName: product.name,
            autoDetected,
            confidence: scoreConfidence({
              brief,
              draft,
              productMatchScore: matchScore,
              autoDetected,
              reviewFlags,
              targetWords: { min: minWords, max: maxWords },
            }),
            reviewFlags,
            model: modelName,
            templateId: template.id,
            generatedAt: new Date().toISOString(),
            elapsedMs: Date.now() - startedAt,
          },
        };
      }

      lastProblems = problems.map((problem) => problem.message);
    }

    attempt += 1;
    messages.push({ role: "assistant", content: response.content });
    messages.push({
      role: "user",
      content: buildRepairUserPrompt({
        previous: response.content,
        problems: lastProblems,
      }),
    });
  }

  throw new OllamaError(
    "bad-response",
    `The model could not produce a usable draft for ${primary.name}`,
    `Last problems: ${lastProblems.join(" ")} Try again, or switch to a larger model in Settings.`,
  );
}

export interface RefineOutcome {
  patch: Partial<OutreachDraft>;
  model: string;
  elapsedMs: number;
}

export async function refineOutreach(input: {
  action: RefineAction;
  brief: LeadBrief;
  current: OutreachDraft;
  settings: AppSettings;
}): Promise<RefineOutcome> {
  const { action, brief, current, settings } = input;
  const startedAt = Date.now();

  const product =
    resolveProductName(current.recommendedProduct) ??
    (brief.product !== "auto" ? getProduct(brief.product) : undefined) ??
    getProductOrThrow("rockey");

  const template = getTemplateOrDefault(brief.templateId);

  const response = await chat(toOllamaConfig(settings), {
    messages: [
      { role: "system", content: buildRefineSystemPrompt() },
      {
        role: "user",
        content: buildRefineUserPrompt({
          action,
          brief,
          current,
          product,
          template,
          settings,
        }),
      },
    ],
    format: REFINE_JSON_SCHEMAS[action],
    maxTokens: action === "follow-up" ? 500 : 900,
    // Shortening is a mechanical edit; persuasion needs a little more room.
    temperature: action === "shorter" ? 0.3 : settings.temperature,
  });

  const raw = extractJson(response.content);

  if (action === "shorter") {
    const patch = RefinePatchSchemas.shorter.parse(raw);
    return {
      patch: {
        email: ensureSignOff(cleanCopy(patch.email), settings.senderName),
      },
      model: response.model,
      elapsedMs: Date.now() - startedAt,
    };
  }

  if (action === "follow-up") {
    const patch = RefinePatchSchemas["follow-up"].parse(raw);
    return {
      patch: {
        followUp: ensureSignOff(cleanCopy(patch.followUp), settings.senderName),
      },
      model: response.model,
      elapsedMs: Date.now() - startedAt,
    };
  }

  const patch = RefinePatchSchemas["more-persuasive"].parse(raw);
  const protect = protectedTerms(brief, [product]);
  const subjects = patch.subjects
    .map((subject) => toSentenceCase(cleanSubject(subject), protect))
    .filter(Boolean)
    .filter((subject, index, all) => all.indexOf(subject) === index)
    .slice(0, 3);
  const recommended = toSentenceCase(cleanSubject(patch.recommendedSubject), protect);

  return {
    patch: {
      email: ensureSignOff(cleanCopy(patch.email), settings.senderName),
      subjects: subjects.length > 0 ? subjects : current.subjects,
      recommendedSubject: subjects.includes(recommended)
        ? recommended
        : (subjects[0] ?? current.recommendedSubject),
    },
    model: response.model,
    elapsedMs: Date.now() - startedAt,
  };
}

function parseWordRange(words: string): [number, number] {
  const matches = words.match(/\d+/g);
  if (!matches || matches.length < 2) return [70, 110];
  return [Number(matches[0]), Number(matches[1])];
}
