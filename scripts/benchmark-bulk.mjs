import fs from "node:fs";
import path from "node:path";

const BASE = process.env.MAXREACH_BASE ?? "http://localhost:3001";
const CSV_PATH = process.argv[2] ?? "maxpro-test-20.csv";
const LIMIT = Number(process.argv[3] ?? 20);

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const values = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quoted) {
        if (c === '"' && line[i + 1] === '"') {
          field += '"';
          i++;
        } else if (c === '"') quoted = false;
        else field += c;
      } else if (c === '"') quoted = true;
      else if (c === ",") {
        values.push(field);
        field = "";
      } else field += c;
    }
    values.push(field);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (values[i] ?? "").trim();
    });
    rows.push(row);
    if (rows.length >= LIMIT) break;
  }
  return { headers, rows };
}

const mapping = {
  company: "company_name",
  contact: "contact_person",
  email: "email",
};

const csv = fs.readFileSync(path.resolve(CSV_PATH), "utf8");
const { rows } = parseCsv(csv);
const started = Date.now();

const created = await fetch(`${BASE}/api/bulk`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    filename: path.basename(CSV_PATH),
    mapping,
    rows,
    templateId: "cold-introduction",
    product: "auto",
    objective: "start-conversation",
    tone: "professional",
    length: "short",
    concurrency: 2,
  }),
}).then((r) => r.json());

if (!created.job?.id) {
  console.error("Create failed", created);
  process.exit(1);
}

const jobId = created.job.id;
console.log("job", jobId, "rows", rows.length);

await fetch(`${BASE}/api/bulk/${jobId}/start`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
});

while (true) {
  await new Promise((r) => setTimeout(r, 3000));
  const snap = await fetch(`${BASE}/api/bulk/${jobId}`).then((r) => r.json());
  const t = snap.job.totals;
  const done =
    t.ready + t.needs_review + t.approved + t.failed + t.skipped;
  const times = snap.leads
    .filter((l) => l.elapsedMs > 0)
    .map((l) => l.elapsedMs);
  const avg = times.length
    ? Math.round(times.reduce((a, b) => a + b, 0) / times.length / 1000)
    : 0;
  console.log(
    snap.job.status,
    `${done}/${t.total}`,
    `ready=${t.ready}`,
    `review=${t.needs_review}`,
    `failed=${t.failed}`,
    `avg=${avg}s`,
  );
  if (snap.job.status === "completed" || snap.job.status === "failed") {
    const elapsed = Math.round((Date.now() - started) / 1000);
    console.log("---");
    console.log("total_wall_s", elapsed);
    console.log("avg_email_s", avg);
    console.log("ollama_calls_per_lead", "1 (+ repairs if validation failed)");
    process.exit(snap.job.status === "completed" ? 0 : 1);
  }
}
