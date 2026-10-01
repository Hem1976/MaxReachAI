export interface CampaignAttachment {
  id: string;
  campaignId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export const MAX_CAMPAIGN_ATTACHMENTS = 5;
export const MAX_ATTACHMENTS_TOTAL_BYTES = 9 * 1024 * 1024;

export const CAMPAIGN_ATTACHMENT_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.zip,.mp4,.mov,.webm,.avi,.mkv,.m4v,.mpeg,.mpg,.wmv,.3gp,video/*,application/pdf";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
