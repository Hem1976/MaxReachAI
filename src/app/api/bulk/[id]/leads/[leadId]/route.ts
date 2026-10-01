import { BulkLeadPatchSchema } from "@/lib/ai/schemas";
import { jsonError, jsonOk } from "@/lib/api";
import { ensureBulkWorker } from "@/lib/bulk/worker";
import {
  findRunningJobId,
  getJob,
  getLead,
  patchLead,
  retryLeads,
  setJobStatus,
} from "@/lib/db/bulk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string; leadId: string }>;
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id, leadId } = await context.params;
    const job = getJob(id);
    if (!job) {
      return Response.json({ error: "Job not found." }, { status: 404 });
    }

    const lead = getLead(leadId);
    if (!lead || lead.jobId !== id) {
      return Response.json({ error: "Lead not found." }, { status: 404 });
    }

    const body = (await request.json()) as { retry?: boolean } & Record<string, unknown>;

    if (body.retry === true) {
      const other = findRunningJobId(id);
      if (other) {
        return Response.json(
          {
            error: "Another bulk job is already running.",
            hint: "Pause or wait for it to finish before retrying a row.",
          },
          { status: 409 },
        );
      }
      retryLeads(id, [leadId]);
      setJobStatus(id, "running");
      ensureBulkWorker(id);
      return jsonOk({ lead: getLead(leadId) });
    }

    const patch = BulkLeadPatchSchema.parse(body);
    const next = patchLead(leadId, patch);
    return jsonOk({ lead: next });
  } catch (error) {
    return jsonError(error);
  }
}
