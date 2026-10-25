import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY } from "../../test-helpers.ts";
import { RULE_GROUPS } from "../../registry.ts";
import { lesson_with, rec, std_rows, wp1_ctx } from "./test-support.ts";

describe("alignment finding shape", () => {
  it("every finding has the 7 keys and its rule's kind", () => {
    const base = wp1_ctx();
    const ctx = {
      ...base,
      lesson: lesson_with(
        [rec("L.6.4.b", { origin: "narrowed" }), rec("RL.6.7"), rec("ELD.PI.6.6b", { role: "eld", official_text: "synthetic strand two label" })],
        "L.6.4.c",
      ),
      row: { ...base.row, focus_codes: ["L.6.4", "RL.1"], eld_codes: ["ELD.PI.6.6b"] },
      standards: std_rows(),
      allowed_codes: ["L.6.4.b"],
    };
    const seen = new Set<string>();
    for (const rule of RULE_GROUPS.alignment) {
      for (const f of rule.run(ctx, DEFAULT_POLICY)) {
        seen.add(rule.kind);
        expect(Object.keys(f).sort()).toEqual(["address", "code", "kind", "level", "message", "related_lesson_id", "span_anchor"]);
        expect(f.kind).toBe(rule.kind);
        expect(["blocking", "confirmation", "advisory"]).toContain(f.level);
        expect(f.message).not.toBe("");
      }
    }
    expect([...seen].sort()).toEqual([
      "code_not_allowed",
      "eld_label_mismatch",
      "standard_add_suggestion",
      "standard_confirmation",
      "standard_not_checked",
    ]);
  });
});
