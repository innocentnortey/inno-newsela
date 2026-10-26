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
    ]) expect(shape, phrase).toContain(phrase);
  });
  it("no longer points at text cards as a source of names or quotations", () => {
    expect(shape).not.toContain("text card");
  });
});
