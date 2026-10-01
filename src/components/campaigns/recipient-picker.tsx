"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { parseEmailAddresses } from "@/lib/campaigns/email";
import type { AddRecipientsResult, Campaign, CampaignRecipient } from "@/lib/campaigns/types";
import type { ContactList, ContactSearchHit } from "@/lib/crm/types";

function displayName(first: string, last: string, email: string) {
  const name = `${first} ${last}`.trim();
  return name || email || "No name";
}

function emailSummary(email: string): string {
  const addresses = parseEmailAddresses(email);
  if (addresses.length === 0) return email;
  if (addresses.length === 1) return addresses[0];
  return `${addresses.length} emails: ${addresses.join(", ")}`;
}

export function RecipientPicker({
  campaignId,
  campaignStatus,
  campaignSubject,
  initialRecipients,
  initialCount,
  onRecipientsChange,
}: {
  campaignId: string;
  campaignStatus: Campaign["status"];
  campaignSubject: string;
  initialRecipients: CampaignRecipient[];
  initialCount: number;
  onRecipientsChange?: (recipients: CampaignRecipient[]) => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ContactSearchHit[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [recipients, setRecipients] = useState(initialRecipients);
  const [total, setTotal] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [sendTarget, setSendTarget] = useState<CampaignRecipient | null>(null);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [selectedListId, setSelectedListId] = useState("");

  const recipientIds = useMemo(
    () => new Set(recipients.map((item) => item.contactId)),
    [recipients],
  );
  const eligibleVisible = hits.filter((hit) => hit.hasEmail);

  const loadSearch = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    params.set("hasEmail", "1");
    params.set("limit", "40");
    const response = await fetch(`/api/contacts?${params.toString()}`);
    const data = (await response.json()) as { contacts?: ContactSearchHit[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "Search failed.");
    setHits(data.contacts ?? []);
  }, [q]);

  useEffect(() => {
    void fetch("/api/lists")
      .then((response) => response.json())
      .then((data: { lists?: ContactList[] }) => {
        setLists(data.lists ?? []);
      })
      .catch(() => {
        /* lists are optional */
      });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSearch().catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Search failed.");
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadSearch]);

  async function refreshRecipients() {
    const response = await fetch(`/api/campaigns/${campaignId}/recipients`);
    const data = (await response.json()) as {
      recipients?: CampaignRecipient[];
      total?: number;
      error?: string;
    };
    if (!response.ok) throw new Error(data.error ?? "Could not load people.");
    const next = data.recipients ?? [];
    setRecipients(next);
    setTotal(data.total ?? next.length);
    onRecipientsChange?.(next);
  }

  function toggle(id: string, eligible: boolean) {
    if (!eligible) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function addFromList() {
    if (!selectedListId) {
      toast.error("Choose a list first.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/recipients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: selectedListId }),
      });
      const data = (await response.json()) as AddRecipientsResult & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not add the list.");
      await refreshRecipients();
      toast.success(`Added ${data.added} from list`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the list.");
    } finally {
      setBusy(false);
    }
  }

  async function addSelected() {
    const contactIds = [...selected];
    if (contactIds.length === 0) {
      toast.error("Select someone first.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/recipients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds }),
      });
      const data = (await response.json()) as AddRecipientsResult & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not add people.");
      setSelected(new Set());
      await refreshRecipients();
      toast.success(`Added ${data.added}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add people.");
    } finally {
      setBusy(false);
    }
  }

  async function removeOne(contactId: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/recipients/${contactId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Could not remove.");
      await refreshRecipients();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove.");
    } finally {
      setBusy(false);
    }
  }

  async function sendOne(contactId: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/send/${contactId}`, {
        method: "POST",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not send.");
      setSendTarget(null);
      await refreshRecipients();
      toast.success("Sent");
    } catch (error) {
      await refreshRecipients();
      toast.error(error instanceof Error ? error.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    setBusy(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/recipients/clear`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Could not clear.");
      setConfirmClear(false);
      await refreshRecipients();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not clear.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-foreground">
          To: {total} {total === 1 ? "person" : "people"}
        </p>
        {total > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmClear(true)} disabled={busy}>
            Clear
          </Button>
        ) : null}
      </div>

      {lists.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2">
          <Select value={selectedListId || "__none__"} onValueChange={(value) => setSelectedListId(value === "__none__" ? "" : value)}>
            <SelectTrigger className="h-8 min-w-[200px] flex-1" aria-label="Saved list">
              <SelectValue placeholder="Saved list from Bulk" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Choose a saved list</SelectItem>
              {lists.map((list) => (
                <SelectItem key={list.id} value={list.id}>
                  {list.name} ({list.contactCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || !selectedListId}
            onClick={() => void addFromList()}
          >
            Add list
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Upload a CSV on the Bulk page to create a list you can add here.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search name or company"
          aria-label="Search people"
          className="max-w-sm"
        />
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => {
          setSelected(new Set(eligibleVisible.map((hit) => hit.id)));
        }}>
          Select shown
        </Button>
        <Button type="button" size="sm" onClick={() => void addSelected()} disabled={busy}>
          Add {selected.size || ""}
        </Button>
      </div>

      <ul className="max-h-48 overflow-y-auto text-sm">
        {hits.map((hit) => {
          const eligible = hit.hasEmail;
          const already = recipientIds.has(hit.id);
          return (
            <li key={hit.id} className={`flex items-center gap-2 py-1.5 ${eligible ? "" : "opacity-50"}`}>
              <input
                type="checkbox"
                disabled={!eligible || busy}
                checked={selected.has(hit.id)}
                onChange={() => toggle(hit.id, eligible)}
                aria-label={`Select ${displayName(hit.firstName, hit.lastName, hit.email)}`}
              />
              <span className="min-w-0 flex-1 truncate">
                {displayName(hit.firstName, hit.lastName, hit.email)}
                <span className="text-muted-foreground"> · {hit.companyName}</span>
                {already ? <span className="text-subtle-foreground"> · added</span> : null}
              </span>
            </li>
          );
        })}
      </ul>

      {recipients.length > 0 ? (
        <ul className="text-sm">
          {recipients.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
              <span>
                {displayName(item.firstName, item.lastName, item.email)}
                <span className="text-muted-foreground"> · {item.companyName}</span>
                {parseEmailAddresses(item.email).length > 1 ? (
                  <span className="block text-xs text-muted-foreground">{emailSummary(item.email)}</span>
                ) : null}
                {item.status === "sent" ? (
                  <span className="text-success"> · Sent</span>
                ) : item.status === "failed" ? (
                  <span className="text-danger"> · Failed</span>
                ) : null}
              </span>
              <span className="flex gap-1">
                {(campaignStatus === "ready" || campaignStatus === "paused") &&
                item.status === "failed" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => setSendTarget(item)}
                  >
                    Try again
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => void removeOne(item.contactId)}
                >
                  Remove
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nobody added yet.</p>
      )}

      <Dialog open={Boolean(sendTarget)} onOpenChange={(open) => !open && setSendTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send this email?</DialogTitle>
            <DialogDescription>
              {sendTarget
                ? `${displayName(sendTarget.firstName, sendTarget.lastName, sendTarget.email)} · ${campaignSubject || "No subject"}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSendTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={busy || !sendTarget}
              onClick={() => sendTarget && void sendOne(sendTarget.contactId)}
            >
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear the list?</DialogTitle>
            <DialogDescription>People stay in your contact database. They are only removed from this campaign.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmClear(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void clearAll()} disabled={busy}>
              Clear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
