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

  it("listed_parent_is_allowed", () => {
    const ctx = wp1_ctx({ lesson: lesson_with([rec("L.6.4")], "L.6.4", "L.6.4") });
    expect(code_not_allowed_rule.run(ctx, DEFAULT_POLICY)).toEqual([]);
  });

  it("leaf_of_listed_parent_is_allowed", () => {
    expect(code_not_allowed_rule.run(wp1_ctx(), DEFAULT_POLICY)).toEqual([]);
  });

  it("unlisted_leaf_blocked", () => {
    const ctx = wp1_ctx({ lesson: lesson_with([rec("RL.6.7")], "RL.6.7", "RL.6.7"), allowed_codes: [] });
    const f = code_not_allowed_rule.run(ctx, DEFAULT_POLICY);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ level: "blocking", code: "RL.6.7" });
  });

  it("unlisted_parent_blocked", () => {
    const ctx = wp1_ctx({ lesson: lesson_with([rec("W.6.2")], "W.6.2", "W.6.2") });
    expect(code_not_allowed_rule.run(ctx, DEFAULT_POLICY).map((f) => f.code)).toEqual(["W.6.2"]);
  });

  it("parent_of_listed_leaf_blocked", () => {
    const base = wp1_ctx({ lesson: lesson_with([rec("L.6.4")], "L.6.4", "L.6.4"), allowed_codes: [] });
    const ctx = { ...base, row: { ...base.row, focus_codes: ["L.6.4.b"] } };
    expect(code_not_allowed_rule.run(ctx, DEFAULT_POLICY).map((f) => f.code)).toEqual(["L.6.4"]);
  });

  it("unknown_tagged_code_is_blocked", () => {
    const ctx = wp1_ctx({ lesson: lesson_with([rec("L.6.4.b")], "L.6.3a", "L.6.4.b") });
    const f = code_not_allowed_rule.run(ctx, DEFAULT_POLICY);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ level: "blocking", code: "L.6.3a" });
    expect(f[0]?.message).toContain("is used in a heading");
  });

  it("added_code_allowed_only_when_row_list_empty", () => {
    const added = rec("RL.6.7", { origin: "added" });
    const lesson = lesson_with([added], "RL.6.7", "RL.6.7");
    const base = wp1_ctx({ lesson, allowed_codes: [] });
    expect(code_not_allowed_rule.run({ ...base, row: { ...base.row, focus_codes: [] } }, DEFAULT_POLICY)).toEqual([]);
    expect(code_not_allowed_rule.run(base, DEFAULT_POLICY)).toHaveLength(1);
  });

  it("accepts a listed leaf (control)", () => {
    const base = wp1_ctx({ lesson: lesson_with([rec("RL.6.1")], "RL.6.1") });
    const ctx = { ...base, row: { ...base.row, focus_codes: ["RL.6.1"] } };
    expect(code_not_allowed_rule.run(ctx, DEFAULT_POLICY)).toEqual([]);
  });
});
