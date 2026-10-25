import type { RenderedPrompt } from "@ls/prompts/inputs";
import type { JobOutcome } from "@ls/core/ports/job-queue";
import type { RecordedCall } from "@ls/core/ports/model-call-log";
import type { StructuredCallRequest } from "@ls/core/ports/model-client";
import type { CallPurpose, JobId, LessonId, RequestId, ReservationId, RunId, Sha256, UserId } from "@ls/core/ports/common";
import type { CheckContext } from "@ls/core/checks/types";
import type { StoredLesson } from "@ls/schema/lesson";

// Structural stand-ins for same-wave collaborators (NL-33 PaidCaller, NL-35 recorder, NL-38 loader, NL-30 finalizer).
// The real classes satisfy these at NL-79 wiring.
export interface ModelCallContext {
  run_id: RunId | null;
  lesson_id: LessonId | null;
  job_id: JobId | null;
  attempt: number;
  purpose: CallPurpose;
  request_id: RequestId | null;
  experiment_id: string | null;
  reservation_id: ReservationId | null;
}
export interface PaidCallRequest {
  ctx: ModelCallContext;
  req: StructuredCallRequest;
  rendered: RenderedPrompt;
  run_id: RunId | null;
  job_id: JobId | null;
  user_id: UserId;
}
export interface PaidCallerPort {
  call(p: PaidCallRequest): Promise<RecordedCall>;
}
export interface CheckpointPort {
  checkpoint(job_id: JobId, purpose: CallPurpose, attempt: number): Promise<RecordedCall | null>;
}
export interface CheckContextLoaderPort {
  load(lesson_id: LessonId, lesson: StoredLesson, content_hash: Sha256): Promise<CheckContext>;
}
export interface RunFinalizerPort {
  after_job(run_id: RunId, outcome: JobOutcome): Promise<unknown>;
}
