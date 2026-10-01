import { z } from "zod";

import { products } from "@/lib/products/data";
import type { ProductId } from "@/lib/types";

const productIds = products.map((p) => p.id) as [ProductId, ...ProductId[]];

export const ProductSelectionSchema = z.union([
  z.literal("auto"),
  z.enum(productIds),
]);

export const ObjectiveSchema = z.enum([
  "book-demo",
  "introduce-product",
  "start-conversation",
  "partnership",
  "follow-up",
]);

export const ToneSchema = z.enum([
  "professional",
  "consultative",
  "direct",
  "executive",
]);

export const EmailLengthSchema = z.enum(["short", "medium", "detailed"]);

export const LeadBriefSchema = z.object({
  company: z.string().trim().min(1, "Company name is required").max(160),
  website: z.string().trim().max(200).default(""),
  contactName: z.string().trim().max(120).default(""),
  jobTitle: z.string().trim().max(120).default(""),
  industry: z.string().trim().max(160).default(""),
  notes: z.string().trim().max(4000).default(""),
  product: ProductSelectionSchema.default("auto"),
  objective: ObjectiveSchema.default("book-demo"),
  tone: ToneSchema.default("consultative"),
  length: EmailLengthSchema.default("short"),
  templateId: z.string().trim().min(1).default("intro-plain"),
});

export type LeadBriefInput = z.input<typeof LeadBriefSchema>;

/**
 * The contract the model must satisfy. Kept deliberately loose on length so a
 * marginal generation can be repaired rather than thrown away, with the
 * stricter semantic checks living in `validateDraft`.
 */
export const OutreachDraftSchema = z.object({
  recommendedProduct: z.string().trim().min(1),
  painPoint: z.string().trim().min(1),
  angle: z.string().trim().min(1),
  subjects: z.array(z.string().trim().min(1)).min(1).max(6),
  recommendedSubject: z.string().trim().default(""),
  email: z.string().trim().min(1),
  cta: z.string().trim().default(""),
  followUp: z.string().trim().default(""),
  followUp2: z.string().trim().default(""),
});

export type OutreachDraftParsed = z.output<typeof OutreachDraftSchema>;

/**
 * JSON schema handed to Ollama's structured-output mode. Hand-written rather
 * than derived from Zod so the field descriptions can be tuned for small local
 * models, which read them as part of the grammar prompt.
 */
export const OUTREACH_JSON_SCHEMA = {
  type: "object",
  properties: {
    recommendedProduct: {
      type: "string",
      description: "The exact Maxpro product name being pitched.",
    },
    painPoint: {
      type: "string",
      description: "One sentence naming the business problem this prospect has.",
    },
    angle: {
      type: "string",
      description: "One sentence explaining the persuasion angle used.",
    },
    subjects: {
      type: "array",
      description: "Exactly three distinct email subject lines.",
      items: {
        type: "string",
        description: "A subject line headline of three to nine words.",
      },
      minItems: 3,
      maxItems: 3,
    },
    recommendedSubject: {
      type: "string",
      description: "The strongest subject line, copied word for word.",
    },
    email: {
      type: "string",
      description:
        "The complete email body as plain text, greeting first, sign-off last.",
    },
    cta: {
      type: "string",
      description: "The single closing ask, one sentence.",
    },
    followUp: {
      type: "string",
      description: "A complete short follow-up email body of two to four sentences.",
    },
    followUp2: {
      type: "string",
      description:
        "A complete second follow-up, shorter than followUp, with a different angle. One to three sentences.",
    },
  },
  required: [
    "recommendedProduct",
    "painPoint",
    "angle",
    "subjects",
    "recommendedSubject",
    "email",
    "cta",
    "followUp",
    "followUp2",
  ],
} as const;

export const RefineActionSchema = z.enum([
  "shorter",
  "more-persuasive",
  "follow-up",
]);

export type RefineAction = z.infer<typeof RefineActionSchema>;

export const RefineRequestSchema = z.object({
  action: RefineActionSchema,
  brief: LeadBriefSchema,
  current: OutreachDraftSchema,
});

/**
 * Refinements use narrow schemas instead of regenerating the whole draft:
 * fewer tokens to produce means a noticeably faster round trip on a local
 * model, and less opportunity to drift away from a draft the rep liked.
 */
export const RefinePatchSchemas = {
  shorter: z.object({ email: z.string().trim().min(1) }),
  "more-persuasive": z.object({
    email: z.string().trim().min(1),
    subjects: z.array(z.string().trim().min(1)).min(1).max(6),
    recommendedSubject: z.string().trim().default(""),
  }),
  "follow-up": z.object({ followUp: z.string().trim().min(1) }),
} as const;

export const REFINE_JSON_SCHEMAS: Record<RefineAction, object> = {
  shorter: {
    type: "object",
    properties: {
      email: {
        type: "string",
        description: "The shortened email body as plain text.",
      },
    },
    required: ["email"],
  },
  "more-persuasive": {
    type: "object",
    properties: {
      email: {
        type: "string",
        description: "The rewritten email body as plain text.",
      },
      subjects: {
        type: "array",
        description: "Exactly three distinct email subject lines.",
        items: { type: "string" },
        minItems: 3,
        maxItems: 3,
      },
      recommendedSubject: {
        type: "string",
        description: "The strongest subject line, copied word for word.",
      },
    },
    required: ["email", "subjects", "recommendedSubject"],
  },
  "follow-up": {
    type: "object",
    properties: {
      followUp: {
        type: "string",
        description: "A complete short follow-up email body as plain text.",
      },
    },
    required: ["followUp"],
  },
};

export const RenderRequestSchema = z.object({
  templateId: z.string().trim().min(1),
  subject: z.string().default(""),
  email: z.string().default(""),
  cta: z.string().default(""),
  company: z.string().default(""),
  contactName: z.string().default(""),
  productName: z.string().default(""),
  /** Lets block-driven skins pull their grounded lists from the catalogue. */
  productId: z.string().default(""),
  /** Overrides the saved theme, so the library can preview any palette. */
  themeId: z.string().default(""),
  /** Optional preview mode uses the template's own sample copy. */
  sample: z.boolean().default(false),
  /** Campaign preview can override Settings sender without changing Settings. */
  senderName: z.string().max(120).optional(),
  senderEmail: z.string().max(160).optional(),
  senderCompany: z.string().max(160).optional(),
  slots: z.record(z.string(), z.string()).optional(),
  editable: z.boolean().optional(),
});

export const SettingsSchema = z.object({
  ollamaBaseUrl: z.string().trim().min(1).max(300),
  model: z.string().trim().min(1).max(160),
  temperature: z.number().min(0).max(1.5),
  requestTimeoutMs: z.number().int().min(10_000).max(900_000),
  defaultTone: ToneSchema,
  defaultLength: EmailLengthSchema,
  defaultTemplateId: z.string().trim().min(1),
  themeId: z.string().trim().min(1),
  senderName: z.string().trim().max(120),
  senderTitle: z.string().trim().max(120),
  senderEmail: z.string().trim().max(160),
  senderPhone: z.string().trim().max(60),
  companyName: z.string().trim().max(160),
  postmarkSenderName: z.string().trim().max(120),
  postmarkSenderEmail: z.string().trim().max(160),
  postmarkMessageStream: z.string().trim().min(1).max(80),
});

const CanonicalMappingSchema = z.object({
  company: z.string(),
  contact: z.string(),
  email: z.string(),
});

export const BulkCreateSchema = z
  .object({
    filename: z.string().trim().min(1).max(200),
    mapping: CanonicalMappingSchema,
    rows: z
      .array(z.record(z.string(), z.string()))
      .min(1, "Upload a CSV with at least one prospect.")
      .max(2_000),
    templateId: z.string().trim().min(1).default("intro-plain"),
    product: ProductSelectionSchema.default("auto"),
    objective: ObjectiveSchema.default("start-conversation"),
    tone: ToneSchema.default("professional"),
    length: EmailLengthSchema.default("short"),
    concurrency: z.number().int().min(1).max(8).default(2),
  })
  .refine((value) => value.mapping.company.trim().length > 0, {
    message: "Map a name column before generating.",
    path: ["mapping", "company"],
  });

export const CompanyImportSchema = z
  .object({
    filename: z.string().trim().max(200).optional(),
    mapping: CanonicalMappingSchema,
    rows: z
      .array(z.record(z.string(), z.string()))
      .min(1, "Upload a CSV with at least one row.")
      .max(2_000),
  })
  .refine((value) => value.mapping.company.trim().length > 0, {
    message: "Map a name column before importing.",
    path: ["mapping", "company"],
  });

export const ListMemberUpdateSchema = z.object({
  companyName: z.string().trim().max(160).optional(),
  contactName: z.string().trim().max(120).optional(),
  email: z.string().trim().max(160).optional(),
});

export const CampaignCreateSchema = z.object({
  name: z.string().trim().min(1, "Campaign name is required").max(160),
  templateId: z.string().trim().max(120).optional().default(""),
  productId: z.string().trim().max(80).optional().default(""),
  senderName: z.string().trim().max(120).optional().default(""),
  senderEmail: z.string().trim().max(160).optional().default(""),
});

export const CampaignPatchSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  status: z.enum(["draft", "paused"]).optional(),
  templateId: z.string().trim().max(120).optional(),
  productId: z.string().trim().max(80).optional(),
  themeId: z.string().trim().max(80).optional(),
  senderName: z.string().trim().max(120).optional(),
  senderEmail: z.string().trim().max(160).optional(),
  /** Stored exactly as authored — no trim, no rewrite. */
  subject: z.string().max(500).optional(),
  body: z.string().max(200_000).optional(),
  cta: z.string().max(2_000).optional(),
  slots: z.record(z.string(), z.string().max(200_000)).optional(),
  /** Imported HTML emails can include inline assets and long markup. */
  htmlDraft: z.string().max(2_000_000).optional(),
  ccEnabled: z.boolean().optional(),
  ccEmail: z.string().trim().max(160).optional(),
});

export const BulkLeadPatchSchema = z.object({
  status: z.enum(["approved", "needs_review", "ready"]).optional(),
  company: z.string().max(160).optional(),
  contactName: z.string().max(120).optional(),
  email: z.string().max(160).optional(),
  website: z.string().max(200).optional(),
  jobTitle: z.string().max(120).optional(),
  industry: z.string().max(160).optional(),
  notes: z.string().max(4000).optional(),
  emailBody: z.string().optional(),
  recommendedSubject: z.string().optional(),
  followUp1: z.string().optional(),
  followUp2: z.string().optional(),
});

export const HistoryCreateSchema = z.object({
  brief: LeadBriefSchema,
  result: z.object({
    recommendedProduct: z.string(),
    productId: z.string(),
    productName: z.string(),
    painPoint: z.string(),
    angle: z.string(),
    subjects: z.array(z.string()),
    recommendedSubject: z.string(),
    email: z.string(),
    cta: z.string(),
    followUp: z.string(),
    followUp2: z.string().optional(),
    confidence: z.object({ score: z.number() }).loose(),
    reviewFlags: z.array(z.string()).default([]),
    model: z.string().default(""),
  }),
});
