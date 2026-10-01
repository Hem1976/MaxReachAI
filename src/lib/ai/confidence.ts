import { wordCount } from "@/lib/ai/guardrails";
import type { Confidence, ConfidenceSignal, LeadBrief, OutreachDraft } from "@/lib/types";

/**
 * CONFIDENCE
 * ==========
 * Deliberately NOT asked of the model. A 3B model asked "how confident are
 * you?" returns a number it made up, which is exactly the kind of invented
 * figure this app is built to avoid.
 *
 * Instead the score is derived from things that are actually knowable: how much
 * the rep told us, how strongly the brief matched a product, and whether the
 * output passed its own checks. Weights sum to 100.
 */
export function scoreConfidence(input: {
  brief: LeadBrief;
  draft: OutreachDraft;
  productMatchScore: number;
  autoDetected: boolean;
  reviewFlags: string[];
  targetWords: { min: number; max: number };
}): Confidence {
  const { brief, draft, productMatchScore, autoDetected, reviewFlags, targetWords } =
    input;

  const signals: ConfidenceSignal[] = [];

  const noteWords = wordCount(brief.notes);
  signals.push({
    label: "Company research",
    weight: 24,
    earned: noteWords >= 40 ? 24 : noteWords >= 15 ? 17 : noteWords >= 5 ? 9 : 0,
    detail:
      noteWords >= 15
        ? `${noteWords} words of notes gave the model something specific to work with.`
        : "Little or no company research was provided, so the email stays generic.",
  });

  signals.push({
    label: "Industry context",
    weight: 12,
    earned: brief.industry.trim() ? 12 : 0,
    detail: brief.industry.trim()
      ? `Industry set to "${brief.industry.trim()}".`
      : "No industry given, which weakens both product matching and relevance.",
  });

  const hasName = Boolean(brief.contactName.trim());
  const hasTitle = Boolean(brief.jobTitle.trim());
  signals.push({
    label: "Named contact",
    weight: 12,
    earned: (hasName ? 7 : 0) + (hasTitle ? 5 : 0),
    detail:
      hasName && hasTitle
        ? "Contact name and job title were both provided."
        : hasName
          ? "Job title is missing, so seniority could not be pitched to."
          : "No named contact, so the greeting and framing are generic.",
  });

  const productEarned = autoDetected
    ? productMatchScore >= 12
      ? 20
      : productMatchScore >= 6
        ? 14
        : productMatchScore > 0
          ? 8
          : 0
    : 20;
  signals.push({
    label: "Product fit",
    weight: 20,
    earned: productEarned,
    detail: autoDetected
      ? productMatchScore >= 6
        ? "Auto-detect matched the brief to a product on several signals."
        : "Auto-detect had weak signal — confirm the product is the right one."
      : "The rep chose the product explicitly.",
  });

  const words = wordCount(draft.email);
  const onTarget = words >= targetWords.min * 0.8 && words <= targetWords.max * 1.2;
  signals.push({
    label: "Length on target",
    weight: 10,
    earned: onTarget ? 10 : words > 0 ? 4 : 0,
    detail: onTarget
      ? `Body is ${words} words, inside the requested range.`
      : `Body is ${words} words against a ${targetWords.min}-${targetWords.max} word target.`,
  });

  const distinctSubjects = new Set(
    draft.subjects.map((s) => s.trim().toLowerCase()),
  ).size;
  signals.push({
    label: "Subject options",
    weight: 8,
    earned: distinctSubjects >= 3 ? 8 : distinctSubjects === 2 ? 5 : 2,
    detail: `${distinctSubjects} distinct subject line${distinctSubjects === 1 ? "" : "s"} produced.`,
  });

  signals.push({
    label: "Grounding checks",
    weight: 14,
    earned: reviewFlags.length === 0 ? 14 : Math.max(0, 14 - reviewFlags.length * 5),
    detail:
      reviewFlags.length === 0
        ? "No unverifiable claims or filler language detected."
        : `${reviewFlags.length} item${reviewFlags.length === 1 ? "" : "s"} flagged for review.`,
  });

  const score = Math.round(
    signals.reduce((total, signal) => total + signal.earned, 0),
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    band: score >= 75 ? "high" : score >= 50 ? "moderate" : "low",
    signals,
  };
}
