import "server-only";

import mjml2html from "mjml";

import { buildCodedMailsMjml } from "@/lib/templates/codedmails/inject";
import { fillHtmlTemplate } from "@/lib/templates/html/inject";
import { buildMjml } from "@/lib/templates/skins";
import { type EmailTheme, getTheme } from "@/lib/templates/themes";
import type { EmailContent, EmailTemplate } from "@/lib/templates/types";
import type { TemplateSlots } from "@/lib/templates/slots";

export interface RenderedEmail {
  mjml: string;
  html: string;
  warnings: string[];
  slots?: Record<string, string>;
}

/**
 * MJML 5 is asynchronous, unlike the v4 typings that ship on DefinitelyTyped,
 * so the result is awaited here and the module is declared locally in
 * `src/types/mjml.d.ts`.
 */
export async function renderTemplate(
  template: EmailTemplate,
  content: EmailContent,
  theme: EmailTheme = getTheme(undefined),
  options?: { slots?: TemplateSlots; editable?: boolean },
): Promise<RenderedEmail> {
  if (template.skin === "html") {
    const filled = fillHtmlTemplate(template, content, options);
    return {
      mjml: "",
      html: filled.html,
      warnings: [],
      slots: filled.slots,
    };
  }

  const mjml =
    template.skin === "codedmails"
      ? buildCodedMailsMjml(template, content, theme)
      : buildMjml(template, content, theme);
  const result = await mjml2html(mjml, {
    validationLevel: "soft",
    keepComments: false,
  });

  const html = injectSubject(result.html, content.subject);

  return {
    mjml,
    html,
    warnings: (result.errors ?? []).map((error) => error.formattedMessage),
  };
}

/** MJML has no subject element, so the <title> is set after rendering. */
function injectSubject(html: string, subject: string): string {
  if (!subject) return html;
  const escaped = subject
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return html.replace("<title></title>", `<title>${escaped}</title>`);
}
