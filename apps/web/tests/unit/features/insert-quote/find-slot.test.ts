import { describe, expect, it } from "vitest";
import { findSlot } from "@/features/insert-quote/find-slot";

const sec = (address: string, ...content: unknown[]) => ({ address, name: "n", minutes: 5, content: { type: "doc", content } }) as never;
const sections = [
  sec("A.One", { type: "paragraph", content: [{ type: "text", text: "x" }] }, { type: "quote_placeholder", attrs: { slot_id: "q1", reason: "Insert one sentence" } }),
  sec("A.Two", { type: "bullet_list", content: [{ type: "list_item", content: [{ type: "excerpt_slot", attrs: { slot_id: "e1", rights: "to-clear", source_ref: null } }] }] }),
  sec("A.Three", { type: "quote", attrs: { slot_id: "f1", source_ref: "s", rights: "licensed" } }, { type: "excerpt_slot", attrs: { slot_id: "e2", rights: "unset" } }),
];

describe("findSlot", () => {
  it("finds a placeholder", () => {
    expect(findSlot(sections, "q1")).toEqual({ kind: "quote", address: "A.One", ask: "Insert one sentence", rights: "short-quote-commentary" });
  });
  it("finds a nested excerpt slot and keeps an offered rights value", () => {
    expect(findSlot(sections, "e1")).toMatchObject({ kind: "excerpt", address: "A.Two", rights: "to-clear" });
  });
  it("falls back to public-domain for unset rights", () => {
    expect(findSlot(sections, "e2")?.rights).toBe("public-domain");
  });
  it("finds a filled quote", () => {
    expect(findSlot(sections, "f1")).toMatchObject({ kind: "quote", address: "A.Three" });
  });
  it("misses", () => {
    expect(findSlot(sections, "nope")).toBeNull();
  });
});
