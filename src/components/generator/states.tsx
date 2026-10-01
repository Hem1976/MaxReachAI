"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle, Sparkles, TriangleAlert } from "lucide-react";

import { Logomark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const STAGES = [
  { label: "Reading the brief", after: 0 },
  { label: "Matching Maxpro product knowledge", after: 1_200 },
  { label: "Writing subject lines and body", after: 3_000 },
  { label: "Checking for unverifiable claims", after: 18_000 },
] as const;

export function GeneratorEmptyState() {
  return (
    <div className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden px-8 py-16 text-center">
      <div className="grid-texture pointer-events-none absolute inset-0 opacity-60" />

      <div className="relative flex max-w-md flex-col items-center">
        <Logomark className="size-11 rounded-[10px]" />
        <h2 className="display mt-6 text-xl text-foreground">
          Fill in the form, then generate
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Start with the company name. Add a few notes about them if you have
          any. You will get subject lines and an email on this side.
        </p>

        <ul className="mt-8 flex w-full flex-col gap-2.5 text-left">
          {[
            "Company name is required. Notes make the email better.",
            "You can pick a product, or leave Auto-detect.",
            "Every email is saved under History.",
          ].map((line) => (
            <li
              key={line}
              className="flex items-start gap-2.5 rounded-lg border border-border bg-surface px-4 py-3 text-[0.8125rem] text-muted-foreground"
            >
              <Check className="mt-0.5 size-3.5 shrink-0 text-accent" />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function GeneratorLoadingState() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const interval = setInterval(() => setElapsed(Date.now() - started), 200);
    return () => clearInterval(interval);
  }, []);

  const activeIndex = STAGES.reduce(
    (active, stage, index) => (elapsed >= stage.after ? index : active),
    0,
  );

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg border border-border-strong bg-surface-raised">
            <Sparkles className="size-4 animate-pulse text-accent" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">
              Writing your outreach
            </p>
            <p className="font-mono text-[0.6875rem] text-subtle-foreground">
              {(elapsed / 1000).toFixed(1)}s · running locally
            </p>
          </div>
        </div>
        <Skeleton className="h-8 w-40" />
      </div>

      <div className="border-b border-border p-6">
        <ul className="flex flex-col gap-3">
          {STAGES.map((stage, index) => {
            const done = index < activeIndex;
            const active = index === activeIndex;
            return (
              <li
                key={stage.label}
                className={cn(
                  "flex items-center gap-3 text-[0.8125rem] transition-colors duration-300",
                  done
                    ? "text-muted-foreground"
                    : active
                      ? "text-foreground"
                      : "text-subtle-foreground",
                )}
              >
                {done ? (
                  <Check className="size-3.5 shrink-0 text-success" />
                ) : active ? (
                  <LoaderCircle className="size-3.5 shrink-0 animate-spin text-accent" />
                ) : (
                  <span className="ml-1 size-1.5 shrink-0 rounded-full bg-border-strong" />
                )}
                {stage.label}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
        <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface-raised p-5">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="mt-3 h-3.5 w-full" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>
      </div>
    </div>
  );
}

export function GeneratorErrorState({
  title,
  hint,
  onRetry,
}: {
  title: string;
  hint?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-8 py-16">
      <div className="flex max-w-lg flex-col items-center text-center">
        <span className="grid size-11 place-items-center rounded-[10px] border border-[rgba(192,57,57,0.28)] bg-[rgba(192,57,57,0.08)]">
          <TriangleAlert className="size-5 text-danger" />
        </span>
        <h2 className="display mt-6 text-lg text-foreground">{title}</h2>
        {hint ? (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{hint}</p>
        ) : null}
        {onRetry ? (
          <Button variant="default" className="mt-6" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Shown in place of the generator when Ollama is unreachable. */
export function OllamaSetupState({
  baseUrl,
  message,
  onRecheck,
}: {
  baseUrl: string;
  message?: string;
  onRecheck: () => void;
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-8 py-16">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-danger" />
          <p className="font-mono text-[0.625rem] tracking-[0.1em] text-danger uppercase">
            Not connected
          </p>
        </div>

        <h2 className="display mt-4 text-xl text-foreground">
          Start Ollama to write emails
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Emails are written on this computer. Open Ollama so it is listening at{" "}
          <span className="font-mono text-foreground">{baseUrl}</span>.
        </p>

        <ol className="mt-7 flex flex-col gap-3">
          {[
            {
              step: "Install Ollama",
              detail: "Download it from ollama.com and finish setup.",
            },
            {
              step: "Open the Ollama app",
              detail: "Leave it running in the background.",
            },
            {
              step: "Download a model",
              detail: 'In a terminal, run "ollama pull llama3.2".',
            },
            {
              step: "Come back here",
              detail: "Click Re-check, then pick the model in Settings if needed.",
            },
          ].map((item, index) => (
            <li
              key={item.step}
              className="flex gap-4 rounded-lg border border-border bg-surface px-4 py-3.5"
            >
              <span className="font-mono text-xs text-subtle-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-[0.8125rem] font-medium text-foreground">
                  {item.step}
                </span>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {item.detail}
                </span>
              </span>
            </li>
          ))}
        </ol>

        {message ? (
          <p className="mt-5 rounded-lg border border-border bg-surface-raised px-4 py-3 font-mono text-[0.6875rem] leading-relaxed text-muted-foreground">
            {message}
          </p>
        ) : null}

        <Button variant="primary" className="mt-6" onClick={onRecheck}>
          Re-check connection
        </Button>
      </div>
    </div>
  );
}
