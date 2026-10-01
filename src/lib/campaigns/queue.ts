import "server-only";

import { countRecipientsByStatus, listQueuedContactIds } from "@/lib/campaigns/recipients";
import { sendCampaignRecipient } from "@/lib/campaigns/send";
import { getCampaign, writeCampaignStatus } from "@/lib/campaigns/store";
import type { Campaign } from "@/lib/campaigns/types";
import { validateCampaign } from "@/lib/campaigns/validation";
import { getMailProvider } from "@/lib/mail/provider";
import { CampaignSendError, MailConfigError } from "@/lib/mail/types";

export const CAMPAIGN_SEND_CONCURRENCY = 2;
export const CAMPAIGN_SEND_DELAY_MS = 1000;

type QueueHandle = { running: boolean };

const globalCache = globalThis as typeof globalThis & {
  __maxreachCampaignQueues?: Map<string, QueueHandle>;
};

function runners(): Map<string, QueueHandle> {
  globalCache.__maxreachCampaignQueues ??= new Map();
  return globalCache.__maxreachCampaignQueues;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getCampaignSendProgress(campaignId: string) {
  const campaign = getCampaign(campaignId);
  if (!campaign) throw new CampaignSendError("Campaign not found.", 404);
  const counts = countRecipientsByStatus(campaignId);
  return {
    campaignId,
    status: campaign.status,
    ...counts,
  };
}

function finalizeCampaign(campaignId: string): Campaign {
  const counts = countRecipientsByStatus(campaignId);
  const next = counts.sent === 0 && counts.failed > 0 ? "failed" : "completed";
  return writeCampaignStatus(campaignId, next);
}

async function runQueue(campaignId: string, handle: QueueHandle): Promise<void> {
  try {
    while (handle.running) {
      const campaign = getCampaign(campaignId);
      if (!campaign || campaign.status !== "sending") break;

      const ids = listQueuedContactIds(campaignId, CAMPAIGN_SEND_CONCURRENCY);
      if (ids.length === 0) {
        if (countRecipientsByStatus(campaignId).sending > 0) {
          await sleep(CAMPAIGN_SEND_DELAY_MS);
          continue;
        }
        if (getCampaign(campaignId)?.status === "sending") finalizeCampaign(campaignId);
        break;
      }

      await Promise.all(
        ids.map(async (contactId) => {
          try {
            await sendCampaignRecipient(campaignId, contactId, {
              allowCampaignStatuses: ["sending"],
            });
          } catch {
            // Recipient is already failed/skipped; keep the rest of the queue moving.
          }
        }),
      );

      if (getCampaign(campaignId)?.status !== "sending") break;
      await sleep(CAMPAIGN_SEND_DELAY_MS);
    }
  } catch {
    const current = getCampaign(campaignId);
    if (current?.status === "sending") writeCampaignStatus(campaignId, "failed");
  } finally {
    runners().delete(campaignId);
  }
}

function startRunner(campaignId: string): void {
  const existing = runners().get(campaignId);
  if (existing?.running) return;
  const handle: QueueHandle = { running: true };
  runners().set(campaignId, handle);
  void runQueue(campaignId, handle);
}

function requireProvider(): void {
  try {
    getMailProvider();
  } catch (error) {
    if (error instanceof MailConfigError) {
      throw new CampaignSendError(error.message, 503, "provider_not_configured");
    }
    throw error;
  }
}

export function startCampaignSend(campaignId: string) {
  const campaign = getCampaign(campaignId);
  if (!campaign) throw new CampaignSendError("Campaign not found.", 404);

  if (campaign.status === "sending" && runners().get(campaignId)?.running) {
    return { campaign, progress: getCampaignSendProgress(campaignId), started: false };
  }

  if (campaign.status !== "ready" && campaign.status !== "sending") {
    throw new CampaignSendError("Campaign is not ready.", 409, "not_ready");
  }

  const validation = validateCampaign(campaignId);
  if (!validation.ready) {
    throw new CampaignSendError(
      validation.errors[0]?.message ?? "Campaign is not ready.",
      422,
      "not_ready",
    );
  }

  const queued = countRecipientsByStatus(campaignId).queued;
  if (queued === 0) {
    throw new CampaignSendError("No queued recipients to send.", 409, "no_queued");
  }

  requireProvider();

  const next = writeCampaignStatus(campaignId, "sending");
  startRunner(campaignId);
  return { campaign: next, progress: getCampaignSendProgress(campaignId), started: true };
}

export function pauseCampaignSend(campaignId: string) {
  const campaign = getCampaign(campaignId);
  if (!campaign) throw new CampaignSendError("Campaign not found.", 404);
  if (campaign.status !== "sending") {
    throw new CampaignSendError("Only a sending campaign can be paused.", 409);
  }
  const handle = runners().get(campaignId);
  if (handle) handle.running = false;
  const next = writeCampaignStatus(campaignId, "paused");
  return { campaign: next, progress: getCampaignSendProgress(campaignId) };
}

export function resumeCampaignSend(campaignId: string) {
  const campaign = getCampaign(campaignId);
  if (!campaign) throw new CampaignSendError("Campaign not found.", 404);
  if (campaign.status !== "paused") {
    throw new CampaignSendError("Only a paused campaign can be resumed.", 409);
  }

  const validation = validateCampaign(campaignId);
  if (!validation.ready) {
    throw new CampaignSendError(
      validation.errors[0]?.message ?? "Campaign is not ready.",
      422,
      "not_ready",
    );
  }

  const queued = countRecipientsByStatus(campaignId).queued;
  if (queued === 0) {
    throw new CampaignSendError("No queued recipients to send.", 409, "no_queued");
  }

  requireProvider();

  const next = writeCampaignStatus(campaignId, "sending");
  startRunner(campaignId);
  return { campaign: next, progress: getCampaignSendProgress(campaignId), started: true };
}
