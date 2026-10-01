import { jsonError, jsonOk } from "@/lib/api";
import { listContactLists } from "@/lib/crm/lists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return jsonOk({ lists: listContactLists(50) });
  } catch (error) {
    return jsonError(error);
  }
}
