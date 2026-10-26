// Pure display model for SCR-4. No React, no I/O. It never derives generate_allowed or errors_unconfirmed:
// those come from the API (R-5); the copy helpers below only describe what the API said.
import type { components } from "@/lib/api-types";

export type Report = components["schemas"]["ValidationReport"];
export type Row = components["schemas"]["ReportRow"];
export type Finding = components["schemas"]["Finding"];
export type Segment = components["schemas"]["Segment"];
export type EldEntry = components["schemas"]["EldEntry"];
export type Counts = components["schemas"]["ReportCounts"];
export type UnitRule = components["schemas"]["UnitRule"];
export type ChoiceRequest = components["schemas"]["IntakeChoiceRequest"];
export type ChoiceResult = components["schemas"]["IntakeChoiceResult"];

/** The full unit id ("G6.U4") behind a report's version id ("G6.U4.ov1"); null when it does not look like one (F-1). */
export function unit_id_of(report: Report): string | null {
  const id = report.outline_version_id.replace(/\.ov\d+$/, "");
  return /^G\d{1,2}\.U\d{1,2}$/.test(id) ? id : null;
}

export interface TargetStatus {
  request: ChoiceRequest;
  phase: "saving" | "failed";
  /** A server sentence to show instead of the generic failure copy (INVALID_CHOICE, INVALID_TRANSITION). */
  message: string | null;
}

export interface ReportActions {
  choose(req: ChoiceRequest): Promise<boolean>;
  retry(targetId: string): Promise<boolean>;
  undo(targetId: string): Promise<boolean>;
  generate(): Promise<void>;
}

export interface ErrorItem {
  row: Row | null;
  finding: Finding;
  where: string;
  name: string;
}

export type WarningItem =
  | { type: "note"; row: Row; segment: Segment }
  | { type: "writer_task"; row: Row; segment: Segment }
  | { type: "finding"; row: Row; finding: Finding }
  | { type: "unit_rule"; rule: UnitRule };

/** finding_ids: the eld_mismatch findings that name this code; the choices route stores an ELD choice per finding, not per code. */
export type EldItem = EldEntry & { rows: number[]; finding_ids: string[] };

export const choiceFailedCopy = "Couldn't save this choice. Try again.";

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function rowsLabel(rows: number[]): string {
  if (rows.length === 0) return "";
  const sorted = [...rows].sort((a, b) => a - b);
  const contiguous = sorted.every((r, i) => i === 0 || r === (sorted[i - 1] ?? 0) + 1);
  if (contiguous && sorted.length > 1) return `${sorted[0]}–${sorted[sorted.length - 1]}`;
  return sorted.join(", ");
}

export function lessonNumber(lessonId: string | null): string | null {
  if (!lessonId) return null;
  const m = /L(\d+)$/.exec(lessonId);
  return m?.[1] ?? null;
}

function rowWhere(row: Row): string {
  const k = lessonNumber(row.lesson_id);
  return k && row.kind === "lesson" ? `Row ${row.row_number} · Lesson ${k}` : `Row ${row.row_number}`;
}

export function errorItems(report: Report): ErrorItem[] {
  const rows = [...report.rows].sort((a, b) => a.row_number - b.row_number);
  const items: ErrorItem[] = [];
  const unit = report.unit.finding;
  if (unit) items.push({ row: null, finding: unit, where: "Unit", name: "the unit" });
  for (const row of rows) {
    const errs = row.findings.filter((f) => f.level === "error");
    for (const finding of errs) {
      if (finding.kind === "unit_conflict") {
        if (!unit) items.push({ row, finding, where: "Unit", name: "the unit" });
      } else {
        items.push({
          row,
          finding,
          where: `${rowWhere(row)} · Column ${finding.column}`,
          name: errs.length > 1 ? `row ${row.row_number}, column ${finding.column}` : `row ${row.row_number}`,
        });
      }
    }
  }
  return items;
}

export function warningItems(report: Report): WarningItem[] {
  const rows = [...report.rows].sort((a, b) => a.row_number - b.row_number);
  const items: WarningItem[] = [];
  for (const row of rows) {
    for (const segment of row.segments) {
      if (segment.kind === "editor_note" || segment.kind === "safety_note") items.push({ type: "note", row, segment });
      else if (segment.kind === "writer_task") items.push({ type: "writer_task", row, segment });
    }
    for (const finding of row.findings) {
      if (finding.level === "error") continue;
      if (finding.kind === "eld_mismatch" || finding.kind === "eld_not_checked") continue;
      items.push({ type: "finding", row, finding });
    }
  }
  for (const rule of report.unit_rules) items.push({ type: "unit_rule", rule });
  return items;
}

export function eldItems(report: Report): EldItem[] {
  const byCode = new Map<string, EldItem>();
  for (const row of report.rows) {
    for (const e of row.eld) {
      const ids = row.findings.filter((f) => f.kind === "eld_mismatch" && f.original_text.includes(e.code)).map((f) => f.finding_id);
      const seen = byCode.get(e.code);
      if (!seen) {
        byCode.set(e.code, { ...e, rows: [row.row_number], finding_ids: ids });
        continue;
      }
      seen.rows.push(row.row_number);
      seen.finding_ids.push(...ids);
      // The API judges each row on its own; a code flagged on any row is flagged (found on the real stack, NL-94).
      if (e.verdict === "mismatch" && seen.verdict !== "mismatch") Object.assign(seen, { verdict: e.verdict, sheet_label: e.sheet_label, official_strand: e.official_strand, suggested_remap: e.suggested_remap });
      if (e.choice === "remap") seen.choice = "remap";
    }
  }
  return [...byCode.values()];
}

export function flaggedEld(report: Report): EldItem[] {
  return eldItems(report).filter((i) => i.verdict === "mismatch");
}

export function eldSummary(report: Report): { total: number; flagged: number } {
  const items = eldItems(report);
  return { total: items.length, flagged: items.filter((i) => i.verdict === "mismatch").length };
}

export function okRows(report: Report): Row[] {
  return report.rows.filter((r) => r.level === "ok");
}

export function okRowLabel(row: Row): string {
  const k = lessonNumber(row.lesson_id);
  const what = row.kind === "flex_day" ? "Flex day" : k ? `Lesson ${k}` : row.kind;
  return `Row ${row.row_number} · ${what} · OK · 0 warnings`;
}

export function headingCopy(counts: Counts): string {
  if (counts.errors_unconfirmed === 0 && counts.errors > 0) return `All ${counts.errors} errors confirmed`;
  const u = counts.errors_unconfirmed;
  return `${u} ${plural(u, "error", "errors")} to confirm`;
}

/** Display copy only; never derive generate_allowed from it. */
export function gateBanner(report: Report): { level: "advisory" | "success"; title: string; body?: string } {
  const { errors, errors_unconfirmed: u, warnings: w } = report.counts;
  if (errors === 0) return { level: "success", title: `No errors to confirm. ${w} ${plural(w, "warning", "warnings")}.` };
  if (u === 0) return { level: "success", title: `All ${errors} errors confirmed. Generate is on.` };
  if (u === errors) return { level: "advisory", title: `${u} errors to confirm`, body: `Generate stays off: ${u} errors to confirm` };
  return { level: "advisory", title: `${u} ${plural(u, "error", "errors")} still to confirm` };
}

export function refusalCopy(n: number): string {
  return `Generate refused: ${n} ${plural(n, "error", "errors")} still to confirm.`;
}

export function applyChoiceResult(report: Report, result: ChoiceResult): Report {
  const eldChoice = new Map(result.row.eld.map((e) => [e.code, e.choice]));
  const rows = report.rows.map((r) => {
    if (r.row_number === result.row.row_number) return result.row;
    if (r.eld.length === 0 || eldChoice.size === 0) return r;
    return { ...r, eld: r.eld.map((e) => (eldChoice.has(e.code) ? { ...e, choice: eldChoice.get(e.code)! } : e)) };
  });
  return { ...report, rows, counts: result.counts, generate_allowed: result.generate_allowed };
}
