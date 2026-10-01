import { chromium } from "playwright";

const BASE = process.env.MAXREACH_BASE ?? "http://localhost:4002";
const campaignId = process.argv[2] ?? "5409e690-1602-4815-a52b-993be6d21407";

await fetch(`${BASE}/api/campaigns/${campaignId}`, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ templateId: "intro-plain", htmlDraft: "" }),
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`${BASE}/campaigns/${campaignId}`, { waitUntil: "networkidle" });
await page.getByText("Loading editor…").waitFor({ state: "hidden", timeout: 45000 });

const result = await page.evaluate(() => {
  const host = document.querySelector(".maxreach-grapes-editor");
  const editor = host && host.__gjsv?.em?.Editor ? host.__gjsv.em.Editor : window.__gjsEditor;
  if (!editor) {
    const frames = host?.querySelectorAll("iframe") ?? [];
    return { error: "no editor", frames: frames.length };
  }
  const p = editor.getWrapper()?.find("p")?.[0];
  if (!p) return { error: "no paragraph" };
  editor.select(p);
  const before = p.getStyle()["text-align"] ?? p.getEl()?.style.textAlign ?? "";
  editor.StyleManager.addStyleTargets(editor.getSelected(), editor.StyleManager.getSectors());
  const prop = editor.StyleManager.getProperties()?.find((pr) => pr.get("property") === "text-align");
  if (prop) prop.upValue("center");
  const after = p.getStyle()["text-align"] ?? p.getEl()?.style.textAlign ?? "";
  const rteActions = editor.RichTextEditor?.getActions?.()?.map((a) => a.name) ?? [];
  return {
    before,
    after,
    stylable: p.get("stylable"),
    editable: p.get("editable"),
    rteActions,
    sectors: editor.StyleManager.getSectors().length,
  };
});

console.log(result);
await browser.close();

if (result.error) throw new Error(result.error);
if (result.after !== "center" && result.after !== "center") {
  console.warn("text-align may not have applied:", result);
}
