// Synthetic SCR-4 data. No Playwright import, so unit tests can use it too. Shapes follow the OpenAPI row8 example
// and WP-5; every name, time and code is invented. No restricted material.
import type { components } from "../../src/lib/api-types";

type S = components["schemas"];
export type Report = S["ValidationReport"];
export type Row = S["ReportRow"];
export type Finding = S["Finding"];
export type UnitList = S["UnitList"];

export const CHEN = "A. Chen";
export const CONFIRMED_AT = "2026-10-25T10:42:00Z";
const SHA1 = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678901234567890abcdef123456";
const SHA2 = "b2c3d4e5f60718293a4b5c6d7e8f9012345678901234567890abcdef1234567a";
export const RUN_STARTED_AT = "2026-10-25T10:50:00Z";

const none = () => ({ value: null, source: "default" as const, by: null, at: null });

function finding(id: string, kind: Finding["kind"], level: Finding["level"], column: string, original: string, fix: string | null): Finding {
  return { finding_id: id, kind, level, column, original_text: original, proposed_fix: fix, choice: none() };
}

function row(n: number, lesson: number | null, extra: Partial<Row> = {}): Row {
  return {
    row_number: n,
    kind: lesson === null ? "flex_day" : "lesson",
    lesson_id: lesson === null ? null : `G6.U4.L${lesson}`,
    level: "ok",
    findings: [],
    segments: [],
    eld: [],
    flags: [],
    ...extra,
  };
}

function eld(code: string, mismatch: boolean): S["EldEntry"] {
  return {
    code,
    sheet_label: mismatch ? "Sheet label for " + code : "Matches " + code,
    official_strand: "Official strand for " + code,
    verdict: mismatch ? "mismatch" : "fits",
    suggested_remap: mismatch ? `ELD.PI.6.${code.slice(-1)}` : null,
    choice: "keep",
  };
}

const COUNTS: S["ReportCounts"] = {
  teaching_days: 47,
  lessons: 40,
  flex_days: 7,
  arc_headers: 0,
  total_rows: 47,
  errors: 5,
  errors_unconfirmed: 5,
  warnings: 8,
  unit_conflicts: 1,
  malformed_codes: 1,
  rows_with_nonexistent_code: 3,
  bad_filenames: 2,
  eld_mismatches: 16,
};

/** 12 distinct ELD codes, exactly 7 flagged, spread over rows (two rows carry a repeated code). */
function eldRows(): Row[] {
  const codes = Array.from({ length: 12 }, (_, i) => `ELD.PII.6.${i + 1}`);
  const flagged = new Set([1, 2, 3, 5, 8, 9, 11]);
  const rows: Row[] = [];
  codes.forEach((code, i) => {
    rows.push(row(41 + i, 10 + i, { eld: [eld(code, flagged.has(i + 1))], level: flagged.has(i + 1) ? "warning" : "info" }));
  });
  rows.push(row(53, 22, { eld: [eld(codes[0]!, true)], level: "warning" })); // repeats code 1
  return rows;
}

export function issuedShapeReport(): Report {
  const rows: Row[] = [
    row(7, 1, {
      level: "error",
      findings: [
        finding("f-unit", "unit_conflict", "error", "A", "U4", "U4"),
        finding("f-bad-1", "bad_filename", "warning", "C", "g6-u3-lesson-1.pdf", null),
        finding("f-bad-2", "bad_filename", "warning", "C", "g6-u3-lesson-2.pdf", null),
      ],
    }),
    row(8, 4, {
      level: "error",
      findings: [finding("f-row8", "malformed_code", "error", "J", "RL.6.1, 6.2 L.6.4", "RL.6.1, RL.6.2, L.6.4")],
      segments: [
        { segment_id: "s-note-8", column: "N", kind: "editor_note", text: "Ask Priya for an alternate text", action: "apply", source: "default", by: null },
      ],
    }),
    row(9, 5, {
      level: "warning",
      segments: [{ segment_id: "s-task-9", column: "K", kind: "writer_task", text: "Writer to draft a short excerpt", action: null, source: "default", by: null }],
    }),
    row(12, 8, { level: "warning", findings: [finding("f-vocab", "vocabulary_over_cap", "warning", "H", "nine words listed", null)] }),
    row(30, 20, { level: "error", findings: [finding("f-30", "nonexistent_code", "error", "J", "RL.6.9.a", "RL.6.9")] }),
    row(34, 24, { level: "error", findings: [finding("f-34", "nonexistent_code", "error", "J", "RL.6.9.a", "RL.6.9")] }),
    row(39, 29, {
      level: "error",
      findings: [
        finding("f-39", "nonexistent_code", "error", "J", "RL.6.9.a", "RL.6.9"),
        finding("f-safety-39", "safety_note_proposed", "warning", "N", "Check allergy list", null),
      ],
    }),
    ...eldRows(),
    ...Array.from({ length: 35 }, (_, i) => (i % 7 === 6 ? row(60 + i, null) : row(60 + i, 30 + i))),
  ];
  return {
    outline_version_id: "G6.U4.ov1",
    version_number: 1,
    sha256: SHA1,
    same_as_version: null,
    unit: { as_written: "U4", filenames_say: "U3", confirmed: false, confirmed_by: null },
    counts: { ...COUNTS },
    rows,
    unit_rules: [{ text: "Teach in pairs", scope_rows: Array.from({ length: 16 }, (_, i) => 8 + i), source: "default" }],
    runs_from_this_version: [],
    generate_allowed: false,
  };
}

/** WP-5: a clean control row, 0 errors, 0 warnings, Generate on. */
export function cleanReport(): Report {
  return {
    outline_version_id: "G6.U4.ov1",
    version_number: 1,
    sha256: SHA1,
    same_as_version: null,
    unit: { as_written: "U4", filenames_say: "U4", confirmed: true, confirmed_by: CHEN },
    counts: { ...COUNTS, errors: 0, errors_unconfirmed: 0, warnings: 0, unit_conflicts: 0, malformed_codes: 0, rows_with_nonexistent_code: 0, bad_filenames: 0, eld_mismatches: 0 },
    rows: Array.from({ length: 10 }, (_, i) => row(10 + i, 6 + i)),
    unit_rules: [],
    runs_from_this_version: [],
    generate_allowed: true,
  };
}

/** Same shape as the issued report, with markup in every cell string. */
export function markupReport(): Report {
  const r = issuedShapeReport();
  const bad = "<script>alert(1)</script>";
  const bold = "<b>x</b>";
  const row8 = r.rows.find((x) => x.row_number === 8)!;
  row8.findings[0] = { ...row8.findings[0]!, original_text: bad, proposed_fix: bold };
  row8.segments[0] = { ...row8.segments[0]!, text: bold };
  const flagged = r.rows.find((x) => x.eld.some((e) => e.verdict === "mismatch"))!;
  flagged.eld[0] = { ...flagged.eld[0]!, sheet_label: bad, official_strand: bold };
  r.unit_rules[0] = { ...r.unit_rules[0]!, text: bold };
  r.unit = { ...r.unit, filenames_say: bad };
  return r;
}

export function confirmAllErrors(r: Report): Report {
  const out = structuredClone(r);
  for (const row of out.rows) {
    for (const f of row.findings) {
      if (f.level === "error") f.choice = { value: f.proposed_fix, source: "confirmed", by: CHEN, at: CONFIRMED_AT };
    }
  }
  out.counts.errors_unconfirmed = 0;
  out.generate_allowed = true;
  return out;
}

export function confirmSome(r: Report, ids: string[]): Report {
  const out = structuredClone(r);
  for (const row of out.rows) {
    for (const f of row.findings) {
      if (ids.includes(f.finding_id)) f.choice = { value: f.proposed_fix, source: "confirmed", by: CHEN, at: CONFIRMED_AT };
    }
  }
  out.counts.errors_unconfirmed = out.counts.errors - ids.length;
  return out;
}

export function withRun(r: Report): Report {
  return { ...structuredClone(r), runs_from_this_version: [{ run_id: "run-1", started_at: RUN_STARTED_AT, choices_hash: SHA2 }] };
}

function version(n: number, created: string, same: number | null): S["OutlineVersion"] {
  return {
    outline_version_id: `G6.U4.ov${n}`,
    unit_id: "unit-g6-u4",
    unit_key: "g6-u4",
    version_number: n,
    sha256: n === 1 ? SHA1 : SHA2,
    same_as_version: same,
    changed_lessons: same ? 0 : 3,
    row_counts: { lessons: 40, flex_days: 7, arc_headers: 0, total_rows: 47 },
    created_at: created,
    created_by: CHEN,
  };
}

export function unitsFixture(versions: 1 | 2 = 1, v2SameAs: number | null = null): UnitList {
  const vs = [version(1, "2026-10-25T09:30:00Z", null)];
  if (versions === 2) vs.push(version(2, "2026-10-25T11:05:00Z", v2SameAs));
  return { units: [{ unit_id: "unit-g6-u4", unit_key: "g6-u4", title: "Grade 6 · Unit 4", versions: vs, latest_run: null }] };
}
