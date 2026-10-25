import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY } from "../../test-helpers.ts";
import { RULE_GROUPS } from "../../registry.ts";
import { ctx_with, flag, lesson_with_tip, note_segment } from "./test-support.ts";

describe("safety finding shape", () => {
  it("every finding has the 7 keys and its rule's kind", () => {
    const base = ctx_with(
      lesson_with_tip(null, {
        homework: "Read how the chapter describes the loss of a pet today.",
        quick_write: "Write about a time you felt left out.",
      }),
      { safety_flags: [flag()] },
    );
    const ctx = { ...base, row: { ...base.row, segments: [note_segment()] } };
    const seen: string[] = [];
    for (const rule of RULE_GROUPS.safety) {
      for (const f of rule.run(ctx, DEFAULT_POLICY)) {
        seen.push(rule.kind);
        expect(Object.keys(f).sort()).toEqual(["address", "code", "kind", "level", "message", "related_lesson_id", "span_anchor"]);
        expect(f.kind).toBe(rule.kind);
        expect(["blocking", "confirmation", "advisory"]).toContain(f.level);
        expect(f.message).not.toBe("");
      }
    }
    expect([...new Set(seen)].sort()).toEqual([
      "disclosure_prompt",
      "safety_flag_open",
      "safety_note_without_tip",
      "safety_text_in_student_block",
    ]);
  });
});
