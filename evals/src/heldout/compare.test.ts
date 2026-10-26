// NL-121 (frozen first): pure comparison, report building, and the S11 suite shape. Synthetic values only.
import { describe, expect, it } from "vitest";
import { make_s11, heldout_case_id } from "../suites/s11.ts";
import { HeldoutEmpty, build_report, compare_lesson, norm_section, norm_type, type LessonFacts } from "./compare.ts";
import { HeldoutReport } from "./schema.ts";

const facts = (type: string, sections: string[], focus: string[]): LessonFacts => ({ type, sections, focus });

describe("norm helpers", () => {
  it("norm_section drops the ': subtitle' a published Research title carries", () => {
    expect(norm_section("Research: Invented subtitle")).toBe("research");
    expect(norm_section("  Launch ")).toBe("launch");
  });
  it("norm_type trims and lower-cases", () => expect(norm_type("  Core ")).toBe("core"));
});

describe("compare_lesson", () => {
  it("type and sequence match when normalised values are equal", () => {
    const g = facts("core", ["Launch", "Research", "Homework"], ["RL.6.1"]);
    const p = facts("Core", ["Launch", "Research: Sub", "Homework"], ["RL.6.1"]);
    expect(compare_lesson(2, g, p)).toMatchObject({ number: 2, type_match: 1, sequence_match: 1, sections_generated: 3, sections_published: 3 });
  });
  it("type mismatch and sequence mismatch (order and length) give 0", () => {
    expect(compare_lesson(1, facts("flex", ["A"], []), facts("core", ["A"], [])).type_match).toBe(0);
    expect(compare_lesson(1, facts("core", ["A", "B"], []), facts("core", ["B", "A"], [])).sequence_match).toBe(0);
    expect(compare_lesson(1, facts("core", ["A"], []), facts("core", ["A", "B"], [])).sequence_match).toBe(0);
  });
  it("focus: distinct, trimmed, upper-cased codes; Jaccard = shared / union to 4 decimals", () => {
    const c = compare_lesson(1, facts("core", [], ["rl.6.1", " RL.6.1 ", "RL.6.2", ""]), facts("core", [], ["RL.6.1", "W.6.1", "W.6.2"]));
    expect(c).toMatchObject({ focus_generated: 2, focus_published: 3, focus_shared: 1, focus_jaccard: 0.25 });
  });
  it("a malformed published code (L.6.3.b vs L6.3.b) is not repaired and does not match", () => {
    expect(compare_lesson(1, facts("core", [], ["L6.3.b"]), facts("core", [], ["L.6.3.b"]))).toMatchObject({ focus_shared: 0, focus_jaccard: 0 });
  });
  it("union 0 gives Jaccard 0", () => {
    expect(compare_lesson(1, facts("core", [], []), facts("core", [], [])).focus_jaccard).toBe(0);
  });
  it("output is numbers only", () => {
    const c = compare_lesson(3, facts("core", ["A"], ["RL.6.1"]), facts("core", ["A"], ["RL.6.1"]));
    expect(Object.values(c).every((v) => typeof v === "number")).toBe(true);
  });
});

describe("build_report", () => {
  const a = compare_lesson(1, facts("core", ["A"], ["X.1", "X.2"]), facts("core", ["A"], ["X.1", "X.2"]));
  const b = compare_lesson(2, facts("core", ["A"], ["X.1"]), facts("flex", ["B"], ["X.1", "X.2", "X.3"]));
  const c = compare_lesson(3, facts("core", ["A"], []), facts("core", ["A"], []));
  it("totals, counts and rates over lessons_compared, rounded to 4 decimals", () => {
    const r = build_report(5, [a, b, c], 1, 1);
    expect(r).toMatchObject({
      schema_version: 1, unit_grade: 6, unit_number: 4, lessons_generated: 5, lessons_compared: 3,
      lessons_unreadable: 1, lessons_no_published: 1, type_match_count: 2, sequence_match_count: 2,
      type_match_rate: 0.6667, sequence_match_rate: 0.6667, focus_shared_total: 3, focus_generated_total: 3, focus_published_total: 5,
    });
    expect(r.focus_jaccard_mean).toBe(0.4444); // (1 + 1/3 + 0) / 3
    expect(r.per_lesson).toHaveLength(3);
    expect(HeldoutReport.parse(r)).toEqual(r);
  });
  it("throws HeldoutEmpty when nothing was compared", () => {
    expect(() => build_report(3, [], 2, 1)).toThrow(HeldoutEmpty);
  });
});

describe("S11 suite", () => {
  const opts = { repeat: 1, provider_mode: "stub", git_sha: "x", unit: "G6.U4" } as const;
  it("heldout_case_id names the lesson number", () => expect(heldout_case_id(7)).toBe("lesson-7"));
  it("with deps it lists one synthetic counts-only case per lesson and scores through deps", async () => {
    const counts = { number: 1, type_match: 1 };
    const suite = make_s11("stub", { cases: [{ number: 1 }, { number: 2 }], score: async () => ({ passed: true, failure_category: null, counts }) });
    expect(suite.name).toBe("S11");
    const cases = suite.cases();
    expect(cases.map((x) => x.case_id)).toEqual(["lesson-1", "lesson-2"]);
    expect(cases[0]).toMatchObject({ provenance: "synthetic", source: "S-5 held-out (counts only)", guards: "S11", input_path: "n/a", expected: { number: 1 } });
    const out = await suite.score(cases[0]!, opts);
    expect(out).toMatchObject({ case_id: "lesson-1", passed: true, failure_category: null, actual: counts });
    expect(out.cost_usd.toString()).toBe("0");
  });
  it("a failed lesson carries only a fixed-word failure_category", async () => {
    const suite = make_s11("stub", { cases: [{ number: 4 }], score: async () => ({ passed: false, failure_category: "unreadable", counts: { number: 4 } }) });
    expect(await suite.score(suite.cases()[0]!, opts)).toMatchObject({ passed: false, failure_category: "unreadable" });
  });
  it("without deps it is still the empty shell naming NL-121", () => expect(make_s11("stub").cases()).toEqual([]));
});
