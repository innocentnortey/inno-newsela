// NL-53: POST /api/lessons/{lessonId}/transitions (CON-18 transitionLesson)
import { to_http_request, to_response } from "@/server/http/next-adapter";
import { transition_handlers } from "@/server/routes/transition-default";

export async function POST(request: Request, ctx: { params: Promise<{ lessonId: string }> }): Promise<Response> {
  return to_response(await transition_handlers.transition_lesson(await to_http_request(request, await ctx.params)));
}
