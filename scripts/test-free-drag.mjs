import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.MAXREACH_BASE ?? "http://localhost:4002";
const campaignId = "5409e690-1602-4815-a52b-993be6d21407";

await fetch(`${BASE}/api/campaigns/${campaignId}`, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ templateId: "intro-plain", htmlDraft: "" }),
});

const pngPath = join(tmpdir(), "mx-drag-test.png");
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
await page.waitForTimeout(1500);

const fileChooserPromise = page.waitForEvent("filechooser");
await page.locator(".gjs-block").filter({ hasText: "Add image" }).click();
await (await fileChooserPromise).setFiles(pngPath);
await page.waitForTimeout(2000);

const frame = page.frameLocator(".maxreach-grapes-editor iframe").first();
const img = frame.locator("img[data-mx-free]").first();

const readPos = async () =>
  img.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      left: parseFloat(cs.left) || 0,
      top: parseFloat(cs.top) || 0,
    };
  });

const before = await readPos();

await frame.locator("body").evaluate(() => {
  const img = document.querySelector("img[data-mx-free]");
  if (!img) throw new Error("Free image missing");
  const rect = img.getBoundingClientRect();
  img.dispatchEvent(
    new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + 10,
      clientY: rect.top + 10,
      button: 0,
    }),
  );
  document.dispatchEvent(
    new MouseEvent("mousemove", {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + 100,
      clientY: rect.top + 80,
      button: 0,
    }),
  );
  document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
});
await page.waitForTimeout(500);

const after = await readPos();

await browser.close();

console.log({ before, after });
const moved =
  Math.abs(after.left - before.left) > 5 || Math.abs(after.top - before.top) > 5;
if (!moved) {
  throw new Error("Free image did not move after drag.");
}
console.log("free drag test passed");
