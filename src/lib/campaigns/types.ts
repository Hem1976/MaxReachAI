import type { TemplateSlots } from "@/lib/templates/slots";

export const CAMPAIGN_STATUSES = [
  "draft",
  "ready",
  "sending",
  "paused",
  "completed",
  "failed",
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

/** Statuses the campaign detail UI may set by hand. Ready is review-only. */
export const CAMPAIGN_UI_STATUSES = ["draft", "paused"] as const;

export type CampaignUiStatus = (typeof CAMPAIGN_UI_STATUSES)[number];

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  templateId: string;
  themeId: string;
  productId: string;
  subject: string;
  body: string;
  cta: string;
  slots: TemplateSlots;
  htmlDraft: string;
  senderName: string;
  senderEmail: string;
  ccEnabled: boolean;
  ccEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignCreateInput {
  name: string;
  templateId?: string;
  productId?: string;
  senderName?: string;
  senderEmail?: string;
  themeId?: string;
}

export interface CampaignUpdateInput {
  name?: string;
  status?: CampaignStatus;
  templateId?: string;
  themeId?: string;
  productId?: string;
  subject?: string;
  body?: string;
  cta?: string;
  slots?: TemplateSlots;
  htmlDraft?: string;
  senderName?: string;
  senderEmail?: string;
  ccEnabled?: boolean;
  ccEmail?: string;
}

export interface CampaignListQuery {
  q?: string;
  status?: CampaignStatus;
}

export const CAMPAIGN_RECIPIENT_STATUSES = [
  "queued",
  "sending",
  "sent",
  "failed",
  "bounced",
  "skipped",
] as const;

export type CampaignRecipientStatus = (typeof CAMPAIGN_RECIPIENT_STATUSES)[number];

export interface CampaignRecipient {
  id: string;
  campaignId: string;
  contactId: string;
  status: CampaignRecipientStatus;
  error: string;
  providerMessageId: string;
  sentAt: string;
  createdAt: string;
  updatedAt: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  companyId: string;
  companyName: string;
  companyWebsite: string;
  industry: string;
  subject: string;
}

export interface CampaignValidationIssue {
  code: string;
  message: string;
  field?: string;
}

export interface CampaignValidation {
  ready: boolean;
  errors: CampaignValidationIssue[];
  warnings: CampaignValidationIssue[];
  recipientCount: number;
  invalidRecipientCount: number;
  unknownVariables: string[];
}

export interface AddRecipientsResult {
  added: number;
  skipped: number;
  skippedNoEmail: number;
  skippedDuplicate: number;
  skippedMissing: number;
  total: number;
}
