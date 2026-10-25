import { ValidationReport as ValidationReportSchema } from "@ls/schema/api/outlines";
import { describe, expect, it } from "vitest";
import {
  choice,
  clean_outline,
  finding,
  issued_shape_outline,
  row,
  version_row,
} from "../../../../tests/fixtures/report/builders.ts";
import { build_validation_report, generate_gate } from "./report.ts";

const ERRORS = ["f01", "f02", "f03", "f04", "f05"];
const T = (n: number): string => "2026-10-25T00:00:0" + n + "Z";

describe("wp5_clean", () => {
  it("wp5_clean", () => {
    const o = clean_outline();
    const r = build_validation_report(version_row(), o, []);
    expect(r.rows[0]?.level).toBe("ok");
    expect(r.counts.errors).toBe(0);
    expect(r.counts.warnings).toBe(0);
    expect(r.generate_allowed).toBe(true);
    expect(generate_gate(o, [])).toEqual({
      allowed: true,
      refusals: [],
      details: { unconfirmed_finding_ids: [] },
    });
  });
});

describe("issued_sheet_counts", () => {
  it("issued_sheet_counts", () => {
    const r = build_validation_report(
      version_row(),
      issued_shape_outline(),
      [],
    );
    expect(r.counts).toEqual({
      teaching_days: 47,
      lessons: 41,
      flex_days: 6,
      arc_headers: 7,
      total_rows: 1,
      errors: 5,
      errors_unconfirmed: 5,
      warnings: 9,
      unit_conflicts: 1,
      malformed_codes: 1,
      rows_with_nonexistent_code: 3,
      bad_filenames: 2,
      eld_mismatches: 7,
    });
    expect(r.generate_allowed).toBe(false);
  });
});

describe("gate_refuses", () => {
  it("gate_refuses", () => {
    expect(generate_gate(issued_shape_outline(), [])).toEqual({
      allowed: false,
      refusals: ["VALIDATION_INCOMPLETE"],
      details: { unconfirmed_finding_ids: ERRORS },
    });
  });
});

describe("choices_overlay", () => {
  it("choices_overlay", () => {
    const o = issued_shape_outline();
    const v = version_row();
    const all = ERRORS.map((id) => choice(id, "confirmed", "ok", T(1)));
    const agree = (cs: ReturnType<typeof choice>[]): boolean => {
      const r = build_validation_report(v, o, cs);
      expect(generate_gate(o, cs).allowed).toBe(r.generate_allowed);
      return r.generate_allowed;
    };
    // 1: all errors confirmed, all 9 warnings left default
    const r1 = build_validation_report(v, o, all);
    expect(r1.counts.errors_unconfirmed).toBe(0);
    expect(r1.counts.warnings).toBe(9);
    expect(agree(all)).toBe(true);
    // 2: one replaced by a default-status row
    const two = [
      ...all.filter((c) => c.finding_id !== "f03"),
      choice("f03", "default", "ok", T(1)),
    ];
    expect(agree(two)).toBe(false);
    // 4: revert after confirm
    const four = [...all, choice("f04", "default", "x", T(2))];
    const r4 = build_validation_report(v, o, four);
    expect(r4.counts.errors_unconfirmed).toBe(1);
    expect(agree(four)).toBe(false);
  });
});

describe("unit_and_latest_wins", () => {
  it("unit_and_latest_wins", () => {
    const o = issued_shape_outline();
    const v = version_row();
    expect(build_validation_report(v, o, []).unit.confirmed).toBe(false);
    const c = [choice("f01", "confirmed", "confirm_unit", T(1))];
    const r = build_validation_report(v, o, c);
    expect(r.unit.confirmed).toBe(true);
    expect(r.unit.confirmed_by).not.toBeNull();
    expect(r.counts.unit_conflicts).toBe(1);
    const seq = [
      choice("f02", "confirmed", "a", T(1)),
      choice("f02", "default", "b", T(2)),
    ];
    for (const cs of [seq, [...seq].reverse()]) {
      expect(build_validation_report(v, o, cs).counts.errors_unconfirmed).toBe(
        5,
      );
    }
    const seq2 = [
      choice("f02", "default", "b", T(1)),
      choice("f02", "confirmed", "a", T(2)),
    ];
    for (const cs of [seq2, [...seq2].reverse()]) {
      expect(build_validation_report(v, o, cs).counts.errors_unconfirmed).toBe(
        4,
      );
    }
  });
});

describe("deterministic_and_parses", () => {
  it("deterministic_and_parses", () => {
    const o = issued_shape_outline();
    const v = version_row();
    const cs = [
      choice("f01", "confirmed", "confirm_unit", T(1)),
      choice("f08", "confirmed", "keep", T(2)),
    ];
    const a = build_validation_report(v, o, cs);
    const b = build_validation_report(v, o, cs);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const shuffled = {
      ...o,
      rows: [...o.rows].reverse(),
      findings: [...o.findings].reverse(),
    };
    expect(
      JSON.stringify(build_validation_report(v, shuffled, [...cs].reverse())),
    ).toBe(JSON.stringify(a));
    expect(a.runs_from_this_version).toEqual([]);
    expect(() => ValidationReportSchema.parse(a)).not.toThrow();
  });
});

describe("text_verbatim", () => {
  it("text_verbatim", () => {
    const xss = "<script>alert(1)</script>";
    const o = clean_outline();
    o.rows = [row(10, "lesson", "G6.U4.L6")];
    o.findings = [finding("f01", 10, "warning", "duplicate_text", xss, xss)];
    const r = build_validation_report(version_row(), o, []);
    expect(r.rows[0]?.findings[0]?.original_text).toBe(xss);
    expect(r.rows[0]?.findings[0]?.proposed_fix).toBe(xss);
  });

  it("fails loud on an unknown kind", () => {
    const o = clean_outline();
    o.findings = [finding("f01", 10, "warning", "mystery", "x")];
    expect(() => build_validation_report(version_row(), o, [])).toThrow(
      "UNKNOWN_FINDING_KIND:mystery",
    );
  });
});
