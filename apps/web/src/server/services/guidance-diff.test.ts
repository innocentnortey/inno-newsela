// @vitest-environment node
// NL-88: the pure guidance line diff.
import { describe, expect, it } from "vitest";
import { diff_lines } from "./guidance-diff.ts";

describe("diff_lines", () => {
  it("adds a line to an empty base", () => expect(diff_lines("", "g")).toBe("+g"));
  it("replaces a changed line", () => expect(diff_lines("a\nb", "a\nc")).toBe("-b\n+c"));
  it("is empty for identical input", () => {
    expect(diff_lines("a\nb", "a\nb")).toBe("");
    expect(diff_lines("", "")).toBe("");
  });
  it("handles an insert in the middle", () => expect(diff_lines("a\nc", "a\nb\nc")).toBe("+b"));
  it("handles removing everything", () => expect(diff_lines("a\nb", "")).toBe("-a\n-b"));
  it("falls back to all-removed then all-added for huge unrelated inputs", () => {
    const a = Array.from({ length: 2500 }, (_, i) => "old" + i);
    const b = Array.from({ length: 2500 }, (_, i) => "new" + i);
    expect(diff_lines(a.join("\n"), b.join("\n"))).toBe([...a.map((l) => "-" + l), ...b.map((l) => "+" + l)].join("\n"));
  });
});
