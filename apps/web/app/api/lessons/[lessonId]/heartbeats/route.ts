// NL-48: POST /api/lessons/{lessonId}/heartbeats (CON-20 sendHeartbeat)
import { to_http_request, to_response } from "@/server/http/next-adapter";
import { heartbeat_handlers } from "@/server/routes/heartbeat-default";

export async function POST(request: Request, ctx: { params: Promise<{ lessonId: string }> }): Promise<Response> {
  return to_response(await heartbeat_handlers.send_heartbeat(await to_http_request(request, await ctx.params)));
}
