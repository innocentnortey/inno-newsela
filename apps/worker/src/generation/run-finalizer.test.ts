import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { FakeClock } from "@ls/core/ports/clock";
import type { BrakeName } from "@ls/core/ports/common";
import type { JobOutcome } from "@ls/core/ports/job-queue";
import {
  MemJobQueue, MemRunRepo, MemTxRunner, StubCalls, make_job_row, make_logger, make_run_row,
  reference_derive_run_state,
} from "./finalizer-doubles.ts";
import { RunFinalizer } from "./run-finalizer.ts";

function world(run_state: "running" | "capped" | "cancelled" | "paused" = "running") {
  const clock = new FakeClock();
  const runs = new MemRunRepo(clock);
  const queue = new MemJobQueue(clock);
  const calls = new StubCalls();
  const tx = new MemTxRunner(runs, queue);
  const { logger, lines } = make_logger();
  const run = runs.add(make_run_row({ state: run_state }));
  const finalizer = new RunFinalizer(runs, queue, calls, tx, { circuit_breaker_same_check: 3 }, reference_derive_run_state, logger);
  const add_job = (p: Parameters<typeof make_job_row>[0] = {}) => queue.add(make_job_row({ run_id: run.run_id, ...p }));
  const outcome = (brakes: BrakeName[] = []): JobOutcome =>
    ({ job_id: "job_x", brakes_fired: brakes, failure_reasons: [], cost_usd: new Decimal(0) }) as unknown as JobOutcome;
  return { clock, runs, queue, calls, tx, lines, run, finalizer, add_job, outcome };
}

const done = (lesson: string, at: number, extra = {}) => ({
  lesson_id: lesson, status: "ready" as const, tile_state: "ready" as const, finished_at: new Date(at), ...extra,
});

describe("terminal_states", () => {
  it("terminal_states: 47 ready jobs -> complete with finished_at", async () => {
    const w = world();
    for (let i = 1; i <= 47; i++) w.add_job(done(`G6.U1.L${i}`, 1000 + i));
    const change = await w.finalizer.after_job(w.run.run_id, w.outcome());
    expect(change).toEqual({ run_id: w.run.run_id, from_state: "running", to_state: "complete", paused_check: null });
    expect(w.runs.rows.get(w.run.run_id)?.finished_at).not.toBeNull();
  });
  it("terminal_states: one generation_failed -> partial", async () => {
    const w = world();
    for (let i = 1; i <= 46; i++) w.add_job(done(`G6.U1.L${i}`, 1000 + i));
    w.add_job(done("G6.U1.L47", 2000, { status: "generation_failed", tile_state: "failed", failure_reasons: [{ check: "timeout", message: "t" }] }));
    expect((await w.finalizer.after_job(w.run.run_id, w.outcome()))?.to_state).toBe("partial");
  });
  it("terminal_states: jobs still queued/running -> null, no set_state", async () => {
    const w = world();
    w.add_job(done("G6.U1.L1", 1000));
    w.add_job({ lesson_id: "G6.U1.L2" });
    w.add_job({ lesson_id: "G6.U1.L3", status: "running", tile_state: "drafting" });
    expect(await w.finalizer.after_job(w.run.run_id, w.outcome())).toBeNull();
    expect(w.runs.calls.some((c) => c.startsWith("set_state"))).toBe(false);
    expect(w.lines.filter((l) => l.event === "run.state_change")).toHaveLength(0);
  });
});

describe("circuit_breaker_pauses", () => {
  const fail = (n: number) => ({
    status: "generation_failed" as const, tile_state: "failed" as const, lesson_id: `G6.U1.L${n}`,
    finished_at: new Date(1000 * n),
    failure_reasons: [{ check: "check_failed" as const, check_kind: "quote_unmatched", message: "q" }],
  });
  it("circuit_breaker_pauses: three same-check failures pause, job rows untouched", async () => {
    const w = world();
    for (const n of [1, 2, 3]) w.add_job(fail(n));
    w.add_job({ lesson_id: "G6.U1.L9" });
    const before = w.queue.jobs.map((j) => ({ ...j }));
    const change = await w.finalizer.after_job(w.run.run_id, w.outcome());
    expect(change?.to_state).toBe("paused");
    expect(change?.paused_check).toBe("quote_unmatched");
    expect(w.runs.rows.get(w.run.run_id)?.paused_check).toBe("quote_unmatched");
    expect(w.queue.jobs).toEqual(before);
  });
  it("circuit_breaker_pauses: two failures do not pause", async () => {
    const w = world();
    for (const n of [1, 2]) w.add_job(fail(n));
    w.add_job({ lesson_id: "G6.U1.L9" });
    expect(await w.finalizer.after_job(w.run.run_id, w.outcome())).toBeNull();
  });
});

describe("capped_marks_and_cancels", () => {
  it.each([
    ["spend_run_cap", "run_cap"],
    ["spend_day_cap", "day_cap"],
    ["spend_project_cap", "project_cap"],
  ] as const)("capped_marks_and_cancels: %s -> %s", async (brake, cap) => {
    const w = world();
    w.add_job(done("G6.U1.L1", 1000));
    const q1 = w.add_job({ lesson_id: "G6.U1.L2" });
    w.add_job({ lesson_id: "G6.U1.L3" });
    const change = await w.finalizer.after_job(w.run.run_id, w.outcome([brake]));
    expect(change?.to_state).toBe("capped");
    expect(w.runs.rows.get(w.run.run_id)?.capped_by).toBe(cap);
    expect(q1.status).toBe("cancelled");
    expect(q1.failure_reasons[0]?.check).toBe("capped");
    expect(w.runs.calls.filter((c) => c.startsWith("mark_capped"))).toEqual([`mark_capped:${cap}`]);
    expect(w.queue.log).toContain("cancel_run");
    expect(w.tx.commits).toBe(1);
  });
  it("capped_marks_and_cancels: rollback when cancel_run throws", async () => {
    const w = world();
    const q = w.add_job({ lesson_id: "G6.U1.L2" });
    w.queue.fail_next_cancel = true;
    await expect(w.finalizer.after_job(w.run.run_id, w.outcome(["spend_run_cap"]))).rejects.toThrow();
    expect(w.runs.rows.get(w.run.run_id)?.state).toBe("running");
    expect(w.runs.rows.get(w.run.run_id)?.capped_by).toBeNull();
    expect(q.status === "queued" || w.queue.jobs[0]?.status === "queued").toBe(true);
    expect(w.tx.rollbacks).toBe(1);
    expect(w.lines.filter((l) => l.event === "run.state_change")).toHaveLength(0);
  });
});

describe("completeness", () => {
  function clean() {
    const w = world();
    const a = w.add_job(done("G6.U1.L1", 1000));
    const b = w.add_job(done("G6.U1.L2", 1001));
    w.calls.add_completed(a.job_id, "lesson_draft");
    w.calls.add_completed(b.job_id, "lesson_draft");
    w.calls.totals_cost = new Decimal("0.0246");
    return { ...w, a, b };
  }
  it("completeness: clean run has no gaps and matching totals", async () => {
    const w = clean();
    const r = await w.finalizer.completeness(w.run.run_id);
    expect(r.terminal_jobs_without_calls).toEqual([]);
    expect(r.summary_matches_calls).toBe(true);
  });
  it("completeness: a job without a completed call is listed", async () => {
    const w = clean();
    w.calls.completed.delete(w.b.job_id);
    const r = await w.finalizer.completeness(w.run.run_id);
    expect(r.terminal_jobs_without_calls).toEqual([w.b.job_id]);
  });
  it("completeness: totals drifting by 0.01 flips summary_matches_calls", async () => {
    const w = clean();
    w.calls.totals_cost = w.calls.totals_cost.plus("0.01");
    expect((await w.finalizer.completeness(w.run.run_id)).summary_matches_calls).toBe(false);
  });
  it("completeness: capped refusal with zero cost and no call is not listed", async () => {
    const w = clean();
    w.add_job({
      lesson_id: "G6.U1.L3", status: "generation_failed", tile_state: "failed", cost_usd: new Decimal(0),
      failure_reasons: [{ check: "capped", message: "c" }], finished_at: new Date(1002),
    });
    expect((await w.finalizer.completeness(w.run.run_id)).terminal_jobs_without_calls).toEqual([]);
  });
});

describe("idempotent_after_job", () => {
  it("idempotent_after_job: second call on a finished run returns null", async () => {
    const w = world();
    w.add_job(done("G6.U1.L1", 1000));
    expect(await w.finalizer.after_job(w.run.run_id, w.outcome())).not.toBeNull();
    w.runs.rows.get(w.run.run_id)!.state = "complete";
    // complete -> derive gives complete again: no change
    expect(await w.finalizer.after_job(w.run.run_id, w.outcome())).toBeNull();
  });
  it.each(["capped", "cancelled"] as const)("idempotent_after_job: %s run returns null without writes", async (state) => {
    const w = world(state);
    w.add_job(done("G6.U1.L1", 1000));
    expect(await w.finalizer.after_job(w.run.run_id, w.outcome(["spend_run_cap"]))).toBeNull();
    expect(w.runs.calls).toEqual(["lock_for_update"]);
  });
});
