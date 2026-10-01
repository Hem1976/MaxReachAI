/**
 * CodedMails catalogue — all 12 themes, every template they publish.
 *
 * Each record points at a vendored MJML file. The injector in `inject.ts`
 * fills named copy into that file; the design itself is not rewritten.
 */
import { emailTemplates as maxproTemplates } from "@/lib/templates/definitions";
import type {
  EmailTemplate,
  TemplateCategory,
  TemplateSource,
  TemplateStyle,
} from "@/lib/templates/types";
import type { Objective } from "@/lib/types";

export const CODEDMAILS_THEMES = [
  "aleos",
  "canaotes",
  "dineos",
  "faedra",
  "korlavas",
  "mardaloas",
  "meslerides",
  "ormes",
  "orthipis",
  "tetrapis",
  "usiac",
  "xyimeasi",
] as const;

export type CodedMailsThemeId = (typeof CODEDMAILS_THEMES)[number];

export const CODEDMAILS_TYPES = [
  "welcome",
  "reset",
  "receipt",
  "newsletter",
  "notification",
  "general",
] as const;

export type CodedMailsType = (typeof CODEDMAILS_TYPES)[number];

/** Only the first four themes ship a General layout. */
const GENERAL_THEMES = new Set<CodedMailsThemeId>([
  "aleos",
  "canaotes",
  "dineos",
  "faedra",
]);

const SOURCE: TemplateSource = {
  name: "CodedMails",
  url: "https://codedmails.com/#themes",
  license: "Free for commercial use (CodedMails FAQ) · copyright Aslam Shah",
  adapted: "Full MJML layout, rebranded and filled with MaxReach copy",
};

const TYPE_META: Record<
  CodedMailsType,
  {
    label: string;
    category: TemplateCategory;
    style: TemplateStyle;
    purpose: string;
    bestFor: string;
    objectives: Objective[];
    sampleFrom: string;
    structureFrom: string;
    tags: string[];
  }
> = {
  welcome: {
    label: "Welcome",
    category: "Product",
    style: "branded",
    purpose:
      "Designed welcome/intro layout. Puts a headline, a short body and one action on a branded canvas.",
    bestFor: "Product introductions and first-touch designed emails",
    objectives: ["introduce-product", "start-conversation"],
    sampleFrom: "intro-plain",
    structureFrom: "intro-plain",
    tags: ["codedmails", "welcome", "designed", "intro"],
  },
  general: {
    label: "General",
    category: "Cold outreach",
    style: "branded",
    purpose:
      "General-purpose CodedMails layout. Flexible enough for a first outreach that still wants a designed frame.",
    bestFor: "Cold outreach that should not look like a plain-text note",
    objectives: ["start-conversation", "introduce-product"],
    sampleFrom: "intro-plain",
    structureFrom: "intro-plain",
    tags: ["codedmails", "general", "cold", "designed"],
  },
  newsletter: {
    label: "Newsletter",
    category: "Marketing",
    style: "editorial",
    purpose:
      "Multi-section newsletter frame. Headline, body and supporting blocks, built for a longer read.",
    bestFor: "Nurture sends and product briefings",
    objectives: ["introduce-product", "start-conversation"],
    sampleFrom: "problem-solution-story",
    structureFrom: "problem-solution-story",
    tags: ["codedmails", "newsletter", "marketing", "long form"],
  },
  notification: {
    label: "Notification",
    category: "Follow-up",
    style: "minimal",
    purpose:
      "Compact notification layout. Short copy, one clear action, little chrome.",
    bestFor: "Follow-ups and single-purpose asks",
    objectives: ["follow-up", "book-demo"],
    sampleFrom: "intro-plain",
    structureFrom: "intro-plain",
    tags: ["codedmails", "notification", "follow-up", "short"],
  },
  reset: {
    label: "Re-engagement",
    category: "Follow-up",
    style: "minimal",
    purpose:
      "Originally a password-reset layout. Reused here as a short, single-action re-engagement email.",
    bestFor: "Dormant contacts and a last short nudge",
    objectives: ["follow-up"],
    sampleFrom: "intro-plain",
    structureFrom: "intro-plain",
    tags: ["codedmails", "reset", "re-engagement", "short"],
  },
  receipt: {
    label: "Feature list",
    category: "Product",
    style: "branded",
    purpose:
      "Originally a receipt. The itemised layout is a natural fit for listing what a product handles.",
    bestFor: "Product walkthroughs that need a scannable list",
    objectives: ["introduce-product", "book-demo"],
    sampleFrom: "intro-one-image",
    structureFrom: "problem-solution-product",
    tags: ["codedmails", "receipt", "list", "product"],
  },
};

const THEME_STYLE: Partial<Record<CodedMailsThemeId, TemplateStyle>> = {
  aleos: "minimal",
  canaotes: "minimal",
  dineos: "branded",
  faedra: "branded",
  korlavas: "branded",
  mardaloas: "bold",
  meslerides: "bold",
  ormes: "branded",
  orthipis: "minimal",
  tetrapis: "branded",
  usiac: "editorial",
  xyimeasi: "editorial",
};

function themeLabel(id: CodedMailsThemeId): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

const maxproById = new Map(maxproTemplates.map((t) => [t.id, t]));

function sampleOf(id: string): EmailTemplate["sample"] {
  return maxproById.get(id)?.sample ?? maxproTemplates[0].sample;
}

function structureOf(id: string): string {
  return maxproById.get(id)?.structure ?? maxproTemplates[0].structure;
}

export const codedMailsTemplates: EmailTemplate[] = CODEDMAILS_THEMES.flatMap(
  (theme) =>
    CODEDMAILS_TYPES.filter(
      (type) => type !== "general" || GENERAL_THEMES.has(theme),
    ).map((type) => {
      const meta = TYPE_META[type];
      return {
        id: `cm-${theme}-${type}`,
        name: `${themeLabel(theme)} · ${meta.label}`,
        category: meta.category,
        style: THEME_STYLE[theme] ?? meta.style,
        purpose: `${meta.purpose} Theme: ${themeLabel(theme)}.`,
        bestFor: meta.bestFor,
        skin: "codedmails",
        structure: structureOf(meta.structureFrom),
        objectives: meta.objectives,
        industries: [],
        tags: [...meta.tags, theme],
        source: {
          ...SOURCE,
          adapted: `${SOURCE.adapted} (${theme} ${type})`,
        },
        sample: sampleOf(meta.sampleFrom),
        library: "codedmails",
        codedmailsTheme: theme,
        codedmailsFile: `${theme}/${type}.mjml`,
      } satisfies EmailTemplate;
    }),
);

export const codedMailsThemeOptions = CODEDMAILS_THEMES.map((id) => ({
  value: id,
  label: themeLabel(id),
}));
