import { getStatus } from "@/lib/ai/ollama";
import { jsonError, jsonOk } from "@/lib/api";
import { readSettings } from "@/lib/db/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const settings = readSettings();

    // Settings can probe a base URL and model before saving them.
    const status = await getStatus({
      baseUrl: params.get("baseUrl") || settings.ollamaBaseUrl,
      model: params.get("model") || settings.model,
    });

    return jsonOk({ status });
  } catch (error) {
    return jsonError(error);
  }
}
