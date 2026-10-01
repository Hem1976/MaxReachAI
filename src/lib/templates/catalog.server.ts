import "server-only";

import { emailTemplates as maxproTemplates } from "@/lib/templates/definitions";
import { buildUserEmailTemplates } from "@/lib/templates/user-templates";
import type { EmailTemplate, TemplateCategory } from "@/lib/templates/types";

export const emailTemplates: EmailTemplate[] = [
  ...maxproTemplates.map((t) => ({
    ...t,
    library: "maxpro" as const,
  })),
  ...buildUserEmailTemplates().map((t) => ({
    ...t,
    library: "maxpro" as const,
  })),
];

const byId = new Map(emailTemplates.map((t) => [t.id, t]));

export function getTemplate(id: string): EmailTemplate | undefined {
  return byId.get(id);
}

export function getTemplateOrDefault(id: string): EmailTemplate {
  return byId.get(id) ?? emailTemplates[0];
}

const CATEGORY_ORDER: TemplateCategory[] = [
  "My templates",
  "Introduction",
  "Problem to solution",
];

export const templateCategories = CATEGORY_ORDER.filter((category) =>
  emailTemplates.some((t) => t.category === category),
);

export function templatesGroupedForPicker(): Array<[string, EmailTemplate[]]> {
  const groups: Array<[string, EmailTemplate[]]> = [];
  const byCategory = new Map<TemplateCategory, EmailTemplate[]>();
  for (const template of emailTemplates) {
    const bucket = byCategory.get(template.category) ?? [];
    bucket.push(template);
    byCategory.set(template.category, bucket);
  }
  for (const category of CATEGORY_ORDER) {
    const bucket = byCategory.get(category);
    if (bucket && bucket.length > 0) groups.push([category, bucket]);
  }
  return groups;
}

export function templateLabel(id: string): string {
  if (!id) return "—";
  return byId.get(id)?.name ?? id;
}
