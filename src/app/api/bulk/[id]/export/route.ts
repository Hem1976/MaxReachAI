import { jsonError } from "@/lib/api";
import { exportLeadsCsv } from "@/lib/bulk/export";
import { getJob, listLeads } from "@/lib/db/bulk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const job = getJob(id);
    if (!job) {
      return Response.json({ error: "Job not found." }, { status: 404 });
    }

    const csv = exportLeadsCsv(listLeads(id));
    const safeName = job.filename.replace(/\.csv$/i, "").replace(/[^\w.-]+/g, "-");
    const filename = `${safeName || "maxreach"}-outreach.csv`;

    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
