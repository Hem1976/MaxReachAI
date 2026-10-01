"use client";

import { useRef, useState } from "react";
import { FileUp, LoaderCircle, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { CampaignAttachment } from "@/lib/campaigns/attachments-client";
import {
  CAMPAIGN_ATTACHMENT_ACCEPT,
  formatBytes,
  MAX_ATTACHMENTS_TOTAL_BYTES,
  MAX_CAMPAIGN_ATTACHMENTS,
} from "@/lib/campaigns/attachments-client";
import type { Campaign } from "@/lib/campaigns/types";

type UploadError = { filename: string; error: string };

export function CampaignAttachmentsPanel({
  campaignId,
  campaignStatus,
  initialAttachments,
  disabled,
  onAttachmentsChange,
  onCampaignUpdated,
}: {
  campaignId: string;
  campaignStatus: Campaign["status"];
  initialAttachments: CampaignAttachment[];
  disabled?: boolean;
  onAttachmentsChange?: (attachments: CampaignAttachment[]) => void;
  onCampaignUpdated?: (campaign: Campaign) => void;
}) {
  const [attachments, setAttachments] = useState(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState("");
  const [lastErrors, setLastErrors] = useState<UploadError[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalBytes = attachments.reduce((sum, item) => sum + item.sizeBytes, 0);
  const locked = disabled || campaignStatus === "sending";
  const slotsLeft = MAX_CAMPAIGN_ATTACHMENTS - attachments.length;

  async function refreshCampaignStatus() {
    const response = await fetch(`/api/campaigns/${campaignId}`);
    const payload = (await response.json()) as { campaign?: Campaign };
    if (payload.campaign) onCampaignUpdated?.(payload.campaign);
  }

  async function handleUpload(fileList: FileList | null) {
    if (!fileList?.length || locked) return;

    const files = Array.from(fileList).slice(0, slotsLeft);
    if (!files.length) {
      toast.error(`You can attach up to ${MAX_CAMPAIGN_ATTACHMENTS} files per campaign.`);
      return;
    }

    if (fileList.length > files.length) {
      toast.message(`Only ${files.length} file(s) added — attachment limit is ${MAX_CAMPAIGN_ATTACHMENTS}.`);
    }

    setUploading(true);
    setLastErrors([]);
    try {
      const form = new FormData();
      for (const file of files) {
        form.append("files", file);
      }

      const response = await fetch(`/api/campaigns/${campaignId}/attachments`, {
        method: "POST",
        body: form,
      });
      const payload = (await response.json()) as {
        attachments?: CampaignAttachment[];
        added?: CampaignAttachment[];
        errors?: UploadError[];
        error?: string;
      };

      const next = payload.attachments ?? [];
      if (next.length) {
        setAttachments(next);
        onAttachmentsChange?.(next);
        await refreshCampaignStatus();
      }

      const uploadErrors = payload.errors ?? [];
      setLastErrors(uploadErrors);

      const addedCount = payload.added?.length ?? (response.ok ? files.length : 0);
      if (addedCount > 0 && uploadErrors.length === 0) {
        toast.success(
          addedCount === 1
            ? `Attached ${payload.added?.[0]?.filename ?? files[0].name}`
            : `Attached ${addedCount} files`,
        );
      } else if (addedCount > 0 && uploadErrors.length > 0) {
        toast.message(`Attached ${addedCount} file(s). ${uploadErrors.length} could not be added.`);
      } else if (!response.ok) {
        throw new Error(payload.error ?? uploadErrors[0]?.error ?? "Could not upload attachments.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function removeAttachment(attachmentId: string) {
    if (locked) return;
    setRemovingId(attachmentId);
    try {
      const response = await fetch(
        `/api/campaigns/${campaignId}/attachments/${attachmentId}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as {
        attachments?: CampaignAttachment[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not remove the attachment.");
      }
      const next = payload.attachments ?? [];
      setAttachments(next);
      onAttachmentsChange?.(next);
      setLastErrors([]);
      await refreshCampaignStatus();
      toast.success("Attachment removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Remove failed.");
    } finally {
      setRemovingId("");
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface-raised px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Paperclip className="size-4" />
            Attachments
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            PDF, Office files, images, videos (MP4, MOV, WEBM), TXT, CSV, or ZIP. Up to{" "}
            {MAX_CAMPAIGN_ATTACHMENTS} files, {formatBytes(MAX_ATTACHMENTS_TOTAL_BYTES)} total. Select
            multiple files at once.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            disabled={locked || uploading || slotsLeft <= 0}
            accept={CAMPAIGN_ATTACHMENT_ACCEPT}
            onChange={(event) => {
              void handleUpload(event.target.files);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={locked || uploading || slotsLeft <= 0}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <LoaderCircle className="size-3.5 animate-spin" /> : <FileUp className="size-3.5" />}
            Add files
          </Button>
        </div>
      </div>

      {attachments.length ? (
        <ul className="mt-3 divide-y divide-border rounded-md border border-border bg-background">
          {attachments.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{item.filename}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(item.sizeBytes)}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="shrink-0 text-muted-foreground hover:text-danger"
                disabled={locked || removingId === item.id}
                onClick={() => void removeAttachment(item.id)}
              >
                {removingId === item.id ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No attachments yet.</p>
      )}

      {attachments.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {attachments.length} / {MAX_CAMPAIGN_ATTACHMENTS} files · Total{" "}
          {formatBytes(totalBytes)} / {formatBytes(MAX_ATTACHMENTS_TOTAL_BYTES)}
        </p>
      ) : null}

      {lastErrors.length ? (
        <ul className="mt-2 space-y-1 text-xs text-danger">
          {lastErrors.map((item) => (
            <li key={`${item.filename}:${item.error}`}>
              {item.filename}: {item.error}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
