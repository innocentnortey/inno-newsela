// NL-54 AC-11: metrics read p95 over 50 reads.
import { describe, expect, it } from "vitest";
import type { RequestUser } from "@ls/core/ports/common";
import { make_deps } from "@/server/http/testing/route-fixtures.ts";
import { make_with_route, type SessionResolver } from "@/server/http/with-route.ts";
import { make_board_handlers, type BoardApi } from "@/server/routes/board-routes.ts";
import { board_row, frozen_row, make_board_world, user } from "@/server/services/board-test-fakes.ts";

class Anyone implements SessionResolver {
  async require(_t: string | null, request_id: string): Promise<RequestUser> {
    void _t;
    return { ...user("reviewer"), request_id };
  }
}

describe("metrics route speed", () => {
  it("p95_47_rows_and_query_budget: 50 reads under 300 ms at p95", async () => {
    const w = make_board_world(Array.from({ length: 47 }, (_, i) => board_row(i + 1, "approved")));
    for (let i = 1; i <= 47; i++) w.metrics.rows.push(frozen_row(i, i, 30));
    const { deps } = make_deps({ sessions: () => new Anyone() });
    const h = make_board_handlers({ with_route: make_with_route(deps), board: () => w.service as unknown as BoardApi });
    const times: number[] = [];
    for (let i = 0; i < 50; i++) {
      const t0 = performance.now();
      const r = await h.get_metrics({ method: "GET", path_params: { unitId: "G6.U4" }, query: {}, headers: {}, body: null, cookies: { ls_session: "t" } });
      expect(r.status).toBe(200);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    console.log(`metrics p95 ms: ${times[Math.floor(times.length * 0.95)]!.toFixed(2)}`);
    expect(times[Math.floor(times.length * 0.95)]!).toBeLessThan(300);
  });
});
