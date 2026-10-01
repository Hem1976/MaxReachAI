/**
 * Pulls every CodedMails theme template into vendor/email-templates/codedmails/.
 *
 * CodedMails does not ship a bulk MJML archive. Each template page embeds the
 * MJML source in the Next.js RSC payload; this script extracts it. Compiled
 * HTML is also fetched from the public GitHub mirror as a fallback.
 *
 *   node scripts/vendor-codedmails.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const ROOT = join(process.cwd(), "vendor", "email-templates", "codedmails");
const THEMES = [
  "aleos",
  "canaotes",
  "dineos",
  "faedra",
  "korlavas",
  "mardaloas",
  "meslerides",
  "ormes",
  "orthipis",
  "tetrapis",
  "usiac",
  "xyimeasi",
];
const TYPES = [
  { type: "welcome", slug: "welcome-emails-welcome-email" },
  { type: "reset", slug: "reset-emails-reset-email" },
  { type: "receipt", slug: "receipt-emails-receipt-email" },
  { type: "newsletter", slug: "newsletter-emails-newsletter-email" },
  { type: "notification", slug: "notification-emails-notification-email" },
  { type: "general", slug: "general-emails-general-email" },
];

async function get(url) {
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch(url, { headers: { "User-Agent": "maxreach-vendor" } });
    if (res.ok) return res;
    if (attempt >= 5 || (res.status !== 429 && res.status < 500)) {
      const err = new Error(`${res.status} ${res.statusText} for ${url}`);
      err.status = res.status;
      throw err;
    }
    await new Promise((r) => setTimeout(r, attempt * 1500));
  }
}

function unescapeRsc(html) {
  return html
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">")
    .replace(/\\u0026/gi, "&")
    .replace(/\\u0027/gi, "'")
    .replace(/\\u0022/gi, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function extractMjml(html) {
  const unescaped = unescapeRsc(html);
  const start = unescaped.indexOf("<mjml");
  const end = unescaped.indexOf("</mjml>");
  if (start < 0 || end < start) return null;
  return unescaped.slice(start, end + "</mjml>".length).trim() + "\n";
}

async function vendorOne(theme, typeDef) {
  const page = `https://codedmails.com/templates/${typeDef.slug}-${theme}`;
  const target = join(ROOT, theme, `${typeDef.type}.mjml`);
  try {
    const html = await (await get(page)).text();
    const mjml = extractMjml(html);
    if (!mjml || mjml.length < 200) {
      return { theme, type: typeDef.type, ok: false, reason: "no mjml" };
    }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, mjml, "utf8");
    return { theme, type: typeDef.type, ok: true, bytes: Buffer.byteLength(mjml) };
  } catch (error) {
    return {
      theme,
      type: typeDef.type,
      ok: false,
      reason: error.status === 404 ? "404" : error.message,
    };
  }
}

const jobs = THEMES.flatMap((theme) => TYPES.map((typeDef) => ({ theme, typeDef })));
const results = [];
for (const job of jobs) {
  const result = await vendorOne(job.theme, job.typeDef);
  results.push(result);
  const mark = result.ok ? "OK  " : "SKIP";
  const extra = result.ok ? `${String(result.bytes).padStart(5)} B` : result.reason;
  console.log(`${mark}  ${result.theme.padEnd(12)} ${result.type.padEnd(14)} ${extra}`);
}

const ok = results.filter((r) => r.ok);
const skip = results.filter((r) => !r.ok);
console.log(`\nVendored ${ok.length} MJML files. Skipped ${skip.length}.`);
if (ok.length < 50) process.exitCode = 1;
