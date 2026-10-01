import { z } from "zod";

import { jsonError, jsonOk } from "@/lib/api";
import { ensureBulkWorker, isBulkWorkerActive } from "@/lib/bulk/worker";
import {
  deleteJob,
  findRunningJobId,
  getJobSnapshot,
  remainingCount,
  resetGeneratingLeads,
  retryLeads,
  setJobStatus,
} from "@/lib/db/bulk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

const PatchSchema = z.object({
  action: z.enum(["pause", "resume", "retry-failed"]),
});

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const snapshot = getJobSnapshot(id);
    if (!snapshot) {
      return Response.json({ error: "Job not found." }, { status: 404 });
    }

    if (snapshot.job.status === "running" && !isBulkWorkerActive(id)) {
      ensureBulkWorker(id);
    }

    return jsonOk({
      ...snapshot,
      workerActive: isBulkWorkerActive(id),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const snapshot = getJobSnapshot(id);
    if (!snapshot) {
      return Response.json({ error: "Job not found." }, { status: 404 });
    }

    const { action } = PatchSchema.parse(await request.json());

    if (action === "pause") {
      setJobStatus(id, "paused");
      return jsonOk(getJobSnapshot(id));
    }

    if (action === "retry-failed") {
      const other = findRunningJobId(id);
      if (other) {
        return Response.json(
          {
            error: "Another bulk job is already running.",
            hint: "Pause or wait for it to finish before retrying this one.",
          },
          { status: 409 },
        );
      }
      retryLeads(id);
      if (remainingCount(id) > 0) {
        resetGeneratingLeads(id);
        setJobStatus(id, "running");
        ensureBulkWorker(id);
      }
      return jsonOk(getJobSnapshot(id));
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

    if (remainingCount(id) === 0 && snapshot.job.totals.failed === 0) {
      setJobStatus(id, "completed");
      return jsonOk(getJobSnapshot(id));
    }

    resetGeneratingLeads(id);
    setJobStatus(id, "running");
    ensureBulkWorker(id);
    return jsonOk(getJobSnapshot(id));
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const snapshot = getJobSnapshot(id);
    if (!snapshot) {
      return Response.json({ error: "Job not found." }, { status: 404 });
    }
    if (snapshot.job.status === "running") {
      setJobStatus(id, "paused");
    }
    deleteJob(id);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
