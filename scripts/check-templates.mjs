/**
 * Renders every template through the real /api/render route and reports on the
 * output. Catches MJML warnings, empty sections and skins that silently drop a
 * block. Run against the dev server:
 *
 *   node scripts/check-templates.mjs
 */
const BASE = process.env.MAXREACH_BASE ?? "http://127.0.0.1:3000";

const list = (await (await fetch(`${BASE}/api/templates`)).json()).templates;

let failures = 0;

console.log(
  `${"TEMPLATE".padEnd(24)} ${"SKIN".padEnd(13)} ${"HTML".padStart(6)}  WARN  CHECKS`,
);
console.log("-".repeat(78));

for (const t of list) {
  const res = await fetch(`${BASE}/api/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templateId: t.id, sample: true }),
  });

  if (!res.ok) {
    console.log(`${t.id.padEnd(24)} ${String(t.skin).padEnd(13)}  HTTP ${res.status}`);
    failures += 1;
    continue;
  }

  const data = await res.json();
  const html = data.html ?? "";
  const problems = [];

  if (data.warnings?.length) problems.push(`mjml:${data.warnings.length}`);
  if (html.length < 1500) problems.push("suspiciously small");
  // A dropped block shows up as an empty cell or a stray template literal.
  if (/\$\{/.test(html)) problems.push("unresolved ${}");
  if (/undefined|\[object Object\]/.test(html)) problems.push("undefined in output");
  if (!/Rahul Mehta|Maxpro/i.test(html)) problems.push("no signature/brand");

  if (problems.length) failures += 1;

  console.log(
    `${t.id.padEnd(24)} ${String(t.skin).padEnd(13)} ${String(html.length).padStart(6)}  ${String(
      data.warnings?.length ?? 0,
    ).padStart(4)}  ${problems.length ? `FAIL ${problems.join(", ")}` : "ok"}`,
  );
}

console.log("-".repeat(78));
console.log(failures === 0 ? `All ${list.length} templates rendered clean.` : `${failures} problem(s).`);
// Set rather than call exit(): Node on Windows aborts noisily when exit() runs
// with sockets still open.
process.exitCode = failures === 0 ? 0 : 1;
