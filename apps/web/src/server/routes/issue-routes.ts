// Issue routes (NL-45): handler factories for getLessonIssues, recordResolution, clearSafetyFlag, decideStandard,
// plus the Next Request <-> HttpRequest bridge. Testable without Next.
import { z } from "zod";
import type { IssueId, LessonId } from "@ls/core/ports/common";
import type { Logger } from "@ls/obs/logger";
import type { ResolutionRequest, SafetyFlagClearRequest, StandardDecisionRequest } from "@ls/schema/api/lessons";
import { IssueId as IssueIdSchema, LESSON_ID_RE } from "@ls/schema/ids";
import type { IssueApi } from "../services/issue-service.ts";
import type { HttpRequest, HttpResponse, JsonValue, make_with_route, RouteHandler } from "../http/with-route.ts";

const LessonParams = z.object({ lessonId: z.string().regex(LESSON_ID_RE) });
const IssueParams = LessonParams.extend({ issueId: IssueIdSchema });
const FlagParams = LessonParams.extend({
  flagId: z.string().regex(/^sf:G\d{1,2}\.U\d{1,2}\.(L\d{1,3}|FLEX-\d{1,2}[a-z]?):\d+$/),
});

export interface IssueHandlers {
  get_issues: RouteHandler;
  record_resolution: RouteHandler;
  clear_safety_flag: RouteHandler;
  decide_standard: RouteHandler;
}

export function make_issue_handlers(d: {
  with_route: ReturnType<typeof make_with_route>;
  issues: () => IssueApi;
  logger: Logger;
  now_ms?: () => number;
}): IssueHandlers {
  const now = d.now_ms ?? (() => performance.now());
  const json = (v: unknown): JsonValue => v as unknown as JsonValue;
  const lesson_of = (r: HttpRequest): LessonId => r.path_params["lessonId"] as LessonId;

  return {
    get_issues: d.with_route(
      async (user, request) => {
        const t0 = now();
        const lesson_id = lesson_of(request);
        const result = await d.issues().get_issues(user, lesson_id);
        d.logger.info("issues.read", {
          request_id: user.request_id,
          lesson_id,
          duration_ms: Math.round(now() - t0),
          extra: { pending: result.pending },
        });
        return json(result);
      },
      { operation_id: "getLessonIssues", roles: null, request_schema: null, success_status: 200, params_schema: LessonParams },
    ),
    record_resolution: d.with_route(
      async (user, request) =>
        json(
          await d
            .issues()
            .record_resolution(user, lesson_of(request), request.path_params["issueId"] as IssueId, request.body as unknown as ResolutionRequest),
        ),
      { operation_id: "recordResolution", roles: ["reviewer"], request_schema: "ResolutionRequest", success_status: 200, params_schema: IssueParams },
    ),
    clear_safety_flag: d.with_route(
      async (user, request) =>
        json(
          await d
            .issues()
            .clear_safety_flag(user, lesson_of(request), request.path_params["flagId"] as string, request.body as unknown as SafetyFlagClearRequest),
        ),
      {
        operation_id: "clearSafetyFlag",
        roles: ["reviewer", "approver"],
        request_schema: "SafetyFlagClearRequest",
        success_status: 200,
        params_schema: FlagParams,
      },
    ),
    decide_standard: d.with_route(
      async (user, request) =>
        json(await d.issues().decide_standard(user, lesson_of(request), request.body as unknown as StandardDecisionRequest)),
      { operation_id: "decideStandard", roles: ["reviewer"], request_schema: "StandardDecisionRequest", success_status: 200, params_schema: LessonParams },
    ),
  };
}

function safe_decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export async function to_http_request(req: Request, params: Record<string, string>): Promise<HttpRequest> {
  const headers: Record<string, string | undefined> = {};
  req.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });
  const cookies: Record<string, string> = {};
  for (const part of (headers["cookie"] ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) cookies[part.slice(0, i).trim()] = safe_decode(part.slice(i + 1).trim());
  }
  const query: Record<string, string | string[]> = {};
  new URL(req.url).searchParams.forEach((v, k) => {
    const prev = query[k];
    query[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
  });
  let body: JsonValue | null = null;
  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      body = (await req.json()) as JsonValue;
    } catch {
      body = null;
    }
  }
  const path_params: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) path_params[k] = safe_decode(v);
  return { method: req.method, path_params, query, headers, body, cookies };
}

export function to_response(res: HttpResponse): Response {
  return new Response(JSON.stringify(res.body), { status: res.status, headers: res.headers });
}
