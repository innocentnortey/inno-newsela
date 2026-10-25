import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY } from "../../test-helpers.ts";
import { RULE_GROUPS, run_checks } from "../../registry.ts";
import { derive_alignment } from "./derive.ts";
import { lesson_with, rec, std_rows, wp1_ctx } from "./test-support.ts";

const run = (ctx: ReturnType<typeof wp1_ctx>) => run_checks(ctx, RULE_GROUPS.alignment, DEFAULT_POLICY);

describe("advisory alignment rules", () => {
  it("an unlisted leaf tag suggests an add and changes no gate", () => {
    const base = wp1_ctx({ allowed_codes: ["L.6.4.b"] });
    const plain = run(base);
    const ctx = { ...base, lesson: lesson_with([rec("L.6.4.b")], "L.6.4.b, L.6.4.c") };
    const r = run(ctx);
    expect(r.advisory).toBe(plain.advisory + 1);
    expect(r.findings.filter((f) => f.kind === "standard_add_suggestion")).toHaveLength(1);
    expect(r.blocking).toBe(plain.blocking);
    expect(r.first_failing_kind).toBe(plain.first_failing_kind);
    expect(derive_alignment(ctx).some((a) => a.code === "L.6.4.c")).toBe(false);
  });

  it("an ELD label from another strand is advisory", () => {
    const base = wp1_ctx();
    const plain = run(base);
    const eld = rec("ELD.PI.6.6b", { role: "eld", official_text: "Synthetic Strand  Two label" });
    const ctx = {
      ...base,
      lesson: lesson_with([rec("L.6.4.b"), eld]),
      row: { ...base.row, eld_codes: ["ELD.PI.6.6b"] },
      standards: std_rows(),
    };
    const r = run(ctx);
    expect(r.findings.filter((f) => f.kind === "eld_label_mismatch")).toHaveLength(1);
    expect(r.advisory).toBe(plain.advisory + 1);
    expect(r.blocking).toBe(plain.blocking);
  });
});
