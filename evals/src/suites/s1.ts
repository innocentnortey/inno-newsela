// NL-84: S1 intake golden. Model-free: normalizer + standards index + report on committed grids; expected fields compared exactly.
import path from "node:path";
import Decimal from "decimal.js";
import type { JsonValue } from "@ls/core/ports/common";
import type { NormalizedOutline } from "@ls/schema/outline";
import type { CaseOutcome, EvalSuite, ProviderMode } from "../types.ts";
import { type CaseFile, load_cases } from "./case-files.ts";
import { build_report, canonical, grid_for, is_intake_error, load_issued_outline, project, run_normalizer, stripped_view } from "./s1-support.ts";

export interface S1Options {
  cases?: CaseFile[];
  mutate?: (o: NormalizedOutline) => NormalizedOutline;
}

export function make_s1(_provider_mode: ProviderMode, options: S1Options = {}): EvalSuite {
  const cases = (): CaseFile[] => options.cases ?? load_cases(path.join(import.meta.dirname, "../../cases/s1"), "evals/cases/s1", "s1-");
  return {
    name: "S1",
    cases: () => cases().map((c) => ({ ...c })),
    async score(c): Promise<CaseOutcome> {
      const zero = new Decimal(0);
      const expected = c.expected as Record<string, unknown>;
      let outline: NormalizedOutline;
      try {
        outline = run_normalizer(grid_for((c as CaseFile).input));
      } catch (e) {
        if (!is_intake_error(e)) throw e;
        return { case_id: c.case_id, passed: false, failure_category: "intake_refused", actual: { refused: e.code }, cost_usd: zero };
      }
      if (options.mutate !== undefined) outline = options.mutate(outline);
      let report: ReturnType<typeof build_report> | null = null;
      const report_of = (): ReturnType<typeof build_report> => (report ??= build_report(outline));
      const actual: Record<string, JsonValue> = {};
      const mismatched: string[] = [];
      for (const key of Object.keys(expected)) {
        if (key === "same_rows_as_issued") {
          actual[key] = stripped_view(outline) === stripped_view(load_issued_outline());
        } else {
          actual[key] = project(key, expected, outline, report_of);
        }
        if (canonical(actual[key]) !== canonical(expected[key])) mismatched.push(key);
      }
      if (mismatched.length > 0) actual["mismatched_fields"] = mismatched;
      return {
        case_id: c.case_id, passed: mismatched.length === 0, failure_category: mismatched.length === 0 ? null : "expected_field_mismatch",
        actual, cost_usd: zero,
      };
    },
  };
}
