import { jsonError, jsonOk } from "@/lib/api";
import {
  addCampaignAttachments,
  listCampaignAttachments,
  MAX_CAMPAIGN_ATTACHMENTS,
} from "@/lib/campaigns/attachments";
import { getCampaign } from "@/lib/campaigns/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

function readUploadFiles(form: FormData): File[] {
  const files: File[] = [];
  const seen = new Set<string>();

  for (const key of ["files", "files[]", "file", "file[]"]) {
    for (const entry of form.getAll(key)) {
      if (!(entry instanceof File) || entry.size <= 0) continue;
      const signature = `${entry.name}:${entry.size}:${entry.lastModified}`;
      if (seen.has(signature)) continue;
      seen.add(signature);
      files.push(entry);
    }
  }

  if (files.length) return files;

  for (const entry of form.values()) {
    if (!(entry instanceof File) || entry.size <= 0) continue;
    const signature = `${entry.name}:${entry.size}:${entry.lastModified}`;
    if (seen.has(signature)) continue;
    seen.add(signature);
    files.push(entry);
  }

  return files;
}

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (!getCampaign(id)) {
      return Response.json({ error: "Campaign not found." }, { status: 404 });
    }
    return jsonOk({ attachments: listCampaignAttachments(id) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (!getCampaign(id)) {
      return Response.json({ error: "Campaign not found." }, { status: 404 });
    }

    const form = await request.formData();
    const files = readUploadFiles(form);
    if (!files.length) {
      return Response.json({ error: "Choose one or more files to attach." }, { status: 400 });
    }

    const payloads = await Promise.all(
      files.map(async (file) => ({
        filename: file.name,
        contentType: file.type,
        bytes: Buffer.from(await file.arrayBuffer()),
      })),
    );

    const result = addCampaignAttachments(id, payloads);

    if (!result.added.length) {
      return Response.json(
        {
          error: result.errors[0]?.error ?? "Could not attach these files.",
          errors: result.errors,
          attachments: result.attachments,
        },
        { status: 400 },
      );
    }

    return jsonOk({
      added: result.added,
      errors: result.errors,
      attachments: result.attachments,
      limit: MAX_CAMPAIGN_ATTACHMENTS,
    });
  } catch (error) {
    return jsonError(error);
  }
}
