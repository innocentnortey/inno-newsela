import { describe, expect, it } from "vitest";
import { DRAFT_ROLES } from "@ls/schema/lesson-draft";
import { SECTION_TEMPLATES, template_for } from "./templates.ts";

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
  it("unknown type is undefined", () => {
    expect(template_for("Nope")).toBeUndefined();
  });
  it("required roles are draft roles", () => {
    for (const t of SECTION_TEMPLATES.templates)
      for (const s of t.sections) for (const r of s.required_roles) expect(DRAFT_ROLES).toContain(r);
  });
});
