import { getServices } from "@/server/container";
import { run_handlers } from "@/server/routes/run-routes-default";
import { log_summary_read } from "@/server/routes/summary-read-log";
import { to_http_request, to_response } from "@/server/services/run-start-route";

export async function GET(request: Request, ctx: { params: Promise<{ runId: string }> }): Promise<Response> {
  const t0 = performance.now();
  const req = await to_http_request(request);
  const run_id = (await ctx.params).runId;
  const res = await run_handlers.summary({ ...req, path_params: { runId: run_id } });
  log_summary_read(() => getServices().logger, run_id, res.status, performance.now() - t0);
  return to_response(res);
}
