import { jsonError, jsonOk } from "@/lib/api";
import {
  deleteCampaignAttachment,
  listCampaignAttachments,
} from "@/lib/campaigns/attachments";
import { getCampaign } from "@/lib/campaigns/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string; attachmentId: string }>;
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { id, attachmentId } = await context.params;
    if (!getCampaign(id)) {
      return Response.json({ error: "Campaign not found." }, { status: 404 });
    }

    if (!deleteCampaignAttachment(id, attachmentId)) {
      return Response.json({ error: "Attachment not found." }, { status: 404 });
    }

    return jsonOk({ attachments: listCampaignAttachments(id) });
  } catch (error) {
    return jsonError(error);
  }
}
