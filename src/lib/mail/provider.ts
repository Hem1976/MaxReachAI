import "server-only";

import { createPostmarkProvider, requirePostmarkConfig } from "@/lib/mail/providers/postmark";
import { resolveMailConfig } from "@/lib/mail/env";
import type { MailProvider } from "@/lib/mail/types";

export function getMailProvider(): MailProvider {
  const { apiKey, messageStream } = requirePostmarkConfig();
  return createPostmarkProvider(apiKey, messageStream);
}

export function getResolvedMailConfig() {
  return resolveMailConfig();
}
