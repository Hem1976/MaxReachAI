import { ListMemberUpdateSchema } from "@/lib/ai/schemas";
import { jsonError, jsonOk } from "@/lib/api";
import { isContactInList, listMembersForList, updateListMember } from "@/lib/crm/lists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; contactId: string }> },
) {
  try {
    const { id, contactId } = await context.params;
    if (!isContactInList(id, contactId)) {
      return jsonOk({ error: "Contact not found in this list." }, 404);
    }
    const body = ListMemberUpdateSchema.parse(await request.json());
    const member = updateListMember(id, contactId, body);
    if (!member) return jsonOk({ error: "Could not update this row." }, 404);
    return jsonOk({ member });
  } catch (error) {
    return jsonError(error);
  }
}
