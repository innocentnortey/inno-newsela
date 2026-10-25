// NL-77: GET /api/outline-versions/{outlineVersionId}/report.
import { getServices } from "@/server/container.ts";
import { to_http_request, to_response } from "@/server/http/next-adapter.ts";
import { with_route } from "@/server/http/with-route.ts";
import { make_intake_handlers } from "../http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = make_intake_handlers({ with_route, outlines: () => getServices().outlines });

export async function GET(request: Request, ctx: { params: Promise<{ outlineVersionId: string }> }): Promise<Response> {
  return to_response(await handlers.get_report(await to_http_request(request, await ctx.params)));
}
