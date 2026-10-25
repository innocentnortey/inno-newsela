import type { BrakeName, CapName, JobId, JobKind, JobStatus, RunId, RunStateName } from "@ls/core/ports/common";
import type { JobOutcome, JobQueue } from "@ls/core/ports/job-queue";
import type { ModelCallLog } from "@ls/core/ports/model-call-log";
import type { RunRepo } from "@ls/core/ports/runs";
import type { TxRunner } from "@ls/core/ports/tx";
import { should_pause_run, type TerminalJobView } from "@ls/core/pipeline/circuit-breaker";
import type { CheckKind } from "@ls/core/pipeline/state";
import type { WorkerSettings } from "@ls/config/settings";
import type { Logger } from "@ls/obs/logger";
import type { TileState } from "@ls/schema/api/runs";

export interface RunStateChange {
  run_id: RunId;
  from_state: RunStateName;
  to_state: RunStateName;
  paused_check: string | null;
}

export interface CompletenessReport {
  run_id: RunId;
  terminal_jobs_without_calls: JobId[];
  summary_matches_calls: boolean;
}

// Same shapes as DO-4 section 8 (NL-27 owns the real derive_run_state; it is injected).
export interface JobStatusView {
  status: JobStatus;
  tile_state: TileState;
  kind: JobKind;
  failure_check: string | null;
}
export interface RunStateInput {
  current: RunStateName;
  plan_stored: boolean;
  cancelled: boolean;
  capped: boolean;
  paused: boolean;
}
export type DeriveRunState = (jobs: readonly JobStatusView[], run: RunStateInput) => RunStateName;

type FinalizerSettings = Pick<WorkerSettings, "circuit_breaker_same_check">;

const CAP_ORDER: readonly [BrakeName, CapName][] = [
  ["spend_run_cap", "run_cap"],
  ["spend_day_cap", "day_cap"],
  ["spend_project_cap", "project_cap"],
];

function cap_of(brakes: readonly BrakeName[]): CapName | null {
  for (const [brake, cap] of CAP_ORDER) if (brakes.includes(brake)) return cap;
  return null;
}

export class RunFinalizer {
  constructor(
    private readonly runs: RunRepo,
    private readonly queue: JobQueue,
    private readonly calls: ModelCallLog,
    private readonly tx: TxRunner,
    private readonly settings: FinalizerSettings,
    private readonly derive_run_state: DeriveRunState,
    private readonly logger: Logger,
  ) {}

  async after_job(run_id: RunId, outcome: JobOutcome): Promise<RunStateChange | null> {
    const change = await this.tx.with_tx(async (t): Promise<RunStateChange | null> => {
      const run = await this.runs.lock_for_update(run_id, t);
      if (run.state === "cancelled" || run.state === "capped") return null;

      const cap = cap_of(outcome.brakes_fired);
      if (cap !== null) {
        await this.runs.mark_capped(run_id, cap, t);
        await this.queue.cancel_run(run_id, "capped", t);
        return { run_id, from_state: run.state, to_state: "capped", paused_check: null };
      }

      const jobs = await this.queue.jobs_for_run(run_id);

      if (run.state === "running") {
        const views: TerminalJobView[] = [];
        for (const j of jobs) {
          if (j.kind !== "lesson" || j.lesson_id === null || j.finished_at === null) continue;
          const failing = j.failure_reasons.find((r) => r.check === "check_failed");
          views.push({
            lesson_id: j.lesson_id,
            status: j.status,
            first_failing_kind: (failing?.check_kind ?? null) as CheckKind | null,
            finished_at: j.finished_at.getTime(),
          });
        }
        const d = should_pause_run(views, this.settings.circuit_breaker_same_check);
        if (d.pause) {
          await this.runs.set_state(run_id, "paused", d.check, t);
          return { run_id, from_state: run.state, to_state: "paused", paused_check: d.check };
        }
      }

      const status_views: JobStatusView[] = jobs.map((j) => ({
        status: j.status,
        tile_state: j.tile_state,
        kind: j.kind,
        failure_check: j.failure_reasons[0]?.check ?? null,
      }));
      const next = this.derive_run_state(status_views, {
        current: run.state,
        plan_stored: run.plan_stored_at !== null,
        cancelled: false,
        capped: false,
        paused: run.state === "paused",
      });
      if (next === run.state) return null;
      await this.runs.set_state(run_id, next, null, t);
      return { run_id, from_state: run.state, to_state: next, paused_check: null };
    });

    if (change === null) return null;
    if (change.to_state === "complete" || change.to_state === "partial" || change.to_state === "capped") {
      try {
        const report = await this.completeness(run_id);
        if (report.terminal_jobs_without_calls.length > 0 || !report.summary_matches_calls) {
          this.logger.warn("run.incomplete", { run_id, extra: report });
        }
      } catch {
        this.logger.error("run.completeness_failed", { run_id });
      }
    }
    this.logger.info("run.state_change", {
      run_id,
      extra: { from_state: change.from_state, to_state: change.to_state, paused_check: change.paused_check },
    });
    return change;
  }

  // Interim rule via completed_for; a job_ids_with_calls query on ModelCallLog is requested (NL-33).
  async completeness(run_id: RunId): Promise<CompletenessReport> {
    const jobs = await this.queue.jobs_for_run(run_id);
    const missing: JobId[] = [];
    for (const j of jobs) {
      if (j.status !== "ready" && j.status !== "generation_failed") continue;
      if (j.status === "generation_failed" && j.cost_usd.isZero()) {
        const refused =
          j.failure_reasons.length > 0 &&
          j.failure_reasons.every((r) => r.check === "capped" || r.check === "cancelled");
        if (refused || j.calls_lost === 0) continue;
      }
      let found = false;
      if (j.kind === "unit_plan") {
        found = (await this.calls.completed_for(j.job_id, "unit_plan", 1)) !== null;
      } else {
        for (const purpose of ["lesson_draft", "truncation_retry", "repair"] as const) {
          if ((await this.calls.completed_for(j.job_id, purpose, 1)) !== null) {
            found = true;
            break;
          }
        }
      }
      if (!found) missing.push(j.job_id);
    }
    const totals = await this.calls.totals_for_run(run_id);
    const summary = jobs.reduce((acc, j) => acc.plus(j.cost_usd), totals.cost_usd.times(0));
    return { run_id, terminal_jobs_without_calls: missing, summary_matches_calls: summary.equals(totals.cost_usd) };
  }
}
