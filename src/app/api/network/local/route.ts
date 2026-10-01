import { jsonError, jsonOk } from "@/lib/api";
import { getLocalNetworkInfo } from "@/lib/network/local";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const hostHeader = request.headers.get("host");
    return jsonOk({ network: getLocalNetworkInfo(hostHeader) });
  } catch (error) {
    return jsonError(error);
  }
}
