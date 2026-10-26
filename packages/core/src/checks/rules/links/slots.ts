import type { PMNode, StoredLesson } from "@ls/schema/lesson";
import { walk } from "../structural/doc-walk.ts";

export type SlotState = "open" | "filled" | "absent";

type Sections = readonly { content: PMNode }[];

/** The one definition of "filled": a rights status other than unset and a non-blank source string. */
export function is_excerpt_filled(attrs: PMNode["attrs"]): boolean {
  const ref = attrs?.source_ref;
  return attrs?.rights !== undefined && attrs.rights !== "unset" && typeof ref === "string" && ref.trim() !== "";
}

// A fill turns an excerpt_slot into a `quote` node that keeps the slot id, so a filled slot is still a slot.
function is_slot_node(n: PMNode): boolean {
  return (
    n.type === "quote_placeholder" ||
    n.type === "excerpt_slot" ||
    (n.type === "quote" && typeof n.attrs?.slot_id === "string")
  );
}

/** The one id-matching rule: exact slot_id first, then the `<lesson>.excerpt-N` ordinal over excerpt_slot nodes. */
export function find_slot_node(sections: Sections, slot_id: string): PMNode | undefined {
  const slots: PMNode[] = [];
  for (const s of sections) {
    for (const top of s.content.content ?? []) {
      walk(top, (n) => {
        if (is_slot_node(n)) slots.push(n);
      });
    }
  }
  const exact = slots.find((n) => n.attrs?.slot_id === slot_id);
  if (exact !== undefined) return exact;
  // lesson-links names slots `<lesson>.excerpt-N`, compile names them `<lesson>.slot<n>`; ordinal fallback until NL-46 reconciles.
  const m = /\.excerpt-(\d+)$/.exec(slot_id);
  // Only excerpt_slot nodes, or quotes that replaced one (attrs.origin), are counted: filling a quote placeholder must not shift N.
  const excerpts = slots.filter((n) => n.type === "excerpt_slot" || (n.type === "quote" && n.attrs?.origin === "excerpt_slot"));
  return m === null ? undefined : excerpts[Number(m[1]) - 1];
}

export function slot_state_of(sections: Sections, slot_id: string): SlotState {
  const node = find_slot_node(sections, slot_id);
  if (node === undefined) return "absent";
  if (node.type === "quote_placeholder") return "open";
  return is_excerpt_filled(node.attrs) ? "filled" : "open";
}

export function slot_state(lesson: StoredLesson, slot_id: string): SlotState {
  return slot_state_of(lesson.sections, slot_id);
}
