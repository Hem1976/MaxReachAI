/** Default outbound identity for campaigns and template previews. */
export const DEFAULT_CAMPAIGN_SENDER = {
  senderName: "Zamba",
  senderTitle: "Client Relations Manager",
  senderEmail: "sales@maxpointprotect.com",
  senderPhone: "+254 786 658 200",
  companyName: "Maxpointprotect Limited",
} as const;

export const DEFAULT_REPLY_EMAIL = DEFAULT_CAMPAIGN_SENDER.senderEmail;
