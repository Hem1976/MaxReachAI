import "server-only";

import { randomUUID } from "node:crypto";

import { emptyMapping } from "@/lib/bulk/columns";
import {
  cleanWebsite,
  leadToBrief,
  namesFromContact,
  normaliseRow,
} from "@/lib/bulk/normalize";
import type {
  BulkJob,
  BulkJobConfig,
  BulkJobSnapshot,
  BulkJobStatus,
  BulkJobTotals,
  BulkLead,
  BulkLeadStage,
  BulkLeadStatus,
  ColumnMapping,
} from "@/lib/bulk/types";
import { getDb } from "@/lib/db/client";
import type { EmailLength, Objective, ProductSelection, Tone } from "@/lib/types";

interface JobRow {
  id: string;
  filename: string;
  status: string;
  template_id: string;
  product: string;
  objective: string;
  tone: string;
  length: string;
  concurrency: number;
  mapping: string;
  error: string;
  created_at: string;
  updated_at: string;
}

interface LeadRow {
  id: string;
  job_id: string;
  row_index: number;
  company: string;
  first_name: string;
  last_name: string;
  contact_name: string;
  email: string;
  website: string;
  job_title: string;
  industry: string;
  notes: string;
  status: string;
  stage: string;
  error: string;
  product_id: string;
  product_name: string;
  pain_point: string;
  angle: string;
  subjects: string;
  recommended_subject: string;
  email_body: string;
  cta: string;
  follow_up_1: string;
  follow_up_2: string;
  review_flags: string;
  confidence_score: number;
  history_id: string;
  elapsed_ms: number;
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseMapping(value: string): ColumnMapping {
  try {
    return { ...emptyMapping(), ...(JSON.parse(value) as ColumnMapping) };
  } catch {
    return emptyMapping();
  }
}

function toJob(row: JobRow): BulkJob {
  return {
    id: row.id,
    filename: row.filename,
    status: row.status as BulkJobStatus,
    templateId: row.template_id,
    product: row.product as ProductSelection,
    objective: row.objective as Objective,
    tone: row.tone as Tone,
    length: row.length as EmailLength,
    concurrency: row.concurrency,
    mapping: parseMapping(row.mapping),
    totals: emptyTotals(),
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toLead(row: LeadRow): BulkLead {
  return {
    id: row.id,
    jobId: row.job_id,
    rowIndex: row.row_index,
    company: row.company,
    firstName: row.first_name,
    lastName: row.last_name,
    contactName: row.contact_name,
    email: row.email,
    website: row.website,
    jobTitle: row.job_title,
    industry: row.industry,
    notes: row.notes,
    status: row.status as BulkLeadStatus,
    stage: row.stage as BulkLeadStage,
    error: row.error,
    productId: row.product_id,
    productName: row.product_name,
    painPoint: row.pain_point,
    angle: row.angle,
    subjects: parseJsonArray(row.subjects),
    recommendedSubject: row.recommended_subject,
    emailBody: row.email_body,
    cta: row.cta ?? "",
    followUp1: row.follow_up_1,
    followUp2: row.follow_up_2,
    reviewFlags: parseJsonArray(row.review_flags),
    confidenceScore: row.confidence_score,
    historyId: row.history_id,
    elapsedMs: row.elapsed_ms,
  };
}

function emptyTotals(): BulkJobTotals {
  return {
    total: 0,
    queued: 0,
    generating: 0,
    ready: 0,
    needs_review: 0,
    approved: 0,
    failed: 0,
    skipped: 0,
  };
}

export function jobTotals(jobId: string): BulkJobTotals {
  const totals = emptyTotals();
  const rows = getDb()
    .prepare<[string], { status: string; count: number }>(
      "SELECT status, COUNT(*) AS count FROM bulk_leads WHERE job_id = ? GROUP BY status",
    )
    .all(jobId);

  for (const row of rows) {
    totals.total += row.count;
    switch (row.status) {
      case "queued":
      case "generating":
      case "ready":
      case "needs_review":
      case "approved":
      case "failed":
      case "skipped":
        totals[row.status] = row.count;
        break;
      default:
        break;
    }
  }

  return totals;
}

export function getJob(id: string): BulkJob | undefined {
  const row = getDb()
    .prepare<[string], JobRow>("SELECT * FROM bulk_jobs WHERE id = ?")
    .get(id);
  if (!row) return undefined;
  const job = toJob(row);
  job.totals = jobTotals(id);
  return job;
}

export function listJobs(limit = 20): BulkJob[] {
  return getDb()
    .prepare<[number], JobRow>(
      "SELECT * FROM bulk_jobs ORDER BY updated_at DESC LIMIT ?",
    )
    .all(limit)
    .map((row) => {
      const job = toJob(row);
      job.totals = jobTotals(row.id);
      return job;
    });
}

export function listLeads(jobId: string): BulkLead[] {
  return getDb()
    .prepare<[string], LeadRow>(
      "SELECT * FROM bulk_leads WHERE job_id = ? ORDER BY row_index ASC",
    )
    .all(jobId)
    .map(toLead);
}

export function getLead(id: string): BulkLead | undefined {
  const row = getDb()
    .prepare<[string], LeadRow>("SELECT * FROM bulk_leads WHERE id = ?")
    .get(id);
  return row ? toLead(row) : undefined;
}

export function getJobSnapshot(id: string): BulkJobSnapshot | undefined {
  const job = getJob(id);
  if (!job) return undefined;

  const leads = listLeads(id);
  const current =
    leads.find((lead) => lead.status === "generating") ??
    leads.find((lead) => lead.status === "queued") ??
    null;

  return {
    job,
    current: current
      ? { company: current.company, stage: current.stage, status: current.status }
      : null,
    leads,
  };
}

export function findRunningJobId(exceptId?: string): string | undefined {
  const row = getDb()
    .prepare<[string], { id: string }>(
      "SELECT id FROM bulk_jobs WHERE status = 'running' AND id != ? LIMIT 1",
    )
    .get(exceptId ?? "");
  return row?.id;
}

export function createJob(input: {
  filename: string;
  rows: Record<string, string>[];
  mapping: ColumnMapping;
  config: BulkJobConfig;
}): BulkJob {
  const id = randomUUID();
  const now = new Date().toISOString();

  const db = getDb();
  const insertJob = db.prepare(`
    INSERT INTO bulk_jobs (
      id, filename, status, template_id, product, objective, tone, length,
      concurrency, mapping, error, created_at, updated_at
    ) VALUES (
      @id, @filename, 'draft', @templateId, @product, @objective, @tone, @length,
      @concurrency, @mapping, '', @now, @now
    )
  `);

  const insertLead = db.prepare(`
    INSERT INTO bulk_leads (
      id, job_id, row_index, company, first_name, last_name, contact_name,
      email, website, job_title, industry, notes, status, stage, error
    ) VALUES (
      @id, @jobId, @rowIndex, @company, @firstName, @lastName, @contactName,
      @email, @website, @jobTitle, @industry, @notes, @status, @stage, @error
    )
  `);

  const write = db.transaction(() => {
    insertJob.run({
      id,
      filename: input.filename,
      templateId: input.config.templateId,
      product: input.config.product,
      objective: input.config.objective,
      tone: input.config.tone,
      length: input.config.length,
      concurrency: input.config.concurrency,
      mapping: JSON.stringify(input.mapping),
      now,
    });

    input.rows.forEach((row, index) => {
      const lead = normaliseRow(row, input.mapping);
      insertLead.run({
        id: randomUUID(),
        jobId: id,
        rowIndex: index,
        company: lead.company,
        firstName: lead.firstName,
        lastName: lead.lastName,
        contactName: lead.contactName,
        email: lead.email,
        website: lead.website,
        jobTitle: lead.jobTitle,
        industry: lead.industry,
        notes: lead.notes,
        status: lead.skipReason ? "skipped" : "queued",
        stage: lead.skipReason ? "normalize" : "",
        error: lead.skipReason,
      });
    });
  });

  write();
  const created = getJob(id);
  if (!created) {
    throw new Error("The bulk job could not be saved.");
  }
  return created;
}

export function setJobStatus(
  id: string,
  status: BulkJobStatus,
  error = "",
): BulkJob | undefined {
  getDb()
    .prepare(
      `UPDATE bulk_jobs
          SET status = ?, error = ?, updated_at = ?
        WHERE id = ?`,
    )
    .run(status, error, new Date().toISOString(), id);
  return getJob(id);
}

export function touchJob(id: string): void {
  getDb()
    .prepare("UPDATE bulk_jobs SET updated_at = ? WHERE id = ?")
    .run(new Date().toISOString(), id);
}

export function resetGeneratingLeads(jobId: string): void {
  getDb()
    .prepare(
      `UPDATE bulk_leads
          SET status = 'queued', stage = '', error = ''
        WHERE job_id = ? AND status = 'generating'`,
    )
    .run(jobId);
}

export function takeQueuedBatch(jobId: string, limit: number): BulkLead[] {
  const db = getDb();
  return db.transaction(() => {
    const rows = db
      .prepare<[string, number], LeadRow>(
        `SELECT * FROM bulk_leads
          WHERE job_id = ? AND status = 'queued'
          ORDER BY row_index ASC
          LIMIT ?`,
      )
      .all(jobId, limit);

    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.id);
    const placeholders = ids.map(() => "?").join(",");
    db.prepare(
      `UPDATE bulk_leads
          SET status = 'generating', stage = 'normalize', error = ''
        WHERE id IN (${placeholders})`,
    ).run(...ids);

    return rows.map((row) =>
      toLead({ ...row, status: "generating", stage: "normalize" }),
    );
  })();
}

export function updateLeadStage(
  id: string,
  stage: BulkLeadStage,
  extra?: Partial<{
    productId: string;
    productName: string;
  }>,
): void {
  if (extra?.productId) {
    getDb()
      .prepare(
        `UPDATE bulk_leads
            SET stage = ?, product_id = ?, product_name = ?
          WHERE id = ?`,
      )
      .run(stage, extra.productId, extra.productName ?? "", id);
    return;
  }

  getDb().prepare("UPDATE bulk_leads SET stage = ? WHERE id = ?").run(stage, id);
}

export function saveLeadResult(
  id: string,
  input: {
    status: Extract<BulkLeadStatus, "ready" | "needs_review">;
    productId: string;
    productName: string;
    painPoint: string;
    angle: string;
    subjects: string[];
    recommendedSubject: string;
    emailBody: string;
    cta: string;
    followUp1: string;
    followUp2: string;
    reviewFlags: string[];
    confidenceScore: number;
    historyId: string;
    elapsedMs: number;
  },
): void {
  getDb()
    .prepare(
      `UPDATE bulk_leads
          SET status = @status,
              stage = 'save',
              error = '',
              product_id = @productId,
              product_name = @productName,
              pain_point = @painPoint,
              angle = @angle,
              subjects = @subjects,
              recommended_subject = @recommendedSubject,
              email_body = @emailBody,
              cta = @cta,
              follow_up_1 = @followUp1,
              follow_up_2 = @followUp2,
              review_flags = @reviewFlags,
              confidence_score = @confidenceScore,
              history_id = @historyId,
              elapsed_ms = @elapsedMs
        WHERE id = @id`,
    )
    .run({
      id,
      status: input.status,
      productId: input.productId,
      productName: input.productName,
      painPoint: input.painPoint,
      angle: input.angle,
      subjects: JSON.stringify(input.subjects),
      recommendedSubject: input.recommendedSubject,
      emailBody: input.emailBody,
      cta: input.cta,
      followUp1: input.followUp1,
      followUp2: input.followUp2,
      reviewFlags: JSON.stringify(input.reviewFlags),
      confidenceScore: input.confidenceScore,
      historyId: input.historyId,
      elapsedMs: input.elapsedMs,
    });
}

export function failLead(id: string, error: string): void {
  getDb()
    .prepare(
      `UPDATE bulk_leads
          SET status = 'failed', error = ?
        WHERE id = ?`,
    )
    .run(error, id);
}

export function retryLeads(jobId: string, leadIds?: string[]): number {
  if (leadIds && leadIds.length > 0) {
    const placeholders = leadIds.map(() => "?").join(",");
    return getDb()
      .prepare(
        `UPDATE bulk_leads
            SET status = 'queued', stage = '', error = ''
          WHERE job_id = ? AND id IN (${placeholders})
            AND status IN ('failed', 'needs_review')`,
      )
      .run(jobId, ...leadIds).changes;
  }

  return getDb()
    .prepare(
      `UPDATE bulk_leads
          SET status = 'queued', stage = '', error = ''
        WHERE job_id = ? AND status = 'failed'`,
    )
    .run(jobId).changes;
}

export function patchLead(
  id: string,
  patch: {
    status?: Extract<BulkLeadStatus, "approved" | "needs_review" | "ready">;
    company?: string;
    contactName?: string;
    email?: string;
    website?: string;
    jobTitle?: string;
    industry?: string;
    notes?: string;
    emailBody?: string;
    recommendedSubject?: string;
    followUp1?: string;
    followUp2?: string;
  },
): BulkLead | undefined {
  const existing = getLead(id);
  if (!existing) return undefined;

  const names =
    patch.contactName !== undefined
      ? namesFromContact(patch.contactName)
      : {
          contactName: existing.contactName,
          firstName: existing.firstName,
          lastName: existing.lastName,
        };

  getDb()
    .prepare(
      `UPDATE bulk_leads
          SET status = @status,
              company = @company,
              first_name = @firstName,
              last_name = @lastName,
              contact_name = @contactName,
              email = @email,
              website = @website,
              job_title = @jobTitle,
              industry = @industry,
              notes = @notes,
              email_body = @emailBody,
              recommended_subject = @recommendedSubject,
              follow_up_1 = @followUp1,
              follow_up_2 = @followUp2
        WHERE id = @id`,
    )
    .run({
      id,
      status: patch.status ?? existing.status,
      company: patch.company ?? existing.company,
      firstName: names.firstName,
      lastName: names.lastName,
      contactName: names.contactName,
      email: patch.email ?? existing.email,
      website:
        patch.website !== undefined
          ? cleanWebsite(patch.website.trim()).slice(0, 200)
          : existing.website,
      jobTitle: patch.jobTitle ?? existing.jobTitle,
      industry: patch.industry ?? existing.industry,
      notes: patch.notes ?? existing.notes,
      emailBody: patch.emailBody ?? existing.emailBody,
      recommendedSubject: patch.recommendedSubject ?? existing.recommendedSubject,
      followUp1: patch.followUp1 ?? existing.followUp1,
      followUp2: patch.followUp2 ?? existing.followUp2,
    });

  return getLead(id);
}

export function deleteJob(id: string): boolean {
  return getDb().prepare("DELETE FROM bulk_jobs WHERE id = ?").run(id).changes > 0;
}

export function remainingCount(jobId: string): number {
  return (
    getDb()
      .prepare<[string], { total: number }>(
        `SELECT COUNT(*) AS total FROM bulk_leads
          WHERE job_id = ? AND status IN ('queued', 'generating')`,
      )
      .get(jobId)?.total ?? 0
  );
}

export function jobConfig(job: BulkJob): BulkJobConfig {
  return {
    templateId: job.templateId,
    product: job.product,
    objective: job.objective,
    tone: job.tone,
    length: job.length,
    concurrency: job.concurrency,
  };
}

export function briefFromLead(job: BulkJob, lead: BulkLead) {
  return leadToBrief(
    {
      company: lead.company,
      website: lead.website,
      contactName: lead.contactName,
      jobTitle: lead.jobTitle,
      industry: lead.industry,
      notes: lead.notes,
    },
    jobConfig(job),
  );
}
