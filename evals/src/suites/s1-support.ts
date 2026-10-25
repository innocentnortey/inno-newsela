// NL-84: S1 helpers. Grid selection, fixed-order projections of (outline, report), exact comparison.
import type { JsonValue } from "@ls/core/ports/common";
import { IntakeError } from "@ls/core/intake/errors";
import { normalize_outline } from "@ls/core/intake/normalize";
import { build_validation_report } from "@ls/core/intake/report";
import { load_standards_index } from "@ls/core/intake/standards-index";
import type { CellGrid } from "@ls/core/intake/parse-grid";
import type { NormalizedOutline } from "@ls/schema/outline";
import { grid_from_rows, load_issued_grid, load_syn2_grid, load_syn3_grid } from "../../../packages/core/tests/fixtures/outline/index.ts";

export const DEFECT_KINDS = ["malformed_code", "nonexistent_code", "unit_conflict", "bad_filename", "eld_mismatch", "duplicate_id", "missing_required_column"] as const;
const PARTIAL_CODES = ["ELD.PI.6.6", "ELD.PI.6.7"];
const ELD_CODE = /ELD\.P(?:I|II)\.\d+\.?\d*[a-z]?/;
const VERSION = { outline_version_id: "G6.U4.ov1", unit_id: "G6.U4", number: 1, sha256: "0".repeat(64), same_as_version: null, source_kind: "upload_csv", uploaded_by: "usr_syn", created_at: "2026-10-25T00:00:00.000Z", confirmed_at: null } as never;

export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v !== null && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

export function grid_for(input: JsonValue): CellGrid {
  const i = input as { grid: string; sheet_rows?: number[]; blank_header_prefix?: string };
  if (i.grid === "issued") return load_issued_grid();
  if (i.grid === "syn2") return load_syn2_grid();
  if (i.grid === "syn3") return load_syn3_grid();
  const g = grid_from_rows(i.sheet_rows ?? []);
  const prefix = i.blank_header_prefix;
  if (prefix === undefined) return g;
  const rows = g.rows.map((r) => r.slice());
  rows[1] = (rows[1] ?? []).map((c) => (c.toLowerCase().startsWith(prefix) ? "x" : c));
  return { rows, sheet_name: g.sheet_name };
}

export const run_normalizer = (grid: CellGrid): NormalizedOutline => normalize_outline(grid, load_standards_index(), 200);

export const load_issued_outline = (): NormalizedOutline => run_normalizer(load_issued_grid());

export function drop_kind(kind: string): (o: NormalizedOutline) => NormalizedOutline {
  return (o) => ({ ...o, findings: o.findings.filter((f) => f.kind !== kind) });
}

const count_kind = (o: NormalizedOutline, kind: string): number => o.findings.filter((f) => f.kind === kind).length;

function eld_codes_by_finding(o: NormalizedOutline): string[] {
  return o.findings.filter((f) => f.kind === "eld_mismatch").map((f) => ELD_CODE.exec(f.original_text)?.[0] ?? "?");
}

/** Row numbers are stripped so the shifted SYN-2 layout compares with the issued sheet. */
export function stripped_view(o: NormalizedOutline): string {
  const rows = o.rows.map((r) => ({ ...r, row_number: 0 }));
  const findings = o.findings.map((f) => JSON.stringify({ ...f, finding_id: "", row_number: f.row_number === null ? null : 0 })).sort();
  return canonical({ counts: o.counts, rows, findings, unit_rules: o.unit_rules });
}

export function project(key: string, expected: Record<string, unknown>, o: NormalizedOutline, report_of: () => ReturnType<typeof build_validation_report>): JsonValue {
  const report = report_of();
  switch (key) {
    case "counts": return { ...report.counts };
    case "generate_allowed": return report.generate_allowed;
    case "defect_kinds": return Object.fromEntries(DEFECT_KINDS.map((k) => [k, count_kind(o, k)]));
    case "unit_as_written": return o.unit_as_written;
    case "unit_from_filenames": return o.unit_from_filenames;
    case "nonexistent_findings": return count_kind(o, "nonexistent_code");
    case "eld_mismatch_whole_code_set": return [...new Set(eld_codes_by_finding(o))].filter((c) => !PARTIAL_CODES.includes(c)).sort();
    case "eld_partial_code_label_mismatches": {
      const codes = eld_codes_by_finding(o);
      return Object.fromEntries(PARTIAL_CODES.map((c) => [c, codes.filter((x) => x === c).length]));
    }
    case "row_index": return o.rows.map((r) => ({ row_number: r.row_number, kind: r.kind, lesson_id: r.lesson_id }));
    case "row": {
      const n = (expected["row"] as { row_number: number }).row_number;
      const r = o.rows.find((x) => x.row_number === n);
      return r === undefined ? null : { row_number: n, lesson_id: r.lesson_id, lesson_type: r.lesson_type, focus_codes: r.focus_codes, eld_codes: r.eld_codes, vocabulary_count: r.vocabulary.length };
    }
    case "row_report": {
      const n = (expected["row_report"] as { row_number: number }).row_number;
      const r = o.rows.find((x) => x.row_number === n);
      const rr = report.rows.find((x) => x.row_number === n);
      if (r === undefined || rr === undefined) return null;
      return {
        row_number: n, level: rr.level, finding_count: rr.findings.length, lesson_id: r.lesson_id, lesson_type: r.lesson_type,
        focus_codes: r.focus_codes, vocabulary_count: r.vocabulary.length, has_editor_note: r.segments.some((s) => s.kind === "editor_note"),
      };
    }
    case "safety_proposals_on_row": {
      const n = (expected["safety_proposals_on_row"] as { row_number: number }).row_number;
      return { row_number: n, count: o.findings.filter((f) => f.kind === "safety_note_proposed" && f.row_number === n).length };
    }
    default: throw new Error(`unknown S1 expected key: ${key}`);
  }
}

export function build_report(o: NormalizedOutline): ReturnType<typeof build_validation_report> {
  return build_validation_report(VERSION, o, []);
}

export function is_intake_error(e: unknown): e is IntakeError {
  return e instanceof IntakeError;
}
