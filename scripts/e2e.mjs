/**
 * End-to-end check: generate real copy through Ollama, then render it into a
 * block-driven template and confirm the blocks landed where they should.
 *
 *   node scripts/e2e.mjs [templateId]
 */
import { visibleText } from "./lib/visible-text.mjs";

const BASE = process.env.MAXREACH_BASE ?? "http://127.0.0.1:3001";
const templateId = process.argv[2] ?? "intro-plain";

const brief = {
  company: "Meridian Agri Sciences",
  website: "meridianagri.example",
  contactName: "Karan Shah",
  jobTitle: "National Sales Manager",
  industry: "Agrochemicals",
  notes:
    "Field officers cover dealers across four states. Dealer visit reports are submitted on paper at the end of each week, so channel stock positions are estimated rather than known. Planning for the kharif season starts next month.",
  product: "auto",
  objective: "book-demo",
  tone: "consultative",
  length: "short",
  templateId,
};

const { status } = await (await fetch(`${BASE}/api/ollama/status`)).json();
console.log(`ollama         ${status.connected ? "connected" : "NOT CONNECTED"} · ${status.activeModel}`);
if (!status.connected) {
  throw new Error(status.message ?? "Ollama is not reachable. Start it, then re-run.");
}

const started = Date.now();
const res = await fetch(`${BASE}/api/generate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(brief),
});
const payload = await res.json();
console.log(`generate       ${res.status} in ${((Date.now() - started) / 1000).toFixed(1)}s`);

if (!res.ok) {
  throw new Error(JSON.stringify(payload, null, 2));
}
const result = payload.result ?? payload;

console.log(`product        ${result.productName} (auto=${result.autoDetected})`);
console.log(`confidence     ${result.confidence.score} ${result.confidence.band}`);
console.log(`template       ${result.templateId}`);
console.log(`\n--- SUBJECTS ---`);
for (const s of result.subjects) console.log(` · ${s}`);
console.log(`\n--- EMAIL ---\n${result.email}`);
console.log(`\n--- CTA ---\n${result.cta}`);
if (result.reviewFlags.length) {
  console.log(`\n--- FLAGS ---`);
  for (const f of result.reviewFlags) console.log(` ! ${f}`);
}

const render = await fetch(`${BASE}/api/render`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    templateId,
    subject: result.recommendedSubject,
    email: result.email,
    cta: result.cta,
    company: brief.company,
    contactName: brief.contactName,
    productName: result.productName,
    productId: result.productId,
  }),
});
const rendered = await render.json();
console.log(
  `\nrender         ${render.status} html=${rendered.html?.length} warnings=${rendered.warnings?.length ?? 0}`,
);

// The whole point of the block model: presentation slots are filled from the
// draft and the catalogue, and nothing is duplicated or dropped.
const text = visibleText(rendered.html);

const checks = [
  ["headline present", text.includes(result.recommendedSubject.slice(0, 25))],
  ["cta present", result.cta.length === 0 || text.includes(result.cta.slice(0, 25))],
  [
    "cta not duplicated",
    result.cta.length === 0 ||
      text.split(result.cta.slice(0, 30)).length - 1 <= 1,
  ],
  ["grounded list filled", /What it handles|What changes|What you would see|Inside /.test(text)],
  ["signature present", /Maxpro/i.test(text)],
  ["no unresolved template literal", !/\$\{/.test(rendered.html)],
];

console.log();
let failed = 0;
for (const [label, ok] of checks) {
  if (!ok) failed += 1;
  console.log(` ${ok ? "PASS" : "FAIL"}  ${label}`);
}
// Set rather than call exit(): Node on Windows aborts noisily when exit() runs
// with sockets still open.
process.exitCode = failed === 0 ? 0 : 1;
