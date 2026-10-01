import {
  CANONICAL_FIELDS,
  type CanonicalField,
  type ColumnMapping,
} from "@/lib/bulk/types";

const FIELD_LABELS: Record<CanonicalField, string> = {
  company: "Name",
  contact: "Contact person",
  email: "Email",
};

const FIELD_HINTS: Record<CanonicalField, string> = {
  company: "Company or organization name. Required — rows without a name are skipped.",
  contact: "Full name of the person you are emailing.",
  email: "Their email address.",
};

const ALIASES: Record<CanonicalField, string[]> = {
  company: [
    "company_name",
    "companyname",
    "account_name",
    "accountname",
    "organization_name",
    "organisation_name",
    "organization",
    "organisation",
    "company",
    "account",
    "org",
    "name",
  ],
  contact: [
    "contact_name",
    "contact_person",
    "contactperson",
    "full_name",
    "fullname",
    "person_name",
    "lead_name",
    "contact",
    "person",
    "first_name",
    "firstname",
    "given_name",
    "givenname",
    "first",
    "fname",
  ],
  email: [
    "email_address",
    "work_email",
    "emailaddress",
    "e_mail",
    "mail",
    "email",
  ],
};

export function fieldLabel(field: CanonicalField): string {
  return FIELD_LABELS[field];
}

export function fieldHint(field: CanonicalField): string {
  return FIELD_HINTS[field];
}

export function emptyMapping(): ColumnMapping {
  return Object.fromEntries(CANONICAL_FIELDS.map((field) => [field, ""])) as ColumnMapping;
}

export function suggestMapping(headers: string[]): ColumnMapping {
  const mapping = emptyMapping();
  const used = new Set<string>();
  const normalised = headers.map((header) => ({
    header,
    key: normaliseHeader(header),
  }));

  for (const field of CANONICAL_FIELDS) {
    const match = bestHeader(field, normalised, used);
    if (match) {
      mapping[field] = match;
      used.add(match);
    }
  }

  return mapping;
}

export function mappingIsComplete(mapping: ColumnMapping): boolean {
  return Boolean(mapping.company.trim());
}

function bestHeader(
  field: CanonicalField,
  headers: Array<{ header: string; key: string }>,
  used: Set<string>,
): string | undefined {
  let best: { header: string; score: number } | undefined;

  for (const { header, key } of headers) {
    if (used.has(header)) continue;

    const score = aliasScore(field, key);
    if (score <= 0) continue;
    if (!best || score > best.score) {
      best = { header, score };
    }
  }

  return best?.header;
}

function aliasScore(field: CanonicalField, key: string): number {
  const aliases = ALIASES[field];
  for (let index = 0; index < aliases.length; index += 1) {
    const alias = aliases[index];
    if (key === alias) return 200 - index;
    if (key.includes(alias) || alias.includes(key)) return 80 - index;
  }
  return 0;
}

function normaliseHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s./\\-]+/g, "_")
    .replace(/[^\p{L}\p{N}_]/gu, "");
}
