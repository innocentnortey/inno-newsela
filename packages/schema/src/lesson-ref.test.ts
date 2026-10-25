import { describe, expect, it } from "vitest";
import { parse_lesson_ref } from "./lesson-ref.ts";

describe("lesson-ref", () => {
  it("parses_both_forms: canonical and short forms give one id", () => {
    expect(parse_lesson_ref("G6.U4.L4")).toBe("G6.U4.L4");
    expect(parse_lesson_ref("g6-u4:L4")).toBe("G6.U4.L4");
    expect(parse_lesson_ref("g6-u4:FLEX-1a")).toBe("G6.U4.FLEX-1a");
  });
  it("rejects_malformed: partial, padded and wrong-case refs give null", () => {
    for (const bad of ["g6-u4", "G6.U4", "g6-u4:L4 ", "g6-u4:l4", ""]) {
      expect(parse_lesson_ref(bad)).toBeNull();
    }
  });
});
