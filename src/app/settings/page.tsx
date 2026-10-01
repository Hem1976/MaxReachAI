import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { getStatus } from "@/lib/ai/ollama";
import { readSettings } from "@/lib/db/settings";
import { readMailEnv, resolveMailConfig } from "@/lib/mail/env";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = readSettings();
  const env = readMailEnv();
  const resolved = resolveMailConfig(settings);
  const status = await getStatus({
    baseUrl: settings.ollamaBaseUrl,
    model: settings.model,
  });

  return (
    <div className="flex flex-col gap-8 px-6 py-8 lg:px-10 lg:py-10">
      <PageHeader
        title="Settings"
        description="Connect Ollama, configure Postmark sending, and share the app on your WiFi."
      />
      <SettingsForm
        initialSettings={settings}
        initialStatus={status}
        postmarkPreview={{
          apiKeyConfigured: resolved.apiKeyConfigured,
          effectiveFromName: resolved.fromName,
          effectiveFromEmail: resolved.fromEmail,
          effectiveMessageStream: resolved.messageStream,
          envFromName: env.fromName,
          envFromEmail: env.fromEmail,
          envMessageStream: env.messageStream,
        }}
      />
    </div>
  );
}
