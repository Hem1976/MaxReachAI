"use client";

import { useState } from "react";
import { Check, Copy, LoaderCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LOCAL_MODEL_TIERS,
  isModelInstalled,
  modelsByTier,
  pullCommand,
  type LocalModelRecommendation,
} from "@/lib/ai/local-models";
import type { OllamaStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LocalModelsPicker({
  activeModel,
  status,
  baseUrl,
  onSelect,
}: {
  activeModel: string;
  status: OllamaStatus;
  baseUrl: string;
  onSelect: (tag: string) => void;
}) {
  const [testingTag, setTestingTag] = useState<string | null>(null);
  const grouped = modelsByTier();

  async function testModel(tag: string) {
    setTestingTag(tag);
    try {
      const response = await fetch("/api/ollama/test-model", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: tag, baseUrl }),
      });
      const payload = (await response.json()) as {
        result?: {
          ok: boolean;
          durationMs: number;
          subjectPreview?: string;
          error?: string;
          hint?: string;
        };
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Model test failed.");
      }

      const result = payload.result;
      if (!result) throw new Error("Empty test response.");

      if (result.ok) {
        toast.success(
          `${tag} passed in ${(result.durationMs / 1000).toFixed(1)}s` +
            (result.subjectPreview ? ` · “${result.subjectPreview}”` : ""),
        );
      } else {
        toast.error(result.error ?? "Model test failed.", {
          description: result.hint,
        });
      }
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Model test failed.");
    } finally {
      setTestingTag(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-medium text-foreground">Recommended local models</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Free open models via Ollama — same runtime as Llama 3.2. Install with{" "}
          <span className="font-mono text-foreground">ollama pull &lt;tag&gt;</span>, then
          Test or Use below.
        </p>
      </div>

      {LOCAL_MODEL_TIERS.map((tier) => {
        const models = grouped.get(tier.id) ?? [];
        if (models.length === 0) return null;

        return (
          <div key={tier.id} className="flex flex-col gap-2">
            <div>
              <p className="eyebrow">{tier.label}</p>
              <p className="mt-0.5 text-[0.6875rem] text-subtle-foreground">{tier.hint}</p>
            </div>
            <ul className="flex flex-col gap-2">
              {models.map((model) => (
                <ModelRow
                  key={model.id}
                  model={model}
                  installed={isModelInstalled(status.models, model.tag)}
                  active={activeModel === model.tag}
                  testing={testingTag === model.tag}
                  onSelect={() => onSelect(model.tag)}
                  onTest={() => void testModel(model.tag)}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function ModelRow({
  model,
  installed,
  active,
  testing,
  onSelect,
  onTest,
}: {
  model: LocalModelRecommendation;
  installed: boolean;
  active: boolean;
  testing: boolean;
  onSelect: () => void;
  onTest: () => void;
}) {
  const command = pullCommand(model.tag);

  function copyPull() {
    void navigator.clipboard.writeText(command);
    toast.success("Pull command copied");
  }

  return (
    <li
      className={cn(
        "rounded-lg border px-4 py-3 transition-colors",
        active
          ? "border-[rgba(32,164,184,0.35)] bg-accent-soft"
          : "border-border bg-surface-raised",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">{model.name}</p>
            <Badge variant="outline" className="font-mono text-[0.625rem]">
              {model.tag}
            </Badge>
            {installed ? (
              <Badge variant="success" className="gap-1">
                <Check className="size-3" />
                Installed
              </Badge>
            ) : (
              <Badge variant="outline">Not installed</Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {model.provider} · {model.footprint} · {model.license}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {model.bestFor}
          </p>
          {model.notes ? (
            <p className="mt-1 text-[0.6875rem] leading-relaxed text-subtle-foreground">
              {model.notes}
            </p>
          ) : null}
          <button
            type="button"
            onClick={copyPull}
            className="mt-2 inline-flex items-center gap-1.5 font-mono text-[0.6875rem] text-accent hover:underline"
          >
            <Copy className="size-3" />
            {command}
          </button>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!installed || testing}
            onClick={onTest}
          >
            {testing ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
            Test
          </Button>
          <Button variant={active ? "primary" : "outline"} size="sm" onClick={onSelect}>
            {active ? "Selected" : "Use"}
          </Button>
        </div>
      </div>
    </li>
  );
}
