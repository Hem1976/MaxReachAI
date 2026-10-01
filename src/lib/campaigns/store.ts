import "server-only";

import { randomUUID } from "node:crypto";

import {
  CAMPAIGN_STATUSES,
  type Campaign,
  type CampaignCreateInput,
  type CampaignListQuery,
  type CampaignStatus,
  type CampaignUpdateInput,
} from "@/lib/campaigns/types";
import { DEFAULT_CAMPAIGN_CC_EMAIL } from "@/lib/campaigns/cc";
import { getDb } from "@/lib/db/client";
import { getProduct } from "@/lib/products";
import { getTemplate } from "@/lib/templates/catalog.server";
import { parseTemplateSlots, serializeTemplateSlots } from "@/lib/templates/slots";

interface CampaignRow {
  id: string;
  name: string;
  status: string;
  template_id: string;
  theme_id: string;
  product_id: string;
  subject: string;
  body: string;
  cta: string;
  slots?: string;
  html_draft?: string;
  sender_name: string;
  sender_email: string;
  cc_enabled?: number;
  cc_email?: string;
  created_at: string;
  updated_at: string;
}

export class CampaignError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CampaignError";
  }
}

function isStatus(value: string): value is CampaignStatus {
  return (CAMPAIGN_STATUSES as readonly string[]).includes(value);
}

function toCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    status: isStatus(row.status) ? row.status : "draft",
    templateId: row.template_id,
    themeId: row.theme_id,
    productId: row.product_id,
    subject: row.subject,
    body: row.body,
    cta: row.cta,
    slots: parseTemplateSlots(row.slots),
    htmlDraft: row.html_draft ?? "",
    senderName: row.sender_name,
    senderEmail: row.sender_email,
    ccEnabled: Boolean(row.cc_enabled),
    ccEmail: row.cc_email?.trim() || DEFAULT_CAMPAIGN_CC_EMAIL,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new CampaignError("Campaign name is required.");
  if (trimmed.length > 160) throw new CampaignError("Campaign name is too long.");
  return trimmed;
}

function assertStatus(status: string): CampaignStatus {
  if (!isStatus(status)) throw new CampaignError("Invalid campaign status.");
  return status;
}

function assertTemplateId(id: string): string {
  if (!id) return "";
  if (!getTemplate(id)) throw new CampaignError("Unknown email template.");
  return id;
}

function assertProductId(id: string): string {
  if (!id) return "";
  if (!getProduct(id)) throw new CampaignError("Unknown Maxpro product.");
  return id;
}

export function listCampaigns(query: CampaignListQuery = {}): Campaign[] {
  const q = query.q?.trim().toLowerCase() ?? "";
  const status = query.status?.trim() ?? "";
  if (status && !isStatus(status)) throw new CampaignError("Invalid campaign status.");

  const rows = getDb()
    .prepare<[string, string, string, string], CampaignRow>(
      `SELECT * FROM campaigns
        WHERE (? = '' OR lower(name) LIKE ?)
          AND (? = '' OR status = ?)
        ORDER BY updated_at DESC, name ASC`,
    )
    .all(q, `%${q}%`, status, status);

  return rows.map(toCampaign);
}

export function getCampaign(id: string): Campaign | undefined {
  const row = getDb()
    .prepare<[string], CampaignRow>("SELECT * FROM campaigns WHERE id = ?")
    .get(id);
  return row ? toCampaign(row) : undefined;
}

export function createCampaign(input: CampaignCreateInput): Campaign {
  const now = new Date().toISOString();
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO campaigns (
         id, name, status, template_id, theme_id, product_id,
         subject, body, cta, sender_name, sender_email, cc_enabled, cc_email, created_at, updated_at
       ) VALUES (?, ?, 'draft', ?, ?, ?, '', '', '', ?, ?, 0, ?, ?, ?)`,
    )
    .run(
      id,
      assertName(input.name),
      assertTemplateId(input.templateId?.trim() ?? ""),
      input.themeId?.trim() ?? "",
      assertProductId(input.productId?.trim() ?? ""),
      input.senderName?.trim() ?? "",
      input.senderEmail?.trim() ?? "",
      DEFAULT_CAMPAIGN_CC_EMAIL,
      now,
      now,
    );
  return getCampaign(id)!;
}

export function setCampaignStatus(id: string, status: CampaignStatus): Campaign {
  const existing = getCampaign(id);
  if (!existing) throw new CampaignError("Campaign not found.");
  if (status === "sending" || status === "completed" || status === "failed") {
    throw new CampaignError("Use the campaign send queue to change that status.");
  }
  writeCampaignStatus(id, status);
  return getCampaign(id)!;
}

/** Queue/lifecycle transitions. Not available through the generic PATCH API. */
export function writeCampaignStatus(id: string, status: CampaignStatus): Campaign {
  if (!getCampaign(id)) throw new CampaignError("Campaign not found.");
  getDb()
    .prepare("UPDATE campaigns SET status = ?, updated_at = ? WHERE id = ?")
    .run(status, new Date().toISOString(), id);
  return getCampaign(id)!;
}

export function assertCampaignNotSending(id: string): void {
  const existing = getCampaign(id);
  if (!existing) throw new CampaignError("Campaign not found.");
  if (existing.status === "sending") {
    throw new CampaignError("Pause the campaign before changing send content or recipients.");
  }
}

export function revertCampaignToDraftIfReady(id: string): boolean {
  const existing = getCampaign(id);
  if (!existing || existing.status !== "ready") return false;
  setCampaignStatus(id, "draft");
  return true;
}

export function revertCampaignOnSendContentChange(id: string): boolean {
  const existing = getCampaign(id);
  if (!existing || (existing.status !== "ready" && existing.status !== "completed")) {
    return false;
  }
  setCampaignStatus(id, "draft");
  return true;
}

export function updateCampaign(id: string, patch: CampaignUpdateInput): Campaign {
  const existing = getCampaign(id);
  if (!existing) throw new CampaignError("Campaign not found.");
  assertCampaignNotSending(id);

  if (
    patch.status === "ready" ||
    patch.status === "sending" ||
    patch.status === "completed" ||
    patch.status === "failed"
  ) {
    throw new CampaignError("Mark this campaign ready from Campaign Review.");
  }

  const next = {
    name: patch.name !== undefined ? assertName(patch.name) : existing.name,
    status: patch.status !== undefined ? assertStatus(patch.status) : existing.status,
    templateId:
      patch.templateId !== undefined
        ? assertTemplateId(patch.templateId.trim())
        : existing.templateId,
    themeId: patch.themeId !== undefined ? patch.themeId.trim() : existing.themeId,
    productId:
      patch.productId !== undefined
        ? assertProductId(patch.productId.trim())
        : existing.productId,
    subject: patch.subject !== undefined ? patch.subject : existing.subject,
    body: patch.body !== undefined ? patch.body : existing.body,
    cta: patch.cta !== undefined ? patch.cta : existing.cta,
    slots: patch.slots !== undefined ? parseTemplateSlots(JSON.stringify(patch.slots)) : existing.slots,
    htmlDraft: patch.htmlDraft !== undefined ? patch.htmlDraft : existing.htmlDraft,
    senderName:
      patch.senderName !== undefined ? patch.senderName.trim() : existing.senderName,
    senderEmail:
      patch.senderEmail !== undefined ? patch.senderEmail.trim() : existing.senderEmail,
    ccEnabled: patch.ccEnabled !== undefined ? patch.ccEnabled : existing.ccEnabled,
    ccEmail:
      patch.ccEmail !== undefined
        ? patch.ccEmail.trim() || DEFAULT_CAMPAIGN_CC_EMAIL
        : existing.ccEmail,
  };

  const sendCriticalChanged =
    next.name !== existing.name ||
    next.templateId !== existing.templateId ||
    next.productId !== existing.productId ||
    next.subject !== existing.subject ||
    next.body !== existing.body ||
    next.cta !== existing.cta ||
    serializeTemplateSlots(next.slots) !== serializeTemplateSlots(existing.slots) ||
    next.htmlDraft !== existing.htmlDraft ||
    next.senderName !== existing.senderName ||
    next.senderEmail !== existing.senderEmail ||
    next.ccEnabled !== existing.ccEnabled ||
    next.ccEmail !== existing.ccEmail;

  if (
    (existing.status === "ready" || existing.status === "completed") &&
    sendCriticalChanged &&
    patch.status !== "paused"
  ) {
    next.status = "draft";
  }

  getDb()
    .prepare(
      `UPDATE campaigns
          SET name = ?, status = ?, template_id = ?, theme_id = ?, product_id = ?,
              subject = ?, body = ?, cta = ?, slots = ?, html_draft = ?, sender_name = ?, sender_email = ?,
              cc_enabled = ?, cc_email = ?,
              updated_at = ?
        WHERE id = ?`,
    )
    .run(
      next.name,
      next.status,
      next.templateId,
      next.themeId,
      next.productId,
      next.subject,
      next.body,
      next.cta,
      serializeTemplateSlots(next.slots),
      next.htmlDraft,
      next.senderName,
      next.senderEmail,
      next.ccEnabled ? 1 : 0,
      next.ccEmail,
      new Date().toISOString(),
      id,
    );

  return getCampaign(id)!;
}

export function deleteCampaign(id: string): boolean {
  const db = getDb();
  const run = db.transaction(() => {
    db.prepare("DELETE FROM campaign_recipients WHERE campaign_id = ?").run(id);
    return db.prepare("DELETE FROM campaigns WHERE id = ?").run(id).changes > 0;
  });
  return run();
}
