// NL-48: POST /api/lessons/{lessonId}/heartbeats (CON-20 sendHeartbeat)
import type { JsonValue } from "@/server/http/with-route";
import { heartbeat_handlers } from "@/server/routes/heartbeat-default";
import { to_http_request, to_response } from "@/server/routes/heartbeat-routes";

export async function POST(request: Request, ctx: { params: Promise<{ lessonId: string }> }): Promise<Response> {
  let body: JsonValue | null = null;
  try {
    body = (await request.json()) as JsonValue;
  } catch {
    body = null;
  }
  return to_response(await heartbeat_handlers.send_heartbeat(to_http_request(request, await ctx.params, body)));
}
