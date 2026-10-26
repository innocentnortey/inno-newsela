import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY } from "../../test-helpers.ts";
import { RULE_GROUPS, run_checks } from "../../registry.ts";
import { derive_alignment } from "./derive.ts";
import { wp1_ctx } from "./test-support.ts";

describe("derive_alignment", () => {
  it("derives I and A rows with provenance, never the word aligned", () => {
    const ctx = wp1_ctx();
    const rows = derive_alignment(ctx);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(["outline", "generator", "judge", "reviewer"]).toContain(r.asserted_by);
      expect(["I", "P", "A"]).toContain(r.role);
      expect(r.address).not.toBe("");
    }
    expect(rows.map((r) => r.role)).toEqual(expect.arrayContaining(["I", "A"]));
    const msgs = run_checks(ctx, RULE_GROUPS.alignment, DEFAULT_POLICY).findings.map((f) => f.message).join();
    expect(msgs).not.toMatch(/aligned/i);
  });

  it("links_are_unconfirmed_and_never_judge", () => {
    const ctx = wp1_ctx();
    const rows = derive_alignment(ctx);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.asserted_by).not.toBe("judge");
      expect(r.confirmed_by).toBeNull();
    }
    const msgs = run_checks(ctx, RULE_GROUPS.alignment, DEFAULT_POLICY).findings.map((f) => f.message);
    for (const m of msgs) expect(m).not.toMatch(/aligned|verified/i);
  });
});
