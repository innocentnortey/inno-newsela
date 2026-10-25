import { issue_handlers } from "@/server/routes/issue-routes-default";
import { to_http_request, to_response } from "@/server/routes/issue-routes";

export async function GET(request: Request, ctx: { params: Promise<{ lessonId: string }> }): Promise<Response> {
  return to_response(await issue_handlers.get_issues(await to_http_request(request, await ctx.params)));
}
