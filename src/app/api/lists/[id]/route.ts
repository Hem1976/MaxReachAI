import { jsonError, jsonOk } from "@/lib/api";
import { deleteContactList, getContactList, listMembersForList } from "@/lib/crm/lists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const list = getContactList(id);
    if (!list) return jsonOk({ error: "List not found." }, 404);
    const members = listMembersForList(id);
    return jsonOk({ list, members, total: members.length });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!deleteContactList(id)) return jsonOk({ error: "List not found." }, 404);
    return jsonOk({ deleted: true });
  } catch (error) {
    return jsonError(error);
  }
}
