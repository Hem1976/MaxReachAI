"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Field } from "@/components/generator/field";
import { PageHeader } from "@/components/page-header";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Campaign, CampaignStatus } from "@/lib/campaigns/types";
import { CAMPAIGN_STATUSES } from "@/lib/campaigns/types";
import { productOptions } from "@/lib/products";
export const STATUS_VARIANT: Record<
  CampaignStatus,
  "default" | "accent" | "success" | "warning" | "danger" | "outline"
> = {
  draft: "outline",
  ready: "success",
  sending: "accent",
  paused: "warning",
  completed: "success",
  failed: "danger",
};

export function templateLabel(id: string, names?: Record<string, string>): string {
  if (!id) return "—";
  return names?.[id] ?? id;
}

export function productLabel(id: string): string {
  if (!id) return "—";
  return productOptions.find((item) => item.value === id)?.label ?? id;
}

export function statusLabel(status: CampaignStatus): string {
  if (status === "ready") return "Ready to send";
  if (status === "draft") return "Draft";
  if (status === "paused") return "Paused";
  if (status === "sending") return "Sending";
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  return status;
}

export function formatStamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export function CampaignsWorkspace({
  initialCampaigns,
  defaultSenderName,
  defaultSenderEmail,
}: {
  initialCampaigns: Campaign[];
  defaultSenderName: string;
  defaultSenderEmail: string;
}) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);
  const [form, setForm] = useState({
    name: "",
    templateId: "",
    productId: "",
    senderName: defaultSenderName,
    senderEmail: defaultSenderEmail,
  });

  async function refresh() {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (status !== "all") params.set("status", status);
    const response = await fetch(`/api/campaigns?${params.toString()}`);
    const payload = (await response.json()) as { campaigns?: Campaign[]; error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Could not load campaigns.");
    setCampaigns(payload.campaigns ?? []);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh().catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Could not load campaigns.");
      });
    }, 200);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, status]);

  async function create() {
    if (!form.name.trim()) {
      toast.error("Campaign name is required.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          templateId: form.templateId,
          productId: form.productId,
          senderName: form.senderName,
          senderEmail: form.senderEmail,
        }),
      });
      const payload = (await response.json()) as { campaign?: Campaign; error?: string };
      if (!response.ok || !payload.campaign) {
        throw new Error(payload.error ?? "Could not create that campaign.");
      }
      toast.success("Campaign created");
      setCreateOpen(false);
      router.push(`/campaigns/${payload.campaign.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create that campaign.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(campaign: Campaign) {
    setBusy(true);
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not delete that campaign.");
      setCampaigns((current) => current.filter((item) => item.id !== campaign.id));
      setDeleteTarget(null);
      toast.success("Campaign deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete that campaign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8 px-6 py-8 lg:px-10 lg:py-10">
      <PageHeader
        title="Campaigns"
        description="Write one email, pick people from Companies, then send."
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setForm({
                name: "",
                templateId: "",
                productId: "",
                senderName: defaultSenderName,
                senderEmail: defaultSenderEmail,
              });
              setCreateOpen(true);
            }}
          >
            <Plus />
            New campaign
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search campaigns"
            className="pl-9"
            aria-label="Search campaigns"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {CAMPAIGN_STATUSES.map((item) => (
              <SelectItem key={item} value={item}>
                {statusLabel(item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-[0.6875rem] tracking-wide text-subtle-foreground uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-16 text-center text-muted-foreground">
                  <Megaphone className="mx-auto mb-3 size-6 text-subtle-foreground" />
                  <p>No campaigns yet</p>
                  <p className="mx-auto mt-2 max-w-sm text-sm">
                    Create one, write the email, add people from Companies, then send.
                  </p>
                  <Button className="mt-4" variant="primary" onClick={() => setCreateOpen(true)}>
                    New campaign
                  </Button>
                </td>
              </tr>
            ) : (
              campaigns.map((campaign) => (
                <tr
                  key={campaign.id}
                  className="border-b border-border last:border-0 hover:bg-surface-hover"
                >
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="text-left font-medium text-foreground hover:underline"
                      onClick={() => router.push(`/campaigns/${campaign.id}`)}
                    >
                      {campaign.name}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[campaign.status]}>
                      {statusLabel(campaign.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-subtle-foreground">
                    {formatStamp(campaign.updatedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="iconSm"
                      aria-label={`Delete ${campaign.name}`}
                      onClick={() => setDeleteTarget(campaign)}
                    >
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
            <DialogDescription>
              Give it a name. You will write the email and pick people next.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="e.g. Pharma field Q3"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void create()} disabled={busy}>
              Create campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(next) => !next && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete campaign</DialogTitle>
            <DialogDescription>
              {deleteTarget ? `Delete “${deleteTarget.name}”? This cannot be undone.` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy || !deleteTarget}
              onClick={() => deleteTarget && void remove(deleteTarget)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
