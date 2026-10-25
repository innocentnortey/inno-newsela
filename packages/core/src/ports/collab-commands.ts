import type { Standard } from "@ls/schema/lesson";
import type { Anchor, SourceRef, RightsStatus } from "@ls/schema/api/lessons";
import type { Actor, CollabMode, LessonId, LessonStateName, RequestId, Sha256, StateVector, StoreId, SuggestionId, UserId, VersionId } from "./common.ts";


export interface SubmitCommand {
  lesson_id: LessonId;
  actor: Actor;
  client_state_vector: StateVector; // NOT_STORED unless the stored state vector covers it
  request_id: RequestId;
}

export interface SnapshotResult {
  lesson_id: LessonId;
  version_id: VersionId;
  version_number: number;
  content_hash: Sha256;
  state_vector: StateVector;
  review_event_id: string;
  from_state: LessonStateName;
  to_state: LessonStateName; // "submitted"
}

export interface StandardEdit {
  kind: "standard";
  code: string;
  decision: "confirm" | "remove" | "add" | "undo";
  restore: Standard | null; // undo only: the entry as it stood before the undone decision
}

export interface SlotFillEdit {
  kind: "slot_fill";
  slot_id: string;
  text: string;
  source_ref: SourceRef;
  rights_status: RightsStatus;
}

export interface AdoptEdit {
  kind: "adopt";
  candidate_version_id: VersionId;
  scope: "whole" | "section";
  section_address: string | null;
}

export interface SuggestionAcceptEdit {
  kind: "suggestion_accept";
  suggestion_id: SuggestionId;
  anchor: Anchor;
  expected_text: string; // applied only if the live text under the anchor equals this (ANCHOR_CHANGED)
  replacement_text: string;
}

export type LessonEdit = StandardEdit | SlotFillEdit | AdoptEdit | SuggestionAcceptEdit;

export interface EditCommand {
  lesson_id: LessonId;
  actor: Actor;
  edit: LessonEdit;
  tag: "standard-decision" | "slot-fill" | "candidate-adopt" | "ai-assist";
  request_id: RequestId;
}

export interface StoreAck {
  lesson_id: LessonId;
  store_id: StoreId;
  seq: number;
  content_hash: Sha256;
  state_vector: StateVector;
  stored_at: Date;
  stored_by: UserId | null;
  check_job_enqueued: boolean;
}

export interface ModeCommand {
  lesson_id: LessonId;
  mode: CollabMode;
  state: LessonStateName;
  request_id: RequestId;
}

export interface ModeResult {
  lesson_id: LessonId;
  mode: CollabMode;
  connections_notified: number;
}

export interface CollabCommands {
  // Refusals: LESSON_LOCKED, NOT_STORED, BLOCKED, CONFIRMATION_OPEN, SUGGESTION_PENDING, INVALID_TRANSITION.
  lock_and_snapshot(cmd: SubmitCommand): Promise<SnapshotResult>;
  // Refusals: LESSON_LOCKED, ANCHOR_CHANGED, NOT_FOUND.
  apply_edit(cmd: EditCommand): Promise<StoreAck>;
  // idempotent; called after the web app commits Withdraw, Request changes or Reopen.
  set_mode(cmd: ModeCommand): Promise<ModeResult>;
}
