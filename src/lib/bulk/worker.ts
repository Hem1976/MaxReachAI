import "server-only";

import { generateOutreach } from "@/lib/ai/generate";
import { OllamaError, warmUp } from "@/lib/ai/ollama";
import { evaluateQuality } from "@/lib/bulk/quality";
import type { BulkLead } from "@/lib/bulk/types";
import {
  briefFromLead,
  failLead,
  getJob,
  remainingCount,
  resetGeneratingLeads,
  saveLeadResult,
  setJobStatus,
  takeQueuedBatch,
  touchJob,
  updateLeadStage,
} from "@/lib/db/bulk";
import { saveHistory } from "@/lib/db/history";
import { readSettings } from "@/lib/db/settings";
import { detectProducts, getProduct } from "@/lib/products";

const globalCache = globalThis as typeof globalThis & {
  __maxreachBulkWorkers?: Map<string, Promise<void>>;
};

function workers(): Map<string, Promise<void>> {
  if (!globalCache.__maxreachBulkWorkers) {
    globalCache.__maxreachBulkWorkers = new Map();
  }
  return globalCache.__maxreachBulkWorkers;
}

export function isBulkWorkerActive(jobId: string): boolean {
  return workers().has(jobId);
}

/**
 * Starts or resumes the local queue for one job. Progress is written to SQLite
 * after every lead so a refresh can pick up if this process was restarted.
 *
 * In-flight Ollama calls are allowed to finish when the job is paused; the
 * pause takes effect before the next batch is claimed.
 */
export function ensureBulkWorker(jobId: string): void {
  const active = workers();
  if (active.has(jobId)) return;

  const promise = runBulkJob(jobId).finally(() => {
    active.delete(jobId);
  });
  active.set(jobId, promise);
}

async function runBulkJob(jobId: string): Promise<void> {
  resetGeneratingLeads(jobId);

  const started = getJob(jobId);
  if (!started || started.status === "paused") return;

  setJobStatus(jobId, "running");

  const settings = readSettings();
  try {
    await warmUp({
      baseUrl: settings.ollamaBaseUrl,
      model: settings.model,
      temperature: settings.temperature,
      timeoutMs: settings.requestTimeoutMs,
    });
  } catch {
    // Warm-up is best-effort; generation still runs if it fails.
  }

  try {
    while (true) {
      const job = getJob(jobId);
      if (!job) return;
      if (job.status === "paused") return;

      const batchSize = Math.min(Math.max(job.concurrency, 1), 8);
      const batch = takeQueuedBatch(jobId, batchSize);
      if (batch.length === 0) {
        if (remainingCount(jobId) === 0) {
          setJobStatus(jobId, "completed");
        }
        return;
      }

      await Promise.all(batch.map((lead) => processLead(jobId, lead)));
      touchJob(jobId);
    }
  } catch (error) {
    setJobStatus(jobId, "failed", humanError(error));
  }
}

async function processLead(jobId: string, lead: BulkLead): Promise<void> {
  const job = getJob(jobId);
  if (!job) return;

  try {
    updateLeadStage(lead.id, "normalize");

    const baseBrief = briefFromLead(job, lead);
    if (!baseBrief.company.trim()) {
      failLead(lead.id, "No company name in this row.");
      return;
    }

    // Industry is whatever the CSV provided. An empty cell stays empty —
    // we do not guess it from the company name or website.
    updateLeadStage(lead.id, "industry");

    updateLeadStage(lead.id, "product");
    const detection = detectProducts(baseBrief);
    const forced = job.product === "auto" ? undefined : getProduct(job.product);
    const matched = forced ?? detection[0]?.product;
    if (matched) {
      updateLeadStage(lead.id, "product", {
        productId: matched.id,
        productName: matched.name,
      });
    }

    updateLeadStage(lead.id, "personalize");
    updateLeadStage(lead.id, "generate");

    // Lock the matched product so the model sees one catalogue entry, not two.
    const brief =
      job.product === "auto" && matched
        ? { ...baseBrief, product: matched.id }
        : baseBrief;

    const settings = readSettings();
    const { result } = await generateOutreach({ brief, settings });

    updateLeadStage(lead.id, "validate");

    const history = saveHistory({
      brief,
      result: {
        productId: result.productId,
        productName: result.productName,
        painPoint: result.painPoint,
        angle: result.angle,
        subjects: result.subjects,
        recommendedSubject: result.recommendedSubject,
        email: result.email,
        cta: result.cta,
        followUp: result.followUp,
        confidenceScore: result.confidence.score,
        reviewFlags: result.reviewFlags,
        model: result.model,
      },
    });

    const quality = evaluateQuality({
      company: lead.company,
      industry: lead.industry,
      jobTitle: lead.jobTitle,
      notes: lead.notes,
      productName: result.productName,
      subjects: result.subjects,
      recommendedSubject: result.recommendedSubject,
      emailBody: result.email,
      cta: result.cta,
      followUp1: result.followUp,
      followUp2: result.followUp2 ?? "",
      reviewFlags: result.reviewFlags,
      confidenceScore: result.confidence.score,
    });

    saveLeadResult(lead.id, {
      status: quality.ready ? "ready" : "needs_review",
      productId: result.productId,
      productName: result.productName,
      painPoint: result.painPoint,
      angle: result.angle,
      subjects: result.subjects,
      recommendedSubject: result.recommendedSubject,
      emailBody: result.email,
      cta: result.cta,
      followUp1: result.followUp,
      followUp2: result.followUp2 ?? "",
      reviewFlags: result.reviewFlags,
      confidenceScore: Math.round(result.confidence.score),
      historyId: history.id,
      elapsedMs: result.elapsedMs,
    });
  } catch (error) {
    failLead(lead.id, humanError(error));
  }
}

function humanError(error: unknown): string {
  if (error instanceof OllamaError) {
    return error.hint ? `${error.message}. ${error.hint}` : error.message;
  }
  return error instanceof Error ? error.message : "Generation failed.";
}
