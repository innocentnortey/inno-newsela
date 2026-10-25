// NL-48: sendHeartbeat (CON-20). Answers 204 with an empty body: no minutes, no names.
import { z } from "zod";
import type { LessonId } from "@ls/core/ports/common";
import type { Heartbeat } from "@ls/schema/api/review";
import { LessonId as LessonIdSchema } from "@ls/schema/ids";
import type { HeartbeatService } from "../services/heartbeat-service.ts";
import type {
  HttpRequest,
  HttpResponse,
  JsonValue,
  make_with_route,
  ProtectedRouteSpec,
  RouteHandler,
} from "../http/with-route.ts";

export interface HeartbeatRouteDeps {
  with_route: ReturnType<typeof make_with_route>;
  heartbeats: () => Pick<HeartbeatService, "record">;
}

const SPEC: ProtectedRouteSpec = {
  operation_id: "sendHeartbeat",
  roles: ["reviewer", "approver"],
  request_schema: "Heartbeat",
  success_status: 204,
  params_schema: z.object({ lessonId: LessonIdSchema }),
};

export function make_heartbeat_handlers(d: HeartbeatRouteDeps): { send_heartbeat: RouteHandler } {
  return {
    send_heartbeat: d.with_route(async (user, req) => {
      await d.heartbeats().record(user, req.path_params["lessonId"] as LessonId, req.body as unknown as Heartbeat);
      return null;
    }, SPEC),
  };
}

function safe_decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Local Next Request to HttpRequest bridge; the caller parses the JSON body. */
export function to_http_request(req: Request, params: { lessonId: string }, body: JsonValue | null): HttpRequest {
  const headers: Record<string, string | undefined> = {};
  req.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });
  const cookies: Record<string, string> = {};
  for (const part of (headers["cookie"] ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i <= 0) continue;
    cookies[part.slice(0, i).trim()] = safe_decode(part.slice(i + 1).trim());
  }
  const query: Record<string, string | string[]> = {};
  new URL(req.url).searchParams.forEach((v, k) => {
    const prev = query[k];
    query[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
  });
  return { method: req.method, path_params: { lessonId: safe_decode(params.lessonId) }, query, headers, body, cookies };
}

export function to_response(res: HttpResponse): Response {
  // A 204 must carry no body.
  if (res.status === 204) return new Response(null, { status: 204, headers: res.headers });
  return new Response(JSON.stringify(res.body), { status: res.status, headers: res.headers });
}
