import "server-only";

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import type { Objective } from "@/lib/types";
import type { EmailTemplate, TemplateCategory } from "@/lib/templates/types";

const USER_TEMPLATE_DIR = join(process.cwd(), "public", "Email Templates");

const SKIP_FILES = new Set(["index.html"]);

function shouldIncludeFile(name: string): boolean {
  if (!name.toLowerCase().endsWith(".html")) return false;
  if (SKIP_FILES.has(name)) return false;
  if (/^preview/i.test(name)) return false;
  return true;
}

function slugify(name: string): string {
  return name
    .replace(/\.html$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function displayName(filename: string): string {
  const withoutExt = filename.replace(/\.html$/i, "");
  const parts = withoutExt.split(/[\\/]/);
  const leaf = parts[parts.length - 1] ?? withoutExt;
  const folder = parts.length > 1 ? parts[parts.length - 2] : "";
  const label = leaf.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (folder && folder.toLowerCase() !== label.toLowerCase()) {
    return `${folder.replace(/[_-]+/g, " ").trim()} · ${label}`;
  }
  return label;
}

function inferCategory(filename: string): TemplateCategory {
  const lower = filename.toLowerCase();
  if (lower.includes("problem") || lower.includes("prob") || lower.includes("soln")) {
    return "Problem to solution";
  }
  if (lower.includes("story") || lower.includes("editorial")) {
    return "Introduction";
  }
  return "My templates";
}

function walkTemplateFiles(dir: string, prefix = ""): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      found.push(...walkTemplateFiles(join(dir, entry.name), relative));
      continue;
    }
    if (shouldIncludeFile(entry.name)) found.push(relative);
  }
  return found;
}

export function listUserTemplateFiles(): string[] {
  return walkTemplateFiles(USER_TEMPLATE_DIR).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

export function isUserTemplateId(id: string): boolean {
  return id.startsWith("user-") || id === "custom-html";
}

export function userTemplateFileForId(id: string): string | null {
  if (id === "custom-html") return null;
  if (!id.startsWith("user-")) return null;
  const slug = id.slice("user-".length);
  return listUserTemplateFiles().find((file) => slugify(file) === slug) ?? null;
}

export function readUserTemplateHtml(filename: string): string {
  const normalized = filename.replace(/\\/g, "/").replace(/^\/+/, "");
  const safeName = basename(normalized);
  if (!shouldIncludeFile(safeName) || normalized.includes("..")) {
    throw new Error("Template file is not available.");
  }
  const fullPath = join(USER_TEMPLATE_DIR, normalized);
  if (!fullPath.startsWith(USER_TEMPLATE_DIR) || !existsSync(fullPath)) {
    throw new Error("Template file was not found.");
  }
  let html = readFileSync(fullPath, "utf8");
  const baseDir = normalized.includes("/")
    ? `/Email Templates/${normalized.slice(0, normalized.lastIndexOf("/"))}`
    : "/Email Templates";
  html = html.replace(
    /\b(src|href)="(?!https?:|mailto:|tel:|#|\/)([^"]+)"/gi,
    (match, attr: string, path: string) => `${attr}="${baseDir}/${path}"`,
  );
  return html;
}

const CUSTOM_HTML_TEMPLATE: EmailTemplate = {
  id: "custom-html",
  name: "Paste my own HTML",
  category: "My templates",
  style: "plain-text",
  purpose: "Paste or upload HTML you designed elsewhere. No visual editor required.",
  bestFor: "Emails you already built in Canva, Mailchimp, or another tool",
  skin: "html",
  structure: `STRUCTURE — Custom HTML
The HTML is provided by the user. Write subject and optional notes only.
Personalization tokens: {{first_name}}, {{company}}, {{sender_name}}, etc.`,
  objectives: ["start-conversation", "follow-up"],
  industries: [],
  tags: ["custom", "import", "html"],
  source: null,
  sample: {
    subject: "Quick note for your team",
    body: "",
    cta: "",
    ctaLabel: "",
  },
};

export function buildUserEmailTemplates(): EmailTemplate[] {
  const files = listUserTemplateFiles();
  const fromFiles = files.map((file) => {
    const id = `user-${slugify(file)}`;
    return {
      id,
      name: displayName(file),
      category: inferCategory(file),
      style: "branded" as const,
      purpose: `Your ready-made design: ${displayName(file)}`,
      bestFor: "Campaigns where you want this exact layout without rebuilding it",
      skin: "html" as const,
      publicHtmlFile: file,
      structure: `STRUCTURE — Imported design (${displayName(file)})
The layout is fixed in your HTML file. Personalize with {{first_name}}, {{company}}, {{sender_name}}, and other campaign variables.`,
      objectives: ["start-conversation", "follow-up", "book-demo"] as Objective[],
      industries: [] as string[],
      tags: ["imported", "my-template", "html"],
      source: null,
      sample: {
        subject: "Quick note for your team",
        body: "",
        cta: "",
        ctaLabel: "",
      },
    } satisfies EmailTemplate;
  });

  return [CUSTOM_HTML_TEMPLATE, ...fromFiles];
}
