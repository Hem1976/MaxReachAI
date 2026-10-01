import { generateOutreach } from "@/lib/ai/generate";
import { LeadBriefSchema } from "@/lib/ai/schemas";
import { jsonError, jsonOk } from "@/lib/api";
import { readSettings } from "@/lib/db/settings";
import { saveHistory } from "@/lib/db/history";

export const runtime = "nodejs";
// Generation can take a while on a local model; never let this be cached.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const brief = LeadBriefSchema.parse(await request.json());
    const settings = readSettings();

    const { result, warnings } = await generateOutreach({ brief, settings });

    // Every generation is kept, so History is a complete record of what the
    // team has sent out rather than an opt-in log.
    const record = saveHistory({
      brief,
      result: {
        productId: result.productId,
        productName: result.productName,
        painPoint: result.painPoint,
        angle: result.angle,
        subjects: result.subjects,
        recommendedSubject: result.recommendedSubject,
        email: result.email,
        cta: result.cta,
        followUp: result.followUp,
        confidenceScore: result.confidence.score,
        reviewFlags: result.reviewFlags,
        model: result.model,
      },
    });

    return jsonOk({ result, warnings, historyId: record.id });
  } catch (error) {
    return jsonError(error);
  }
}
