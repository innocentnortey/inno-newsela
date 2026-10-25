// NL-27: route logic for POST /api/runs plus a Next-to-HttpRequest adapter. Next route files may export only
// HTTP handlers, so the testable parts live here. The adapter duplicates what NL-25 needs; hoist it when it settles.
import { DomainRefusal } from "@ls/core/errors";
import type { RequestUser } from "@ls/core/ports/common";
import type { Run, StartRunRequest } from "@ls/schema/api/runs";
import type { HttpRequest, HttpResponse, JsonValue, make_with_route, RouteHandler } from "../http/with-route.ts";

export interface RunStarter {
  start(user: RequestUser, req: StartRunRequest, idempotency_key: string | null): Promise<Run>;
}

export function make_start_run_handler(with_route: ReturnType<typeof make_with_route>, runs: () => RunStarter): RouteHandler {
  return with_route(
    async (user, request) => {
      const key = request.headers["idempotency-key"];
      if (key !== undefined && key.length > 128) {
        throw new DomainRefusal("INVALID_REQUEST", "The request is not valid.", { fields: ["header.Idempotency-Key"] });
      }
      const run = await runs().start(user, request.body as unknown as StartRunRequest, key?.trim() || null);
      return run as unknown as JsonValue;
    },
    { operation_id: "startRun", roles: ["author"], request_schema: "StartRunRequest", success_status: 201 },
  );
}

function parse_cookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export async function to_http_request(req: Request): Promise<HttpRequest> {
  const headers: Record<string, string | undefined> = {};
  req.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
  const query: Record<string, string | string[]> = {};
  new URL(req.url).searchParams.forEach((v, k) => {
    const prev = query[k];
    query[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
  });
  let body: JsonValue | null = null;
  try {
    body = (await req.json()) as JsonValue;
  } catch {
    body = null;
  }
  return { method: req.method, path_params: {}, query, headers, body, cookies: parse_cookies(req.headers.get("cookie")) };
}

export function to_response(res: HttpResponse): Response {
  return new Response(res.body === null ? null : JSON.stringify(res.body), {
    status: res.status,
    headers: { "content-type": "application/json", ...res.headers },
  });
}

export function make_post(handler: RouteHandler): (req: Request) => Promise<Response> {
  return async (req) => to_response(await handler(await to_http_request(req)));
}
