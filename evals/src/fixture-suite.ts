// NL-49: synthetic two-case suite for the runner and the CLI --fixture flag.
import Decimal from "decimal.js";
import type { CaseOutcome, EvalCase, EvalSuite, SuiteName } from "./types.ts";

export function make_fixture_suite(opts: { fail?: string[]; name?: SuiteName; model_calls?: { count: number } } = {}): EvalSuite {
  const fail = opts.fail ?? [];
  const cases: EvalCase[] = [1, 2].map((i) => ({
    case_id: `fx-${i}`, provenance: "synthetic", source: `SYN-fixture-${i}`, guards: "fixture", input_path: "n/a", expected: { ok: true },
  }));
  return {
    name: opts.name ?? "S1",
    cases: () => cases.map((c) => ({ ...c })),
    async score(c): Promise<CaseOutcome> {
      const passed = !fail.includes(c.case_id);
      return { case_id: c.case_id, passed, failure_category: passed ? null : "fixture_failure", actual: { ok: passed }, cost_usd: new Decimal(0) };
    },
  };
}
