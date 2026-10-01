import { jsonError, jsonOk } from "@/lib/api";
import { getRecipientCount } from "@/lib/campaigns/recipients";
import { getCampaign } from "@/lib/campaigns/store";
import { markCampaignReady, validateCampaign } from "@/lib/campaigns/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const campaign = getCampaign(id);
    if (!campaign) {
      return Response.json({ error: "Campaign not found." }, { status: 404 });
    }
    const validation = validateCampaign(id);
    return jsonOk({
      campaign,
      recipientCount: validation.recipientCount || getRecipientCount(id),
      validation,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (!getCampaign(id)) {
      return Response.json({ error: "Campaign not found." }, { status: 404 });
    }
    const result = markCampaignReady(id);
    return jsonOk({
      campaign: result.campaign,
      recipientCount: result.validation.recipientCount,
      validation: result.validation,
    });
  } catch (error) {
    return jsonError(error);
  }
}
