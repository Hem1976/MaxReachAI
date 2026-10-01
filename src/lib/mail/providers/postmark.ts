import "server-only";

import { resolveMailConfig } from "@/lib/mail/env";
import { MailConfigError, MailSendError, type MailProvider, type MailSendInput } from "@/lib/mail/types";

const POSTMARK_ENDPOINT = "https://api.postmarkapp.com/email";

function redact(value: string): string {
  return value
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[redacted]")
    .slice(0, 280);
}

export function createPostmarkProvider(apiKey: string, messageStream: string): MailProvider {
  return {
    id: "postmark",
    async send(input: MailSendInput) {
      const response = await fetch(POSTMARK_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Postmark-Server-Token": apiKey,
        },
        body: JSON.stringify({
          From: input.from,
          To: input.to,
          Subject: input.subject,
          HtmlBody: input.html,
          TextBody: input.text,
          MessageStream: messageStream,
          ...(input.replyTo ? { ReplyTo: input.replyTo } : {}),
          ...(input.cc ? { Cc: input.cc } : {}),
          ...(input.attachments?.length
            ? {
                Attachments: input.attachments.map((file) => ({
                  Name: file.name,
                  Content: file.content.toString("base64"),
                  ContentType: file.contentType,
                })),
              }
            : {}),
        }),
      });

      const raw = await response.text();
      let parsed: { MessageID?: string; ErrorCode?: number; Message?: string } = {};
      try {
        parsed = JSON.parse(raw) as typeof parsed;
      } catch {
        parsed = {};
      }

      if (!response.ok || !parsed.MessageID) {
        const message =
          parsed.Message || `Postmark rejected the send (${response.status}).`;
        throw new MailSendError(redact(message));
      }

      return { id: parsed.MessageID };
    },
  };
}

export function requirePostmarkConfig(): { apiKey: string; messageStream: string } {
  const { apiKey, messageStream } = resolveMailConfig();
  if (!apiKey) {
    throw new MailConfigError(
      "Postmark API key was not found. Put POSTMARK_API_KEY in the .env file in the project root, save the file, then send again.",
    );
  }
  return { apiKey, messageStream };
}
