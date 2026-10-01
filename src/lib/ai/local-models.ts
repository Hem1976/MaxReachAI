/**
 * Curated free local models for MaxReach outreach generation via Ollama.
 * All run offline — no API keys. Pick by VRAM tier in Settings.
 *
 * Sources: Ollama library (ollama.com/library), Meta Llama, Mistral, Alibaba
 * Qwen, Google Gemma, Microsoft Phi, DeepSeek — all open-weight / open license.
 */

export type LocalModelTier = "fast" | "balanced" | "quality";

export interface LocalModelRecommendation {
  /** Stable id used in UI and tests. */
  id: string;
  /** Tag passed to Ollama (`ollama pull <tag>`). */
  tag: string;
  name: string;
  provider: string;
  tier: LocalModelTier;
  /** Approximate disk / VRAM at Q4, e.g. "~2 GB". */
  footprint: string;
  license: string;
  /** One-line pitch for sales outreach use. */
  bestFor: string;
  /** Extra operator notes (optional). */
  notes?: string;
}

export const LOCAL_MODEL_TIERS: { id: LocalModelTier; label: string; hint: string }[] = [
  {
    id: "fast",
    label: "Fast",
    hint: "Laptops and shared machines — bulk runs finish sooner.",
  },
  {
    id: "balanced",
    label: "Balanced",
    hint: "Best default for outreach quality on 8–16 GB RAM.",
  },
  {
    id: "quality",
    label: "Quality",
    hint: "Stronger reasoning — slower, needs more memory.",
  },
];

/** Default model when nothing is configured. */
export const DEFAULT_LOCAL_MODEL_TAG = "llama3.2:latest";

export const RECOMMENDED_LOCAL_MODELS: LocalModelRecommendation[] = [
  {
    id: "llama3.2",
    tag: "llama3.2:latest",
    name: "Llama 3.2",
    provider: "Meta",
    tier: "fast",
    footprint: "~2 GB",
    license: "Llama Community",
    bestFor: "Quick drafts and bulk on modest hardware.",
    notes: "Current project default. Good structured JSON on 3B.",
  },
  {
    id: "qwen2.5-1.5b",
    tag: "qwen2.5:1.5b",
    name: "Qwen 2.5 1.5B",
    provider: "Alibaba",
    tier: "fast",
    footprint: "~1 GB",
    license: "Apache 2.0",
    bestFor: "Fastest runs when quality can be lighter.",
  },
  {
    id: "gemma3-4b",
    tag: "gemma3:4b",
    name: "Gemma 3 4B",
    provider: "Google",
    tier: "fast",
    footprint: "~3 GB",
    license: "Gemma",
    bestFor: "Compact Google model with solid instruction following.",
  },
  {
    id: "phi4-mini",
    tag: "phi4-mini",
    name: "Phi-4 Mini",
    provider: "Microsoft",
    tier: "fast",
    footprint: "~3 GB",
    license: "MIT",
    bestFor: "Strong reasoning per gigabyte on 8 GB GPUs.",
  },
  {
    id: "llama3.1-8b",
    tag: "llama3.1:8b",
    name: "Llama 3.1 8B",
    provider: "Meta",
    tier: "balanced",
    footprint: "~5 GB",
    license: "Llama Community",
    bestFor: "Reliable JSON and warmer outreach copy.",
  },
  {
    id: "qwen2.5-7b",
    tag: "qwen2.5:7b",
    name: "Qwen 2.5 7B",
    provider: "Alibaba",
    tier: "balanced",
    footprint: "~5 GB",
    license: "Apache 2.0",
    bestFor: "Multilingual prospects and stronger bulk quality.",
    notes: "Recommended upgrade from Llama 3.2 for Indian / APAC lists.",
  },
  {
    id: "mistral",
    tag: "mistral:latest",
    name: "Mistral 7B",
    provider: "Mistral AI",
    tier: "balanced",
    footprint: "~4.5 GB",
    license: "Apache 2.0",
    bestFor: "Direct, concise B2B tone with low fluff.",
  },
  {
    id: "mistral-nemo",
    tag: "mistral-nemo",
    name: "Mistral Nemo 12B",
    provider: "Mistral AI",
    tier: "balanced",
    footprint: "~7 GB",
    license: "Apache 2.0",
    bestFor: "Longer context and richer personalisation notes.",
  },
  {
    id: "qwen3-8b",
    tag: "qwen3:8b",
    name: "Qwen 3 8B",
    provider: "Alibaba",
    tier: "balanced",
    footprint: "~5 GB",
    license: "Apache 2.0",
    bestFor: "Newer Qwen family — strong general + coding hybrid.",
  },
  {
    id: "deepseek-r1-7b",
    tag: "deepseek-r1:7b",
    name: "DeepSeek R1 7B",
    provider: "DeepSeek",
    tier: "quality",
    footprint: "~5 GB",
    license: "MIT",
    bestFor: "Harder angles and consultative reasoning.",
    notes: "Slower than 7B instruct models; best for single-shot quality.",
  },
  {
    id: "gemma3-12b",
    tag: "gemma3:12b",
    name: "Gemma 3 12B",
    provider: "Google",
    tier: "quality",
    footprint: "~8 GB",
    license: "Gemma",
    bestFor: "Premium copy when you have 16 GB+ RAM.",
  },
];

export function tierLabel(tier: LocalModelTier): string {
  return LOCAL_MODEL_TIERS.find((item) => item.id === tier)?.label ?? tier;
}

/** Ollama tag lists often include `:latest` or digest suffixes — match loosely. */
export function modelTagMatches(installedName: string, tag: string): boolean {
  const norm = (value: string) => value.trim().toLowerCase().replace(/:latest$/, "");
  const a = norm(installedName);
  const b = norm(tag);
  return a === b || a.startsWith(`${b}:`) || b.startsWith(`${a}:`);
}

export function isModelInstalled(installed: string[], tag: string): boolean {
  return installed.some((name) => modelTagMatches(name, tag));
}

export function findRecommendation(tag: string): LocalModelRecommendation | undefined {
  return RECOMMENDED_LOCAL_MODELS.find(
    (model) => model.tag === tag || modelTagMatches(model.tag, tag),
  );
}

export function modelsByTier(): Map<LocalModelTier, LocalModelRecommendation[]> {
  const map = new Map<LocalModelTier, LocalModelRecommendation[]>();
  for (const tier of LOCAL_MODEL_TIERS) {
    map.set(
      tier.id,
      RECOMMENDED_LOCAL_MODELS.filter((model) => model.tier === tier.id),
    );
  }
  return map;
}

export function pullCommand(tag: string): string {
  return `ollama pull ${tag}`;
}
