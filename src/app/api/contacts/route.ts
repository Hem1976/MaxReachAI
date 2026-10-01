import { jsonError, jsonOk } from "@/lib/api";
import { searchContacts } from "@/lib/crm/contacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const hasEmailRaw = params.get("hasEmail");
    const hasEmail =
      hasEmailRaw === "1" || hasEmailRaw === "true"
        ? true
        : hasEmailRaw === "0" || hasEmailRaw === "false"
          ? false
          : undefined;
    const limitRaw = Number(params.get("limit") ?? "50");
    return jsonOk({
      contacts: searchContacts({
        q: params.get("q") ?? "",
        industry: params.get("industry") ?? "",
        companyId: params.get("companyId") ?? "",
        hasEmail,
        limit: Number.isFinite(limitRaw) ? limitRaw : 50,
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}
