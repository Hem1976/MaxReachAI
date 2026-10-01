/**
 * PLAIN AND LIGHTLY-BRANDED SKINS
 * ===============================
 * Skins own layout; `EmailTheme` owns colour and type. Every colour below comes
 * from the theme, so all 19 templates render in any of the 12 themes.
 *
 * These six read `content.body` directly. The block-driven skins live in
 * `skins-rich.ts`.
 */

import {
  brandLogoHeaderBlock,
  brandLogoImage,
  heroImageBlock,
  productCardBlock,
  productImageBlock,
} from "@/lib/email-assets/mjml-blocks";
import {
  announcementSkin,
  digestSkin,
  editorialSkin,
  invitationSkin,
  spotlightSkin,
  stepsSkin,
} from "@/lib/templates/skins-rich";
import { ctaButtonHref, escapeHtml, formatEmailCopy, toParagraphs } from "@/lib/templates/text";
import { type EmailTheme, isDarkTheme } from "@/lib/templates/themes";
import type { EmailContent, EmailTemplate, SkinId } from "@/lib/templates/types";

export { escapeHtml, toParagraphs };

function paragraphMarkup(
  body: string,
  theme: EmailTheme,
  fontSize: string,
  lineHeight: string,
): string {
  return toParagraphs(body)
    .map(
      (paragraph) =>
        `<mj-text font-size="${fontSize}" line-height="${lineHeight}" color="${theme.text}" padding="0 0 16px 0">${formatEmailCopy(
          paragraph,
        )}</mj-text>`,
    )
    .join("\n        ");
}

/**
 * The body copy usually already ends with the sender's name, so only append a
 * signature block when it is actually missing.
 */
function needsSignature(content: EmailContent): boolean {
  const name = content.sender.name.trim();
  if (!name) return false;
  return !content.body.toLowerCase().includes(name.toLowerCase());
}

function signatureMarkup(content: EmailContent, theme: EmailTheme): string {
  const { sender } = content;
  const lines = [
    sender.name && `<strong>${escapeHtml(sender.name)}</strong>`,
    sender.title && escapeHtml(sender.title),
    sender.companyName && escapeHtml(sender.companyName),
    sender.email &&
      `<a href="mailto:${escapeHtml(sender.email)}" style="color:${theme.textMuted};text-decoration:none">${escapeHtml(
        sender.email,
      )}</a>`,
    sender.phone && escapeHtml(sender.phone),
  ].filter(Boolean) as string[];

  if (lines.length === 0) return "";

  return `<mj-text font-size="13px" line-height="20px" color="${theme.textMuted}" padding="8px 0 0 0">${lines.join(
    "<br />",
  )}</mj-text>`;
}

function document(
  bodyMarkup: string,
  theme: EmailTheme,
  options?: { canvas?: string; width?: string },
): string {
  return `<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="${theme.fontSans}" />
      <mj-text color="${theme.text}" font-size="15px" line-height="24px" />
    </mj-attributes>
    <mj-style>
      a { color: ${theme.accent}; text-decoration: underline; }
    </mj-style>
    <mj-preview></mj-preview>
  </mj-head>
  <mj-body background-color="${options?.canvas ?? theme.canvas}" width="${options?.width ?? "600px"}">
${bodyMarkup}
  </mj-body>
</mjml>`;
}

/**
 * Plain and Executive normally sit on bare white with no visible card. Under a
 * dark theme that would put dark text on a dark page, so they fall back to the
 * theme surface instead of forcing white.
 */
function bareCanvas(theme: EmailTheme): string {
  return isDarkTheme(theme) ? theme.canvas : theme.surface;
}

/**
 * Plain: reads like a personal email. No chrome, no button.
 * Highest-trust option for first-touch cold outreach.
 */
function plainSkin(content: EmailContent, theme: EmailTheme): string {
  const signature = needsSignature(content) ? signatureMarkup(content, theme) : "";
  return document(
    `${brandLogoHeaderBlock(content.assets, theme, { background: bareCanvas(theme) })}
    <mj-section background-color="${bareCanvas(theme)}" padding="8px 32px 32px 32px">
      <mj-column>
        ${paragraphMarkup(content.body, theme, "15px", "25px")}
        ${signature}
      </mj-column>
    </mj-section>`,
    theme,
    { canvas: bareCanvas(theme) },
  );
}

/** Minimal: same as plain but tighter, for a last short nudge. */
function minimalSkin(content: EmailContent, theme: EmailTheme): string {
  const signature = needsSignature(content) ? signatureMarkup(content, theme) : "";
  return document(
    `${brandLogoHeaderBlock(content.assets, theme, { background: bareCanvas(theme), padding: "18px 32px 10px 32px" })}
    <mj-section background-color="${bareCanvas(theme)}" padding="8px 32px 28px 32px">
      <mj-column>
        ${paragraphMarkup(content.body, theme, "15px", "24px")}
        ${signature}
      </mj-column>
    </mj-section>`,
    theme,
    { canvas: bareCanvas(theme) },
  );
}

/** Hairline: a thin wordmark rule above the copy. Understated but branded. */
function hairlineSkin(content: EmailContent, theme: EmailTheme): string {
  const signature = needsSignature(content) ? signatureMarkup(content, theme) : "";
  return document(
    `${brandLogoHeaderBlock(content.assets, theme, { padding: "24px 32px 0 32px" })}
    <mj-section background-color="${theme.surface}" padding="0 32px 0 32px">
      <mj-column>
        <mj-divider border-width="1px" border-color="${theme.rule}" padding="16px 0 0 0" />
      </mj-column>
    </mj-section>
    <mj-section background-color="${theme.surface}" padding="28px 32px 8px 32px">
      <mj-column>
        ${paragraphMarkup(content.body, theme, "15px", "25px")}
        ${signature}
      </mj-column>
    </mj-section>
    <mj-section background-color="${theme.surface}" padding="8px 32px 32px 32px">
      <mj-column>
        <mj-divider border-width="1px" border-color="${theme.rule}" padding="0 0 12px 0" />
        <mj-text font-size="11px" color="${theme.textMuted}" line-height="17px" padding="0">Sent by ${escapeHtml(
          content.sender.companyName || "Maxpro Infotech",
        )}. Reply to this email if you would prefer not to hear from us again.</mj-text>
      </mj-column>
    </mj-section>`,
    theme,
  );
}

/** Branded: dark header band, content card, accent CTA button. */
function brandedSkin(content: EmailContent, theme: EmailTheme): string {
  const signature = needsSignature(content) ? signatureMarkup(content, theme) : "";
  const { assets } = content;
  return document(
    `${brandLogoHeaderBlock(assets, theme, { background: theme.surface, padding: "22px 32px 16px 32px" })}
    <mj-section background-color="${theme.surface}" padding="0 32px 4px 32px">
      <mj-column>
        <mj-divider border-width="3px" border-color="${theme.accent}" padding="0" />
      </mj-column>
    </mj-section>
    ${heroImageBlock(assets, theme)}
    <mj-section background-color="${theme.surface}" padding="36px 32px 12px 32px">
      <mj-column>
        ${
          content.productName
            ? `<mj-text font-size="11px" letter-spacing="1.5px" text-transform="uppercase" color="${theme.textMuted}" padding="0 0 14px 0">${escapeHtml(
                content.productName,
              )}</mj-text>`
            : ""
        }
        ${paragraphMarkup(content.body, theme, "15px", "25px")}
      </mj-column>
    </mj-section>
    ${productCardBlock(assets, theme, content.productName, content.productTagline)}
    <mj-section background-color="${theme.surface}" padding="4px 32px 32px 32px">
      <mj-column>
        <mj-button background-color="${theme.accent}" color="${theme.onAccent}" font-size="14px" font-weight="600" border-radius="${theme.radius}" inner-padding="13px 26px" align="left" href="${escapeHtml(
          content.ctaHref,
        )}" target="_blank">${escapeHtml(
          content.ctaLabel || "Reply to this email",
        )}</mj-button>
        ${signature}
      </mj-column>
    </mj-section>
    <mj-section background-color="${theme.surface}" padding="0 32px 32px 32px">
      <mj-column>
        <mj-divider border-width="1px" border-color="${theme.rule}" padding="0 0 12px 0" />
        <mj-text font-size="11px" color="${theme.textMuted}" line-height="17px" padding="0">${escapeHtml(
          content.sender.companyName || "Maxpro Infotech",
        )}</mj-text>
      </mj-column>
    </mj-section>`,
    theme,
  );
}

/** Executive: wide margins, larger type, text-link ask. No button. */
function executiveSkin(content: EmailContent, theme: EmailTheme): string {
  const signature = needsSignature(content) ? signatureMarkup(content, theme) : "";
  return document(
    `${brandLogoHeaderBlock(content.assets, theme, { background: bareCanvas(theme), padding: "28px 48px 12px 48px", width: "200px" })}
    <mj-section background-color="${bareCanvas(theme)}" padding="8px 48px 16px 48px">
      <mj-column>
        ${paragraphMarkup(content.body, theme, "16px", "28px")}
      </mj-column>
    </mj-section>
    <mj-section background-color="${bareCanvas(theme)}" padding="0 48px 48px 48px">
      <mj-column>
        <mj-divider border-width="1px" border-color="${theme.rule}" padding="8px 0 20px 0" />
        ${signature}
        <mj-text font-size="11px" letter-spacing="1.6px" text-transform="uppercase" color="${theme.textMuted}" padding="16px 0 0 0">${escapeHtml(
          content.sender.companyName || "Maxpro Infotech",
        )}</mj-text>
      </mj-column>
    </mj-section>`,
    theme,
    { canvas: bareCanvas(theme) },
  );
}

/** Panel: pulls the ask into a bordered call-out beneath the copy. */
function panelSkin(content: EmailContent, theme: EmailTheme): string {
  const signature = needsSignature(content) ? signatureMarkup(content, theme) : "";
  const image =
    content.assets.showProductImage && !content.assets.showProductCard
      ? `<mj-section background-color="${theme.surface}" padding="8px 32px 0 32px">
      <mj-column>
        ${productImageBlock(content.assets, theme)}
      </mj-column>
    </mj-section>`
      : "";
  return document(
    `${brandLogoHeaderBlock(content.assets, theme, { padding: "24px 32px 0 32px" })}
    <mj-section background-color="${theme.surface}" padding="12px 32px 8px 32px">
      <mj-column>
        ${paragraphMarkup(content.body, theme, "15px", "25px")}
      </mj-column>
    </mj-section>
    ${image}
    ${productCardBlock(content.assets, theme, content.productName, content.productTagline)}
    ${
      content.cta
        ? `<mj-section background-color="${theme.surface}" padding="8px 32px 8px 32px">
      <mj-column background-color="${theme.panel}" border="1px solid ${theme.rule}" border-radius="${theme.radius}" padding="20px 22px">
        <mj-text font-size="11px" letter-spacing="1.5px" text-transform="uppercase" color="${theme.textMuted}" padding="0 0 8px 0">Next step</mj-text>
        <mj-text font-size="15px" line-height="24px" color="${theme.text}" font-weight="600" padding="0">${escapeHtml(
          content.cta,
        )}</mj-text>
      </mj-column>
    </mj-section>`
        : ""
    }
    <mj-section background-color="${theme.surface}" padding="16px 32px 36px 32px">
      <mj-column>
        ${signature}
        <mj-divider border-width="1px" border-color="${theme.rule}" padding="20px 0 12px 0" />
        <mj-text font-size="11px" color="${theme.textMuted}" line-height="17px" padding="0">${escapeHtml(
          content.sender.companyName || "Maxpro Infotech",
        )}${content.productName ? ` &middot; ${escapeHtml(content.productName)}` : ""}</mj-text>
      </mj-column>
    </mj-section>`,
    theme,
  );
}

/** Letter: classic letterhead — logo, company line, rule, then the letter. */
function letterSkin(content: EmailContent, theme: EmailTheme): string {
  const signature = needsSignature(content) ? signatureMarkup(content, theme) : "";
  const company = content.sender.companyName || "Maxpro Infotech";
  const contactLine = [content.sender.email, content.sender.phone].filter(Boolean).join(" · ");
  return document(
    `${brandLogoHeaderBlock(content.assets, theme, { background: bareCanvas(theme), padding: "28px 40px 6px 40px", width: "220px" })}
    <mj-section background-color="${bareCanvas(theme)}" padding="0 40px 8px 40px">
      <mj-column>
        <mj-text font-size="13px" color="${theme.textMuted}" padding="0 0 12px 0">${escapeHtml(company)}</mj-text>
        <mj-divider border-width="1px" border-color="${theme.rule}" padding="0 0 20px 0" />
      </mj-column>
    </mj-section>
    <mj-section background-color="${bareCanvas(theme)}" padding="0 40px 8px 40px">
      <mj-column>
        ${paragraphMarkup(content.body, theme, "15px", "26px")}
      </mj-column>
    </mj-section>
    <mj-section background-color="${bareCanvas(theme)}" padding="8px 40px 40px 40px">
      <mj-column>
        ${signature}
        ${
          contactLine
            ? `<mj-text font-size="12px" line-height="18px" color="${theme.textMuted}" padding="12px 0 0 0">${formatEmailCopy(contactLine)}</mj-text>`
            : ""
        }
      </mj-column>
    </mj-section>`,
    theme,
    { canvas: bareCanvas(theme) },
  );
}

/** Card: one white card with a left accent bar. Simple office email. */
function cardSkin(content: EmailContent, theme: EmailTheme): string {
  const signature = needsSignature(content) ? signatureMarkup(content, theme) : "";
  return document(
    `<mj-section background-color="${theme.canvas}" padding="28px 16px">
      <mj-column background-color="${theme.surface}" border-left="4px solid ${theme.accent}" padding="8px 8px 8px 4px">
        ${brandLogoImage(content.assets, { width: "200px", align: "left", padding: "20px 24px 8px 24px" })}
        <mj-text font-size="12px" color="${theme.textMuted}" padding="0 24px 16px 24px">${escapeHtml(
          content.sender.companyName || "Maxpro Infotech",
        )}</mj-text>
        ${paragraphMarkup(content.body, theme, "15px", "25px").replace(/padding="0 0 16px 0"/g, 'padding="0 24px 16px 24px"')}
        ${
          signature
            ? signature.replace('padding="8px 0 0 0"', 'padding="8px 24px 0 24px"')
            : ""
        }
        <mj-text font-size="11px" color="${theme.textMuted}" padding="16px 24px 24px 24px">${escapeHtml(
          content.sender.companyName || "Maxpro Infotech",
        )}</mj-text>
      </mj-column>
    </mj-section>`,
    theme,
    { canvas: theme.canvas },
  );
}

/** Office: logo and company on one row, then the letter, then a reply button. */
function officeSkin(content: EmailContent, theme: EmailTheme): string {
  const signature = needsSignature(content) ? signatureMarkup(content, theme) : "";
  const company = content.sender.companyName || "Maxpro Infotech";
  return document(
    `<mj-section background-color="${bareCanvas(theme)}" padding="24px 36px 8px 36px">
      <mj-column width="50%">
        ${brandLogoImage(content.assets, { width: "200px", align: "left", padding: "0" })}
      </mj-column>
      <mj-column width="50%">
        <mj-text align="right" font-size="12px" line-height="18px" color="${theme.textMuted}" padding="8px 0 0 0">${escapeHtml(
          company,
        )}${content.sender.email ? `<br />${escapeHtml(content.sender.email)}` : ""}</mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="${bareCanvas(theme)}" padding="4px 36px 16px 36px">
      <mj-column>
        <mj-divider border-width="2px" border-color="${theme.accent}" padding="0 0 20px 0" />
        ${paragraphMarkup(content.body, theme, "15px", "25px")}
      </mj-column>
    </mj-section>
    <mj-section background-color="${bareCanvas(theme)}" padding="0 36px 36px 36px">
      <mj-column>
        <mj-button background-color="${theme.accent}" color="${theme.onAccent}" font-size="14px" font-weight="600" border-radius="${theme.radius}" inner-padding="12px 22px" align="left" href="${escapeHtml(
          content.ctaHref,
        )}" target="_blank">${escapeHtml(
          content.ctaLabel || "Reply to this email",
        )}</mj-button>
        ${signature}
      </mj-column>
    </mj-section>`,
    theme,
    { canvas: bareCanvas(theme) },
  );
}

const skins: Record<
  Exclude<SkinId, "codedmails" | "html">,
  (content: EmailContent, theme: EmailTheme) => string
> = {
  plain: plainSkin,
  minimal: minimalSkin,
  hairline: hairlineSkin,
  branded: brandedSkin,
  executive: executiveSkin,
  panel: panelSkin,
  letter: letterSkin,
  card: cardSkin,
  office: officeSkin,
  spotlight: spotlightSkin,
  editorial: editorialSkin,
  digest: digestSkin,
  invitation: invitationSkin,
  steps: stepsSkin,
  announcement: announcementSkin,
};

export const skinLabels: Record<SkinId, string> = {
  plain: "Plain text look",
  minimal: "Minimal",
  hairline: "Hairline wordmark",
  branded: "Branded header",
  executive: "Executive editorial",
  panel: "Call-out panel",
  letter: "Business letter",
  card: "Accent card",
  office: "Office header",
  spotlight: "Product spotlight",
  editorial: "Editorial broadsheet",
  digest: "Dark digest",
  invitation: "Invitation",
  steps: "Numbered walkthrough",
  announcement: "Announcement banner",
  codedmails: "CodedMails layout",
  html: "Maxpro HTML layout",
};

/** True for skins that read `EmailContent.blocks` rather than the raw body. */
export function isBlockSkin(skin: SkinId): boolean {
  return [
    "spotlight",
    "editorial",
    "digest",
    "invitation",
    "steps",
    "announcement",
    "codedmails",
    "html",
  ].includes(skin);
}

export function buildMjml(
  template: EmailTemplate,
  content: EmailContent,
  theme: EmailTheme,
): string {
  if (template.skin === "codedmails" || template.skin === "html") {
    throw new Error("This layout is filled on the server in renderTemplate.");
  }
  return skins[template.skin](content, theme);
}
