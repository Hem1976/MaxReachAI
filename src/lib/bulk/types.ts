import type { EmailLength, Objective, ProductSelection, Tone } from "@/lib/types";

export const CANONICAL_FIELDS = ["company", "contact", "email"] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

/** CSV header name, or empty string when the field is unused. */
export type ColumnMapping = Record<CanonicalField, string>;

export type BulkJobStatus =
  | "draft"
  | "running"
  | "paused"
  | "completed"
  | "failed";

export type BulkLeadStatus =
  | "queued"
  | "generating"
  | "ready"
  | "needs_review"
  | "approved"
  | "failed"
  | "skipped";

export type BulkLeadStage =
  | ""
  | "normalize"
  | "industry"
  | "product"
  | "personalize"
  | "generate"
  | "validate"
  | "save";

export interface BulkJobConfig {
  templateId: string;
  product: ProductSelection;
  objective: Objective;
  tone: Tone;
  length: EmailLength;
  concurrency: number;
}

export interface BulkJobTotals {
  total: number;
  queued: number;
  generating: number;
  ready: number;
  needs_review: number;
  approved: number;
  failed: number;
  skipped: number;
}

export interface BulkJob {
  id: string;
  filename: string;
  status: BulkJobStatus;
  templateId: string;
  product: ProductSelection;
  objective: Objective;
  tone: Tone;
  length: EmailLength;
  concurrency: number;
  mapping: ColumnMapping;
  totals: BulkJobTotals;
  error: string;
  createdAt: string;
  updatedAt: string;
}

export interface BulkLead {
  id: string;
  jobId: string;
  rowIndex: number;
  company: string;
  firstName: string;
  lastName: string;
  contactName: string;
  email: string;
  website: string;
  jobTitle: string;
  industry: string;
  notes: string;
  status: BulkLeadStatus;
  stage: BulkLeadStage;
  error: string;
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
}

export interface BulkJobSnapshot {
  job: BulkJob;
  current: {
    company: string;
    stage: BulkLeadStage;
    status: BulkLeadStatus;
  } | null;
  leads: BulkLead[];
}

export const OUTPUT_CSV_HEADERS = [
  "company",
  "first_name",
  "last_name",
  "email",
  "website",
  "industry",
  "recommended_product",
  "pain_point",
  "outreach_angle",
  "subject_1",
  "subject_2",
  "subject_3",
  "recommended_subject",
  "email_body",
  "follow_up_1",
  "follow_up_2",
  "status",
] as const;

export type OutputCsvHeader = (typeof OUTPUT_CSV_HEADERS)[number];
