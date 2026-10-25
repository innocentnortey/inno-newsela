import { createHash } from "node:crypto";
import type { IntakeFinding, NormalizedOutline, NormalizedRow, SegmentRecord, UnitRuleRecord } from "@ls/schema/outline";
import { IntakeError } from "./errors.ts";
import { compute_link_sources } from "./lesson-links.ts";
import { check_eld_cell, check_standards_cell, msls_codes } from "./normalize-codes.ts";
import type { RawFinding, StandardsLookup } from "./normalize-codes.ts";
import { segment_cell } from "./normalize-segments.ts";
import type { SegmentColumn } from "./normalize-segments.ts";
import type { CellGrid } from "./parse-grid.ts";

export type { StandardResolution, StandardsLookup } from "./normalize-codes.ts";

type ColumnKey =
  | "filename" | "arc" | "lesson_number" | "lesson_type" | "days" | "tdq" | "description" | "text_set"
  | "homework" | "focus" | "additional" | "media" | "performance" | "foundational" | "vocabulary" | "eld";

// [key, cleaned header text, prefix match?]
const COLUMNS: ReadonlyArray<readonly [ColumnKey, string, boolean]> = [
  ["filename", "filename", false],
  ["arc", "lesson", false],
  ["lesson_number", "lesson #", false],
  ["lesson_type", "type of lesson", false],
  ["days", "days", false],
  ["tdq", "text dependent question", true],
  ["description", "lesson description", false],
  ["text_set", "text set choice", false],
  ["homework", "homework", false],
  ["focus", "focus standards", true],
  ["additional", "additional supported", true],
  ["media", "ca media literacy", true],
  ["performance", "skill or content", true],
  ["foundational", "foundational skills focus", false],
  ["vocabulary", "vocabulary", false],
  ["eld", "designated eld", true],
];
const REQUIRED: readonly ColumnKey[] = ["lesson_number", "lesson_type", "description", "focus", "eld"];
const SEGMENT_COLUMNS: ReadonlyArray<readonly [SegmentColumn, ColumnKey]> = [
  ["tdq", "tdq"], ["description", "description"], ["text_set", "text_set"], ["homework", "homework"],
  ["performance", "performance"], ["foundational", "foundational"], ["vocabulary", "vocabulary"],
];
const ERROR_KINDS = new Set(["malformed_code", "nonexistent_code", "unit_conflict", "duplicate_id", "missing_required_column"]);
const OK_KINDS = new Set(["non_breaking_space", "eld_not_checked"]);

const clean = (s: string): string => s.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
const is_blank = (s: string): boolean => /^[\s\u00a0]*$/.test(s);
const hash12 = (s: string): string => createHash("sha256").update(s).digest("hex").slice(0, 12);

function find_header(rows: readonly string[][]): { index: number; cols: Map<ColumnKey, number> } | null {
  for (let i = 0; i < rows.length; i++) {
    const cols = new Map<ColumnKey, number>();
    (rows[i] ?? []).forEach((raw, c) => {
      const t = clean(raw);
      for (const [key, text, prefix] of COLUMNS) {
        if (cols.has(key)) continue;
        if (prefix ? t.startsWith(text) : t === text) {
          cols.set(key, c);
          break;
        }
      }
    });
    if (cols.size >= 8) return { index: i, cols };
  }
  return null;
}

/** Turns a grid into rows, findings and unit rules. Pure and deterministic; cell text is never altered. */
export function normalize_outline(grid: CellGrid, standards: StandardsLookup, max_rows: number): NormalizedOutline {
  const header = find_header(grid.rows);
  if (!header) throw new IntakeError("HEADER_NOT_FOUND", { reason: "no_header_row" });
  const data = grid.rows.slice(header.index + 1);
  const data_rows = data.filter((r) => r.some((c) => !is_blank(c))).length;
  if (data_rows > max_rows) throw new IntakeError("TOO_MANY_ROWS", { max_rows, rows: data_rows });

  const ordinals = new Map<string, number>();
  const findings: IntakeFinding[] = [];
  const add = (row_number: number | null, f: RawFinding): void => {
    const key = `${row_number ?? "g"}|${f.kind}`;
    const ordinal = ordinals.get(key) ?? 0;
    ordinals.set(key, ordinal + 1);
    findings.push({
      finding_id: "f_" + hash12(`${key}|${ordinal}`),
      row_number,
      level: ERROR_KINDS.has(f.kind) ? "error" : OK_KINDS.has(f.kind) ? "ok" : "warning",
      kind: f.kind,
      original_text: f.original_text,
      proposed_fix: f.proposed_fix,
      default_choice: f.default_choice,
    });
  };

  for (const key of REQUIRED) {
    if (!header.cols.has(key)) {
      add(header.index + 1, { kind: "missing_required_column", original_text: key, proposed_fix: null, default_choice: null });
    }
  }
  const get = (row: readonly string[], key: ColumnKey): string => {
    const c = header.cols.get(key);
    return c === undefined ? "" : (row[c] ?? "");
  };

  // Unit: from the title area above the header, and (separately) from the filenames.
  let unit_as_written = "";
  let grade = "";
  let title_cell = "";
  find_unit: for (let i = 0; i < header.index; i++) {
    for (const c of grid.rows[i] ?? []) {
      const m = /G(\d{1,2})\s*,?\s*U(\d{1,2})/i.exec(c);
      if (m) {
        grade = m[1] as string;
        unit_as_written = `U${m[2]}`;
        title_cell = c;
        break find_unit;
      }
    }
  }
  const unit_counts = new Map<string, number>();
  for (const r of data) {
    const m = /_G(\d{1,2})_U(\d{1,2})_/.exec(get(r, "filename"));
    if (m) unit_counts.set(`U${m[2]}`, (unit_counts.get(`U${m[2]}`) ?? 0) + 1);
  }
  let unit_from_filenames: string | null = null;
  let best = 0;
  for (const [u, n] of unit_counts) {
    if (n > best) {
      best = n;
      unit_from_filenames = u;
    }
  }
  const unit_id = unit_as_written === "" ? null : `G${grade}.${unit_as_written}`;
  if (unit_id === null) {
    add(null, { kind: "missing_required_column", original_text: "unit", proposed_fix: null, default_choice: null });
  } else if (unit_from_filenames !== null && unit_from_filenames !== unit_as_written) {
    add(null, { kind: "unit_conflict", original_text: title_cell, proposed_fix: unit_as_written, default_choice: null });
  }

  const rows: NormalizedRow[] = [];
  const rule_sources: Array<{ text: string; row_arc: string | null }> = [];
  const seen_ids = new Set<string>();
  let current_arc_header: string | null = null;
  let flex_group = 0;
  let flex_index = 0;
  let prev_flex = false;

  data.forEach((cells, offset) => {
    if (cells.every(is_blank)) return;
    const row_number = header.index + 2 + offset;
    const arc_cell = get(cells, "arc");
    const type_cell = get(cells, "lesson_type");
    const file_cell = get(cells, "filename");
    const num_cell = get(cells, "lesson_number");
    let kind: NormalizedRow["kind"];
    if (clean(arc_cell) === "flex" || /flex day/i.test(type_cell)) kind = "flex_day";
    else if (is_blank(type_cell) && is_blank(file_cell) && !is_blank(arc_cell)) kind = "arc_header";
    else if (is_blank(arc_cell) && is_blank(file_cell) && is_blank(type_cell) && is_blank(num_cell)) kind = "total";
    else kind = "lesson";

    let lesson_id: string | null = null;
    let number: number | null = null;
    if (kind === "lesson") {
      const m = /^\s*lesson\s*(\d{1,3})\b/i.exec(num_cell);
      if (m) {
        number = Number(m[1]);
        if (unit_id) lesson_id = `${unit_id}.L${number}`;
      }
    } else if (kind === "flex_day") {
      if (!prev_flex) {
        flex_group++;
        flex_index = 0;
      }
      if (unit_id) lesson_id = `${unit_id}.FLEX-${flex_group}${String.fromCharCode(97 + flex_index)}`;
      flex_index++;
    }
    prev_flex = kind === "flex_day";
    if (kind === "arc_header") current_arc_header = arc_cell.trim();
    if (lesson_id !== null) {
      if (seen_ids.has(lesson_id) && kind === "lesson") {
        add(row_number, { kind: "duplicate_id", original_text: num_cell, proposed_fix: null, default_choice: null });
      }
      seen_ids.add(lesson_id);
    }

    // Segments and the cell-level findings that come with them.
    const segments: SegmentRecord[] = [];
    let vocabulary: string[] = [];
    let homework_parts: string[] = [];
    const row_arc: string | null = kind === "total" ? null : kind === "flex_day" ? current_arc_header : arc_cell.trim();
    for (const [column, key] of SEGMENT_COLUMNS) {
      const res = segment_cell(column, get(cells, key));
      segments.push(...res.segments);
      for (const f of res.findings) add(row_number, f);
      for (const t of res.rule_texts) rule_sources.push({ text: t, row_arc });
      if (column === "vocabulary") vocabulary = res.vocabulary;
      if (column === "homework") homework_parts = res.segments.filter((s) => s.kind !== "safety_note").map((s) => s.text);
    }
    const homework_text = homework_parts.join("\n");
    const description = get(cells, "description");
    const text_set = get(cells, "text_set");

    let focus_codes: string[] = [];
    let eld_codes: string[] = [];
    let msls: string[] = [];
    if (kind === "lesson") {
      const focus = check_standards_cell(get(cells, "focus"), standards);
      focus_codes = focus.codes;
      for (const f of focus.findings) add(row_number, f);
      for (const f of check_standards_cell(get(cells, "additional"), standards).findings) add(row_number, f);
      msls = msls_codes(get(cells, "media"));
      const eld_cell = get(cells, "eld");
      if (is_blank(eld_cell)) {
        add(row_number, { kind: "eld_not_checked", original_text: "", proposed_fix: null, default_choice: null });
      } else {
        const eld = check_eld_cell(eld_cell, standards);
        eld_codes = eld.codes;
        for (const f of eld.findings) add(row_number, f);
      }
      const m = /^L(\d{1,3})_ELA_TE_G\d{1,2}_U\d{1,2}_CA_Core$/.exec(file_cell);
      if (!is_blank(file_cell) && !(m && Number(m[1]) === number)) {
        add(row_number, { kind: "bad_filename", original_text: file_cell, proposed_fix: lesson_id, default_choice: "use_lesson_number" });
      }
    }

    const pages = /\bpp?\.\s*(\d+)\s*[–-]\s*(\d+)/.exec(description);
    let lesson_type = "";
    if (kind === "lesson") {
      lesson_type = type_cell.trim().replace(/^Core\s+/, "").replace(/\s*\(.*\)\s*$/, "").replace(/\s+\d+$/, "");
    } else if (kind === "flex_day") lesson_type = "Flex Day";
    const title = kind === "arc_header" ? arc_cell.trim() : kind === "total" ? "" : (description.split("\n").find((l) => !is_blank(l)) ?? "").trim();

    rows.push({
      row_number,
      kind,
      lesson_id,
      number,
      title,
      lesson_type,
      arc: row_arc,
      segments,
      focus_codes,
      eld_codes,
      msls_codes: msls,
      vocabulary,
      homework: is_blank(homework_text) ? null : homework_text,
      pages: pages ? `${pages[1]}–${pages[2]}` : null,
      text_set: is_blank(text_set) ? null : text_set,
    });
  });

  // Unit rules, scoped to the arc they name (or the arc of their own row).
  const arc_names = rows.filter((r) => r.kind === "arc_header").map((r) => r.title);
  const unit_rules: UnitRuleRecord[] = rule_sources.map((src) => {
    const lower = src.text.toLowerCase();
    const named = arc_names.filter((n) => n !== "" && lower.includes(n.toLowerCase())).sort((a, b) => b.length - a.length)[0];
    const scope = (named ?? src.row_arc ?? "").toLowerCase();
    const ids = rows
      .filter((r) => r.kind === "lesson" && r.lesson_id !== null && (r.arc ?? "").toLowerCase() === scope)
      .map((r) => r.lesson_id as string);
    return { text: src.text, scope_lesson_ids: ids };
  });
  for (const rule of unit_rules) {
    const cap = /cap at (\d+) words/i.exec(rule.text);
    if (!cap) continue;
    const limit = Number(cap[1]);
    for (const r of rows) {
      if (r.lesson_id !== null && rule.scope_lesson_ids.includes(r.lesson_id) && r.vocabulary.length > limit) {
        const cell = grid.rows[r.row_number - 1];
        add(r.row_number, {
          kind: "vocabulary_over_cap",
          original_text: cell ? get(cell, "vocabulary") : "",
          proposed_fix: `${limit} + ${r.vocabulary.length - limit}`,
          default_choice: "confirm_split",
        });
      }
    }
  }

  // A homework link that points at a later row is worth a warning on the source row.
  const row_by_id = new Map(rows.map((r) => [r.lesson_id, r]));
  const row_of = (id: string): NormalizedRow | undefined => row_by_id.get(id);
  for (const { link, line } of compute_link_sources(rows)) {
    if (link.kind === "page_continuation") continue;
    const from = row_of(link.from_lesson_id);
    const to = row_of(link.to_lesson_id);
    if (from && to && to.row_number > from.row_number) {
      add(from.row_number, { kind: "homework_links_later_row", original_text: line, proposed_fix: null, default_choice: "keep_link" });
    }
  }

  findings.sort((a, b) => (a.finding_id < b.finding_id ? -1 : a.finding_id > b.finding_id ? 1 : 0));
  rows.sort((a, b) => a.row_number - b.row_number);
  const count = (k: NormalizedRow["kind"]): number => rows.filter((r) => r.kind === k).length;
  return {
    unit_as_written,
    unit_from_filenames,
    rows,
    findings,
    unit_rules,
    counts: {
      lessons: count("lesson"),
      flex_days: count("flex_day"),
      arc_headers: count("arc_header"),
      totals: count("total"),
      errors: findings.filter((f) => f.level === "error").length,
      warnings: findings.filter((f) => f.level === "warning").length,
    },
  };
}
