import type { LessonId, ModelCallId, SuggestionId, UserId } from "./common.ts";
import type { Tx } from "./tx.ts";

export interface NewSuggestion {
  lesson_id: LessonId;
  anchor_start: string;
  anchor_end: string;
  selected_text: string;
  note: string;
  suggested_text: string;
  requested_by: UserId;
  model_call_id: ModelCallId;
  expires_at: Date; // set by the service; the repo reads no settings
}

export interface SuggestionRow {
  suggestion_id: SuggestionId;
  lesson_id: LessonId;
  anchor_start: string;
  anchor_end: string;
  selected_text: string;
  suggested_text: string;
  status: "pending" | "accepted" | "rejected" | "closed";
  requested_by: UserId;
  decided_by: UserId | null;
  decided_at: Date | null;
  expires_at: Date;
  model_call_id: ModelCallId;
}

export interface SuggestionRepo {
  insert(s: NewSuggestion): Promise<SuggestionRow>;
  get(suggestion_id: SuggestionId): Promise<SuggestionRow | null>;
  decide(suggestion_id: SuggestionId, status: "accepted" | "rejected" | "closed", by: UserId, tx: Tx): Promise<SuggestionRow>;
  pending_for(lesson_id: LessonId, now: Date): Promise<SuggestionRow[]>; // excludes expired
}
