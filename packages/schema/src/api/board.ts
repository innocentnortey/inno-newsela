// Mirrors OpenAPI components LessonState, SendBackTag, SendBack, DependencyFlag, BoardRow, UnitBoard (unit board card).
import { z } from "zod";
import { NullableText, Timestamp } from "./common.ts";

export const LessonState = z.enum([
  "generation_failed",
  "draft",
  "in_review",
  "submitted",
  "changes_requested",
  "approved",
  "reopened",
  "exported",
]);
export type LessonState = z.infer<typeof LessonState>;

export const SendBackTag = z.enum([
  "standards",
  "quotes_and_rights",
  "eld_support",
  "content_safety",
  "ai_spans",
  "teaching_quality",
  "other",
]);
export type SendBackTag = z.infer<typeof SendBackTag>;

export const SendBack = z.object({
  tag: SendBackTag,
  note: z.string(),
  by: z.string(),
  at: Timestamp,
});
export type SendBack = z.infer<typeof SendBack>;

export const DependencyFlag = z.object({
  kind: z.enum(["waits_on", "source_reopened"]),
  status: z.enum(["slot_empty", "waiting_for_source_approval"]).nullable(),
  lesson_id: z.string(),
  label: z.string(),
});
export type DependencyFlag = z.infer<typeof DependencyFlag>;

export const BoardRow = z.object({
  lesson_id: z.string(),
  lesson_key: z.string(),
  number: z.number().int().nullable(),
  title: z.string(),
  type: z.string(),
  state: LessonState,
  blocking_count: z.number().int(),
  confirmation_count: z.number().int(),
  advisory_count: z.number().int(),
  reviewer: NullableText,
  last_change_at: Timestamp,
  dependency_flags: z.array(DependencyFlag),
  send_back: SendBack.nullable(),
  judge_flag: z.object({ verdict: z.literal("no"), label: z.string() }).nullable(),
});
export type BoardRow = z.infer<typeof BoardRow>;

export const UnitBoard = z.object({
  unit_id: z.string(),
  unit_key: z.string(),
  generated_at: Timestamp,
  rollup: z.record(z.string(), z.number().int()),
  rows: z.array(BoardRow),
});
export type UnitBoard = z.infer<typeof UnitBoard>;
