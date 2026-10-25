import type Decimal from "decimal.js";
import type { DraftRating, LessonId, UnitId, UserId, VersionId } from "./common.ts";
import type { Tx } from "./tx.ts";

export interface HeartbeatRecord {
  user_id: UserId;
  tab_id: string;
  lesson_id: LessonId;
  version_id: VersionId;
  at: Date;
  active: boolean;
  synthetic: boolean;
}

export interface ReviewSessionRow {
  user_id: UserId;
  lesson_id: LessonId;
  version_id: VersionId;
  started_at: Date;
  last_at: Date;
  active_seconds: number;
  synthetic: boolean;
}

export interface LessonMetricsRecord {
  lesson_id: LessonId;
  version_id: VersionId;
  active_minutes: Decimal;
  human_sessions: number;
  teacher_word_count: number;
  g2_threshold_minutes: Decimal;
  draft_rating: DraftRating;
  approved_at: Date;
}

export interface MetricsRepo {
  insert_heartbeat(hb: HeartbeatRecord): Promise<void>;
  extend_session(hb: HeartbeatRecord, gap_s: number): Promise<ReviewSessionRow>;
  sessions_for(lesson_id: LessonId): Promise<ReviewSessionRow[]>;
  first_approval_exists(lesson_id: LessonId, tx: Tx): Promise<boolean>;
  write_lesson_metrics(row: LessonMetricsRecord, tx: Tx): Promise<boolean>; // INSERT ... ON CONFLICT DO NOTHING
  unit_metrics_rows(unit_id: UnitId): Promise<LessonMetricsRecord[]>;
}
