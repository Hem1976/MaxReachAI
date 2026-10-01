import { SettingsSchema } from "@/lib/ai/schemas";
import { jsonError, jsonOk } from "@/lib/api";
import { readSettings, writeSettings } from "@/lib/db/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return jsonOk({ settings: readSettings() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const settings = SettingsSchema.parse(await request.json());
    return jsonOk({ settings: writeSettings(settings) });
  } catch (error) {
    return jsonError(error);
  }
}
