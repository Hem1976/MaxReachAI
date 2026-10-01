/**
 * Campaign merge fields.
 *
 * Convention: known tokens with a missing/empty value become "".
 * Unknown tokens (not in CAMPAIGN_VARIABLES) are left unchanged so we never
 * invent a value for something we do not understand.
 */

export const CAMPAIGN_VARIABLES = [
  "first_name",
  "last_name",
  "full_name",
  "email",
  "job_title",
  "company",
  "website",
  "industry",
  "product_name",
  "product_description",
  "product_image",
  "sender_name",
  "sender_email",
  "sender_company",
] as const;

export type CampaignVariable = (typeof CAMPAIGN_VARIABLES)[number];

export type VariableMap = Partial<Record<CampaignVariable, string>>;

export const VARIABLE_INSERT_OPTIONS: Array<{
  key: CampaignVariable;
  label: string;
}> = [
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "company", label: "Company" },
  { key: "job_title", label: "Job title" },
  { key: "industry", label: "Industry" },
  { key: "email", label: "Email" },
  { key: "website", label: "Website" },
  { key: "product_name", label: "Product" },
  { key: "sender_name", label: "Sender name" },
  { key: "sender_email", label: "Sender email" },
];

export const SAMPLE_RECIPIENT: VariableMap = {
  first_name: "John",
  last_name: "Kamau",
  full_name: "John Kamau",
  email: "john@example.com",
  job_title: "Sales Manager",
  company: "Example Company",
  website: "https://example.com",
  industry: "Distribution",
};

const KNOWN = new Set<string>(CAMPAIGN_VARIABLES);

/** Left untouched in imported HTML (Mailchimp, Canva, ESP exports, etc.). */
const IGNORED_VARIABLES = new Set([
  "unsubscribe",
  "update_preferences",
  "view_in_browser",
  "preferences",
  "browser",
]);

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export function variableToken(key: CampaignVariable): string {
  return `{{${key}}}`;
}

export function findVariables(text: string): string[] {
  const seen = new Set<string>();
  const found: string[] = [];
  const pattern = new RegExp(VARIABLE_PATTERN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const key = match[1].toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(key);
  }
  return found;
}

export function findUnknownVariables(...texts: string[]): string[] {
  const unknown = new Set<string>();
  for (const text of texts) {
    for (const key of findVariables(text)) {
      if (!KNOWN.has(key) && !IGNORED_VARIABLES.has(key)) unknown.add(key);
    }
  }
  return [...unknown];
}

export function replaceVariables(template: string, values: VariableMap): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, raw: string) => {
    const key = raw.toLowerCase();
    if (!KNOWN.has(key)) return match;
    return values[key as CampaignVariable] ?? "";
  });
}

export function campaignVariableValues(input: {
  recipient?: VariableMap;
  productName?: string;
  productDescription?: string;
  productImage?: string;
  senderName?: string;
  senderEmail?: string;
  senderCompany?: string;
}): VariableMap {
  const recipient = input.recipient ?? SAMPLE_RECIPIENT;
  return {
    ...SAMPLE_RECIPIENT,
    ...recipient,
    product_name: input.productName ?? "",
    product_description: input.productDescription ?? "",
    product_image: input.productImage ?? "",
    sender_name: input.senderName ?? "",
    sender_email: input.senderEmail ?? "",
    sender_company: input.senderCompany ?? "",
  };
}
