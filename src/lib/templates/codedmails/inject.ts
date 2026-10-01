/**
 * Fills a vendored CodedMails MJML file with MaxReach copy.
 *
 * Layout, spacing, type and chrome stay exactly as CodedMails designed them.
 * Placeholder copy, broken relative images and the CodedMails wordmark are
 * replaced; the model never touches the markup.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { brandLogoHeaderBlock } from "@/lib/email-assets/mjml-blocks";
import { escapeHtml, formatEmailCopy } from "@/lib/templates/text";
import type { EmailTheme } from "@/lib/templates/themes";
import type { EmailContent, EmailTemplate } from "@/lib/templates/types";

const ROOT = join(process.cwd(), "vendor", "email-templates", "codedmails");

export function loadCodedMailsMjml(file: string): string {
  return readFileSync(join(ROOT, file), "utf8");
}

function alignFrom(attrs: string): string {
  const match = attrs.match(/\balign="(left|right|center)"/i);
  return match?.[1] ?? "center";
}

function paragraphHtml(text: string): string {
  return `<p>${formatEmailCopy(text)}</p>`;
}

const IMAGE_TAG =
  /<mj-image\b([^>]*?)(\/>|>[\s\S]*?<\/mj-image>)/gi;

export function fillCodedMails(mjml: string, content: EmailContent): string {
  let out = mjml;
  const brand = content.sender.companyName || "Maxpro Infotech";
  const blocks = content.blocks;

  out = out.replace(
    /<mj-title>[\s\S]*?<\/mj-title>/i,
    `<mj-title>${escapeHtml(content.subject)}</mj-title>`,
  );
  out = out.replace(
    /<mj-preview>[\s\S]*?<\/mj-preview>/i,
    `<mj-preview>${escapeHtml(blocks.preheader)}</mj-preview>`,
  );

  out = out.replace(/<mj-social\b[\s\S]*?<\/mj-social>/gi, "");

  let headlineDone = false;
  out = out.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi, (match) => {
    if (headlineDone) return match;
    headlineDone = true;
    return `<h1>${escapeHtml(blocks.headline)}</h1>`;
  });

  out = out.replace(/<mj-body\b[\s\S]*<\/mj-body>/i, (body) =>
    body.replace(/<mj-button\b([^>]*)>([\s\S]*?)<\/mj-button>/gi, (_full, attrs: string) => {
      const withoutHref = String(attrs).replace(/\s+href="[^"]*"/gi, "");
      return `<mj-button${withoutHref} href="${escapeHtml(content.ctaHref)}" target="_blank">${escapeHtml(
        blocks.ctaLabel,
      )}</mj-button>`;
    }),
  );

  if (blocks.capabilities.length > 0) {
    const rows = blocks.capabilities
      .map(
        (item, index) =>
          `<tr><td style="padding:8px 0;width:32px">${String(index + 1).padStart(2, "0")}</td><td style="padding:8px 0">${escapeHtml(item)}</td></tr>`,
      )
      .join("");
    out = out.replace(
      /<mj-table\b[^>]*>[\s\S]*?<\/mj-table>/gi,
      `<mj-table padding="20px"><tr><th colspan="2" style="text-align:left;padding-bottom:8px">What it handles</th></tr>${rows}</mj-table>`,
    );
  }

  const slots = [
    blocks.greeting,
    blocks.intro,
    ...blocks.paragraphs,
    blocks.cta,
  ].filter(Boolean);

  const footerInner = [
    escapeHtml(blocks.footerNote),
    blocks.signature.map(formatEmailCopy).join("<br />"),
    "Reply to this email if you would prefer not to hear from us again.",
  ]
    .filter(Boolean)
    .join("<br />");

  const textBlocks = [...out.matchAll(/<mj-text\b([^>]*)>([\s\S]*?)<\/mj-text>/gi)];
  const footerIndexes = textBlocks
    .map((match, index) => {
      const attrs = match[1] ?? "";
      const inner = match[2] ?? "";
      return /footer/i.test(attrs) || /©|unsubscribe|all rights reserved/i.test(inner)
        ? index
        : -1;
    })
    .filter((index) => index >= 0);
  const lastFooter = footerIndexes[footerIndexes.length - 1];

  let slot = 0;
  let textIndex = -1;
  out = out.replace(
    /<mj-text\b([^>]*)>([\s\S]*?)<\/mj-text>/gi,
    (full, attrs: string, inner: string) => {
      textIndex += 1;
      const isHeading = /<h1\b/i.test(inner);
      if (isHeading) {
        return full.replace(
          /<h1\b[^>]*>[\s\S]*?<\/h1>/i,
          `<h1>${escapeHtml(blocks.headline)}</h1>`,
        );
      }

      // Article-card chrome (dates, h2/h3 teasers) is CodedMails sample copy.
      const isSubhead =
        /<h[23]\b/i.test(inner) || /image-heading/i.test(attrs);
      if (isSubhead) {
        return `<mj-text${attrs}></mj-text>`;
      }

      if (footerIndexes.includes(textIndex)) {
        if (textIndex === lastFooter) {
          return `<mj-text${attrs}>${footerInner}</mj-text>`;
        }
        return `<mj-text${attrs}></mj-text>`;
      }

      const visible = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (!visible) return full;

      const next = slots[slot];
      slot += 1;
      if (!next) return `<mj-text${attrs}></mj-text>`;
      return `<mj-text${attrs}>${paragraphHtml(next)}</mj-text>`;
    },
  );

  out = out.replace(/\[Coded Mails\]/gi, escapeHtml(brand));
  out = out.replace(/Coded Mails/gi, escapeHtml(brand));
  out = out.replace(/codedmails\.com/gi, "maxproinfotech.com");
  if (content.sender.email) {
    out = out.replace(/support@codedmails\.com/gi, escapeHtml(content.sender.email));
    out = out.replace(/hello@codedmails\.com/gi, escapeHtml(content.sender.email));
  }

  out = out.replace(IMAGE_TAG, (full, attrs: string) => {
    const src = attrs.match(/\bsrc="([^"]*)"/i)?.[1] ?? "";
    const isLogo = /logo/i.test(src) || /logo/i.test(attrs);
    const isRelative = src.startsWith(".") || src.startsWith("/");
    if (isLogo) {
      const align = alignFrom(attrs);
      const url = content.assets.brandLogoUrl.replace(/"/g, "&quot;");
      return `<mj-image src="${url}" alt="Maxpro Infotech" width="168px" align="${align}" padding="8px 25px" />`;
    }
    if (isRelative) return "";
    return full;
  });

  return out;
}

export function buildCodedMailsMjml(
  template: EmailTemplate,
  content: EmailContent,
  theme: EmailTheme,
): string {
  const file = template.codedmailsFile;
  if (!file) {
    throw new Error(`Template ${template.id} is missing codedmailsFile`);
  }
  let mjml = fillCodedMails(loadCodedMailsMjml(file), content);
  const logoUrl = content.assets.brandLogoUrl;
  if (logoUrl && !mjml.includes(logoUrl)) {
    mjml = mjml.replace(
      /(<mj-body[^>]*>)/i,
      `$1\n${brandLogoHeaderBlock(content.assets, theme, { padding: "22px 25px 12px 25px" })}`,
    );
  }
  return mjml;
}
