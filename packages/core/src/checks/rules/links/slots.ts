import type { PMNode, StoredLesson } from "@ls/schema/lesson";
import { section_nodes, walk } from "../structural/doc-walk.ts";

export type SlotState = "open" | "filled" | "absent";

export function slot_state(lesson: StoredLesson, slot_id: string): SlotState {
  const slots: PMNode[] = [];
  for (const s of lesson.sections) {
    for (const top of section_nodes(s)) {
      walk(top, (n) => {
        if (n.type === "quote_placeholder" || n.type === "excerpt_slot") slots.push(n);
      });
    }
  }
  let node = slots.find((n) => n.attrs?.slot_id === slot_id);
  if (node === undefined) {
    // lesson-links names slots `<lesson>.excerpt-N`, compile names them `<lesson>.slot<n>`; ordinal fallback until NL-46 reconciles.
    const m = /\.excerpt-(\d+)$/.exec(slot_id);
    if (m !== null) node = slots.filter((n) => n.type === "excerpt_slot")[Number(m[1]) - 1];
  }
  if (node === undefined) return "absent";
  if (node.type === "quote_placeholder") return "open";
  return node.attrs?.rights === "unset" || node.attrs?.source_ref == null ? "open" : "filled";
}
