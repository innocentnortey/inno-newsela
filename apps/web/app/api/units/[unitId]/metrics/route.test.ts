// NL-54 frozen security tests (AC-7..AC-10) through the real with_route and handler factory. Do not edit.
import { describe, expect, it, vi } from "vitest";
import type { RequestUser } from "@ls/core/ports/common";
import { DomainRefusal, make_deps } from "@/server/http/testing/route-fixtures.ts";
import { make_with_route, type HttpRequest, type SessionResolver } from "@/server/http/with-route.ts";
import { make_board_handlers, type BoardApi } from "@/server/routes/board-routes.ts";
import {
  ZED, board_row, frozen_row, lid, make_board_world, user,
} from "@/server/services/board-test-fakes.ts";

const CAPTION = "No baseline yet (AQ-14). Measured with us as reviewers.";

class Roles implements SessionResolver {
  async require(token: string | null, request_id: string): Promise<RequestUser> {
    if (token === "reviewer-token") return { ...user("reviewer"), request_id };
    throw new DomainRefusal("UNAUTHENTICATED", "Sign in again.");
  }
}

interface NorthStar {
  median_minutes: number | null;
  n: number;
  fast_approvals: { count: number; of: number };
  approved: { k: number; total: number };
  caption: string;
  segment_label: string | null;
}
interface MetricsBody { north_star: NorthStar; quality: unknown }

// lessons: [number, state, reviewer name]
function setup(lessons: Array<[number, Parameters<typeof board_row>[1], string | null]>) {
  const w = make_board_world(lessons.map(([n, s, who]) => board_row(n, s, { reviewer_name: who })));
  const { deps, lines } = make_deps({ sessions: () => new Roles() });
  const h = make_board_handlers({ with_route: make_with_route(deps), board: () => w.service as unknown as BoardApi });
  const req = (): HttpRequest => ({
    method: "GET", path_params: { unitId: "G6.U4" }, query: {}, headers: {}, body: null, cookies: { ls_session: "reviewer-token" },
  });
  const read_metrics = async () => {
    const r = await h.get_metrics(req());
    expect(r.status).toBe(200);
    return r.body as unknown as MetricsBody;
  };
  return { w, h, req, lines, read_metrics };
}

async function seed_three() {
  const s = setup([
    [1, "approved", "Test Reviewer A"],
    [2, "approved", "Test Reviewer B"],
    [3, "approved", "Test Reviewer C"],
    [4, "in_review", null],
    [5, "draft", null],
  ]);
  s.w.metrics.rows.push(frozen_row(1, 10, 15), frozen_row(2, 20, 15), frozen_row(3, 40, 50));
  return s;
}

describe("AC-7 north_star_from_frozen_rows [invariant]", () => {
  it("north_star_from_frozen_rows: median, n, per-row fast-approval threshold, approved k of total and the exact caption", async () => {
    const { read_metrics } = await seed_three();
    const { north_star: ns } = await read_metrics();
    expect(ns.median_minutes).toBe(20);
    expect(ns.n).toBe(3);
    // 10 < 15 fast; 20 < 15 no; 40 < 50 fast: each row uses its own stored threshold (a single 15 would give 1)
    expect(ns.fast_approvals).toEqual({ count: 2, of: 3 });
    expect(ns.approved).toEqual({ k: 3, total: 5 });
    expect(ns.caption).toBe(CAPTION);
  });

  it("north_star_from_frozen_rows: an even count takes the mean of the two middle values", async () => {
    const s = setup([[1, "approved", "Test Reviewer A"], [2, "approved", "Test Reviewer B"], [3, "approved", "Test Reviewer C"], [4, "approved", "Test Reviewer A"]]);
    s.w.metrics.rows.push(frozen_row(1, 10, 15), frozen_row(2, 20, 15), frozen_row(3, 30, 15), frozen_row(4, 50, 15));
    expect((await s.read_metrics()).north_star.median_minutes).toBe(25);
  });

  it("north_star_from_frozen_rows: reading the metrics writes no row", async () => {
    const s = await seed_three();
    const before = JSON.stringify(s.w.metrics.rows);
    await s.read_metrics();
    expect(JSON.stringify(s.w.metrics.rows)).toBe(before);
    expect(s.w.metrics.heartbeats).toHaveLength(0);
    expect(s.w.metrics.sessions).toHaveLength(0);
  });
});

describe("AC-8 empty_small_segment_quality_null [invariant]", () => {
  it("empty_small_segment_quality_null: no approved lesson gives an empty median and n 0", async () => {
    const s = setup([[1, "draft", null], [2, "in_review", null]]);
    const { north_star: ns, quality } = await s.read_metrics();
    expect(ns.median_minutes).toBeNull();
    expect(ns.n).toBe(0);
    expect(ns.fast_approvals.count).toBe(0);
    expect(ns.approved).toEqual({ k: 0, total: 2 });
    expect(quality).toBeNull();
  });

  it("empty_small_segment_quality_null: rows from one reviewer read 'one reviewer, n = 2'", async () => {
    const s = setup([[1, "approved", "Test Reviewer A"], [2, "approved", "Test Reviewer A"]]);
    s.w.metrics.rows.push(frozen_row(1, 10, 15), frozen_row(2, 20, 15));
    expect((await s.read_metrics()).north_star.segment_label).toBe("one reviewer, n = 2");
  });

  it("empty_small_segment_quality_null: rows from two reviewers still carry a small-segment label with n", async () => {
    const s = setup([[1, "approved", "Test Reviewer A"], [2, "approved", "Test Reviewer B"]]);
    s.w.metrics.rows.push(frozen_row(1, 10, 15), frozen_row(2, 20, 15));
    const label = (await s.read_metrics()).north_star.segment_label;
    expect(label).not.toBeNull();
    expect(label).toContain("n = 2");
  });

  it("empty_small_segment_quality_null: the key quality is present and null (not omitted)", async () => {
    const s = await seed_three();
    const body = await s.read_metrics();
    expect(Object.prototype.hasOwnProperty.call(body, "quality")).toBe(true);
    expect(body.quality).toBeNull();
  });
});

describe("AC-9 no_name_beside_minutes [negative]", () => {
  it("no_name_beside_minutes: the reviewer name is in no metrics response, log line or console output", async () => {
    const s = setup([[1, "approved", ZED], [2, "approved", ZED], [3, "approved", "Test Reviewer C"]]);
    s.w.metrics.rows.push(frozen_row(1, 12, 15), frozen_row(2, 18, 15), frozen_row(3, 30, 15));
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    try {
      const r = await s.h.get_metrics(s.req());
      expect(r.status).toBe(200);
      expect(JSON.stringify(r.body)).not.toContain(ZED);
      expect(JSON.stringify(r.body)).not.toContain("Quillfeather");
      expect(s.lines.join("\n")).not.toContain("Quillfeather");
      const printed = spies.flatMap((sp) => sp.mock.calls.map((c) => JSON.stringify(c))).join("\n");
      expect(printed).not.toContain("Quillfeather");
    } finally {
      spies.forEach((sp) => sp.mockRestore());
    }
  });

  it("no_name_beside_minutes: the metrics response holds only the aggregate keys (no per-lesson or per-person minutes)", async () => {
    const s = await seed_three();
    const body = await s.read_metrics();
    expect(Object.keys(body).sort()).toEqual(["north_star", "quality"]);
    expect(Object.keys(body.north_star).sort()).toEqual(
      ["approved", "caption", "fast_approvals", "median_minutes", "n", "segment_label"],
    );
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/lesson_id|user_id|reviewer(?!s)|G6\.U4\.L\d/); // the fixed caption says "reviewers" (AC-7)
    expect(text).not.toMatch(/Test Reviewer/);
  });

  it("no_name_beside_minutes: on the board the name may appear but never next to any minutes figure", async () => {
    const s = setup([[1, "approved", ZED], [2, "in_review", ZED]]);
    s.w.metrics.rows.push(frozen_row(1, 12.5, 15));
    const r = await s.h.get_board(s.req());
    expect(r.status).toBe(200);
    const rows = (r.body as { rows: Array<Record<string, unknown>> }).rows;
    for (const row of rows) {
      expect(Object.keys(row).filter((k) => /minute|second|duration|time_spent|active/i.test(k))).toEqual([]);
    }
    expect(JSON.stringify(r.body)).not.toContain("12.5");
    expect(s.lines.join("\n")).not.toContain("Quillfeather");
  });
});

describe("AC-10 rework_does_not_change_frozen_row [invariant]", () => {
  it("rework_does_not_change_frozen_row: a lesson approved, reopened and approved again keeps its first frozen row", async () => {
    const s = setup([[1, "approved", "Test Reviewer A"], [2, "approved", "Test Reviewer B"], [3, "approved", "Test Reviewer C"]]);
    const tx = undefined as never;
    expect(await s.w.metrics.write_lesson_metrics(frozen_row(1, 10, 15), tx)).toBe(true);
    expect(await s.w.metrics.write_lesson_metrics(frozen_row(2, 20, 15), tx)).toBe(true);
    expect(await s.w.metrics.write_lesson_metrics(frozen_row(3, 40, 15), tx)).toBe(true);
    const first = await s.read_metrics();
    expect(first.north_star.median_minutes).toBe(20);

    // Lesson 3 is reopened, edited and approved again with a much longer second session.
    s.w.read.rows = s.w.read.rows.map((r) => (r.lesson_id === lid(3) ? { ...r, state: "reopened" } : r));
    await s.read_metrics();
    s.w.read.rows = s.w.read.rows.map((r) => (r.lesson_id === lid(3) ? { ...r, state: "approved" } : r));
    expect(await s.w.metrics.write_lesson_metrics(frozen_row(3, 400, 15), tx)).toBe(false);

    const after = await s.read_metrics();
    expect(after.north_star).toEqual(first.north_star);
    expect(s.w.metrics.rows).toHaveLength(3);
  });
});
