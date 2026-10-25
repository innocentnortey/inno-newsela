// NL-13 frozen test fixtures (synthetic only). Do not edit: hashed in docs/plans/frozen-tests/NL-13.manifest.json.
import { vi } from "vitest";
import { create_logger } from "@ls/obs/logger";
import type { HttpRequest, RequestUser, SessionResolver, WithRouteDeps } from "../with-route.ts";

export const APP_ORIGIN = "https://app.example.test";
export const SETTINGS = { app_origin: APP_ORIGIN, busy_retry_after_s: 2, session_cookie_name: "ls_session" } as const;
export const COOKIE_MARKER = "ls-token-MARKER-5d2";

export class DomainRefusal extends Error {
  readonly code: string;
  readonly details: unknown;
  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "DomainRefusal";
    this.code = code;
    this.details = details;
  }
}

const user = (role: RequestUser["role"], request_id: string): RequestUser => ({
  user_id: `usr_synthetic_${role}`,
  name: `Test ${role}`,
  email: `${role}@example.test`,
  role,
  synthetic: true,
  request_id,
});

export class FakeResolver implements SessionResolver {
  calls: Array<{ token: string | null; request_id: string }> = [];
  async require(cookie_token: string | null, request_id: string): Promise<RequestUser> {
    this.calls.push({ token: cookie_token, request_id });
    if (cookie_token === "valid-token") return user("author", request_id);
    if (cookie_token === "reviewer-token") return user("reviewer", request_id);
    if (cookie_token === "marker-valid-token") return user("author", request_id);
    throw new DomainRefusal("UNAUTHENTICATED", "Sign in again.");
  }
}

export function make_log() {
  const lines: string[] = [];
  const logger = create_logger({ service: "web", build_id: "test", write: (l) => lines.push(l) });
  return { lines, logger };
}

export function make_deps(overrides: Partial<WithRouteDeps> = {}) {
  const resolver = new FakeResolver();
  const log = make_log();
  const deps: WithRouteDeps = {
    sessions: () => resolver,
    logger: log.logger,
    settings: SETTINGS,
    ...overrides,
  };
  return { deps, resolver, lines: log.lines };
}

export function make_request(over: Partial<HttpRequest> & { token?: string | null; origin?: string | null } = {}): HttpRequest {
  const { token = "valid-token", origin = APP_ORIGIN, ...rest } = over;
  const headers: Record<string, string> = { ...(rest.headers ?? {}) };
  if (origin !== null && headers["origin"] === undefined) headers["origin"] = origin;
  return {
    method: "POST",
    path_params: {},
    query: {},
    body: { email: "author@example.test", password: "correct horse" },
    cookies: token === null ? {} : { ls_session: token },
    ...rest,
    headers,
  };
}

export const ok_handler = () => vi.fn(async () => ({ ok: true }) as { ok: boolean });
