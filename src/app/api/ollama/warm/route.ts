import { warmUp } from "@/lib/ai/ollama";
import { jsonError, jsonOk } from "@/lib/api";
import { readSettings } from "@/lib/db/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Loads the model into memory. The first generation after a cold start is
 * several times slower than the rest, so Settings offers this as an explicit
 * action before a calling session.
 */
export async function POST() {
  try {
    const settings = readSettings();
    const startedAt = Date.now();

    await warmUp({
      baseUrl: settings.ollamaBaseUrl,
      model: settings.model,
      temperature: settings.temperature,
      timeoutMs: settings.requestTimeoutMs,
    });

    return jsonOk({ warmed: true, elapsedMs: Date.now() - startedAt });
  } catch (error) {
    return jsonError(error);
  }
}
