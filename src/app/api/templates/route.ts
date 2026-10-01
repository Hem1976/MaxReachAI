import { jsonError, jsonOk } from "@/lib/api";
import { emailTemplates, templateCategories } from "@/lib/templates/catalog.server";

export const runtime = "nodejs";

/** Read-only view of the library. The UI imports the definitions directly; this
 *  exists for tooling and for anything that needs the list over HTTP. */
export async function GET() {
  try {
    return jsonOk({
      templates: emailTemplates.map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        style: t.style,
        skin: t.skin,
        purpose: t.purpose,
        bestFor: t.bestFor,
        objectives: t.objectives,
        industries: t.industries,
        tags: t.tags,
        source: t.source,
        library: t.library ?? "maxpro",
        codedmailsTheme: t.codedmailsTheme ?? null,
      })),
      categories: templateCategories,
    });
  } catch (error) {
    return jsonError(error);
  }
}
