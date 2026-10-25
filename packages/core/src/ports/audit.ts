import type { Standard } from "@ls/schema/lesson";
import type { AuditEventId, JsonValue, LessonId, LessonStateName, RequestId, Sha256, StoreId, UserId } from "./common.ts";
import type { AlignmentLinkRow } from "./alignment.ts";
import type { Tx } from "./tx.ts";

export interface NewAuditEvent {
  actor_id: UserId | null;
  action: string; // dotted: "session.sign_in", "outline.upload", "run.cancel", ...
  target_kind: "session" | "unit" | "outline_version" | "run" | "lesson" | "issue" | "safety_flag" | "suggestion" | "prompt_version" | "export";
  target_id: string;
  version_hash: Sha256 | null;
  reason: string | null;
  details: JsonValue; // ids and codes only; never lesson text, keys or raw emails
  request_id: RequestId | null;
  store_id: StoreId | null;
}

export interface HistoryRow {
  at: Date;
  source: "review_event" | "audit_event";
  actor_name: string | null;
  action: string;
  from_state: LessonStateName | null;
  to_state: LessonStateName | null;
  version_hash: Sha256 | null;
  reason: string | null;
}

export interface StandardDecisionRow {
  audit_id: AuditEventId;
  lesson_id: LessonId;
  code: string;
  decision: "confirm" | "remove" | "add" | "undo";
  by: UserId;
  at: Date;
  before_entry: Standard | null; // the front-matter entry before this decision
  before_links: AlignmentLinkRow[]; // the code's alignment_link rows before this decision
}

export interface AuditLog {
  append(e: NewAuditEvent, tx: Tx): Promise<AuditEventId>;
  history(lesson_id: LessonId): Promise<HistoryRow[]>;
  // newest first
  standard_decisions(lesson_id: LessonId, code: string): Promise<StandardDecisionRow[]>;
}
