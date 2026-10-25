import type { components } from "../../src/lib/api-types";
import { LESSON4 } from "../workspace-read/fixtures";

type Lesson = components["schemas"]["Lesson"];
type FillSlotResult = components["schemas"]["FillSlotResult"];

export const LESSON4_QUOTE: Lesson = LESSON4;

export const LESSON5_EXCERPT: Lesson = {
  ...LESSON4,
  lesson_id: "G6.U4.L5",
  lesson_key: "L5",
  sections: LESSON4.sections.map((s) =>
    s.address.endsWith(".PartA")
      ? { ...s, content: ({ type: "doc", content: [{ type: "excerpt_slot", attrs: { slot_id: "slot-L5-PartA-excerpt", rights: "to-clear", source_ref: null } }] } as unknown as Lesson["sections"][number]["content"]) }
      : s,
  ),
};

export const NINE_WORDS = "The cat sat quietly on the warm window sill";
export const THIRTEEN_WORDS = `${NINE_WORDS} and then it left`;

export const FILL_OK: FillSlotResult = {
  slot_id: "slot-L4-PartA-quote",
  inserted_by: "Reviewer A (demo)",
  inserted_at: "2026-10-25T16:00:00Z",
  content_hash: "sha256:fill-ok",
  still_blocking: false,
  blocking_reason: null,
  linked_lessons: [],
};
export const FILL_BLOCKING: FillSlotResult = { ...FILL_OK, slot_id: "slot-L5-PartA-excerpt", still_blocking: true, blocking_reason: "rights to clear" };
