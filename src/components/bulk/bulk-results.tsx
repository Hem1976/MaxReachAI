"use client";

import { useMemo, useState } from "react";
import { Check, Download, Eye, Pencil, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";

import { CopyButton } from "@/components/copy-button";
import { QualityPanel } from "@/components/bulk/quality-panel";
import { Field } from "@/components/generator/field";
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
import { Textarea } from "@/components/ui/textarea";
import { leadMatchesProduct } from "@/lib/bulk/merge";
import type { BulkJobSnapshot, BulkLead, BulkLeadStatus } from "@/lib/bulk/types";
import { qualityFromLead } from "@/lib/bulk/quality";
import { products } from "@/lib/products/data";
import { cn } from "@/lib/utils";

type ResultFilter = "all" | "ready" | "needs_review" | "failed";
type ProductFilter = "all" | "__unassigned__" | (typeof products)[number]["id"];

interface LeadEditForm {
  company: string;
  contactName: string;
  email: string;
  industry: string;
  jobTitle: string;
  website: string;
  notes: string;
}

function leadToEditForm(lead: BulkLead): LeadEditForm {
  return {
    company: lead.company,
    contactName: lead.contactName,
    email: lead.email,
    industry: lead.industry,
    jobTitle: lead.jobTitle,
    website: lead.website,
    notes: lead.notes,
  };
}

const STATUS_RANK: Record<BulkLeadStatus, number> = {
  ready: 0,
  approved: 1,
  needs_review: 2,
  failed: 3,
  generating: 4,
  queued: 5,
  skipped: 6,
};

export function BulkResults({
  snapshot,
  onChange,
}: {
  snapshot: BulkJobSnapshot;
  onChange: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [productFilter, setProductFilter] = useState<ProductFilter>("all");
  const [open, setOpen] = useState<BulkLead | null>(null);
  const [editLead, setEditLead] = useState<BulkLead | null>(null);
  const [editForm, setEditForm] = useState<LeadEditForm | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const productCounts = useMemo(() => {
    const counts = new Map<string, number>();
    counts.set("all", snapshot.leads.length);
    counts.set(
      "__unassigned__",
      snapshot.leads.filter(
        (lead) => !lead.productId.trim() && !lead.productName.trim(),
      ).length,
    );
    for (const product of products) {
      counts.set(
        product.id,
        snapshot.leads.filter((lead) =>
          leadMatchesProduct(lead, product.id, product.name),
        ).length,
      );
    }
    return counts;
  }, [snapshot.leads]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const selectedProduct = products.find((product) => product.id === productFilter);
    return snapshot.leads
      .filter((lead) => {
        if (
          !leadMatchesProduct(
            lead,
            productFilter,
            selectedProduct?.name,
          )
        ) {
          return false;
        }
        if (filter === "ready" && lead.status !== "ready" && lead.status !== "approved") {
          return false;
        }
        if (filter === "needs_review" && lead.status !== "needs_review") return false;
        if (filter === "failed" && lead.status !== "failed") return false;
        if (!needle) return true;
        return [
          lead.company,
          lead.contactName,
          lead.email,
          lead.productName,
          lead.recommendedSubject,
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => {
        const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
        if (rank !== 0) return rank;
        return b.confidenceScore - a.confidenceScore;
      });
  }, [snapshot.leads, query, filter, productFilter]);

  async function exportCsv() {
    try {
      const response = await fetch(`/api/bulk/${snapshot.job.id}/export`);
      if (!response.ok) throw new Error("Export failed.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const name = snapshot.job.filename.replace(/\.csv$/i, "");
      link.href = url;
      link.download = `${name}-outreach.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.");
    }
  }

  async function patchLead(leadId: string, body: Record<string, unknown>) {
    setBusyId(leadId);
    try {
      const response = await fetch(`/api/bulk/${snapshot.job.id}/leads/${leadId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        hint?: string;
      };
      if (!response.ok) {
        throw new Error(payload.hint ? `${payload.error} ${payload.hint}` : payload.error);
      }
      onChange();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed.");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  function openEdit(lead: BulkLead) {
    setEditLead(lead);
    setEditForm(leadToEditForm(lead));
  }

  async function saveEdit() {
    if (!editLead || !editForm) return;
    if (!editForm.company.trim()) {
      toast.error("Company name is required.");
      return;
    }

    const ok = await patchLead(editLead.id, {
      company: editForm.company.trim(),
      contactName: editForm.contactName.trim(),
      email: editForm.email.trim(),
      industry: editForm.industry.trim(),
      jobTitle: editForm.jobTitle.trim(),
      website: editForm.website.trim(),
      notes: editForm.notes.trim(),
    });

    if (ok) {
      toast.success("Company details updated");
      setEditLead(null);
      setEditForm(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search company, email, contact, subject…"
              className="pl-9"
            />
          </div>
          <Select
            value={productFilter}
            onValueChange={(value) => setProductFilter(value as ProductFilter)}
          >
            <SelectTrigger aria-label="Filter by product" className="w-full sm:w-[220px]">
              <SelectValue placeholder="All products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                All products ({productCounts.get("all") ?? 0})
              </SelectItem>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name} ({productCounts.get(product.id) ?? 0})
                </SelectItem>
              ))}
              {(productCounts.get("__unassigned__") ?? 0) > 0 ? (
                <SelectItem value="__unassigned__">
                  Unassigned ({productCounts.get("__unassigned__") ?? 0})
                </SelectItem>
              ) : null}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label="All"
            count={snapshot.leads.length}
          />
          <FilterChip
            active={filter === "ready"}
            onClick={() => setFilter("ready")}
            label="Ready"
            count={countReady(snapshot.leads)}
          />
          <FilterChip
            active={filter === "needs_review"}
            onClick={() => setFilter("needs_review")}
            label="Needs review"
            count={countStatus(snapshot.leads, "needs_review")}
          />
          <FilterChip
            active={filter === "failed"}
            onClick={() => setFilter("failed")}
            label="Failed"
            count={countStatus(snapshot.leads, "failed")}
          />
          <Button variant="primary" onClick={() => void exportCsv()}>
            <Download />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-surface-raised text-[0.6875rem] tracking-wide text-subtle-foreground uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Contact person</th>
              <th className="px-4 py-3 font-medium">Subject</th>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  No rows match that filter.
                </td>
              </tr>
            ) : (
              visible.map((lead) => (
                <tr key={lead.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {lead.company || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{lead.email || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {lead.contactName || "—"}
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-muted-foreground">
                    {lead.recommendedSubject || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {lead.productName || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="iconSm"
                        disabled={lead.status === "generating" || busyId === lead.id}
                        onClick={() => openEdit(lead)}
                        aria-label="Edit company"
                        title="Edit company"
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="iconSm"
                        disabled={!lead.emailBody}
                        onClick={() => setOpen(lead)}
                        aria-label="Review email"
                      >
                        <Eye />
                      </Button>
                      {lead.status === "failed" || lead.status === "needs_review" ? (
                        <Button
                          variant="ghost"
                          size="iconSm"
                          disabled={busyId === lead.id}
                          onClick={() => void patchLead(lead.id, { retry: true })}
                          aria-label="Retry"
                        >
                          <RotateCcw />
                        </Button>
                      ) : null}
                      {lead.status === "ready" || lead.status === "needs_review" ? (
                        <Button
                          variant="ghost"
                          size="iconSm"
                          disabled={busyId === lead.id}
                          onClick={() => void patchLead(lead.id, { status: "approved" })}
                          aria-label="Mark approved"
                        >
                          <Check />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(open)} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{open?.company}</DialogTitle>
            <DialogDescription>
              {open?.productName || "No product yet"}
              {open?.contactName ? ` · ${open.contactName}` : ""}
            </DialogDescription>
          </DialogHeader>
          {open ? (
            <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
              <QualityPanel
                report={qualityFromLead(open)}
                status={open.status}
              />
              {open.reviewFlags.length > 0 ? (
                <ul className="rounded-md border border-[rgba(148,100,0,0.28)] bg-[rgba(148,100,0,0.08)] px-3 py-2 text-xs leading-relaxed text-warning">
                  {open.reviewFlags.map((flag) => (
                    <li key={flag}>{flag}</li>
                  ))}
                </ul>
              ) : null}
              {open.error ? (
                <p className="text-sm text-danger">{open.error}</p>
              ) : null}
              <div>
                <p className="eyebrow">Recommended subject</p>
                <p className="mt-1 text-sm text-foreground">{open.recommendedSubject}</p>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground">
                {open.emailBody || "Not generated yet."}
              </pre>
              {open.followUp1 ? (
                <div>
                  <p className="eyebrow">Follow-up 1</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {open.followUp1}
                  </p>
                </div>
              ) : null}
              {open.followUp2 ? (
                <div>
                  <p className="eyebrow">Follow-up 2</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {open.followUp2}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            {open ? (
              <>
                <CopyButton
                  value={open.emailBody}
                  label="Copy email"
                  disabled={!open.emailBody}
                />
                {open.status === "ready" || open.status === "needs_review" ? (
                  <Button
                    variant="primary"
                    disabled={busyId === open.id}
                    onClick={() => {
                      void patchLead(open.id, { status: "approved" }).then(() =>
                        setOpen(null),
                      );
                    }}
                  >
                    Approve
                  </Button>
                ) : null}
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editLead && editForm)}
        onOpenChange={(next) => {
          if (!next) {
            setEditLead(null);
            setEditForm(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit company</DialogTitle>
            <DialogDescription>
              Update the uploaded details for this row. Use Retry afterward if you
              want a new email from the changed info.
            </DialogDescription>
          </DialogHeader>
          {editForm ? (
            <div className="grid gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
              <Field label="Company" htmlFor="edit-company" hint="Required">
                <Input
                  id="edit-company"
                  value={editForm.company}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, company: event.target.value } : current,
                    )
                  }
                />
              </Field>
              <Field label="Contact name" htmlFor="edit-contact">
                <Input
                  id="edit-contact"
                  value={editForm.contactName}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, contactName: event.target.value } : current,
                    )
                  }
                />
              </Field>
              <Field label="Email" htmlFor="edit-email">
                <Input
                  id="edit-email"
                  value={editForm.email}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, email: event.target.value } : current,
                    )
                  }
                  spellCheck={false}
                />
              </Field>
              <Field label="Industry" htmlFor="edit-industry">
                <Input
                  id="edit-industry"
                  value={editForm.industry}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, industry: event.target.value } : current,
                    )
                  }
                />
              </Field>
              <Field label="Job title" htmlFor="edit-job-title">
                <Input
                  id="edit-job-title"
                  value={editForm.jobTitle}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, jobTitle: event.target.value } : current,
                    )
                  }
                />
              </Field>
              <Field label="Website" htmlFor="edit-website">
                <Input
                  id="edit-website"
                  value={editForm.website}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, website: event.target.value } : current,
                    )
                  }
                  spellCheck={false}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Notes" htmlFor="edit-notes">
                  <Textarea
                    id="edit-notes"
                    value={editForm.notes}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current ? { ...current, notes: event.target.value } : current,
                      )
                    }
                    rows={4}
                  />
                </Field>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditLead(null);
                setEditForm(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!editLead || busyId === editLead.id}
              onClick={() => void saveEdit()}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[0.6875rem] tracking-wide uppercase transition-colors",
        active
          ? "border-accent bg-accent-soft text-foreground"
          : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
      )}
    >
      {label} {count}
    </button>
  );
}

function countStatus(leads: BulkLead[], status: BulkLeadStatus): number {
  return leads.filter((lead) => lead.status === status).length;
}

function countReady(leads: BulkLead[]): number {
  return leads.filter((lead) => lead.status === "ready" || lead.status === "approved").length;
}
