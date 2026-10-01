import { ZodError } from "zod";

import { OllamaError } from "@/lib/ai/ollama";
import { CampaignError } from "@/lib/campaigns/store";
import { CampaignValidationError } from "@/lib/campaigns/validation";
import { CampaignSendError } from "@/lib/mail/types";

export interface ApiErrorBody {
  error: string;
  hint?: string;
  code?: string;
  issues?: string[];
}

export function jsonOk<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

/**
 * Turns anything thrown inside a route handler into a response the UI can show
 * a human. Ollama failures keep their setup guidance instead of surfacing as a
 * generic 500.
 */
export function jsonError(error: unknown): Response {
  if (error instanceof ZodError) {
    return Response.json(
      {
        error: "The request was not valid.",
        issues: error.issues.map(
          (issue) => `${issue.path.join(".") || "value"}: ${issue.message}`,
        ),
      } satisfies ApiErrorBody,
      { status: 422 },
    );
  }

  if (error instanceof OllamaError) {
    const status = error.code === "unreachable" ? 503 : 502;
    return Response.json(
      { error: error.message, hint: error.hint, code: error.code } satisfies ApiErrorBody,
      { status },
    );
  }

  if (error instanceof CampaignValidationError) {
    return Response.json(
      { error: error.message, validation: error.result } satisfies ApiErrorBody & {
        validation: typeof error.result;
      },
      { status: 422 },
    );
  }

  if (error instanceof CampaignSendError) {
    return Response.json(
      { error: error.message, code: error.code } satisfies ApiErrorBody,
      { status: error.status },
    );
  }

  if (error instanceof CampaignError) {
    const notFound =
      error.message === "Campaign not found." || error.message === "Recipient not found.";
    return Response.json(
      { error: error.message } satisfies ApiErrorBody,
      { status: notFound ? 404 : 400 },
    );
  }

  const message = error instanceof Error ? error.message : "Unexpected error.";
  console.error("[maxreach] request failed:", error);
  return Response.json({ error: message } satisfies ApiErrorBody, { status: 500 });
}
