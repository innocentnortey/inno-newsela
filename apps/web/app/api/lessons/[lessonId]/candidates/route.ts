import { to_http_request, to_response } from "@/server/http/next-adapter";
import { with_optional_body } from "@/server/routes/candidate-routes";
import { candidate_handlers } from "@/server/routes/candidate-default";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ lessonId: string }> },
): Promise<Response> {
  const raw = request.clone();
  const http = await to_http_request(request, await ctx.params);
  return to_response(
    await candidate_handlers.regenerate_lesson(
      await with_optional_body(raw, http),
    ),
  );
}
