import { lesson_read_handlers } from "@/server/routes/lesson-read-default";
import { to_http_request, to_response } from "@/server/routes/lesson-read-routes";

export async function GET(request: Request, ctx: { params: Promise<{ lessonId: string }> }): Promise<Response> {
  return to_response(await lesson_read_handlers.get_lesson(to_http_request(request, await ctx.params)));
}
