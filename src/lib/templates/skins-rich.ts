/**
 * BLOCK-DRIVEN SKINS
 * ==================
 * Layouts adapted from the MIT-licensed MJML sources vendored under
 * `vendor/email-templates/` — see `vendor/email-templates/NOTICE.md` for the
 * per-source attribution. What was taken is structure: masthead treatments,
 * kicker/headline/lede rhythm, rule work, panel and list patterns. Type scale,
 * palette and every word were replaced to match Maxpro.
 *
 * Each skin reads named slots off `EmailContent.blocks` and takes all colour
 * from `EmailTheme`, so any template renders in any of the 12 themes. None of
 * them ever receive markup from the model, which is the point: the AI supplies
 * copy and cannot reach the design.
 */

import { brandLogoHeaderBlock, brandLogoImage, productImageBlock } from "@/lib/email-assets/mjml-blocks";
import { escapeHtml, formatEmailCopy } from "@/lib/templates/text";
import { type EmailTheme, isDarkTheme } from "@/lib/templates/themes";
import type { EmailBlocks, EmailContent } from "@/lib/templates/types";

/* ---------------------------------------------------------------- helpers */

function doc(options: {
  theme: EmailTheme;
  preheader: string;
  canvas: string;
  width?: string;
  styles?: string;
  body: string;
}): string {
  const { theme } = options;
  return `<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="${theme.fontSans}" />
      <mj-section padding="0" />
      <mj-text color="${theme.text}" font-size="15px" line-height="1.65" padding="0" />
    </mj-attributes>
    <mj-style>
      a { color: ${theme.accent}; text-decoration: underline; }
${options.styles ?? ""}
    </mj-style>
    <mj-preview>${escapeHtml(options.preheader)}</mj-preview>
  </mj-head>
  <mj-body background-color="${options.canvas}" width="${options.width ?? "600px"}">
${options.body}
  </mj-body>
</mjml>`;
}

function kicker(text: string, color: string, padding = "0 0 14px 0"): string {
  if (!text) return "";
  return `<mj-text font-size="11px" letter-spacing="0.14em" text-transform="uppercase" font-weight="700" color="${color}" padding="${padding}">${escapeHtml(text)}</mj-text>`;
}

/** Body paragraphs. Single newlines inside a paragraph stay as line breaks. */
function prose(
  paragraphs: string[],
  options: { size: string; lineHeight: string; color: string; gap?: string },
): string {
  return paragraphs
    .filter((paragraph) => paragraph && paragraph.trim().length > 0)
    .map(
      (paragraph) =>
        `<mj-text font-size="${options.size}" line-height="${options.lineHeight}" color="${options.color}" padding="0 0 ${options.gap ?? "16px"} 0">${formatEmailCopy(
          paragraph,
        )}</mj-text>`,
    )
    .join("\n        ");
}

function signature(
  blocks: EmailBlocks,
  options: { nameColor: string; lineColor: string },
): string {
  if (blocks.signature.length === 0) return "";
  const [name, ...rest] = blocks.signature;
  return `<mj-text font-size="13px" line-height="20px" color="${options.lineColor}" padding="0">${[
    `<strong style="color:${options.nameColor}">${escapeHtml(name)}</strong>`,
    ...rest.map(formatEmailCopy),
  ].join("<br />")}</mj-text>`;
}

function footer(blocks: EmailBlocks, color: string): string {
  return `<mj-text font-size="11px" line-height="17px" color="${color}" padding="0">${escapeHtml(
    blocks.footerNote,
  )}<br />Reply to this email if you would prefer not to hear from us again.</mj-text>`;
}

function button(
  label: string,
  background: string,
  color: string,
  radius: string,
  href: string,
): string {
  return `<mj-button background-color="${background}" color="${color}" font-size="14px" font-weight="600" border-radius="${radius}" inner-padding="13px 26px" align="left" href="${escapeHtml(
    href,
  )}" target="_blank">${escapeHtml(label)}</mj-button>`;
}

/** A numbered list rendered as a table so Outlook keeps the alignment. */
function numberedList(
  items: string[],
  options: { numberColor: string; textColor: string; ruleColor: string },
): string {
  if (items.length === 0) return "";
  const rows = items
    .map(
      (item, index) => `            <tr>
              <td width="34" valign="top" style="padding:12px 0;border-top:1px solid ${options.ruleColor};font-size:13px;font-weight:700;color:${options.numberColor};">${String(
                index + 1,
              ).padStart(2, "0")}</td>
              <td valign="top" style="padding:12px 0;border-top:1px solid ${options.ruleColor};font-size:14px;line-height:1.55;color:${options.textColor};">${escapeHtml(
                item,
              )}</td>
            </tr>`,
    )
    .join("\n");

  return `<mj-text padding="0">
          <table cellpadding="0" cellspacing="0" border="0" width="100%" role="presentation">
${rows}
          </table>
        </mj-text>`;
}

function bulletList(items: string[], color: string): string {
  return items
    .map(
      (item) =>
        `<mj-text font-size="14px" line-height="1.55" color="${color}" padding="0 0 8px 0">&bull;&nbsp;&nbsp;${escapeHtml(
          item,
        )}</mj-text>`,
    )
    .join("\n        ");
}

/**
 * Headings sit on `ink` in a light theme, but `ink` is near-black in a dark
 * theme where it would vanish against the surface.
 */
function headingColor(theme: EmailTheme): string {
  return isDarkTheme(theme) ? theme.darkText : theme.ink;
}

/* ------------------------------------------------------------------ skins */

/**
 * Spotlight — product showcase.
 * Adapted from Colorlib #25: header bar with a tag, kicker/headline/lede
 * stack, capability list, then a dark panel carrying the ask.
 */
export function spotlightSkin(content: EmailContent, theme: EmailTheme): string {
  const b = content.blocks;
  const heading = headingColor(theme);
  return doc({
    theme,
    preheader: b.preheader,
    canvas: theme.canvas,
    width: "620px",
    body: `    <mj-section background-color="${theme.surface}" padding="24px 36px" border-bottom="1px solid ${theme.rule}">
      <mj-column width="55%" vertical-align="middle">
        ${brandLogoImage(content.assets, { width: "168px", padding: "0" })}
      </mj-column>
      <mj-column width="45%" vertical-align="middle">
        <mj-text align="right" font-size="11px" letter-spacing="0.08em" color="${theme.textMuted}" padding="0">${escapeHtml(
          b.eyebrow,
        )}</mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="${theme.surface}" padding="44px 36px 0 36px">
      <mj-column>
        ${kicker(b.productCategory || b.eyebrow, theme.accent)}
        <mj-text font-size="28px" line-height="1.18" font-weight="700" letter-spacing="-0.02em" color="${heading}" padding="0 0 16px 0">${escapeHtml(
          b.headline,
        )}</mj-text>
        ${
          content.assets.showProductImage
            ? productImageBlock(content.assets, theme, {
                width: "520px",
                padding: "0 0 20px 0",
              })
            : ""
        }
        ${b.greeting ? prose([b.greeting], { size: "15px", lineHeight: "1.6", color: theme.text }) : ""}
        ${prose([b.intro], { size: "16px", lineHeight: "1.65", color: theme.text })}
      </mj-column>
    </mj-section>

    <mj-section background-color="${theme.surface}" padding="0 36px 8px 36px">
      <mj-column>
        ${prose(b.paragraphs, { size: "15px", lineHeight: "1.65", color: theme.text })}
      </mj-column>
    </mj-section>

    ${
      b.capabilities.length > 0
        ? `<mj-section background-color="${theme.surface}" padding="12px 36px 8px 36px">
      <mj-column background-color="${theme.panel}" border="1px solid ${theme.rule}" border-radius="${theme.radius}" padding="22px 24px">
        ${kicker("What it handles", theme.textMuted, "0 0 12px 0")}
        ${bulletList(b.capabilities, theme.text)}
      </mj-column>
    </mj-section>`
        : ""
    }

    <mj-section background-color="${theme.surface}" padding="20px 36px 36px 36px">
      <mj-column>
        ${button(b.ctaLabel, theme.accent, theme.onAccent, theme.radius, content.ctaHref)}
      </mj-column>
    </mj-section>

    <mj-section background-color="${theme.surface}" padding="20px 36px 8px 36px">
      <mj-column>
        ${kicker("Next step", theme.accent, "0 0 12px 0")}
        <mj-text font-size="17px" line-height="1.5" font-weight="600" color="${theme.text}" padding="0 0 16px 0">${escapeHtml(
          b.cta,
        )}</mj-text>
        <mj-text font-size="13px" line-height="20px" color="${theme.textMuted}" padding="0">${b.signature
          .map(escapeHtml)
          .join("<br />")}</mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="${theme.canvas}" padding="24px 36px 32px 36px">
      <mj-column>
        ${footer(b, theme.textMuted)}
      </mj-column>
    </mj-section>`,
  });
}

/**
 * Editorial — case study and long-form executive reading.
 * Adapted from Colorlib #24: serif masthead over a heavy rule, kicker, serif
 * headline, wide margins, rule-separated sign-off.
 */
export function editorialSkin(content: EmailContent, theme: EmailTheme): string {
  const b = content.blocks;
  const heading = headingColor(theme);
  return doc({
    theme,
    preheader: b.preheader,
    canvas: theme.canvas,
    width: "620px",
    body: `    <mj-section background-color="${theme.canvas}" padding="40px 44px 0 44px">
      <mj-column width="60%" vertical-align="middle">
        ${brandLogoImage(content.assets, { width: "168px", padding: "0" })}
      </mj-column>
      <mj-column width="40%" vertical-align="middle">
        <mj-text align="right" font-size="11px" letter-spacing="0.14em" text-transform="uppercase" color="${theme.textMuted}" padding="0">${escapeHtml(
          b.eyebrow,
        )}</mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="${theme.canvas}" padding="16px 44px 0 44px">
      <mj-column>
        <mj-divider border-color="${heading}" border-width="1px" padding="0" />
      </mj-column>
    </mj-section>

    <mj-section background-color="${theme.canvas}" padding="32px 44px 0 44px">
      <mj-column>
        <mj-text font-family="${theme.fontSerif}" font-size="31px" line-height="1.15" font-weight="700" letter-spacing="-0.01em" color="${heading}" padding="0 0 22px 0">${escapeHtml(
          b.headline,
        )}</mj-text>
        ${b.greeting ? prose([b.greeting], { size: "16px", lineHeight: "1.7", color: theme.text }) : ""}
        ${prose([b.intro], { size: "17px", lineHeight: "1.72", color: theme.text })}
        ${prose(b.paragraphs, { size: "16px", lineHeight: "1.72", color: theme.text })}
      </mj-column>
    </mj-section>

    ${
      b.outcomes.length > 0
        ? `<mj-section background-color="${theme.canvas}" padding="12px 44px 0 44px">
      <mj-column>
        <mj-divider border-color="${theme.rule}" border-width="1px" padding="0 0 22px 0" />
        ${kicker("What changes", theme.textMuted, "0 0 4px 0")}
        ${numberedList(b.outcomes, {
          numberColor: theme.accent,
          textColor: theme.text,
          ruleColor: theme.rule,
        })}
      </mj-column>
    </mj-section>`
        : ""
    }

    <mj-section background-color="${theme.canvas}" padding="36px 44px 0 44px">
      <mj-column>
        <mj-divider border-color="${heading}" border-width="1px" padding="0 0 22px 0" />
        ${b.cta ? `<mj-text font-size="16px" line-height="1.6" color="${theme.text}" padding="0 0 18px 0">${escapeHtml(b.cta)}</mj-text>` : ""}
        ${signature(b, { nameColor: heading, lineColor: theme.textMuted })}
      </mj-column>
    </mj-section>

    <mj-section background-color="${theme.canvas}" padding="32px 44px 44px 44px">
      <mj-column>
        ${footer(b, theme.textMuted)}
      </mj-column>
    </mj-section>`,
  });
}

/**
 * Digest — numbered briefing on a white page (same as the rest of the library).
 */
export function digestSkin(content: EmailContent, theme: EmailTheme): string {
  const b = content.blocks;
  const page = isDarkTheme(theme) ? theme.darkCanvas : "#ffffff";
  const copy = isDarkTheme(theme) ? theme.darkText : "#111111";
  const muted = isDarkTheme(theme) ? theme.darkMuted : theme.textMuted;
  const line = isDarkTheme(theme) ? theme.darkRule : theme.rule;
  return doc({
    theme,
    preheader: b.preheader,
    canvas: page,
    width: "620px",
    body: `${brandLogoHeaderBlock(content.assets, theme, { background: page, padding: "24px 40px 12px 40px" })}
    <mj-section background-color="${page}" padding="8px 40px 0 40px">
      <mj-column width="60%" vertical-align="middle">
        <mj-text font-size="11px" letter-spacing="0.14em" text-transform="uppercase" color="${muted}" padding="0">Maxpro Infotech</mj-text>
      </mj-column>
      <mj-column width="40%" vertical-align="middle">
        <mj-text align="right" font-size="11px" letter-spacing="0.14em" text-transform="uppercase" color="${muted}" padding="0">${escapeHtml(
          b.eyebrow,
        )}</mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="${page}" padding="18px 40px 0 40px">
      <mj-column>
        <mj-divider border-color="${theme.accent}" border-width="2px" padding="0" />
      </mj-column>
    </mj-section>

    <mj-section background-color="${page}" padding="34px 40px 0 40px">
      <mj-column>
        <mj-text font-size="29px" line-height="1.16" font-weight="700" letter-spacing="-0.02em" color="${copy}" padding="0 0 18px 0">${escapeHtml(
          b.headline,
        )}</mj-text>
        ${b.greeting ? prose([b.greeting], { size: "15px", lineHeight: "1.65", color: copy }) : ""}
        ${prose([b.intro], { size: "16px", lineHeight: "1.7", color: copy })}
        ${prose(b.paragraphs, { size: "15px", lineHeight: "1.7", color: copy })}
      </mj-column>
    </mj-section>

    ${
      b.capabilities.length > 0
        ? `<mj-section background-color="${page}" padding="14px 40px 0 40px">
      <mj-column>
        ${kicker("What it handles", theme.accent, "0 0 4px 0")}
        ${numberedList(b.capabilities, {
          numberColor: theme.accent,
          textColor: copy,
          ruleColor: line,
        })}
      </mj-column>
    </mj-section>`
        : ""
    }

    <mj-section background-color="${page}" padding="30px 40px 8px 40px">
      <mj-column>
        <mj-divider border-color="${line}" border-width="1px" padding="0 0 24px 0" />
        ${b.cta ? `<mj-text font-size="16px" line-height="1.55" font-weight="600" color="${copy}" padding="0 0 18px 0">${escapeHtml(b.cta)}</mj-text>` : ""}
        ${button(b.ctaLabel, theme.accent, theme.onAccent, theme.radius, content.ctaHref)}
      </mj-column>
    </mj-section>

    <mj-section background-color="${page}" padding="24px 40px 0 40px">
      <mj-column>
        <mj-text font-size="13px" line-height="20px" color="${muted}" padding="0">${b.signature
          .map(escapeHtml)
          .join("<br />")}</mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="${page}" padding="28px 40px 40px 40px">
      <mj-column>
        <mj-divider border-color="${line}" border-width="1px" padding="0 0 16px 0" />
        ${footer(b, muted)}
      </mj-column>
    </mj-section>`,
  });
}

/**
 * Invitation — demo and walkthrough requests.
 * Adapted from Colorlib #26: kicker over a large headline, a practical-detail
 * strip, then a single unambiguous action.
 */
export function invitationSkin(content: EmailContent, theme: EmailTheme): string {
  const b = content.blocks;
  const heading = headingColor(theme);
  return doc({
    theme,
    preheader: b.preheader,
    canvas: theme.canvas,
    body: `    <mj-section background-color="${theme.surface}" padding="34px 36px 0 36px">
      <mj-column>
        ${brandLogoImage(content.assets, { width: "168px", padding: "0" })}
      </mj-column>
    </mj-section>

    <mj-section background-color="${theme.surface}" padding="32px 36px 0 36px">
      <mj-column>
        ${kicker(b.eyebrow ? `${b.eyebrow} walkthrough` : "Walkthrough", theme.accent)}
        <mj-text font-size="27px" line-height="1.2" font-weight="700" letter-spacing="-0.02em" color="${heading}" padding="0 0 18px 0">${escapeHtml(
          b.headline,
        )}</mj-text>
        ${b.greeting ? prose([b.greeting], { size: "15px", lineHeight: "1.6", color: theme.text }) : ""}
        ${prose([b.intro, ...b.paragraphs], { size: "15px", lineHeight: "1.68", color: theme.text })}
      </mj-column>
    </mj-section>

    ${
      b.capabilities.length > 0
        ? `<mj-section background-color="${theme.surface}" padding="8px 36px 0 36px">
      <mj-column background-color="${theme.panel}" border-left="3px solid ${theme.accent}" padding="20px 22px">
        ${kicker("What you would see", theme.textMuted, "0 0 12px 0")}
        ${bulletList(b.capabilities.slice(0, 3), theme.text)}
      </mj-column>
    </mj-section>`
        : ""
    }

    <mj-section background-color="${theme.surface}" padding="26px 36px 0 36px">
      <mj-column>
        ${b.cta ? `<mj-text font-size="16px" line-height="1.55" font-weight="600" color="${heading}" padding="0 0 18px 0">${escapeHtml(b.cta)}</mj-text>` : ""}
        ${button(b.ctaLabel, theme.accent, theme.onAccent, theme.radius, content.ctaHref)}
      </mj-column>
    </mj-section>

    <mj-section background-color="${theme.surface}" padding="28px 36px 36px 36px">
      <mj-column>
        <mj-divider border-color="${theme.rule}" border-width="1px" padding="0 0 18px 0" />
        ${signature(b, { nameColor: heading, lineColor: theme.textMuted })}
      </mj-column>
    </mj-section>

    <mj-section background-color="${theme.canvas}" padding="22px 36px 30px 36px">
      <mj-column>
        ${footer(b, theme.textMuted)}
      </mj-column>
    </mj-section>`,
  });
}

/**
 * Steps — "how this would work" explainers.
 * Adapted from Colorlib #21: headline and intro, a numbered sequence, then a
 * single action and a low-key help line.
 */
export function stepsSkin(content: EmailContent, theme: EmailTheme): string {
  const b = content.blocks;
  const heading = headingColor(theme);
  return doc({
    theme,
    preheader: b.preheader,
    canvas: theme.canvas,
    body: `    <mj-section background-color="${theme.surface}" padding="32px 36px 0 36px">
      <mj-column>
        ${brandLogoImage(content.assets, { width: "168px", padding: "0" })}
      </mj-column>
    </mj-section>

    <mj-section background-color="${theme.surface}" padding="30px 36px 0 36px">
      <mj-column>
        <mj-text font-size="25px" line-height="1.2" font-weight="700" letter-spacing="-0.02em" color="${heading}" padding="0 0 16px 0">${escapeHtml(
          b.headline,
        )}</mj-text>
        ${b.greeting ? prose([b.greeting], { size: "15px", lineHeight: "1.6", color: theme.text }) : ""}
        ${prose([b.intro, ...b.paragraphs], { size: "15px", lineHeight: "1.68", color: theme.text })}
      </mj-column>
    </mj-section>

    ${
      b.capabilities.length > 0
        ? `<mj-section background-color="${theme.surface}" padding="10px 36px 0 36px">
      <mj-column>
        <mj-divider border-color="${theme.rule}" border-width="1px" padding="0 0 18px 0" />
        ${kicker(`Inside ${b.eyebrow || "the platform"}`, theme.textMuted, "0 0 4px 0")}
        ${numberedList(b.capabilities, {
          numberColor: theme.accent,
          textColor: theme.text,
          ruleColor: theme.rule,
        })}
      </mj-column>
    </mj-section>`
        : ""
    }

    <mj-section background-color="${theme.surface}" padding="26px 36px 0 36px">
      <mj-column>
        ${b.cta ? `<mj-text font-size="15px" line-height="1.6" color="${theme.text}" padding="0 0 18px 0">${escapeHtml(b.cta)}</mj-text>` : ""}
        ${button(b.ctaLabel, theme.ink, "#ffffff", theme.radius, content.ctaHref)}
      </mj-column>
    </mj-section>

    <mj-section background-color="${theme.surface}" padding="26px 36px 34px 36px">
      <mj-column>
        <mj-divider border-color="${theme.rule}" border-width="1px" padding="0 0 18px 0" />
        ${signature(b, { nameColor: heading, lineColor: theme.textMuted })}
      </mj-column>
    </mj-section>

    <mj-section background-color="${theme.canvas}" padding="22px 36px 30px 36px">
      <mj-column>
        ${footer(b, theme.textMuted)}
      </mj-column>
    </mj-section>`,
  });
}

/**
 * Announcement — product news and re-engagement.
 * Adapted from Colorlib #27: a solid colour band carrying the headline, then
 * quiet body copy and one action underneath.
 */
export function announcementSkin(content: EmailContent, theme: EmailTheme): string {
  const b = content.blocks;
  const heading = headingColor(theme);
  return doc({
    theme,
    preheader: b.preheader,
    canvas: theme.canvas,
    body: `${brandLogoHeaderBlock(content.assets, theme, { background: theme.surface, padding: "22px 36px 14px 36px" })}
    <mj-section background-color="${theme.surface}" padding="0 36px 4px 36px">
      <mj-column>
        <mj-divider border-width="3px" border-color="${theme.accent}" padding="0" />
      </mj-column>
    </mj-section>

    <mj-section background-color="${theme.surface}" padding="28px 36px 8px 36px">
      <mj-column>
        ${kicker(b.eyebrow, theme.accent, "0 0 12px 0")}
        <mj-text font-size="27px" line-height="1.2" font-weight="700" letter-spacing="-0.02em" color="${heading}" padding="0">${escapeHtml(
          b.headline,
        )}</mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="${theme.surface}" padding="34px 36px 0 36px">
      <mj-column>
        ${b.greeting ? prose([b.greeting], { size: "15px", lineHeight: "1.6", color: theme.text }) : ""}
        ${prose([b.intro, ...b.paragraphs], { size: "15px", lineHeight: "1.68", color: theme.text })}
      </mj-column>
    </mj-section>

    ${
      b.outcomes.length > 0
        ? `<mj-section background-color="${theme.surface}" padding="8px 36px 0 36px">
      <mj-column background-color="${theme.panel}" border="1px solid ${theme.rule}" border-radius="${theme.radius}" padding="20px 22px">
        ${kicker("What changes", theme.textMuted, "0 0 12px 0")}
        ${bulletList(b.outcomes, theme.text)}
      </mj-column>
    </mj-section>`
        : ""
    }

    <mj-section background-color="${theme.surface}" padding="24px 36px 0 36px">
      <mj-column>
        ${b.cta ? `<mj-text font-size="15px" line-height="1.6" color="${theme.text}" padding="0 0 18px 0">${escapeHtml(b.cta)}</mj-text>` : ""}
        ${button(b.ctaLabel, theme.accent, theme.onAccent, theme.radius, content.ctaHref)}
      </mj-column>
    </mj-section>

    <mj-section background-color="${theme.surface}" padding="26px 36px 34px 36px">
      <mj-column>
        <mj-divider border-color="${theme.rule}" border-width="1px" padding="0 0 18px 0" />
        ${signature(b, { nameColor: heading, lineColor: theme.textMuted })}
      </mj-column>
    </mj-section>

    <mj-section background-color="${theme.canvas}" padding="22px 36px 30px 36px">
      <mj-column>
        ${footer(b, theme.textMuted)}
      </mj-column>
    </mj-section>`,
  });
}
