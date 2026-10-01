import { mkdirSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";

import { jsonError, jsonOk } from "@/lib/api";

export const runtime = "nodejs";

const ALLOWED = new Map([
  ["image/jpeg", ".jpg"],
  ["image/jpg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
]);

function readUploadFile(form: FormData): File | null {
  const direct = form.get("file");
  if (direct instanceof File && direct.size > 0) return direct;

  for (const key of ["file[]", "files", "files[]"]) {
    for (const entry of form.getAll(key)) {
      if (entry instanceof File && entry.size > 0) return entry;
    }
  }

  for (const entry of form.values()) {
    if (entry instanceof File && entry.size > 0) return entry;
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = readUploadFile(form);
    if (!file) {
      return Response.json({ error: "Choose an image to upload." }, { status: 400 });
    }
    if (file.size > 6 * 1024 * 1024) {
      return Response.json({ error: "Image must be under 6MB." }, { status: 400 });
    }
    const ext = ALLOWED.get(file.type) ?? (extname(file.name).toLowerCase() || "");
    if (![".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) {
      return Response.json({ error: "Use a JPG, PNG, WEBP or GIF image." }, { status: 400 });
    }
    const id = randomUUID();
    const filename = `${id}${ext === ".jpeg" ? ".jpg" : ext}`;
    const dir = join(process.cwd(), "public", "email-assets", "uploads");
    mkdirSync(dir, { recursive: true });
    const bytes = Buffer.from(await file.arrayBuffer());
    writeFileSync(join(dir, filename), bytes);
    const url = `/email-assets/uploads/${filename}`;
    const format = new URL(request.url).searchParams.get("format");
    if (format === "grapes") {
      return jsonOk({ data: [{ src: url, type: "image" }] });
    }
    return jsonOk({ url });
  } catch (error) {
    return jsonError(error);
  }
}
