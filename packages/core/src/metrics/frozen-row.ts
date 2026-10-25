// NL-48: the frozen first-approval metrics row. Pure: no I/O, no clock. No person field anywhere.
import Decimal from "decimal.js";
import type { DraftRating } from "../ports/common.ts";
import type { LessonVersionRow } from "../ports/lesson-versions.ts";
import type { LessonMetricsRecord, ReviewSessionRow } from "../ports/metrics.ts";

export function compute_lesson_metrics(
  sessions: readonly ReviewSessionRow[],
  version: LessonVersionRow,
  rating: DraftRating,
  approved_at: Date,
): LessonMetricsRecord {
  const human = sessions.filter((s) => !s.synthetic);
  const seconds = human.reduce((sum, s) => sum + s.active_seconds, 0);
  const words = version.teacher_word_count;
  return {
    lesson_id: version.lesson_id,
    version_id: version.version_id,
    active_minutes: new Decimal(seconds).div(60).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    human_sessions: human.length,
    teacher_word_count: words,
    g2_threshold_minutes: new Decimal(words).div(250).mul(0.5).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    draft_rating: rating,
    approved_at,
  };
}
