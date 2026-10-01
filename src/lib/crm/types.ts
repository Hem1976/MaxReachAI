export type ContactSource = "csv" | "manual";

export interface Company {
  id: string;
  name: string;
  website: string;
  industry: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  contactCount?: number;
}

export interface Contact {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  subject: string;
  source: ContactSource;
  createdAt: string;
}

export interface CompanyDetail extends Company {
  contacts: Contact[];
}

export interface ContactSearchHit extends Contact {
  companyName: string;
  industry: string;
  hasEmail: boolean;
}

export interface ImportRowError {
  row: number;
  company: string;
  error: string;
}

export interface CompanyImportSummary {
  importedCompanies: number;
  importedContacts: number;
  updatedCompanies: number;
  updatedContacts: number;
  skippedRows: number;
  errors: ImportRowError[];
  importedContactIds: string[];
}

export interface ContactList {
  id: string;
  name: string;
  filename: string;
  contactCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContactListImportSummary extends CompanyImportSummary {
  list: ContactList;
}

export interface ListMember {
  contactId: string;
  companyId: string;
  companyName: string;
  website: string;
  industry: string;
  notes: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  subject: string;
}

export interface ListMemberUpdateInput {
  companyName?: string;
  contactName?: string;
  email?: string;
}
