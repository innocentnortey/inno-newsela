import type { LessonDraft } from "@ls/schema/lesson-draft";
import type { StoredLesson } from "@ls/schema/lesson";
import type { JsonValue, LessonId, ModelCallId, RunId, Sha256, StateVector, UnitId, UserId, Usd, VersionId } from "./common.ts";
import type { Tx } from "./tx.ts";

export interface ProvenanceRecord {
  outline_row_hash: Sha256;
  prompt_version_id: string | null; // model fields are null on human-made versions
  model: string | null;
  parameters: JsonValue;
  schema_version: number;
  example_set_id: string | null;
  run_id: RunId | null;
  model_call_ids: ModelCallId[];
  cost_usd: Usd;
  ai_assisted_spans: number;
  derived_from_version_id: VersionId | null;
}

export interface DependencyRecordEntry {
  lesson_id: LessonId;
  approved_hash: Sha256;
}

export interface LessonVersionRow {
  version_id: VersionId;
  lesson_id: LessonId;
  number: number;
  kind: "generated" | "candidate" | "submit" | "approve" | "reopen";
  adopted: boolean;
  content_hash: Sha256;
  state_vector: StateVector | null;
  lesson: StoredLesson;
  draft: LessonDraft | null;
  teacher_word_count: number;
  provenance: ProvenanceRecord;
  dependency_record: DependencyRecordEntry[];
  created_by: UserId | null;
  stored_at: Date;
}

export interface NewGeneratedVersion {
  lesson_id: LessonId;
  unit_id: UnitId;
  kind: "generated" | "candidate";
  lesson: StoredLesson;
  draft: LessonDraft;
  content_hash: Sha256;
  provenance: ProvenanceRecord;
  idempotency_key: string; // UNIQUE: a second store is a no-op
}

export interface NewSnapshot {
  lesson_id: LessonId;
  kind: "submit" | "approve" | "reopen";
  lesson: StoredLesson;
  content_hash: Sha256;
  state_vector: StateVector;
  dependency_record: DependencyRecordEntry[];
  created_by: UserId;
}

export interface GeneratedVersionWrite {
  version: LessonVersionRow; // the new row, or the existing one on the conflict path
  created: boolean; // false when idempotency_key already existed
}

export interface LessonVersionRepo {
  write_generated_version(v: NewGeneratedVersion, tx: Tx): Promise<GeneratedVersionWrite>;
  write_snapshot(s: NewSnapshot, tx: Tx): Promise<LessonVersionRow>;
  version(version_id: VersionId): Promise<LessonVersionRow | null>;
  latest_snapshot(lesson_id: LessonId): Promise<LessonVersionRow | null>;
  candidate(lesson_id: LessonId, candidate_id: VersionId): Promise<LessonVersionRow | null>;
  has_generated_version(lesson_id: LessonId): Promise<boolean>;
  approved_snapshots(unit_id: UnitId): Promise<LessonVersionRow[]>;
  // whole adopt only; zero rows updated raises DomainRefusal(INVALID_TRANSITION)
  mark_adopted(version_id: VersionId, tx: Tx): Promise<LessonVersionRow>;
}
