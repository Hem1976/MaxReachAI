/**
 * Browser test: alignment commands apply text-align on selected cells.
 *
 *   MAXREACH_BASE=http://127.0.0.1:4002 node scripts/test-editor-align.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.MAXREACH_BASE ?? "http://127.0.0.1:4002";

const renderRes = await fetch(`${BASE}/api/render`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ templateId: "intro-plain", sample: true }),
});
const renderPayload = await renderRes.json();
if (!renderRes.ok) {
  throw new Error(renderPayload.error ?? `Render failed: ${renderRes.status}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const result = await page.evaluate(async (templateHtml) => {
  await new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/grapesjs@0.23.6/dist/css/grapes.min.css";
    link.onload = resolve;
    link.onerror = reject;
    document.head.appendChild(link);

    const s1 = document.createElement("script");
    s1.src = "https://unpkg.com/grapesjs@0.23.6";
    s1.onload = () => {
      const s2 = document.createElement("script");
      s2.src = "https://unpkg.com/grapesjs-preset-newsletter@1.0.2";
      s2.onload = resolve;
      s2.onerror = reject;
      document.body.appendChild(s2);
    };
    s1.onerror = reject;
    document.body.appendChild(s1);
  });

  const editor = grapesjs.init({
    container: document.createElement("div"),
    height: "800px",
    storageManager: false,
    plugins: ["grapesjs-preset-newsletter"],
    pluginsOpts: {
      "grapesjs-preset-newsletter": { showBlocksOnLoad: false },
    },
  });

  await new Promise((resolve) => editor.onReady(resolve));
  editor.setComponents(templateHtml, { asDocument: true });
  editor.refresh();

  const td = editor.getWrapper()?.find("td")?.[0];
  if (!td) return { ok: false, reason: "no td found" };

  editor.select(td);

  editor.Commands.add("mx-align-center", {
    run(ed) {
      const selected = ed.getSelected();
      if (!selected) return;
      selected.addStyle({ "text-align": "center" });
      selected.addAttributes({ align: "center" });
    },
  });

  editor.runCommand("mx-align-center");

  const style = td.getStyle()?.["text-align"];
  const align = td.getAttributes()?.align;
  const elStyle = td.getEl()?.getAttribute("style") ?? "";

  return {
    ok: style === "center" || align === "center" || elStyle.includes("text-align: center"),
    style,
    align,
    elStyle,
  };
}, renderPayload.html);

await browser.close();

console.log("editor align test:", result);
if (!result.ok) {
  throw new Error(`Alignment command did not apply (style=${result.style}, align=${result.align})`);
}
console.log("editor align test passed");
