import "server-only";

import { looksLikeEmail } from "@/lib/campaigns/email";
import { isLikelyGmailClipped, optimizeEmailHtmlForDelivery } from "@/lib/campaigns/html-utils";
import { CampaignError, getCampaign, setCampaignStatus } from "@/lib/campaigns/store";
import { inspectRecipients } from "@/lib/campaigns/recipients";
import type { Campaign, CampaignValidation, CampaignValidationIssue } from "@/lib/campaigns/types";
import { findUnknownVariables } from "@/lib/campaigns/variables";
import { getProduct } from "@/lib/products";
import { getTemplate } from "@/lib/templates/catalog.server";
import { composeBodyFromSlots, slotValuesForVariables } from "@/lib/templates/slots";
import { stripEditorChrome } from "@/lib/templates/html/visual-editor";
import { htmlToPlainText } from "@/lib/mail/text";

export class CampaignValidationError extends Error {
  constructor(public result: CampaignValidation) {
    super("Campaign is not ready.");
    this.name = "CampaignValidationError";
  }
}

function templateRequiresProduct(templateId: string): boolean {
  const template = getTemplate(templateId);
  return template?.imageSettings?.imageMode === "product";
}

export function campaignTemplateRequiresProduct(templateId: string): boolean {
  return templateRequiresProduct(templateId);
}

export function validateCampaign(campaignId: string): CampaignValidation {
  const campaign = getCampaign(campaignId);
  if (!campaign) throw new CampaignError("Campaign not found.");
  return validateCampaignRecord(campaign);
}

export function validateCampaignRecord(campaign: Campaign): CampaignValidation {
  const errors: CampaignValidationIssue[] = [];
  const warnings: CampaignValidationIssue[] = [];
  const recipients = inspectRecipients(campaign.id);
  const unknownVariables = findUnknownVariables(
    campaign.subject,
    campaign.body,
    campaign.cta,
    ...slotValuesForVariables(campaign.slots),
  );

  if (!campaign.name.trim()) {
    errors.push({
      code: "name_required",
      field: "name",
      message: "Add a campaign name.",
    });
  }

  if (!campaign.senderName.trim()) {
    errors.push({
      code: "sender_name_required",
      field: "senderName",
      message: "Add sender name.",
    });
  }

  if (!campaign.senderEmail.trim()) {
    errors.push({
      code: "sender_email_required",
      field: "senderEmail",
      message: "Add sender email.",
    });
  } else if (!looksLikeEmail(campaign.senderEmail)) {
    errors.push({
      code: "sender_email_invalid",
      field: "senderEmail",
      message: "Sender email does not look valid.",
    });
  }

  if (!campaign.subject.trim()) {
    errors.push({
      code: "subject_required",
      field: "subject",
      message: "Add a subject.",
    });
  }

  const draftText = htmlToPlainText(stripEditorChrome(campaign.htmlDraft || ""));
  if (!campaign.body.trim() && !composeBodyFromSlots(campaign.slots) && !draftText) {
    errors.push({
      code: "body_required",
      field: "body",
      message: "Add email content.",
    });
  }

  if (!campaign.templateId.trim()) {
    errors.push({
      code: "template_required",
      field: "templateId",
      message: "Select a template.",
    });
  } else if (!getTemplate(campaign.templateId)) {
    errors.push({
      code: "template_missing",
      field: "templateId",
      message: "The selected template no longer exists. Choose another template.",
    });
  }

  if (campaign.productId.trim() && !getProduct(campaign.productId)) {
    errors.push({
      code: "product_missing",
      field: "productId",
      message: "The selected product no longer exists. Choose another product or none.",
    });
  }

  if (
    campaign.templateId.trim() &&
    getTemplate(campaign.templateId) &&
    templateRequiresProduct(campaign.templateId) &&
    !campaign.productId.trim()
  ) {
    warnings.push({
      code: "product_empty",
      field: "productId",
      message: "No product selected. Product images and names may be omitted in the email.",
    });
  }

  if (recipients.total === 0) {
    errors.push({
      code: "recipients_required",
      field: "recipients",
      message: "Add at least one recipient.",
    });
  } else if (recipients.invalid > 0) {
    errors.push({
      code: "recipients_invalid",
      field: "recipients",
      message: `${recipients.invalid} recipient${recipients.invalid === 1 ? "" : "s"} cannot be sent because they have no valid email.`,
    });
  }

  for (const name of unknownVariables) {
    errors.push({
      code: "unknown_variable",
      field: "variables",
      message: `Resolve unknown variable {{${name}}}.`,
    });
  }

  if (!campaign.cta.trim()) {
    warnings.push({
      code: "cta_empty",
      field: "cta",
      message: "CTA is empty. Templates can still render without one.",
    });
  }

  const draftHtml = campaign.htmlDraft.trim();
  if (draftHtml && isLikelyGmailClipped(optimizeEmailHtmlForDelivery(draftHtml))) {
    warnings.push({
      code: "html_too_large",
      field: "htmlDraft",
      message:
        "Email HTML is over Gmail’s ~102KB limit and may appear blank. Upload your .html file directly or remove embedded images from the visual editor.",
    });
  }

  return {
    ready: errors.length === 0,
    errors,
    warnings,
    recipientCount: recipients.total,
    invalidRecipientCount: recipients.invalid,
    unknownVariables,
  };
}

export function markCampaignReady(campaignId: string): {
  campaign: Campaign;
  validation: CampaignValidation;
} {
  const validation = validateCampaign(campaignId);
  if (!validation.ready) throw new CampaignValidationError(validation);
  const campaign = setCampaignStatus(campaignId, "ready");
  return { campaign, validation: validateCampaignRecord(campaign) };
}
