/**
 * Smoke test: GrapesJS packages load and render API returns HTML for the editor.
 *
 *   node scripts/test-grapes-editor.mjs
 */
import grapesjs from "grapesjs";
import newsletterPkg from "grapesjs-preset-newsletter";

const newsletter = newsletterPkg.default ?? newsletterPkg;

const BASE = process.env.MAXREACH_BASE ?? "http://127.0.0.1:3000";

if (typeof grapesjs.init !== "function") {
  throw new Error("grapesjs.init is missing");
}
if (typeof newsletter !== "function") {
  throw new Error("grapesjs-preset-newsletter plugin is missing");
}

const renderRes = await fetch(`${BASE}/api/render`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    templateId: "intro-plain",
    sample: true,
  }),
});
const renderPayload = await renderRes.json();
if (!renderRes.ok) {
  throw new Error(renderPayload.error ?? `Render failed: ${renderRes.status}`);
}
if (!renderPayload.html?.includes("<body")) {
  throw new Error("Render response did not include HTML body");
}

const uploadForm = new FormData();
uploadForm.append(
  "file",
  new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: "image/png" }),
  "test.png",
);
const uploadRes = await fetch(`${BASE}/api/uploads?format=grapes`, {
  method: "POST",
  body: uploadForm,
});
const uploadPayload = await uploadRes.json();
if (!uploadRes.ok || !uploadPayload.data?.[0]?.src) {
  throw new Error(uploadPayload.error ?? "Grapes upload response missing data[0].src");
}

console.log("grapes-editor smoke test passed");
console.log(`  render html length: ${renderPayload.html.length}`);
console.log(`  grapes upload src: ${uploadPayload.data[0].src}`);
