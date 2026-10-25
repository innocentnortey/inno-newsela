import type { LessonId, Sha256, StoreId } from "./common.ts";
import type { Tx } from "./tx.ts";

export interface ClaimedCheck {
  lesson_id: LessonId;
  content_hash: Sha256;
  store_id: StoreId;
  lease_until: Date;
}

export interface PendingCheckState {
  lesson_id: LessonId;
  pending: boolean;
  newest_queued_hash: Sha256 | null;
  latest_stored_hash: Sha256 | null;
  latest_stored_at: Date | null;
}

export interface CheckQueue {
  // coalesced: one queued row per lesson; a newer hash replaces the queued one
  enqueue(lesson_id: LessonId, content_hash: Sha256, store_id: StoreId, tx: Tx): Promise<void>;
  claim(lease_ms: number): Promise<ClaimedCheck | null>;
  finish(check: ClaimedCheck): Promise<void>;
  pending_for(lesson_id: LessonId): Promise<PendingCheckState>;
}
