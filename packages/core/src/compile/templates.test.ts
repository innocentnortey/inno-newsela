import { describe, expect, it } from "vitest";
import { DRAFT_ROLES } from "@ls/schema/lesson-draft";
import { CHECK_POLICY } from "../checks/policy.ts";
import {
  SECTION_MINUTES_CHECK_TOLERANCE,
  SECTION_MINUTES_PROMPT_TOLERANCE,
  SECTION_TEMPLATES,
  template_for,
} from "./templates.ts";

describe("templates", () => {
  it("minutes sum to 50 for every type", () => {
    for (const t of SECTION_TEMPLATES.templates) {
      expect(t.sections.reduce((s, x) => s + x.minutes, 0), t.lesson_type).toBe(50);
    }
  });
  it("Spark, Flex Day and Assessment have no Literacy Lab", () => {
    for (const n of ["Spark", "Flex Day", "Assessment"]) {
      expect(template_for(n)?.sections.map((s) => s.name)).not.toContain("Literacy Lab");
    }
  });
  it("Flex Day is 5/40/5", () => {
    expect(template_for("Flex Day")?.sections.map((s) => s.minutes)).toEqual([5, 40, 5]);
  });
  it("every Learning in Action asks for the ELD callouts and a Pulse Check the check rules require", () => {
    for (const t of SECTION_TEMPLATES.templates) {
      const lia = t.sections.find((s) => s.name === "Learning in Action");
      for (const r of ["cfu_item", "callout_purpose", "callout_say", "callout_watch"] as const)
        expect(lia?.required_roles, `${t.lesson_type} ${r}`).toContain(r);
    }
  });
  it("unknown type is undefined", () => {
    expect(template_for("Nope")).toBeUndefined();
  });
  it("required roles are draft roles", () => {
    for (const t of SECTION_TEMPLATES.templates)
      for (const s of t.sections) for (const r of s.required_roles) expect(DRAFT_ROLES).toContain(r);
  });
  // Oracle: WP-1 and WP-2 table B (Part A / Part B in Learning in Action); no worked pair for the other types; WP-3 has none.
  it("parts_only_for_reading_and_writing_learning_in_action", () => {
    for (const n of ["Reading", "Writing"])
      for (const sec of template_for(n)!.sections)
        expect(sec.parts, `${n} ${sec.name}`).toEqual(sec.name === "Learning in Action" ? ["Part A", "Part B"] : undefined);
    for (const n of ["Academic Discussion", "Research", "Presentation", "Spark", "Flex Day", "Assessment"])
      for (const sec of template_for(n)!.sections) expect(sec.parts, `${n} ${sec.name}`).toBeUndefined();
  });
  // Oracle: WP-1/WP-2 expected.json list no routine_heading for Learning in Action; WP-3 lists it for Flex Day.
  it("routine_heading_required_in_learning_in_action_only_for_flex_and_assessment", () => {
    for (const t of SECTION_TEMPLATES.templates) {
      const lia = t.sections.find((s) => s.name === "Learning in Action")!.required_roles;
      const flex = t.lesson_type === "Flex Day" || t.lesson_type === "Assessment";
      expect(lia.includes("routine_heading"), t.lesson_type).toBe(flex);
    }
  });
  it("flex_day_asks_for_wp3_components", () => {
    const t = template_for("Flex Day")!;
    expect(t.sections.find((s) => s.name === "Launch")?.required_roles).toContain("sample_response");
    const lia = t.sections.find((s) => s.name === "Learning in Action")!.required_roles;
    for (const r of ["routine_heading", "teacher_tip", "cfu_item"] as const) expect(lia).toContain(r);
  });
});

describe("templates: named tolerances and obligations", () => {
  it("minutes_tolerances_are_named", () => {
    expect(SECTION_MINUTES_PROMPT_TOLERANCE).toBe(0);
    expect(SECTION_MINUTES_CHECK_TOLERANCE).toBe(1);
  });
  it("template_totals_equal_the_policy_target", () => {
    for (const t of SECTION_TEMPLATES.templates) {
      expect(t.sections.reduce((s, x) => s + x.minutes, 0), t.lesson_type).toBe(CHECK_POLICY.minutes_target);
    }
  });
  it("parts_are_exact_labels", () => {
    for (const t of SECTION_TEMPLATES.templates)
      for (const sec of t.sections)
        for (const label of sec.parts ?? []) expect(label).toMatch(/^Part [A-Z]$/);
  });
});
