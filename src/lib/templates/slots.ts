export const TEMPLATE_SLOT_KEYS = [
  "EYEBROW",
  "HEADLINE",
  "GREETING",
  "INTRO",
  "FOLLOW",
  "PROBLEM_TITLE",
  "PROBLEM_BODY",
  "SOLUTION_TITLE",
  "SOLUTION_BODY",
  "CTA_LABEL",
  "APP_NAME",
  "PRODUCT_BLURB",
  "SENDER_NAME",
  "SENDER_TITLE",
  "COMPANY_NAME",
  "IMAGE_1",
  "IMAGE_2",
  "IMAGE_HERO",
  "BRAND_SUBTITLE",
  "PROBLEM_BULLET_1",
  "PROBLEM_BULLET_2",
  "PROBLEM_BULLET_3",
  "BENEFIT_1",
  "BENEFIT_2",
  "BENEFIT_3",
  "TRANSITION_LINE",
  "CTA_NOTE",
  "PARAGRAPH_2",
  "PARAGRAPH_3",
  "PARAGRAPH_4",
  "SENDER_ORG",
  "FOOTER_ADDRESS",
  "FOOTER_PHONE",
  "FOOTER_EMAIL",
] as const;

export type TemplateSlotKey = (typeof TEMPLATE_SLOT_KEYS)[number];
export type TemplateSlots = Partial<Record<TemplateSlotKey, string>>;

export const IMAGE_SLOT_KEYS = ["IMAGE_1", "IMAGE_2", "IMAGE_HERO"] as const;

const SLOT_KEY_SET = new Set<string>(TEMPLATE_SLOT_KEYS);

export function isTemplateSlotKey(value: string): value is TemplateSlotKey {
  return SLOT_KEY_SET.has(value);
}

export function parseTemplateSlots(raw: string | null | undefined): TemplateSlots {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const slots: TemplateSlots = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!isTemplateSlotKey(key) || typeof value !== "string") continue;
      slots[key] = value;
    }
    return slots;
  } catch {
    return {};
  }
}

export function serializeTemplateSlots(slots: TemplateSlots): string {
  return JSON.stringify(slots);
}

export function composeBodyFromSlots(slots: TemplateSlots, fallback = ""): string {
  const parts = [
    slots.GREETING,
    slots.INTRO,
    slots.FOLLOW,
    slots.PROBLEM_TITLE,
    slots.PROBLEM_BODY,
    slots.SOLUTION_TITLE,
    slots.SOLUTION_BODY,
    slots.PRODUCT_BLURB,
    slots.PROBLEM_BULLET_1,
    slots.PROBLEM_BULLET_2,
    slots.PROBLEM_BULLET_3,
    slots.BENEFIT_1,
    slots.BENEFIT_2,
    slots.BENEFIT_3,
    slots.PARAGRAPH_2,
    slots.PARAGRAPH_3,
    slots.PARAGRAPH_4,
  ]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.join("\n\n") || fallback;
}

export function slotValuesForVariables(slots: TemplateSlots): string[] {
  return Object.values(slots).filter((value): value is string => typeof value === "string");
}
