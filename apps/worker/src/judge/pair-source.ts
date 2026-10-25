import type { LessonId, RunId, Sha256, UserId } from "@ls/core/ports/common";

// NL-89: the seam the judge job consumes. NL-110 supplies the production implementation.
export interface JudgePair {
  address: string;
  code: string;
  activity_text: string;
  standard_text: string;
  question: "teaches_standard" | "eld_keeps_task";
}
export interface JudgeLessonContext {
  run_id: RunId | null;
  user_id: UserId;
  pairs: readonly JudgePair[];
}
export interface JudgePairSource {
  load(lesson_id: LessonId, content_hash: Sha256): Promise<JudgeLessonContext>;
}
