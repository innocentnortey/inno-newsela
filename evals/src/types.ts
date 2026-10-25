// NL-49 (DO-4 §9)
import type { JsonValue, Usd } from "@ls/core/ports/common";
import type { SuiteName } from "@ls/core/ports/evidence";

export type { SuiteName };
export type ProviderMode = "real" | "stub";

export interface EvalOptions {
  repeat: number;
  provider_mode: ProviderMode;
  git_sha: string;
  unit: string | null;
}
export interface EvalCase {
  case_id: string;
  provenance: "issued" | "hand-written" | "synthetic" | "promoted-trace";
  source: string;
  guards: string;
  input_path: string;
  expected: JsonValue;
}
export interface CaseOutcome {
  case_id: string;
  passed: boolean;
  failure_category: string | null;
  actual: JsonValue;
  cost_usd: Usd;
}
export interface EvalSuite {
  readonly name: SuiteName;
  cases(): EvalCase[];
  score(c: EvalCase, opts: EvalOptions): Promise<CaseOutcome>;
}
export interface EvalRunSummary {
  eval_run_id: string;
  suite: SuiteName;
  passed: number;
  total: number;
  report_path: string;
  cost_usd: Usd;
}
export type SuiteFactory = (provider_mode: ProviderMode) => readonly EvalSuite[];
