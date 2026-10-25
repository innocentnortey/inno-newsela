import { describe, expect, it } from "vitest";
import { parseUnitTitle } from "@/features/board/unit-title";

describe("parseUnitTitle", () => {
  it("splits grade, unit and novel", () => {
    expect(parseUnitTitle("Grade 6 · Unit 4 · The Lightning Thief", "g6-u4")).toEqual({
      grade: "Grade 6",
      unit: "Unit 4",
      novel: "The Lightning Thief",
    });
  });
  it("has no novel without a third part", () => {
    expect(parseUnitTitle("Grade 6 · Unit 4", "g6-u4")).toEqual({ grade: "Grade 6", unit: "Unit 4", novel: null });
  });
  it("falls back to the key", () => {
    expect(parseUnitTitle(undefined, "g6-u4")).toEqual({ grade: "Grade 6", unit: "Unit 4", novel: null });
    expect(parseUnitTitle(undefined, "odd")).toEqual({ grade: null, unit: "odd", novel: null });
  });
});
