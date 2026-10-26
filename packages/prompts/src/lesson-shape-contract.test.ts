import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCKED_DIR } from "./locked.ts";

describe("lesson-shape contract text", () => {
  const shape = readFileSync(join(LOCKED_DIR, "lesson-shape.md"), "utf8");
  it("states the part, teaching-tag and code_origins rules", () => {
    for (const phrase of [
      "exactly as listed",
      "Part A blocks before the Part B blocks",
      "teacher_tip",
      "one entry for each entry of standard_codes",
      "up to two codes",
      "set standard_code to null",
      "never write N/A",
      "does not count toward that limit of two",
      "does not count as teaching",
      "callout_say",
      "Sub-codes.",
      "narrowed in code_origins",
      "must confirm",
      "also counts as a check",
      "do not choose standards yourself",
      "either stays empty or lists the same codes",
    ]) expect(shape, phrase).toContain(phrase);
  });
  it("requires a Flex sample_response in Launch and parts only where the template lists them", () => {
    expect(shape).toContain("also needs a sample_response in Launch");
    expect(shape).toContain("Only a section whose template line lists parts uses them");
  });
  it("states the placeholder policy and the part roles (WP-1, WP-2, WP-4)", () => {
    for (const phrase of [
      "Part roles.", "Placeholders.", "exactly one in Learning in Action Part A", "never more than two blocks",
      "only when the card's homework asks students to read a separate named text",
      "A Writing lesson never gets a second placeholder",
    ]) expect(shape, phrase).toContain(phrase);
  });
  it("no longer forbids narrowing", () => {
    expect(shape).not.toContain("Do not narrow");
  });
  it("no longer points at text cards as a source of names or quotations", () => {
    expect(shape).not.toContain("text card");
  });
});
