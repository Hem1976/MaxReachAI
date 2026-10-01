/**
 * Renders every template in every theme — 19 x 12 — and fails on MJML
 * warnings, unresolved markup, or text that would be invisible because its
 * colour matches the background behind it.
 *
 *   node scripts/check-themes.mjs
 */
const BASE = process.env.MAXREACH_BASE ?? "http://127.0.0.1:3001";

const { templates } = await (await fetch(`${BASE}/api/templates`)).json();
const { themes } = await (await fetch(`${BASE}/api/themes`)).json();

/**
 * MJML emits a background on a container and `color:Y` on the text inside it,
 * so pairing each colour with the most recent background catches what a theme
 * swap gets wrong: text left the same shade as the surface behind it.
 *
 * Backgrounds arrive as both `background:` and `background-color:` — buttons
 * only ever set the shorthand, so both spellings have to count or every white
 * button label reads as white-on-white.
 */
function invisibleText(html) {
  const hits = [];
  const pattern =
    /background(?:-color)?:\s*(#[0-9a-f]{3,8})|(?<![-\w])color:\s*(#[0-9a-f]{3,8})/gi;
  let background = "#ffffff";

  for (const match of html.matchAll(pattern)) {
    if (match[1]) {
      background = match[1].toLowerCase();
      continue;
    }
    const colour = match[2].toLowerCase();
    if (colour === background && !isDeliberatelyHidden(html, match.index)) {
      hits.push(`${colour} on ${background}`);
    }
  }
  return [...new Set(hits)];
}

/**
 * `mj-preview` renders the preheader as a hidden div with a hardcoded white
 * `color`, which legitimately matches a white canvas. Anything explicitly
 * hidden is not a contrast problem.
 */
function isDeliberatelyHidden(html, index) {
  const open = html.lastIndexOf('style="', index);
  if (open === -1) return false;
  const close = html.indexOf('"', open + 7);
  if (close === -1 || close < index) return false;
  const style = html.slice(open + 7, close);
  return /display:\s*none|opacity:\s*0|max-height:\s*0/.test(style);
}

let failures = 0;
const rows = [];

for (const theme of themes) {
  const problems = [];

  for (const template of templates) {
    const res = await fetch(`${BASE}/api/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: template.id,
        themeId: theme.id,
        sample: true,
      }),
    });

    if (!res.ok) {
      problems.push(`${template.id}: HTTP ${res.status}`);
      continue;
    }

    const data = await res.json();
    const html = data.html ?? "";

    if (data.themeId !== theme.id) problems.push(`${template.id}: theme not applied`);
    if (data.warnings?.length) problems.push(`${template.id}: ${data.warnings.length} mjml warning(s)`);
    if (/\$\{/.test(html)) problems.push(`${template.id}: unresolved \${}`);
    if (/undefined|\[object Object\]/.test(html)) problems.push(`${template.id}: undefined in output`);
    if (html.length < 1500) problems.push(`${template.id}: suspiciously small`);

    const invisible = invisibleText(html);
    if (invisible.length) problems.push(`${template.id}: invisible text (${invisible.join("; ")})`);
  }

  if (problems.length) failures += problems.length;
  rows.push({ theme, problems });
}

console.log(`${"THEME".padEnd(12)} ${"TEMPLATES".padStart(9)}  RESULT`);
console.log("-".repeat(62));
for (const { theme, problems } of rows) {
  console.log(
    `${theme.name.padEnd(12)} ${String(templates.length).padStart(9)}  ${
      problems.length === 0 ? "ok" : `FAIL\n    ${problems.join("\n    ")}`
    }`,
  );
}
console.log("-".repeat(62));
console.log(
  failures === 0
    ? `All ${templates.length * themes.length} template x theme combinations rendered clean.`
    : `${failures} problem(s).`,
);
process.exitCode = failures === 0 ? 0 : 1;
