import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { resolveAssetUrl } from "@/lib/email-assets";
import { DEFAULT_CAMPAIGN_SENDER } from "@/lib/templates/sender-defaults";
import { escapeHtml, formatEmailCopy } from "@/lib/templates/text";
import type { TemplateSlots } from "@/lib/templates/slots";
import { IMAGE_SLOT_KEYS } from "@/lib/templates/slots";
import { applyEditorChrome } from "@/lib/templates/html/visual-editor";
import { ensureResponsiveEmailHtml } from "@/lib/templates/html/responsive";
import type { EmailContent, EmailTemplate } from "@/lib/templates/types";

const ROOT = join(process.cwd(), "src", "lib", "templates", "html");

const DEFAULT_IMAGES = {
  collaboration:
    "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=800&q=80",
  workspace:
    "https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=800&q=80",
  meeting:
    "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80",
  workspaceHero:
    "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=85",
} as const;

const DARK_LAYOUTS = new Set([
  "intro-plain",
  "intro-one-image",
  "problem-solution-product",
  "problem-solution-premium",
]);

const TITLE_SLOTS = new Set([
  "EYEBROW",
  "HEADLINE",
  "PROBLEM_TITLE",
  "SOLUTION_TITLE",
  "CTA_LABEL",
  "APP_NAME",
  "SENDER_NAME",
  "SENDER_TITLE",
  "COMPANY_NAME",
  "BRAND_SUBTITLE",
  "TRANSITION_LINE",
  "CTA_NOTE",
  "SUBJECT",
]);

export function loadHtmlTemplate(file: string): string {
  return readFileSync(join(ROOT, file), "utf8");
}

function firstSentence(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const match = clean.match(/^[^.!?]+[.!?]?/);
  return (match?.[0] ?? clean).trim();
}

function restAfterFirstSentence(value: string): string {
  const title = firstSentence(value);
  if (!title) return "";
  return value.replace(/\s+/g, " ").trim().slice(title.length).trim();
}

function attr(value: string): string {
  return escapeHtml(value);
}

export function resolveHtmlTokens(
  template: EmailTemplate,
  content: EmailContent,
  overrides: TemplateSlots = {},
): Record<string, string> {
  const blocks = content.blocks;
  const follow = blocks.paragraphs[0] ?? "";
  const extra = blocks.paragraphs.slice(1).join(" ");

  const problemTitle =
    firstSentence(blocks.intro) || "The current way of working is slowing the team down";
  const problemBody =
    restAfterFirstSentence(blocks.intro) ||
    blocks.intro ||
    "Small gaps become delays, missed follow-ups and poor visibility.";
  const solutionTitle =
    firstSentence(follow) ||
    blocks.outcomes[0]?.trim() ||
    `How ${content.productName || "Maxpro"} changes this`;
  const solutionBody =
    restAfterFirstSentence(follow) ||
    extra ||
    follow ||
    `${content.productName || "Maxpro"} brings the process into one focused system so your team can work with more clarity and less manual effort.`;

  const features = blocks.capabilities;
  const bodyParagraphs = blocks.paragraphs;
  const heroDefault =
    template.id === "letter-hero"
      ? "/email-assets/templates/letter-hero.jpg"
      : template.id === "problem-solution-premium"
        ? content.assets.heroImageUrl ||
          content.assets.productImageUrl ||
          DEFAULT_IMAGES.workspaceHero
        : content.assets.heroImageUrl ||
          content.assets.productImageUrl ||
          DEFAULT_IMAGES.meeting;

  const pngLogo = join(process.cwd(), "public", "email-assets", "MAXPRO-LOGO-FINAL-3.png");
  const logoPath = existsSync(pngLogo)
    ? "/email-assets/MAXPRO-LOGO-FINAL-3.png"
    : DARK_LAYOUTS.has(template.id)
      ? "/email-assets/maxpro-logo-light.svg"
      : "/email-assets/maxpro-logo.svg";

  const defaults: Record<string, string> = {
    SUBJECT: content.subject,
    LOGO_URL: resolveAssetUrl(logoPath),
    EYEBROW:
      template.id === "problem-solution-premium"
        ? "The friction"
        : template.category === "Introduction"
          ? "A quick introduction"
          : "A quick thought for your team",
    HEADLINE: blocks.headline || content.subject,
    GREETING: blocks.greeting || `Hi ${content.contactName || "there"},`,
    INTRO: blocks.intro,
    FOLLOW: follow,
    PARAGRAPH_2: bodyParagraphs[0] ?? "",
    PARAGRAPH_3: bodyParagraphs[1] ?? "",
    PARAGRAPH_4: bodyParagraphs[2] ?? "",
    SENDER_ORG: content.company || "",
    CTA_HREF: content.ctaHref || `mailto:${DEFAULT_CAMPAIGN_SENDER.senderEmail}`,
    CTA_LABEL: content.ctaLabel || blocks.ctaLabel || "Explore the idea",
    SENDER_NAME: content.sender.name || DEFAULT_CAMPAIGN_SENDER.senderName,
    SENDER_TITLE: content.sender.title || DEFAULT_CAMPAIGN_SENDER.senderTitle,
    COMPANY_NAME: content.sender.companyName || DEFAULT_CAMPAIGN_SENDER.companyName,
    BRAND_SUBTITLE: "Business Systems",
    APP_NAME: content.productName || "Maxpro",
    PRODUCT_BLURB:
      content.productTagline ||
      "A focused Maxpro application designed to solve this exact operational problem.",
    PROBLEM_TITLE: problemTitle,
    PROBLEM_BODY: problemBody,
    SOLUTION_TITLE: solutionTitle,
    SOLUTION_BODY: solutionBody,
    PROBLEM_BULLET_1: "Manual work slows down response time",
    PROBLEM_BULLET_2: "Important information gets fragmented",
    PROBLEM_BULLET_3: "Managers have less visibility when decisions matter",
    BENEFIT_1: features[0] ?? "Centralize the workflow",
    BENEFIT_2: features[1] ?? "Reduce repetitive manual work",
    BENEFIT_3: features[2] ?? "Give teams clearer visibility",
    TRANSITION_LINE: "The opportunity is not to work harder. It is to remove the friction.",
    CTA_NOTE: "No pressure. Just a better way to approach operations.",
    IMAGE_1: content.assets.heroImageUrl || content.assets.productImageUrl || DEFAULT_IMAGES.collaboration,
    IMAGE_2: content.assets.productImageUrl || DEFAULT_IMAGES.workspace,
    IMAGE_HERO: heroDefault,
    SENDER_EMAIL: content.sender.email || DEFAULT_CAMPAIGN_SENDER.senderEmail,
    FOOTER_ADDRESS: "Nairobi, Kenya",
    FOOTER_PHONE: content.sender.phone || DEFAULT_CAMPAIGN_SENDER.senderPhone,
    FOOTER_EMAIL: content.sender.email || DEFAULT_CAMPAIGN_SENDER.senderEmail,
  };

  const merged = { ...defaults };
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value !== "string") continue;
    merged[key] = value;
  }

  for (const key of IMAGE_SLOT_KEYS) {
    const current = merged[key];
    if (current && current.startsWith("/")) merged[key] = resolveAssetUrl(current);
  }

  return merged;
}

function encodeToken(key: string, value: string): string {
  if (
    key === "CTA_HREF" ||
    key === "LOGO_URL" ||
    key.startsWith("IMAGE_") ||
    key === "SENDER_EMAIL" ||
    key === "FOOTER_EMAIL" ||
    key === "FOOTER_PHONE"
  ) {
    return attr(value);
  }
  if (TITLE_SLOTS.has(key)) return escapeHtml(value);
  return formatEmailCopy(value);
}

export function fillHtmlTemplate(
  template: EmailTemplate,
  content: EmailContent,
  options?: { slots?: TemplateSlots; editable?: boolean },
): { html: string; slots: Record<string, string> } {
  const file = template.htmlFile;
  if (!file) {
    throw new Error(`Template ${template.id} is missing htmlFile.`);
  }

  const tokens = resolveHtmlTokens(template, content, options?.slots);
  let html = loadHtmlTemplate(file).replace(
    /\{\{([A-Z0-9_]+)\}\}/g,
    (_, key: string) => encodeToken(key, tokens[key] ?? ""),
  );

  if (options?.editable) {
    html = applyEditorChrome(html);
  }

  html = ensureResponsiveEmailHtml(html);

  return { html, slots: tokens };
}
