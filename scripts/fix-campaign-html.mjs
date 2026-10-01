import { readFileSync } from "node:fs";
import Database from "better-sqlite3";

const campaignId = process.argv[2];
const htmlPath = process.argv[3];
if (!campaignId || !htmlPath) {
  console.error("Usage: node scripts/fix-campaign-html.mjs <campaign-id> <html-file>");
  process.exit(1);
}

const html = readFileSync(htmlPath, "utf8").trim();
const db = new Database("data/maxreach.db");
const row = db.prepare("SELECT id, name, LENGTH(html_draft) AS beforeLen FROM campaigns WHERE id = ?").get(campaignId);
if (!row) {
  console.error("Campaign not found:", campaignId);
  process.exit(1);
}

db.prepare(
  `UPDATE campaigns
   SET html_draft = ?, template_id = 'custom-html', updated_at = datetime('now')
   WHERE id = ?`,
).run(html, campaignId);

const after = db.prepare("SELECT LENGTH(html_draft) AS afterLen FROM campaigns WHERE id = ?").get(campaignId);
console.log(`Updated "${row.name}" (${campaignId})`);
console.log(`html_draft: ${row.beforeLen} -> ${after.afterLen} bytes`);
