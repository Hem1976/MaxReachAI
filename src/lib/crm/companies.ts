import "server-only";

import { randomUUID } from "node:crypto";

import type { Company, CompanyDetail } from "@/lib/crm/types";
import { listContactsForCompany } from "@/lib/crm/contacts";
import { getDb } from "@/lib/db/client";

export interface CompanyRow {
  id: string;
  name: string;
  website: string;
  website_key: string;
  name_key: string;
  industry: string;
  notes: string;
  created_at: string;
  updated_at: string;
  contact_count?: number;
}

export function toCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name,
    website: row.website,
    industry: row.industry,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    contactCount: row.contact_count,
  };
}

export function websiteKey(website: string): string {
  return website
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

export function nameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function listCompanies(query = ""): Company[] {
  const needle = query.trim().toLowerCase();
  const sql = `
    SELECT c.*, COUNT(ct.id) AS contact_count
      FROM companies c
      LEFT JOIN contacts ct ON ct.company_id = c.id
     WHERE (? = ''
        OR lower(c.name) LIKE ?
        OR lower(c.website) LIKE ?
        OR lower(c.industry) LIKE ?)
     GROUP BY c.id
     ORDER BY c.updated_at DESC, c.name ASC
  `;
  const like = `%${needle}%`;
  const rows = getDb()
    .prepare<[string, string, string, string], CompanyRow>(sql)
    .all(needle, like, like, like);
  return rows.map(toCompany);
}

export function getCompany(id: string): Company | undefined {
  const row = getDb()
    .prepare<[string], CompanyRow>("SELECT * FROM companies WHERE id = ?")
    .get(id);
  return row ? toCompany(row) : undefined;
}

export function getCompanyDetail(id: string): CompanyDetail | undefined {
  const company = getCompany(id);
  if (!company) return undefined;
  return { ...company, contacts: listContactsForCompany(id) };
}

export function findCompanyForImport(input: {
  name: string;
  website: string;
}): CompanyRow | undefined {
  const db = getDb();
  const site = websiteKey(input.website);
  const name = nameKey(input.name);

  if (site) {
    const bySite = db
      .prepare<[string], CompanyRow>("SELECT * FROM companies WHERE website_key = ?")
      .get(site);
    if (bySite) return bySite;

    const namelessSite = db
      .prepare<[string], CompanyRow>(
        `SELECT * FROM companies
          WHERE name_key = ? AND website_key = ''
          LIMIT 1`,
      )
      .get(name);
    if (namelessSite) return namelessSite;
    return undefined;
  }

  const named = db
    .prepare<[string], CompanyRow>("SELECT * FROM companies WHERE name_key = ?")
    .all(name);

  if (named.length === 1) return named[0];
  const emptySite = named.filter((row) => !row.website_key);
  if (emptySite.length === 1) return emptySite[0];
  return undefined;
}

export function upsertCompany(input: {
  name: string;
  website: string;
  industry: string;
  notes: string;
}): { company: Company; created: boolean } {
  const existing = findCompanyForImport(input);
  const now = new Date().toISOString();

  if (!existing) {
    const id = randomUUID();
    getDb()
      .prepare(
        `INSERT INTO companies (
           id, name, website, website_key, name_key, industry, notes, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.name,
        input.website,
        websiteKey(input.website),
        nameKey(input.name),
        input.industry,
        input.notes,
        now,
        now,
      );
    return { company: getCompany(id)!, created: true };
  }

  const name = input.name || existing.name;
  const website = input.website || existing.website;
  const industry = input.industry || existing.industry;
  const notes = input.notes || existing.notes;

  getDb()
    .prepare(
      `UPDATE companies
          SET name = ?, website = ?, website_key = ?, name_key = ?,
              industry = ?, notes = ?, updated_at = ?
        WHERE id = ?`,
    )
    .run(
      name,
      website,
      websiteKey(website),
      nameKey(name),
      industry,
      notes,
      now,
      existing.id,
    );

  return { company: getCompany(existing.id)!, created: false };
}

export function updateCompany(
  id: string,
  input: {
    name: string;
    website: string;
    industry: string;
    notes: string;
  },
): Company | undefined {
  if (!getCompany(id)) return undefined;
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE companies
          SET name = ?, website = ?, website_key = ?, name_key = ?,
              industry = ?, notes = ?, updated_at = ?
        WHERE id = ?`,
    )
    .run(
      input.name.trim(),
      input.website.trim(),
      websiteKey(input.website),
      nameKey(input.name),
      input.industry.trim(),
      input.notes.trim(),
      now,
      id,
    );
  return getCompany(id);
}
