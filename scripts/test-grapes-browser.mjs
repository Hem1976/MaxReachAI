/**
 * Browser test: verify GrapesJS loads MaxReach template HTML into the canvas.
 *
 *   node scripts/test-grapes-browser.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.MAXREACH_BASE ?? "http://127.0.0.1:3000";

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

await page.setContent(
  `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="https://unpkg.com/grapesjs@0.23.6/dist/css/grapes.min.css">
  <style>#gjs { height: 900px; }</style>
</head>
<body>
  <div id="gjs"></div>
  <script src="https://unpkg.com/grapesjs@0.23.6"></script>
  <script src="https://unpkg.com/grapesjs-preset-newsletter@1.0.2"></script>
</body>
</html>`,
  { waitUntil: "networkidle" },
);

const result = await page.evaluate((templateHtml) => {
  const editor = grapesjs.init({
    container: "#gjs",
    height: "900px",
    storageManager: false,
    plugins: ["grapesjs-preset-newsletter"],
    pluginsOpts: {
      "grapesjs-preset-newsletter": { showBlocksOnLoad: false },
    },
  });

  return new Promise((resolve) => {
    editor.onReady(() => {
      editor.setComponents(templateHtml, { asDocument: true });
      editor.refresh();
      let count = editor.getWrapper()?.components()?.length ?? 0;
      if (count === 0) {
        const bodyOnly = templateHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]?.trim();
        if (bodyOnly) {
          editor.setComponents(bodyOnly);
          editor.refresh();
          count = editor.getWrapper()?.components()?.length ?? 0;
        }
      }
      const canvasText =
        editor.Canvas.getFrameEl()?.contentDocument?.body?.innerText?.trim() ?? "";
      resolve({
        count,
        canvasLength: canvasText.length,
        hasMaxpro: /Maxpro/i.test(canvasText),
      });
    });
  });
}, renderPayload.html);

await browser.close();

console.log("grapes browser test:", result);
if (!result.count || result.canvasLength < 40) {
  throw new Error("GrapesJS did not load template components into the canvas.");
}
console.log("grapes browser test passed");
