import "server-only";

import { mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { randomUUID } from "node:crypto";

import {
  assertCampaignNotSending,
  CampaignError,
  getCampaign,
  revertCampaignOnSendContentChange,
} from "@/lib/campaigns/store";
import { getDb } from "@/lib/db/client";

export const MAX_CAMPAIGN_ATTACHMENTS = 5;
/** Per-file cap; Postmark allows ~10 MB total per message including HTML. */
export const MAX_ATTACHMENT_BYTES = 9 * 1024 * 1024;
export const MAX_ATTACHMENTS_TOTAL_BYTES = 9 * 1024 * 1024;

const ATTACHMENTS_ROOT = join(process.cwd(), "data", "campaign-attachments");

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".csv",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".zip",
  ".mp4",
  ".mov",
  ".webm",
  ".avi",
  ".mkv",
  ".m4v",
  ".mpeg",
  ".mpg",
  ".wmv",
  ".3gp",
]);

const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".zip": "application/zip",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  ".m4v": "video/x-m4v",
  ".mpeg": "video/mpeg",
  ".mpg": "video/mpeg",
  ".wmv": "video/x-ms-wmv",
  ".3gp": "video/3gpp",
};

const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "video/x-msvideo": ".avi",
  "video/x-matroska": ".mkv",
  "video/x-m4v": ".m4v",
  "video/mpeg": ".mpeg",
  "video/x-ms-wmv": ".wmv",
  "video/3gpp": ".3gp",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "application/zip": ".zip",
};

export interface CampaignAttachment {
  id: string;
  campaignId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

interface AttachmentRow {
  id: string;
  campaign_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  storage_path: string;
  created_at: string;
}

function toAttachment(row: AttachmentRow): CampaignAttachment {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    filename: row.filename,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  };
}

function sanitizeFilename(name: string): string {
  const leaf = basename(name).replace(/[^\w.\- ()]+/g, "_").trim();
  return leaf.slice(0, 180) || "attachment";
}

function resolveContentType(filename: string, provided?: string): string {
  const ext = extname(filename).toLowerCase();
  if (provided && provided !== "application/octet-stream") return provided;
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

function resolveFileExtension(filename: string, contentType?: string): string {
  const ext = extname(filename).toLowerCase();
  if (ext && ALLOWED_EXTENSIONS.has(ext)) return ext;
  const mime = contentType?.split(";")[0]?.trim().toLowerCase();
  if (mime && MIME_TO_EXT[mime] && ALLOWED_EXTENSIONS.has(MIME_TO_EXT[mime])) {
    return MIME_TO_EXT[mime];
  }
  return ext;
}

function assertAllowedFile(filename: string, sizeBytes: number, contentType?: string): void {
  const ext = resolveFileExtension(filename, contentType);
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    throw new CampaignError(
      "Unsupported file type. Use PDF, Office documents, images, videos, TXT, CSV, or ZIP.",
    );
  }
  if (sizeBytes <= 0) throw new CampaignError("The file is empty.");
  if (sizeBytes > MAX_ATTACHMENT_BYTES) {
    throw new CampaignError(`Each attachment must be under ${formatBytes(MAX_ATTACHMENT_BYTES)}.`);
  }
}

function ensureFilenameExtension(filename: string, contentType?: string): string {
  const ext = extname(filename).toLowerCase();
  if (ext) return filename;
  const resolved = resolveFileExtension(filename, contentType);
  if (!resolved) return filename;
  return `${filename}${resolved}`;
}

function attachmentDir(campaignId: string): string {
  return join(ATTACHMENTS_ROOT, campaignId);
}

function totalAttachmentBytes(campaignId: string): number {
  const row = getDb()
    .prepare("SELECT COALESCE(SUM(size_bytes), 0) AS total FROM campaign_attachments WHERE campaign_id = ?")
    .get(campaignId) as { total: number };
  return row.total;
}

function attachmentCount(campaignId: string): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS count FROM campaign_attachments WHERE campaign_id = ?")
    .get(campaignId) as { count: number };
  return row.count;
}

export function listCampaignAttachments(campaignId: string): CampaignAttachment[] {
  const rows = getDb()
    .prepare(
      `SELECT id, campaign_id, filename, content_type, size_bytes, storage_path, created_at
         FROM campaign_attachments
        WHERE campaign_id = ?
        ORDER BY created_at ASC`,
    )
    .all(campaignId) as AttachmentRow[];
  return rows.map(toAttachment);
}

export function getCampaignAttachment(
  campaignId: string,
  attachmentId: string,
): (CampaignAttachment & { storagePath: string }) | null {
  const row = getDb()
    .prepare(
      `SELECT id, campaign_id, filename, content_type, size_bytes, storage_path, created_at
         FROM campaign_attachments
        WHERE campaign_id = ? AND id = ?`,
    )
    .get(campaignId, attachmentId) as AttachmentRow | undefined;
  if (!row) return null;
  return { ...toAttachment(row), storagePath: row.storage_path };
}

export function addCampaignAttachment(
  campaignId: string,
  input: { filename: string; contentType?: string; bytes: Buffer },
): CampaignAttachment {
  if (!getCampaign(campaignId)) throw new CampaignError("Campaign not found.");
  assertCampaignNotSending(campaignId);

  const filename = ensureFilenameExtension(sanitizeFilename(input.filename), input.contentType);
  assertAllowedFile(filename, input.bytes.length, input.contentType);

  if (attachmentCount(campaignId) >= MAX_CAMPAIGN_ATTACHMENTS) {
    throw new CampaignError(`You can attach up to ${MAX_CAMPAIGN_ATTACHMENTS} files per campaign.`);
  }

  const nextTotal = totalAttachmentBytes(campaignId) + input.bytes.length;
  if (nextTotal > MAX_ATTACHMENTS_TOTAL_BYTES) {
    throw new CampaignError(
      `Attachments must stay under ${formatBytes(MAX_ATTACHMENTS_TOTAL_BYTES)} total per campaign.`,
    );
  }

  const id = randomUUID();
  const dir = attachmentDir(campaignId);
  mkdirSync(dir, { recursive: true });
  const storagePath = join(dir, `${id}${extname(filename).toLowerCase() || ".bin"}`);
  writeFileSync(storagePath, input.bytes);

  const createdAt = new Date().toISOString();
  const contentType = resolveContentType(filename, input.contentType);

  getDb()
    .prepare(
      `INSERT INTO campaign_attachments
        (id, campaign_id, filename, content_type, size_bytes, storage_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, campaignId, filename, contentType, input.bytes.length, storagePath, createdAt);

  revertCampaignOnSendContentChange(campaignId);
  return toAttachment({
    id,
    campaign_id: campaignId,
    filename,
    content_type: contentType,
    size_bytes: input.bytes.length,
    storage_path: storagePath,
    created_at: createdAt,
  });
}

export interface CampaignAttachmentUploadError {
  filename: string;
  error: string;
}

export function addCampaignAttachments(
  campaignId: string,
  files: Array<{ filename: string; contentType?: string; bytes: Buffer }>,
): {
  added: CampaignAttachment[];
  errors: CampaignAttachmentUploadError[];
  attachments: CampaignAttachment[];
} {
  if (!getCampaign(campaignId)) throw new CampaignError("Campaign not found.");
  assertCampaignNotSending(campaignId);

  const added: CampaignAttachment[] = [];
  const errors: CampaignAttachmentUploadError[] = [];

  for (const file of files) {
    try {
      added.push(
        addCampaignAttachment(campaignId, {
          filename: file.filename,
          contentType: file.contentType,
          bytes: file.bytes,
        }),
      );
    } catch (error) {
      errors.push({
        filename: file.filename,
        error: error instanceof CampaignError ? error.message : "Could not attach this file.",
      });
    }
  }

  return {
    added,
    errors,
    attachments: listCampaignAttachments(campaignId),
  };
}

export function deleteCampaignAttachment(campaignId: string, attachmentId: string): boolean {
  if (!getCampaign(campaignId)) throw new CampaignError("Campaign not found.");
  assertCampaignNotSending(campaignId);

  const row = getCampaignAttachment(campaignId, attachmentId);
  if (!row) return false;

  getDb()
    .prepare("DELETE FROM campaign_attachments WHERE campaign_id = ? AND id = ?")
    .run(campaignId, attachmentId);

  try {
    unlinkSync(row.storagePath);
  } catch {
    // File may already be gone.
  }

  revertCampaignOnSendContentChange(campaignId);
  return true;
}

/** Remove stored files for a campaign (DB rows deleted separately). */
export function purgeCampaignAttachmentFiles(campaignId: string): void {
  try {
    rmSync(attachmentDir(campaignId), { recursive: true, force: true });
  } catch {
    // ignore
  }
}

export function readAttachmentBytes(attachment: CampaignAttachment & { storagePath: string }): Buffer {
  return readFileSync(attachment.storagePath);
}

export function loadCampaignAttachmentPayloads(campaignId: string): Array<{
  name: string;
  contentType: string;
  content: Buffer;
}> {
  const items = listCampaignAttachments(campaignId);
  const payloads: Array<{ name: string; contentType: string; content: Buffer }> = [];

  for (const item of items) {
    const full = getCampaignAttachment(campaignId, item.id);
    if (!full) continue;
    payloads.push({
      name: full.filename,
      contentType: full.contentType,
      content: readAttachmentBytes(full),
    });
  }

  return payloads;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
