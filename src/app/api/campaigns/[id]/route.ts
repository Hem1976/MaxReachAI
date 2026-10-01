import { CampaignPatchSchema } from "@/lib/ai/schemas";
import { jsonError, jsonOk } from "@/lib/api";
import { purgeCampaignAttachmentFiles } from "@/lib/campaigns/attachments";
import { deleteCampaign, getCampaign, updateCampaign } from "@/lib/campaigns/store";

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
    return jsonOk({ campaign });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const patch = CampaignPatchSchema.parse(await request.json());
    const campaign = updateCampaign(id, patch);
    return jsonOk({ campaign });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (!getCampaign(id)) {
      return Response.json({ error: "Campaign not found." }, { status: 404 });
    }
    purgeCampaignAttachmentFiles(id);
    if (!deleteCampaign(id)) {
      return Response.json({ error: "Campaign not found." }, { status: 404 });
    }
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
