import { describe, expect, it } from "vitest";
import { SECTION_TEMPLATES, template_for } from "@ls/core/compile/templates";
import { LOCKED_DIR } from "./locked.ts";
import { PromptRenderer } from "./render.ts";
import { SchemaRegistry } from "./schemas.ts";
import { draft_input, wp2_row } from "./testing/fixtures.ts";

const template_lines = (template: { sections: readonly unknown[] }): string[] => {
  const p = new PromptRenderer(LOCKED_DIR, new SchemaRegistry()).render_lesson_draft({
    ...draft_input(wp2_row()),
    template,
  } as never);
  return p.user_blocks.find((b) => b.text.includes("kind=template"))!.text.split("\n");
};

describe("production template as the prompt renders it", () => {
  it("reading_template_is_rendered_from_the_worked_pair", () => {
    // hand-written from WP-1 "Required output B" (docs/data/worked-pairs.md), not from templates.ts
    const lines = template_lines(template_for("Reading")!);
    expect(lines).toContain("section 1: Launch, 5 minutes, roles: routine_heading, teacher_talk, sample_response");
    expect(lines).toContain(
      "section 3: Learning in Action, 30 minutes, roles: teacher_talk, cfu_item, callout_purpose, callout_say, callout_watch, support_table; parts: Part A, Part B; Part A roles: teacher_talk, support_table, text_evidence_needed; Part B roles: cfu_item, support_table",
    );
    expect(lines).toContain("section 4: Look Back, 5 minutes, roles: quick_write, sample_response");
    expect(lines).toContain("section 5: Homework, 0 minutes, roles: homework");
  });

  it("writing_template_names_the_excerpt_slot_in_part_a", () => {
    // hand-written from WP-2 "Required output B": Part A is the excerpt slot + support table, Part B the checklist cfu_item + support table
    const lia = template_lines(template_for("Writing")!).find((l) => l.includes(": Learning in Action, "))!;
    expect(lia).toContain("; Part A roles: support_table, excerpt_slot; Part B roles: cfu_item, support_table");
  });

  it("academic_discussion_prints_no_parts_and_flex_keeps_its_heading", () => {
    // hand-written from the section-missing analysis 2026-10-26: no worked pair gives Academic Discussion parts
    const ad = template_lines(template_for("Academic Discussion")!);
    expect(ad.filter((l) => l.includes("parts:"))).toEqual([]);
    const flex = template_lines(template_for("Flex Day")!);
    expect(flex.find((l) => l.includes(": Launch, "))).toContain("sample_response");
    expect(flex.find((l) => l.includes(": Learning in Action, "))).toContain("routine_heading");
  });

  // Agreement check only, not an independent oracle.
  it("every_production_template_is_rendered_in_full", () => {
    for (const t of SECTION_TEMPLATES.templates) {
      const lines = template_lines(t);
      for (const s of t.sections) {
        const line = lines.find((l) => l.includes(`: ${s.name}, `));
        expect(line, `${t.lesson_type} ${s.name}`).toBeDefined();
        expect(line).toContain(`${s.minutes} minutes`);
        expect(line).toContain(s.required_roles.join(", "));
        expect(line?.includes("parts:"), `${t.lesson_type} ${s.name} parts`).toBe(s.parts !== undefined);
      }
    }
  });
});
