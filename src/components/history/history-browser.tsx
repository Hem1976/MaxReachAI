"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Clock,
  History as HistoryIcon,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { CopyButton } from "@/components/copy-button";
import { EmailHtmlPreview } from "@/components/email-html-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { lengthLabel, objectiveLabel, toneLabel } from "@/lib/constants";
import { getTemplateOrDefault } from "@/lib/templates";
import type { HistoryRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatWhen(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistoryBrowser({ initial }: { initial: HistoryRecord[] }) {
  const [records, setRecords] = useState(initial);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(initial[0]?.id ?? "");
  const [deleting, setDeleting] = useState<string | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return records;
    return records.filter((record) =>
      [
        record.company,
        record.contactName,
        record.productName,
        record.recommendedSubject,
        record.email,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [query, records]);

  const active = visible.find((r) => r.id === activeId) ?? visible[0];

  async function remove(id: string) {
    setDeleting(id);
    try {
      const response = await fetch(`/api/history/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete that record.");
      setRecords((current) => current.filter((record) => record.id !== id));
      toast.success("Generation deleted");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Delete failed.");
    } finally {
      setDeleting(null);
    }
  }

  if (records.length === 0) {
    return (
      <div className="relative flex min-h-[50vh] flex-col items-center justify-center overflow-hidden rounded-xl border border-border bg-surface px-8 py-20 text-center">
        <div className="grid-texture pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative flex max-w-sm flex-col items-center">
          <span className="grid size-11 place-items-center rounded-[10px] border border-border-strong bg-surface-raised">
            <HistoryIcon className="size-5 text-subtle-foreground" />
          </span>
          <h2 className="display mt-6 text-lg text-foreground">
            No emails yet
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Generate an email and it will show up here automatically.
          </p>
          <Button variant="primary" className="mt-7" asChild>
            <Link href="/">Write an email</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search company or subject"
            className="pl-9"
            aria-label="Search history"
          />
        </div>

        <p className="px-1 text-xs text-subtle-foreground">
          {visible.length} of {records.length}
        </p>

        <ul className="flex max-h-[calc(100dvh-16rem)] flex-col gap-1 overflow-y-auto pr-1">
          {visible.map((record) => (
            <li key={record.id}>
              <button
                type="button"
                onClick={() => setActiveId(record.id)}
                aria-current={active?.id === record.id ? "true" : undefined}
                className={cn(
                  "w-full rounded-lg border px-4 py-3 text-left transition-colors duration-150 outline-none",
                  "focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]",
                  active?.id === record.id
                    ? "border-[rgba(32,164,184,0.35)] bg-accent-soft text-accent"
                    : "border-transparent hover:border-border hover:bg-surface-raised",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground">
                    {record.company}
                  </p>
                  <span className="shrink-0 font-mono text-[0.625rem] text-subtle-foreground">
                    {record.confidenceScore}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {record.recommendedSubject || "No subject"}
                </p>
                <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[0.625rem] text-subtle-foreground">
                  <Clock className="size-3" />
                  {formatWhen(record.createdAt)} · {record.productName}
                </p>
              </button>
            </li>
          ))}
          {visible.length === 0 ? (
            <li className="rounded-lg border border-border bg-surface px-4 py-8 text-center text-xs text-muted-foreground">
              Nothing matches “{query}”.
            </li>
          ) : null}
        </ul>
      </div>

      {active ? (
        <article className="flex flex-col rounded-xl border border-border bg-surface">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="accent">{active.productName}</Badge>
                <Badge variant="outline">
                  {getTemplateOrDefault(active.templateId).name}
                </Badge>
                {active.reviewFlags.length > 0 ? (
                  <Badge variant="warning">
                    {active.reviewFlags.length} flag
                    {active.reviewFlags.length === 1 ? "" : "s"}
                  </Badge>
                ) : null}
              </div>
              <h2 className="display mt-3.5 text-lg text-foreground">
                {active.company}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {[active.contactName, active.jobTitle].filter(Boolean).join(" · ") ||
                  "No named contact"}
              </p>
              <p className="mt-2 font-mono text-[0.6875rem] tracking-wide text-subtle-foreground">
                {objectiveLabel(active.objective)} · {toneLabel(active.tone)} ·{" "}
                {lengthLabel(active.length)} · {active.model} ·{" "}
                {formatWhen(active.createdAt)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <CopyButton value={active.email} label="Copy Email" variant="primary" />
              <CopyButton
                value={active.recommendedSubject}
                label="Copy Subject"
                variant="outline"
              />
              <Button variant="outline" size="sm" asChild>
                <Link href={`/?from=${active.id}`}>
                  <RefreshCw />
                  Regenerate
                </Link>
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => void remove(active.id)}
                disabled={deleting === active.id}
              >
                <Trash2 />
                Delete
              </Button>
            </div>
          </header>

          <div className="p-6">
            <Tabs defaultValue="email" className="flex flex-col gap-4">
              <TabsList>
                <TabsTrigger value="email">Email</TabsTrigger>
                <TabsTrigger value="html">HTML preview</TabsTrigger>
                <TabsTrigger value="follow-up">Follow-up</TabsTrigger>
                <TabsTrigger value="brief">Brief</TabsTrigger>
              </TabsList>

              <TabsContent value="email">
                <div className="rounded-lg border border-border bg-surface-raised">
                  <div className="border-b border-border px-5 py-4">
                    <p className="eyebrow">Subject lines</p>
                    <ul className="mt-2.5 flex flex-col gap-1.5">
                      {active.subjects.map((subject) => (
                        <li
                          key={subject}
                          className="flex items-center gap-2 text-sm text-foreground"
                        >
                          {subject === active.recommendedSubject ? (
                            <Badge variant="accent">Recommended</Badge>
                          ) : (
                            <span className="size-1 rounded-full bg-border-strong" />
                          )}
                          {subject}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="px-5 py-5 text-sm leading-[1.75] whitespace-pre-wrap text-foreground">
                    {active.email}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="html">
                <EmailHtmlPreview
                  payload={{
                    templateId: active.templateId,
                    subject: active.recommendedSubject,
                    email: active.email,
                    cta: active.cta,
                    company: active.company,
                    contactName: active.contactName,
                    productName: active.productName,
                    productId: active.productId,
                  }}
                  height={460}
                />
              </TabsContent>

              <TabsContent value="follow-up">
                <div className="rounded-lg border border-border bg-surface-raised px-5 py-5">
                  <p className="text-sm leading-[1.75] whitespace-pre-wrap text-foreground">
                    {active.followUp || "No follow-up was generated."}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="brief">
                <dl className="grid gap-5 md:grid-cols-2">
                  <Meta label="Website" value={active.website} />
                  <Meta label="Industry" value={active.industry} />
                  <Meta label="Pain point" value={active.painPoint} />
                  <Meta label="Outreach angle" value={active.angle} />
                  <Meta label="Call to action" value={active.cta} />
                  <Meta label="Notes" value={active.notes} />
                </dl>
                {active.reviewFlags.length > 0 ? (
                  <div className="mt-6 rounded-lg border border-border bg-surface-raised p-5">
                    <p className="eyebrow">Review flags</p>
                    <ul className="mt-2.5 flex flex-col gap-1.5">
                      {active.reviewFlags.map((flag) => (
                        <li
                          key={flag}
                          className="text-xs leading-relaxed text-muted-foreground"
                        >
                          — {flag}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </TabsContent>
            </Tabs>
          </div>
        </article>
      ) : null}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-2 text-[0.8125rem] leading-relaxed text-muted-foreground">
        {value || <span className="text-subtle-foreground">Not provided</span>}
      </dd>
    </div>
  );
}
