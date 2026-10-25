import type { LessonId, LessonStateName, UnitId } from "./common.ts";

export interface BoardRowRecord {
  lesson_id: LessonId;
  number: number | null;
  type: string;
  title: string;
  state: LessonStateName;
  reviewer_name: string | null;
  last_change_at: Date;
  dependency_flag: boolean;
}

export interface BoardReadRepo {
  board_rows(unit_id: UnitId, state: LessonStateName | null): Promise<BoardRowRecord[]>;
}
