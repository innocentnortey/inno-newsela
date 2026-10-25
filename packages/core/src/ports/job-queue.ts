import type { TileState, FailureReason } from "@ls/schema/api/runs";
import type { BrakeName, JobId, JobKind, JobStatus, LessonId, OutlineVersionId, RunId, UnitId, UserId, Usd, VersionId } from "./common.ts";
import type { Tx } from "./tx.ts";

export interface NewJob {
  run_id: RunId;
  kind: JobKind;
  lesson_id: LessonId | null;
  idempotency_key: string; // sha256(run_id, lesson_id, prompt_version_id, schema_version)
  priority: number;
  reviewer_note: string | null; // kind "candidate" only; never a log line
}

export interface ClaimedJob {
  job_id: JobId;
  run_id: RunId;
  unit_id: UnitId;
  kind: JobKind;
  lesson_id: LessonId | null;
  attempt: number; // claim count; for logs and lease ownership only
  lease_until: Date;
  prompt_version_id: string;
  schema_version: number;
  outline_version_id: OutlineVersionId;
  started_by: UserId;
  idempotency_key: string;
  reviewer_note: string | null;
}

export interface JobOutcome {
  job_id: JobId;
  status: JobStatus;
  tile_state: TileState;
  failure_reasons: FailureReason[];
  brakes_fired: BrakeName[];
  repairs: number;
  truncation_retries: number;
  retries: number;
  calls_lost: number;
  cost_usd: Usd;
  version_id: VersionId | null;
}

export interface JobRow {
  job_id: JobId;
  run_id: RunId;
  kind: JobKind;
  lesson_id: LessonId | null;
  status: JobStatus;
  tile_state: TileState;
  attempt: number;
  queued_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  failure_reasons: FailureReason[];
  brakes_fired: BrakeName[];
  repairs: number;
  truncation_retries: number;
  retries: number;
  calls_lost: number;
  cost_usd: Usd;
  reviewer_note?: string | null; // CHG-4: kind "candidate" only; never a log line
}

export interface RequeueReport {
  requeued: number;
  job_ids: JobId[];
}

export interface JobQueue {
  create_run_jobs(jobs: readonly NewJob[], tx: Tx): Promise<number>;
  create_candidate_job(job: NewJob, tx: Tx): Promise<JobRow>;
  // fair share across active runs, FIFO inside one, FOR UPDATE SKIP LOCKED
  claim(worker_id: string, max_active_runs: number, lease_ms: number): Promise<ClaimedJob | null>;
  renew_lease(job_id: JobId, lease_ms: number): Promise<boolean>;
  set_tile_state(job_id: JobId, tile_state: TileState): Promise<void>;
  finish(outcome: JobOutcome): Promise<void>;
  // running jobs whose lease_until < now go back to queued; touches only lesson_job
  requeue_expired(now: Date): Promise<RequeueReport>;
  requeue_failed(run_id: RunId, tx: Tx): Promise<number>;
  cancel_run(run_id: RunId, reason: "cancelled" | "capped", tx: Tx): Promise<number>;
  jobs_for_run(run_id: RunId): Promise<JobRow[]>;
  is_cancelled(job_id: JobId): Promise<boolean>;
}
