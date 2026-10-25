import type { LessonDraft } from "@ls/schema/lesson-draft";
import type { Issue } from "@ls/schema/api/lessons";
import type { FailureReason } from "@ls/schema/api/runs";

/** Documented default (settings `job_wall_clock_ms`); callers pass the real limit. */
export const JOB_WALL_CLOCK_MS = 600000;

export type CheckKind = Issue["kind"];
export type FailureCheck = FailureReason["check"];

export type BrakeName =
  | "repair_round"
  | "rate_limit_retries"
  | "truncation_retry"
  | "job_wall_clock"
  | "spend_run_cap"
  | "spend_day_cap"
  | "spend_project_cap"
  | "circuit_breaker"
  | "cancelled";

export type ProviderErrorKind =
  | "rate_limited"
  | "overloaded"
  | "server_error"
  | "timeout"
  | "connection"
  | "bad_request"
  | "auth"
  | "refusal";

export type NextStep = "store" | "repair" | "fail";

export interface RouteInput {
  schema_valid: boolean;
  compiled: boolean;
  check_passed: boolean;
  repair_rounds: number;
  max_repair_rounds: number;
}

export interface FailureInput {
  brakes_fired: readonly BrakeName[];
  provider_error: ProviderErrorKind | null;
  schema_valid: boolean;
  compile_error: string | null;
  first_failing_kind: CheckKind | null;
}

export interface FailureReasonRecord {
  check: FailureCheck;
  check_kind: CheckKind | null;
  message: string;
}

export interface LessonJobState<
  Ctx = unknown,
  Compiled = unknown,
  Checked = unknown,
  Job extends { unit_id: string } = { unit_id: string },
> {
  readonly job: Job;
  readonly context: Ctx | null;
  readonly draft_call: unknown | null;
  readonly call_ids: readonly string[];
  readonly draft: LessonDraft | null;
  readonly schema_issues: readonly string[];
  readonly compiled: Compiled | null;
  readonly compile_error: string | null;
  readonly check_result: Checked | null;
  readonly repair_rounds: number;
  readonly truncation_retries: number;
  readonly rate_limit_retries: number;
  readonly brakes_fired: readonly BrakeName[];
  /** epoch ms, passed in */
  readonly started_at: number;
  /** decimal string (documented simplification; no Decimal lib in core) */
  readonly cost_usd: string;
  readonly outcome: unknown | null;
}

export function initial_state<Job extends { unit_id: string }>(
  job: Job,
  now: number,
): LessonJobState<unknown, unknown, unknown, Job> {
  return {
    job,
    context: null,
    draft_call: null,
    call_ids: [],
    draft: null,
    schema_issues: [],
    compiled: null,
    compile_error: null,
    check_result: null,
    repair_rounds: 0,
    truncation_retries: 0,
    rate_limit_retries: 0,
    brakes_fired: [],
    started_at: now,
    cost_usd: "0",
    outcome: null,
  };
}

export function with_brake<S extends { brakes_fired: readonly BrakeName[] }>(
  s: S,
  brake: BrakeName,
): S {
  if (s.brakes_fired.includes(brake)) return s;
  return { ...s, brakes_fired: [...s.brakes_fired, brake] };
}

export function wall_clock_exceeded(
  s: { started_at: number },
  now: number,
  limit_ms: number,
): boolean {
  return now - s.started_at > limit_ms;
}
