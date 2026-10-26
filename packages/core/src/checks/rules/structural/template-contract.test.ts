// The template contract: every required role and part of the production template is enforced by section_missing.
// Oracles are hand-written from the worked-pair "Required output B" tables (docs/data/worked-pairs.md), not read from templates.ts.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "@ls/editor-schema/schema";
import type { UnitId } from "@ls/schema/ids";
import { LessonDraft } from "@ls/schema/lesson-draft";
import { compile_draft } from "../../../compile/compile-draft.ts";
import { template_for } from "../../../compile/templates.ts";
import type { CheckContext } from "../../types.ts";
import { DEFAULT_POLICY, make_ctx, p, reading_lesson } from "../../test-helpers.ts";
import { build_ctx } from "../grounding/fixtures/build.ts";
import { section_missing_rule } from "./section_missing.ts";

const GOOD = {
  wp1: { file: "../../../../../llm/src/fixtures/draft-wp1.json", type: "Reading" },
  wp2: { file: "../../../../../llm/src/fixtures/draft-wp2.json", type: "Writing" },
  wp3: { file: "../../../../../../evals/cases/drafts/_fixtures/good-wp-3.json", type: "Flex Day" },
} as const;

const strip = (o: unknown): unknown =>
  Object.fromEntries(Object.entries(o as Record<string, unknown>).filter(([k]) => !k.startsWith("_")));

/** The canonical good drafts (the ones the compile contract uses), compiled with the issued row of the same pair. */
function good(name: keyof typeof GOOD, mutate?: (d: LessonDraft) => void) {
  const draft = LessonDraft.parse(strip(JSON.parse(readFileSync(new URL(GOOD[name].file, import.meta.url), "utf8"))));
  mutate?.(draft);
  const row = build_ctx(name).row;
  const compiled = compile_draft(draft, {
    row,
    template: template_for(GOOD[name].type)!,
    unit_id: "G6.U4" as UnitId,
    schema_version: SCHEMA_VERSION,
  });
  const ctx: CheckContext = { ...make_ctx(compiled.lesson), row };
  return { ctx, compiled };
}
const run = (ctx: CheckContext) => section_missing_rule.run(ctx, DEFAULT_POLICY);
const section_findings = (ctx: CheckContext) => run(ctx).filter((f) => f.message.startsWith("Section"));

describe("template contract", () => {
  it("every_template_role_is_enforced", () => {
    expect(section_findings(good("wp1").ctx)).toEqual([]);
    const pairs: [string, string][] = [
      ["Launch", "teacher_talk"],
      ["Launch", "sample_response"],
      ["Literacy Lab", "cfu_item"],
      ["Literacy Lab", "callout_say"],
      ["Literacy Lab", "support_table"],
      ["Learning in Action", "cfu_item"],
      ["Learning in Action", "callout_watch"],
      ["Look Back", "quick_write"],
      ["Look Back", "sample_response"],
    ];
    for (const [section, role] of pairs) {
      const { ctx } = good("wp1", (d) => {
        d.blocks = d.blocks.filter((b) => !(b.section === section && b.role === role));
      });
      const f = run(ctx);
      expect(f.map((x) => x.message), `${section} ${role}`).toContain(`Section "${section}" is missing required role ${role}`);
      expect(f.every((x) => x.message.includes(`"${section}"`) || x.message.startsWith("Lesson is missing")), `${section} ${role}`).toBe(true);
    }
  });

  it("compiled_good_drafts_satisfy_the_template", () => {
    for (const name of ["wp1", "wp2", "wp3"] as const) expect(section_findings(good(name).ctx), name).toEqual([]);
  });

  it("homework_needs_text", () => {
    const l = reading_lesson();
    const hw = l.sections.find((s) => s.name === "Homework")!;
    hw.content = { type: "doc", content: [{ type: "paragraph" }] };
    expect(run(make_ctx(l)).map((f) => f.message)).toEqual(['Section "Homework" is missing required role homework']);
    hw.content = { type: "doc", content: [p("Read pages.")] };
    expect(run(make_ctx(l))).toEqual([]);
  });

  it("missing_part_is_reported", () => {
    const { ctx } = good("wp1", (d) => {
      for (const b of d.blocks) if (b.part === "Part B") b.part = "Part A";
    });
    const f = run(ctx);
    expect(f).toHaveLength(1);
    expect(f[0]?.message).toBe('Section "Learning in Action" is missing part "Part B"');
    expect(f[0]?.address).toBe(ctx.lesson.sections.find((s) => s.name === "Learning in Action")?.address);
  });

  it("descriptive_part_labels_satisfy_the_template", () => {
    const { ctx, compiled } = good("wp1", (d) => {
      for (const b of d.blocks) {
        if (b.section !== "Learning in Action") continue;
        if (b.part === "Part A") b.part = "Gather evidence";
        else if (b.part === "Part B") b.part = "Plan and write";
      }
    });
    expect(section_findings(ctx)).toEqual([]);
    expect(compiled.part_remaps).toHaveLength(2);
  });

  it("flex_day_roles_are_enforced", () => {
    expect(section_findings(good("wp3").ctx)).toEqual([]);
    const tip = good("wp3", (d) => {
      d.blocks = d.blocks.filter((b) => b.role !== "teacher_tip");
    });
    expect(run(tip.ctx).map((f) => f.message)).toContain('Section "Learning in Action" is missing required role teacher_tip');
    const sample = good("wp3", (d) => {
      d.blocks = d.blocks.filter((b) => !(b.section === "Launch" && b.role === "sample_response"));
    });
    expect(run(sample.ctx).map((f) => f.message)).toContain('Section "Launch" is missing required role sample_response');
  });

  it("unknown_type_is_not_a_section_problem", () => {
    expect(run(make_ctx(reading_lesson({ type: "Mystery" })))).toEqual([]);
  });
});
