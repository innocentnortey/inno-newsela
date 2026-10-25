// NL-12
import { describe, expect, it } from "vitest";
import { PrefixedIdGenerator } from "./ids.ts";

const ID = /^ae_[0-9A-HJKMNP-TV-Z]{26}$/;

describe("PrefixedIdGenerator", () => {
  it("mints <prefix>_<26 Crockford chars>", () => {
    expect(new PrefixedIdGenerator().new_id("ae")).toMatch(ID);
  });

  it("is strictly increasing within one millisecond", () => {
    const g = new PrefixedIdGenerator({ now: () => 1_700_000_000_000 });
    const ids = Array.from({ length: 500 }, () => g.new_id("ae"));
    for (let i = 1; i < ids.length; i++) expect(ids[i]! > ids[i - 1]!).toBe(true);
  });

  it("sorts by time across milliseconds", () => {
    let t = 1_700_000_000_000;
    const g = new PrefixedIdGenerator({ now: () => t });
    const a = g.new_id("ae");
    t += 1;
    expect(g.new_id("ae") > a).toBe(true);
  });

  it("does not reorder ids when the clock steps back", () => {
    let t = 1_700_000_000_000;
    const g = new PrefixedIdGenerator({ now: () => t });
    const a = g.new_id("ae");
    t -= 5000;
    expect(g.new_id("ae") > a).toBe(true);
  });

  it("moves to the next millisecond when the random part overflows", () => {
    const g = new PrefixedIdGenerator({ now: () => 5, random: () => new Uint8Array(10).fill(255) });
    const a = g.new_id("ae");
    const b = g.new_id("ae");
    expect(b > a).toBe(true);
    expect(b).toMatch(ID);
  });

  it("is deterministic with injected time and randomness", () => {
    const mk = () => new PrefixedIdGenerator({ now: () => 7, random: () => new Uint8Array(10) });
    expect(mk().new_id("run")).toBe(mk().new_id("run"));
    expect(mk().new_id("run")).toBe("run_0000000007" + "0".repeat(16));
  });
});
