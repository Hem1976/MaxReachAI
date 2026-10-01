import "server-only";

import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

/**
 * Local SQLite persistence. Nothing leaves the machine.
 * Override the location with MAXREACH_DB_PATH if the default is inconvenient.
 */
const DB_PATH =
  process.env.MAXREACH_DB_PATH ?? path.join(process.cwd(), "data", "maxreach.db");

type DatabaseHandle = Database.Database;

// Cached on globalThis so dev-server hot reloads reuse one connection instead
// of leaking a new file handle on every edit.
const globalCache = globalThis as typeof globalThis & {
  __maxreachDb?: DatabaseHandle;
};

function migrate(db: DatabaseHandle): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS history (
      id                 TEXT PRIMARY KEY,
      company            TEXT NOT NULL,
      contact_name       TEXT NOT NULL DEFAULT '',
      job_title          TEXT NOT NULL DEFAULT '',
      website            TEXT NOT NULL DEFAULT '',
      industry           TEXT NOT NULL DEFAULT '',
      notes              TEXT NOT NULL DEFAULT '',
      product_id         TEXT NOT NULL DEFAULT '',
      product_name       TEXT NOT NULL DEFAULT '',
      objective          TEXT NOT NULL DEFAULT '',
      tone               TEXT NOT NULL DEFAULT '',
      length             TEXT NOT NULL DEFAULT '',
      template_id        TEXT NOT NULL DEFAULT '',
      subjects           TEXT NOT NULL DEFAULT '[]',
      recommended_subject TEXT NOT NULL DEFAULT '',
      email              TEXT NOT NULL DEFAULT '',
      pain_point         TEXT NOT NULL DEFAULT '',
      angle              TEXT NOT NULL DEFAULT '',
      cta                TEXT NOT NULL DEFAULT '',
      follow_up          TEXT NOT NULL DEFAULT '',
      confidence_score   INTEGER NOT NULL DEFAULT 0,
      review_flags       TEXT NOT NULL DEFAULT '[]',
      model              TEXT NOT NULL DEFAULT '',
      created_at         TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS history_created_at_idx ON history (created_at DESC);
    CREATE INDEX IF NOT EXISTS history_company_idx ON history (company);

    CREATE TABLE IF NOT EXISTS bulk_jobs (
      id           TEXT PRIMARY KEY,
      filename     TEXT NOT NULL,
      status       TEXT NOT NULL,
      template_id  TEXT NOT NULL,
      product      TEXT NOT NULL,
      objective    TEXT NOT NULL,
      tone         TEXT NOT NULL,
      length       TEXT NOT NULL,
      concurrency  INTEGER NOT NULL DEFAULT 2,
      mapping      TEXT NOT NULL,
      error        TEXT NOT NULL DEFAULT '',
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bulk_leads (
      id                   TEXT PRIMARY KEY,
      job_id               TEXT NOT NULL,
      row_index            INTEGER NOT NULL,
      company              TEXT NOT NULL DEFAULT '',
      first_name           TEXT NOT NULL DEFAULT '',
      last_name            TEXT NOT NULL DEFAULT '',
      contact_name         TEXT NOT NULL DEFAULT '',
      email                TEXT NOT NULL DEFAULT '',
      website              TEXT NOT NULL DEFAULT '',
      job_title            TEXT NOT NULL DEFAULT '',
      industry             TEXT NOT NULL DEFAULT '',
      notes                TEXT NOT NULL DEFAULT '',
      status               TEXT NOT NULL,
      stage                TEXT NOT NULL DEFAULT '',
      error                TEXT NOT NULL DEFAULT '',
      product_id           TEXT NOT NULL DEFAULT '',
      product_name         TEXT NOT NULL DEFAULT '',
      pain_point           TEXT NOT NULL DEFAULT '',
      angle                TEXT NOT NULL DEFAULT '',
      subjects             TEXT NOT NULL DEFAULT '[]',
      recommended_subject  TEXT NOT NULL DEFAULT '',
      email_body           TEXT NOT NULL DEFAULT '',
      cta                  TEXT NOT NULL DEFAULT '',
      follow_up_1          TEXT NOT NULL DEFAULT '',
      follow_up_2          TEXT NOT NULL DEFAULT '',
      review_flags         TEXT NOT NULL DEFAULT '[]',
      confidence_score     INTEGER NOT NULL DEFAULT 0,
      history_id           TEXT NOT NULL DEFAULT '',
      elapsed_ms           INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (job_id) REFERENCES bulk_jobs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS bulk_jobs_updated_at_idx ON bulk_jobs (updated_at DESC);
    CREATE INDEX IF NOT EXISTS bulk_leads_job_status_idx ON bulk_leads (job_id, status);

    CREATE TABLE IF NOT EXISTS companies (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      website     TEXT NOT NULL DEFAULT '',
      website_key TEXT NOT NULL DEFAULT '',
      name_key    TEXT NOT NULL DEFAULT '',
      industry    TEXT NOT NULL DEFAULT '',
      notes       TEXT NOT NULL DEFAULT '',
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id          TEXT PRIMARY KEY,
      company_id  TEXT NOT NULL,
      first_name  TEXT NOT NULL DEFAULT '',
      last_name   TEXT NOT NULL DEFAULT '',
      email       TEXT NOT NULL DEFAULT '',
      job_title   TEXT NOT NULL DEFAULT '',
      source      TEXT NOT NULL DEFAULT 'csv',
      created_at  TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS companies_updated_at_idx ON companies (updated_at DESC);
    CREATE INDEX IF NOT EXISTS companies_name_key_idx ON companies (name_key);
    CREATE INDEX IF NOT EXISTS contacts_company_id_idx ON contacts (company_id);

    CREATE TABLE IF NOT EXISTS campaigns (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'draft',
      template_id  TEXT NOT NULL DEFAULT '',
      theme_id     TEXT NOT NULL DEFAULT '',
      product_id   TEXT NOT NULL DEFAULT '',
      subject      TEXT NOT NULL DEFAULT '',
      body         TEXT NOT NULL DEFAULT '',
      cta          TEXT NOT NULL DEFAULT '',
      sender_name  TEXT NOT NULL DEFAULT '',
      sender_email TEXT NOT NULL DEFAULT '',
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS campaigns_updated_at_idx ON campaigns (updated_at DESC);
    CREATE INDEX IF NOT EXISTS campaigns_status_idx ON campaigns (status);

    CREATE TABLE IF NOT EXISTS campaign_recipients (
      id                   TEXT PRIMARY KEY,
      campaign_id          TEXT NOT NULL,
      contact_id           TEXT NOT NULL,
      status               TEXT NOT NULL DEFAULT 'queued',
      error                TEXT NOT NULL DEFAULT '',
      provider_message_id  TEXT NOT NULL DEFAULT '',
      sent_at              TEXT NOT NULL DEFAULT '',
      created_at           TEXT NOT NULL,
      updated_at           TEXT NOT NULL,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
      UNIQUE (campaign_id, contact_id)
    );

    CREATE INDEX IF NOT EXISTS campaign_recipients_campaign_idx
      ON campaign_recipients (campaign_id, status);

    CREATE TABLE IF NOT EXISTS contact_lists (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      filename      TEXT NOT NULL DEFAULT '',
      contact_count INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contact_list_members (
      list_id     TEXT NOT NULL,
      contact_id  TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      PRIMARY KEY (list_id, contact_id),
      FOREIGN KEY (list_id) REFERENCES contact_lists(id) ON DELETE CASCADE,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS contact_lists_updated_at_idx
      ON contact_lists (updated_at DESC);
    CREATE INDEX IF NOT EXISTS contact_list_members_contact_idx
      ON contact_list_members (contact_id);
  `);

  ensureColumn(db, "bulk_leads", "cta", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "campaigns", "slots", "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(db, "campaigns", "html_draft", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "campaigns", "cc_enabled", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "campaigns", "cc_email", "TEXT NOT NULL DEFAULT 'hemant.patel@maxproinfotech.com'");
  ensureColumn(db, "contacts", "subject", "TEXT NOT NULL DEFAULT ''");

  db.exec(`
    CREATE TABLE IF NOT EXISTS campaign_attachments (
      id            TEXT PRIMARY KEY,
      campaign_id   TEXT NOT NULL,
      filename      TEXT NOT NULL,
      content_type  TEXT NOT NULL,
      size_bytes    INTEGER NOT NULL,
      storage_path  TEXT NOT NULL,
      created_at    TEXT NOT NULL,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS campaign_attachments_campaign_idx
      ON campaign_attachments (campaign_id, created_at);
  `);

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS companies_website_key_uniq
      ON companies (website_key) WHERE website_key != '';
    CREATE UNIQUE INDEX IF NOT EXISTS contacts_company_email_uniq
      ON contacts (company_id, email) WHERE email != '';
  `);
}

function ensureColumn(
  db: DatabaseHandle,
  table: string,
  column: string,
  definition: string,
): void {
  const columns = db
    .prepare<[], { name: string }>(`PRAGMA table_info(${table})`)
    .all();
  if (columns.some((entry) => entry.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export function getDb(): DatabaseHandle {
  if (globalCache.__maxreachDb) {
    migrate(globalCache.__maxreachDb);
    return globalCache.__maxreachDb;
  }

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  migrate(db);

  globalCache.__maxreachDb = db;
  return db;
}

export function dbPath(): string {
  return DB_PATH;
}
