import { describe, expect, it } from "vitest";
import { initials_of, presence_entries, presence_sentence, slot_of } from "@/editor/presence";

const user = (name: string, slot = 1) => ({ user: { name, initials: initials_of(name), slot }, section: "S.B" });
const names = new Map([["S.B", "Part B"]]);

describe("presence", () => {
  it("initials", () => {
    expect(initials_of("M. Okafor")).toBe("MO");
    expect(initials_of("Ana")).toBe("A");
    expect(initials_of("")).toBe("?");
  });
  it("slot is stable and in 1..4", () => {
    for (const id of ["u-okafor", "u-rivera", "x", ""]) {
      expect(slot_of(id)).toBe(slot_of(id));
      expect([1, 2, 3, 4]).toContain(slot_of(id));
    }
  });
  it("sentence copy", () => {
    const one = presence_entries(new Map([[2, user("M. Okafor")]]), 1, names);
    expect(presence_sentence(one)).toBe("M. Okafor is editing Part B");
    const three = presence_entries(new Map([[2, user("M. Okafor")], [3, user("J. Rivera")]]), 1, names);
    expect(presence_sentence(three)).toBe("M. Okafor and 1 other are editing");
    expect(presence_sentence([])).toBe("");
  });
  it("skips entries without user, bad slot and the own client", () => {
    const states = new Map<number, unknown>([[1, user("Me")], [2, {}], [3, { user: { name: "x", initials: "X", slot: 9 } }], [4, user("J. Rivera")]]);
    expect(presence_entries(states, 1, names).map((e) => e.client_id)).toEqual([4]);
  });
});
