/**
 * Responsive email QA — renders every HTML template at Desktop, Tablet, and Mobile
 * widths and fails on horizontal overflow or broken mailto CTAs.
 *
 *   node scripts/test-email-responsive.mjs
 *   MAXREACH_BASE=http://localhost:4002 node scripts/test-email-responsive.mjs
 */

import { chromium } from "playwright";

const BASE = process.env.MAXREACH_BASE ?? "http://localhost:4002";

const TEMPLATE_IDS = [
  "intro-plain",
  "intro-one-image",
  "intro-two-image",
  "letter-hero",
  "problem-solution-product",
  "problem-solution-story",
  "problem-solution-two",
  "problem-solution-premium",
];

const VIEWPORTS = [
  { name: "desktop", width: 1200, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 320, height: 740 },
];

const LONG_URL =
  "https://www.maxpointprotect.com/solutions/field-sales-management-platform-with-very-long-path-segment";

async function renderTemplate(templateId) {
  const response = await fetch(`${BASE}/api/render`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      templateId,
      sample: true,
      subject: "Field coverage visibility at Northline Distribution Group",
      email: `Hi Anita,

Distribution teams often lose visibility when orders arrive through WhatsApp and email.

Visit ${LONG_URL} for context.

Would a short walkthrough help?

Best regards,
Zamba`,
      cta: "Is field visibility something your team is looking at this quarter?",
      company: "Northline Distribution",
      contactName: "Anita Rao",
      senderName: "Zamba",
      senderEmail: "sales@maxpointprotect.com",
      senderCompany: "Maxpointprotect Limited",
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? `Render failed for ${templateId}`);
  }
  return payload.html;
}

async function auditHtml(page, html, viewport, templateId) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.setContent(html, { waitUntil: "domcontentloaded" });

  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const overflowX = Math.max(
      doc.scrollWidth - doc.clientWidth,
      body.scrollWidth - body.clientWidth,
    );
    const widest = Math.max(
      ...[...document.querySelectorAll("body *")].map((el) => el.getBoundingClientRect().right),
      0,
    );
    const cta = [...document.querySelectorAll("a")].find((a) =>
      /explore|reply|see how|cta/i.test(a.textContent ?? ""),
    );
    return {
      overflowX,
      widest: Math.round(widest),
      viewport: doc.clientWidth,
      ctaHref: cta?.getAttribute("href") ?? "",
      hasResponsiveCss: Boolean(document.querySelector("style[data-mx-responsive]")),
    };
  });

  const issues = [];
  if (metrics.overflowX > 2) {
    issues.push(`horizontal overflow ${metrics.overflowX}px (content width ~${metrics.widest}px)`);
  }
  if (!metrics.hasResponsiveCss) {
    issues.push("missing shared responsive CSS");
  }
  if (viewport.name === "mobile" && metrics.ctaHref && !metrics.ctaHref.startsWith("mailto:")) {
    issues.push(`CTA href is not mailto on mobile: ${metrics.ctaHref.slice(0, 60)}`);
  }

  return { metrics, issues };
}

async function staticAudit(html, templateId) {
  const issues = [];
  if (!html.includes("data-mx-responsive")) issues.push("missing shared responsive CSS");
  if (/min-width:\s*600px/i.test(html) && !html.includes("min-width:0")) {
    issues.push("fixed min-width:600px may overflow on mobile");
  }
  if (!/href=(["'])mailto:[^"']+\1/i.test(html)) {
    issues.push("no mailto CTA href in rendered HTML");
  }
  if (!html.includes("mx-shell") && !html.includes('class="shell')) {
    issues.push("missing fluid shell class");
  }
  if (!html.includes("overflow-wrap:anywhere") && !html.includes("word-wrap:break-word")) {
    issues.push("missing word-wrap rules for long URLs");
  }
  return issues;
}

async function main() {
  console.log(`Responsive email test — ${BASE}`);
  let failures = 0;

  try {
    await fetch(`${BASE}/api/ollama/status`);
  } catch {
    console.warn("App may be offline — continuing with /api/render only.");
  }

  const rendered = new Map();
  for (const templateId of TEMPLATE_IDS) {
    rendered.set(templateId, await renderTemplate(templateId));
  }

  console.log("\nStatic HTML checks");
  for (const templateId of TEMPLATE_IDS) {
    const html = rendered.get(templateId) ?? "";
    const issues = await staticAudit(html, templateId);
    console.log(`  ${templateId.padEnd(28)} ${issues.length === 0 ? "OK" : "FAIL"}`);
    for (const issue of issues) {
      console.log(`           ↳ ${issue}`);
      failures += 1;
    }
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    console.warn("\nPlaywright browser unavailable — skipping viewport overflow checks.");
    console.warn(String(error.message ?? error));
    console.log("\n---");
    if (failures > 0) {
      console.error(`Failed checks: ${failures}`);
      process.exit(1);
    }
    console.log("Static checks passed for all templates.");
    return;
  }

  const page = await browser.newPage();

  for (const templateId of TEMPLATE_IDS) {
    console.log(`\n${templateId}`);
    const html = rendered.get(templateId) ?? "";

    for (const viewport of VIEWPORTS) {
      const { metrics, issues } = await auditHtml(page, html, viewport, templateId);
      const status = issues.length === 0 ? "OK" : "FAIL";
      console.log(
        `  ${viewport.name.padEnd(7)} ${status} · overflow=${metrics.overflowX}px · cta=${metrics.ctaHref.startsWith("mailto:") ? "mailto" : "other"}`,
      );
      for (const issue of issues) {
        console.log(`           ↳ ${issue}`);
        failures += 1;
      }
    }
  }

  await browser.close();

  console.log("\n---");
  if (failures > 0) {
    console.error(`Failed checks: ${failures}`);
    process.exit(1);
  }
  console.log("All templates passed desktop, tablet, and mobile layout checks.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
