// NL-13 frozen tests, AC-1..AC-4 (risk::security). Do not edit: hashed in docs/plans/frozen-tests/NL-13.manifest.json.
// Verify: npx vitest run apps/web/src/server/http/with-route.security.test.ts
import { describe, expect, it, vi } from "vitest";
import { make_with_route, type RouteSpec } from "./with-route.ts";
import { COOKIE_MARKER, DomainRefusal, make_deps, make_request, ok_handler } from "./testing/route-fixtures.ts";

const SPEC: RouteSpec = { operation_id: "testOp", roles: ["approver"], request_schema: "SignInRequest", success_status: 200 };
const OPEN_SPEC: RouteSpec = { operation_id: "testOp", roles: null, request_schema: "SignInRequest", success_status: 200 };

describe("precedence", () => {
  // AC-1 invariant: guarantee 11 order Origin/session -> parse -> role -> service
  const bad_body = { email: "not-an-email", password: "" };
  const rows: Array<{
    name: string;
    req: Parameters<typeof make_request>[0];
    handler_throws?: DomainRefusal;
    status: number;
    code?: string;
    handler_calls: number;
  }> = [
    { name: "1 foreign origin + invalid body + wrong role + unknown token", req: { origin: "https://evil.example", token: "unknown-token", body: bad_body }, status: 401, code: "UNAUTHENTICATED", handler_calls: 0 },
    { name: "2 valid session, invalid body, wrong role", req: { body: bad_body }, status: 400, code: "INVALID_REQUEST", handler_calls: 0 },
    { name: "3 valid body, wrong role", req: {}, status: 403, code: "ROLE_FORBIDDEN", handler_calls: 0 },
    { name: "4 handler NOT_FOUND", req: {}, handler_throws: new DomainRefusal("NOT_FOUND", "No such thing."), status: 404, code: "NOT_FOUND", handler_calls: 1 },
    { name: "5 handler INVALID_TRANSITION passes through", req: {}, handler_throws: new DomainRefusal("INVALID_TRANSITION", "Not now."), status: 409, code: "INVALID_TRANSITION", handler_calls: 1 },
    { name: "6 success", req: {}, status: 200, handler_calls: 1 },
  ];
  it.each(rows)("$name", async (row) => {
    const { deps } = make_deps();
    const handler = vi.fn(async () => {
      if (row.handler_throws) throw row.handler_throws;
      return { ok: true };
    });
    // rows 4-6 need the caller allowed; rows 1-3 use the approver-only spec
    const spec = row.handler_calls === 1 ? OPEN_SPEC : SPEC;
    const res = await make_with_route(deps)(handler, spec)(make_request(row.req));
    expect(res.status).toBe(row.status);
    if (row.code) expect((res.body as { error: { code: string } }).error.code).toBe(row.code);
    expect(handler).toHaveBeenCalledTimes(row.handler_calls);
  });
});

describe("origin_check", () => {
  // AC-2 boundary/negative: mutations need a same-origin Origin header; GET does not
  it("foreign Origin on POST -> 401, no service call", async () => {
    const { deps, resolver } = make_deps();
    const h = ok_handler();
    const res = await make_with_route(deps)(h, OPEN_SPEC)(make_request({ origin: "https://evil.example" }));
    expect(res.status).toBe(401);
    expect((res.body as { error: { code: string } }).error.code).toBe("UNAUTHENTICATED");
    expect(h).not.toHaveBeenCalled();
    expect(resolver.calls).toHaveLength(0);
  });
  it("missing Origin on POST -> 401, no service call", async () => {
    const { deps, resolver } = make_deps();
    const h = ok_handler();
    const res = await make_with_route(deps)(h, OPEN_SPEC)(make_request({ origin: null }));
    expect(res.status).toBe(401);
    expect((res.body as { error: { code: string } }).error.code).toBe("UNAUTHENTICATED");
    expect(h).not.toHaveBeenCalled();
    expect(resolver.calls).toHaveLength(0);
  });
  it("GET without Origin passes", async () => {
    const { deps } = make_deps();
    const h = ok_handler();
    const res = await make_with_route(deps)(h, { ...OPEN_SPEC, request_schema: null })(make_request({ method: "GET", origin: null, body: null }));
    expect(res.status).toBe(200);
    expect(h).toHaveBeenCalledTimes(1);
  });
  it("Origin 'null' and an unparseable Origin on PUT/DELETE are refused", async () => {
    for (const [method, origin] of [["PUT", "null"], ["DELETE", "not a url"]] as const) {
      const { deps } = make_deps();
      const h = ok_handler();
      const res = await make_with_route(deps)(h, OPEN_SPEC)(make_request({ method, origin }));
      expect(res.status).toBe(401);
      expect(h).not.toHaveBeenCalled();
    }
  });
  it("Origin with the right host but another scheme/port is refused", async () => {
    for (const origin of ["http://app.example.test", "https://app.example.test:8443", "https://app.example.test.evil.example"]) {
      const { deps } = make_deps();
      const h = ok_handler();
      const res = await make_with_route(deps)(h, OPEN_SPEC)(make_request({ origin }));
      expect(res.status).toBe(401);
      expect(h).not.toHaveBeenCalled();
    }
  });
});

describe("session_and_secrets", () => {
  // AC-3 negative + invariant: no session / expired / unknown -> UNAUTHENTICATED; cookie value never echoed or logged
  const cases = [
    { name: "no session cookie", token: null },
    { name: "expired session", token: `expired-${COOKIE_MARKER}` },
    { name: "unknown token", token: COOKIE_MARKER },
  ];
  it.each(cases)("$name -> UNAUTHENTICATED, marker nowhere", async ({ token }) => {
    const { deps, lines } = make_deps();
    const h = ok_handler();
    const res = await make_with_route(deps)(h, OPEN_SPEC)(make_request({ token }));
    expect(res.status).toBe(401);
    expect((res.body as { error: { code: string } }).error.code).toBe("UNAUTHENTICATED");
    expect(h).not.toHaveBeenCalled();
    const everything = JSON.stringify(res.headers) + JSON.stringify(res.body) + lines.join("\n");
    expect(everything.split(COOKIE_MARKER).length - 1).toBe(0);
  });
  it("a valid session whose token holds the marker is also never echoed or logged", async () => {
    const { deps, lines } = make_deps();
    const res = await make_with_route(deps)(ok_handler(), OPEN_SPEC)(make_request({ token: "marker-valid-token" }));
    expect(res.status).toBe(200);
    const everything = JSON.stringify(res.headers) + JSON.stringify(res.body) + lines.join("\n");
    expect(everything).not.toContain("marker-valid-token");
    expect(lines.join("\n")).not.toContain("author@example.test");
  });
  it("the session cookie name comes from settings, not a hard-coded value", async () => {
    const { deps, resolver } = make_deps();
    await make_with_route(deps)(ok_handler(), OPEN_SPEC)(make_request({ token: null, cookies: { ls_session: "valid-token" } }));
    expect(resolver.calls[0]?.token).toBe("valid-token");
  });
});

describe("request_id", () => {
  // AC-4 invariant: every response carries X-Request-Id; refusals carry it in details.request_id
  const MINTED = /^req_[0-9A-HJKMNP-TV-Z]{26}$/;
  const run = async (hdr: string | undefined, spec: RouteSpec = OPEN_SPEC, handler = ok_handler(), req: Parameters<typeof make_request>[0] = {}) => {
    const { deps } = make_deps();
    const headers = hdr === undefined ? {} : { "x-request-id": hdr };
    return make_with_route(deps)(handler, spec)(make_request({ ...req, headers }));
  };
  it("echoes a valid client id", async () => {
    const res = await run("req_abc123");
    expect(res.headers["X-Request-Id"]).toBe("req_abc123");
  });
  it("replaces a 66-character id with a minted one", async () => {
    const bad = "a".repeat(66);
    const res = await run(bad);
    expect(res.headers["X-Request-Id"]).toMatch(MINTED);
  });
  it("replaces an id containing a space with a minted one", async () => {
    const res = await run("req abc");
    expect(res.headers["X-Request-Id"]).toMatch(MINTED);
  });
  it("is on a refusal and equals details.request_id", async () => {
    const res = await run("req_abc123", SPEC);
    expect(res.status).toBe(403);
    expect(res.headers["X-Request-Id"]).toBe("req_abc123");
    expect((res.body as { error: { details: { request_id: string } } }).error.details.request_id).toBe("req_abc123");
  });
  it("is on a 500, and the body is only {request_id}", async () => {
    const boom = vi.fn(async () => {
      throw new Error("boom internal detail");
    });
    const res = await run("req_abc123", OPEN_SPEC, boom as never);
    expect(res.status).toBe(500);
    expect(res.headers["X-Request-Id"]).toBe("req_abc123");
    expect(res.body).toEqual({ request_id: "req_abc123" });
  });
  it("a minted id is used consistently on a refusal", async () => {
    const res = await run(undefined, SPEC);
    const id = res.headers["X-Request-Id"];
    expect(id).toMatch(MINTED);
    expect((res.body as { error: { details: { request_id: string } } }).error.details.request_id).toBe(id);
  });
});
