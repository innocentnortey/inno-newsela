// NL-92: S10 seeded-error suite. Cases are the planted errors recorded at plant time; the score is "caught before approval".
import Decimal from "decimal.js";
import type { PlantResult } from "../seed/score.ts";
import type { CaseOutcome, EvalCase, EvalSuite, ProviderMode } from "../types.ts";
import { make_shell } from "./shell.ts";

export interface S10Deps {
  key_id: string;
  plants: { kind: string }[]; // known at plant time, in plant order
  score(): Promise<PlantResult[]>; // stored-row scoring, run once
}

export const seed_case_id = (n: number): string => `seed-${n}`;

export function make_s10(_provider_mode: ProviderMode, deps?: S10Deps): EvalSuite {
  if (deps === undefined) return make_shell("S10", "NL-92"); // no plan: empty, so the CLI never reads it as passing
  let memo: Promise<PlantResult[]> | null = null;
  return {
    name: "S10",
    cases(): EvalCase[] {
      return deps.plants.map((p, i) => ({
        case_id: seed_case_id(i + 1), provenance: "hand-written", source: deps.key_id, guards: "S10", input_path: "n/a",
        expected: { kind: p.kind, caught_before_approval: true },
      }));
    },
    async score(c): Promise<CaseOutcome> {
      memo ??= deps.score();
      const r = (await memo).find((x) => seed_case_id(x.n) === c.case_id);
      if (r === undefined) return { case_id: c.case_id, passed: false, failure_category: "plant_not_scored", actual: {}, cost_usd: new Decimal(0) };
      return {
        case_id: c.case_id, passed: r.caught, failure_category: r.caught ? null : "missed", actual: { kind: r.kind, how: r.how },
        cost_usd: new Decimal(0),
      };
    },
  };
}
