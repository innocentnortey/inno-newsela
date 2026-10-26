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
import { build_ctx, type Fixture } from "../grounding/fixtures/build.ts";
import { proper_noun_unsourced_rule } from "../grounding/proper_noun_unsourced.ts";
import type { CheckContext } from "../../types.ts";
import { schema_invalid_rule } from "./schema_invalid.ts";

/** The Learning in Action Pulse Check block of the wp1 draft (found by role, not by position). */
const lia_cfu = (d: { blocks: { section: string; role: string; cfu: unknown }[] }) =>
  d.blocks.find((b) => b.section === "Learning in Action" && b.role === "cfu_item") as unknown as { cfu: { options: string[]; rationales: string[] } };

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

const MISSING = "CFU item is missing a rationale for each option";
const run = (ctx: CheckContext) => schema_invalid_rule.run(ctx, DEFAULT_POLICY).map((f) => f.message);

/** Deep copy of the compiled WP-1 lesson with every text node starting `from` rewritten to start `to`. */
function relabel(from: string, to: string): CheckContext {
  const ctx = build_ctx("wp1");
  const lesson = structuredClone(ctx.lesson);
  let hits = 0;
  const walk = (n: PMNode): void => {
    if (hits === 0 && n.type === "text" && n.text === from) {
      n.text = to;
      hits += 1;
    }
    for (const c of n.content ?? []) walk(c);
  };
  for (const sec of lesson.sections) walk(sec.content as PMNode);
  expect(hits).toBe(1);
  return { ...ctx, lesson };
}

describe("compiled rationales", () => {
  it("compiled_wp1_has_no_findings", () => {
    for (const name of ["wp1", "wp2", "wp3", "wp4"] as Fixture[]) {
      expect(run(build_ctx(name))).toEqual([]);
    }
  });
  it("compiled_missing_rationale_text_is_flagged", () => {
    const ctx = build_ctx("wp1", { mutate: (d) => { lia_cfu(d).cfu!.rationales[2] = ""; } });
    expect(run(ctx)).toEqual([MISSING]);
  });
  it("compiled_deleted_rationale_paragraph_is_flagged", () => {
    const ctx = build_ctx("wp1");
    const lesson = structuredClone(ctx.lesson);
    let removed = 0;
    const walk = (n: PMNode): void => {
      if (n.content === undefined) return;
      const keep = n.content.filter((c) => {
        const gone =
          removed === 0 && c.type === "paragraph" && c.content?.[0]?.type === "text" && c.content[0].text === "C. Incorrect:";
        if (gone) removed += 1;
        return !gone;
      });
      n.content = keep;
      keep.forEach(walk);
    };
    for (const sec of lesson.sections) walk(sec.content as PMNode);
    expect(removed).toBe(1);
    expect(run({ ...ctx, lesson })).toEqual([MISSING]);
  });
  it("compiled_duplicate_correct_is_flagged", () => {
    expect(run(relabel("B. Incorrect:", "B. Correct:"))).toEqual([
      "CFU item must have exactly one Correct option (found 2)",
    ]);
  });
  it("compiled_zero_correct_is_flagged", () => {
    expect(run(relabel("A. Correct:", "A. Incorrect:"))).toEqual([
      "CFU item must have exactly one Correct option (found 0)",
    ]);
  });
  it("duplicate_letter_is_flagged", () => {
    expect(run(relabel("C. Incorrect:", "B. Incorrect:"))).toEqual([MISSING]);
  });
  it("more_than_four_options_pass", () => {
    const ctx = build_ctx("wp1", {
      mutate: (d) => {
        lia_cfu(d).cfu!.options.push("E option");
        lia_cfu(d).cfu!.rationales.push("fifth reason");
      },
    });
    expect(run(ctx)).toEqual([]);
  });
  it("genuine_name_in_compiled_rationale_still_fails", () => {
    for (const [text, name] of [
      ["Grover would not follow this.", "Grover"],
      ["The story never mentions Medusa here.", "Medusa"],
    ] as const) {
      const ctx = build_ctx("wp1", { mutate: (d) => { lia_cfu(d).cfu!.rationales[3] = text; } });
      const f = proper_noun_unsourced_rule.run(ctx, DEFAULT_POLICY);
      expect(f.some((x) => x.level === "blocking" && x.matched === name)).toBe(true);
    }
  });
});
