import { describe, expect, it } from "vitest";
import {
  cfu_item,
  DEFAULT_POLICY,
  eld_block,
  h,
  make_ctx,
  reading_lesson,
  section,
  table,
} from "../../test-helpers.ts";
import type { PMNode } from "@ls/schema/lesson";
import { schema_invalid_rule } from "./schema_invalid.ts";

function with_lia(nodes: PMNode[]) {
  const l = reading_lesson();
  const i = l.sections.findIndex((s) => s.name === "Learning in Action");
  l.sections[i] = section("Learning in Action", l.lesson_id, 30, [
    eld_block(),
    ...nodes,
  ]);
  return schema_invalid_rule.run(make_ctx(l), DEFAULT_POLICY);
}

describe("schema_invalid", () => {
  it("flags h2 followed by h4", () => {
    const f = with_lia([h(2, "Part A"), h(4, "Deep"), ...cfu_item({})]);
    expect(f).toHaveLength(1);
    expect(f[0]?.message).toContain("h2 to h4");
    expect(f[0]?.address).toBe("G6.U4.L4.LearninginAction.PartA");
  });
  it("flags a table without a header row", () => {
    const f = with_lia([table(false), ...cfu_item({})]);
    expect(f.map((x) => x.message)).toEqual(["Table has no header row"]);
  });
  it("flags a CFU with no Correct option", () => {
    const f = with_lia(cfu_item({ correct: [] }));
    expect(f.map((x) => x.message)).toEqual([
      "CFU item must have exactly one Correct option (found 0)",
    ]);
  });
  it("flags a CFU with two Correct options", () => {
    const f = with_lia(cfu_item({ correct: [0, 1] }));
    expect(f.map((x) => x.message)).toEqual([
      "CFU item must have exactly one Correct option (found 2)",
    ]);
  });
  it("flags a CFU with a missing rationale", () => {
    const f = with_lia(cfu_item({ omit_rationale: true, correct: [1] }));
    expect(f.map((x) => x.message)).toEqual([
      "CFU item is missing a rationale for each option",
    ]);
  });
  it("passes a clean lesson", () => {
    expect(
      schema_invalid_rule.run(make_ctx(reading_lesson()), DEFAULT_POLICY),
    ).toEqual([]);
  });
  it("passes headings in order, a headed table and exactly one Correct option", () => {
    expect(
      with_lia([
        h(2, "Part A"),
        h(3, "Sub"),
        table(true),
        ...cfu_item({ correct: [2] }),
      ]),
    ).toEqual([]);
  });
});
