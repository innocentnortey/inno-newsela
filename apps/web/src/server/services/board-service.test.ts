// NL-54 unit tests: sort (UXQ-5), median, dependency flags, send-back mapping.
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import type { DependencyState } from "@ls/core/ports/lesson-graph";
import { median_minutes, sort_rows } from "./board-service.ts";
import { board_row, lid, make_board_world, user } from "./board-test-fakes.ts";

const r = (n: number, state: string, b = 0, c = 0, a = 0, number: number | null = n) =>
  ({ lesson_id: lid(n), number, state, blocking_count: b, confirmation_count: c, advisory_count: a }) as never;

describe("sort_rows", () => {
  it("sort_order_uxq5: failed first, active by blocking/advisory/confirmation desc, then approved and exported", () => {
    const out = sort_rows([
      r(1, "approved"), r(2, "draft", 0, 0, 1), r(3, "generation_failed"), r(4, "in_review", 2), r(5, "exported"),
      r(6, "submitted", 0, 3, 0), r(7, "draft", 0, 0, 1, null),
    ] as never[]) as unknown as Array<{ lesson_id: string }>;
    expect(out.map((x) => x.lesson_id)).toEqual([lid(3), lid(4), lid(2), lid(7), lid(6), lid(1), lid(5)]);
  });
});

describe("median_minutes", () => {
  it("odd, even and empty", () => {
    expect(median_minutes([])).toBeNull();
    expect(median_minutes([new Decimal(3), new Decimal(1), new Decimal(2)])).toBe(2);
    expect(median_minutes([new Decimal(1), new Decimal("2.345")])).toBe(1.67);
  });
});

describe("board", () => {
  it("dependency_flags_uxp2 and counts_from_stored_issue_rows and reviewer_send_back_no_judge_flag", async () => {
    const w = make_board_world([
      board_row(1, "approved"),
      board_row(2, "draft", { dependency_flag: true, reviewer_name: "Test Reviewer A" }),
      board_row(3, "changes_requested"),
    ]);
    w.issues.counts = [{ lesson_id: lid(2), blocking: 2, confirmation: 1, advisory: 0 }];
    const dep = (n: number, over: Partial<DependencyState>): DependencyState =>
      ({ direction: "waits_on", lesson_id: lid(n), slot_id: "s", source_state: "draft", slot_filled: true, source_approved_hash: null, ...over }) as DependencyState;
    w.graph.deps.set(lid(2), [dep(1, { slot_filled: false }), dep(3, { source_state: "reopened" }), { ...dep(1, {}), direction: "depended_on_by" }]);
    w.extras.extras = { send_backs: [{ lesson_id: lid(3), tag: "weird", note: "n", by: "Test", at: new Date("2026-10-22T00:00:00Z") }] };
    const b = await w.service.board(user("author"), "G6.U4" as never, null);
    expect(w.read.calls).toEqual([{ unit_id: "G6.U4", state: null }]);
    expect(w.graph.calls).toEqual([lid(2)]);
    const row2 = b.rows.find((x) => x.lesson_id === lid(2))!;
    expect(row2.blocking_count).toBe(2);
    expect(row2.reviewer).toBe("Test Reviewer A");
    expect(row2.dependency_flags.map((f) => [f.kind, f.status])).toEqual([["waits_on", "slot_empty"], ["waits_on", "waiting_for_source_approval"], ["source_reopened", null]]);
    const row3 = b.rows.find((x) => x.lesson_id === lid(3))!;
    expect(row3.send_back).toMatchObject({ tag: "other", note: "n", by: "Test" });
    expect(row3.judge_flag).toBeNull();
    expect(b.rows[0]!.lesson_id).toBe(lid(2));
  });

  it("filter_keeps_whole_unit_rollup", async () => {
    const w = make_board_world([board_row(1, "approved"), board_row(2, "draft"), board_row(3, "draft")]);
    const b = await w.service.board(user("author"), "G6.U4" as never, "draft");
    expect(b.rows).toHaveLength(2);
    expect(b.rollup["approved"]).toBe(1);
    expect(b.rollup["draft"]).toBe(2);
  });
});
