import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGE", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CON", m.text());
});

await fetch("http://localhost:3000/api/campaigns/5409e690-1602-4815-a52b-993be6d21407", {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ templateId: "intro-plain", htmlDraft: "" }),
});

await page.goto("http://localhost:3000/campaigns/5409e690-1602-4815-a52b-993be6d21407", {
  waitUntil: "networkidle",
});
await page.waitForTimeout(12000);

const text = await page.locator("body").innerText();
console.log("has design", text.includes("Design the email"));
console.log("has loading", text.includes("Loading editor"));
console.log("has error snippet", text.match(/could not|empty|failed/i)?.[0] ?? "none");
console.log("gjs", await page.locator(".gjs-editor").count());
console.log("grapes box", await page.locator(".maxreach-grapes-editor").count());
console.log("iframe", await page.locator(".maxreach-grapes-editor iframe").count());

await browser.close();
