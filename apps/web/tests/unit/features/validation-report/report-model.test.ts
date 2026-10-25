import { describe, expect, it } from "vitest";
import { cleanReport, issuedShapeReport } from "../../../../e2e/validation-report/fixtures";
import {
  applyChoiceResult,
  eldItems,
  eldSummary,
  errorItems,
  gateBanner,
  headingCopy,
  okRowLabel,
  okRows,
  refusalCopy,
  rowsLabel,
  warningItems,
} from "@/features/validation-report/report-model";

const counts = (errors: number, unconfirmed: number, warnings = 0) => ({ ...issuedShapeReport().counts, errors, errors_unconfirmed: unconfirmed, warnings });

describe("gateBanner and headingCopy", () => {
  const base = issuedShapeReport();
  const at = (errors: number, u: number, w = 0) => ({ ...base, counts: counts(errors, u, w) });
  it("0 errors", () => expect(gateBanner(at(0, 0, 0))).toEqual({ level: "success", title: "No errors to confirm. 0 warnings." }));
  it("none confirmed", () => {
    const g = gateBanner(at(5, 5));
    expect(g.level).toBe("advisory");
    expect(g.title).toBe("5 errors to confirm");
    expect(g.body).toBe("Generate stays off: 5 errors to confirm");
  });
  it("partial, singular and plural", () => {
    expect(gateBanner(at(5, 1)).title).toBe("1 error still to confirm");
    expect(gateBanner(at(5, 4)).title).toBe("4 errors still to confirm");
  });
  it("all confirmed", () => expect(gateBanner(at(5, 0)).title).toBe("All 5 errors confirmed. Generate is on."));
  it("heading", () => {
    expect(headingCopy(counts(5, 5))).toBe("5 errors to confirm");
    expect(headingCopy(counts(5, 1))).toBe("1 error to confirm");
    expect(headingCopy(counts(5, 0))).toBe("All 5 errors confirmed");
  });
  it("refusal", () => expect(refusalCopy(1)).toBe("Generate refused: 1 error still to confirm."));
});

describe("items", () => {
  const r = issuedShapeReport();
  it("errors are ordered by row, named by row", () => {
    const items = errorItems(r);
    expect(items.map((i) => i.row.row_number)).toEqual([7, 8, 30, 34, 39]);
    expect(items[0]).toMatchObject({ where: "Unit", name: "the unit" });
    expect(items[1]).toMatchObject({ where: "Row 8 · Lesson 4 · Column J", name: "row 8" });
  });
  it("warnings leave out ELD findings and include notes, tasks, rules", () => {
    const types = warningItems(r).map((w) => w.type);
    expect(types).toContain("note");
    expect(types).toContain("writer_task");
    expect(types).toContain("unit_rule");
    expect(warningItems(r).some((w) => w.type === "finding" && w.finding.kind.startsWith("eld"))).toBe(false);
  });
  it("ELD: 12 codes, 7 flagged", () => expect(eldSummary(r)).toEqual({ total: 12, flagged: 7 }));
  it("ELD: a code flagged on a later row is flagged, whatever its first row said (real-stack finding, NL-94)", () => {
    const e = (verdict: "fits" | "mismatch") => ({ code: "ELD.PI.6.7", sheet_label: "", official_strand: "", verdict, suggested_remap: null, choice: "keep" as const });
    const [a, b] = r.rows.filter((x) => x.eld.length === 0);
    const two = { ...r, rows: [{ ...a!, eld: [e("fits")] }, { ...b!, eld: [e("mismatch")] }] };
    expect(eldSummary(two)).toEqual({ total: 1, flagged: 1 });
    expect(eldItems(two)[0]!.rows).toEqual([a!.row_number, b!.row_number]);
    expect(eldItems(two)[0]!.finding_ids).toEqual([]);
  });
  it("ELD: finding_ids lists the eld_mismatch findings that name the code, across rows", () => {
    const f = (id: string, text: string) => ({ finding_id: id, level: "warning" as const, kind: "eld_mismatch" as const, column: "ELD", original_text: text, proposed_fix: null, choice: { value: null, source: "default" as const, by: null, at: null } });
    const e = { code: "ELD.PI.6.7", sheet_label: "", official_strand: "", verdict: "mismatch" as const, suggested_remap: null, choice: "keep" as const };
    const [a, b] = r.rows.filter((x) => x.eld.length === 0);
    const two = { ...r, rows: [{ ...a!, eld: [e], findings: [f("f_1", "• ELD.PI.6.7 – x")] }, { ...b!, eld: [e], findings: [f("f_2", "• ELD.PI.6.7 – y"), f("f_3", "• ELD.PI.6.6 – z")] }] };
    expect(eldItems(two)[0]!.finding_ids).toEqual(["f_1", "f_2"]);
  });
  it("35 OK rows with the right label", () => {
    const ok = okRows(r);
    expect(ok).toHaveLength(35);
    expect(okRowLabel({ ...ok[0]!, row_number: 10, lesson_id: "G6.U4.L6", kind: "lesson" })).toBe("Row 10 · Lesson 6 · OK · 0 warnings");
    expect(okRowLabel({ ...ok[0]!, row_number: 12, lesson_id: null, kind: "flex_day" })).toBe("Row 12 · Flex day · OK · 0 warnings");
  });
  it("rowsLabel", () => {
    expect(rowsLabel([8, 9, 10, 23])).toBe("8, 9, 10, 23");
    expect(rowsLabel([8, 9, 10, 11])).toBe("8–11");
    expect(rowsLabel([8, 9, 25])).toBe("8, 9, 25");
  });
  it("clean report has no errors", () => expect(errorItems(cleanReport())).toEqual([]));
});

describe("applyChoiceResult", () => {
  it("swaps the row, counts and gate, and copies an ELD choice to the same code elsewhere", () => {
    const r = issuedShapeReport();
    const code = "ELD.PII.6.1";
    const owner = r.rows.find((x) => x.row_number === 41)!;
    const updated = { ...owner, eld: owner.eld.map((e) => ({ ...e, choice: "remap" as const })) };
    const out = applyChoiceResult(r, { row: updated, counts: { ...r.counts, errors_unconfirmed: 4 }, generate_allowed: true });
    expect(out.counts.errors_unconfirmed).toBe(4);
    expect(out.generate_allowed).toBe(true);
    expect(out.rows.find((x) => x.row_number === 41)).toBe(updated);
    expect(out.rows.find((x) => x.row_number === 53)!.eld.find((e) => e.code === code)!.choice).toBe("remap");
    expect(r.rows.find((x) => x.row_number === 53)!.eld[0]!.choice).toBe("keep");
  });
});
