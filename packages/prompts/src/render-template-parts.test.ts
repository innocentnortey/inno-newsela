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
});
