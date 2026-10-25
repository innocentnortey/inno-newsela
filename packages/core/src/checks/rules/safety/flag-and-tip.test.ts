import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY, make_ctx } from "../../test-helpers.ts";
import { RULE_GROUPS, run_checks } from "../../registry.ts";
import { safety_flag_open_rule } from "./safety_flag_open.ts";
import { safety_note_without_tip_rule } from "./safety_note_without_tip.ts";
import { ctx_with, flag, lesson_with_tip, note_segment } from "./test-support.ts";

describe("safety flag and tip", () => {
  it("an open flag is blocking at its tip address", () => {
    const f = flag();
    const ctx = ctx_with(lesson_with_tip(f.flag_id), { safety_flags: [f] });
    const out = safety_flag_open_rule.run(ctx, DEFAULT_POLICY);
    expect(out).toHaveLength(1);
    expect(out[0]?.address).toBe(f.teacher_tip_address);
    expect(out[0]?.message).not.toContain("loss of a pet");
  });

  it("a note without a tip blocks", () => {
    const base = make_ctx(lesson_with_tip(null));
    const ctx = { ...base, row: { ...base.row, segments: [note_segment()] } };
    expect(safety_note_without_tip_rule.run(ctx, DEFAULT_POLICY)).toHaveLength(1);
  });

  it("a tip carrying the id plus an open flag is exactly one blocking", () => {
    const f = flag();
    const base = ctx_with(lesson_with_tip(f.flag_id), { safety_flags: [f] });
    const ctx = { ...base, row: { ...base.row, segments: [note_segment()] } };
    const r = run_checks(ctx, RULE_GROUPS.safety, DEFAULT_POLICY);
    expect(r.blocking).toBe(1);
    expect(r.findings[0]?.kind).toBe("safety_flag_open");
  });
});
