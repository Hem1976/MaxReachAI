import type { BulkJobConfig, ColumnMapping } from "@/lib/bulk/types";
import type { LeadBrief } from "@/lib/types";

export interface NormalisedLead {
  company: string;
  firstName: string;
  lastName: string;
  contactName: string;
  email: string;
  website: string;
  jobTitle: string;
  industry: string;
  subject: string;
  notes: string;
  skipReason: string;
}

/**
 * Turns one CSV row into the fields the generator is allowed to see.
 * Missing values stay empty. Nothing is inferred from industry stereotypes,
 * the website, or the company name.
 */
export function normaliseRow(
  row: Record<string, string>,
  mapping: ColumnMapping,
): NormalisedLead {
  const company = mapped(row, mapping.company);
  const contact = mapped(row, mapping.contact);
  const split = splitName(contact);
  const contactName = contact || [split.first, split.last].filter(Boolean).join(" ");

  return {
    company: clip(company, 160),
    firstName: clip(split.first, 60),
    lastName: clip(split.last, 80),
    contactName: clip(contactName, 120),
    email: clip(mapped(row, mapping.email), 512),
    website: "",
    jobTitle: "",
    industry: "",
    subject: "",
    notes: "",
    skipReason: company ? "" : "No name in this row.",
  };
}

export function leadToBrief(
  lead: Pick<
    NormalisedLead,
    "company" | "website" | "contactName" | "jobTitle" | "industry" | "notes"
  >,
  config: BulkJobConfig,
): LeadBrief {
  return {
    company: lead.company,
    website: lead.website,
    contactName: lead.contactName,
    jobTitle: lead.jobTitle,
    industry: lead.industry,
    notes: lead.notes,
    product: config.product,
    objective: config.objective,
    tone: config.tone,
    length: config.length,
    templateId: config.templateId,
  };
}

function mapped(row: Record<string, string>, header: string): string {
  if (!header) return "";
  return (row[header] ?? "").trim();
}

export function namesFromContact(contactName: string): {
  contactName: string;
  firstName: string;
  lastName: string;
} {
  const split = splitName(contactName.trim());
  return {
    contactName: clip(contactName.trim(), 120),
    firstName: clip(split.first, 60),
    lastName: clip(split.last, 80),
  };
}

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export function cleanWebsite(value: string): string {
  return value.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}
