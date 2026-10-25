// Shared types every port uses (DO-4 section 2). Types only; no runtime.
import type Decimal from "decimal.js";

export type Usd = Decimal;
export type { JsonValue } from "@ls/editor-schema/schema";
export type {
  UserId, UnitId, LessonId, OutlineVersionId, RunId, JobId, ModelCallId, VersionId, StoreId, IssueId,
  SuggestionId, ReservationId, AuditEventId, RequestId, Sha256, StateVector, IdPrefix,
} from "@ls/schema/ids";
import type { UserId, RequestId } from "@ls/schema/ids";

export type YDocBytes = Uint8Array;

export type RoleName = "author" | "reviewer" | "approver";
export type LessonStateName = "draft" | "generation_failed" | "in_review" | "submitted" | "changes_requested" | "approved" | "reopened" | "exported";
export type RunStateName = "planning" | "running" | "complete" | "partial" | "capped" | "paused" | "cancelled";
export type RunKind = "run" | "trial" | "candidate";
export type JobKind = "unit_plan" | "lesson" | "candidate";
export type JobStatus = "queued" | "running" | "ready" | "generation_failed" | "cancelled";
export type IssueLevelName = "blocking" | "confirmation" | "advisory";
export type CheckKind =
  | "quote_placeholder_open" | "excerpt_slot_open" | "cross_lesson_link" | "standard_not_taught" | "standard_not_checked"
  | "code_not_allowed" | "minutes_out_of_range" | "section_missing" | "schema_invalid" | "quote_unmatched"
  | "page_out_of_range" | "proper_noun_unsourced" | "quote_without_source" | "quote_too_long" | "rights_to_clear"
  | "suggestion_pending" | "safety_flag_open" | "safety_note_without_tip" | "safety_text_in_student_block"
  | "disclosure_prompt" | "standard_confirmation" | "standard_add_suggestion" | "eld_label_mismatch" | "arc_repeat"
  | "vocabulary_over_cap" | "vocabulary_word_missing" | "linked_text_changed" | "judge_no";
export type ModelAlias = "GENERATION" | "REPAIR" | "ASSIST" | "JUDGE";
export type CallPurpose = "unit_plan" | "lesson_draft" | "truncation_retry" | "repair" | "assist" | "judge" | "spike";
export type BrakeName = "repair_round" | "rate_limit_retries" | "truncation_retry" | "job_wall_clock" | "spend_run_cap" | "spend_day_cap" | "spend_project_cap" | "circuit_breaker" | "cancelled";
export type CapName = "run_cap" | "day_cap" | "project_cap";
export type DayCapScope = "user" | "project";
export type FailureCheck = "schema_invalid" | "truncated" | "rate_limited" | "provider_error" | "timeout" | "compile_error" | "check_failed" | "cancelled" | "capped";
export type SheetKind = "csv" | "xlsx";
export type DraftRating = "usable_as_drafted" | "usable_with_edits" | "rewritten";
export type CollabMode = "editable" | "read_only";

export interface Actor {
  user_id: UserId | null; // null only for the system (worker seeding v1)
  name: string;
  role: RoleName | null;
  synthetic: boolean;
}

export interface RequestUser {
  user_id: UserId;
  name: string;
  email: string;
  role: RoleName;
  synthetic: boolean;
  request_id: RequestId;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
}

export interface ModelPrice {
  model_id: string;
  input_per_mtok: Usd;
  output_per_mtok: Usd;
  cache_read_per_mtok: Usd;
  cache_write_per_mtok: Usd;
}
