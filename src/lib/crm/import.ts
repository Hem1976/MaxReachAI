import "server-only";

import { parseEmailAddresses } from "@/lib/campaigns/email";
import { upsertCompany } from "@/lib/crm/companies";
import { upsertContact } from "@/lib/crm/contacts";
import type { CompanyImportSummary, ImportRowError } from "@/lib/crm/types";
import { getDb } from "@/lib/db/client";
import { normaliseRow } from "@/lib/bulk/normalize";
import type { ColumnMapping } from "@/lib/bulk/types";

export function clearImportedCrmData(): {
  deletedLists: number;
  deletedContacts: number;
  deletedCompanies: number;
} {
  const db = getDb();
  return db.transaction(() => {
    const deletedLists = db.prepare("DELETE FROM contact_lists").run().changes;
    const deletedContacts = db.prepare("DELETE FROM contacts").run().changes;
    const deletedCompanies = db.prepare("DELETE FROM companies").run().changes;
    return { deletedLists, deletedContacts, deletedCompanies };
  })();
}

export function importCompaniesFromRows(input: {
  rows: Record<string, string>[];
  mapping: ColumnMapping;
}): CompanyImportSummary {
  const summary: CompanyImportSummary = {
    importedCompanies: 0,
    importedContacts: 0,
    updatedCompanies: 0,
    updatedContacts: 0,
    skippedRows: 0,
    errors: [],
    importedContactIds: [],
  };

  const companyTouched = new Map<string, "created" | "updated">();
  const run = getDb().transaction(() => {
    input.rows.forEach((row, index) => {
      const lead = normaliseRow(row, input.mapping);
      if (lead.skipReason || !lead.company.trim()) {
        summary.skippedRows += 1;
        return;
      }

      try {
        const { company, created } = upsertCompany({
          name: lead.company,
          website: lead.website,
          industry: lead.industry,
          notes: lead.notes,
        });

        if (!companyTouched.has(company.id)) {
          companyTouched.set(company.id, created ? "created" : "updated");
        }

        const hasPerson =
          Boolean(lead.firstName || lead.lastName || lead.contactName || lead.email);

        if (!hasPerson) return;

        const emails = parseEmailAddresses(lead.email);
        if (emails.length === 0) {
          const { contact, created: contactCreated } = upsertContact({
            companyId: company.id,
            firstName: lead.firstName,
            lastName: lead.lastName,
            email: "",
            jobTitle: lead.jobTitle,
            subject: lead.subject,
            source: "csv",
          });
          summary.importedContactIds.push(contact.id);
          if (contactCreated) summary.importedContacts += 1;
          else summary.updatedContacts += 1;
          return;
        }

        for (const email of emails) {
          const { contact, created: contactCreated } = upsertContact({
            companyId: company.id,
            firstName: lead.firstName,
            lastName: lead.lastName,
            email,
            jobTitle: lead.jobTitle,
            subject: lead.subject,
            source: "csv",
          });
          summary.importedContactIds.push(contact.id);
          if (contactCreated) summary.importedContacts += 1;
          else summary.updatedContacts += 1;
        }
      } catch (error) {
        const item: ImportRowError = {
          row: index + 2,
          company: lead.company,
          error: error instanceof Error ? error.message : "Could not import this row.",
        };
        summary.errors.push(item);
      }
    });
  });

  run();

  for (const status of companyTouched.values()) {
    if (status === "created") summary.importedCompanies += 1;
    else summary.updatedCompanies += 1;
  }

  return summary;
}
