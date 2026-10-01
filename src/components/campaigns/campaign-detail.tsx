"use client";

import { useMemo, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { STATUS_VARIANT, statusLabel } from "@/components/campaigns/campaigns-workspace";
import { CampaignAttachmentsPanel } from "@/components/campaigns/campaign-attachments-panel";
import { CampaignSendPanel } from "@/components/campaigns/campaign-send-panel";
import { CampaignHtmlPanel } from "@/components/campaigns/campaign-html-panel";
import type { CampaignAttachment } from "@/lib/campaigns/attachments-client";
import { RecipientPicker } from "@/components/campaigns/recipient-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_CAMPAIGN_CC_EMAIL } from "@/lib/campaigns/cc";
import type { Campaign, CampaignRecipient } from "@/lib/campaigns/types";
import {
  campaignVariableValues,
  SAMPLE_RECIPIENT,
  VARIABLE_INSERT_OPTIONS,
  variableToken,
} from "@/lib/campaigns/variables";
import { products, productOptions } from "@/lib/products";
import { productImagePath } from "@/lib/email-assets";
import {
  composeBodyFromSlots,
  isTemplateSlotKey,
  type TemplateSlots,
} from "@/lib/templates/slots";
import type { EmailTemplate } from "@/lib/templates/types";

type ComposerField = "subject" | "body" | "cta";

const QUICK_VARS = VARIABLE_INSERT_OPTIONS.filter((item) =>
  ["first_name", "company", "sender_name"].includes(item.key),
);

export function CampaignDetail({
  initial,
  senderCompany,
  initialRecipients,
  initialRecipientCount,
  initialAttachments,
  templatesByCategory,
}: {
  initial: Campaign;
  senderCompany: string;
  initialRecipients: CampaignRecipient[];
  initialRecipientCount: number;
  initialAttachments: CampaignAttachment[];
  templatesByCategory: Array<[string, EmailTemplate[]]>;
}) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeField, setActiveField] = useState<ComposerField>("subject");
  const [reviewKey, setReviewKey] = useState(0);
  const [previewRecipientId, setPreviewRecipientId] = useState(
    initialRecipients[0]?.contactId ?? "__sample__",
  );
  const [recipients, setRecipients] = useState(initialRecipients);
  const subjectRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: initial.name,
    status: initial.status,
    templateId: initial.templateId,
    productId: initial.productId,
    senderName: initial.senderName,
    senderEmail: initial.senderEmail,
    subject: initial.subject,
    body: initial.body,
    cta: initial.cta,
    slots: initial.slots ?? {},
    htmlDraft: initial.htmlDraft ?? "",
    ccEnabled: initial.ccEnabled ?? false,
    ccEmail: initial.ccEmail || DEFAULT_CAMPAIGN_CC_EMAIL,
  });

  const sendingLock = campaign.status === "sending";
  const product = products.find((item) => item.id === form.productId);
  const previewRecipient = recipients.find((item) => item.contactId === previewRecipientId);

  const previewValues = useMemo(
    () =>
      campaignVariableValues({
        recipient: previewRecipient
          ? {
              first_name: previewRecipient.firstName,
              last_name: previewRecipient.lastName,
              full_name: `${previewRecipient.firstName} ${previewRecipient.lastName}`.trim(),
              email: previewRecipient.email,
              job_title: previewRecipient.jobTitle,
              company: previewRecipient.companyName,
              website: previewRecipient.companyWebsite,
              industry: previewRecipient.industry,
            }
          : SAMPLE_RECIPIENT,
        productName: product?.name ?? "",
        productDescription: product?.tagline ?? product?.description ?? "",
        productImage: product ? productImagePath(product.id) : "",
        senderName: form.senderName,
        senderEmail: form.senderEmail,
        senderCompany,
      }),
    [previewRecipient, product, form.senderName, form.senderEmail, senderCompany],
  );

  function insertVariable(key: (typeof VARIABLE_INSERT_OPTIONS)[number]["key"]) {
    const token = variableToken(key);
    insertAtCursor(subjectRef, token, (next) => {
      setForm((current) => ({
        ...current,
        subject: next,
        slots: { ...current.slots, HEADLINE: next },
      }));
    });
  }

  async function save() {
    setBusy(true);
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          status: form.status === "paused" || form.status === "draft" ? form.status : undefined,
          templateId: form.templateId,
          productId: form.productId,
          senderName: form.senderName,
          senderEmail: form.senderEmail,
          subject: form.subject,
          body: form.htmlDraft.trim() ? form.body : composeBodyFromSlots(form.slots, form.body),
          cta: form.slots.CTA_LABEL || form.cta,
          slots: form.htmlDraft.trim() ? {} : form.slots,
          htmlDraft: form.htmlDraft,
          ccEnabled: form.ccEnabled,
          ccEmail: form.ccEmail,
        }),
      });
      const payload = (await response.json()) as {
        campaign?: Campaign;
        error?: string;
        issues?: string[];
      };
      if (!response.ok || !payload.campaign) {
        const detail = payload.issues?.length
          ? payload.issues.join(" ")
          : payload.error;
        throw new Error(detail ?? "Could not save this campaign.");
      }
      setCampaign(payload.campaign);
      setForm((current) => ({
        ...current,
        status: payload.campaign!.status,
        ccEnabled: payload.campaign!.ccEnabled,
        ccEmail: payload.campaign!.ccEmail,
      }));
      setReviewKey((current) => current + 1);
      toast.success("Saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not delete this campaign.");
      toast.success("Campaign deleted");
      router.push("/campaigns");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete this campaign.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-8 lg:px-10 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            Write the email, add people, save, then send.
          </p>
          <div className="flex min-w-0 items-center gap-3">
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="max-w-md text-base font-medium"
              aria-label="Campaign name"
              disabled={sendingLock}
            />
            <Badge variant={STATUS_VARIANT[campaign.status]}>{statusLabel(campaign.status)}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => router.push("/campaigns")}>
            Back
          </Button>
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy || sendingLock}>
            Save
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <p className="text-sm font-medium text-foreground">1. Write the email</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={form.senderName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, senderName: event.target.value }))
                }
                placeholder="Zamba"
                aria-label="Your name"
                disabled={sendingLock}
              />
              <Input
                value={form.senderEmail}
                onChange={(event) =>
                  setForm((current) => ({ ...current, senderEmail: event.target.value }))
                }
                placeholder="sales@maxpointprotect.com"
                aria-label="Your email"
                disabled={sendingLock}
              />
            </div>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-surface-raised px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
                checked={form.ccEnabled}
                disabled={sendingLock}
                onChange={(event) =>
                  setForm((current) => ({ ...current, ccEnabled: event.target.checked }))
                }
              />
              <span className="text-muted-foreground">
                CC{" "}
                <span className="font-medium text-foreground">
                  {form.ccEmail || DEFAULT_CAMPAIGN_CC_EMAIL}
                </span>{" "}
                on every email in this campaign. Click Save after changing this.
              </span>
            </label>
            <Input
              ref={subjectRef}
              value={form.subject}
              onFocus={() => setActiveField("subject")}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  subject: event.target.value,
                  slots: { ...current.slots, HEADLINE: event.target.value },
                }))
              }
              placeholder="Subject"
              aria-label="Subject"
              disabled={sendingLock}
            />
            <p className="text-xs text-muted-foreground">
              Choose a template below, or pick one from My templates to use your ready-made HTML.
              Paste or upload HTML anytime — no visual editor required.
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_VARS.map((option) => (
                <Button
                  key={option.key}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={sendingLock}
                  onClick={() => insertVariable(option.key)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                value={form.templateId || "__none__"}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    templateId: value === "__none__" ? "" : value,
                    slots: {},
                    htmlDraft: "",
                  }))
                }
                disabled={sendingLock}
              >
                <SelectTrigger aria-label="Template">
                  <SelectValue placeholder="Template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Choose template</SelectItem>
                  {templatesByCategory.map(([category, group]) => (
                    <SelectGroup key={category}>
                      <SelectLabel>{category}</SelectLabel>
                      {group.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={form.productId || "__none__"}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    productId: value === "__none__" ? "" : value,
                  }))
                }
                disabled={sendingLock}
              >
                <SelectTrigger aria-label="Product">
                  <SelectValue placeholder="Product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No product</SelectItem>
                  {productOptions.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

        {form.templateId ? (
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">2. Preview and send your email</p>
                <p className="mt-1 text-sm text-foreground">{form.subject || "No subject yet"}</p>
              </div>
              <Select value={previewRecipientId} onValueChange={setPreviewRecipientId}>
                <SelectTrigger className="h-8 w-[220px]" aria-label="Preview person">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__sample__">Sample person</SelectItem>
                  {recipients.map((item) => (
                    <SelectItem key={item.contactId} value={item.contactId}>
                      {`${item.firstName} ${item.lastName}`.trim() || item.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <CampaignHtmlPanel
              key={form.templateId}
              templateId={form.templateId}
              productId={form.productId || undefined}
              productName={product?.name}
              subject={form.subject}
              email={form.body}
              cta={form.cta}
              company={previewValues.company ?? ""}
              contactName={previewValues.full_name ?? ""}
              senderName={form.senderName}
              senderEmail={form.senderEmail}
              senderCompany={senderCompany}
              slots={form.slots}
              htmlDraft={form.htmlDraft}
              previewValues={previewValues}
              disabled={sendingLock}
              onHtmlDraftChange={(htmlDraft) =>
                setForm((current) => ({ ...current, htmlDraft }))
              }
              onSlotsChange={(slots) =>
                setForm((current) => {
                  const next: TemplateSlots = { ...current.slots };
                  for (const [key, value] of Object.entries(slots)) {
                    if (isTemplateSlotKey(key)) next[key] = value;
                  }
                  return {
                    ...current,
                    slots: next,
                    subject: next.HEADLINE ?? current.subject,
                    cta: next.CTA_LABEL || current.cta,
                    body: composeBodyFromSlots(next, current.body),
                  };
                })
              }
            />
            <CampaignAttachmentsPanel
              campaignId={campaign.id}
              campaignStatus={campaign.status}
              initialAttachments={initialAttachments}
              disabled={sendingLock}
              onCampaignUpdated={(next) => {
                setCampaign(next);
                setForm((current) => ({ ...current, status: next.status }));
                setReviewKey((current) => current + 1);
              }}
            />
          </section>
        ) : (
          <p className="text-sm text-muted-foreground">
            Choose a template to preview your email. Start with My templates for your ready-made designs.
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-foreground">3. Who gets this</p>
            <p className="text-sm text-muted-foreground">
              Search people from Companies. Import a CSV there first if the list is empty.
            </p>
          <RecipientPicker
            campaignId={campaign.id}
            campaignStatus={campaign.status}
            campaignSubject={form.subject}
            initialRecipients={initialRecipients}
            initialCount={initialRecipientCount}
            onRecipientsChange={(next) => {
              setRecipients(next);
              setReviewKey((current) => current + 1);
              void fetch(`/api/campaigns/${campaign.id}`)
                .then((response) => response.json())
                .then((payload: { campaign?: Campaign }) => {
                  if (payload.campaign) {
                    setCampaign(payload.campaign);
                    setForm((current) => ({ ...current, status: payload.campaign!.status }));
                  }
                });
            }}
          />
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-foreground">4. Send</p>
          <CampaignSendPanel
            campaign={campaign}
            refreshKey={reviewKey}
            onCampaignUpdated={(next) => {
              setCampaign(next);
              setForm((current) => ({ ...current, status: next.status }));
            }}
            onRecipientsChanged={() => {
              setReviewKey((current) => current + 1);
              void fetch(`/api/campaigns/${campaign.id}/recipients`)
                .then((response) => response.json())
                .then((payload: { recipients?: CampaignRecipient[] }) => {
                  if (payload.recipients) setRecipients(payload.recipients);
                });
            }}
          />
          </div>
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this campaign?</DialogTitle>
            <DialogDescription>People and companies in the directory are kept.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void remove()} disabled={busy}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function insertAtCursor(
  ref: RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
  token: string,
  onChange: (next: string) => void,
) {
  const el = ref.current;
  if (!el) {
    onChange(token);
    return;
  }
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const next = `${el.value.slice(0, start)}${token}${el.value.slice(end)}`;
  onChange(next);
  requestAnimationFrame(() => {
    const pos = start + token.length;
    el.focus();
    el.setSelectionRange(pos, pos);
  });
}
