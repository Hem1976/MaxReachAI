import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Run through tsx/ts-node alternative: use sqlite directly
import Database from "better-sqlite3";
import path from "node:path";

const dbPath = process.env.MAXREACH_DB_PATH ?? path.join(process.cwd(), "data", "maxreach.db");
const db = new Database(dbPath);

db.pragma("foreign_keys = ON");

const result = db.transaction(() => {
  const deletedLists = db.prepare("DELETE FROM contact_lists").run().changes;
  const deletedContacts = db.prepare("DELETE FROM contacts").run().changes;
  const deletedCompanies = db.prepare("DELETE FROM companies").run().changes;
  return { deletedLists, deletedContacts, deletedCompanies };
})();

console.log("Cleared imported CRM data:", result);
