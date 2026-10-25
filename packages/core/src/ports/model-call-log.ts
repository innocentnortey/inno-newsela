import type { ProviderErrorKind } from "../errors.ts";
import type { CallPurpose, JobId, LessonId, ModelAlias, ModelCallId, ReservationId, RequestId, RunId, TokenUsage, Usd } from "./common.ts";

export interface ModelCallStart {
  run_id: RunId | null;
  lesson_id: LessonId | null;
  job_id: JobId | null;
  attempt: number; // the call's ordinal for (job_id, purpose), starting at 1
  purpose: CallPurpose;
  alias: ModelAlias;
  requested_model: string;
  rendered_prompt: string;
  request_id: RequestId | null;
  experiment_id: string | null;
  reservation_id: ReservationId | null;
}

export interface ModelCallCompletion {
  raw_output: string;
  stop_reason: string;
  usage: TokenUsage;
  cost_usd: Usd;
  served_model: string;
  provider_request_id: string | null;
  latency_ms: number;
}

export interface ProviderErrorRecord {
  kind: ProviderErrorKind;
  http_status: number | null;
  message: string; // no key, no prompt text
  retry_after_s: number | null;
}

export interface RecordedCall {
  model_call_id: ModelCallId;
  purpose: CallPurpose;
  attempt: number;
  raw_output: string;
  stop_reason: string;
  usage: TokenUsage;
  cost_usd: Usd;
  served_model: string;
  retries: number;
}

export interface RunCallTotals {
  run_id: RunId;
  calls: number;
  completed: number;
  failed: number;
  lost: number;
  retries: number;
  truncation_retries: number;
  repairs: number;
  cost_usd: Usd;
  input_tokens: number;
  output_tokens: number;
}

export interface ModelCallLog {
  insert_sent(start: ModelCallStart): Promise<ModelCallId>;
  complete(model_call_id: ModelCallId, done: ModelCallCompletion): Promise<void>;
  fail(model_call_id: ModelCallId, error: ProviderErrorRecord): Promise<void>;
  mark_lost(job_id: JobId): Promise<number>;
  // a "completed" row with raw_output is returned, never re-sent
  completed_for(job_id: JobId, purpose: CallPurpose, attempt: number): Promise<RecordedCall | null>;
  totals_for_run(run_id: RunId): Promise<RunCallTotals>;
}
