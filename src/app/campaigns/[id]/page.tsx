import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CampaignDetail } from "@/components/campaigns/campaign-detail";
import { listCampaignAttachments } from "@/lib/campaigns/attachments";
import { getRecipientCount, listRecipients } from "@/lib/campaigns/recipients";
import { getCampaign } from "@/lib/campaigns/store";
import { readSettings } from "@/lib/db/settings";
import { templatesGroupedForPicker } from "@/lib/templates/catalog.server";

export const metadata: Metadata = { title: "Campaign" };
export const dynamic = "force-dynamic";

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = getCampaign(id);
  if (!campaign) notFound();
  const settings = readSettings();
  return (
    <CampaignDetail
      initial={campaign}
      senderCompany={settings.companyName || "Maxpro Infotech"}
      initialRecipients={listRecipients(id)}
      initialRecipientCount={getRecipientCount(id)}
      initialAttachments={listCampaignAttachments(id)}
      templatesByCategory={templatesGroupedForPicker()}
    />
  );
}
