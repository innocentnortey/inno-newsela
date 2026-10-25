// CON-11 getLesson and CON-19 getLessonHistory handlers; testable without Next.
import { z } from "zod";
import { DomainRefusal } from "@ls/core/errors";
import type { Logger } from "@ls/obs/logger";
import { parse_lesson_ref } from "@ls/schema/lesson-ref";
import type { LessonReadApi } from "../services/lesson-read-service.ts";
import type {
  HttpRequest,
  HttpResponse,
  JsonValue,
  make_with_route,
  ProtectedRouteSpec,
  RouteHandler,
} from "../http/with-route.ts";

export interface LessonReadRouteDeps {
  with_route: ReturnType<typeof make_with_route>;
  reads: () => LessonReadApi;
  logger: Logger;
  now_ms?: () => number;
}

const LessonPathParams = z.object({
  lessonId: z.string().refine((s) => parse_lesson_ref(s) !== null),
});

function spec(operation_id: string): ProtectedRouteSpec {
  return {
    operation_id,
    roles: null,
    request_schema: null,
    success_status: 200,
    params_schema: LessonPathParams,
  };
}

function lesson_id_of(req: HttpRequest) {
  const id = parse_lesson_ref(req.path_params["lessonId"] ?? "");
  if (id === null) {
    throw new DomainRefusal("INVALID_REQUEST", "The request is not valid.", { fields: ["path.lessonId"] });
  }
  return id;
}

export function make_lesson_read_handlers(d: LessonReadRouteDeps): {
  get_lesson: RouteHandler;
  get_history: RouteHandler;
} {
  const now = d.now_ms ?? (() => performance.now());
  const get_lesson = d.with_route(async (user, req) => {
    const id = lesson_id_of(req);
    const t0 = now();
    const r = await d.reads().get_lesson_traced(user, id);
    d.logger.info("lesson.open", {
      request_id: user.request_id,
      lesson_id: id,
      duration_ms: Math.round(now() - t0),
      extra: { version_id: r.version_id },
    });
    return r.lesson as unknown as JsonValue;
  }, spec("getLesson"));
  const get_history = d.with_route(async (user, req) => {
    return (await d.reads().history(user, lesson_id_of(req))) as unknown as JsonValue;
  }, spec("getLessonHistory"));
  return { get_lesson, get_history };
}

function safe_decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Local Next Request to HttpRequest bridge (plan R9). */
export function to_http_request(req: Request, params: { lessonId: string }): HttpRequest {
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
  return {
    method: req.method,
    path_params: { lessonId: safe_decode(params.lessonId) },
    query,
    headers,
    body: null,
    cookies,
  };
}

export function to_response(res: HttpResponse): Response {
  return new Response(JSON.stringify(res.body), { status: res.status, headers: res.headers });
}
