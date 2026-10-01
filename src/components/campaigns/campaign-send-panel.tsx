"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Campaign, CampaignValidation } from "@/lib/campaigns/types";

export interface SendProgress {
  campaignId: string;
  status: Campaign["status"];
  total: number;
  queued: number;
  sending: number;
  sent: number;
  failed: number;
  bounced: number;
  skipped: number;
}

export function CampaignSendPanel({
  campaign,
  refreshKey,
  onCampaignUpdated,
  onRecipientsChanged,
}: {
  campaign: Campaign;
  refreshKey: number;
  onCampaignUpdated: (campaign: Campaign) => void;
  onRecipientsChanged: () => void;
}) {
  const [progress, setProgress] = useState<SendProgress | null>(null);
  const [validation, setValidation] = useState<CampaignValidation | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const onCampaignUpdatedRef = useRef(onCampaignUpdated);
  onCampaignUpdatedRef.current = onCampaignUpdated;

  const load = useCallback(async () => {
    const reviewRes = await fetch(`/api/campaigns/${campaign.id}/review`);
    const review = (await reviewRes.json()) as {
      campaign?: Campaign;
      validation?: CampaignValidation;
      error?: string;
    };
    if (review.campaign) onCampaignUpdatedRef.current(review.campaign);
    if (review.validation) setValidation(review.validation);

    try {
      const statusRes = await fetch(`/api/campaigns/${campaign.id}/send`);
      if (statusRes.ok) {
        const status = (await statusRes.json()) as SendProgress;
        setProgress(status);
      }
    } catch {
      // Send progress is optional while drafting; review data still drives Mark ready.
    }
  }, [campaign.id]);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load, refreshKey, campaign.status]);

  useEffect(() => {
    if (campaign.status !== "sending") return;
    const timer = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [campaign.id, campaign.status, load]);

  async function markReady() {
    setBusy(true);
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/review`, { method: "POST" });
      const data = (await response.json()) as {
        campaign?: Campaign;
        validation?: CampaignValidation;
        error?: string;
      };
      if (data.validation) setValidation(data.validation);
      if (data.campaign) onCampaignUpdated(data.campaign);
      if (!response.ok) throw new Error(data.error ?? "Not ready yet.");
      toast.success("Ready to send");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Not ready yet.");
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    setBusy(true);
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/send`, { method: "POST" });
      const data = (await response.json()) as {
        campaign?: Campaign;
        progress?: SendProgress;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Could not send.");
      if (data.campaign) onCampaignUpdated(data.campaign);
      if (data.progress) setProgress(data.progress);
      setConfirm(false);
      toast.success("Sending started");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  }

  async function pause() {
    setBusy(true);
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/pause`, { method: "POST" });
      const data = (await response.json()) as { campaign?: Campaign; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not pause.");
      if (data.campaign) onCampaignUpdated(data.campaign);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not pause.");
    } finally {
      setBusy(false);
    }
  }

  async function resume() {
    setBusy(true);
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/resume`, { method: "POST" });
      const data = (await response.json()) as { campaign?: Campaign; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not resume.");
      if (data.campaign) onCampaignUpdated(data.campaign);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not resume.");
    } finally {
      setBusy(false);
    }
  }

  async function removeInvalid() {
    setBusy(true);
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/recipients/invalid`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Could not clean the list.");
      onRecipientsChanged();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not clean the list.");
    } finally {
      setBusy(false);
    }
  }

  const ready = Boolean(validation?.ready);
  const queued = progress?.queued ?? 0;
  const canMarkReady =
    campaign.status === "draft" ||
    campaign.status === "paused" ||
    campaign.status === "ready" ||
    campaign.status === "completed";

  return (
    <section className="flex flex-col gap-3">
      {validation === null ? (
        <p className="text-sm text-muted-foreground">Checking campaign…</p>
      ) : null}

      {validation && !ready ? (
        <div className="text-sm text-muted-foreground">
          <p className="text-foreground">Finish these before sending:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {validation.errors.map((issue) => (
              <li key={`${issue.code}-${issue.message}`}>{issue.message}</li>
            ))}
          </ul>
          {validation.warnings.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-warning">
              {validation.warnings.map((issue) => (
                <li key={`${issue.code}-${issue.message}`}>{issue.message}</li>
              ))}
            </ul>
          ) : null}
          {validation.invalidRecipientCount > 0 ? (
            <Button className="mt-2" size="sm" variant="outline" disabled={busy} onClick={() => void removeInvalid()}>
              Remove people without email
            </Button>
          ) : null}
        </div>
      ) : null}

      {validation && ready && campaign.status === "draft" ? (
        <p className="text-sm text-muted-foreground">Campaign checks passed. Mark it ready, then send.</p>
      ) : null}

      {progress && (campaign.status === "sending" || campaign.status === "completed" || campaign.status === "paused" || campaign.status === "failed") ? (
        <p className="text-sm text-muted-foreground">
          {progress.sent} sent · {progress.queued} waiting · {progress.failed} failed
        </p>
      ) : null}

      {campaign.ccEnabled ? (
        <p className="text-sm text-muted-foreground">
          CC: <span className="text-foreground">{campaign.ccEmail}</span>
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canMarkReady && campaign.status !== "ready" && campaign.status !== "sending" ? (
          <Button variant="outline" disabled={busy || !ready} onClick={() => void markReady()}>
            Mark ready
          </Button>
        ) : null}
        {campaign.status === "ready" ? (
          <Button variant="primary" disabled={busy} onClick={() => setConfirm(true)}>
            Send to {queued || progress?.total || 0} people
          </Button>
        ) : null}
        {campaign.status === "sending" ? (
          <Button variant="outline" disabled={busy} onClick={() => void pause()}>
            Pause
          </Button>
        ) : null}
        {campaign.status === "paused" ? (
          <Button variant="primary" disabled={busy} onClick={() => void resume()}>
            Resume
          </Button>
        ) : null}
      </div>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send to {queued} people?</DialogTitle>
            <DialogDescription>
              This sends real email now.
              {campaign.ccEnabled
                ? ` A copy will be CC'd to ${campaign.ccEmail} on each message.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" disabled={busy} onClick={() => void start()}>
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
