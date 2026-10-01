export interface MailAttachmentInput {
  name: string;
  contentType: string;
  content: Buffer;
}

export interface MailSendInput {
  to: string;
  from: string;
  replyTo?: string;
  cc?: string;
  subject: string;
  html: string;
  text: string;
  attachments?: MailAttachmentInput[];
}

export interface MailSendResult {
  id: string;
}

export interface MailProvider {
  id: string;
  send(input: MailSendInput): Promise<MailSendResult>;
}

export class MailConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailConfigError";
  }
}

export class MailSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailSendError";
  }
}

export class CampaignSendError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "CampaignSendError";
  }
}
