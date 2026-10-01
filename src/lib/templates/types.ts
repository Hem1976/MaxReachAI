/**
 * Templates own PRESENTATION. The AI owns COPY.
 *
 * `EmailContent` is the only bridge between the two: the generator produces it,
 * the template turns it into MJML. A template never writes sentences and the
 * AI never writes markup.
 *
 * Richer skins need copy broken into named slots rather than one blob, so
 * `EmailContent.blocks` carries that breakdown. Every block is either derived
 * from the model draft or lifted verbatim from the product knowledge base —
 * nothing in here is a second, unvalidated generation.
 */

import type { Objective } from "@/lib/types";

export type SkinId =
  | "plain"
  | "hairline"
  | "branded"
  | "executive"
  | "panel"
  | "minimal"
  | "letter"
  | "card"
  | "office"
  // Block-driven skins adapted from the vendored MIT template sources.
  | "spotlight"
  | "editorial"
  | "digest"
  | "invitation"
  | "steps"
  | "announcement"
  /** Full CodedMails MJML layout, filled rather than rewritten. */
  | "codedmails"
  /** Original HTML layout from the Maxpro email library. */
  | "html";

export interface EmailSender {
  name: string;
  title: string;
  email: string;
  phone: string;
  companyName: string;
}

/**
 * The named slots a template may fill. A skin picks the ones it needs and
 * ignores the rest, so adding a slot never breaks an existing design.
 */
export interface EmailBlocks {
  /** Inbox preview line. */
  preheader: string;
  /** Small uppercase label above the headline. Usually the product name. */
  eyebrow: string;
  /** The product's catalogue category, for skins that already show the name. */
  productCategory: string;
  headline: string;
  /** "Hi Karan," — kept separate so skins can place or drop it. */
  greeting: string;
  /** Opening paragraph, used as the lede by skins with a headline. */
  intro: string;
  /** Remaining body paragraphs, greeting and sign-off already removed. */
  paragraphs: string[];
  /** What the product handles. Verbatim from the product knowledge base. */
  capabilities: string[];
  /** What changes for the customer. Verbatim from the product knowledge base. */
  outcomes: string[];
  cta: string;
  ctaLabel: string;
  /** Signature lines, already ordered for display. */
  signature: string[];
  footerNote: string;
}

export interface EmailAssets {
  brandLogoUrl: string;
  productImageUrl: string | null;
  productImageAlt: string;
  heroImageUrl: string | null;
  heroImageAlt: string;
  showProductImage: boolean;
  showProductCard: boolean;
  showHero: boolean;
}

export interface EmailContent {
  subject: string;
  /** Full email body as plain text. Blank lines separate paragraphs. */
  body: string;
  /** One-sentence ask, used by skins that surface it separately. */
  cta: string;
  /** Short button/link label, e.g. "Book a demo". */
  ctaLabel: string;
  /** Where the template button goes — mailto the sender, or an https URL. */
  ctaHref: string;
  company: string;
  contactName: string;
  productName: string;
  productTagline: string;
  sender: EmailSender;
  blocks: EmailBlocks;
  assets: EmailAssets;
}

export type TemplateCategory =
  | "Introduction"
  | "Problem to solution"
  | "My templates"
  | "Cold outreach"
  | "Product"
  | "Follow-up"
  | "Executive"
  | "Partnership"
  | "Marketing"
  | "Professional";

/** Visual register, used for filtering and for the recommendation copy. */
export type TemplateStyle =
  | "plain-text"
  | "minimal"
  | "branded"
  | "editorial"
  | "bold";

/**
 * Provenance for templates whose layout was adapted from a third-party source.
 * Kept on the template itself so the attribution cannot drift away from the
 * thing it describes. `null` means the design is entirely ours.
 */
export interface TemplateSource {
  name: string;
  url: string;
  license: string;
  /** What we actually took, so the credit is accurate rather than blanket. */
  adapted: string;
}

export type TemplateLibrary = "maxpro" | "codedmails";

/** Template owns layout; the matcher picks the asset, not the model. */
export type ImageMode = "none" | "product" | "hero";

export interface TemplateImageSettings {
  imageMode: ImageMode;
  showProductCard: boolean;
  showHero: boolean;
  /** Asset under `public/email-assets/templates/`. */
  heroKey?: "hero01" | "hero02";
}

export interface EmailTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  style: TemplateStyle;
  /** Shown in the library. */
  purpose: string;
  bestFor: string;
  skin: SkinId;
  /** Which collection this belongs to. Defaults to the Maxpro originals. */
  library?: TemplateLibrary;
  /** CodedMails theme id, e.g. "aleos". */
  codedmailsTheme?: string;
  /** Path under vendor/email-templates/codedmails/. */
  codedmailsFile?: string;
  /** Filename under `src/lib/templates/html/`. */
  htmlFile?: string;
  /** Filename under `public/Email Templates/`. */
  publicHtmlFile?: string;
  /** Injected into the AI prompt so the copy matches the template's intent. */
  structure: string;
  /** Objectives this template is built for. Drives the recommendation. */
  objectives: Objective[];
  /** Industries this template suits. Empty means "any". */
  industries: string[];
  /** Free-form search and matching terms. */
  tags: string[];
  source: TemplateSource | null;
  /** Sample copy so the library can be previewed before anything is generated. */
  sample: {
    subject: string;
    body: string;
    cta: string;
    ctaLabel: string;
  };
  /** When omitted, templates render text-only (cold outreach default). */
  imageSettings?: TemplateImageSettings;
}
