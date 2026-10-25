// NL-91: GET getCoverageMatrix.
import { to_http_request, to_response } from "@/server/http/next-adapter.ts";
import { coverage_handlers } from "./default.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ unitId: string }> }): Promise<Response> {
  return to_response(await coverage_handlers.get_coverage(await to_http_request(request, await ctx.params)));
}
