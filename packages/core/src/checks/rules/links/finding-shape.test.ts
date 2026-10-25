import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY } from "../../test-helpers.ts";
import { RULE_GROUPS } from "../../registry.ts";
import { ctx_with_link, l5 } from "./test-support.ts";

describe("links finding shape", () => {
  it("every finding has the 7 keys and its rule's kind", () => {
    const base = ctx_with_link(l5({ rights: "unset", source_ref: null }), {
      recorded_link_hashes: { lk1: "a".repeat(64) },
    });
    const ctx = {
      ...base,
      pending_suggestions: [
        { suggestion_id: "sg1", lesson_id: "G6.U4.L4", anchor_start: "a", anchor_end: "b", selected_text: "x", suggested_text: "y", status: "pending" as const },
      ],
    };
    const seen: string[] = [];
    for (const rule of RULE_GROUPS.links) {
      for (const f of rule.run(ctx, DEFAULT_POLICY)) {
        seen.push(rule.kind);
        expect(Object.keys(f).sort()).toEqual(["address", "code", "kind", "level", "message", "related_lesson_id", "span_anchor"]);
        expect(f.kind).toBe(rule.kind);
        expect(f.message).not.toBe("");
      }
    }
    expect([...new Set(seen)].sort()).toEqual(["cross_lesson_link", "linked_text_changed", "suggestion_pending"]);
  });
});
