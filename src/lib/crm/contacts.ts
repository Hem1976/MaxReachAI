import "server-only";

import { randomUUID } from "node:crypto";

import { hasDeliverableEmail, parseEmailAddresses } from "@/lib/campaigns/email";
import type { Contact, ContactSearchHit, ContactSource } from "@/lib/crm/types";
import { getDb } from "@/lib/db/client";

interface ContactRow {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string;
  subject: string;
  source: string;
  created_at: string;
}

function toContact(row: ContactRow): Contact {
  return {
    id: row.id,
    companyId: row.company_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    jobTitle: row.job_title,
    subject: row.subject ?? "",
    source: (row.source as ContactSource) || "csv",
    createdAt: row.created_at,
  };
}

function emailKey(email: string): string {
  return email.trim().toLowerCase();
}

function personKey(first: string, last: string): string {
  return `${first.trim().toLowerCase()} ${last.trim().toLowerCase()}`.trim();
}

interface ContactSearchRow extends ContactRow {
  company_name: string;
  industry: string;
}

export interface ContactSearchQuery {
  q?: string;
  industry?: string;
  hasEmail?: boolean;
  companyId?: string;
  limit?: number;
}

function toSearchHit(row: ContactSearchRow): ContactSearchHit {
  const contact = toContact(row);
  return {
    ...contact,
    companyName: row.company_name,
    industry: row.industry,
    hasEmail: hasDeliverableEmail(contact.email),
  };
}

export function searchContacts(query: ContactSearchQuery = {}): ContactSearchHit[] {
  const q = query.q?.trim().toLowerCase() ?? "";
  const industry = query.industry?.trim().toLowerCase() ?? "";
  const companyId = query.companyId?.trim() ?? "";
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
  const hasEmail =
    query.hasEmail === undefined ? "" : query.hasEmail ? "1" : "0";

  const like = `%${q}%`;
  return getDb()
    .prepare<unknown[], ContactSearchRow>(
      `SELECT ct.*, co.name AS company_name, co.industry
         FROM contacts ct
         JOIN companies co ON co.id = ct.company_id
        WHERE (? = '' OR ct.company_id = ?)
          AND (? = '' OR lower(co.industry) LIKE ?)
          AND (? = ''
            OR (? = '1' AND trim(ct.email) LIKE '%_@_%.__%')
            OR (? = '0' AND trim(ct.email) NOT LIKE '%_@_%.__%'))
          AND (? = ''
            OR lower(co.name) LIKE ?
            OR lower(ct.first_name) LIKE ?
            OR lower(ct.last_name) LIKE ?
            OR lower(ct.email) LIKE ?
            OR lower(ct.job_title) LIKE ?
            OR lower(trim(ct.first_name) || ' ' || trim(ct.last_name)) LIKE ?)
        ORDER BY co.name ASC, ct.last_name ASC, ct.first_name ASC
        LIMIT ?`,
    )
    .all(
      companyId,
      companyId,
      industry,
      `%${industry}%`,
      hasEmail,
      hasEmail,
      hasEmail,
      q,
      like,
      like,
      like,
      like,
      like,
      like,
      limit,
    )
    .map(toSearchHit);
}

/**
 * When a contact row stores several addresses in one cell, split them into
 * separate contact records (one email each) and return all resulting ids.
 */
export function expandContactEmails(contactId: string): string[] {
  const existing = getDb()
    .prepare<[string], ContactRow>("SELECT * FROM contacts WHERE id = ?")
    .get(contactId);
  if (!existing) return [];

  const emails = parseEmailAddresses(existing.email);
  if (emails.length === 0) return [];
  if (emails.length === 1) {
    if (existing.email.trim() !== emails[0]) {
      getDb()
        .prepare("UPDATE contacts SET email = ? WHERE id = ?")
        .run(emails[0], existing.id);
    }
    return [existing.id];
  }

  const ids: string[] = [];
  const { contact: primary } = upsertContact({
    companyId: existing.company_id,
    firstName: existing.first_name,
    lastName: existing.last_name,
    email: emails[0],
    jobTitle: existing.job_title,
    subject: existing.subject,
    source: (existing.source as ContactSource) || "csv",
  });
  ids.push(primary.id);

  for (const email of emails.slice(1)) {
    const { contact } = upsertContact({
      companyId: existing.company_id,
      firstName: existing.first_name,
      lastName: existing.last_name,
      email,
      jobTitle: existing.job_title,
      subject: existing.subject,
      source: (existing.source as ContactSource) || "csv",
    });
    ids.push(contact.id);
  }

  return [...new Set(ids)];
}

export function listContactsForCompany(companyId: string): Contact[] {
  return getDb()
    .prepare<[string], ContactRow>(
      `SELECT * FROM contacts
        WHERE company_id = ?
        ORDER BY last_name ASC, first_name ASC, email ASC`,
    )
    .all(companyId)
    .map(toContact);
}

function findContact(input: {
  companyId: string;
  email: string;
  firstName: string;
  lastName: string;
}): ContactRow | undefined {
  const db = getDb();
  const email = emailKey(input.email);

  if (email) {
    return db
      .prepare<[string, string], ContactRow>(
        `SELECT * FROM contacts
          WHERE company_id = ? AND lower(email) = ?
          LIMIT 1`,
      )
      .get(input.companyId, email);
  }

  const person = personKey(input.firstName, input.lastName);
  if (!person) return undefined;

  return db
    .prepare<[string, string], ContactRow>(
      `SELECT * FROM contacts
        WHERE company_id = ?
          AND email = ''
          AND lower(trim(first_name) || ' ' || trim(last_name)) = ?
        LIMIT 1`,
    )
    .get(input.companyId, person);
}

export function upsertContact(input: {
  companyId: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  subject?: string;
  source?: ContactSource;
}): { contact: Contact; created: boolean } {
  const existing = findContact(input);
  const now = new Date().toISOString();

  if (!existing) {
    const id = randomUUID();
    getDb()
      .prepare(
        `INSERT INTO contacts (
           id, company_id, first_name, last_name, email, job_title, subject, source, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.companyId,
        input.firstName,
        input.lastName,
        input.email.trim(),
        input.jobTitle,
        (input.subject ?? "").trim(),
        input.source ?? "csv",
        now,
      );
    return {
      contact: toContact(
        getDb().prepare<[string], ContactRow>("SELECT * FROM contacts WHERE id = ?").get(id)!,
      ),
      created: true,
    };
  }

  getDb()
    .prepare(
      `UPDATE contacts
          SET first_name = ?, last_name = ?, email = ?, job_title = ?,
              subject = CASE WHEN ? != '' THEN ? ELSE subject END
        WHERE id = ?`,
    )
    .run(
      input.firstName || existing.first_name,
      input.lastName || existing.last_name,
      input.email.trim() || existing.email,
      input.jobTitle || existing.job_title,
      (input.subject ?? "").trim(),
      (input.subject ?? "").trim(),
      existing.id,
    );

  return {
    contact: toContact(
      getDb()
        .prepare<[string], ContactRow>("SELECT * FROM contacts WHERE id = ?")
        .get(existing.id)!,
    ),
    created: false,
  };
}

export function updateContactRecord(
  id: string,
  input: {
    firstName: string;
    lastName: string;
    email: string;
    jobTitle: string;
    subject: string;
  },
): Contact | undefined {
  const existing = getDb()
    .prepare<[string], ContactRow>("SELECT * FROM contacts WHERE id = ?")
    .get(id);
  if (!existing) return undefined;

  getDb()
    .prepare(
      `UPDATE contacts
          SET first_name = ?, last_name = ?, email = ?, job_title = ?, subject = ?
        WHERE id = ?`,
    )
    .run(
      input.firstName.trim(),
      input.lastName.trim(),
      input.email.trim(),
      input.jobTitle.trim(),
      input.subject.trim(),
      id,
    );

  return toContact(
    getDb().prepare<[string], ContactRow>("SELECT * FROM contacts WHERE id = ?").get(id)!,
  );
}
