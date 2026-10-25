import type { StoredLesson } from "@ls/schema/lesson";
import type { CheckContext, SafetyFlagRow } from "../../types.ts";
import { section_nodes, walk } from "../structural/doc-walk.ts";

import { safety_note_id, tip_address } from "../../../compile/addresses.ts";

export type Tip = { address: string; note_id: string | null };
export type Note = { id: string; text: string; flag: SafetyFlagRow | null };

export function tips_of(lesson: StoredLesson): Tip[] {
  const out: Tip[] = [];
  for (const section of lesson.sections) {
    let ordinal = 0;
    for (const top of section_nodes(section)) {
      walk(top, (n) => {
        if (n.type !== "teacher_tip") return;
        ordinal += 1;
        const id = n.attrs?.safety_note_id;
        out.push({
          address: tip_address(section.address, ordinal),
          note_id: typeof id === "string" ? id : null,
        });
      });
    }
  }
  return out;
}

export function notes_of(ctx: CheckContext): Note[] {
  const out: Note[] = [];
  const attached = new Set<string>();
  let i = 0;
  for (const seg of ctx.row.segments) {
    if (seg.kind !== "safety_note" || seg.applies === "ignore") continue;
    i += 1;
    const id = safety_note_id(ctx.lesson.lesson_id, i);
    const flag = ctx.safety_flags.find((f) => f.flag_id === id) ?? null;
    if (flag !== null) attached.add(flag.flag_id);
    out.push({ id, text: seg.text, flag });
  }
  for (const flag of ctx.safety_flags) {
    if (!attached.has(flag.flag_id)) out.push({ id: flag.flag_id, text: flag.note ?? "", flag });
  }
  return out;
}

export function has_tip(note: Note, tips: Tip[]): boolean {
  const addr = note.flag?.teacher_tip_address ?? null;
  return tips.some((t) => t.note_id === note.id || (addr !== null && t.address === addr));
}
