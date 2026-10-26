import { describe, expect, it } from "vitest";
import type { StoredLesson } from "@ls/schema/lesson";
import type { UnitId } from "@ls/schema/ids";
import { assign_addresses, normalise_part_label, part_address, safety_note_id, section_slug, tip_address } from "./addresses.ts";

const lesson: StoredLesson = {
  lesson_id: "G6.U4.L4", schema_version: 1, title: "t", type: "Reading",
  front_matter: { standards: [], minutes_total: 0, vocabulary: [] },
  sections: [{ address: "", name: "Learning in Action", minutes: 0, content: { type: "doc" } }],
  text_cards: [],
};

describe("addresses", () => {
  it("slugs", () => {
    expect(section_slug("Learning in Action")).toBe("LearningInAction");
    expect(normalise_part_label("part a")).toBe("Part A");
    expect(normalise_part_label("A")).toBe("Part A");
  });
  it("part, tip and note ids", () => {
    expect(part_address("G6.U4.L4.LearningInAction", "Part A")).toBe("G6.U4.L4.LearningInAction.PartA");
    expect(tip_address("G6.U4.L4.Homework", 1)).toBe("G6.U4.L4.Homework.Tip1");
    expect(safety_note_id("G6.U4.L4", 2)).toBe("G6.U4.L4.sn2");
  });
  it("is idempotent and does not mutate", () => {
    const once = assign_addresses(lesson, "G6.U4" as UnitId);
    expect(lesson.sections[0]?.address).toBe("");
    expect(once.sections[0]?.address).toBe("G6.U4.L4.LearningInAction");
    expect(assign_addresses(once, "G6.U4" as UnitId)).toEqual(once);
  });
  it("throws RangeError for a foreign unit", () => {
    expect(() => assign_addresses(lesson, "G6.U5" as UnitId)).toThrow(RangeError);
  });
});
