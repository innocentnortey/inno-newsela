import { run_handlers } from "@/server/routes/run-routes-default";
import { to_http_request, to_response } from "@/server/services/run-start-route";

export async function GET(request: Request, ctx: { params: Promise<{ runId: string }> }): Promise<Response> {
  const req = await to_http_request(request);
  return to_response(await run_handlers.plan({ ...req, path_params: { runId: (await ctx.params).runId } }));
}
