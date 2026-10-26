// NL-49 shell; filled by NL-121 (held-out structural comparison, counts only). Keep the exported signature.
import Decimal from "decimal.js";
import type { JsonValue } from "@ls/core/ports/common";
import type { CaseOutcome, EvalCase, EvalSuite, ProviderMode } from "../types.ts";
import { make_shell } from "./shell.ts";

export interface S11Deps {
  cases: readonly { number: number }[];
  score(n: number): Promise<{ passed: boolean; failure_category: string | null; counts: Record<string, number> }>;
}

export const heldout_case_id = (n: number): string => `lesson-${n}`;

export function make_s11(_provider_mode: ProviderMode, deps?: S11Deps): EvalSuite {
  if (deps === undefined) return make_shell("S11", "NL-121");
  return {
    name: "S11",
    cases: (): EvalCase[] =>
      deps.cases.map((c) => ({
        case_id: heldout_case_id(c.number), provenance: "synthetic", source: "S-5 held-out (counts only)",
        guards: "S11", input_path: "n/a", expected: { number: c.number },
      })),
    score: async (c): Promise<CaseOutcome> => {
      const n = (c.expected as { number: number }).number;
      const r = await deps.score(n);
      return { case_id: c.case_id, passed: r.passed, failure_category: r.failure_category, actual: r.counts as JsonValue, cost_usd: new Decimal(0) };
    },
  };
}
