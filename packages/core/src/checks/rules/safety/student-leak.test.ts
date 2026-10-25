import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY } from "../../test-helpers.ts";
import { safety_text_in_student_block_rule as rule } from "./safety_text_in_student_block.ts";
import { NOTE_TEXT, ctx_with, lesson_with_tip, note_segment } from "./test-support.ts";

const ctx_for = (homework: string) => {
  const base = ctx_with(lesson_with_tip("G6.U4.L4.sn1", { homework }));
  return { ...base, row: { ...base.row, segments: [note_segment()] } };
};

describe("safety_text_in_student_block", () => {
  it("a 6-word run in Homework is one blocking finding with no note text", () => {
    const out = rule.run(ctx_for("Read how the chapter describes the loss of a pet today."), DEFAULT_POLICY);
    expect(out).toHaveLength(1);
    const words = NOTE_TEXT.split(" ");
    for (let i = 0; i + 3 <= words.length; i += 1)
      expect(out[0]?.message).not.toContain(words.slice(i, i + 3).join(" "));
    expect(out[0]?.message).toContain(out[0]?.address ?? "?");
  });

  it("a 5-word run is not a leak", () => {
    expect(rule.run(ctx_for("Think how the chapter describes the loss."), DEFAULT_POLICY)).toEqual([]);
  });

  it("the teacher tip itself is not a student block", () => {
    expect(rule.run(ctx_for("Nothing related."), DEFAULT_POLICY)).toEqual([]);
  });
});
