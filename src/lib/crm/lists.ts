import "server-only";

import { randomUUID } from "node:crypto";

import { namesFromContact } from "@/lib/bulk/normalize";
import { importCompaniesFromRows } from "@/lib/crm/import";
import { updateCompany } from "@/lib/crm/companies";
import { updateContactRecord } from "@/lib/crm/contacts";
import type {
  ContactList,
  ContactListImportSummary,
  ListMember,
  ListMemberUpdateInput,
} from "@/lib/crm/types";
import type { ColumnMapping } from "@/lib/bulk/types";
import { getDb } from "@/lib/db/client";

interface ListRow {
  id: string;
  name: string;
  filename: string;
  contact_count: number;
  created_at: string;
  updated_at: string;
}

function toList(row: ListRow): ContactList {
  return {
    id: row.id,
    name: row.name,
    filename: row.filename,
    contactCount: row.contact_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listContactLists(limit = 20): ContactList[] {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  return getDb()
    .prepare<[number], ListRow>(
      `SELECT * FROM contact_lists ORDER BY updated_at DESC LIMIT ?`,
    )
    .all(safeLimit)
    .map(toList);
}

export function getContactList(id: string): ContactList | undefined {
  const row = getDb()
    .prepare<[string], ListRow>("SELECT * FROM contact_lists WHERE id = ?")
    .get(id);
  return row ? toList(row) : undefined;
}

export function getListContactIds(listId: string): string[] {
  return getDb()
    .prepare<[string], { contact_id: string }>(
      `SELECT contact_id FROM contact_list_members WHERE list_id = ? ORDER BY created_at ASC`,
    )
    .all(listId)
    .map((row) => row.contact_id);
}

interface ListMemberRow {
  contact_id: string;
  company_id: string;
  company_name: string;
  website: string;
  industry: string;
  notes: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string;
  subject: string;
}

function toListMember(row: ListMemberRow): ListMember {
  return {
    contactId: row.contact_id,
    companyId: row.company_id,
    companyName: row.company_name,
    website: row.website,
    industry: row.industry,
    notes: row.notes,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    jobTitle: row.job_title,
    subject: row.subject ?? "",
  };
}

export function listMembersForList(listId: string): ListMember[] {
  return getDb()
    .prepare<[string], ListMemberRow>(
      `SELECT
         ct.id AS contact_id,
         co.id AS company_id,
         co.name AS company_name,
         co.website,
         co.industry,
         co.notes,
         ct.first_name,
         ct.last_name,
         ct.email,
         ct.job_title,
         ct.subject
       FROM contact_list_members m
       JOIN contacts ct ON ct.id = m.contact_id
       JOIN companies co ON co.id = ct.company_id
       WHERE m.list_id = ?
       ORDER BY co.name ASC, ct.last_name ASC, ct.first_name ASC, ct.email ASC`,
    )
    .all(listId)
    .map(toListMember);
}

export function isContactInList(listId: string, contactId: string): boolean {
  const row = getDb()
    .prepare<[string, string], { n: number }>(
      `SELECT COUNT(*) AS n FROM contact_list_members WHERE list_id = ? AND contact_id = ?`,
    )
    .get(listId, contactId);
  return (row?.n ?? 0) > 0;
}

export function touchContactList(listId: string): void {
  const now = new Date().toISOString();
  getDb()
    .prepare("UPDATE contact_lists SET updated_at = ? WHERE id = ?")
    .run(now, listId);
}

export function updateListMember(
  listId: string,
  contactId: string,
  patch: ListMemberUpdateInput,
): ListMember | undefined {
  if (!getContactList(listId) || !isContactInList(listId, contactId)) return undefined;

  const members = listMembersForList(listId);
  const current = members.find((member) => member.contactId === contactId);
  if (!current) return undefined;

  const contactNames = patch.contactName
    ? namesFromContact(patch.contactName)
    : null;

  updateCompany(current.companyId, {
    name: patch.companyName ?? current.companyName,
    website: current.website,
    industry: current.industry,
    notes: current.notes,
  });

  updateContactRecord(contactId, {
    firstName: contactNames?.firstName ?? current.firstName,
    lastName: contactNames?.lastName ?? current.lastName,
    email: patch.email ?? current.email,
    jobTitle: current.jobTitle,
    subject: current.subject,
  });

  touchContactList(listId);
  return listMembersForList(listId).find((member) => member.contactId === contactId);
}

export function deleteContactList(id: string): boolean {
  return getDb().prepare("DELETE FROM contact_lists WHERE id = ?").run(id).changes > 0;
}

export function importContactList(input: {
  name: string;
  filename?: string;
  rows: Record<string, string>[];
  mapping: ColumnMapping;
}): ContactListImportSummary {
  const now = new Date().toISOString();
  const listId = randomUUID();
  const name = input.name.trim() || input.filename?.trim() || "Imported list";
  const filename = input.filename?.trim() ?? "";

  const summary = importCompaniesFromRows({
    rows: input.rows,
    mapping: input.mapping,
  });

  const uniqueContactIds = [...new Set(summary.importedContactIds)];
  const db = getDb();

  const insertMember = db.prepare(
    `INSERT OR IGNORE INTO contact_list_members (list_id, contact_id, created_at)
     VALUES (?, ?, ?)`,
  );

  const run = db.transaction(() => {
    db.prepare(
      `INSERT INTO contact_lists (id, name, filename, contact_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(listId, name, filename, uniqueContactIds.length, now, now);

    for (const contactId of uniqueContactIds) {
      insertMember.run(listId, contactId, now);
    }
  });
  run();

  const list = getContactList(listId);
  if (!list) throw new Error("Could not save the imported list.");

  return { ...summary, list };
}
