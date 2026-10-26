import { describe, expect, it } from "vitest";
import { LOCKED_DIR } from "./locked.ts";
import { PromptRenderer } from "./render.ts";
import { SchemaRegistry } from "./schemas.ts";
import { TEMPLATE, draft_input, wp2_row } from "./testing/fixtures.ts";

const template_text = (template: typeof TEMPLATE): string => {
  const p = new PromptRenderer(LOCKED_DIR, new SchemaRegistry()).render_lesson_draft({ ...draft_input(wp2_row()), template });
  return p.user_blocks.find((b) => b.text.includes("kind=template"))!.text;
};

describe("template block parts", () => {
  it("prints the parts of a section that has them", () => {
    const template = {
      sections: TEMPLATE.sections.map((s) => (s.name === "Practice" ? { ...s, parts: ["Part A", "Part B"] } : s)),
    };
    const lines = template_text(template).split("\n");
    const lia = lines.find((l) => l.includes("Practice"))!;
    expect(lia).toMatch(/; parts: Part A, Part B$/);
    expect(lines.filter((l) => l.includes("parts:"))).toHaveLength(1);
  });
  it("leaves a section without parts exactly as before", () => {
    expect(template_text(TEMPLATE)).not.toContain("parts:");
  });
  it("prints each part's roles and its placeholder role after the parts", () => {
    const template = {
      sections: TEMPLATE.sections.map((s) =>
        s.name === "Practice"
          ? { ...s, parts: ["Part A", "Part B"], part_roles: { "Part A": ["teacher_talk", "support_table"], "Part B": ["cfu_item"] }, part_placeholder: { "Part A": "text_evidence_needed" } }
          : s),
    };
    const lia = template_text(template).split("\n").find((l) => l.includes("Practice"))!;
    expect(lia).toContain("; Part A roles: teacher_talk, support_table, text_evidence_needed; Part B roles: cfu_item");
  });
});
