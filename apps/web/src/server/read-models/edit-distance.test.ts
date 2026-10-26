// NL-104: token edit distance (tile V-4).
import { describe, expect, it } from "vitest";
import { normalized_edit_distance } from "./edit-distance.ts";

describe("normalized_edit_distance", () => {
  it("identical text is 0", () => expect(normalized_edit_distance("a b c d", "a b c d")).toBe(0));
  it("one changed token of four is 0.25", () => expect(normalized_edit_distance("a b c d", "a x c d")).toBe(0.25));
  it("both empty is 0", () => expect(normalized_edit_distance("", "  ")).toBe(0));
  it("one empty and one of four tokens is 1", () => expect(normalized_edit_distance("", "a b c d")).toBe(1));
  it("respects the token cap and stays fast", () => {
    const a = Array.from({ length: 700 }, (_, i) => `a${i}`).join(" ");
    const b = Array.from({ length: 700 }, (_, i) => `b${i}`).join(" ");
    const t0 = performance.now();
    expect(normalized_edit_distance(a, b)).toBe(1);
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});
