"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, TriangleAlert } from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export interface RenderPayload {
  templateId: string;
  /** Lets block-driven skins pull their grounded lists from the catalogue. */
  productId?: string;
  /** Overrides the saved theme. Omit to use the one from Settings. */
  themeId?: string;
  subject?: string;
  email?: string;
  cta?: string;
  company?: string;
  contactName?: string;
  productName?: string;
  sample?: boolean;
  senderName?: string;
  senderEmail?: string;
  senderCompany?: string;
}

interface Rendered {
  key: string;
  html: string;
  mjml: string;
  warnings: string[];
}

/**
 * Renders MJML on the server and shows the result in a sandboxed iframe, which
 * is the closest we get to an email client without sending anything.
 */
export function EmailHtmlPreview({
  payload,
  height = 520,
  showActions = true,
}: {
  payload: RenderPayload;
  height?: number;
  showActions?: boolean;
}) {
  const key = JSON.stringify(payload);
  const [rendered, setRendered] = useState<Rendered | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);

  // Loading is derived from which payload the state belongs to, so changing the
  // payload shows the spinner again without an extra state update.
  const loading = rendered?.key !== key && error?.key !== key;

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function render() {
      try {
        const response = await fetch("/api/render", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: key,
          signal: controller.signal,
        });
        const data = await response.json();
        if (cancelled) return;

        if (!response.ok) {
          setError({ key, message: data.error ?? "Could not render the template." });
          return;
        }
        setRendered({
          key,
          html: data.html,
          mjml: data.mjml,
          warnings: data.warnings ?? [],
        });
      } catch (cause) {
        if (cancelled || (cause instanceof Error && cause.name === "AbortError")) return;
        setError({
          key,
          message:
            cause instanceof Error ? cause.message : "Could not render the template.",
        });
      }
    }

    void render();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [key]);

  if (error?.key === key) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-raised p-4 text-sm text-muted-foreground">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
        <span>{error.message}</span>
      </div>
    );
  }

  const current = rendered?.key === key ? rendered : null;

  return (
    <div className="flex flex-col gap-3">
      {showActions ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline">MJML → HTML</Badge>
            {current?.warnings.length ? (
              <Badge variant="warning">
                <TriangleAlert />
                {current.warnings.length} MJML warning
                {current.warnings.length === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <CopyButton
              value={current?.html ?? ""}
              label="Copy HTML"
              variant="outline"
              disabled={!current}
            />
            <CopyButton
              value={current?.mjml ?? ""}
              label="Copy MJML"
              variant="ghost"
              disabled={!current}
            />
          </div>
        </div>
      ) : null}

      <div
        className="relative overflow-hidden rounded-lg border border-border bg-white"
        style={{ height }}
      >
        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-surface text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Rendering template…
          </div>
        ) : null}

        {current ? (
          <iframe
            title="Email HTML preview"
            srcDoc={current.html}
            sandbox="allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
            className="size-full border-0"
          />
        ) : (
          <Skeleton className="size-full rounded-none" />
        )}
      </div>
    </div>
  );
}
