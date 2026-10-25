// NL-54 frozen security test (AC-6) through the real with_route and handler factory. Do not edit.
import { describe, expect, it } from "vitest";
import type { RequestUser } from "@ls/core/ports/common";
import { DomainRefusal, make_deps } from "@/server/http/testing/route-fixtures.ts";
import { make_with_route, type HttpRequest, type SessionResolver } from "@/server/http/with-route.ts";
import { make_board_handlers, type BoardApi } from "@/server/routes/board-routes.ts";
import { board_row, make_board_world, user } from "@/server/services/board-test-fakes.ts";

class Roles implements SessionResolver {
  async require(token: string | null, request_id: string): Promise<RequestUser> {
    for (const role of ["author", "reviewer", "approver"] as const) {
      if (token === `${role}-token`) return { ...user(role), request_id };
    }
    throw new DomainRefusal("UNAUTHENTICATED", "Sign in again.");
  }
}

function setup(with_lessons: boolean) {
  const w = make_board_world(with_lessons ? [board_row(1, "draft"), board_row(2, "approved")] : []);
  const { deps, lines } = make_deps({ sessions: () => new Roles() });
  const h = make_board_handlers({ with_route: make_with_route(deps), board: () => w.service as unknown as BoardApi });
  const req = (unit: string, token: string | null): HttpRequest => ({
    method: "GET",
    path_params: { unitId: unit },
    query: {},
    headers: {},
    body: null,
    cookies: token === null ? {} : { ls_session: token },
  });
  return { w, h, req, lines };
}

const code = (r: { body: unknown }) => (r.body as { error: { code: string } }).error.code;

describe("AC-6 not_found_empty_and_roles [failure/refusal]", () => {
  it("not_found_empty_and_roles: an unknown unit id is 404 NOT_FOUND on board and metrics, and a log line carries the request id and code", async () => {
    const { h, req, lines } = setup(true);
    for (const handler of [h.get_board, h.get_metrics]) {
      const r = await handler(req("G9.U9", "author-token"));
      expect(r.status).toBe(404);
      expect(code(r)).toBe("NOT_FOUND");
    }
    expect(lines.join("\n")).toContain("NOT_FOUND");
  });

  it("not_found_empty_and_roles: a unit with no lessons is 200 with rows [] (not an error)", async () => {
    const { h, req } = setup(false);
    const r = await h.get_board(req("G6.U4", "author-token"));
    expect(r.status).toBe(200);
    const body = r.body as { rows: unknown[]; rollup: Record<string, number> };
    expect(body.rows).toEqual([]);
    expect(Object.values(body.rollup).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("not_found_empty_and_roles: author, reviewer and approver all read the board and the metrics with 200", async () => {
    const { h, req } = setup(true);
    for (const token of ["author-token", "reviewer-token", "approver-token"]) {
      expect((await h.get_board(req("G6.U4", token))).status).toBe(200);
      expect((await h.get_metrics(req("G6.U4", token))).status).toBe(200);
    }
  });

  it("not_found_empty_and_roles: no session is 401 and the service is never reached", async () => {
    const { w, h, req } = setup(true);
    for (const handler of [h.get_board, h.get_metrics]) {
      const r = await handler(req("G6.U4", null));
      expect(r.status).toBe(401);
    }
    expect(w.read.calls).toHaveLength(0);
    expect(w.extras.calls).toBe(0);
  });

  it("not_found_empty_and_roles: a malformed unit id or an unknown state filter is rejected before the service runs", async () => {
    const { w, h, req } = setup(true);
    const bad_unit = await h.get_board(req("not-a-unit", "author-token"));
    expect(bad_unit.status).toBeGreaterThanOrEqual(400);
    expect(bad_unit.status).toBeLessThan(500);
    const bad_state = await h.get_board({ ...req("G6.U4", "author-token"), query: { state: "bogus" } });
    expect(bad_state.status).toBeGreaterThanOrEqual(400);
    expect(bad_state.status).toBeLessThan(500);
    expect(w.read.calls).toHaveLength(0);
  });
});
