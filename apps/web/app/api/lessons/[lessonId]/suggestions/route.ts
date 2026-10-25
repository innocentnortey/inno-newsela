import { getServices } from "../../../../../src/server/container.ts";
import { with_route } from "../../../../../src/server/http/with-route.ts";
import type { SuggestionApi } from "../../../../../src/server/services/suggestion-service.ts";
import { make_suggestion_handlers, to_http_request, to_response } from "./http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cast: wiring/assist.ts types the slot as undefined until NL-116 fills it.
const handlers = make_suggestion_handlers({
  with_route,
  suggestions: () => getServices().suggestions as unknown as SuggestionApi,
});

type Ctx = { params: Promise<{ lessonId: string }> };

export async function GET(request: Request, ctx: Ctx): Promise<Response> {
  return to_response(await handlers.list(await to_http_request(request, await ctx.params)));
}

export async function POST(request: Request, ctx: Ctx): Promise<Response> {
  return to_response(await handlers.request(await to_http_request(request, await ctx.params)));
}
