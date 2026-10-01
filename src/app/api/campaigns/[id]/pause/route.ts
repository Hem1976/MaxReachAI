import { jsonError, jsonOk } from "@/lib/api";
import { pauseCampaignSend } from "@/lib/campaigns/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    return jsonOk(pauseCampaignSend(id));
  } catch (error) {
    return jsonError(error);
  }
}
