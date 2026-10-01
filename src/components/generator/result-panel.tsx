"use client";

import { useState } from "react";
import {
  Check,
  CornerDownRight,
  Eye,
  LoaderCircle,
  Mail,
  RefreshCw,
  Scissors,
  Target,
  TriangleAlert,
  WandSparkles,
} from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { EmailHtmlPreview } from "@/components/email-html-preview";
import { ConfidenceMeter } from "@/components/generator/confidence-meter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { objectiveLabel, toneLabel } from "@/lib/constants";
import { getTemplateOrDefault } from "@/lib/templates";
import { emailThemes } from "@/lib/templates/themes";
import type { LeadBrief, OutreachResult } from "@/lib/types";
import { cn } from "@/lib/utils";

export type RefineAction = "shorter" | "more-persuasive" | "follow-up";
export type BusyAction = RefineAction | "regenerate" | null;

export function ResultPanel({
  result,
  brief,
  themeId: savedThemeId,
  busy,
  selectedSubject,
  onSelectSubject,
  onRegenerate,
  onRefine,
}: {
  result: OutreachResult;
  brief: LeadBrief;
  themeId: string;
  busy: BusyAction;
  selectedSubject: string;
  onSelectSubject: (subject: string) => void;
  onRegenerate: () => void;
  onRefine: (action: RefineAction) => void;
}) {
  const template = getTemplateOrDefault(result.templateId);
  const anyBusy = busy !== null;
  // Starts from the saved default; the picker overrides it for this preview
  // only, so trying a theme never changes the team's setting.
  const [themeId, setThemeId] = useState(savedThemeId);

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent">{result.productName}</Badge>
            {result.autoDetected ? <Badge>Auto-detected</Badge> : null}
            <Badge variant="outline">{template.name}</Badge>
          </div>
          <p className="mt-3 truncate text-sm text-foreground">
            {brief.company}
            {brief.contactName ? (
              <span className="text-muted-foreground"> · {brief.contactName}</span>
            ) : null}
          </p>
          <p className="mt-1 font-mono text-[0.6875rem] tracking-wide text-subtle-foreground">
            {objectiveLabel(brief.objective)} · {toneLabel(brief.tone)} ·{" "}
            {result.model} · {(result.elapsedMs / 1000).toFixed(1)}s
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <ConfidenceMeter confidence={result.confidence} compact />
          <CopyButton
            value={result.email}
            label="Copy email"
            variant="primary"
            successMessage="Email body copied"
          />
          <CopyButton
            value={selectedSubject}
            label="Copy subject"
            variant="outline"
            successMessage="Subject line copied"
          />
        </div>
      </div>

      {result.reviewFlags.length > 0 ? (
        <div className="border-b border-border bg-[rgba(148,100,0,0.06)] px-6 py-4">
          <div className="flex items-center gap-2">
            <TriangleAlert className="size-4 text-warning" />
            <p className="text-[0.8125rem] font-medium text-foreground">
              Check before sending
            </p>
          </div>
          <ul className="mt-2 flex flex-col gap-1.5">
            {result.reviewFlags.map((flag) => (
              <li key={flag} className="text-xs leading-relaxed text-muted-foreground">
                — {flag}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-b border-border p-6">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm font-medium text-foreground">Subject lines</p>
          <span className="text-[0.6875rem] text-subtle-foreground">
            Click one to copy
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {result.subjects.map((subject) => {
            const selected = subject === selectedSubject;
            const recommended = subject === result.recommendedSubject;

            return (
              <button
                key={subject}
                type="button"
                onClick={() => onSelectSubject(subject)}
                aria-pressed={selected}
                className={cn(
                  "group flex items-center justify-between gap-4 rounded-lg border px-4 py-3 text-left transition-colors duration-150 outline-none",
                  "focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]",
                  selected
                    ? "border-[rgba(32,164,184,0.35)] bg-accent-soft text-accent"
                    : "border-border bg-surface-raised hover:border-border-strong hover:bg-surface-hover",
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded-full border",
                      selected
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border-strong",
                    )}
                  >
                    {selected ? <Check className="size-2.5" /> : null}
                  </span>
                  <span className="truncate text-sm text-foreground">{subject}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {recommended ? <Badge variant="accent">Recommended</Badge> : null}
                  <span className="font-mono text-[0.625rem] text-subtle-foreground">
                    {subject.length}c
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Tabs defaultValue="email" className="flex flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-6">
          <TabsList>
            <TabsTrigger value="email">
              <Mail />
              Email
            </TabsTrigger>
            <TabsTrigger value="html">
              <Eye />
              Preview
            </TabsTrigger>
            <TabsTrigger value="follow-up">
              <CornerDownRight />
              Follow-up
            </TabsTrigger>
            <TabsTrigger value="insights">
              <Target />
              Insights
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="email" className="flex-1 p-6">
          <article className="rounded-lg border border-border bg-surface-raised">
            <div className="border-b border-border px-5 py-3">
              <p className="eyebrow">Subject</p>
              <p className="mt-1.5 text-sm text-foreground">{selectedSubject}</p>
            </div>
            <p className="px-5 py-5 text-sm leading-[1.75] whitespace-pre-wrap text-foreground">
              {result.email}
            </p>
          </article>
        </TabsContent>

        <TabsContent value="html" className="flex-1 p-6">
          <div className="mb-3 max-w-xs">
            <Select value={themeId} onValueChange={setThemeId}>
              <SelectTrigger aria-label="Preview theme" className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {emailThemes.map((theme) => (
                  <SelectItem key={theme.id} value={theme.id}>
                    {theme.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <EmailHtmlPreview
            payload={{
              templateId: result.templateId,
              subject: selectedSubject,
              email: result.email,
              cta: result.cta,
              company: brief.company,
              contactName: brief.contactName,
              productName: result.productName,
              productId: result.productId,
              themeId,
            }}
          />
        </TabsContent>

        <TabsContent value="follow-up" className="flex-1 p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Send this only if the first email gets no reply.
              </p>
              <CopyButton
                value={result.followUp}
                label="Copy follow-up"
                variant="outline"
              />
            </div>
            <article className="rounded-lg border border-border bg-surface-raised px-5 py-5">
              <p className="text-sm leading-[1.75] whitespace-pre-wrap text-foreground">
                {result.followUp}
              </p>
            </article>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="flex-1 p-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-5">
              <Insight label="Recommended product" value={result.productName} />
              <Insight label="Pain point" value={result.painPoint} />
              <Insight label="Outreach angle" value={result.angle} />
              <Insight label="Call to action" value={result.cta} />
            </div>
            <div className="rounded-lg border border-border bg-surface-raised p-5">
              <ConfidenceMeter confidence={result.confidence} />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Separator />

      <div className="flex flex-wrap items-center gap-2 p-6">
        <Button variant="default" onClick={onRegenerate} disabled={anyBusy}>
          {busy === "regenerate" ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <RefreshCw />
          )}
          Regenerate
        </Button>
        <Button
          variant="outline"
          onClick={() => onRefine("shorter")}
          disabled={anyBusy}
        >
          {busy === "shorter" ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <Scissors />
          )}
          Make Shorter
        </Button>
        <Button
          variant="outline"
          onClick={() => onRefine("more-persuasive")}
          disabled={anyBusy}
        >
          {busy === "more-persuasive" ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <WandSparkles />
          )}
          Make More Persuasive
        </Button>
        <Button
          variant="outline"
          onClick={() => onRefine("follow-up")}
          disabled={anyBusy}
        >
          {busy === "follow-up" ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <CornerDownRight />
          )}
          Generate Follow-up
        </Button>
      </div>
    </div>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="mt-2 text-sm leading-relaxed text-foreground">
        {value || <span className="text-subtle-foreground">Not provided</span>}
      </p>
    </div>
  );
}
