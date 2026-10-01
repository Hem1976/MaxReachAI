import "server-only";

import { randomUUID } from "node:crypto";

import { getDb } from "@/lib/db/client";
import type {
  EmailLength,
  HistoryRecord,
  LeadBrief,
  Objective,
  Tone,
} from "@/lib/types";

interface HistoryRow {
  id: string;
  company: string;
  contact_name: string;
  job_title: string;
  website: string;
  industry: string;
  notes: string;
  product_id: string;
  product_name: string;
  objective: string;
  tone: string;
  length: string;
  template_id: string;
  subjects: string;
  recommended_subject: string;
  email: string;
  pain_point: string;
  angle: string;
  cta: string;
  follow_up: string;
  confidence_score: number;
  review_flags: string;
  model: string;
  created_at: string;
}

function toRecord(row: HistoryRow): HistoryRecord {
  return {
    id: row.id,
    company: row.company,
    contactName: row.contact_name,
    jobTitle: row.job_title,
    website: row.website,
    industry: row.industry,
    notes: row.notes,
    productId: row.product_id,
    productName: row.product_name,
    objective: row.objective as Objective,
    tone: row.tone as Tone,
    length: row.length as EmailLength,
    templateId: row.template_id,
    subjects: parseJsonArray(row.subjects),
    recommendedSubject: row.recommended_subject,
    email: row.email,
    painPoint: row.pain_point,
    angle: row.angle,
    cta: row.cta,
    followUp: row.follow_up,
    confidenceScore: row.confidence_score,
    reviewFlags: parseJsonArray(row.review_flags),
    model: row.model,
    createdAt: row.created_at,
  };
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export interface SaveHistoryInput {
  brief: LeadBrief;
  result: {
    productId: string;
    productName: string;
    painPoint: string;
    angle: string;
    subjects: string[];
    recommendedSubject: string;
    email: string;
    cta: string;
    followUp: string;
    confidenceScore: number;
    reviewFlags: string[];
    model: string;
  };
}

export function saveHistory(input: SaveHistoryInput): HistoryRecord {
  const { brief, result } = input;
  const record: HistoryRecord = {
    id: randomUUID(),
    company: brief.company,
    contactName: brief.contactName,
    jobTitle: brief.jobTitle,
    website: brief.website,
    industry: brief.industry,
    notes: brief.notes,
    productId: result.productId,
    productName: result.productName,
    objective: brief.objective,
    tone: brief.tone,
    length: brief.length,
    templateId: brief.templateId,
    subjects: result.subjects,
    recommendedSubject: result.recommendedSubject,
    email: result.email,
    painPoint: result.painPoint,
    angle: result.angle,
    cta: result.cta,
    followUp: result.followUp,
    confidenceScore: Math.round(result.confidenceScore),
    reviewFlags: result.reviewFlags,
    model: result.model,
    createdAt: new Date().toISOString(),
  };

  getDb()
    .prepare(
      `INSERT INTO history (
        id, company, contact_name, job_title, website, industry, notes,
        product_id, product_name, objective, tone, length, template_id,
        subjects, recommended_subject, email, pain_point, angle, cta, follow_up,
        confidence_score, review_flags, model, created_at
      ) VALUES (
        @id, @company, @contactName, @jobTitle, @website, @industry, @notes,
        @productId, @productName, @objective, @tone, @length, @templateId,
        @subjects, @recommendedSubject, @email, @painPoint, @angle, @cta, @followUp,
        @confidenceScore, @reviewFlags, @model, @createdAt
      )`,
    )
    .run({
      ...record,
      subjects: JSON.stringify(record.subjects),
      reviewFlags: JSON.stringify(record.reviewFlags),
    });

  return record;
}

export function listHistory(options?: {
  search?: string;
  limit?: number;
}): HistoryRecord[] {
  const limit = options?.limit ?? 200;
  const search = options?.search?.trim();

  if (!search) {
    return getDb()
      .prepare<[number], HistoryRow>(
        "SELECT * FROM history ORDER BY created_at DESC LIMIT ?",
      )
      .all(limit)
      .map(toRecord);
  }

  const needle = `%${search.toLowerCase()}%`;
  return getDb()
    .prepare<[string, string, string, string, string, number], HistoryRow>(
      `SELECT * FROM history
       WHERE lower(company) LIKE ?
          OR lower(contact_name) LIKE ?
          OR lower(product_name) LIKE ?
          OR lower(recommended_subject) LIKE ?
          OR lower(email) LIKE ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(needle, needle, needle, needle, needle, limit)
    .map(toRecord);
}

export function getHistory(id: string): HistoryRecord | undefined {
  const row = getDb()
    .prepare<[string], HistoryRow>("SELECT * FROM history WHERE id = ?")
    .get(id);
  return row ? toRecord(row) : undefined;
}

/**
 * Applied after a refine so the saved record matches the copy the rep ended up
 * with, rather than the first draft.
 */
export function updateHistoryContent(
  id: string,
  patch: {
    email?: string;
    subjects?: string[];
    recommendedSubject?: string;
    followUp?: string;
  },
): HistoryRecord | undefined {
  const existing = getHistory(id);
  if (!existing) return undefined;

  const next = {
    email: patch.email ?? existing.email,
    subjects: JSON.stringify(patch.subjects ?? existing.subjects),
    recommendedSubject: patch.recommendedSubject ?? existing.recommendedSubject,
    followUp: patch.followUp ?? existing.followUp,
    id,
  };

  getDb()
    .prepare(
      `UPDATE history
          SET email = @email,
              subjects = @subjects,
              recommended_subject = @recommendedSubject,
              follow_up = @followUp
        WHERE id = @id`,
    )
    .run(next);

  return getHistory(id);
}

export function deleteHistory(id: string): boolean {
  return getDb().prepare("DELETE FROM history WHERE id = ?").run(id).changes > 0;
}

export function countHistory(): number {
  return (
    getDb()
      .prepare<[], { total: number }>("SELECT COUNT(*) AS total FROM history")
      .get()?.total ?? 0
  );
}
