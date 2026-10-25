import type { StoredLesson } from "@ls/schema/lesson";
import type { Actor, LessonId, Sha256, StateVector, StoreId, UserId, RequestId, YDocBytes } from "./common.ts";
import type { StoreAck } from "./collab-commands.ts";
import type { Tx } from "./tx.ts";

export interface StoreRequest {
  lesson_id: LessonId;
  ydoc_bytes: YDocBytes;
  derived: StoredLesson;
  content_hash: Sha256;
  state_vector: StateVector;
  stored_by: UserId | null;
  request_id: RequestId | null;
  tag: string | null;
}

export interface StoredDoc {
  lesson_id: LessonId;
  seq: number;
  store_id: StoreId;
  ydoc_bytes: YDocBytes;
  content_hash: Sha256;
  state_vector: StateVector;
  schema_version: number;
  stored_at: Date;
}

export interface DerivedRow {
  lesson_id: LessonId;
  seq: number;
  store_id: StoreId;
  lesson: StoredLesson;
  content_hash: Sha256;
  state_vector: StateVector;
  schema_version: number;
  stored_at: Date;
  stored_by: UserId | null;
}

export interface SeedResult {
  lesson_id: LessonId;
  seeded: boolean; // false when a doc already existed (idempotent re-store)
  store_id: StoreId | null;
  content_hash: Sha256;
}

export interface LessonDocReader {
  latest(lesson_id: LessonId): Promise<StoredDoc | null>;
  latest_derived(lesson_id: LessonId): Promise<DerivedRow | null>;
}

export interface LessonDocStore {
  // ONE transaction: INSERT lesson_doc, enqueue check, record last editor, audit "lesson.store".
  store(req: StoreRequest): Promise<StoreAck>;
  // joins the caller's transaction; seq 1 ON CONFLICT DO NOTHING (seeded = false on conflict)
  seed_initial(lesson_id: LessonId, lesson: StoredLesson, actor: Actor, tx: Tx): Promise<SeedResult>;
}
