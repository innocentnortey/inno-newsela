import { describe, expect, it } from "vitest";
import { CHECK_POLICY } from "../../policy.ts";
import { build_ctx, type Fixture } from "./fixtures/build.ts";
import { RULES } from "./index.ts";

const SCANS = ["quote_unmatched", "page_out_of_range", "proper_noun_unsourced"];
const OPEN = ["quote_placeholder_open", "excerpt_slot_open", "rights_to_clear"];
const findings = (name: Fixture) => {
  const ctx = build_ctx(name);
  return RULES.flatMap((r) => r.run(ctx, CHECK_POLICY));
};

describe("clean drafts", () => {
  for (const name of ["wp1", "wp2", "wp4"] as const) {
    it(`${name} has at most one scan flag`, () => {
      const flags = findings(name).filter((f) => SCANS.includes(f.kind));
      expect(flags.length).toBeLessThanOrEqual(1);
    });
  }

  it("wp3 has no scan flags and no placeholders", () => {
    const all = findings("wp3");
    expect(all.filter((f) => SCANS.includes(f.kind) || OPEN.includes(f.kind))).toEqual([]);
  });

  it("wp2 quotes its title and the row's quoted word without a quote_unmatched", () => {
    const ctx = build_ctx("wp2");
    const text = JSON.stringify(ctx.lesson);
    expect(text).toContain("“The Hare and the Lion”");
    expect(text).toContain("“trouble”");
    expect(findings("wp2").filter((f) => f.kind === "quote_unmatched")).toEqual([]);
  });
});
