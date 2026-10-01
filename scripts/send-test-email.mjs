import { basename, extname } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function parseEnvFile(contents) {
  const out = {};
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

function readEnv(name) {
  if (process.env[name]) return process.env[name].trim();
  const path = join(process.cwd(), ".env");
  if (!existsSync(path)) return "";
  return (parseEnvFile(readFileSync(path, "utf8"))[name] ?? "").trim();
}

const to = process.argv[2];
const htmlPath = process.argv[3];
const attachmentPaths = process.argv.slice(4);
if (!to || !htmlPath) {
  console.error("Usage: node scripts/send-test-email.mjs <to> <html-file> [attachment ...]");
  process.exit(1);
}

const MIME_BY_EXT = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".zip": "application/zip",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  ".m4v": "video/x-m4v",
};

const apiKey = readEnv("POSTMARK_API_KEY");
const fromEmail = readEnv("POSTMARK_SENDER_EMAIL") || readEnv("MAXREACH_FROM_EMAIL");
const fromName = readEnv("POSTMARK_SENDER_NAME") || readEnv("MAXREACH_FROM_NAME") || "MaxPro Infotech";
const stream = readEnv("POSTMARK_MESSAGE_STREAM") || "outbound";

if (!apiKey || !fromEmail) {
  console.error("Missing POSTMARK_API_KEY or POSTMARK_SENDER_EMAIL in .env");
  process.exit(1);
}

let html = readFileSync(htmlPath, "utf8");
html = html.replace(
  /<a\b([^>]*?)href=(["'])(https?:\/\/[^"']+)\2([^>]*)>/gi,
  (full, before, quote, href, after) => {
    if (/target\s*=/i.test(before + after)) return full;
    return `<a${before}href=${quote}${href}${quote} target="_blank" rel="noopener noreferrer"${after}>`;
  },
);

const text = html
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const attachments = attachmentPaths.map((path) => {
  if (!existsSync(path)) {
    console.error("Attachment not found:", path);
    process.exit(1);
  }
  const bytes = readFileSync(path);
  const ext = extname(path).toLowerCase();
  return {
    Name: basename(path),
    Content: bytes.toString("base64"),
    ContentType: MIME_BY_EXT[ext] ?? "application/octet-stream",
  };
});

const response = await fetch("https://api.postmarkapp.com/email", {
  method: "POST",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Postmark-Server-Token": apiKey,
  },
  body: JSON.stringify({
    From: `${fromName} <${fromEmail}>`,
    To: to,
    Subject: "MaxPro Business Solutions – Test Email",
    HtmlBody: html,
    TextBody: text.slice(0, 8000),
    MessageStream: stream,
    ...(attachments.length ? { Attachments: attachments } : {}),
  }),
});

const body = await response.text();
console.log(response.status, body);
