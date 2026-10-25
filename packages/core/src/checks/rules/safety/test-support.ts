import type { PMNode, StoredLesson } from "@ls/schema/lesson";
import type { CheckContext, SafetyFlagRow } from "../../types.ts";
import { LESSON_ID, make_ctx, p, reading_lesson, routine, section } from "../../test-helpers.ts";

export const NOTE_TEXT = "the chapter describes the loss of a pet in plain detail";

export const tip = (note_id: string): PMNode => ({
  type: "teacher_tip",
  attrs: { safety_note_id: note_id },
  content: [p(NOTE_TEXT)],
});

/** Lesson whose Learning in Action carries a tip, and optional extra nodes in Quick Write / Homework. */
export function lesson_with_tip(
  note_id: string | null,
  o: { homework?: string; quick_write?: string; id?: string } = {},
): StoredLesson {
  const id = o.id ?? LESSON_ID;
  const base = reading_lesson({ lesson_id: id });
  return {
    ...base,
    sections: base.sections.map((s) => {
      if (s.name === "Learning in Action" && note_id !== null)
        return section(s.name, id, 30, [tip(note_id), ...(s.content.content ?? [])]);
      if (s.name === "Look Back" && o.quick_write !== undefined)
        return section(s.name, id, 5, [routine("writing", "Quick Write"), p(o.quick_write)]);
      if (s.name === "Homework" && o.homework !== undefined)
        return section(s.name, id, 0, [p(o.homework)]);
      return s;
    }),
  };
}

export function flag(over: Partial<SafetyFlagRow> = {}): SafetyFlagRow {
  return {
    flag_id: `${LESSON_ID}.sn1`,
    lesson_id: LESSON_ID,
    source_row: 1,
    teacher_tip_address: `${LESSON_ID}.LearninginAction.Tip1`,
    status: "open",
    note: NOTE_TEXT,
    ...over,
  };
}

export function ctx_with(lesson: StoredLesson, over: Partial<CheckContext> = {}): CheckContext {
  const ctx = make_ctx(lesson);
  return { ...ctx, ...over };
}

export const note_segment = (text: string = NOTE_TEXT) => ({
  kind: "safety_note" as const,
  text,
  instruction_shaped: false,
  applies: "apply" as const,
});
