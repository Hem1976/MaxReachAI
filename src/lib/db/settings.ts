import "server-only";

import { DEFAULT_SETTINGS } from "@/lib/constants";
import { getDb } from "@/lib/db/client";
import { SettingsSchema } from "@/lib/ai/schemas";
import type { AppSettings } from "@/lib/types";

const SETTINGS_KEY = "app";

/**
 * Settings are stored as a single JSON blob keyed by "app". Missing or
 * malformed values fall back to defaults, so a hand-edited row can never stop
 * the app from starting.
 */
export function readSettings(): AppSettings {
  const row = getDb()
    .prepare<[string], { value: string }>("SELECT value FROM settings WHERE key = ?")
    .get(SETTINGS_KEY);

  if (!row) return { ...DEFAULT_SETTINGS };

  try {
    const parsed = SettingsSchema.partial().safeParse(JSON.parse(row.value));
    if (!parsed.success) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...parsed.data };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(settings: AppSettings): AppSettings {
  const next = SettingsSchema.parse(settings);
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(SETTINGS_KEY, JSON.stringify(next));
  return next;
}
