import type { NormalizedRow } from "@ls/schema/outline";
import type { LessonId, LessonStateName, RequestId, Sha256, UnitId, UserId, VersionId } from "./common.ts";
import type { Tx } from "./tx.ts";

export interface LessonRow {
  lesson_id: LessonId;
  unit_id: UnitId;
  number: number | null;
  type: string;
  title: string;
  state: LessonStateName;
  current_version_id: VersionId | null;
  reviewer_id: UserId | null;
  last_editor_id: UserId | null;
  schema_version: number;
}

export interface NewReviewEvent {
  lesson_id: LessonId;
  version_id: VersionId | null;
  from_state: LessonStateName;
  to_state: LessonStateName;
  actor_id: UserId;
  reason: string | null;
  reason_tag: string | null;
  note: string | null;
  content_hash: Sha256 | null;
  request_id: RequestId;
}

export interface ReviewEventRow {
  review_event_id: string;
  lesson_id: LessonId;
  from_state: LessonStateName;
  to_state: LessonStateName;
  actor_id: UserId;
  at: Date;
}

export interface LessonStateInfo {
  lesson_id: LessonId;
  state: LessonStateName;
  editable: boolean;
  reviewer_id: UserId | null;
}

export interface LessonStateRepo {
  get(lesson_id: LessonId): Promise<LessonRow | null>;
  lock_for_update(lesson_id: LessonId, tx: Tx): Promise<LessonRow>;
  state_of(lesson_id: LessonId): Promise<LessonStateInfo>;
  ensure_lessons(rows: readonly NormalizedRow[], unit_id: UnitId, tx: Tx): Promise<number>;
  set_state(lesson_id: LessonId, to_state: LessonStateName, reviewer_id: UserId | null, tx: Tx): Promise<LessonRow>;
  append_review_event(e: NewReviewEvent, tx: Tx): Promise<ReviewEventRow>;
  record_last_editor(lesson_id: LessonId, user_id: UserId, tx: Tx): Promise<void>;
}
