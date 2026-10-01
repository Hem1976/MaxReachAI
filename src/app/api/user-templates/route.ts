import { jsonError, jsonOk } from "@/lib/api";
import {
  listUserTemplateFiles,
  readUserTemplateHtml,
  userTemplateFileForId,
} from "@/lib/templates/user-templates";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get("templateId")?.trim();
    const file = searchParams.get("file")?.trim();

    if (templateId) {
      const resolved = userTemplateFileForId(templateId);
      if (!resolved) {
        return Response.json({ error: "Template not found." }, { status: 404 });
      }
      return jsonOk({
        templateId,
        file: resolved,
        html: readUserTemplateHtml(resolved),
      });
    }

    if (file) {
      return jsonOk({
        file,
        html: readUserTemplateHtml(file),
      });
    }

    return jsonOk({
      templates: listUserTemplateFiles().map((name) => ({
        file: name,
        name: name.replace(/\.html$/i, "").replace(/[_-]+/g, " ").trim(),
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
