import { refineOutreach } from "@/lib/ai/generate";
import { RefineRequestSchema } from "@/lib/ai/schemas";
import { jsonError, jsonOk } from "@/lib/api";
import { readSettings } from "@/lib/db/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { action, brief, current } = RefineRequestSchema.parse(
      await request.json(),
    );
    const settings = readSettings();

    const outcome = await refineOutreach({ action, brief, current, settings });
    return jsonOk(outcome);
  } catch (error) {
    return jsonError(error);
  }
}
