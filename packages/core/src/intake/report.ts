// Pure: builds the CON-3 ValidationReport and decides the CON-5 Generate gate from stored data.
import type { ErrorCode } from "@ls/schema/api/common";
import type {
  EldEntry,
  Finding,
  ReportCounts,
  ReportRow,
  Segment,
  UnitRule,
  ValidationReport,
} from "@ls/schema/api/outlines";
import type {
  IntakeChoiceRow,
  IntakeFinding,
  NormalizedOutline,
  NormalizedRow,
  OutlineVersionRow,
} from "@ls/schema/outline";

export interface GateDecision {
  allowed: boolean;
  refusals: ErrorCode[];
  details: { unconfirmed_finding_ids: string[] };
}

type FindingKind = Finding["kind"];

// Presentation-only column names; the stored finding has no column (plan open item 1).
const KIND_COLUMN: Record<FindingKind, string> = {
  malformed_code: "Focus",
  nonexistent_code: "Focus",
  parent_code: "Focus",
  unit_conflict: "Unit",
  bad_filename: "Filename",
  duplicate_id: "Lesson #",
  missing_required_column: "Header",
  eld_mismatch: "ELD",
  eld_not_checked: "ELD",
  vocabulary_over_cap: "Vocabulary",
  vocabulary_word_missing: "Vocabulary",
  homework_links_later_row: "Homework",
  safety_note_proposed: "Homework",
  non_breaking_space: "Description",
  duplicate_text: "Description",
  instruction_shaped: "Description",
  writer_task: "Description",
};

const SEGMENT_COLUMN: Record<Segment["kind"], string> = {
  content: "Description",
  writer_task: "Description",
  editor_note: "Description",
  unit_rule: "Description",
  safety_note: "Homework",
};

const ACTIONS = new Set(["apply", "show_only", "ignore"]);

function lt(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function as_kind(kind: string): FindingKind {
  if (!Object.prototype.hasOwnProperty.call(KIND_COLUMN, kind)) {
    throw new Error("UNKNOWN_FINDING_KIND:" + kind);
  }
  return kind as FindingKind;
}

// Latest choice per target: order by parsed `at`; ties go to the later array position.
function latest_by_target(
  choices: readonly IntakeChoiceRow[],
  version_id: string | null,
): Map<string, IntakeChoiceRow> {
  const out = new Map<string, IntakeChoiceRow>();
  for (const c of choices) {
    if (version_id !== null && c.outline_version_id !== version_id) continue;
    const prev = out.get(c.finding_id);
    if (prev === undefined || Date.parse(c.at) >= Date.parse(prev.at))
      out.set(c.finding_id, c);
  }
  return out;
}

function confirmed_choice(
  latest: Map<string, IntakeChoiceRow>,
  target: string,
): IntakeChoiceRow | null {
  const c = latest.get(target);
  return c !== undefined && c.status === "confirmed" ? c : null;
}

function unconfirmed_error_ids(
  outline: NormalizedOutline,
  latest: Map<string, IntakeChoiceRow>,
): string[] {
  return outline.findings
    .filter(
      (f) =>
        f.level === "error" && confirmed_choice(latest, f.finding_id) === null,
    )
    .map((f) => f.finding_id)
    .sort(lt);
}

function report_finding(
  f: IntakeFinding,
  latest: Map<string, IntakeChoiceRow>,
): Finding {
  const kind = as_kind(f.kind);
  const c = confirmed_choice(latest, f.finding_id);
  return {
    finding_id: f.finding_id,
    level: f.level === "error" ? "error" : "warning",
    kind,
    column: KIND_COLUMN[kind],
    original_text: f.original_text,
    proposed_fix: f.proposed_fix,
    choice:
      c === null
        ? { value: f.default_choice, source: "default", by: null, at: null }
        : {
            value: c.choice,
            source: "confirmed",
            by: c.confirmed_by,
            at: c.at,
          },
  };
}

function report_row(
  row: NormalizedRow,
  findings: Finding[],
  latest: Map<string, IntakeChoiceRow>,
): ReportRow {
  const level = findings.some((f) => f.level === "error")
    ? "error"
    : findings.some((f) => f.level === "warning")
      ? "warning"
      : "ok";
  const segments: Segment[] = row.segments.map((s, i) => {
    const segment_id = "S" + row.row_number + "." + i;
    const c = confirmed_choice(latest, segment_id);
    let action: Segment["action"] = s.kind === "content" ? null : s.applies;
    if (c !== null && ACTIONS.has(c.choice))
      action = c.choice as "apply" | "show_only" | "ignore";
    return {
      segment_id,
      column: SEGMENT_COLUMN[s.kind],
      kind: s.kind,
      text: s.text,
      action,
      source: c === null ? "default" : "confirmed",
      by: c === null ? null : c.confirmed_by,
    };
  });
  const not_checked = findings.some((f) => f.kind === "eld_not_checked");
  const eld: EldEntry[] = row.eld_codes.map((code) => {
    const mismatch = findings.find(
      (f) => f.kind === "eld_mismatch" && f.original_text.includes(code),
    );
    const remap =
      mismatch !== undefined &&
      mismatch.choice.source === "confirmed" &&
      mismatch.choice.value === "remap";
    return {
      code,
      sheet_label: "",
      official_strand: "",
      verdict:
        mismatch !== undefined
          ? "mismatch"
          : not_checked
            ? "not_checked"
            : "fits",
      suggested_remap: null,
      choice: remap ? "remap" : "keep",
    };
  });
  return {
    row_number: row.row_number,
    kind: row.kind,
    lesson_id: row.lesson_id,
    level,
    findings,
    segments,
    eld,
    flags: row.segments.some((s) => s.instruction_shaped)
      ? ["instruction_shaped"]
      : [],
  };
}

export function build_validation_report(
  version: OutlineVersionRow,
  outline: NormalizedOutline,
  choices: readonly IntakeChoiceRow[],
): ValidationReport {
  const latest = latest_by_target(choices, version.outline_version_id);
  const findings = outline.findings
    .filter((f) => f.level !== "ok")
    .slice()
    .sort((a, b) => lt(a.finding_id, b.finding_id));
  const rows = outline.rows.slice().sort((a, b) => a.row_number - b.row_number);

  const rows_out = rows.map((r) =>
    report_row(
      r,
      findings
        .filter((f) => f.row_number === r.row_number)
        .map((f) => report_finding(f, latest)),
      latest,
    ),
  );

  const count_kind = (k: string): number =>
    findings.filter((f) => f.kind === k).length;
  const row_kind = (k: NormalizedRow["kind"]): number =>
    rows.filter((r) => r.kind === k).length;
  const errors = findings.filter((f) => f.level === "error");
  const errors_unconfirmed = unconfirmed_error_ids(outline, latest).length;
  const nonexistent_rows = new Set(
    findings
      .filter((f) => f.kind === "nonexistent_code" && f.row_number !== null)
      .map((f) => f.row_number),
  );
  const counts: ReportCounts = {
    teaching_days: row_kind("lesson") + row_kind("flex_day"),
    lessons: row_kind("lesson"),
    flex_days: row_kind("flex_day"),
    arc_headers: row_kind("arc_header"),
    total_rows: row_kind("total"),
    errors: errors.length,
    errors_unconfirmed,
    warnings: findings.filter((f) => f.level === "warning").length,
    unit_conflicts: count_kind("unit_conflict"),
    malformed_codes: count_kind("malformed_code"),
    rows_with_nonexistent_code: nonexistent_rows.size,
    bad_filenames: count_kind("bad_filename"),
    eld_mismatches: count_kind("eld_mismatch"),
  };

  const conflicts = findings.filter((f) => f.kind === "unit_conflict");
  const conflict_choices = conflicts.map((f) =>
    confirmed_choice(latest, f.finding_id),
  );
  const confirmed_list = conflict_choices.filter(
    (c): c is IntakeChoiceRow => c !== null,
  );
  const unit_confirmed =
    conflicts.length > 0 && confirmed_list.length === conflicts.length;
  let confirmed_by: string | null = null;
  let best = -Infinity;
  if (unit_confirmed) {
    for (const c of confirmed_list) {
      if (Date.parse(c.at) >= best) {
        best = Date.parse(c.at);
        confirmed_by = c.confirmed_by;
      }
    }
  }

  const unit_rules: UnitRule[] = outline.unit_rules.map((rule, i) => {
    const scope = new Set(rule.scope_lesson_ids);
    const scope_rows = [
      ...new Set(
        rows
          .filter((r) => r.lesson_id !== null && scope.has(r.lesson_id))
          .map((r) => r.row_number),
      ),
    ].sort((a, b) => a - b);
    return {
      text: rule.text,
      scope_rows,
      source:
        confirmed_choice(latest, "unit_rule:" + i) === null
          ? "default"
          : "confirmed",
    };
  });

  return {
    outline_version_id: version.outline_version_id,
    version_number: version.number,
    sha256: version.sha256,
    same_as_version: version.same_as_version,
    unit: {
      as_written: outline.unit_as_written,
      filenames_say: outline.unit_from_filenames,
      confirmed: unit_confirmed,
      confirmed_by,
    },
    counts,
    rows: rows_out,
    unit_rules,
    runs_from_this_version: [],
    generate_allowed: errors_unconfirmed === 0,
  };
}

export function generate_gate(
  outline: NormalizedOutline,
  choices: readonly IntakeChoiceRow[],
): GateDecision {
  const ids = unconfirmed_error_ids(outline, latest_by_target(choices, null));
  if (ids.length === 0) {
    return {
      allowed: true,
      refusals: [],
      details: { unconfirmed_finding_ids: [] },
    };
  }
  return {
    allowed: false,
    refusals: ["VALIDATION_INCOMPLETE"],
    details: { unconfirmed_finding_ids: ids },
  };
}
