import { jsonError, jsonOk } from "@/lib/api";
import { ensureBulkWorker } from "@/lib/bulk/worker";
import {
  findRunningJobId,
  getJob,
  remainingCount,
  resetGeneratingLeads,
  setJobStatus,
} from "@/lib/db/bulk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const job = getJob(id);
    if (!job) {
      return Response.json({ error: "Job not found." }, { status: 404 });
    }

    const other = findRunningJobId(id);
    if (other) {
      return Response.json(
        {
          error: "Another bulk job is already running.",
          hint: "Only one list runs at a time so the local model stays stable.",
        },
        { status: 409 },
      );
    }

    if (remainingCount(id) === 0) {
      setJobStatus(id, "completed");
      return jsonOk({ job: getJob(id) });
    }

    resetGeneratingLeads(id);
    setJobStatus(id, "running");
    ensureBulkWorker(id);
    return jsonOk({ job: getJob(id) });
  } catch (error) {
    return jsonError(error);
  }
}
