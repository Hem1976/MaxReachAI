import { jsonError, jsonOk } from "@/lib/api";
import { emailThemes } from "@/lib/templates/themes";

export const runtime = "nodejs";

/** Read-only view of the email themes. The UI imports them directly; this
 *  exists for tooling and for anything that needs the list over HTTP. */
export async function GET() {
  try {
    return jsonOk({ themes: emailThemes });
  } catch (error) {
    return jsonError(error);
  }
}
