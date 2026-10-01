import "server-only";

import { resolveAssetUrl } from "@/lib/email-assets";
import {
  ensureExternalLinkTargets,
  optimizeEmailHtmlForDelivery,
} from "@/lib/campaigns/html-utils";
import { replaceVariables, type VariableMap } from "@/lib/campaigns/variables";
import { repairCtaMailtoLinks } from "@/lib/templates/text";
import { ensureResponsiveEmailHtml } from "@/lib/templates/html/responsive";
import { flattenFreeLayer, stripEditorChrome } from "@/lib/templates/html/visual-editor";

export function prepareCampaignHtml(
  html: string,
  values: VariableMap,
  mailto?: { senderEmail: string; subject: string; ctaLabel: string; cta?: string },
): string {
  let out = stripEditorChrome(html);
  out = flattenFreeLayer(out);
  out = optimizeEmailHtmlForDelivery(out);
  out = replaceVariables(out, values);
  if (mailto) {
    out = repairCtaMailtoLinks(out, mailto);
  }
  // Only rewrite hosted email asset paths — never turn /campaigns-style links into app URLs.
  out = out.replace(
    /\b(src|href)="(\/email-assets\/[^"]+)"/g,
    (match, attr: string, path: string) => `${attr}="${resolveAssetUrl(path)}"`,
  );
  out = ensureExternalLinkTargets(out);
  if (!/<\/head>/i.test(out) && !/<style[\s>]/i.test(out)) {
    out = ensureResponsiveEmailHtml(out);
  }
  return out;
}
