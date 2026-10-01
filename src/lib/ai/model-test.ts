import "server-only";

import { OUTREACH_JSON_SCHEMA, OutreachDraftSchema } from "@/lib/ai/schemas";
import { chat, type OllamaConfig } from "@/lib/ai/ollama";

export interface ModelTestResult {
  ok: boolean;
  model: string;
  durationMs: number;
  jsonValid: boolean;
  subjectPreview?: string;
  error?: string;
  hint?: string;
}

const TEST_SYSTEM = `You write B2B sales outreach as JSON only. Use realistic but fictional prospect details.
Product catalogue includes Rockey (field sales), MaxERP, and MaxCRM — pick Rockey for FMCG prospects.`;

const TEST_USER = `Write outreach JSON for:
Company: Sunrise Distributors
Industry: FMCG wholesale
Contact: Priya Sharma, Operations Head
Product to pitch: Rockey
Objective: start a conversation about field visibility.

Return valid JSON matching the schema. Keep the email under 90 words.`;

function extractJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("No JSON object in response");
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

/**
 * Smoke-test a local model with the same structured JSON contract as production.
 * Does not persist anything — safe to run from Settings.
 */
export async function testLocalModel(config: OllamaConfig): Promise<ModelTestResult> {
  const startedAt = Date.now();
  try {
    const response = await chat(config, {
      messages: [
        { role: "system", content: TEST_SYSTEM },
        { role: "user", content: TEST_USER },
      ],
      format: OUTREACH_JSON_SCHEMA,
      maxTokens: 520,
      temperature: Math.min(config.temperature, 0.6),
    });

    const parsed = extractJson(response.content);
    const draft = OutreachDraftSchema.safeParse(parsed);

    return {
      ok: draft.success,
      model: response.model,
      durationMs: response.durationMs || Date.now() - startedAt,
      jsonValid: draft.success,
      subjectPreview: draft.success
        ? draft.data.recommendedSubject || draft.data.subjects[0]
        : undefined,
      error: draft.success ? undefined : "Model returned JSON that failed validation.",
      hint: draft.success
        ? undefined
        : "Try a balanced-tier model (qwen2.5:7b or llama3.1:8b) for more reliable structured output.",
    };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    const hint =
      cause instanceof Error && "hint" in cause
        ? String((cause as Error & { hint?: string }).hint ?? "")
        : undefined;
    return {
      ok: false,
      model: config.model,
      durationMs: Date.now() - startedAt,
      jsonValid: false,
      error: message,
      hint,
    };
  }
}
