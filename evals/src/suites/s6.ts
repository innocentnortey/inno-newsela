// NL-107: S6 long-job faults (HP-7): kill, 429, truncation and cap on the stub provider, over the real worker runtime.
// The scenarios live in evals/src/suites/s6-scenarios.ts (A20); this module is the suite adapter the runner stores and reports.
import Decimal from "decimal.js";
import { InvariantViolation } from "@ls/core/errors";
import type { JsonValue } from "@ls/core/ports/common";
import { SCENARIOS, type ScenarioId } from "./s6-scenarios.ts";
import type { CaseOutcome, EvalCase, EvalSuite, ProviderMode } from "../types.ts";

const SOURCE = "HP-7";
const INPUT = "evals/src/suites/s6-scenarios.ts";

const CASES: Record<ScenarioId, { guards: string; expected: JsonValue }> = {
  kill: {
    guards: "SIGKILL after at least 10 stored lessons and a restart: 47 of 47 lessons ready, 0 duplicate lesson versions, 0 re-paid calls, lost calls counted equal the calls in flight at the kill",
    expected: { lessons: 47, ready: 47, duplicates_found: 0, repaid_calls: 0, lost_calls_counted_equal_in_flight: true },
  },
  rate_limit: {
    guards: "the first 8 model calls are answered rate_limited once: all 47 lessons ready, none lost to rate_limited, the retries are recorded on the call rows",
    expected: { lessons: 47, ready: 47, lost_to_rate_limit: 0, calls_with_retries: 8 },
  },
  truncation: {
    guards: "a lesson stopped at max_tokens gets exactly one retry at the raised cap (32000 then 48000); stopped twice it ends generation_failed with reason truncated and no third call",
    expected: { once: { model_call_rows: 2, max_output_tokens: [32000, 48000], lesson_status: "ready" }, twice: { model_call_rows: 2, lesson_status: "generation_failed", failure_reason: "truncated" } },
  },
  cap: {
    guards: "with the run cap below the healthy cost: settled spend at most the cap, run state capped, unstarted lessons made no call, nothing left reserved, a lesson capped mid-way is not paid",
    expected: { settled_within_cap: true, run_state: "capped", reserved_open: 0, paid_for_capped_jobs: 0 },
  },
};

/** `only` limits the cases (test_fault_script_records runs the cap case alone); the default is all four. */
export function make_s6(provider_mode: ProviderMode, only?: readonly ScenarioId[]): EvalSuite {
  const refuse = (): never => {
    throw new InvariantViolation("S6 runs on the stub provider only", {});
  };
  return {
    name: "S6",
    cases(): EvalCase[] {
      if (provider_mode === "real") refuse();
      return (Object.keys(CASES) as ScenarioId[])
        .filter((id) => only === undefined || only.includes(id))
        .map((id) => ({ case_id: id, provenance: "synthetic", source: SOURCE, guards: CASES[id].guards, input_path: INPUT, expected: CASES[id].expected }));
    },
    async score(c, opts): Promise<CaseOutcome> {
      if (opts.provider_mode === "real" || provider_mode === "real") refuse();
      const run = SCENARIOS[c.case_id as ScenarioId];
      if (run === undefined) throw new InvariantViolation("unknown S6 case", { case_id: c.case_id });
      const r = await run();
      return { case_id: c.case_id, passed: r.passed, failure_category: r.failure_category, actual: r.actual, cost_usd: new Decimal(0) };
    },
  };
}
