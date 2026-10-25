// Mirrors OpenAPI components for the outline and intake-validation cards (units, versions, report, choices).
import { z } from "zod";
import { NullableText, Sha256, Timestamp } from "./common.ts";
import { RunState } from "./runs.ts";

export const RowCounts = z.object({
  lessons: z.number().int(),
  flex_days: z.number().int(),
  arc_headers: z.number().int(),
  total_rows: z.number().int(),
});
export type RowCounts = z.infer<typeof RowCounts>;

export const OutlineVersion = z.object({
  outline_version_id: z.string(),
  unit_id: z.string(),
  unit_key: z.string(),
  version_number: z.number().int().min(1),
  sha256: Sha256,
  same_as_version: z.number().int().nullable(),
  changed_lessons: z.number().int(),
  row_counts: RowCounts,
  created_at: Timestamp,
  created_by: z.string(),
});
export type OutlineVersion = z.infer<typeof OutlineVersion>;

export const RunRef = z.object({
  run_id: z.string(),
  state: RunState,
});
export type RunRef = z.infer<typeof RunRef>;

export const Unit = z.object({
  unit_id: z.string(),
  unit_key: z.string(),
  title: z.string(),
  versions: z.array(OutlineVersion),
  latest_run: RunRef.nullable(),
});
export type Unit = z.infer<typeof Unit>;

export const UnitList = z.object({ units: z.array(Unit) });
export type UnitList = z.infer<typeof UnitList>;

export const ImportLinkRequest = z.object({ sheet_url: z.url() }).strict();
export type ImportLinkRequest = z.infer<typeof ImportLinkRequest>;

export const ChoiceRecord = z.object({
  value: NullableText,
  source: z.enum(["default", "confirmed"]),
  by: NullableText,
  at: Timestamp.nullable(),
});
export type ChoiceRecord = z.infer<typeof ChoiceRecord>;

export const Finding = z.object({
  finding_id: z.string(),
  level: z.enum(["info", "warning", "error"]),
  kind: z.enum([
    "malformed_code",
    "nonexistent_code",
    "unit_conflict",
    "duplicate_id",
    "missing_required_column",
    "parent_code",
    "bad_filename",
    "eld_mismatch",
    "eld_not_checked",
    "vocabulary_over_cap",
    "vocabulary_word_missing",
    "homework_links_later_row",
    "non_breaking_space",
    "duplicate_text",
    "instruction_shaped",
    "safety_note_proposed",
    "writer_task",
  ]),
  column: z.string(),
  original_text: z.string(),
  proposed_fix: NullableText,
  choice: ChoiceRecord,
});
export type Finding = z.infer<typeof Finding>;

export const SegmentKind = z.enum([
  "content",
  "writer_task",
  "editor_note",
  "unit_rule",
  "safety_note",
]);
export type SegmentKind = z.infer<typeof SegmentKind>;

export const Segment = z.object({
  segment_id: z.string(),
  column: z.string(),
  kind: SegmentKind,
  text: z.string(),
  action: z.enum(["apply", "show_only", "ignore"]).nullable(),
  source: z.enum(["default", "confirmed"]),
  by: NullableText,
});
export type Segment = z.infer<typeof Segment>;

export const EldEntry = z.object({
  code: z.string(),
  sheet_label: z.string(),
  official_strand: z.string(),
  verdict: z.enum(["fits", "mismatch", "not_checked"]),
  suggested_remap: NullableText,
  choice: z.enum(["keep", "remap"]),
});
export type EldEntry = z.infer<typeof EldEntry>;

export const ReportRow = z.object({
  row_number: z.number().int(),
  kind: z.enum(["lesson", "flex_day", "arc_header", "total"]),
  lesson_id: NullableText,
  level: z.enum(["ok", "info", "warning", "error"]),
  findings: z.array(Finding),
  segments: z.array(Segment),
  eld: z.array(EldEntry),
  flags: z.array(z.string()),
});
export type ReportRow = z.infer<typeof ReportRow>;

export const ReportCounts = z.object({
  teaching_days: z.number().int(),
  lessons: z.number().int(),
  flex_days: z.number().int(),
  arc_headers: z.number().int(),
  total_rows: z.number().int(),
  errors: z.number().int(),
  errors_unconfirmed: z.number().int(),
  warnings: z.number().int(),
  unit_conflicts: z.number().int(),
  malformed_codes: z.number().int(),
  rows_with_nonexistent_code: z.number().int(),
  bad_filenames: z.number().int(),
  eld_mismatches: z.number().int(),
});
export type ReportCounts = z.infer<typeof ReportCounts>;

export const UnitRule = z.object({
  text: z.string(),
  scope_rows: z.array(z.number().int()),
  source: z.enum(["default", "confirmed"]),
});
export type UnitRule = z.infer<typeof UnitRule>;

export const ValidationReport = z.object({
  outline_version_id: z.string(),
  version_number: z.number().int(),
  sha256: Sha256,
  same_as_version: z.number().int().nullable(),
  unit: z.object({
    as_written: z.string(),
    filenames_say: NullableText,
    confirmed: z.boolean(),
    confirmed_by: NullableText,
    finding: Finding.nullable().optional(),
  }),
  counts: ReportCounts,
  rows: z.array(ReportRow),
  unit_rules: z.array(UnitRule),
  runs_from_this_version: z.array(
    z.object({
      run_id: z.string(),
      started_at: Timestamp,
      choices_hash: Sha256,
    }),
  ),
  generate_allowed: z.boolean(),
});
export type ValidationReport = z.infer<typeof ValidationReport>;

export const IntakeChoiceRequest = z
  .object({
    target_id: z.string(),
    kind: z.enum([
      "confirm_unit",
      "confirm_fix",
      "edit_fix",
      "set_note_action",
      "change_split",
      "set_unit_rule_scope",
      "eld_keep",
      "eld_remap",
      "confirm_safety_note",
      "reject_safety_note",
      "revert",
    ]),
    value: z
      .union([z.string(), z.array(z.union([z.string(), z.number().int()])), z.null()])
      .optional(),
  })
  .strict();
export type IntakeChoiceRequest = z.infer<typeof IntakeChoiceRequest>;

export const IntakeChoiceResult = z.object({
  row: ReportRow,
  counts: ReportCounts,
  generate_allowed: z.boolean(),
});
export type IntakeChoiceResult = z.infer<typeof IntakeChoiceResult>;
