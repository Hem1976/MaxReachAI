"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { BriefForm } from "@/components/generator/brief-form";
import {
  ResultPanel,
  type BusyAction,
  type RefineAction,
} from "@/components/generator/result-panel";
import {
  GeneratorEmptyState,
  GeneratorErrorState,
  GeneratorLoadingState,
  OllamaSetupState,
} from "@/components/generator/states";
import type { LeadBrief, OllamaStatus, OutreachDraft, OutreachResult } from "@/lib/types";

interface ApiError {
  error: string;
  hint?: string;
  issues?: string[];
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = payload as ApiError;
    throw new GeneratorRequestError(
      error.error ?? "The request failed.",
      error.hint ?? error.issues?.join(" "),
    );
  }

  return payload as T;
}

class GeneratorRequestError extends Error {
  readonly hint?: string;
  constructor(message: string, hint?: string) {
    super(message);
    this.hint = hint;
  }
}

function toDraft(result: OutreachResult): OutreachDraft {
  return {
    recommendedProduct: result.recommendedProduct,
    painPoint: result.painPoint,
    angle: result.angle,
    subjects: result.subjects,
    recommendedSubject: result.recommendedSubject,
    email: result.email,
    cta: result.cta,
    followUp: result.followUp,
  };
}

const refineToast: Record<RefineAction, string> = {
  shorter: "Email shortened",
  "more-persuasive": "Email rewritten",
  "follow-up": "Follow-up written",
};

export function GeneratorWorkspace({
  initialBrief,
  initialStatus,
  themeId,
}: {
  initialBrief: LeadBrief;
  initialStatus: OllamaStatus;
  /** The email theme saved in Settings. The result panel can preview others. */
  themeId: string;
}) {
  const [brief, setBrief] = useState<LeadBrief>(initialBrief);
  const [status, setStatus] = useState<OllamaStatus>(initialStatus);
  const [result, setResult] = useState<OutreachResult | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState<{ title: string; hint?: string } | null>(null);

  // Kept in a ref so a refine that lands after a regenerate cannot overwrite it.
  const requestId = useRef(0);

  const updateBrief = useCallback((patch: Partial<LeadBrief>) => {
    setBrief((current) => ({ ...current, ...patch }));
  }, []);

  const recheckStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/ollama/status", { cache: "no-store" });
      const payload = await response.json();
      setStatus(payload.status as OllamaStatus);
      if (payload.status?.connected) toast.success("Ollama connected");
      else toast.error("Ollama is still not reachable");
    } catch {
      toast.error("Could not check the Ollama connection");
    }
  }, []);

  const generate = useCallback(
    async (mode: "generate" | "regenerate") => {
      const id = ++requestId.current;
      setBusy(mode === "generate" ? "regenerate" : "regenerate");
      setError(null);
      if (mode === "generate") setResult(null);

      try {
        const payload = await postJson<{
          result: OutreachResult;
          warnings: string[];
          historyId: string;
        }>("/api/generate", brief);

        if (id !== requestId.current) return;

        setResult(payload.result);
        setHistoryId(payload.historyId);
        setSelectedSubject(
          payload.result.recommendedSubject || payload.result.subjects[0] || "",
        );

        if (payload.warnings.length > 0) {
          toast.warning("Draft needs a look", {
            description: payload.warnings[0],
          });
        } else {
          toast.success(
            `Outreach ready in ${(payload.result.elapsedMs / 1000).toFixed(1)}s`,
          );
        }
      } catch (cause) {
        if (id !== requestId.current) return;
        const message =
          cause instanceof Error ? cause.message : "Generation failed.";
        const hint = cause instanceof GeneratorRequestError ? cause.hint : undefined;
        setError({ title: message, hint });
        toast.error(message, { description: hint });
      } finally {
        if (id === requestId.current) setBusy(null);
      }
    },
    [brief],
  );

  const refine = useCallback(
    async (action: RefineAction) => {
      if (!result) return;
      const id = ++requestId.current;
      setBusy(action);

      try {
        const payload = await postJson<{ patch: Partial<OutreachDraft> }>(
          "/api/refine",
          { action, brief, current: toDraft(result) },
        );

        if (id !== requestId.current) return;

        const next: OutreachResult = { ...result, ...payload.patch };
        setResult(next);
        if (payload.patch.subjects?.length) {
          setSelectedSubject(next.recommendedSubject || next.subjects[0] || "");
        }
        toast.success(refineToast[action]);

        // Keep the saved record in step with what the rep is actually looking at.
        if (historyId) {
          void fetch(`/api/history/${historyId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              email: next.email,
              subjects: next.subjects,
              recommendedSubject: next.recommendedSubject,
              followUp: next.followUp,
            }),
          });
        }
      } catch (cause) {
        if (id !== requestId.current) return;
        const message = cause instanceof Error ? cause.message : "Refinement failed.";
        const hint = cause instanceof GeneratorRequestError ? cause.hint : undefined;
        toast.error(message, { description: hint });
      } finally {
        if (id === requestId.current) setBusy(null);
      }
    },
    [brief, historyId, result],
  );

  const generating = busy === "regenerate" && !result;

  return (
    <div className="grid min-h-[calc(100dvh-1px)] grid-cols-1 xl:grid-cols-[minmax(380px,440px)_minmax(0,1fr)]">
      <div className="border-border bg-surface xl:h-[calc(100dvh)] xl:overflow-y-auto xl:border-r">
        <BriefForm
          brief={brief}
          onChange={updateBrief}
          onSubmit={() => void generate("generate")}
          busy={busy === "regenerate"}
          disabled={!status.connected}
        />
      </div>

      <div className="min-w-0 xl:h-[calc(100dvh)] xl:overflow-y-auto">
        {!status.connected ? (
          <OllamaSetupState
            baseUrl={status.baseUrl}
            message={status.message}
            onRecheck={() => void recheckStatus()}
          />
        ) : generating ? (
          <GeneratorLoadingState />
        ) : error && !result ? (
          <GeneratorErrorState
            title={error.title}
            hint={error.hint}
            onRetry={() => void generate("generate")}
          />
        ) : result ? (
          <ResultPanel
            result={result}
            brief={brief}
            themeId={themeId}
            busy={busy}
            selectedSubject={selectedSubject}
            onSelectSubject={setSelectedSubject}
            onRegenerate={() => void generate("regenerate")}
            onRefine={(action) => void refine(action)}
          />
        ) : (
          <GeneratorEmptyState />
        )}
      </div>
    </div>
  );
}
