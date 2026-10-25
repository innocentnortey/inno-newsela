import type { JsonValue, RunId } from "./common.ts";

export type SuiteName = "S1" | "S2" | "S3" | "S4" | "S5" | "S6" | "S7" | "S8" | "S9" | "S10" | "S11" | "S12" | "S13" | "S14";

export interface NewEvalRun {
  suite: SuiteName;
  git_sha: string;
  prompt_version_id: string | null;
  models: JsonValue;
  provider_mode: "real" | "stub";
  case_set: string;
  run_id: RunId | null;
}

export interface EvalRunRow {
  eval_run_id: string;
  suite: SuiteName;
  passed: number;
  total: number;
  report_path: string | null;
  started_at: Date;
  finished_at: Date | null;
}

export interface EvalCaseResultRecord {
  eval_run_id: string;
  case_id: string;
  provenance: "issued" | "hand-written" | "synthetic" | "promoted-trace";
  source: string;
  guards: string;
  passed: boolean;
  failure_category: string | null;
  expected: JsonValue;
  actual: JsonValue;
}

export interface ProbeRunRecord {
  probe_run_id: string;
  kind: "http" | "yjs";
  users: number;
  duration_s: number;
  machine: string;
  provider_mode: "real" | "stub";
  p95_ms: JsonValue; // {"lesson_open", "board", "poll", "remote_edit", "stored"}
  error_rate: number;
  lost_updates: number;
  event_loop_lag_p95_ms: number;
  max_db_connections: number;
  n: number;
}

export interface ExperimentRunRecord {
  experiment_id: string; // "SP-1", "SP-2", "SP-3" (+ run suffix)
  config: JsonValue;
  result: JsonValue;
  report_path: string;
}

export interface OpsEventRecord {
  kind: "process.start" | "migration.applied" | "seed" | "backup" | "health.failure" | "samples.built";
  service: string;
  build_id: string;
  details: JsonValue;
}

export interface EvidenceRepo {
  start_eval_run(r: NewEvalRun): Promise<EvalRunRow>;
  add_case_result(r: EvalCaseResultRecord): Promise<void>;
  finish_eval_run(eval_run_id: string, passed: number, total: number, report_path: string): Promise<EvalRunRow>;
  insert_probe_run(p: ProbeRunRecord): Promise<string>;
  insert_experiment_run(e: ExperimentRunRecord): Promise<string>;
  ops_event(e: OpsEventRecord): Promise<string>;
}
