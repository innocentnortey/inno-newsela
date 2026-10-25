import type { PMNode, StoredLesson } from "@ls/schema/lesson";
import type { CheckContext, DerivedRow, LessonLinkRecord } from "../../types.ts";
import { make_ctx, reading_lesson, section } from "../../test-helpers.ts";

export const SLOT = "G6.U4.L5.excerpt-1";

export const link: LessonLinkRecord = {
  link_id: "lk1",
  from_lesson_id: "G6.U4.L4",
  from_address: "G6.U4.L4.Homework",
  to_lesson_id: "G6.U4.L5",
  to_slot_id: SLOT,
  kind: "excerpt_slot",
  label: "text",
};

export function l5(slot: PMNode["attrs"], hash = "b".repeat(64)): DerivedRow {
  const base = reading_lesson({ lesson_id: "G6.U4.L5" });
  const lesson: StoredLesson = {
    ...base,
    sections: base.sections.map((s) =>
      s.name === "Learning in Action"
        ? section(s.name, "G6.U4.L5", 30, [{ type: "excerpt_slot", attrs: { slot_id: SLOT, ...slot } }, ...(s.content.content ?? [])])
        : s,
    ),
  };
  return { lesson_id: "G6.U4.L5", seq: 1, store_id: "s1", lesson, content_hash: hash } as DerivedRow;
}

export function ctx_with_link(src: DerivedRow | null, over: Partial<CheckContext> = {}): CheckContext {
  return { ...make_ctx(reading_lesson()), links: [link], linked_lessons: src === null ? [] : [src], ...over };
}
