import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { readSettings } from "@/lib/db/settings";
import type { AppSettings } from "@/lib/types";

function parseEnvFile(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of contents.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const name = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
      value = value.slice(1, -1);
    }
    out[name] = value;
  }
  return out;
}

function valueFromProcess(name: string): string {
  return (process.env[name] ?? "").trim();
}

function valueFromDotEnv(name: string): string {
  const path = join(process.cwd(), ".env");
  if (!existsSync(path)) return "";
  return (parseEnvFile(readFileSync(path, "utf8"))[name] ?? "").trim();
}

function readEnv(name: string): string {
  return valueFromProcess(name) || valueFromDotEnv(name);
}

/** Reads mail secrets from process env, then `.env` on disk. */
export function readMailEnv(): {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  messageStream: string;
} {
  return {
    apiKey: readEnv("POSTMARK_API_KEY"),
    fromEmail: readEnv("POSTMARK_SENDER_EMAIL") || readEnv("MAXREACH_FROM_EMAIL"),
    fromName: readEnv("POSTMARK_SENDER_NAME") || readEnv("MAXREACH_FROM_NAME"),
    messageStream: readEnv("POSTMARK_MESSAGE_STREAM") || "outbound",
  };
}

export interface ResolvedMailConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  messageStream: string;
  apiKeyConfigured: boolean;
}

/** App settings override sender fields; API key always comes from `.env`. */
export function resolveMailConfig(
  settings?: Pick<
    AppSettings,
    "postmarkSenderName" | "postmarkSenderEmail" | "postmarkMessageStream"
  >,
): ResolvedMailConfig {
  const env = readMailEnv();
  const saved = settings ?? readSettings();

  return {
    apiKey: env.apiKey,
    fromEmail:
      saved.postmarkSenderEmail.trim() ||
      env.fromEmail,
    fromName:
      saved.postmarkSenderName.trim() ||
      env.fromName,
    messageStream:
      saved.postmarkMessageStream.trim() ||
      env.messageStream ||
      "outbound",
    apiKeyConfigured: Boolean(env.apiKey),
  };
}
