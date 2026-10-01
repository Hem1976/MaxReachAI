import { testLocalModel } from "@/lib/ai/model-test";
import { jsonError, jsonOk } from "@/lib/api";
import { readSettings } from "@/lib/db/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      model?: string;
      baseUrl?: string;
    };
    const settings = readSettings();

    const result = await testLocalModel({
      baseUrl: body.baseUrl?.trim() || settings.ollamaBaseUrl,
      model: body.model?.trim() || settings.model,
      temperature: settings.temperature,
      timeoutMs: settings.requestTimeoutMs,
    });

    return jsonOk({ result });
  } catch (error) {
    return jsonError(error);
  }
}
