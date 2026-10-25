// @vitest-environment node
// NL-25 AC-10: middleware redirects cookie-less page requests to /sign-in?next=...
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "./middleware.ts";

const call = (path: string, cookie?: string) =>
  middleware(new NextRequest(`http://localhost:3000${path}`, cookie === undefined ? {} : { headers: { cookie } }));

describe("middleware (AC-10)", () => {
  it("no cookie: 307 to /sign-in with the original path in next", () => {
    const res = call("/units/g6-u4/board");
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/sign-in");
    expect(loc.search).toBe("?next=%2Funits%2Fg6-u4%2Fboard");
  });
  it("cookie present: passes through", () => {
    const res = call("/units/g6-u4/board", "ls_session=abc");
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
  it("empty cookie value still redirects", () => {
    expect(call("/", "ls_session=").status).toBe(307);
  });
  it.each(["/api/session", "/sign-in", "/_next/static/x.js", "/healthz", "/favicon.ico"])("%s never redirects", (p) => {
    expect(call(p).headers.get("location")).toBeNull();
  });
});
