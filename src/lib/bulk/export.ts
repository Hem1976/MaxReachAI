import { OUTPUT_CSV_HEADERS } from "@/lib/bulk/types";
import { toCsv } from "@/lib/bulk/csv";
import type { BulkLead } from "@/lib/bulk/types";

export function leadsToExportRows(leads: BulkLead[]): Array<Record<string, string>> {
  return leads.map((lead) => ({
    company: lead.company,
    first_name: lead.firstName,
    last_name: lead.lastName,
    email: lead.email,
    website: lead.website,
    industry: lead.industry,
    recommended_product: lead.productName,
    pain_point: lead.painPoint,
    outreach_angle: lead.angle,
    subject_1: lead.subjects[0] ?? "",
    subject_2: lead.subjects[1] ?? "",
    subject_3: lead.subjects[2] ?? "",
    recommended_subject: lead.recommendedSubject,
    email_body: lead.emailBody,
    follow_up_1: lead.followUp1,
    follow_up_2: lead.followUp2,
    status: lead.status,
  }));
}

export function exportLeadsCsv(leads: BulkLead[]): string {
  return toCsv([...OUTPUT_CSV_HEADERS], leadsToExportRows(leads));
}
