import type { Metadata } from "next";

import { CampaignsWorkspace } from "@/components/campaigns/campaigns-workspace";
import { listCampaigns } from "@/lib/campaigns/store";
import { readSettings } from "@/lib/db/settings";

export const metadata: Metadata = { title: "Campaigns" };
export const dynamic = "force-dynamic";

export default function CampaignsPage() {
  const settings = readSettings();
  return (
    <CampaignsWorkspace
      initialCampaigns={listCampaigns()}
      defaultSenderName={settings.senderName}
      defaultSenderEmail={settings.senderEmail}
    />
  );
}
