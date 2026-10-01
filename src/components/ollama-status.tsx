"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { OllamaStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const OFFLINE: OllamaStatus = {
  connected: false,
  baseUrl: "",
  models: [],
  activeModel: "",
  message: "MaxReach could not reach its own status endpoint.",
};

async function fetchStatus(signal?: AbortSignal): Promise<OllamaStatus> {
  const response = await fetch("/api/ollama/status", {
    cache: "no-store",
    signal,
  });
  const payload = await response.json();
  return payload.status as OllamaStatus;
}

/**
 * Sidebar connection indicator. Polls slowly — the point is to notice that
 * Ollama died, not to hammer it while a generation is running.
 */
export function OllamaStatusPanel() {
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    // Inlined rather than extracted so the first state update provably happens
    // after an await, not synchronously inside the effect body.
    async function poll() {
      try {
        const next = await fetchStatus(controller.signal);
        if (!cancelled) setStatus(next);
      } catch (cause) {
        if (cancelled || (cause instanceof Error && cause.name === "AbortError")) return;
        setStatus(OFFLINE);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void poll();
    const interval = setInterval(() => void poll(), 45_000);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await fetchStatus());
    } catch {
      setStatus(OFFLINE);
    } finally {
      setLoading(false);
    }
  }, []);

  const connected = status?.connected ?? false;
  const hasModel = connected && !status?.message;

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span
              className={cn(
                "size-2 rounded-full",
                loading && !status
                  ? "bg-subtle-foreground"
                  : hasModel
                    ? "bg-success"
                    : connected
                      ? "bg-warning"
                      : "bg-danger",
              )}
            />
            {hasModel ? (
              <span className="absolute inset-0 animate-ping rounded-full bg-success/60" />
            ) : null}
          </span>
          <span className="text-xs font-medium">
            {loading && !status
              ? "Checking…"
              : connected
                ? "AI is ready"
                : "Ollama is off"}
          </span>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="iconSm"
              onClick={() => void refresh()}
              aria-label="Re-check Ollama connection"
            >
              {loading ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Re-check Ollama</TooltipContent>
        </Tooltip>
      </div>

      <p className="mt-2 truncate text-xs text-muted-foreground">
        {connected ? status?.activeModel : "Start Ollama, then refresh"}
      </p>

      {status?.message ? (
        <p className="mt-2 border-t border-border pt-2 text-[0.6875rem] leading-relaxed text-muted-foreground">
          {status.message}
        </p>
      ) : null}
    </div>
  );
}
