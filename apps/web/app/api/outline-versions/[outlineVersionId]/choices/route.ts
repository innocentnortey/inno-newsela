// NL-77: POST /api/outline-versions/{outlineVersionId}/choices.
import { getServices } from "@/server/container.ts";
import { to_http_request, to_response } from "@/server/http/next-adapter.ts";
import { with_route } from "@/server/http/with-route.ts";
import { make_intake_handlers } from "../http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = make_intake_handlers({ with_route, outlines: () => getServices().outlines });

export async function POST(request: Request, ctx: { params: Promise<{ outlineVersionId: string }> }): Promise<Response> {
  return to_response(await handlers.record_choice(await to_http_request(request, await ctx.params)));
}
