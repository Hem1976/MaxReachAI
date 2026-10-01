import type { AppSettings, Objective, Product } from "@/lib/types";
import { resolveEmailAssets } from "@/lib/email-assets";
import { buildBlocks } from "@/lib/templates/blocks";
import { ctaButtonHref } from "@/lib/templates/text";
import { emailTemplates as maxproTemplates } from "@/lib/templates/definitions";
import { isBlockSkin, skinLabels } from "@/lib/templates/skins";
import type {
  EmailContent,
  EmailTemplate,
  TemplateCategory,
} from "@/lib/templates/types";

export const codedMailsTemplates: EmailTemplate[] = [];
export const codedMailsThemeOptions: Array<{ value: string; label: string }> = [];
export { isBlockSkin, skinLabels };
export type { EmailContent, EmailTemplate, TemplateCategory };

export const emailTemplates: EmailTemplate[] = maxproTemplates.map((t) => ({
  ...t,
  library: "maxpro" as const,
}));

const byId = new Map(emailTemplates.map((t) => [t.id, t]));

export function getTemplate(id: string): EmailTemplate | undefined {
  return byId.get(id);
}

export function getTemplateOrDefault(id: string): EmailTemplate {
  return byId.get(id) ?? emailTemplates[0];
}

export const templateOptions = emailTemplates.map((t) => ({
  value: t.id,
  label: t.name,
  category: t.category,
}));

/** Library display order, so categories do not reshuffle as templates are added. */
const CATEGORY_ORDER: TemplateCategory[] = [
  "Introduction",
  "Problem to solution",
];

export const templateCategories = CATEGORY_ORDER.filter((category) =>
  emailTemplates.some((t) => t.category === category),
);

/**
 * Picker order: Introduction templates first, then Problem to solution.
 */
export function templatesGroupedForPicker(): Array<[string, EmailTemplate[]]> {
  const groups: Array<[string, EmailTemplate[]]> = [];
  const byCategory = new Map<TemplateCategory, EmailTemplate[]>();
  for (const template of emailTemplates) {
    const bucket = byCategory.get(template.category) ?? [];
    bucket.push(template);
    byCategory.set(template.category, bucket);
  }
  for (const category of CATEGORY_ORDER) {
    const bucket = byCategory.get(category);
    if (bucket && bucket.length > 0) groups.push([category, bucket]);
  }
  return groups;
}

const ctaLabels: Record<Objective, string> = {
  "book-demo": "Book a demo",
  "introduce-product": "Reply to this email",
  "start-conversation": "Start a conversation",
  partnership: "Explore a partnership",
  "follow-up": "Reply to this email",
};

export function ctaLabelFor(objective: Objective): string {
  return ctaLabels[objective] ?? "Reply to this email";
}

/** Assembles the content payload a template needs. Copy in, markup out. */
export function buildEmailContent(input: {
  subject: string;
  body: string;
  cta: string;
  ctaLabel?: string;
  company: string;
  contactName: string;
  productName: string;
  /** Supplies the grounded lists that block-driven skins render. */
  product?: Product;
  template?: { imageSettings?: import("@/lib/templates/types").TemplateImageSettings };
  settings: Pick<
    AppSettings,
    "senderName" | "senderTitle" | "senderEmail" | "senderPhone" | "companyName"
  >;
}): EmailContent {
  const sender = {
    name: input.settings.senderName,
    title: input.settings.senderTitle,
    email: input.settings.senderEmail,
    phone: input.settings.senderPhone,
    companyName: input.settings.companyName,
  };
  const ctaLabel = input.ctaLabel || "Reply to this email";
  const ctaHref = ctaButtonHref({
    senderEmail: sender.email,
    subject: input.subject,
    ctaLabel,
    cta: input.cta,
  });
  const assets = resolveEmailAssets({
    product: input.product,
    template: input.template,
  });

  return {
    subject: input.subject,
    body: input.body,
    cta: input.cta,
    ctaLabel,
    ctaHref,
    company: input.company,
    contactName: input.contactName,
    productName: input.productName,
    productTagline: input.product?.tagline ?? "",
    sender,
    assets,
    blocks: buildBlocks({
      subject: input.subject,
      body: input.body,
      cta: input.cta,
      ctaLabel,
      productName: input.productName,
      sender,
      product: input.product,
    }),
  };
}
