/**
 * Prints the visible text of a rendered template, so block placement can be
 * checked without opening a browser: greeting present once, sign-off not
 * duplicated, grounded lists filled, CTA not repeated.
 *
 *   node scripts/preview-text.mjs product-showcase case-study-brief
 */
import { visibleText } from "./lib/visible-text.mjs";

const BASE = process.env.MAXREACH_BASE ?? "http://127.0.0.1:3001";
const ids = process.argv.slice(2);

for (const id of ids) {
  const res = await fetch(`${BASE}/api/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templateId: id, sample: true }),
  });
  const { html } = await res.json();
  console.log(`\n=============== ${id} ===============`);
  console.log(visibleText(html));
}
