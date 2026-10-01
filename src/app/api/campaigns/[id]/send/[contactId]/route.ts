import { jsonError, jsonOk } from "@/lib/api";
import { sendCampaignRecipient } from "@/lib/campaigns/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; contactId: string }> },
) {
  try {
    const { id, contactId } = await context.params;
    const { recipient } = await sendCampaignRecipient(id, contactId, {
      allowCampaignStatuses: ["ready", "paused"],
    });
    return jsonOk({
      success: true,
      recipient: {
        id: recipient.id,
        status: recipient.status,
        sentAt: recipient.sentAt,
        providerMessageId: recipient.providerMessageId,
        error: recipient.error,
        contactId: recipient.contactId,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
