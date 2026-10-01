/**
 * Creates placeholder email asset files under public/email-assets/.
 * Replace with real product photography before production sends.
 */
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "email-assets");

/** Minimal valid JPEG (1×1). Email clients need a real file at the mapped path. */
const PLACEHOLDER_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDA//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=",
  "base64",
);

const PRODUCT_FILES = [
  "rockey.jpg",
  "rocket-sales-pharma.jpg",
  "rocket-order-ai.jpg",
  "rockey-agro.jpg",
  "rocket-delivery.jpg",
  "rocketbot.jpg",
  "rocketbi.jpg",
  "rocketdox-ai.jpg",
  "rocketbiz.jpg",
];

const TEMPLATE_FILES = ["hero-01.jpg", "hero-02.jpg", "pattern-01.png"];

const BRAND_FILES = ["maxpro-logo.png"];

const SOURCE_LOGO = join(root, "MAXPRO-LOGO-FINAL-3.png");

function writeAsset(relativePath, data) {
  const full = join(root, relativePath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, data);
  console.log("wrote", relativePath);
}

for (const file of PRODUCT_FILES) {
  writeAsset(join("products", file), PLACEHOLDER_JPEG);
}
for (const file of TEMPLATE_FILES) {
  writeAsset(join("templates", file), PLACEHOLDER_JPEG);
}
for (const file of BRAND_FILES) {
  const target = join("brand", file);
  if (file === "maxpro-logo.png" && existsSync(SOURCE_LOGO)) {
    const full = join(root, target);
    mkdirSync(dirname(full), { recursive: true });
    copyFileSync(SOURCE_LOGO, full);
    console.log("wrote", target, "(from Maxpro logo.png)");
    continue;
  }
  writeAsset(target, PLACEHOLDER_JPEG);
}

console.log("Email asset placeholders ready. Replace with real images before production.");
