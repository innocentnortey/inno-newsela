import { describe, expect, it } from "vitest";
import { FakeClock } from "@ls/core/ports/clock";
import { InvariantViolation, LeaseLost } from "@ls/core/errors";
import type { ModelCallLog } from "@ls/core/ports/model-call-log";
import { MemJobQueue, MemRunRepo, MemTxRunner, StubCalls, make_job_row, make_logger } from "../generation/finalizer-doubles.ts";
import { ClaimLoop, LEASE_RENEW_MS, type UnitPlanOutcomeView } from "./claim-loop.ts";
import { ControllableRunner, StopFlag, StubSpend, StubUnitPlans, flush } from "./claim-loop-doubles.ts";

const settings = { worker_id: "w1", generation_concurrency: 6, max_active_runs: 3, job_lease_ms: 120000, job_poll_ms: 1000 };

function world(n_jobs = 0, kind: "lesson" | "unit_plan" = "lesson") {
  const clock = new FakeClock();
  const call_log: string[] = [];
  const queue = new MemJobQueue(clock);
  queue.shared_log = call_log;
  const calls = new StubCalls();
  calls.shared_log = call_log;
  const spend = new StubSpend(call_log);
  const runner = new ControllableRunner();
  const plans = new StubUnitPlans();
  const runs = new MemRunRepo(clock);
  const tx = new MemTxRunner(runs, queue);
  const { logger, lines } = make_logger();
  const jobs = Array.from({ length: n_jobs }, (_, i) => queue.add(make_job_row({ run_id: "run_a", kind, lesson_id: kind === "lesson" ? `G6.U1.L${i + 1}` : null })));
  const loop = new ClaimLoop(queue, calls as ModelCallLog, spend.as_ledger(), runner, plans, clock, logger, settings, tx);
  return { clock, call_log, queue, calls, spend, runner, plans, tx, lines, jobs, loop, stop: new StopFlag() };
}

describe("ClaimLoop", () => {
  it("concurrency_cap_six: never more than six runners at once", async () => {
    const w = world(12);
    const exit = w.loop.run_until(w.stop);
    await flush();
    expect(w.runner.started).toHaveLength(6);
    expect(w.runner.peak).toBe(6);
    w.runner.release(w.runner.started[0]!);
    await flush();
    expect(w.runner.started).toHaveLength(7);
    for (let i = 0; i < 6; i++) {
      w.runner.release_all();
      await flush();
    }
    expect(w.runner.peak).toBe(6);
    w.stop.set();
    w.clock.advance(1000);
    w.runner.release_all();
    await flush();
    expect((await exit).reason).toBe("sigterm");
    expect(w.runner.started).toHaveLength(12);
  });

  it("start_requeues_marks_releases: order requeue, mark_lost, release, then claim", async () => {
    const w = world(1);
    w.queue.requeue_ids = ["job_a", "job_b"];
    w.spend.released = 2;
    const report = await w.loop.start();
    expect(report).toMatchObject({ requeued_at_start: 2, lost_calls_marked: 2, reservations_released: 2, claimed: 0 });
    expect(w.call_log).toEqual(["requeue_expired", "mark_lost", "mark_lost", "release_for_jobs"]);
    const exit = w.loop.run_until(w.stop);
    await flush();
    expect(w.call_log.indexOf("claim")).toBeGreaterThan(w.call_log.indexOf("release_for_jobs"));
    w.stop.set();
    w.clock.advance(1000);
    w.runner.release_all();
    await flush();
    await exit;
  });

  it("lease_renewal_and_loss: renews every 30 s and aborts a job whose lease is lost", async () => {
    const w = world(2);
    const [first, second] = w.jobs;
    w.queue.renew_results.set(first!.job_id, [true, false]);
    const exit = w.loop.run_until(w.stop);
    await flush();
    expect(w.runner.started).toHaveLength(2);
    const t0 = w.clock.now().getTime();
    w.clock.advance(LEASE_RENEW_MS);
    await flush();
    expect(w.queue.renew_times.filter((t) => t === t0 + LEASE_RENEW_MS)).toHaveLength(2);
    w.clock.advance(LEASE_RENEW_MS);
    await flush();
    const sig = w.runner.signals.get(first!.job_id);
    expect(sig?.aborted).toBe(true);
    expect(sig?.reason).toBeInstanceOf(LeaseLost);
    expect(w.runner.signals.get(second!.job_id)?.aborted).toBe(false);
    expect(w.queue.log).not.toContain("finish");
    expect(w.queue.renew_times.filter((t) => t === t0 + 2 * LEASE_RENEW_MS).length).toBeGreaterThan(0);
    w.stop.set();
    w.clock.advance(1000);
    w.runner.release_all();
    await flush();
    const result = await exit;
    expect(result.abandoned_jobs).toBe(1);
    expect(result.drained_jobs).toBe(1);
  });

  it("sigterm_drains: stops claiming, waits for in-flight jobs", async () => {
    const w = world(2);
    const exit = w.loop.run_until(w.stop);
    await flush();
    w.stop.set();
    const claims_before = w.queue.log.filter((x) => x === "claim").length;
    w.clock.advance(1000);
    await flush();
    expect(w.queue.log.filter((x) => x === "claim").length).toBe(claims_before);
    let settled = false;
    void exit.then(() => {
      settled = true;
    });
    await flush();
    expect(settled).toBe(false);
    w.runner.release_all();
    await flush();
    expect(await exit).toEqual({ reason: "sigterm", drained_jobs: 2, abandoned_jobs: 0 });
  });

  describe("unit_plan_job_routing", () => {
    async function drive(next: UnitPlanOutcomeView) {
      const w = world(1, "unit_plan");
      w.plans.next = next;
      const exit = w.loop.run_until(w.stop);
      await flush();
      w.stop.set();
      w.clock.advance(1000);
      await flush();
      await exit;
      return w;
    }
    const base = { run_id: "run_a", entries: 0, model_call_id: null };
    it("unit_plan_job_routing: stored -> ready", async () => {
      const w = await drive({ ...base, stored: true, failure: null });
      expect(w.queue.jobs[0]?.status).toBe("ready");
      expect(w.queue.cancel_calls).toHaveLength(0);
    });
    it("unit_plan_job_routing: failure -> generation_failed, no cancel", async () => {
      const w = await drive({ ...base, stored: false, failure: { check: "schema_invalid", message: "bad" } });
      expect(w.queue.jobs[0]?.status).toBe("generation_failed");
      expect(w.queue.jobs[0]?.failure_reasons[0]?.check).toBe("schema_invalid");
      expect(w.queue.cancel_calls).toHaveLength(0);
    });
    it("unit_plan_job_routing: capped -> finish then cancel_run in a tx", async () => {
      const w = await drive({ ...base, stored: false, failure: { check: "capped", message: "cap" } });
      expect(w.queue.log.filter((x) => x === "finish" || x === "cancel_run")).toEqual(["finish", "cancel_run"]);
      expect(w.queue.cancel_calls[0]).toMatchObject({ run_id: "run_a", reason: "capped" });
      expect(w.tx.commits).toBe(1);
    });
  });

  it("invariant_violation_is_fatal: exits fatal and stops claiming", async () => {
    const w = world(40);
    w.runner.throw_on_start = new InvariantViolation("x");
    const exit = await w.loop.run_until(w.stop);
    expect(exit.reason).toBe("fatal");
    expect(w.lines.some((l) => l.level === "error" && l.event === "claim_loop.fatal")).toBe(true);
    expect(w.queue.log.filter((x) => x === "claim").length).toBeLessThan(40);
  });

  it("job_failed_logs_safe_reason: a plain Error logs its class name, never its message", async () => {
    const w = world(1);
    w.runner.throw_on_start = new Error("secret sk-ant-abc");
    const exit = w.loop.run_until(w.stop);
    await flush();
    w.stop.set();
    w.clock.advance(1000);
    await flush();
    await exit;
    const line = w.lines.find((l) => l.event === "claim_loop.job_failed");
    expect(line?.fields.extra).toMatchObject({ name: "Error", reason: "Error" });
    expect(JSON.stringify(w.lines)).not.toContain("sk-ant");
  });
});
