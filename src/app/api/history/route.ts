import { jsonError, jsonOk } from "@/lib/api";
import { listHistory } from "@/lib/db/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const search = new URL(request.url).searchParams.get("q") ?? "";
    return jsonOk({ records: listHistory({ search }) });
  } catch (error) {
    return jsonError(error);
  }
}
