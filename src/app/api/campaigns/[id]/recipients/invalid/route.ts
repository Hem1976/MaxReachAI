import { jsonError, jsonOk } from "@/lib/api";
import { getCampaign } from "@/lib/campaigns/store";
import { removeInvalidRecipients } from "@/lib/campaigns/recipients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const result = removeInvalidRecipients(id);
    return jsonOk({
      ...result,
      campaign: getCampaign(id),
    });
  } catch (error) {
    return jsonError(error);
  }
}
