import { describe, expect, it } from "vitest";
import { slotIdFor } from "@/features/workspace/actions/standards/slot-for-issue";
import type { components } from "@/lib/api-types";

type Issue = components["schemas"]["Issue"];
const ADDR = "G6.U4.L4.LearningInAction.PartA";
const section = (address: string, ...content: unknown[]) => ({ address, name: "Part", minutes: 10, content: { type: "doc", content } }) as never;
const issue = (id: string, kind: Issue["kind"], address: string | null, message = "x"): Issue => ({
  issue_id: id, level: "blocking", blocks: ["submit"], resolvable: false, kind, message, address, span_anchor: null, related_lesson_id: null, resolution: null,
});
const ph = (id: string) => ({ type: "quote_placeholder", attrs: { slot_id: id } });

describe("slotIdFor", () => {
  it("slot_for_placeholder_by_address", () => {
    const i = issue("i1", "quote_placeholder_open", ADDR);
    expect(slotIdFor(i, [section("other", ph("zz")), section(ADDR, ph("q-hare"))], [i])).toBe("q-hare");
  });
  it("slot_for_excerpt", () => {
    const i = issue("i1", "excerpt_slot_open", ADDR);
    const node = { type: "excerpt_slot", attrs: { slot_id: "hare-lion" } };
    expect(slotIdFor(i, [section(ADDR, { type: "paragraph", content: [node] })], [i])).toBe("hare-lion");
  });
  it("nth_slot_when_two_in_section", () => {
    const a = issue("i1", "quote_placeholder_open", ADDR);
    const b = issue("i2", "quote_placeholder_open", ADDR);
    const s = [section(ADDR, ph("s1"), ph("s2"))];
    expect(slotIdFor(a, s, [a, b])).toBe("s1");
    expect(slotIdFor(b, s, [a, b])).toBe("s2");
  });
  it("slot_none_when_no_address", () => {
    const i = issue("i1", "quote_placeholder_open", null);
    expect(slotIdFor(i, [section(ADDR, ph("s1"))], [i])).toBeNull();
    const j = issue("i2", "quote_placeholder_open", "missing.section");
    expect(slotIdFor(j, [section(ADDR, ph("s1"))], [j])).toBeNull();
  });
});
