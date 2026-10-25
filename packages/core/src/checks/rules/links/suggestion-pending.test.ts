import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY, make_ctx, reading_lesson } from "../../test-helpers.ts";
import type { SuggestionRow } from "../../types.ts";
import { suggestion_pending_rule } from "./suggestion_pending.ts";

// The rule takes no clock: NL-43's pending_for/get already map an expired row to "closed".
const row = (status: SuggestionRow["status"]): SuggestionRow => ({
  suggestion_id: "sg1",
  lesson_id: "G6.U4.L4",
  anchor_start: "a",
  anchor_end: "b",
  selected_text: "secret words",
  suggested_text: "other",
  status,
});

describe("suggestion_pending", () => {
  it("a pending suggestion blocks; a closed one does not", () => {
    const ctx = make_ctx(reading_lesson());
    const out = suggestion_pending_rule.run({ ...ctx, pending_suggestions: [row("pending")] }, DEFAULT_POLICY);
    expect(out).toHaveLength(1);
    expect(out[0]?.message).not.toContain("secret words");
    expect(suggestion_pending_rule.run({ ...ctx, pending_suggestions: [row("closed")] }, DEFAULT_POLICY)).toEqual([]);
  });
});
