import { emailTemplates } from "@/lib/templates";
import type { EmailTemplate } from "@/lib/templates/types";
import type { EmailLength, LeadBrief, Product, Tone } from "@/lib/types";

/**
 * Suggests a template from the brief. Deliberately deterministic — the rep
 * should be able to see why a template was suggested and overrule it, which is
 * not true of a model-picked answer.
 */

export interface TemplateRecommendation {
  template: EmailTemplate;
  score: number;
  /** Why this template won, phrased for the UI. */
  reasons: string[];
}

/** Tone maps onto visual register: an executive read wants an editorial page. */
const TONE_STYLE: Record<Tone, EmailTemplate["style"][]> = {
  professional: ["minimal", "branded", "bold"],
  consultative: ["plain-text", "minimal", "branded", "editorial"],
  direct: ["plain-text", "minimal", "bold", "branded"],
  executive: ["editorial"],
};

/** A detailed brief has copy to fill a designed layout; a short one does not. */
const LENGTH_STYLE: Record<EmailLength, EmailTemplate["style"][]> = {
  short: ["plain-text", "minimal", "bold"],
  medium: ["minimal", "branded"],
  detailed: ["editorial", "branded", "bold"],
};

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function recommendTemplates(
  brief: Pick<LeadBrief, "objective" | "tone" | "length" | "industry" | "notes" | "jobTitle">,
  product?: Product,
): TemplateRecommendation[] {
  const industry = normalise(brief.industry);
  const context = normalise([brief.notes, brief.jobTitle].filter(Boolean).join(" "));
  const senior = /\b(ceo|cto|coo|cfo|founder|owner|director|president|head|chief|vp|vice president|managing)\b/.test(
    context,
  );

  const scored = emailTemplates.map<TemplateRecommendation>((template) => {
    let score = 0;
    const reasons: string[] = [];

    if (template.objectives.includes(brief.objective)) {
      score += 6;
      reasons.push("Built for this objective");
    }

    if (TONE_STYLE[brief.tone].includes(template.style)) {
      score += 3;
      reasons.push(`Suits a ${brief.tone} tone`);
    }

    if (LENGTH_STYLE[brief.length].includes(template.style)) {
      score += 2;
      reasons.push(`Sized for a ${brief.length} email`);
    }

    if (
      industry &&
      template.industries.some((candidate) => {
        const term = normalise(candidate);
        return industry.includes(term) || term.includes(industry);
      })
    ) {
      score += 4;
      reasons.push("Matches the industry");
    }

    const tagHits = template.tags.filter(
      (tag) => tag.length > 3 && (context.includes(tag) || industry.includes(tag)),
    );
    if (tagHits.length > 0) {
      score += Math.min(tagHits.length, 3);
      reasons.push(`Mentioned in the brief: ${tagHits.join(", ")}`);
    }

    if (senior && template.category === "Executive") {
      score += 4;
      reasons.push("The contact is senior");
    }

    // A designed layout needs grounded lists to fill its panels. Without a
    // resolved product those sections render empty, so prefer plain skins.
    if (!product && (template.style === "branded" || template.style === "bold")) {
      score -= 2;
    }

    // CodedMails layouts are available; Maxpro originals stay the default pick.
    if (template.library === "codedmails") {
      score -= 3;
    }

    return { template, score, reasons };
  });

  return scored.sort(
    (a, b) => b.score - a.score || a.template.name.localeCompare(b.template.name),
  );
}

export function recommendTemplate(
  brief: Parameters<typeof recommendTemplates>[0],
  product?: Product,
): TemplateRecommendation {
  return recommendTemplates(brief, product)[0];
}
