import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { PMNode } from "@ls/schema/lesson";
import { DEFAULT_POLICY, LESSON_ID, cfu_item, p, reading_lesson, routine, section } from "../../test-helpers.ts";
import { build_ctx, load_draft } from "../grounding/fixtures/build.ts";
import { cfu_parts, find_cfu_items } from "../structural/doc-walk.ts";
import { schema_invalid_rule } from "../structural/schema_invalid.ts";
import { student_blocks } from "./student-blocks.ts";

// Input is the draft fixture's own cfu (stem, options, key_index, rationales), not the compiler output.
const wp1_cfu = () => load_draft("wp1").blocks.find((b) => b.section === "Literacy Lab" && b.role === "cfu_item")!.cfu!;

function wp1_lab_item() {
  const ctx = build_ctx("wp1");
  const lab = ctx.lesson.sections.find((s) => s.name === "Literacy Lab")!;
  return { ctx, lab, item: find_cfu_items(lab)[0]! };
}

function lesson_with_item(nodes: PMNode[]) {
  const base = reading_lesson();
  return {
    ...base,
    sections: base.sections.map((s) =>
      s.name === "Learning in Action" ? section("Learning in Action", LESSON_ID, 30, [routine("notes_section", "Teach"), p("Teach."), ...nodes]) : s,
    ),
  };
}
const student_text = (nodes: PMNode[]): string => {
  const l = lesson_with_item(nodes);
  const addr = find_cfu_items(l.sections.find((s) => s.name === "Learning in Action")!)[0]!.address;
  return student_blocks(l).find((b) => b.address === addr)!.text;
};

describe("student blocks", () => {
  it("teacher_view_keeps_the_rationales", () => {
    const cfu = wp1_cfu();
    const { ctx, item } = wp1_lab_item();
    const parts = cfu_parts(item);
    expect(parts.rationales).toHaveLength(cfu.options.length);
    parts.rationales.forEach((r, i) => {
      expect(r.label.correct).toBe(i === cfu.key_index);
      expect(r.label.body).toBe(cfu.rationales[i]);
    });
    const cfu_findings = schema_invalid_rule.run(ctx, DEFAULT_POLICY).filter((f) => f.message.includes("CFU"));
    expect(cfu_findings).toEqual([]);
  });

  it("student_view_drops_the_rationales_and_keeps_stem_and_options", () => {
    const cfu = wp1_cfu();
    const { ctx, item } = wp1_lab_item();
    const text = student_blocks(ctx.lesson).find((b) => b.address === item.address)!.text;
    expect(text).toContain(cfu.stem);
    for (const o of cfu.options) expect(text).toContain(o);
    for (const r of cfu.rationales) expect(text).not.toContain(r);
    expect(text).not.toContain("Correct:");
    expect(text).not.toContain("Incorrect:");
  });

  it("unlettered_rationale_is_not_student_text", () => {
    expect(student_text(cfu_item({}))).not.toContain("reason");
  });

  it("stem_that_starts_with_correct_stays_student_text", () => {
    const [heading, , list, ...rationales] = cfu_item({});
    const text = student_text([heading!, p("Correct the sentence below."), list!, ...rationales]);
    expect(text).toContain("Correct the sentence below.");
    expect(text).not.toContain("reason");
  });

  it("paragraph_after_the_rationales_is_student_text", () => {
    const text = student_text([...cfu_item({}), p("Explain your choice to a partner.")]);
    expect(text).toContain("Explain your choice to a partner.");
    expect(text).not.toContain("reason");
  });

  it("one_rationale_parser", () => {
    for (const dir of ["safety", "structural"]) {
      const base = new URL(`../${dir}/`, import.meta.url);
      for (const f of readdirSync(base).filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts"))) {
        const src = readFileSync(new URL(f, base), "utf8");
        expect(src.includes("Correct|Incorrect"), `${dir}/${f}`).toBe(false);
      }
    }
  });
});
