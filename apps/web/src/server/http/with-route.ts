import { randomBytes } from "node:crypto";
import type { RequestUser } from "@ls/core/ports/common";
import { load_web_settings, type WebSettings } from "@ls/config/settings";
import { PoolExhausted } from "@ls/db/pool-exhausted";
import type { Logger } from "@ls/obs/logger";
import * as board from "@ls/schema/api/board";
import * as collab from "@ls/schema/api/collab";
import * as common from "@ls/schema/api/common";
import * as exports_api from "@ls/schema/api/exports";
import * as lessons from "@ls/schema/api/lessons";
import * as metrics from "@ls/schema/api/metrics";
import * as outlines from "@ls/schema/api/outlines";
import * as prompts from "@ls/schema/api/prompts";
import * as review from "@ls/schema/api/review";
import * as runs from "@ls/schema/api/runs";
import * as session from "@ls/schema/api/session";
import * as transition from "@ls/schema/api/transition";
import type { Role } from "@ls/schema/api/session";
import { RequestId } from "@ls/schema/ids";
import type { z } from "zod";
import { getServices } from "../container.ts";
import {
  is_domain_refusal,
  to_error_response,
  type DomainRefusalLike,
  type ErrorResponse,
} from "./refusal.ts";

export type { RequestUser };
export type { ErrorResponse };
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export interface HttpRequest {
  method: string;
  path_params: Record<string, string>;
  query: Record<string, string | string[]>;
  headers: Record<string, string>; // keys lower-case
  body: JsonValue | null;
  cookies: Record<string, string>;
}
export interface HttpResponse {
  status: number;
  headers: Record<string, string>; // always has "X-Request-Id"
  body: JsonValue | null;
}
export interface SessionResolver {
  require(
    cookie_token: string | null,
    request_id: string,
  ): Promise<RequestUser>;
}
export type RouteHandler = (request: HttpRequest) => Promise<HttpResponse>;
export type ServiceCall = (
  user: RequestUser,
  request: HttpRequest,
) => Promise<JsonValue>;
export type PublicServiceCall = (
  user: null,
  request: HttpRequest,
) => Promise<JsonValue>;

export interface ProtectedRouteSpec {
  operation_id: string;
  roles: readonly Role[] | null;
  request_schema: string | null;
  success_status: number;
  public?: false;
  params_schema?: z.ZodType;
  query_schema?: z.ZodType;
}
export interface PublicRouteSpec {
  operation_id: string;
  roles?: null;
  request_schema: string | null;
  success_status: number;
  public: true;
  params_schema?: z.ZodType;
  query_schema?: z.ZodType;
}
export type RouteSpec = ProtectedRouteSpec | PublicRouteSpec;

export interface WithRouteDeps {
  sessions: () => SessionResolver; // lazy: called per request, only for non-public routes
  logger: Logger;
  settings: Pick<
    WebSettings,
    "app_origin" | "busy_retry_after_s" | "session_cookie_name"
  >;
  now_ms?: () => number;
  new_request_id?: () => string;
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function mint_request_id(now: number = Date.now()): string {
  let t = "";
  let n = Math.floor(now);
  for (let i = 0; i < 10; i++) {
    t = CROCKFORD.charAt(n % 32) + t;
    n = Math.floor(n / 32);
  }
  const bytes = randomBytes(10);
  let bits = 0;
  let acc = 0;
  let r = "";
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      r += CROCKFORD.charAt((acc >> (bits - 5)) & 31);
      bits -= 5;
      acc &= (1 << bits) - 1;
    }
  }
  return `req_${t}${r}`;
}

function resolve_request_id(
  headers: Record<string, string>,
  mint: () => string,
): string {
  const v = headers["x-request-id"];
  return v !== undefined && RequestId.safeParse(v).success ? v : mint();
}

const MUTATIONS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function check_origin(
  method: string,
  headers: Record<string, string>,
  app_origin: string,
): boolean {
  if (!MUTATIONS.has(method.toUpperCase())) return true;
  const origin = headers["origin"];
  if (origin === undefined) return false;
  try {
    return new URL(origin).origin === new URL(app_origin).origin;
  } catch {
    return false;
  }
}

const SCHEMAS: Record<string, z.ZodType> = {};
for (const mod of [
  board,
  collab,
  common,
  exports_api,
  lessons,
  metrics,
  outlines,
  prompts,
  review,
  runs,
  session,
  transition,
]) {
  for (const [name, value] of Object.entries(mod)) {
    if (typeof value === "object" && value !== null && "safeParse" in value)
      SCHEMAS[name] = value as z.ZodType;
  }
}

// Paths only: never an issue message or received value.
function zod_fields(error: z.ZodError, prefix: string): string[] {
  const out: string[] = [];
  for (const issue of error.issues) {
    const base = issue.path.map(String).join(".");
    if (issue.code === "unrecognized_keys") {
      for (const k of issue.keys)
        out.push(prefix + (base === "" ? k : `${base}.${k}`));
    } else if (base === "") {
      out.push(prefix === "" ? "body" : prefix.slice(0, -1));
    } else {
      out.push(prefix + base);
    }
  }
  return out;
}

class Refuse extends Error {
  constructor(
    readonly code: DomainRefusalLike["code"],
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "DomainRefusal";
  }
}

export function make_with_route(deps: WithRouteDeps) {
  const mint = deps.new_request_id ?? (() => mint_request_id());
  const now_ms = deps.now_ms ?? (() => performance.now());

  function with_route(
    handler: PublicServiceCall,
    spec: PublicRouteSpec,
  ): RouteHandler;
  function with_route(
    handler: ServiceCall,
    spec: ProtectedRouteSpec,
  ): RouteHandler;
  function with_route(
    handler: () => Promise<JsonValue>,
    spec: RouteSpec,
  ): RouteHandler;
  function with_route(
    handler: (user: never, request: HttpRequest) => Promise<JsonValue>,
    spec: RouteSpec,
  ): RouteHandler {
    if (
      spec.request_schema !== null &&
      SCHEMAS[spec.request_schema] === undefined
    ) {
      throw new Error(`unknown request_schema: ${spec.request_schema}`);
    }
    if (
      spec.public !== true &&
      (spec as ProtectedRouteSpec).roles === undefined
    ) {
      throw new Error(
        `roles required for protected route ${spec.operation_id}`,
      );
    }
    const body_schema =
      spec.request_schema === null
        ? null
        : (SCHEMAS[spec.request_schema] ?? null);
    const call = handler as unknown as (
      user: RequestUser | null,
      request: HttpRequest,
    ) => Promise<JsonValue>;

    return async (request) => {
      const request_id = resolve_request_id(request.headers, mint);
      const start = now_ms();
      let status = 500;
      let role: Role | null = null;
      const headers: Record<string, string> = { "X-Request-Id": request_id };
      let response: HttpResponse;
      const refused = (r: ErrorResponse): HttpResponse => {
        status = r.status;
        deps.logger.warn("route.refused", {
          request_id,
          extra: { operation_id: spec.operation_id, code: r.body.error.code },
        });
        return {
          status: r.status,
          headers: { ...headers, "Content-Type": "application/json" },
          body: r.body as unknown as JsonValue,
        };
      };
      try {
        if (
          !check_origin(
            request.method,
            request.headers,
            deps.settings.app_origin,
          )
        ) {
          throw new Refuse("UNAUTHENTICATED", "Sign in again.");
        }
        let user: RequestUser | null = null;
        if (spec.public !== true) {
          user = await deps
            .sessions()
            .require(
              request.cookies[deps.settings.session_cookie_name] ?? null,
              request_id,
            );
          role = user.role;
        }
        const fields: string[] = [];
        let body: JsonValue | null = request.body;
        let path_params: HttpRequest["path_params"] = request.path_params;
        let query: HttpRequest["query"] = request.query;
        if (body_schema !== null) {
          const r = body_schema.safeParse(request.body ?? undefined);
          if (r.success) body = r.data as JsonValue;
          else fields.push(...zod_fields(r.error, ""));
        }
        if (spec.params_schema !== undefined) {
          const r = spec.params_schema.safeParse(request.path_params);
          if (r.success) path_params = r.data as HttpRequest["path_params"];
          else fields.push(...zod_fields(r.error, "path."));
        }
        if (spec.query_schema !== undefined) {
          const r = spec.query_schema.safeParse(request.query);
          if (r.success) query = r.data as HttpRequest["query"];
          else fields.push(...zod_fields(r.error, "query."));
        }
        if (fields.length > 0) {
          throw new Refuse("INVALID_REQUEST", "The request is not valid.", {
            fields: [...new Set(fields)],
          });
        }
        if (
          user !== null &&
          spec.roles != null &&
          !spec.roles.includes(user.role)
        ) {
          throw new Refuse("ROLE_FORBIDDEN", "Your role cannot do this.");
        }
        const out = await call(user, { ...request, body, path_params, query });
        status = spec.success_status;
        response = {
          status,
          headers: { ...headers, "Content-Type": "application/json" },
          body: out,
        };
      } catch (e) {
        if (is_domain_refusal(e)) {
          response = refused(to_error_response(e, request_id));
        } else if (e instanceof PoolExhausted) {
          headers["Retry-After"] = String(deps.settings.busy_retry_after_s);
          response = refused(
            to_error_response(
              {
                code: "SERVICE_BUSY",
                message: "The service is busy. Try again shortly.",
              },
              request_id,
            ),
          );
        } else {
          status = 500;
          deps.logger.error("route.unhandled", {
            request_id,
            extra: {
              operation_id: spec.operation_id,
              error_class: e instanceof Error ? e.name : "NonError",
            },
          });
          response = { status, headers, body: { request_id } };
        }
      }
      deps.logger.info("route.done", {
        request_id,
        duration_ms: Math.round(now_ms() - start),
        extra: { operation_id: spec.operation_id, status, role },
      });
      return response;
    };
  }
  return with_route;
}

let cached_settings: WithRouteDeps["settings"] | undefined;
const default_with_route = make_with_route({
  sessions: () => getServices().sessions as unknown as SessionResolver,
  logger: {
    info: (e, f) => getServices().logger.info(e, f),
    warn: (e, f) => getServices().logger.warn(e, f),
    error: (e, f) => getServices().logger.error(e, f),
  },
  get settings() {
    cached_settings ??= load_web_settings(process.env);
    return cached_settings;
  },
});

export const with_route = default_with_route;
