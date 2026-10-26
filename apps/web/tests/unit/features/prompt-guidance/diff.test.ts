import { describe, expect, it } from "vitest";
import { latestText, parseDiff } from "@/features/prompt-guidance/diff";

describe("parseDiff", () => {
  it("marks add, remove and same lines", () => {
    expect(parseDiff("+ a\n- b\n c").map((l) => l.kind)).toEqual([
      "add",
      "remove",
      "same",
    ]);
    expect(parseDiff("+ a")[0]?.text).toBe("a");
  });
  it("is empty for an empty diff", () => {
    expect(parseDiff("")).toEqual([]);
  });
});

describe("latestText", () => {
  it("uses the added and unmarked lines of the latest version", () => {
    expect(
      latestText([
        { number: 1, diff: "" },
        { number: 2, diff: "+ a\n- b\n c" },
      ]),
    ).toBe("a\n c");
    expect(latestText([])).toBe("");
  });
});
