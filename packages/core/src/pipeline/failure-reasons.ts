import type {
  FailureCheck,
  FailureInput,
  FailureReasonRecord,
} from "./state.ts";

export const FAILURE_MESSAGES: Record<FailureCheck, string> = {
  cancelled: "This lesson was cancelled before it finished.",
  capped: "Generation stopped because a spending limit was reached.",
  timeout: "This lesson took too long to generate.",
  truncated: "The draft was cut off twice before it finished.",
  rate_limited: "The model service was too busy; retries ran out.",
  provider_error: "The model service returned an error.",
  compile_error: "The draft could not be turned into a lesson.",
  schema_invalid: "The draft did not match the lesson format.",
  check_failed: "The draft failed a required lesson check.",
};

export function failure_reasons_for(i: FailureInput): FailureReasonRecord[] {
  const out: FailureReasonRecord[] = [];
  const add = (
    check: FailureCheck,
    check_kind: FailureReasonRecord["check_kind"] = null,
  ): void => {
    if (out.some((r) => r.check === check)) return;
    out.push({ check, check_kind, message: FAILURE_MESSAGES[check] });
  };
  const b = i.brakes_fired;
  if (b.includes("cancelled")) add("cancelled");
  if (
    b.includes("spend_run_cap") ||
    b.includes("spend_day_cap") ||
    b.includes("spend_project_cap")
  ) {
    add("capped");
  }
  if (b.includes("job_wall_clock")) add("timeout");
  if (b.includes("truncation_retry")) add("truncated");
  const p = i.provider_error;
  if (p === "rate_limited" || p === "overloaded") add("rate_limited");
  else if (p === "timeout") add("timeout");
  else if (p !== null) add("provider_error");
  if (i.compile_error !== null) add("compile_error");
  if (!i.schema_valid) add("schema_invalid");
  if (i.first_failing_kind !== null) add("check_failed", i.first_failing_kind);
  return out;
}
