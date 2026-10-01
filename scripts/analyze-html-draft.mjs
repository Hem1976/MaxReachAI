import Database from "better-sqlite3";
import { readFileSync } from "node:fs";

const id = process.argv[2] ?? "56806b7d-2761-410d-966a-3b780c8d9964";
const db = new Database("data/maxreach.db");
const row = db.prepare("SELECT html_draft FROM campaigns WHERE id = ?").get(id);
if (!row) {
  console.log("not found");
  process.exit(1);
}
const html = row.html_draft ?? "";
const b64 = html.match(/data:image/g)?.length ?? 0;
console.log({
  length: html.length,
  base64Images: b64,
  doctypes: html.match(/<!DOCTYPE/gi)?.length ?? 0,
  title: html.match(/<title>([^<]*)<\/title>/i)?.[1],
});

const clean = readFileSync(
  "C:/Users/PC/Downloads/MaxPro_Business_Solutions_Email.html",
  "utf8",
);
console.log("clean file length:", clean.length);
