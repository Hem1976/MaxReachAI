/**
 * Test free image add + upload in campaign editor.
 *
 *   node scripts/test-free-image.mjs
 */
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.MAXREACH_BASE ?? "http://localhost:3000";
const campaignId = process.argv[2] ?? "5409e690-1602-4815-a52b-993be6d21407";

await fetch(`${BASE}/api/campaigns/${campaignId}`, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ templateId: "intro-plain", htmlDraft: "" }),
});

const pngPath = join(tmpdir(), "mx-test.png");
writeFileSync(
  pngPath,
  Buffer.from([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0,
    1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 10, 73, 68, 65, 84, 120, 156, 99, 0, 1, 0,
    0, 5, 0, 1, 13, 10, 45, 167, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
  ]),
);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto(`${BASE}/campaigns/${campaignId}`, { waitUntil: "networkidle" });
await page.getByText("Loading editor").waitFor({ state: "hidden", timeout: 45000 });
await page.locator(".gjs-editor").waitFor({ timeout: 15000 });
await page.locator(".maxreach-grapes-editor iframe").first().waitFor({ timeout: 15000 });
await page.waitForTimeout(1500);

const frame = page.frameLocator(".maxreach-grapes-editor iframe").first();
const freeBefore = await frame.locator('[data-mx-free="1"]').count();

const fileChooserPromise = page.waitForEvent("filechooser", { timeout: 10000 });
await page.locator(".gjs-block").filter({ hasText: "Add image" }).click();
const fileChooser = await fileChooserPromise;
await fileChooser.setFiles(pngPath);
await page.waitForTimeout(2500);

const freeAfter = await frame.locator('[data-mx-free="1"]').count();
const src = await frame.locator('[data-mx-free="1"]').last().getAttribute("src");

await browser.close();

console.log({ freeBefore, freeAfter, src });
if (freeAfter <= freeBefore || !src?.includes("/email-assets/uploads/")) {
  throw new Error("Free image was not added to the canvas.");
}
console.log("free image test passed");
