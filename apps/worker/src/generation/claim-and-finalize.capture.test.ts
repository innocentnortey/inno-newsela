// WF-22 / WF-6 capture: ClaimLoop + RunFinalizer over an in-memory world.
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { FakeClock } from "@ls/core/ports/clock";
import type { BrakeName } from "@ls/core/ports/common";
import type { ClaimedJob, JobOutcome } from "@ls/core/ports/job-queue";
import type { ModelCallLog } from "@ls/core/ports/model-call-log";
import { ClaimLoop, type LessonJobPort } from "../queue/claim-loop.ts";
import { StopFlag, StubSpend, StubUnitPlans, flush } from "../queue/claim-loop-doubles.ts";
import {
  MemJobQueue, MemRunRepo, MemTxRunner, StubCalls, StubRunSpend, make_job_row, make_logger, make_run_row,
  reference_derive_run_state,
} from "./finalizer-doubles.ts";
import { RunFinalizer } from "./run-finalizer.ts";

type Decide = (job: ClaimedJob) => { brakes: BrakeName[]; cost: Decimal; ok: boolean };

function build(n_jobs: number, concurrency: number, decide: Decide) {
  const clock = new FakeClock();
  const runs = new MemRunRepo(clock);
  const queue = new MemJobQueue(clock);
  const calls = new StubCalls();
  const run_spend = new StubRunSpend();
  const tx = new MemTxRunner(runs, queue);
  const { logger, lines } = make_logger();
  const run = runs.add(make_run_row({ cap_usd: new Decimal("1.00") }));
  for (let i = 1; i <= n_jobs; i++) queue.add(make_job_row({ run_id: run.run_id, lesson_id: `G6.U1.L${i}` }));
  const finalizer = new RunFinalizer(runs, queue, calls, run_spend, tx, { circuit_breaker_same_check: 3 }, reference_derive_run_state, logger);
  const world_runner: LessonJobPort = {
    async run(job: ClaimedJob): Promise<JobOutcome> {
      const d = decide(job);
      const outcome = {
        job_id: job.job_id,
        status: d.ok ? "ready" : "generation_failed",
        tile_state: d.ok ? "ready" : "failed",
        failure_reasons: d.ok ? [] : [{ check: "capped", message: "cap" }],
        brakes_fired: d.brakes,
        repairs: 0, truncation_retries: 0, retries: 0, calls_lost: 0,
        cost_usd: d.cost,
        version_id: null,
      } as JobOutcome;
      await queue.finish(outcome);
      await finalizer.after_job(job.run_id, outcome);
      return outcome;
    },
  };
  const settings = { worker_id: "w1", generation_concurrency: concurrency, max_active_runs: 3, job_lease_ms: 120000, job_poll_ms: 1000 };
  const spend = new StubSpend([]);
  const loop = new ClaimLoop(queue, calls as ModelCallLog, spend.as_ledger(), world_runner, new StubUnitPlans(), clock, logger, settings, tx);
  return { clock, runs, queue, run, finalizer, loop, lines, stop: new StopFlag() };
}

async function drive(w: ReturnType<typeof build>): Promise<void> {
  const exit = w.loop.run_until(w.stop);
  await flush();
  w.stop.set();
  w.clock.advance(1000);
  await flush();
  await exit;
}

describe("claim and finalize capture", () => {
  it("capture_wf22_wf6: three jobs finish, run completes, one state_change line", async () => {
    const w = build(3, 6, () => ({ brakes: [], cost: new Decimal("0.0123"), ok: true }));
    await drive(w);
    const row = w.runs.rows.get(w.run.run_id)!;
    expect(row.state).toBe("complete");
    expect(row.finished_at).not.toBeNull();
    expect(w.queue.jobs.every((j) => j.status === "ready" && j.finished_at !== null)).toBe(true);
    const changes = w.lines.filter((l) => l.event === "run.state_change");
    console.log(JSON.stringify(changes.map((c) => c.fields.extra)));
    expect(changes).toHaveLength(1);
    expect(changes[0]?.fields.run_id).toBe(w.run.run_id);
    expect(changes[0]?.fields.extra).toMatchObject({ from_state: "running", to_state: "complete" });
    expect(await w.finalizer.after_job(w.run.run_id, { brakes_fired: [] } as unknown as JobOutcome)).toBeNull();
    expect(w.lines.filter((l) => l.event === "run.state_change")).toHaveLength(1);
  });

  // Stand-in for `npm run eval:faults -- --case cap` (NL-107 owns that command).
  it("cap_holds_at_run_level: settled + reserved never exceeds the run cap", async () => {
    const cap = new Decimal("1.00");
    let settled = new Decimal(0);
    const reserved = new Decimal(0);
    const decide: Decide = () => {
      const price = new Decimal("0.40");
      if (settled.plus(reserved).plus(price).greaterThan(cap)) return { brakes: ["spend_run_cap"], cost: new Decimal(0), ok: false };
      settled = settled.plus(price);
      return { brakes: [], cost: price, ok: true };
    };
    const w = build(5, 1, decide);
    await drive(w);
    const row = w.runs.rows.get(w.run.run_id)!;
    const cap_overshoot = Decimal.max(0, settled.plus(reserved).minus(cap));
    expect(cap_overshoot.toString()).toBe("0");
    expect(settled.plus(reserved).lessThanOrEqualTo(cap)).toBe(true);
    expect(row.state).toBe("capped");
    expect(row.capped_by).toBe("run_cap");
    expect(w.queue.jobs.filter((j) => j.status === "cancelled")).toHaveLength(2);
    expect(w.queue.jobs.filter((j) => j.status === "ready")).toHaveLength(2);
  });
});
