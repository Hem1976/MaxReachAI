import { BulkCreateSchema } from "@/lib/ai/schemas";
import { jsonError, jsonOk } from "@/lib/api";
import { createJob, listJobs } from "@/lib/db/bulk";
import { getTemplateOrDefault } from "@/lib/templates/catalog.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return jsonOk({ jobs: listJobs(20) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = BulkCreateSchema.parse(await request.json());
    const job = createJob({
      filename: body.filename,
      rows: body.rows,
      mapping: body.mapping,
      config: {
        templateId: getTemplateOrDefault(body.templateId).id,
        product: body.product,
        objective: body.objective,
        tone: body.tone,
        length: body.length,
        concurrency: body.concurrency,
      },
    });
    return jsonOk({ job }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
