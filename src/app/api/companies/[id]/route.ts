import { jsonError, jsonOk } from "@/lib/api";
import { getCompanyDetail } from "@/lib/crm/companies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const company = getCompanyDetail(id);
    if (!company) {
      return Response.json({ error: "Company not found." }, { status: 404 });
    }
    return jsonOk({ company });
  } catch (error) {
    return jsonError(error);
  }
}
