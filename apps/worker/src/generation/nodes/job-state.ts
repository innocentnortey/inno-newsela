import Decimal from "decimal.js";
import { InvariantViolation, type SpendRefused } from "@ls/core/errors";
import type { CompiledLesson } from "@ls/core/compile/compile-draft";
import type { CheckResult } from "@ls/core/checks/types";
import type { LessonJobState, BrakeName, ProviderErrorKind } from "@ls/core/pipeline/state";
import type { ClaimedJob, JobOutcome } from "@ls/core/ports/job-queue";
import type { RecordedCall } from "@ls/core/ports/model-call-log";
import type { RowContext } from "@ls/core/ports/outlines";
import type { StandardRow } from "@ls/core/ports/standards";
import type { UnitPlanEntryDraft } from "@ls/schema/unit-plan";
import type { Actor, Usd } from "@ls/core/ports/common";

export interface JobContext {
  readonly row_context: RowContext;
  readonly standards: readonly StandardRow[];
  /** the unit-plan entries near this lesson that the draft prompt used; repair reuses them */
  readonly plan_entries?: readonly UnitPlanEntryDraft[];
  /** every call of the job, in order (including checkpoint hits) */
  readonly calls: readonly RecordedCall[];
  /** the call whose output became the first full draft (draft, or the truncation retry) */
  readonly draft_call: RecordedCall | null;
  readonly draft_max_output_tokens: number;
  readonly effort: "low" | "medium" | "high" | null;
  /** latest model output to parse; null when no usable output */
  readonly raw_output: string | null;
  readonly provider_error: ProviderErrorKind | null;
}

export type JobState = LessonJobState<JobContext, CompiledLesson, CheckResult, ClaimedJob>;

export const SYSTEM_ACTOR: Actor = { user_id: null, name: "system", role: null, synthetic: false };

const FATAL: readonly BrakeName[] = ["spend_run_cap", "spend_day_cap", "spend_project_cap", "truncation_retry", "job_wall_clock", "cancelled"];

export function is_fatal(s: JobState): boolean {
  return s.brakes_fired.some((b) => FATAL.includes(b)) || (s.context?.provider_error ?? null) !== null;
}

export function sum_cost(calls: readonly RecordedCall[]): Usd {
  return calls.reduce<Usd>((acc, c) => acc.plus(c.cost_usd), new Decimal(0));
}

export function with_call(s: JobState, call: RecordedCall): JobState {
  if (s.context === null) throw new InvariantViolation("job_context_missing");
  const calls = [...s.context.calls, call];
  return {
    ...s,
    context: { ...s.context, calls },
    call_ids: [...s.call_ids, call.model_call_id],
    cost_usd: sum_cost(calls).toString(),
    rate_limit_retries: s.rate_limit_retries + call.retries,
  };
}

export function brake_for(e: SpendRefused): BrakeName {
  switch (e.refused_by) {
    case "run_cap": return "spend_run_cap";
    case "day_cap": return "spend_day_cap";
    case "project_cap": return "spend_project_cap";
  }
}

export function build_outcome(
  s: JobState,
  o: Pick<JobOutcome, "status" | "tile_state" | "failure_reasons" | "version_id">,
): JobOutcome {
  return {
    job_id: s.job.job_id,
    status: o.status,
    tile_state: o.tile_state,
    failure_reasons: o.failure_reasons,
    brakes_fired: [...s.brakes_fired],
    repairs: s.repair_rounds,
    truncation_retries: s.truncation_retries,
    retries: s.rate_limit_retries,
    calls_lost: 0,
    cost_usd: sum_cost(s.context?.calls ?? []),
    version_id: o.version_id,
  };
}

export function outcome_of(s: JobState): JobOutcome {
  if (s.outcome === null) throw new InvariantViolation("job_outcome_missing", { job_id: s.job.job_id });
  return s.outcome as JobOutcome;
}
