import { to_http_request, to_response } from "@/server/http/next-adapter";
import { candidate_handlers } from "@/server/routes/candidate-default";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ lessonId: string; candidateId: string }> },
): Promise<Response> {
  return to_response(
    await candidate_handlers.adopt_candidate(
      await to_http_request(request, await ctx.params),
    ),
  );
}
