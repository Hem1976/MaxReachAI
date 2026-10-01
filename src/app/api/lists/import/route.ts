import { CompanyImportSchema } from "@/lib/ai/schemas";
import { jsonError, jsonOk } from "@/lib/api";
import { importContactList } from "@/lib/crm/lists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = CompanyImportSchema.parse(await request.json());
    const summary = importContactList({
      name: body.filename?.replace(/\.csv$/i, "") ?? "Imported list",
      filename: body.filename,
      rows: body.rows,
      mapping: body.mapping,
    });
    return jsonOk(summary, 201);
  } catch (error) {
    return jsonError(error);
  }
}
