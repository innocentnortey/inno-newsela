// NL-78: pure read-model builders.
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import type { JobRow } from "@ls/core/ports/job-queue";
import type { RunCallTotals } from "@ls/core/ports/model-call-log";
import type { ProgressJobRow, RunProgressRows } from "@ls/core/ports/run-progress";
import type { RunRow, RunSummaryRows } from "@ls/core/ports/runs";
import { build_progress, build_summary, lesson_key_of, p95 } from "./run-read-model.ts";

const T0 = new Date("2026-10-25T10:00:00.000Z");
const run = (over: Partial<RunRow> = {}): RunRow =>
  ({ run_id: "run_1", unit_id: "G6.U4", outline_version_id: "ov", kind: "run", state: "running", prompt_version_id: "pv", cap_usd: new Decimal(13),
    started_by: "u", parent_run_id: null, plan_stored_at: T0, paused_check: null, capped_by: null, choices_hash: "h", created_at: T0, finished_at: null, ...over }) as RunRow;
let n = 0;
const job = (over: Partial<ProgressJobRow> = {}): ProgressJobRow => {
  n += 1;
  return { job_id: `job_${n}`, run_id: "run_1", kind: "lesson", lesson_id: `G6.U4.L${n}`, status: "queued", tile_state: "queued", attempt: 0, queued_at: T0,
    started_at: null, finished_at: null, failure_reasons: [], brakes_fired: [], repairs: 0, truncation_retries: 0, retries: 0, calls_lost: 0,
    cost_usd: new Decimal(0), lesson_title: `Synthetic lesson ${n}`, lesson_number: n, ...over } as ProgressJobRow;
};
const progress = (jobs: ProgressJobRow[], r: RunRow = run()): RunProgressRows => ({ run: r, settled_usd: new Decimal("1.5"), reserved_usd: new Decimal("0.5"), jobs, queued_ahead: 2 });

describe("build_progress", () => {
  it("maps each job status to a tile state and sums the counts", () => {
    const jobs = [
      job(), job({ status: "running", tile_state: "drafting" }), job({ status: "running", tile_state: "checking" }), job({ status: "running", tile_state: "repairing" }),
      job({ status: "ready", tile_state: "ready" }), job({ status: "generation_failed", tile_state: "failed" }), job({ status: "cancelled", tile_state: "failed" }),
      job({ kind: "unit_plan", lesson_id: null, status: "running", tile_state: "planning" }),
    ];
    const p = build_progress(progress(jobs), 6);
    expect(p.tiles.map((t) => t.tile_state)).toEqual(["queued", "drafting", "checking", "repairing", "ready", "failed", "failed"]);
    expect(Object.keys(p.counts_by_tile_state)).toHaveLength(7);
    expect(Object.values(p.counts_by_tile_state).reduce((a, b) => a + b, 0)).toBe(p.tiles.length);
    expect(p.tiles.map((t) => t.openable)).toEqual([false, false, false, false, true, false, false]);
    expect([p.spent_usd, p.reserved_usd, p.cap_usd, p.queued_ahead, p.concurrency_cap]).toEqual([1.5, 0.5, 13, 2, 6]);
  });

  it("keeps only vocabulary reasons and backfills a missing message", () => {
    const failed = job({
      status: "generation_failed", tile_state: "failed", truncation_retries: 1,
      failure_reasons: [{ check: "cancelled" }, { check: "bogus", message: "x" }, { check: "check_failed", check_kind: "missing_slot", message: "kept" }] as never,
    });
    const t = build_progress(progress([failed]), 6).tiles[0]!;
    expect(t.failure_reasons.map((r) => r.check)).toEqual(["cancelled", "check_failed"]);
    expect(t.failure_reasons[0]?.message.length).toBeGreaterThan(0);
    expect(t.failure_reasons[1]).toMatchObject({ check_kind: "missing_slot", message: "kept" });
    expect([t.truncation_retry_used, t.repair_used]).toEqual([true, false]);
  });

  it("names the failed lessons behind a paused check and leaves it null otherwise", () => {
    const f = job({ status: "generation_failed", tile_state: "failed", failure_reasons: [{ check: "provider_error", message: "m" }] as never });
    const paused = build_progress(progress([f, job()], run({ state: "paused", paused_check: "provider_error" })), 6);
    expect(paused.paused_reason).toEqual({ check: "provider_error", lesson_ids: [f.lesson_id] });
    expect(build_progress(progress([f]), 6).paused_reason).toBeNull();
    expect(build_progress(progress([], run({ state: "paused", paused_check: "unit_plan" })), 6).paused_reason).toEqual({ check: "unit_plan", lesson_ids: [] });
  });

  it("orders tiles by lesson number with nulls last", () => {
    const a = job({ lesson_number: null, lesson_id: "G6.U4.FLEX-1a" });
    const b = job({ lesson_number: 2, lesson_id: "G6.U4.L2" });
    const c = job({ lesson_number: 1, lesson_id: "G6.U4.L1" });
    expect(build_progress(progress([a, b, c]), 6).tiles.map((t) => t.lesson_key)).toEqual(["L1", "L2", "FLEX-1a"]);
  });
});

const totals = (cost: string, over: Partial<RunCallTotals> = {}): RunCallTotals =>
  ({ run_id: "run_1", calls: 5, completed: 4, failed: 0, lost: 1, retries: 2, truncation_retries: 1, repairs: 0, cost_usd: new Decimal(cost), input_tokens: 0, output_tokens: 0, ...over });
const summary_rows = (jobs: JobRow[]): RunSummaryRows => ({ run: run({ finished_at: new Date(T0.getTime() + 90_500) }), jobs, calls: totals("0"), placeholders_left: 3, report_path: null });

describe("build_summary", () => {
  const min = (m: number) => ({ started_at: T0, finished_at: new Date(T0.getTime() + m * 60000) });
  const jobs = [
    job({ status: "ready", ...min(2) }), job({ status: "ready", ...min(4) }),
    job({ status: "generation_failed", failure_reasons: [{ check: "truncated", message: "m" }, { check: "truncated", message: "m" }] as never, brakes_fired: ["truncation_retry"] as never, calls_lost: 1, ...min(6) }),
  ];
  it("totals, per-lesson cost, failures, brakes and wall time", () => {
    const s = build_summary(summary_rows(jobs), totals("3.00"), new Decimal("3.00"), T0);
    expect(s).toMatchObject({ n: 3, lessons: { ready: 2, failed: 1 }, cost_usd: 3, cost_per_ready_lesson_usd: 1.5, retries: 2, truncation_retries: 1,
      calls_lost_in_flight: 1, wall_time_seconds: 90, placeholders_left: 3, target_minutes_per_lesson: 5, p95_minutes_per_lesson: 6, trace_incomplete: false });
    expect(s.failures_by_reason).toEqual([{ reason: "truncated", count: 1 }]);
    expect(s.brakes_fired).toEqual([{ brake: "truncation_retry", count: 1 }]);
  });
  it("cost per ready lesson is null with none ready", () => {
    const s = build_summary(summary_rows([job({ status: "generation_failed" })]), totals("1"), new Decimal("1"), T0);
    expect(s.cost_per_ready_lesson_usd).toBeNull();
  });
  it("flags trace_incomplete when spend differs from the call sum", () => {
    expect(build_summary(summary_rows(jobs), totals("3.00"), new Decimal("2.99"), T0).trace_incomplete).toBe(true);
  });
});

describe("helpers", () => {
  it("p95 nearest rank", () => {
    expect(p95([])).toBeNull();
    expect(p95([7])).toBe(7);
    expect(p95(Array.from({ length: 20 }, (_, i) => i + 1))).toBe(19);
  });
  it("lesson_key_of", () => {
    expect(lesson_key_of("G6.U4.FLEX-1a")).toBe("FLEX-1a");
  });
});
