import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY } from "../../test-helpers.ts";
import { code_not_allowed_rule } from "./code_not_allowed.ts";
import { lesson_with, rec, wp1_ctx } from "./test-support.ts";

describe("code_not_allowed", () => {
  it("flags an unlisted leaf of an unlisted parent", () => {
    const ctx = wp1_ctx({ lesson: lesson_with([rec("RL.6.7")]), allowed_codes: [] });
    const f = code_not_allowed_rule.run(ctx, DEFAULT_POLICY);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ level: "blocking", code: "RL.6.7" });
  });

  it("flags a recorded non-leaf code", () => {
    const ctx = wp1_ctx({ lesson: lesson_with([rec("L.6.4")]) });
    expect(code_not_allowed_rule.run(ctx, DEFAULT_POLICY)).toHaveLength(1);
  });

  it("accepts a listed leaf (control)", () => {
    const base = wp1_ctx({ lesson: lesson_with([rec("RL.6.1")], "RL.6.1") });
    const ctx = { ...base, row: { ...base.row, focus_codes: ["RL.6.1"] } };
    expect(code_not_allowed_rule.run(ctx, DEFAULT_POLICY)).toEqual([]);
  });
});
