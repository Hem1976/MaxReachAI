import { jsonError, jsonOk } from "@/lib/api";
import { clearRecipients } from "@/lib/campaigns/recipients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const cleared = clearRecipients(id);
    return jsonOk({ cleared, total: 0 });
  } catch (error) {
    return jsonError(error);
  }
}
