import { jsonError, jsonOk } from "@/lib/api";
import { getCampaignSendProgress, startCampaignSend } from "@/lib/campaigns/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    return jsonOk(getCampaignSendProgress(id));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    return jsonOk(startCampaignSend(id));
  } catch (error) {
    return jsonError(error);
  }
}
