// NL-121: the held-out report is integers and rates only. No z.string() here, by design (AC-2).
import { z } from "zod";

export const LessonCounts = z.strictObject({
  number: z.int().min(1),
  type_match: z.int().min(0).max(1),
  sequence_match: z.int().min(0).max(1),
  sections_generated: z.int().min(0),
  sections_published: z.int().min(0),
  focus_generated: z.int().min(0),
  focus_published: z.int().min(0),
  focus_shared: z.int().min(0),
  focus_jaccard: z.number().min(0).max(1), // shared / union, 4 decimals; union 0 -> 0
});

export const HeldoutReport = z.strictObject({
  schema_version: z.literal(1),
  unit_grade: z.literal(6),
  unit_number: z.literal(4),
  lessons_generated: z.int().min(0),
  lessons_compared: z.int().min(1),
  lessons_unreadable: z.int().min(0),
  lessons_no_published: z.int().min(0),
  type_match_count: z.int().min(0),
  sequence_match_count: z.int().min(0),
  type_match_rate: z.number().min(0).max(1),
  sequence_match_rate: z.number().min(0).max(1),
  focus_jaccard_mean: z.number().min(0).max(1),
  focus_shared_total: z.int().min(0),
  focus_generated_total: z.int().min(0),
  focus_published_total: z.int().min(0),
  per_lesson: z.array(LessonCounts),
});
export type HeldoutReport = z.infer<typeof HeldoutReport>;
export type LessonCounts = z.infer<typeof LessonCounts>;
