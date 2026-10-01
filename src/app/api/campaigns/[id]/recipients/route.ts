import { jsonError, jsonOk } from "@/lib/api";
import { addRecipients, addRecipientsFromList, listRecipients } from "@/lib/campaigns/recipients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const recipients = listRecipients(id);
    return jsonOk({ recipients, total: recipients.length });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { contactIds?: unknown; listId?: unknown };
    if (typeof body.listId === "string" && body.listId.trim()) {
      return jsonOk(addRecipientsFromList(id, body.listId.trim()));
    }
    const contactIds = Array.isArray(body.contactIds)
      ? body.contactIds.filter((value): value is string => typeof value === "string")
      : [];
    return jsonOk(addRecipients(id, contactIds));
  } catch (error) {
    return jsonError(error);
  }
}
