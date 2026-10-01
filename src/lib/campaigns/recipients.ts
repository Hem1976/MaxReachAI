import "server-only";

import { randomUUID } from "node:crypto";

import {
  CAMPAIGN_RECIPIENT_STATUSES,
  type AddRecipientsResult,
  type CampaignRecipient,
  type CampaignRecipientStatus,
} from "@/lib/campaigns/types";
import { expandContactEmails } from "@/lib/crm/contacts";
import { hasDeliverableEmail } from "@/lib/campaigns/email";
import { CampaignError, getCampaign, revertCampaignToDraftIfReady, assertCampaignNotSending } from "@/lib/campaigns/store";
import { CampaignSendError } from "@/lib/mail/types";
import { getContactList, getListContactIds } from "@/lib/crm/lists";
import { getDb } from "@/lib/db/client";

interface RecipientRow {
  id: string;
  campaign_id: string;
  contact_id: string;
  status: string;
  error: string;
  provider_message_id: string;
  sent_at: string;
  created_at: string;
  updated_at: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string;
  company_id: string;
  company_name: string;
  company_website: string;
  industry: string;
  subject: string;
}

interface ContactLookupRow {
  id: string;
  email: string;
}

function isStatus(value: string): value is CampaignRecipientStatus {
  return (CAMPAIGN_RECIPIENT_STATUSES as readonly string[]).includes(value);
}

function toRecipient(row: RecipientRow): CampaignRecipient {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    contactId: row.contact_id,
    status: isStatus(row.status) ? row.status : "queued",
    error: row.error,
    providerMessageId: row.provider_message_id,
    sentAt: row.sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    jobTitle: row.job_title,
    companyId: row.company_id,
    companyName: row.company_name,
    companyWebsite: row.company_website,
    industry: row.industry,
    subject: row.subject ?? "",
  };
}

function requireCampaign(campaignId: string): void {
  if (!getCampaign(campaignId)) throw new CampaignError("Campaign not found.");
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function listRecipients(campaignId: string): CampaignRecipient[] {
  requireCampaign(campaignId);
  return getDb()
    .prepare<[string], RecipientRow>(
      `SELECT
         r.id, r.campaign_id, r.contact_id, r.status, r.error,
         r.provider_message_id, r.sent_at, r.created_at, r.updated_at,
         ct.first_name, ct.last_name, ct.email, ct.job_title, ct.subject, ct.company_id,
         co.name AS company_name, co.website AS company_website, co.industry
       FROM campaign_recipients r
       JOIN contacts ct ON ct.id = r.contact_id
       JOIN companies co ON co.id = ct.company_id
       WHERE r.campaign_id = ?
       ORDER BY co.name ASC, ct.last_name ASC, ct.first_name ASC`,
    )
    .all(campaignId)
    .map(toRecipient);
}

export function getRecipientCount(campaignId: string): number {
  requireCampaign(campaignId);
  const row = getDb()
    .prepare<[string], { n: number }>(
      "SELECT COUNT(*) AS n FROM campaign_recipients WHERE campaign_id = ?",
    )
    .get(campaignId);
  return row?.n ?? 0;
}

export function addRecipients(
  campaignId: string,
  contactIds: string[],
): AddRecipientsResult {
  requireCampaign(campaignId);
  assertCampaignNotSending(campaignId);

  const requested = [...new Set(contactIds.map((id) => id.trim()).filter(Boolean))];
  const unique: string[] = [];
  const result: AddRecipientsResult = {
    added: 0,
    skipped: 0,
    skippedNoEmail: 0,
    skippedDuplicate: 0,
    skippedMissing: 0,
    total: getRecipientCount(campaignId),
  };

  if (requested.length === 0) return result;

  const db = getDb();
  const contacts = new Map<string, ContactLookupRow>();
  for (const ids of chunk(requested, 400)) {
    const placeholders = ids.map(() => "?").join(",");
    const rows = db
      .prepare<string[], ContactLookupRow>(
        `SELECT id, email FROM contacts WHERE id IN (${placeholders})`,
      )
      .all(...ids);
    for (const row of rows) contacts.set(row.id, row);
  }

  for (const id of requested) {
    const contact = contacts.get(id);
    if (!contact) {
      result.skippedMissing += 1;
      continue;
    }
    if (!hasDeliverableEmail(contact.email)) {
      result.skippedNoEmail += 1;
      continue;
    }
    unique.push(...expandContactEmails(id));
  }

  const uniqueExpanded = [...new Set(unique)];
  if (uniqueExpanded.length === 0) {
    result.skipped =
      result.skippedNoEmail + result.skippedDuplicate + result.skippedMissing;
    return result;
  }

  for (const ids of chunk(uniqueExpanded, 400)) {
    const placeholders = ids.map(() => "?").join(",");
    const rows = db
      .prepare<string[], ContactLookupRow>(
        `SELECT id, email FROM contacts WHERE id IN (${placeholders})`,
      )
      .all(...ids);
    for (const row of rows) contacts.set(row.id, row);
  }

  const existing = new Set<string>();
  for (const ids of chunk(uniqueExpanded, 400)) {
    const placeholders = ids.map(() => "?").join(",");
    const rows = db
      .prepare<string[], { contact_id: string }>(
        `SELECT contact_id FROM campaign_recipients
          WHERE campaign_id = ? AND contact_id IN (${placeholders})`,
      )
      .all(campaignId, ...ids);
    for (const row of rows) existing.add(row.contact_id);
  }

  const now = new Date().toISOString();
  const toInsert: string[] = [];

  for (const id of uniqueExpanded) {
    const contact = contacts.get(id);
    if (!contact) {
      result.skippedMissing += 1;
      continue;
    }
    if (!hasDeliverableEmail(contact.email)) {
      result.skippedNoEmail += 1;
      continue;
    }
    if (existing.has(id)) {
      result.skippedDuplicate += 1;
      continue;
    }
    toInsert.push(id);
    existing.add(id);
  }

  const insert = db.prepare(
    `INSERT INTO campaign_recipients (
       id, campaign_id, contact_id, status, error, provider_message_id, sent_at,
       created_at, updated_at
     ) VALUES (?, ?, ?, 'queued', '', '', '', ?, ?)`,
  );

  const run = db.transaction((ids: string[]) => {
    for (const contactId of ids) {
      insert.run(randomUUID(), campaignId, contactId, now, now);
    }
  });
  run(toInsert);

  if (toInsert.length > 0) revertCampaignToDraftIfReady(campaignId);

  result.added = toInsert.length;
  result.skipped =
    result.skippedNoEmail + result.skippedDuplicate + result.skippedMissing;
  result.total = getRecipientCount(campaignId);
  return result;
}

export function addRecipientsFromList(
  campaignId: string,
  listId: string,
): AddRecipientsResult {
  if (!getContactList(listId)) throw new CampaignError("List not found.");
  return addRecipients(campaignId, getListContactIds(listId));
}

export function inspectRecipients(campaignId: string): {
  total: number;
  invalid: number;
  invalidIds: string[];
} {
  requireCampaign(campaignId);
  const rows = getDb()
    .prepare<[string], { contact_id: string; email: string | null }>(
      `SELECT r.contact_id, ct.email
         FROM campaign_recipients r
         LEFT JOIN contacts ct ON ct.id = r.contact_id
        WHERE r.campaign_id = ?`,
    )
    .all(campaignId);

  const invalidIds: string[] = [];
  for (const row of rows) {
    if (!row.email || !hasDeliverableEmail(row.email)) invalidIds.push(row.contact_id);
  }
  return { total: rows.length, invalid: invalidIds.length, invalidIds };
}

export function removeInvalidRecipients(campaignId: string): {
  removed: number;
  total: number;
} {
  assertCampaignNotSending(campaignId);
  const { invalidIds } = inspectRecipients(campaignId);
  if (invalidIds.length === 0) {
    return { removed: 0, total: getRecipientCount(campaignId) };
  }
  const db = getDb();
  const stmt = db.prepare(
    "DELETE FROM campaign_recipients WHERE campaign_id = ? AND contact_id = ?",
  );
  const run = db.transaction(() => {
    for (const contactId of invalidIds) stmt.run(campaignId, contactId);
  });
  run();
  revertCampaignToDraftIfReady(campaignId);
  return { removed: invalidIds.length, total: getRecipientCount(campaignId) };
}

export function removeRecipient(campaignId: string, contactId: string): boolean {
  requireCampaign(campaignId);
  assertCampaignNotSending(campaignId);
  const removed =
    getDb()
      .prepare("DELETE FROM campaign_recipients WHERE campaign_id = ? AND contact_id = ?")
      .run(campaignId, contactId).changes > 0;
  if (removed) revertCampaignToDraftIfReady(campaignId);
  return removed;
}

export function clearRecipients(campaignId: string): number {
  requireCampaign(campaignId);
  assertCampaignNotSending(campaignId);
  const changes = getDb()
    .prepare("DELETE FROM campaign_recipients WHERE campaign_id = ?")
    .run(campaignId).changes;
  if (changes > 0) revertCampaignToDraftIfReady(campaignId);
  return changes;
}

export function countRecipientsByStatus(campaignId: string): {
  total: number;
  queued: number;
  sending: number;
  sent: number;
  failed: number;
  bounced: number;
  skipped: number;
} {
  requireCampaign(campaignId);
  const rows = getDb()
    .prepare<[string], { status: string; n: number }>(
      `SELECT status, COUNT(*) AS n FROM campaign_recipients WHERE campaign_id = ? GROUP BY status`,
    )
    .all(campaignId);
  const counts = {
    total: 0,
    queued: 0,
    sending: 0,
    sent: 0,
    failed: 0,
    bounced: 0,
    skipped: 0,
  };
  for (const row of rows) {
    counts.total += row.n;
    if (row.status in counts) {
      counts[row.status as keyof typeof counts] += row.n;
    }
  }
  return counts;
}

export function listQueuedContactIds(campaignId: string, limit: number): string[] {
  requireCampaign(campaignId);
  return getDb()
    .prepare<[string, number], { contact_id: string }>(
      `SELECT contact_id FROM campaign_recipients
        WHERE campaign_id = ? AND status = 'queued'
        ORDER BY created_at ASC
        LIMIT ?`,
    )
    .all(campaignId, limit)
    .map((row) => row.contact_id);
}

export function getRecipient(
  campaignId: string,
  contactId: string,
): CampaignRecipient | undefined {
  requireCampaign(campaignId);
  const row = getDb()
    .prepare<[string, string], RecipientRow>(
      `SELECT
         r.id, r.campaign_id, r.contact_id, r.status, r.error,
         r.provider_message_id, r.sent_at, r.created_at, r.updated_at,
         ct.first_name, ct.last_name, ct.email, ct.job_title, ct.subject, ct.company_id,
         co.name AS company_name, co.website AS company_website, co.industry
       FROM campaign_recipients r
       JOIN contacts ct ON ct.id = r.contact_id
       JOIN companies co ON co.id = ct.company_id
       WHERE r.campaign_id = ? AND r.contact_id = ?`,
    )
    .get(campaignId, contactId);
  return row ? toRecipient(row) : undefined;
}

export function beginRecipientSend(campaignId: string, contactId: string): CampaignRecipient {
  const now = new Date().toISOString();
  const changed = getDb()
    .prepare(
      `UPDATE campaign_recipients
          SET status = 'sending', error = '', updated_at = ?
        WHERE campaign_id = ? AND contact_id = ? AND status IN ('queued', 'failed')`,
    )
    .run(now, campaignId, contactId).changes;
  const recipient = getRecipient(campaignId, contactId);
  if (!recipient) throw new CampaignError("Recipient not found.");
  if (!changed) {
    if (recipient.status === "sent") {
      throw new CampaignSendError("Recipient has already been sent.", 409, "already_sent");
    }
    throw new CampaignSendError("Recipient cannot be sent in its current state.", 409);
  }
  return getRecipient(campaignId, contactId)!;
}

export function completeRecipientSend(
  campaignId: string,
  contactId: string,
  providerMessageId: string,
): CampaignRecipient {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE campaign_recipients
          SET status = 'sent', error = '', provider_message_id = ?, sent_at = ?, updated_at = ?
        WHERE campaign_id = ? AND contact_id = ?`,
    )
    .run(providerMessageId, now, now, campaignId, contactId);
  return getRecipient(campaignId, contactId)!;
}

export function noteRecipientSendWarning(
  campaignId: string,
  contactId: string,
  warning: string,
): CampaignRecipient {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE campaign_recipients
          SET error = ?, updated_at = ?
        WHERE campaign_id = ? AND contact_id = ?`,
    )
    .run(warning.slice(0, 500), now, campaignId, contactId);
  return getRecipient(campaignId, contactId)!;
}

export function failRecipientSend(
  campaignId: string,
  contactId: string,
  error: string,
): CampaignRecipient {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE campaign_recipients
          SET status = 'failed', error = ?, updated_at = ?
        WHERE campaign_id = ? AND contact_id = ?`,
    )
    .run(error.slice(0, 500), now, campaignId, contactId);
  return getRecipient(campaignId, contactId)!;
}
