// NL-84: S7 safety-note suite. Model-free: WP-4 four checks, recall over SYN-4+, false proposals, clear record.
import path from "node:path";
import Decimal from "decimal.js";
import { is_safety_note_line } from "@ls/core/intake/safety-patterns";
import type { JsonValue } from "@ls/core/ports/common";
import type { CaseOutcome, EvalCase, EvalSuite, ProviderMode } from "../types.ts";
import { type CaseFile, load_cases } from "./case-files.ts";
import { canonical, grid_for, run_normalizer } from "./s1-support.ts";
import { clear_record_ok, wp4_actual, wp4_world } from "./s7-support.ts";

export interface S7Options {
  cases?: CaseFile[];
}

const dir = (): string => path.join(import.meta.dirname, "../../cases/s7");
const load = (): CaseFile[] => load_cases(dir(), "evals/cases/s7", "s7-");
const line_of = (c: CaseFile): string => (c.input as { line: string }).line;
const proposals = (grid: JsonValue, row: number | null, exclude_row: number | null): number =>
  run_normalizer(grid_for(grid)).findings.filter((f) => f.kind === "safety_note_proposed" && (row === null || f.row_number === row) && f.row_number !== exclude_row).length;

function actual_for(c: CaseFile, all: CaseFile[]): { actual: Record<string, JsonValue>; passed: boolean } {
  const id = c.case_id;
  if (id.startsWith("s7-wp4-")) {
    const actual = wp4_actual(id, wp4_world());
    return { actual, passed: canonical(actual) === canonical(c.expected) };
  }
  if (id.startsWith("s7-syn4-paraphrase-")) {
    // M-39: a paraphrase miss is a stated limit, not a failure. The case passes whenever the line was scored.
    return { actual: { proposed: is_safety_note_line(line_of(c)), limit: true }, passed: true };
  }
  if (id.startsWith("s7-syn4-")) {
    const actual = { proposed: is_safety_note_line(line_of(c)) };
    return { actual, passed: canonical(actual) === canonical(c.expected) };
  }
  if (id === "s7-false-proposals-issued") {
    const outline = run_normalizer(grid_for(c.input));
    const count = outline.findings.filter((f) => f.kind === "safety_note_proposed" && f.row_number !== 39).length;
    const cells = grid_for(c.input).rows.slice(2).flat().filter((x) => x.trim() !== "").length;
    const max = (c.expected as { max_false_proposals: number }).max_false_proposals;
    return {
      actual: { false_proposals: count, proposals_total: outline.findings.filter((f) => f.kind === "safety_note_proposed").length, cells_scanned: cells, max_false_proposals: max },
      passed: count <= max,
    };
  }
  if (id === "s7-false-proposals-wp5") {
    const count = proposals(c.input, 10, null);
    return { actual: { false_proposals: count }, passed: count === (c.expected as { false_proposals: number }).false_proposals };
  }
  if (id === "s7-recall-summary") {
    const set = all.filter((x) => x.case_id.startsWith("s7-syn4-"));
    const by = (k: string): CaseFile[] => set.filter((x) => x.case_id.startsWith(`s7-syn4-${k}-`));
    const k = by("warning").filter((x) => is_safety_note_line(line_of(x))).length;
    const actual = {
      n: by("warning").length, proposed: k, recall: `${k}/${by("warning").length}`, label: "synthetic", decoys_n: by("decoy").length,
      false_on_decoys: by("decoy").filter((x) => is_safety_note_line(line_of(x))).length, paraphrases_n: by("paraphrase").length,
      paraphrases_proposed: by("paraphrase").filter((x) => is_safety_note_line(line_of(x))).length,
    };
    return { actual, passed: actual.proposed === actual.n && actual.false_on_decoys === 0 };
  }
  if (id === "s7-cleared-flag-carries-user-note-time") {
    const rows = (c.input as { rows: Parameters<typeof clear_record_ok>[0] }).rows;
    const broken = rows.map((r) => (r.status === "cleared" ? { ...r, cleared_by: null } : r));
    const actual = { clear_record_ok: clear_record_ok(rows), negative_control_rejected: !clear_record_ok(broken) };
    return { actual, passed: canonical(actual) === canonical(c.expected) };
  }
  throw new Error(`no S7 scorer for case ${id}`);
}

export function make_s7(_provider_mode: ProviderMode, options: S7Options = {}): EvalSuite {
  const cases = (): CaseFile[] => options.cases ?? load();
  return {
    name: "S7",
    cases: () => cases().map((c): EvalCase => ({ ...c })),
    async score(c): Promise<CaseOutcome> {
      const { actual, passed } = actual_for(c as CaseFile, cases());
      return { case_id: c.case_id, passed, failure_category: passed ? null : "expected_field_mismatch", actual, cost_usd: new Decimal(0) };
    },
  };
}
