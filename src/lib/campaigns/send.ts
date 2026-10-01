import "server-only";

import { hasDeliverableEmail, looksLikeEmail, parseEmailAddresses } from "@/lib/campaigns/email";
import { productImagePath } from "@/lib/email-assets";
import { getProduct } from "@/lib/products";
import {
  beginRecipientSend,
  completeRecipientSend,
  failRecipientSend,
  getRecipient,
  noteRecipientSendWarning,
} from "@/lib/campaigns/recipients";
import { getCampaign } from "@/lib/campaigns/store";
import type { Campaign, CampaignRecipient } from "@/lib/campaigns/types";
import { validateCampaignRecord } from "@/lib/campaigns/validation";
import {
  campaignVariableValues,
  findUnknownVariables,
  replaceVariables,
} from "@/lib/campaigns/variables";
import { readSettings } from "@/lib/db/settings";
import { resolveMailConfig } from "@/lib/mail/env";
import { getMailProvider } from "@/lib/mail/provider";
import { authoredPlainText, htmlToPlainText } from "@/lib/mail/text";
import { CampaignSendError, MailConfigError, MailSendError } from "@/lib/mail/types";
import { loadCampaignAttachmentPayloads } from "@/lib/campaigns/attachments";
import { resolveCampaignCc } from "@/lib/campaigns/cc";
import { prepareCampaignHtml } from "@/lib/campaigns/html";
import { buildEmailContent } from "@/lib/templates";
import { getTemplate } from "@/lib/templates/catalog.server";
import { renderTemplate } from "@/lib/templates/render";
import { getTheme } from "@/lib/templates/themes";
import { isTemplateSlotKey, slotValuesForVariables, type TemplateSlots } from "@/lib/templates/slots";

function formatFrom(name: string, email: string): string {
  const safeName = name.replace(/[\r\n<>]/g, "").trim();
  const safeEmail = email.trim();
  if (/[",]/.test(safeName)) {
    return `"${safeName.replace(/"/g, '\\"')}" <${safeEmail}>`;
  }
  return `${safeName} <${safeEmail}>`;
}

function assertReadyToSend(
  campaign: Campaign,
  recipient: CampaignRecipient,
  allowedStatuses: Campaign["status"][],
): void {
  if (!allowedStatuses.includes(campaign.status)) {
    throw new CampaignSendError("Campaign is not ready.", 409, "not_ready");
  }
  const validation = validateCampaignRecord(campaign);
  if (!validation.ready) {
    throw new CampaignSendError(
      validation.errors[0]?.message ?? "Campaign is not ready.",
      422,
      "not_ready",
    );
  }
  if (!hasDeliverableEmail(recipient.email)) {
    throw new CampaignSendError("Recipient email is not valid.", 422, "invalid_email");
  }
  if (
    findUnknownVariables(
      campaign.subject,
      recipient.subject,
      campaign.body,
      campaign.cta,
      ...slotValuesForVariables(campaign.slots),
    ).length > 0
  ) {
    throw new CampaignSendError("Campaign contains unknown variables.", 422, "unknown_variable");
  }
  const template = getTemplate(campaign.templateId);
  if (!template) {
    throw new CampaignSendError("The selected template no longer exists.", 422);
  }
  if (campaign.productId && !getProduct(campaign.productId)) {
    throw new CampaignSendError("The selected product no longer exists.", 422);
  }
}

export async function sendCampaignRecipient(
  campaignId: string,
  contactId: string,
  options?: { allowCampaignStatuses?: Campaign["status"][] },
): Promise<{ recipient: CampaignRecipient }> {
  const campaign = getCampaign(campaignId);
  if (!campaign) throw new CampaignSendError("Campaign not found.", 404);

  const recipient = getRecipient(campaignId, contactId);
  if (!recipient) throw new CampaignSendError("Recipient not found.", 404);

  const allowed = options?.allowCampaignStatuses ?? ["ready"];
  assertReadyToSend(campaign, recipient, allowed);

  if (recipient.status === "sent") {
    throw new CampaignSendError("Recipient has already been sent.", 409, "already_sent");
  }

  const settings = readSettings();
  const product = campaign.productId ? getProduct(campaign.productId) : undefined;
  const template = getTemplate(campaign.templateId)!;
  const senderCompany = settings.companyName || "Maxpro Infotech";
  const values = campaignVariableValues({
    recipient: {
      first_name: recipient.firstName,
      last_name: recipient.lastName,
      full_name: `${recipient.firstName} ${recipient.lastName}`.trim(),
      email: recipient.email,
      job_title: recipient.jobTitle,
      company: recipient.companyName,
      website: recipient.companyWebsite,
      industry: recipient.industry,
    },
    productName: product?.name ?? "",
    productDescription: product?.tagline ?? product?.description ?? "",
    productImage: product ? productImagePath(product.id) : "",
    senderName: campaign.senderName,
    senderEmail: campaign.senderEmail,
    senderCompany,
  });

  const subjectTemplate = recipient.subject.trim() || campaign.subject;
  const subject = replaceVariables(subjectTemplate, values);
  const body = replaceVariables(campaign.body, values);
  const cta = replaceVariables(campaign.cta, values);
  const slots: TemplateSlots = {};
  for (const [key, value] of Object.entries(campaign.slots ?? {})) {
    if (!isTemplateSlotKey(key) || typeof value !== "string") continue;
    slots[key] = replaceVariables(value, values);
  }

  const content = buildEmailContent({
    subject,
    body,
    cta,
    ctaLabel: slots.CTA_LABEL || template.sample.ctaLabel,
    company: values.company ?? recipient.companyName,
    contactName: values.full_name || `${recipient.firstName} ${recipient.lastName}`.trim(),
    productName: product?.name ?? "",
    product,
    template,
    settings: {
      senderName: campaign.senderName,
      senderTitle: settings.senderTitle,
      senderEmail: campaign.senderEmail,
      senderPhone: settings.senderPhone,
      companyName: senderCompany,
    },
  });

  let html = "";
  const ctaLabel = slots.CTA_LABEL || template.sample.ctaLabel || "Explore the idea";
  const mailtoOpts = {
    senderEmail: campaign.senderEmail,
    subject,
    ctaLabel,
    cta,
  };
  if (campaign.htmlDraft.trim()) {
    html = prepareCampaignHtml(campaign.htmlDraft, values, mailtoOpts);
  } else {
    const rendered = await renderTemplate(
      template,
      content,
      getTheme(campaign.themeId || settings.themeId),
      { slots, editable: false },
    );
    html = rendered.html;
    html = prepareCampaignHtml(html, values, mailtoOpts);
  }
  const text = htmlToPlainText(html) || authoredPlainText({ subject, body, cta });

  const mail = resolveMailConfig(settings);
  const fromEmail = mail.fromEmail || campaign.senderEmail;
  const fromName = mail.fromName || campaign.senderName;
  const from = formatFrom(fromName, fromEmail);
  const replyTo =
    looksLikeEmail(campaign.senderEmail) && campaign.senderEmail.trim() !== fromEmail
      ? campaign.senderEmail.trim()
      : undefined;

  let provider;
  try {
    provider = getMailProvider();
  } catch (error) {
    if (error instanceof MailConfigError) {
      throw new CampaignSendError(error.message, 503, "provider_not_configured");
    }
    throw error;
  }

  const destinationEmails = parseEmailAddresses(recipient.email);
  if (destinationEmails.length === 0) {
    throw new CampaignSendError("Recipient email is not valid.", 422, "invalid_email");
  }

  beginRecipientSend(campaignId, contactId);

  const attachments = loadCampaignAttachmentPayloads(campaignId);
  const cc = resolveCampaignCc(campaign.ccEnabled, campaign.ccEmail);
  const failures: string[] = [];
  let lastMessageId = "";

  for (const to of destinationEmails) {
    try {
      const result = await provider.send({
        to,
        from,
        replyTo,
        cc,
        subject,
        html,
        text,
        attachments,
      });
      lastMessageId = result.id;
    } catch (error) {
      const message =
        error instanceof MailSendError ? error.message : "The email provider rejected this send.";
      failures.push(`${to}: ${message}`);
    }
  }

  if (failures.length === destinationEmails.length) {
    const message = failures.join("; ");
    failRecipientSend(campaignId, contactId, message);
    throw new CampaignSendError(message, 502, "provider_failed");
  }

  const sent = completeRecipientSend(campaignId, contactId, lastMessageId);
  if (failures.length > 0) {
    return {
      recipient: noteRecipientSendWarning(
        campaignId,
        contactId,
        `Sent to ${destinationEmails.length - failures.length} of ${destinationEmails.length}. ${failures.join("; ")}`,
      ),
    };
  }

  return { recipient: sent };
}
