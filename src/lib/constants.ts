import { DEFAULT_CAMPAIGN_SENDER } from "@/lib/templates/sender-defaults";
import { DEFAULT_THEME_ID } from "@/lib/templates/themes";
import type { AppSettings, EmailLength, Objective, Tone } from "@/lib/types";

export const APP_NAME = "MaxReach AI";
export const APP_SUBTITLE = "AI-powered sales outreach by Maxpro Infotech";
export const ORG_NAME = "Maxpro Infotech";

export const objectives: {
  value: Objective;
  label: string;
  /** Injected into the prompt so the model writes to a specific outcome. */
  instruction: string;
}[] = [
  {
    value: "book-demo",
    label: "Book a demo",
    instruction:
      "The email must end by asking for a short demo or walkthrough call. Make the ask small and specific.",
  },
  {
    value: "introduce-product",
    label: "Introduce product",
    instruction:
      "Introduce the product and what it does for a company like theirs. Ask whether it is relevant rather than pushing for a meeting.",
  },
  {
    value: "start-conversation",
    label: "Start conversation",
    instruction:
      "Open a conversation. Lead with the problem, keep the product light, and ask an easy-to-answer question.",
  },
  {
    value: "partnership",
    label: "Partnership",
    instruction:
      "Position this as a partnership or channel conversation between two businesses, not a software sale. Ask to explore fit.",
  },
  {
    value: "follow-up",
    label: "Follow-up",
    instruction:
      "Write this as a follow-up to an earlier unanswered email. Be brief, add one new angle, and do not guilt the reader.",
  },
];

export const tones: { value: Tone; label: string; instruction: string }[] = [
  {
    value: "professional",
    label: "Professional",
    instruction:
      "Tone: professional and neutral. Clear business English, courteous, no slang, no exclamation marks.",
  },
  {
    value: "consultative",
    label: "Consultative",
    instruction:
      "Tone: consultative. Sound like an operator who understands the problem. Lead with the observation, ask before asserting.",
  },
  {
    value: "direct",
    label: "Direct",
    instruction:
      "Tone: direct. Short sentences, no warm-up, no filler adjectives. Respect the reader's time.",
  },
  {
    value: "executive",
    label: "Executive",
    instruction:
      "Tone: executive. Speak to business outcomes and operational control, not features. Composed and concise.",
  },
];

export const lengths: {
  value: EmailLength;
  label: string;
  words: string;
  hint: string;
  /** Token ceiling for Ollama num_predict. Kept tight — JSON + short copy. */
  maxTokens: number;
}[] = [
  {
    value: "short",
    label: "Short",
    words: "70 to 110 words",
    hint: "2 short paragraphs",
    maxTokens: 620,
  },
  {
    value: "medium",
    label: "Medium",
    words: "110 to 170 words",
    hint: "3 paragraphs",
    maxTokens: 920,
  },
  {
    value: "detailed",
    label: "Detailed",
    words: "170 to 240 words",
    hint: "4 paragraphs",
    maxTokens: 1150,
  },
];

export const productSelectorOptions = [
  { value: "auto", label: "Auto-detect", category: "Recommended" },
] as const;

export const DEFAULT_SETTINGS: AppSettings = {
  ollamaBaseUrl: "http://localhost:11434",
  model: "llama3.2:latest",
  temperature: 0.5,
  requestTimeoutMs: 180_000,
  defaultTone: "consultative",
  defaultLength: "short",
  defaultTemplateId: "intro-plain",
  themeId: DEFAULT_THEME_ID,
  senderName: DEFAULT_CAMPAIGN_SENDER.senderName,
  senderTitle: DEFAULT_CAMPAIGN_SENDER.senderTitle,
  senderEmail: DEFAULT_CAMPAIGN_SENDER.senderEmail,
  senderPhone: DEFAULT_CAMPAIGN_SENDER.senderPhone,
  companyName: DEFAULT_CAMPAIGN_SENDER.companyName,
  postmarkSenderName: "",
  postmarkSenderEmail: "",
  postmarkMessageStream: "outbound",
};

export function objectiveLabel(value: Objective): string {
  return objectives.find((o) => o.value === value)?.label ?? value;
}

export function toneLabel(value: Tone): string {
  return tones.find((t) => t.value === value)?.label ?? value;
}

export function lengthLabel(value: EmailLength): string {
  return lengths.find((l) => l.value === value)?.label ?? value;
}
