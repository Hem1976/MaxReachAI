import { CompanyImportSchema } from "@/lib/ai/schemas";
import { jsonError, jsonOk } from "@/lib/api";
import { importCompaniesFromRows } from "@/lib/crm/import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = CompanyImportSchema.parse(await request.json());
    const summary = importCompaniesFromRows({
      rows: body.rows,
      mapping: body.mapping,
    });
    return jsonOk(summary, 201);
  } catch (error) {
    return jsonError(error);
  }
}
