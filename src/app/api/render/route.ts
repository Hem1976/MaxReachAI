import { RenderRequestSchema } from "@/lib/ai/schemas";
import { jsonError, jsonOk } from "@/lib/api";
import { readSettings } from "@/lib/db/settings";
import { findProductMention, getProduct, resolveProductName } from "@/lib/products";
import { DEFAULT_CAMPAIGN_SENDER } from "@/lib/templates/sender-defaults";
import { buildEmailContent } from "@/lib/templates";
import { getTemplate } from "@/lib/templates/catalog.server";
import { renderTemplate } from "@/lib/templates/render";
import { parseTemplateSlots } from "@/lib/templates/slots";
import { getTheme } from "@/lib/templates/themes";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = RenderRequestSchema.parse(await request.json());
    const template = getTemplate(input.templateId);

    if (!template) {
      return Response.json(
        { error: `Unknown template: ${input.templateId}` },
        { status: 404 },
      );
    }

    const settings = readSettings();
    const senderSettings = {
      senderName: input.senderName?.trim() || settings.senderName,
      senderTitle: settings.senderTitle,
      senderEmail: input.senderEmail?.trim() || settings.senderEmail,
      senderPhone: settings.senderPhone,
      companyName: input.senderCompany?.trim() || settings.companyName,
    };

    // Sample mode powers the template library preview, where no generated copy
    // exists yet. Each sample names its own product, so the preview's grounded
    // lists follow the copy rather than a fixed default.
    const sampleProduct =
      findProductMention(template.sample.body) ?? getProduct("rockey");

    const content = input.sample
      ? buildEmailContent({
          subject: template.sample.subject,
          body: template.sample.body,
          cta: template.sample.cta,
          ctaLabel: template.sample.ctaLabel,
          company: "Northline Distribution",
          contactName: "Anita Rao",
          productName: sampleProduct?.name ?? "Rockey",
          product: sampleProduct,
          template,
          settings: {
            senderName: senderSettings.senderName || DEFAULT_CAMPAIGN_SENDER.senderName,
            senderTitle: senderSettings.senderTitle || DEFAULT_CAMPAIGN_SENDER.senderTitle,
            senderEmail:
              senderSettings.senderEmail || DEFAULT_CAMPAIGN_SENDER.senderEmail,
            senderPhone: senderSettings.senderPhone || DEFAULT_CAMPAIGN_SENDER.senderPhone,
            companyName: senderSettings.companyName || DEFAULT_CAMPAIGN_SENDER.companyName,
          },
        })
      : buildEmailContent({
          subject: input.subject,
          body: input.email,
          cta: input.cta,
          ctaLabel: input.slots?.CTA_LABEL || template.sample.ctaLabel,
          company: input.company,
          contactName: input.contactName,
          productName: input.productName,
          product:
            getProduct(input.productId) ?? resolveProductName(input.productName),
          template,
          settings: senderSettings,
        });

    const theme = getTheme(input.themeId || settings.themeId);
    const rendered = await renderTemplate(template, content, theme, {
      slots: parseTemplateSlots(JSON.stringify(input.slots ?? {})),
      editable: input.editable,
    });

    return jsonOk({
      html: rendered.html,
      mjml: rendered.mjml,
      warnings: rendered.warnings,
      slots: rendered.slots ?? {},
      templateId: template.id,
      templateName: template.name,
      themeId: theme.id,
      themeName: theme.name,
    });
  } catch (error) {
    return jsonError(error);
  }
}
