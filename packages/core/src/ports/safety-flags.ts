import type { LessonId, UserId } from "./common.ts";
import type { Tx } from "./tx.ts";

export interface SafetyFlagRow {
  flag_id: string;
  lesson_id: LessonId;
  source_row: number;
  teacher_tip_address: string | null;
  status: "open" | "cleared";
  cleared_by: UserId | null;
  note: string | null;
  cleared_at: Date | null;
}

export interface SafetyFlagRepo {
  create_for_lesson(lesson_id: LessonId, source_rows: readonly number[], tx: Tx): Promise<SafetyFlagRow[]>;
  open_for(lesson_id: LessonId): Promise<SafetyFlagRow[]>;
  clear(flag_id: string, by: UserId, note: string, tx: Tx): Promise<SafetyFlagRow>;
}
