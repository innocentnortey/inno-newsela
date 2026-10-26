import { describe, expect, it } from "vitest";
import type { PMNode } from "@ls/schema/lesson";
import { find_slot_node, is_excerpt_filled, slot_state_of } from "./slots.ts";

const sec = (...nodes: PMNode[]) => [{ content: { type: "doc", content: nodes } as PMNode }];
const slot = (attrs: Record<string, unknown>): PMNode => ({ type: "excerpt_slot", attrs } as PMNode);

describe("is_excerpt_filled", () => {
  it("is false unless rights is set and the source is a non-blank string", () => {
    expect(is_excerpt_filled({ rights: "unset", source_ref: "ref" })).toBe(false);
    expect(is_excerpt_filled({ rights: "cleared", source_ref: null })).toBe(false);
    expect(is_excerpt_filled({ rights: "cleared", source_ref: "  " })).toBe(false);
    expect(is_excerpt_filled({ rights: "cleared", source_ref: { id: 1 } })).toBe(false);
    expect(is_excerpt_filled({ source_ref: "ref" })).toBe(false);
    expect(is_excerpt_filled(undefined)).toBe(false);
    expect(is_excerpt_filled({ rights: "cleared", source_ref: "ref" })).toBe(true);
  });
});

describe("slot_state_of", () => {
  const filled = { rights: "cleared", source_ref: "ref" };
  it("matches the exact id first", () => {
    const s = sec(slot({ slot_id: "a", rights: "unset" }), slot({ slot_id: "G6.U4.L5.excerpt-1", ...filled }));
    expect(slot_state_of(s, "G6.U4.L5.excerpt-1")).toBe("filled");
  });
  it("falls back to the n-th excerpt_slot for an .excerpt-N id", () => {
    const s = sec(slot({ slot_id: "hare-lion", ...filled }), slot({ slot_id: "other", rights: "unset" }));
    expect(find_slot_node(s, "G6.U4.L5.excerpt-1")?.attrs?.slot_id).toBe("hare-lion");
    expect(slot_state_of(s, "G6.U4.L5.excerpt-2")).toBe("open");
    expect(slot_state_of(s, "G6.U4.L5.excerpt-3")).toBe("absent");
  });
  it("a slot already filled in the editor is a quote node that keeps its slot id", () => {
    const quote = { type: "quote", attrs: { slot_id: "hare-lion", rights: "public-domain", source_ref: '{"title":"x"}' } } as PMNode;
    const s = sec(quote, slot({ slot_id: "next", rights: "unset" }));
    expect(slot_state_of(s, "hare-lion")).toBe("filled");
    expect(slot_state_of(s, "G6.U4.L5.excerpt-1")).toBe("filled");
    expect(slot_state_of(s, "G6.U4.L5.excerpt-2")).toBe("open");
    const plain = { type: "quote", attrs: { slot_id: null } } as PMNode;
    expect(slot_state_of(sec(plain), "G6.U4.L5.excerpt-1")).toBe("absent");
  });
  it("treats a quote_placeholder as open and a missing slot as absent", () => {
    expect(slot_state_of(sec({ type: "quote_placeholder", attrs: { slot_id: "q" } } as PMNode), "q")).toBe("open");
    expect(slot_state_of(sec(), "nope")).toBe("absent");
  });
});
