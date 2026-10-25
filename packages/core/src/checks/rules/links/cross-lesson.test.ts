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

  it("a changed linked hash is flagged; the same hash is not", () => {
    const src = l5({ rights: "cleared", source_ref: "ref" });
    const changed = ctx_with_link(src, { recorded_link_hashes: { lk1: "a".repeat(64) } });
    expect(linked_text_changed_rule.run(changed, DEFAULT_POLICY)).toHaveLength(1);
    const same = ctx_with_link(src, { recorded_link_hashes: { lk1: "b".repeat(64) } });
    expect(linked_text_changed_rule.run(same, DEFAULT_POLICY)).toEqual([]);
    expect(linked_text_changed_rule.run(ctx_with_link(src), DEFAULT_POLICY)).toEqual([]);
  });
});
