import { z } from "zod";
import { LessonId, OutlineVersionId, Sha256, Timestamp, UnitId, UserId } from "./ids.ts";

export const SegmentRecord = z
  .object({
    kind: z.enum(["content", "writer_task", "editor_note", "unit_rule", "safety_note"]),
    text: z.string(),
    instruction_shaped: z.boolean(),
    applies: z.enum(["apply", "show_only", "ignore"]),
  })
  .strict();
export type SegmentRecord = z.infer<typeof SegmentRecord>;

export const NormalizedRow = z
  .object({
    row_number: z.int(),
    kind: z.enum(["lesson", "flex_day", "arc_header", "total"]),
    lesson_id: LessonId.nullable(),
    number: z.int().nullable(),
    title: z.string(),
    lesson_type: z.string(),
    arc: z.string().nullable(),
    segments: z.array(SegmentRecord),
    focus_codes: z.array(z.string()),
    eld_codes: z.array(z.string()),
    msls_codes: z.array(z.string()),
    vocabulary: z.array(z.string()),
    homework: z.string().nullable(),
    pages: z.string().nullable(),
    text_set: z.string().nullable(),
  })
  .strict();
export type NormalizedRow = z.infer<typeof NormalizedRow>;

export const UnitRuleRecord = z
  .object({ text: z.string(), scope_lesson_ids: z.array(LessonId) })
  .strict();
export type UnitRuleRecord = z.infer<typeof UnitRuleRecord>;

export const IntakeFinding = z
  .object({
    finding_id: z.string(),
    row_number: z.int().nullable(),
    level: z.enum(["ok", "warning", "error"]),
    kind: z.string(),
    original_text: z.string(),
    proposed_fix: z.string().nullable(),
    default_choice: z.string().nullable(),
  })
  .strict();
export type IntakeFinding = z.infer<typeof IntakeFinding>;

const Count = z.int().min(0);
export const OutlineCounts = z
  .object({
    lessons: Count,
    flex_days: Count,
    arc_headers: Count,
    totals: Count,
    errors: Count,
    warnings: Count,
  })
  .strict();
export type OutlineCounts = z.infer<typeof OutlineCounts>;

export const NormalizedOutline = z
  .object({
    unit_as_written: z.string(),
    unit_from_filenames: z.string().nullable(),
    rows: z.array(NormalizedRow),
    findings: z.array(IntakeFinding),
    unit_rules: z.array(UnitRuleRecord),
    counts: OutlineCounts,
  })
  .strict();
export type NormalizedOutline = z.infer<typeof NormalizedOutline>;

export const OutlineVersionRow = z
  .object({
    outline_version_id: OutlineVersionId,
    unit_id: UnitId,
    number: z.int(),
    sha256: Sha256,
    same_as_version: z.int().nullable(),
    source_kind: z.string(),
    uploaded_by: UserId,
    created_at: Timestamp,
    confirmed_at: Timestamp.nullable(),
  })
  .strict();
export type OutlineVersionRow = z.infer<typeof OutlineVersionRow>;

export const IntakeChoiceRow = z
  .object({
    outline_version_id: OutlineVersionId,
    finding_id: z.string(),
    choice: z.string(),
    status: z.enum(["default", "confirmed"]),
    confirmed_by: UserId.nullable(),
    at: Timestamp,
  })
  .strict();
export type IntakeChoiceRow = z.infer<typeof IntakeChoiceRow>;

export const LessonLinkRecord = z
  .object({
    link_id: z.string(),
    from_lesson_id: LessonId,
    from_address: z.string(),
    to_lesson_id: LessonId,
    to_slot_id: z.string(),
    kind: z.enum(["homework_text", "excerpt_slot", "page_continuation"]),
    label: z.string(),
  })
  .strict();
export type LessonLinkRecord = z.infer<typeof LessonLinkRecord>;
