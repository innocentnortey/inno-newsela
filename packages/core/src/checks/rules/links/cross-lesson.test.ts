import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY } from "../../test-helpers.ts";
import { cross_lesson_link_rule } from "./cross_lesson_link.ts";
import { linked_text_changed_rule } from "./linked_text_changed.ts";
import { ctx_with_link, l5, link } from "./test-support.ts";

describe("cross-lesson links", () => {
  it("an empty source slot blocks the homework", () => {
    const out = cross_lesson_link_rule.run(ctx_with_link(l5({ rights: "unset", source_ref: null })), DEFAULT_POLICY);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ level: "blocking", related_lesson_id: "G6.U4.L5", address: link.from_address });
  });

  it("a filled slot does not", () => {
    const ctx = ctx_with_link(l5({ rights: "cleared", source_ref: "ref" }));
    expect(cross_lesson_link_rule.run(ctx, DEFAULT_POLICY)).toEqual([]);
  });

  it("a filled slot whose source is not approved waits (blocks approve only)", () => {
    const ctx = ctx_with_link(l5({ rights: "cleared", source_ref: "ref" }), { linked_states: { "G6.U4.L5": "draft" } });
    const out = cross_lesson_link_rule.run(ctx, DEFAULT_POLICY);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ level: "blocking", related_lesson_id: "G6.U4.L5", address: link.from_address });
    expect(out[0]!.message).toContain("Waiting for G6.U4.L5");
  });

  it("a filled slot whose source is approved does not wait", () => {
    for (const st of ["approved", "exported"]) {
      const ctx = ctx_with_link(l5({ rights: "cleared", source_ref: "ref" }), { linked_states: { "G6.U4.L5": st } });
      expect(cross_lesson_link_rule.run(ctx, DEFAULT_POLICY)).toEqual([]);
    }
  });

  it("ordinal id resolves a slot the document names differently", () => {
    const open = ctx_with_link(l5({ slot_id: "hare-lion", rights: "unset", source_ref: null }));
    expect(cross_lesson_link_rule.run(open, DEFAULT_POLICY)).toHaveLength(1);
    const filled = ctx_with_link(l5({ slot_id: "hare-lion", rights: "cleared", source_ref: "ref" }), { linked_states: { "G6.U4.L5": "draft" } });
    expect(cross_lesson_link_rule.run(filled, DEFAULT_POLICY)).toHaveLength(1);
  });

  it("a changed linked hash is flagged; the same hash is not", () => {
    const src = l5({ rights: "cleared", source_ref: "ref" });
    const changed = ctx_with_link(src, { recorded_link_hashes: { lk1: "a".repeat(64) } });
    expect(linked_text_changed_rule.run(changed, DEFAULT_POLICY)).toHaveLength(1);
    const same = ctx_with_link(src, { recorded_link_hashes: { lk1: "b".repeat(64) } });
    expect(linked_text_changed_rule.run(same, DEFAULT_POLICY)).toEqual([]);
    expect(linked_text_changed_rule.run(ctx_with_link(src), DEFAULT_POLICY)).toEqual([]);
  });
});
