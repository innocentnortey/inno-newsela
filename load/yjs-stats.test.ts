// NL-119 AC-2: the lost-update counter and the other pure helpers.
import { describe, expect, it } from "vitest";
import { count_duplicates, count_lost, error_rate, make_token, percentile } from "./yjs-stats.ts";

describe("percentile", () => {
  it("is nearest-rank and 0 for an empty list", () => {
    expect(percentile([], 95)).toBe(0);
    expect(percentile([5], 95)).toBe(5);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50)).toBe(5);
    expect(percentile([10, 1, 9, 2, 8, 3, 7, 4, 6, 5], 95)).toBe(10);
    expect(percentile(Array.from({ length: 100 }, (_, i) => i + 1), 95)).toBe(95);
  });
});

describe("lost_updates", () => {
  const tokens = Array.from({ length: 100 }, (_, i) => make_token("e1", i));
  it("counts exactly the acknowledged tokens missing from the stored text", () => {
    const text = tokens.filter((t) => t !== "[e1-7]" && t !== "[e1-42]").join("");
    const r = count_lost(tokens, text);
    expect(r.lost_updates).toBe(2);
    expect(r.lost.sort()).toEqual(["[e1-42]", "[e1-7]"]);
  });
  it("is 0 when every token is present", () => {
    expect(count_lost(tokens, tokens.join("")).lost_updates).toBe(0);
  });
  it("brackets keep e1-1 and e1-11 apart", () => {
    expect(count_lost(["[e1-1]"], "[e1-11]").lost_updates).toBe(1);
  });
});

describe("count_duplicates and error_rate", () => {
  it("counts a token present twice once", () => {
    expect(count_duplicates(["[a-1]", "[a-2]"], "[a-1][a-2][a-1]")).toBe(1);
    expect(count_duplicates(["[a-1]"], "[a-1]")).toBe(0);
  });
  it("clamps to [0,1] and never divides by zero", () => {
    expect(error_rate(0, 0)).toBe(0);
    expect(error_rate(3, 0)).toBe(1);
    expect(error_rate(1, 4)).toBe(0.25);
    expect(error_rate(9, 3)).toBe(1);
  });
});
