import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY } from "../../test-helpers.ts";
import { disclosure_prompt_rule as rule } from "./disclosure_prompt.ts";
import { ctx_with, flag, lesson_with_tip } from "./test-support.ts";

const prompt = "Write about a time you felt left out.";

describe("disclosure_prompt", () => {
  it("is blocking with an open flag", () => {
    const ctx = ctx_with(lesson_with_tip(null, { quick_write: prompt }), { safety_flags: [flag()] });
    expect(rule.run(ctx, DEFAULT_POLICY).map((f) => f.level)).toEqual(["blocking"]);
  });

  it("is blocking when the previous lesson was flagged", () => {
    const ctx = ctx_with(lesson_with_tip(null, { quick_write: prompt }), { previous_lesson_flags: [flag()] });
    expect(rule.run(ctx, DEFAULT_POLICY).map((f) => f.level)).toEqual(["blocking"]);
  });

  it("is advisory with no flags", () => {
    const ctx = ctx_with(lesson_with_tip(null, { quick_write: prompt }));
    expect(rule.run(ctx, DEFAULT_POLICY).map((f) => f.level)).toEqual(["advisory"]);
  });

  it("a flagged lesson with a tip and no pattern is clean", () => {
    const id = "G6.U4.L31";
    const ctx = ctx_with(lesson_with_tip(`${id}.sn1`, { id, quick_write: "Describe the setting." }), {
      safety_flags: [flag({ flag_id: `${id}.sn1`, lesson_id: id })],
    });
    expect(rule.run(ctx, DEFAULT_POLICY)).toEqual([]);
  });
});
