import { CampaignCreateSchema } from "@/lib/ai/schemas";
import { jsonError, jsonOk } from "@/lib/api";
import { CampaignError, createCampaign, listCampaigns } from "@/lib/campaigns/store";
import { CAMPAIGN_STATUSES, type CampaignStatus } from "@/lib/campaigns/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    const statusRaw = url.searchParams.get("status") ?? "";
    const status = statusRaw
      ? (CAMPAIGN_STATUSES as readonly string[]).includes(statusRaw)
        ? (statusRaw as CampaignStatus)
            : (() => {
            throw new CampaignError("Invalid campaign status.");
          })()
      : undefined;
    return jsonOk({ campaigns: listCampaigns({ q, status }) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = CampaignCreateSchema.parse(await request.json());
    const campaign = createCampaign(body);
    return jsonOk({ campaign }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
