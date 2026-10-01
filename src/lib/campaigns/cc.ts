export const DEFAULT_CAMPAIGN_CC_EMAIL = "hemant.patel@maxproinfotech.com";

export function resolveCampaignCc(
  ccEnabled: boolean,
  ccEmail: string,
): string | undefined {
  if (!ccEnabled) return undefined;
  const trimmed = ccEmail.trim();
  return trimmed || DEFAULT_CAMPAIGN_CC_EMAIL;
}
