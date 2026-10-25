// Synthetic outline builders for the report tests (NL-17). Literal and deterministic; no real data.
import type {
  IntakeChoiceRow,
  IntakeFinding,
  NormalizedOutline,
  NormalizedRow,
  OutlineVersionRow,
} from "@ls/schema/outline";

export const USER_1 = "usr_" + "0".repeat(25) + "1";
export const USER_2 = "usr_" + "0".repeat(25) + "2";

export function version_row(): OutlineVersionRow {
  return {
    outline_version_id: "G6.U4.ov1",
    unit_id: "G6.U4",
    number: 1,
    sha256: "a".repeat(64),
    same_as_version: null,
    source_kind: "xlsx",
    uploaded_by: USER_1,
    created_at: "2026-10-25T00:00:00Z",
    confirmed_at: null,
  };
}

export function choice(
  finding_id: string,
  status: "default" | "confirmed",
  value: string,
  at: string,
  by: string | null = status === "confirmed" ? USER_1 : null,
): IntakeChoiceRow {
  return {
    outline_version_id: "G6.U4.ov1",
    finding_id,
    choice: value,
    status,
    confirmed_by: by,
    at,
  };
}

export function row(
  row_number: number,
  kind: NormalizedRow["kind"],
  lesson_id: string | null,
  extra: Partial<NormalizedRow> = {},
): NormalizedRow {
  return {
    row_number,
    kind,
    lesson_id,
    number: null,
    title: "Synthetic " + row_number,
    lesson_type: "",
    arc: null,
    segments: [],
    focus_codes: [],
    eld_codes: [],
    msls_codes: [],
    vocabulary: [],
    homework: null,
    pages: null,
    text_set: null,
    ...extra,
  };
}

export function finding(
  finding_id: string,
  row_number: number | null,
  level: IntakeFinding["level"],
  kind: string,
  original_text: string,
  proposed_fix: string | null = null,
  default_choice: string | null = null,
): IntakeFinding {
  return {
    finding_id,
    row_number,
    level,
    kind,
    original_text,
    proposed_fix,
    default_choice,
  };
}

export function clean_outline(): NormalizedOutline {
  return {
    unit_as_written: "U4",
    unit_from_filenames: "U4",
    rows: [row(10, "lesson", "G6.U4.L6", { number: 6 })],
    findings: [],
    unit_rules: [],
    counts: {
      lessons: 1,
      flex_days: 0,
      arc_headers: 0,
      totals: 0,
      errors: 0,
      warnings: 0,
    },
  };
}

// Shaped like the issued sheet's CON-3 counts: 41 lessons, 6 flex, 7 arc headers, 1 total.
export function issued_shape_outline(): NormalizedOutline {
  const rows: NormalizedRow[] = [];
  for (let n = 1; n <= 41; n++) {
    rows.push(
      row(n + 2, "lesson", "G6.U4.L" + n, {
        number: n,
        eld_codes: n <= 6 ? ["ELD.X." + n] : [],
      }),
    );
  }
  for (let n = 1; n <= 6; n++)
    rows.push(row(43 + n, "flex_day", "G6.U4.FLEX-" + n + "a"));
  for (let n = 1; n <= 7; n++) rows.push(row(49 + n, "arc_header", null));
  rows.push(row(57, "total", null));
  const findings: IntakeFinding[] = [
    finding("f01", null, "error", "unit_conflict", "U3", "U4", "confirm_unit"),
    finding("f02", 6, "error", "malformed_code", "RL.6.1x", "RL.6.1"),
    finding("f03", 7, "error", "nonexistent_code", "RL.6.99", null),
    finding("f04", 8, "error", "nonexistent_code", "RI.6.99", null),
    finding("f05", 9, "error", "nonexistent_code", "W.6.99", null),
    finding("f06", null, "warning", "bad_filename", "unit4.xlsx"),
    finding("f07", null, "warning", "bad_filename", "unit4 (1).xlsx"),
    finding("f08", 3, "warning", "eld_mismatch", "ELD.X.1", null, "keep"),
    finding(
      "f09",
      3,
      "warning",
      "eld_mismatch",
      "ELD.X.1 (second)",
      null,
      "keep",
    ),
    finding("f10", 4, "warning", "eld_mismatch", "ELD.X.2", null, "keep"),
    finding("f11", 5, "warning", "eld_mismatch", "ELD.X.3", null, "keep"),
    finding("f12", 6, "warning", "eld_mismatch", "ELD.X.4", null, "keep"),
    finding("f13", 7, "warning", "eld_mismatch", "ELD.X.5", null, "keep"),
    finding("f14", 8, "warning", "eld_mismatch", "ELD.X.6", null, "keep"),
  ];
  return {
    unit_as_written: "U3",
    unit_from_filenames: "U4",
    rows,
    findings,
    unit_rules: [],
    counts: {
      lessons: 41,
      flex_days: 6,
      arc_headers: 7,
      totals: 1,
      errors: 5,
      warnings: 9,
    },
  };
}
