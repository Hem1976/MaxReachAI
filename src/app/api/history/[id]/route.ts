import { z } from "zod";

import { jsonError, jsonOk } from "@/lib/api";
import { deleteHistory, getHistory, updateHistoryContent } from "@/lib/db/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

const PatchSchema = z.object({
  email: z.string().optional(),
  subjects: z.array(z.string()).optional(),
  recommendedSubject: z.string().optional(),
  followUp: z.string().optional(),
});

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const record = getHistory(id);
    if (!record) {
      return Response.json({ error: "Not found." }, { status: 404 });
    }
    return jsonOk({ record });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const patch = PatchSchema.parse(await request.json());
    const record = updateHistoryContent(id, patch);
    if (!record) {
      return Response.json({ error: "Not found." }, { status: 404 });
    }
    return jsonOk({ record });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const deleted = deleteHistory(id);
    if (!deleted) {
      return Response.json({ error: "Not found." }, { status: 404 });
    }
    return jsonOk({ deleted: true });
  } catch (error) {
    return jsonError(error);
  }
}
