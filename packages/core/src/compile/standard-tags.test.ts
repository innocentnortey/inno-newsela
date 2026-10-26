import { describe, expect, it } from "vitest";
import { format_tag, parse_tag } from "./standard-tags.ts";

describe("standard tags", () => {
  it("formats a pulse check tag", () => {
    expect(format_tag("Pulse Check", ["RL.6.2"])).toBe("Pulse Check (RL.6.2)");
  });
  it("never doubles a tag", () => {
    expect(format_tag("Percy's Voice (RL.6.1)", ["RL.6.1"])).toBe("Percy's Voice (RL.6.1)");
  });
  it("returns the bare label with no codes", () => {
    expect(format_tag(" Turn and Talk ", [])).toBe("Turn and Talk");
  });
  it("parses a strict tag", () => {
    expect(parse_tag("Introduce New Words (L.6.4.b)", true)).toEqual({ label: "Introduce New Words", codes: ["L.6.4.b"] });
  });
  it("strict rejects a title in parentheses", () => {
    expect(parse_tag("Turn and Talk (Pairs)", true)).toBeNull();
  });
  it("loose keeps a malformed code", () => {
    expect(parse_tag("Pulse Check (RL 6.1)", false)?.codes).toEqual(["RL 6.1"]);
  });
  it("no tag gives null", () => {
    expect(parse_tag("Quick Write", false)).toBeNull();
  });
  it("collapses duplicates and round trips", () => {
    expect(format_tag("X", ["RL.6.1", "RL.6.1"])).toBe("X (RL.6.1)");
    const t = format_tag("Lab", ["RL.6.1", "L.6.4.b"]);
    expect(parse_tag(t, true)).toEqual({ label: "Lab", codes: ["RL.6.1", "L.6.4.b"] });
  });
});
