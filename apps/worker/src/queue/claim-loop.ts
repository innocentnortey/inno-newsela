import Decimal from "decimal.js";
import type { Clock } from "@ls/core/ports/clock";
import type { JobId, RunId } from "@ls/core/ports/common";
import { InvariantViolation, LeaseLost } from "@ls/core/errors";
import type { ClaimedJob, JobOutcome, JobQueue } from "@ls/core/ports/job-queue";
import type { ModelCallLog } from "@ls/core/ports/model-call-log";
import type { SpendLedger } from "@ls/core/ports/spend";
import type { TxRunner } from "@ls/core/ports/tx";
import type { WorkerSettings } from "@ls/config/settings";
import type { Logger } from "@ls/obs/logger";
import type { FailureReason } from "@ls/schema/api/runs";

// Same rule as packages/llm recorder.safe_reason (the lint rule keeps the worker queue off the recorder import):
// a `safe_reason` an error carries, else the class name; never the message.
function safe_reason(e: unknown): string {
  if (typeof e === "object" && e !== null && typeof (e as { safe_reason?: unknown }).safe_reason === "string") return (e as { safe_reason: string }).safe_reason;
  return e instanceof Error ? e.name : "unknown";
}

export const LEASE_RENEW_MS = 30000;

export interface TickReport {
  claimed: number;
  in_flight: number;
  requeued_at_start: number;
  lost_calls_marked: number;
  reservations_released: number;
}
export interface LoopExit {
  reason: "sigterm" | "fatal";
  drained_jobs: number;
  abandoned_jobs: number;
}
export interface StopSignal {
  is_set(): boolean;
}

// Narrow structural ports: NL-29's LessonJobRunner and NL-31's UnitPlanJob satisfy them.
export interface LessonJobPort {
  run(job: ClaimedJob, signal?: AbortSignal): Promise<JobOutcome>;
}
export interface UnitPlanOutcomeView {
  run_id: RunId;
  stored: boolean;
  entries: number;
  model_call_id: string | null;
  failure: FailureReason | null;
}
export interface UnitPlanJobPort {
  run(job: ClaimedJob, signal?: AbortSignal): Promise<UnitPlanOutcomeView>;
}

type LoopSettings = Pick<
  WorkerSettings,
  "worker_id" | "generation_concurrency" | "max_active_runs" | "job_lease_ms" | "job_poll_ms"
>;

function plan_outcome(job: ClaimedJob, out: UnitPlanOutcomeView): JobOutcome {
  const common = {
    job_id: job.job_id,
    brakes_fired: [],
    repairs: 0,
    truncation_retries: 0,
    retries: 0,
    calls_lost: 0,
    cost_usd: new Decimal(0),
    version_id: null,
  };
  if (out.stored) return { ...common, status: "ready", tile_state: "ready", failure_reasons: [] };
  if (out.failure) {
    return { ...common, status: "generation_failed", tile_state: "failed", failure_reasons: [out.failure] };
  }
  throw new InvariantViolation("unit_plan outcome neither stored nor failed", { job_id: job.job_id });
}

export class ClaimLoop {
  constructor(
    private readonly queue: JobQueue,
    private readonly calls: ModelCallLog,
    private readonly spend: SpendLedger,
    private readonly runner: LessonJobPort,
    private readonly unit_plans: UnitPlanJobPort,
    private readonly clock: Clock,
    private readonly logger: Logger,
    private readonly settings: LoopSettings,
    private readonly tx: TxRunner,
  ) {}

  // Clean up orphaned work before any claim (G-9). Never claims.
  async start(): Promise<TickReport> {
    const rep = await this.queue.requeue_expired(this.clock.now());
    let lost = 0;
    let released = 0;
    if (rep.job_ids.length > 0) {
      for (const id of rep.job_ids) lost += await this.calls.mark_lost(id);
      released = await this.spend.release_for_jobs(rep.job_ids);
    }
    this.logger.info("claim_loop.start", {
      extra: { requeued: rep.requeued, lost_calls_marked: lost, reservations_released: released },
    });
    return {
      claimed: 0,
      in_flight: 0,
      requeued_at_start: rep.requeued,
      lost_calls_marked: lost,
      reservations_released: released,
    };
  }

  async run_until(stop: StopSignal): Promise<LoopExit> {
    const inflight = new Map<JobId, Promise<void>>();
    const finished_normally = new Set<JobId>();
    let abandoned = 0;
    let fatal = false;

    const execute = async (job: ClaimedJob): Promise<void> => {
      const ctl = new AbortController();
      let lost = false;
      let done = false;
      let release_done: () => void = () => {};
      const done_promise = new Promise<void>((r) => {
        release_done = r;
      });

      const renew = async (): Promise<void> => {
        while (!done) {
          await Promise.race([this.clock.sleep(LEASE_RENEW_MS), done_promise]);
          if (done) break;
          let ok: boolean;
          try {
            ok = await this.queue.renew_lease(job.job_id, this.settings.job_lease_ms);
          } catch {
            this.logger.error("claim_loop.renew_failed", { job_id: job.job_id });
            continue;
          }
          if (!ok) {
            lost = true;
            ctl.abort(new LeaseLost({ job_id: job.job_id }));
            this.logger.warn("claim_loop.lease_lost", { run_id: job.run_id, job_id: job.job_id });
            break;
          }
        }
      };
      void renew();

      try {
        if (job.kind === "unit_plan") {
          const out = await this.unit_plans.run(job, ctl.signal);
          if (lost) {
            abandoned += 1;
            return;
          }
          await this.queue.finish(plan_outcome(job, out));
          if (out.failure?.check === "capped") {
            await this.tx.with_tx((t) => this.queue.cancel_run(job.run_id, "capped", t));
          }
        } else {
          await this.runner.run(job, ctl.signal);
          if (lost) {
            abandoned += 1;
            return;
          }
        }
        finished_normally.add(job.job_id);
      } catch (err) {
        if (err instanceof InvariantViolation) {
          this.logger.error("claim_loop.fatal", {
            run_id: job.run_id,
            job_id: job.job_id,
            extra: { invariant: err.invariant },
          });
          fatal = true;
        } else if (err instanceof LeaseLost || lost) {
          abandoned += 1;
        } else {
          this.logger.error("claim_loop.job_failed", {
            run_id: job.run_id,
            job_id: job.job_id,
            extra: { name: err instanceof Error ? err.name : "unknown", reason: safe_reason(err) },
          });
          abandoned += 1;
        }
      } finally {
        done = true;
        release_done();
        inflight.delete(job.job_id);
      }
    };

    while (!stop.is_set() && !fatal) {
      if (inflight.size >= this.settings.generation_concurrency) {
        await Promise.race([...inflight.values(), this.clock.sleep(this.settings.job_poll_ms)]);
        continue;
      }
      let job: ClaimedJob | null;
      try {
        job = await this.queue.claim(this.settings.worker_id, this.settings.max_active_runs, this.settings.job_lease_ms);
      } catch (err) {
        this.logger.error("claim_loop.claim_failed", { extra: { name: err instanceof Error ? err.name : "unknown" } });
        await this.clock.sleep(this.settings.job_poll_ms);
        continue;
      }
      if (job === null) {
        await this.clock.sleep(this.settings.job_poll_ms);
        continue;
      }
      const claimed = job;
      // registered before execute starts, so a synchronous failure cannot delete first
      inflight.set(claimed.job_id, Promise.resolve().then(() => execute(claimed)));
    }

    const draining = [...inflight.keys()];
    await Promise.allSettled([...inflight.values()]);
    const drained = draining.filter((id) => finished_normally.has(id)).length;
    return { reason: fatal ? "fatal" : "sigterm", drained_jobs: drained, abandoned_jobs: abandoned };
  }
}
