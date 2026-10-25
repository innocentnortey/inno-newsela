// NL-54 board route tests (AC-1..5, 11, 12) through the real with_route and handler factory.
import { describe, expect, it, vi } from "vitest";
import type { LessonStateName, RequestUser } from "@ls/core/ports/common";
import { make_deps } from "@/server/http/testing/route-fixtures.ts";
import { make_with_route, type HttpRequest, type SessionResolver } from "@/server/http/with-route.ts";
import { make_board_handlers, type BoardApi } from "@/server/routes/board-routes.ts";
import { board_row, make_board_world, user } from "@/server/services/board-test-fakes.ts";

vi.mock("@ls/core/checks/run-checks", () => ({ run_checks: () => { throw new Error("run_checks must not run on a board read"); } }));

class Anyone implements SessionResolver {
  async require(_t: string | null, request_id: string): Promise<RequestUser> {
    void _t;
    return { ...user("reviewer"), request_id };
  }
}

function setup(rows: ReturnType<typeof board_row>[]) {
  const w = make_board_world(rows);
  const { deps } = make_deps({ sessions: () => new Anyone() });
  const h = make_board_handlers({ with_route: make_with_route(deps), board: () => w.service as unknown as BoardApi });
  const req = (query: Record<string, string> = {}): HttpRequest => ({
    method: "GET", path_params: { unitId: "G6.U4" }, query, headers: {}, body: null, cookies: { ls_session: "t" },
  });
  return { w, h, req };
}

type Body = { rows: Array<{ lesson_id: string; state: string; blocking_count: number }>; rollup: Record<string, number> };

describe("board route", () => {
  it("sort_order_uxq5: failed first, then most blocking, then approved", async () => {
    const s = setup([board_row(1, "approved"), board_row(2, "draft"), board_row(3, "generation_failed"), board_row(4, "in_review")]);
    s.w.issues.counts = [{ lesson_id: "G6.U4.L4", blocking: 3, confirmation: 0, advisory: 0 }];
    const r = await s.h.get_board(s.req());
    expect((r.body as unknown as Body).rows.map((x) => x.lesson_id)).toEqual(["G6.U4.L3", "G6.U4.L4", "G6.U4.L2", "G6.U4.L1"]);
  });

  it("filter_keeps_whole_unit_rollup: the state filter narrows rows, not the rollup", async () => {
    const s = setup([board_row(1, "approved"), board_row(2, "draft")]);
    const b = (await s.h.get_board(s.req({ state: "draft" }))).body as unknown as Body;
    expect(b.rows).toHaveLength(1);
    expect(b.rollup["approved"]).toBe(1);
  });

  it("counts_from_stored_issue_rows: one counts read, no run_checks", async () => {
    const s = setup([board_row(1, "draft")]);
    s.w.issues.counts = [{ lesson_id: "G6.U4.L1", blocking: 4, confirmation: 0, advisory: 0 }];
    const b = (await s.h.get_board(s.req())).body as unknown as Body;
    expect(b.rows[0]!.blocking_count).toBe(4);
    expect(s.w.issues.calls).toBe(1);
  });

  it("p95_47_rows_and_query_budget: 3 repo calls, no dependency reads for unflagged rows, fast", async () => {
    const states: LessonStateName[] = ["draft", "in_review", "approved", "submitted", "exported", "reopened", "changes_requested"];
    const s = setup(Array.from({ length: 47 }, (_, i) => board_row(i + 1, states[i % states.length]!)));
    const times: number[] = [];
    for (let i = 0; i < 50; i++) {
      const t0 = performance.now();
      expect((await s.h.get_board(s.req())).status).toBe(200);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    console.log(`board p95 ms: ${times[Math.floor(times.length * 0.95)]!.toFixed(2)}`);
    expect(times[Math.floor(times.length * 0.95)]!).toBeLessThan(1000);
    expect(s.w.read.calls).toHaveLength(50);
    expect(s.w.issues.calls).toBe(50);
    expect(s.w.extras.calls).toBe(50);
    expect(s.w.graph.calls).toHaveLength(0);
  });

  it("test_board_reads_stored_rows: handler answers 200 with the unit key and rows", async () => {
    const s = setup([board_row(1, "draft")]);
    const r = await s.h.get_board(s.req());
    expect(r.status).toBe(200);
    expect((r.body as unknown as { unit_key: string }).unit_key).toBe("g6-u4");
  });
});
