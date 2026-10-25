import { LeaseLost } from "@ls/core/errors";
import { route_after_checks } from "@ls/core/pipeline/route-after-checks";
import { initial_state, wall_clock_exceeded, with_brake } from "@ls/core/pipeline/state";
import type { Clock } from "@ls/core/ports/clock";
import type { ClaimedJob, JobOutcome, JobQueue } from "@ls/core/ports/job-queue";
import type { WorkerSettings } from "@ls/config/settings";
import type { CompileCheckNode } from "./nodes/compile-check-node.ts";
import type { RunFinalizerPort } from "./nodes/collaborators.ts";
import type { DraftNode } from "./nodes/draft-node.ts";
import type { FailNode } from "./nodes/fail-node.ts";
import { is_fatal, outcome_of, type JobState } from "./nodes/job-state.ts";
import type { RepairNode } from "./nodes/repair-node.ts";
import type { StoreNode } from "./nodes/store-node.ts";

export class LessonJobRunner {
  constructor(
    private readonly draft: DraftNode,
    private readonly compile_check: CompileCheckNode,
    private readonly repair: RepairNode,
    private readonly store: StoreNode,
    private readonly fail: FailNode,
    private readonly queue: JobQueue,
    private readonly finalizer: RunFinalizerPort,
    private readonly clock: Clock,
    private readonly settings: WorkerSettings,
  ) {}

  /** Only LeaseLost propagates; after it nothing is written and the job is left to requeue_expired. */
  async run(job: ClaimedJob): Promise<JobOutcome> {
    let s = initial_state(job, this.clock.now().getTime()) as JobState;
    const id = job.job_id;

    const lease = async (): Promise<void> => {
      if (!(await this.queue.renew_lease(id, this.settings.job_lease_ms))) throw new LeaseLost({ job_id: id });
    };
    // Before every node but fail: lease, cancel, wall clock. True when a brake fired (go to fail, no further call).
    const gate = async (): Promise<boolean> => {
      await lease();
      if (await this.queue.is_cancelled(id)) s = with_brake(s, "cancelled");
      if (wall_clock_exceeded(s, this.clock.now().getTime(), this.settings.job_wall_clock_ms)) s = with_brake(s, "job_wall_clock");
      return s.brakes_fired.includes("cancelled") || s.brakes_fired.includes("job_wall_clock");
    };

    let stored = false;
    flow: {
      if (await gate()) break flow;
      await this.queue.set_tile_state(id, "drafting");
      s = await this.draft.run(s);
      if (is_fatal(s)) break flow;
      for (;;) {
        if (await gate()) break flow;
        await this.queue.set_tile_state(id, "checking");
        s = await this.compile_check.run(s);
        const next = route_after_checks({
          schema_valid: s.draft !== null,
          compiled: s.compiled !== null,
          check_passed: s.check_result !== null && s.check_result.blocking === 0,
          repair_rounds: s.repair_rounds,
          max_repair_rounds: 1,
        });
        if (next === "store") {
          if (await gate()) break flow;
          s = await this.store.run(s);
          stored = true;
          break flow;
        }
        if (next === "fail") break flow;
        if (await gate()) break flow;
        await this.queue.set_tile_state(id, "repairing");
        s = await this.repair.run(s);
        if (is_fatal(s)) break flow;
      }
    }
    if (!stored) {
      if (s.repair_rounds >= 1 && !is_fatal(s)) s = with_brake(s, "repair_round");
      await lease();
      s = await this.fail.run(s);
    }
    const outcome = outcome_of(s);
    await this.queue.finish(outcome);
    await this.finalizer.after_job(job.run_id, outcome);
    return outcome;
  }
}
