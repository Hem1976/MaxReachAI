/**
 * Shared domain types for MaxReach AI.
 */

export type ProductId =
  | "rockey"
  | "rocketsales-pharma"
  | "rocketorder-ai"
  | "rockey-agro"
  | "rocketdelivery"
  | "rocketbot"
  | "rocketbi"
  | "rocketdox-ai"
  | "rocketbiz";

export interface Product {
  id: ProductId;
  name: string;
  category: string;
  /** One-line positioning statement used in cards and prompt headers. */
  tagline: string;
  description: string;
  idealIndustries: string[];
  idealCustomer: string;
  problemsSolved: string[];
  features: string[];
  benefits: string[];
  outreachAngles: string[];
  cta: string;
  /** Lowercase terms used by the deterministic auto-detect scorer. */
  keywords: string[];
  /** Path under `public/`. Resolved via EMAIL_ASSET_BASE_URL for outbound mail. */
  image?: string;
  imageAlt?: string;
}

export type ProductSelection = ProductId | "auto";

export type Objective =
  | "book-demo"
  | "introduce-product"
  | "start-conversation"
  | "partnership"
  | "follow-up";

export type Tone = "professional" | "consultative" | "direct" | "executive";

export type EmailLength = "short" | "medium" | "detailed";

export interface LeadBrief {
  company: string;
  website: string;
  contactName: string;
  jobTitle: string;
  industry: string;
  notes: string;
  product: ProductSelection;
  objective: Objective;
  tone: Tone;
  length: EmailLength;
  templateId: string;
}

/** Raw shape returned by the model, validated by `OutreachDraftSchema`. */
export interface OutreachDraft {
  recommendedProduct: string;
  painPoint: string;
  angle: string;
  subjects: string[];
  recommendedSubject: string;
  email: string;
  cta: string;
  followUp: string;
  /** Second follow-up for sequenced outreach. Empty when the model omitted it. */
  followUp2?: string;
}

export interface ConfidenceSignal {
  label: string;
  weight: number;
  earned: number;
  detail: string;
}

export interface Confidence {
  score: number;
  band: "low" | "moderate" | "high";
  signals: ConfidenceSignal[];
}

/** Full generator output: model draft plus locally derived metadata. */
export interface OutreachResult extends OutreachDraft {
  /** Resolved to a real product in the catalogue, never a model invention. */
  productId: ProductId;
  productName: string;
  /** True when the product was picked by the local auto-detect scorer. */
  autoDetected: boolean;
  confidence: Confidence;
  /** Copy that a human should double-check before sending. */
  reviewFlags: string[];
  model: string;
  templateId: string;
  generatedAt: string;
  elapsedMs: number;
}

export interface HistoryRecord {
  id: string;
  company: string;
  contactName: string;
  jobTitle: string;
  website: string;
  industry: string;
  notes: string;
  productId: string;
  productName: string;
  objective: Objective;
  tone: Tone;
  length: EmailLength;
  templateId: string;
  subjects: string[];
  recommendedSubject: string;
  email: string;
  painPoint: string;
  angle: string;
  cta: string;
  followUp: string;
  confidenceScore: number;
  reviewFlags: string[];
  model: string;
  createdAt: string;
}

export interface AppSettings {
  ollamaBaseUrl: string;
  model: string;
  temperature: number;
  requestTimeoutMs: number;
  defaultTone: Tone;
  defaultLength: EmailLength;
  defaultTemplateId: string;
  /** Email palette applied to every template. See `lib/templates/themes.ts`. */
  themeId: string;
  senderName: string;
  senderTitle: string;
  senderEmail: string;
  senderPhone: string;
  companyName: string;
  /** Postmark From header — stored in app settings, not .env. */
  postmarkSenderName: string;
  postmarkSenderEmail: string;
  postmarkMessageStream: string;
}

export interface OllamaStatus {
  connected: boolean;
  baseUrl: string;
  version?: string;
  models: string[];
  activeModel: string;
  /** Set when `connected` is false: a human-readable reason. */
  message?: string;
}
