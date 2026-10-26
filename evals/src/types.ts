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
  /** NL-109 (S3): spend limit in USD for the estimate guard; null/absent = no explicit limit. */
  max_usd?: number | null;
  /** NL-109 (S3, stub only): path of a LessonDraft JSON the stub returns for every lesson_draft call. */
  stub_draft?: string | null;
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
export interface SuiteReportSummary {
  eval_run_id: string;
  git_sha: string;
  prompt_version: string | null;
  provider_mode: ProviderMode;
  repeat: number;
  passed: number;
  total: number;
  cost_usd: string;
}
export interface EvalSuite {
  readonly name: SuiteName;
  cases(): EvalCase[];
  score(c: EvalCase, opts: EvalOptions): Promise<CaseOutcome>;
  /** NL-109: called by the runner before the eval run is started; throws InvariantViolation to refuse (cost guard). */
  preflight?(opts: EvalOptions): void;
  /** NL-109: extra `## Detail <suite>` block appended to the report (null = none). */
  report_text?(summary: SuiteReportSummary): string | null;
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
