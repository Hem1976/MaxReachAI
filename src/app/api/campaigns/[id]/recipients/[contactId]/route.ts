import { jsonError, jsonOk } from "@/lib/api";
import { getRecipientCount, removeRecipient } from "@/lib/campaigns/recipients";
import { CampaignError } from "@/lib/campaigns/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; contactId: string }> },
) {
  try {
    const { id, contactId } = await context.params;
    const removed = removeRecipient(id, contactId);
    if (!removed) throw new CampaignError("Recipient not found.");
    return jsonOk({ ok: true, total: getRecipientCount(id) });
  } catch (error) {
    return jsonError(error);
  }
}
