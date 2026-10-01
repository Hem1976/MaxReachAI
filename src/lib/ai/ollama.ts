import type { OllamaStatus } from "@/lib/types";

/**
 * OLLAMA ADAPTER
 * ==============
 * The only place in the app that knows how to talk to a model runtime.
 * Everything above this file deals in messages and JSON, so swapping the
 * runtime or the model means changing this file and nothing else.
 */

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  temperature: number;
  timeoutMs: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  /** JSON schema for structured output, or "json" for free-form JSON. */
  format?: object | "json";
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResponse {
  content: string;
  model: string;
  /** Server-side generation time as reported by Ollama, in milliseconds. */
  durationMs: number;
}

export type OllamaErrorCode =
  | "unreachable"
  | "timeout"
  | "model-missing"
  | "bad-response"
  | "server-error";

export class OllamaError extends Error {
  readonly code: OllamaErrorCode;
  /** Operator-facing guidance shown in the UI instead of a raw stack trace. */
  readonly hint: string;

  constructor(code: OllamaErrorCode, message: string, hint: string) {
    super(message);
    this.name = "OllamaError";
    this.code = code;
    this.hint = hint;
  }
}

function normaliseBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function unreachable(baseUrl: string, cause: unknown): OllamaError {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new OllamaError(
    "unreachable",
    `Could not reach Ollama at ${baseUrl}`,
    `Start Ollama and try again. On Windows, launch the Ollama app or run "ollama serve" in a terminal, then confirm ${baseUrl}/api/tags responds. Original error: ${detail}`,
  );
}

async function request(
  baseUrl: string,
  path: string,
  init: RequestInit & { timeoutMs: number },
): Promise<Response> {
  const { timeoutMs, ...rest } = init;
  const url = `${normaliseBaseUrl(baseUrl)}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (cause) {
    if (cause instanceof Error && cause.name === "TimeoutError") {
      throw new OllamaError(
        "timeout",
        `Ollama did not respond within ${Math.round(timeoutMs / 1000)}s`,
        "Smaller models respond faster. Either raise the request timeout in Settings or switch to a lighter model.",
      );
    }
    throw unreachable(normaliseBaseUrl(baseUrl), cause);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    if (response.status === 404 && /model/i.test(body)) {
      const model = body.match(/"([^"]+)" not found/)?.[1] ?? "the selected model";
      throw new OllamaError(
        "model-missing",
        `Model ${model} is not installed`,
        `Run "ollama pull ${model}" in a terminal, or pick an installed model in Settings.`,
      );
    }
    throw new OllamaError(
      "server-error",
      `Ollama returned ${response.status}`,
      body.slice(0, 400) || "No response body.",
    );
  }

  return response;
}

export async function listModels(
  baseUrl: string,
  timeoutMs = 8_000,
): Promise<string[]> {
  const response = await request(baseUrl, "/api/tags", { timeoutMs });
  const payload = (await response.json()) as {
    models?: { name?: string }[];
  };
  return (payload.models ?? [])
    .map((m) => m.name)
    .filter((name): name is string => Boolean(name))
    .sort((a, b) => a.localeCompare(b));
}

export async function getVersion(
  baseUrl: string,
  timeoutMs = 8_000,
): Promise<string | undefined> {
  try {
    const response = await request(baseUrl, "/api/version", { timeoutMs });
    const payload = (await response.json()) as { version?: string };
    return payload.version;
  } catch {
    return undefined;
  }
}

/** Never throws: the UI always wants something to render. */
export async function getStatus(config: {
  baseUrl: string;
  model: string;
}): Promise<OllamaStatus> {
  const baseUrl = normaliseBaseUrl(config.baseUrl);
  try {
    const [models, version] = await Promise.all([
      listModels(baseUrl),
      getVersion(baseUrl),
    ]);
    return {
      connected: true,
      baseUrl,
      version,
      models,
      activeModel: config.model,
      message: models.includes(config.model)
        ? undefined
        : `Model "${config.model}" is not installed. Run "ollama pull ${config.model}" or choose another model.`,
    };
  } catch (error) {
    const hint =
      error instanceof OllamaError
        ? error.hint
        : "Unknown error while contacting Ollama.";
    return {
      connected: false,
      baseUrl,
      models: [],
      activeModel: config.model,
      message: hint,
    };
  }
}

export async function chat(
  config: OllamaConfig,
  req: ChatRequest,
): Promise<ChatResponse> {
  const response = await request(config.baseUrl, "/api/chat", {
    timeoutMs: config.timeoutMs,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      messages: req.messages,
      stream: false,
      ...(req.format ? { format: req.format } : {}),
      // Keeping the model resident makes the second generation in a session
      // dramatically faster than the first.
      keep_alive: "60m",
      options: {
        temperature: req.temperature ?? config.temperature,
        // Smaller context = faster prefill on local CPU/GPU. Prompts are compact.
        num_ctx: 4096,
        num_predict: req.maxTokens ?? 720,
      },
    }),
  });

  const payload = (await response.json()) as {
    message?: { content?: string };
    model?: string;
    total_duration?: number;
    error?: string;
  };

  if (payload.error) {
    throw new OllamaError("server-error", payload.error, "Reported by Ollama.");
  }

  const content = payload.message?.content?.trim();
  if (!content) {
    throw new OllamaError(
      "bad-response",
      "Ollama returned an empty response",
      "This usually means the model ran out of context or was interrupted. Try again, or switch to a different model in Settings.",
    );
  }

  return {
    content,
    model: payload.model ?? config.model,
    durationMs: Math.round((payload.total_duration ?? 0) / 1_000_000),
  };
}

/** Loads the model into memory so the first real generation is not the cold one. */
export async function warmUp(config: OllamaConfig): Promise<void> {
  await request(config.baseUrl, "/api/chat", {
    timeoutMs: Math.min(config.timeoutMs, 120_000),
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content: "ok" }],
      stream: false,
      keep_alive: "60m",
      options: { num_predict: 1 },
    }),
  });
}
