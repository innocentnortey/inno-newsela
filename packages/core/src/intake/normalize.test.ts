import { describe, expect, it } from "vitest";
import type { IntakeFinding } from "@ls/schema/outline";
import {
  grid_from_rows,
  load_issued_grid,
  load_syn2_grid,
  load_syn3_grid,
} from "../../tests/fixtures/outline/index.ts";
import { standards_double } from "../../tests/fixtures/outline/standards-double.ts";
import { IntakeError } from "./errors.ts";
import { normalize_outline } from "./normalize.ts";
import type { CellGrid } from "./parse-grid.ts";

const run = (g: CellGrid) => normalize_outline(g, standards_double, 200);
const kinds = (fs: IntakeFinding[], kind: string) => fs.filter((f) => f.kind === kind);
const distinct_rows = (fs: IntakeFinding[]) => [...new Set(fs.map((f) => f.row_number))].sort((a, b) => (a ?? 0) - (b ?? 0));

describe("normalize_outline", () => {
  it("issued_sheet_counts: the issued sheet gives the documented counts", () => {
    const out = run(load_issued_grid());
    expect(out.counts.lessons).toBe(41);
    expect(out.counts.flex_days).toBe(6);
    expect(out.counts.arc_headers).toBe(7);
    expect(out.counts.totals).toBe(1);
    expect(out.unit_as_written).toBe("U4");
    expect(out.unit_from_filenames).toBe("U3");
    expect(kinds(out.findings, "unit_conflict")).toHaveLength(1);
    expect(kinds(out.findings, "malformed_code")).toHaveLength(1);
    expect(distinct_rows(kinds(out.findings, "nonexistent_code"))).toEqual([30, 34, 39]);
    expect(distinct_rows(kinds(out.findings, "bad_filename"))).toEqual([43, 51]);
    const eld = new Set(
      kinds(out.findings, "eld_mismatch").map((f) => /ELD\.P(?:I|II)\.\d+\.?\d*[a-z]?/.exec(f.original_text)?.[0]),
    );
    expect(eld.size).toBe(7);
    expect(out.counts.errors).toBe(out.findings.filter((f) => f.level === "error").length);
    expect(out.counts.warnings).toBe(out.findings.filter((f) => f.level === "warning").length);
    expect(out.rows.filter((r) => r.kind === "flex_day").map((r) => r.lesson_id).slice(0, 3)).toEqual([
      "G6.U4.FLEX-1a",
      "G6.U4.FLEX-1b",
      "G6.U4.FLEX-2a",
    ]);
  });

  it("syn2_layout_drift: a shifted layout gives the same counts, rows and findings", () => {
    const a = run(load_issued_grid());
    const b = run(load_syn2_grid());
    expect(b.counts).toEqual(a.counts);
    const strip_row = <T extends { row_number: number }>(r: T) => ({ ...r, row_number: 0 });
    expect(b.rows.map(strip_row)).toEqual(a.rows.map(strip_row));
    const canon = (fs: IntakeFinding[]) =>
      fs
        .map((f) => JSON.stringify({ ...f, finding_id: "", row_number: f.row_number === null ? null : 0 }))
        .sort();
    expect(canon(b.findings)).toEqual(canon(a.findings));
    expect(b.unit_rules).toEqual(a.unit_rules);
  });

  it("refusals: no header, too many rows, duplicate ids", () => {
    const headerless = { rows: [["a", "b"], ["c", "d"]], sheet_name: "" };
    expect(() => run(headerless)).toThrow(IntakeError);
    try {
      run(headerless);
    } catch (e) {
      expect((e as IntakeError).code).toBe("HEADER_NOT_FOUND");
    }

    const g = load_issued_grid();
    const filler = new Array<string>(16).fill("");
    filler[2] = "Lesson 1";
    const many = { rows: [...g.rows.slice(0, 2), ...Array.from({ length: 201 }, () => [...filler])], sheet_name: "" };
    try {
      run(many);
      throw new Error("expected refusal");
    } catch (e) {
      expect((e as IntakeError).code).toBe("TOO_MANY_ROWS");
      expect((e as IntakeError).details.max_rows).toBe(200);
    }

    const dup = { rows: [...g.rows.slice(0, 2), ...[g.rows[3] as string[], g.rows[3] as string[]]], sheet_name: "" };
    const out = run(dup);
    const found = kinds(out.findings, "duplicate_id");
    expect(found).toHaveLength(1);
    expect(found[0]?.level).toBe("error");
    expect(out.rows).toHaveLength(2);
  });

  it("header_named_proto: a header cell named __proto__ is harmless", () => {
    const g = load_issued_grid();
    const rows = g.rows.map((r) => [...r]);
    (rows[1] as string[])[0] = "__proto__";
    const before = Object.getOwnPropertyNames(Object.prototype).sort();
    const out = run({ rows, sheet_name: "" });
    expect(out.rows.length).toBeGreaterThan(40);
    expect(Object.getOwnPropertyNames(Object.prototype).sort()).toEqual(before);
  });

  it("wp1_row8: the Lesson 4 row", () => {
    const out = run(load_issued_grid());
    const row = out.rows.find((r) => r.row_number === 8);
    expect(row?.lesson_id).toBe("G6.U4.L4");
    expect(row?.lesson_type).toBe("Reading");
    expect(row?.focus_codes).toEqual(["RL.6.1", "RL.6.2", "L.6.4"]);
    expect(row?.eld_codes).toEqual(["ELD.PI.6.7", "ELD.PI.6.6", "ELD.PII.6.5"]);
    expect(row?.vocabulary).toHaveLength(10);
    expect(row?.vocabulary[0]).toBe("envy (1)");
    expect(row?.homework).toContain("The Hare and the Lion");
    const f8 = out.findings.filter((f) => f.row_number === 8);
    const malformed = kinds(f8, "malformed_code")[0];
    expect(malformed?.proposed_fix).toBe("RL.6.2, L.6.4");
    expect(malformed?.level).toBe("error");
    expect(malformed?.original_text).toBe("RL.6.1, 6.2 L.6.4");
    expect(kinds(f8, "parent_code").length).toBeGreaterThanOrEqual(2);
    const mismatch = kinds(f8, "eld_mismatch");
    expect(mismatch).toHaveLength(1);
    expect(mismatch[0]?.proposed_fix).toBe("ELD.PII.6.2b");
    expect(mismatch[0]?.default_choice).toBe("eld_keep");
    expect(kinds(f8, "vocabulary_over_cap")[0]?.proposed_fix).toBe("6 + 4");
    expect(kinds(f8, "homework_links_later_row")).toHaveLength(1);
    const notes = row?.segments.filter((s) => s.kind === "editor_note") ?? [];
    expect(notes[0]?.text.startsWith("Context clues are not considered")).toBe(true);
    expect(notes.at(-1)?.text).toContain("10 vocabulary words are taught");
    const plan = row?.segments.filter((s) => s.text.startsWith("• Students will add this week's"));
    expect(plan?.[0]?.kind).toBe("content");
    expect(notes.every((s) => s.applies === "apply")).toBe(true);
  });

  it("wp5_no_findings: the clean control row has no findings", () => {
    const out = run(load_syn3_grid());
    expect(out.findings.filter((f) => f.row_number === 10)).toEqual([]);
    const row = out.rows.find((r) => r.row_number === 10);
    expect(row?.segments.some((s) => s.kind === "editor_note")).toBe(false);
    expect(row?.vocabulary).toHaveLength(6);
  });

  it("wp4_safety_note: a content warning in homework is proposed, shown only, never applied", () => {
    const out = run(load_issued_grid());
    const row = out.rows.find((r) => r.row_number === 39);
    const seg = row?.segments.find((s) => s.kind === "safety_note");
    expect(seg?.applies).toBe("show_only");
    const finding = kinds(out.findings, "safety_note_proposed")[0];
    expect(finding?.row_number).toBe(39);
    expect(finding?.default_choice).toBe("confirm_safety_note");
    expect(finding?.original_text).toBe(seg?.text);
    expect(row?.homework ?? "").not.toContain(seg?.text ?? "unreachable");
  });

  it("issued_sheet_one_proposal: exactly one safety proposal on the issued sheet, none on the control", () => {
    expect(kinds(run(load_issued_grid()).findings, "safety_note_proposed")).toHaveLength(1);
    expect(kinds(run(load_syn3_grid()).findings, "safety_note_proposed")).toHaveLength(1); // row 39 is unchanged in SYN-3
    expect(run(load_syn3_grid()).findings.filter((f) => f.kind === "safety_note_proposed" && f.row_number === 10)).toEqual([]);
  });

  it("writer_task_and_unit_rule: writer tasks default to excerpt slots; the unit rule is scoped to its arc", () => {
    const out = run(load_issued_grid());
    const writer_rows = distinct_rows(kinds(out.findings, "writer_task"));
    expect(writer_rows).toContain(9);
    for (const f of kinds(out.findings, "writer_task")) {
      expect(f.default_choice).toBe("excerpt_slot");
      expect(f.level).toBe("warning");
    }
    const seg = out.rows.find((r) => r.row_number === 9)?.segments.find((s) => s.kind === "writer_task");
    expect(seg?.applies).toBe("apply");
    const rule = out.unit_rules.find((r) => r.text === "Across Investigation 1: Cap at 6 words per lesson.");
    expect(rule?.scope_lesson_ids).toHaveLength(16);
    expect(rule?.scope_lesson_ids[0]).toBe("G6.U4.L4");
    expect(rule?.scope_lesson_ids.at(-1)).toBe("G6.U4.L19");
    expect(out.rows.find((r) => r.row_number === 9)?.segments.some((s) => s.kind === "unit_rule")).toBe(true);
  });

  it("text_verbatim_and_deterministic: cell text is never rewritten and output is stable", () => {
    const html = "<img src=x onerror=alert(1)>";
    const g = load_issued_grid();
    const rows = g.rows.map((r) => [...r]);
    (rows[3] as string[])[6] = `${html}\n  • indented\ttab  `;
    const a = run({ rows, sheet_name: "" });
    const b = run({ rows, sheet_name: "" });
    expect(b).toEqual(a);
    const segs = a.rows.find((r) => r.row_number === 4)?.segments.map((s) => s.text) ?? [];
    expect(segs).toContain(html);
    expect(segs).toContain("  • indented\ttab  ");

    const issued = load_issued_grid();
    const out = run(issued);
    const description_col = 6;
    for (const row of out.rows) {
      const cell = issued.rows[row.row_number - 1]?.[description_col] ?? "";
      if (cell.trim() === "") continue;
      const lines = cell.split("\n").length;
      const own = row.segments.slice(row.segments.findIndex((s) => s.text === cell.split("\n")[0]));
      expect(own.slice(0, lines).map((s) => s.text).join("\n")).toBe(cell);
    }
  });

  it("nbsp_only_cell: a cell holding only non-breaking spaces yields no segments and an info finding", () => {
    const g = load_issued_grid();
    const rows = g.rows.map((r) => [...r]);
    (rows[3] as string[])[14] = "\u00a0\u00a0";
    const out = run({ rows, sheet_name: "" });
    const f = kinds(out.findings, "non_breaking_space")[0];
    expect(f?.level).toBe("ok");
    expect(f?.original_text).toBe("\u00a0\u00a0");
    expect(out.counts.warnings).toBe(out.findings.filter((x) => x.level === "warning").length);
  });

  it("slice_rows: grid_from_rows keeps title, header and only the named rows", () => {
    const out = run(grid_from_rows([8]));
    expect(out.counts.lessons).toBe(1);
  });
});
