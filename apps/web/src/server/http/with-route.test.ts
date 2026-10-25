import { describe, expect, it, vi } from "vitest";
import { PoolExhausted } from "@ls/db/pool-exhausted";
import { z } from "zod";
import {
  make_with_route,
  mint_request_id,
  type RouteSpec,
} from "./with-route.ts";
import {
  make_deps,
  make_request,
  ok_handler,
} from "./testing/route-fixtures.ts";

const OPEN: RouteSpec = {
  operation_id: "testOp",
  roles: null,
  request_schema: "SignInRequest",
  success_status: 201,
};
type Body = { error: { code: string; details: Record<string, unknown> } };

describe("zod_parse", () => {
  it("lists field paths only, never values", async () => {
    const { deps } = make_deps();
    const h = ok_handler();
    const res = await make_with_route(deps)(h, OPEN)(
      make_request({
        body: {
          email: "PLANTED-VALUE-91e",
          password: "",
          extra: "PLANTED-VALUE-91e",
        },
      }),
    );
    expect(res.status).toBe(400);
    const b = res.body as Body;
    expect(b.error.code).toBe("INVALID_REQUEST");
    expect(b.error.details["fields"]).toEqual(
      expect.arrayContaining(["email", "password", "extra"]),
    );
    expect(JSON.stringify(res.body)).not.toContain("PLANTED-VALUE-91e");
    expect(h).not.toHaveBeenCalled();
  });
  it("a missing body fails as 'body'", async () => {
    const { deps } = make_deps();
    const res = await make_with_route(deps)(ok_handler(), OPEN)(
      make_request({ body: null }),
    );
    expect((res.body as Body).error.details["fields"]).toEqual(["body"]);
  });
  it("params and query schemas are parsed and prefixed", async () => {
    const { deps } = make_deps();
    const h = vi.fn(async (_u: unknown, r: { query: unknown }) => ({
      q: r.query as never,
    }));
    const spec: RouteSpec = {
      operation_id: "t",
      roles: null,
      request_schema: null,
      success_status: 200,
      params_schema: z.object({ id: z.string().min(3) }).strict(),
      query_schema: z.object({ n: z.string() }).strict(),
    };
    const bad = await make_with_route(deps)(h as never, spec)(
      make_request({
        method: "GET",
        path_params: { id: "x" },
        query: {},
        body: null,
      }),
    );
    expect((bad.body as Body).error.details["fields"]).toEqual([
      "path.id",
      "query.n",
    ]);
    const good = await make_with_route(deps)(h as never, spec)(
      make_request({
        method: "GET",
        path_params: { id: "abc" },
        query: { n: "1" },
        body: null,
      }),
    );
    expect(good.status).toBe(200);
  });
  it("an unknown request_schema throws at construction", () => {
    const { deps } = make_deps();
    expect(() =>
      make_with_route(deps)(ok_handler(), { ...OPEN, request_schema: "Nope" }),
    ).toThrow(/unknown request_schema/);
  });
});

describe("busy_and_unhandled", () => {
  it("PoolExhausted -> 503 with Retry-After", async () => {
    const { deps } = make_deps();
    const h = vi.fn(async () => {
      throw new PoolExhausted("web" as never, 5);
    });
    const res = await make_with_route(deps)(h as never, OPEN)(make_request());
    expect(res.status).toBe(503);
    expect(res.headers["Retry-After"]).toBe("2");
    expect((res.body as Body).error.code).toBe("SERVICE_BUSY");
  });
  it("an unhandled throw logs the class only", async () => {
    const { deps, lines } = make_deps();
    const h = vi.fn(async () => {
      throw new TypeError("secret detail");
    });
    const res = await make_with_route(deps)(h as never, OPEN)(make_request());
    expect(res.status).toBe(500);
    const log = lines.join("\n");
    expect(log).toContain("TypeError");
    expect(log).not.toContain("secret detail");
  });
});

describe("log_lines_and_no_audit", () => {
  it("one route.done per call with exactly three extra keys; refusal adds route.refused", async () => {
    const { deps, lines } = make_deps();
    await make_with_route(deps)(ok_handler(), OPEN)(make_request());
    await make_with_route(deps)(ok_handler(), OPEN)(
      make_request({ token: null }),
    );
    const parsed = lines.map(
      (l) =>
        JSON.parse(l) as {
          event?: string;
          msg?: string;
          extra?: Record<string, unknown>;
        },
    );
    const name = (p: (typeof parsed)[number]) => p.event ?? p.msg;
    expect(parsed.filter((p) => name(p) === "route.done")).toHaveLength(2);
    expect(parsed.filter((p) => name(p) === "route.refused")).toHaveLength(1);
    const done = parsed.find((p) => name(p) === "route.done");
    expect(Object.keys(done?.extra ?? {}).sort()).toEqual([
      "operation_id",
      "role",
      "status",
    ]);
  });
  it("deps have no audit member", () => {
    const { deps } = make_deps();
    expect(Object.keys(deps).sort()).toEqual([
      "logger",
      "sessions",
      "settings",
    ]);
  });
});

describe("public_route", () => {
  const PUBLIC: RouteSpec = {
    operation_id: "signIn",
    public: true,
    request_schema: "SignInRequest",
    success_status: 200,
  };
  it("skips the session but keeps Origin and parse", async () => {
    const { deps, resolver } = make_deps();
    const seen: unknown[] = [];
    const h = async (u: null) => {
      seen.push(u);
      return { ok: true };
    };
    const w = make_with_route(deps);
    expect((await w(h, PUBLIC)(make_request({ token: null }))).status).toBe(
      200,
    );
    expect(seen).toEqual([null]);
    expect(resolver.calls).toHaveLength(0);
    expect(
      (await w(h, PUBLIC)(make_request({ origin: "https://evil.example" })))
        .status,
    ).toBe(401);
    expect((await w(h, PUBLIC)(make_request({ body: {} }))).status).toBe(400);
  });
  it("types: a protected spec requires roles", () => {
    const { deps } = make_deps();
    // @ts-expect-error roles is required on a protected spec
    const bad: RouteSpec = {
      operation_id: "x",
      request_schema: null,
      success_status: 200,
    };
    expect(() => make_with_route(deps)(ok_handler(), bad)).toThrow(
      /roles required/,
    );
  });
});

describe("request_id_minting", () => {
  it("matches the minted shape", () => {
    expect(mint_request_id()).toMatch(/^req_[0-9A-HJKMNP-TV-Z]{26}$/);
  });
});
