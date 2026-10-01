import { jsonError, jsonOk } from "@/lib/api";
import { listCompanies } from "@/lib/crm/companies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams.get("q") ?? "";
    return jsonOk({ companies: listCompanies(query) });
  } catch (error) {
    return jsonError(error);
  }
}
