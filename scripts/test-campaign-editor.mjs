/**
 * End-to-end browser test for the campaign GrapesJS editor page.
 *
 *   node scripts/test-campaign-editor.mjs [campaignId]
 */
import { chromium } from "playwright";

const BASE = process.env.MAXREACH_BASE ?? "http://localhost:3000";
const campaignId = process.argv[2] ?? "5409e690-1602-4815-a52b-993be6d21407";

await fetch(`${BASE}/api/campaigns/${campaignId}`, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ templateId: "intro-plain", htmlDraft: "" }),
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto(`${BASE}/campaigns/${campaignId}`, { waitUntil: "networkidle" });
await page.getByText("2. Design the email").waitFor({ timeout: 15000 });
await page.getByText("Loading editor…").waitFor({ state: "hidden", timeout: 45000 });

const frame = page.frameLocator(".maxreach-grapes-editor iframe").first();
const canvasText = (await frame.locator("body").innerText({ timeout: 15000 })).trim();
const toolbarButtons = await page.locator(".gjs-pn-btn").count();

await browser.close();

console.log("campaign editor canvas length:", canvasText.length);
console.log("campaign editor toolbar buttons:", toolbarButtons);
console.log("campaign editor sample:", canvasText.slice(0, 120).replace(/\s+/g, " "));
if (canvasText.length < 40) {
  throw new Error("Campaign editor canvas is empty after loading the template.");
}
if (toolbarButtons < 5) {
  throw new Error("Campaign editor toolbar did not initialize.");
}
console.log("campaign editor test passed");
