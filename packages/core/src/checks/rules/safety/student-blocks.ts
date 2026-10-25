import type { StoredLesson } from "@ls/schema/lesson";
import { find_cfu_items, node_text, section_nodes, visit_with_parts } from "../structural/doc-walk.ts";

export type StudentBlock = { address: string; text: string };

/** Student-facing text only: Pulse Check stem/options, Quick Write prompts, Homework. */
export function student_blocks(lesson: StoredLesson): StudentBlock[] {
  const out: StudentBlock[] = [];
  for (const section of lesson.sections) {
    for (const item of find_cfu_items(section)) {
      const text = item.blocks
        .filter(
          (b) =>
            b.type === "ordered_list" ||
            (b.type === "paragraph" && !/^[A-Z]\.\s*(Correct|Incorrect)/.test(node_text(b))),
        )
        .map(node_text)
        .join(" ");
      out.push({ address: item.address, text });
    }
    visit_with_parts(section, ({ node, address, siblings, index }) => {
      if (node.type !== "routine_heading" || node.attrs?.icon !== "writing") return;
      const parts: string[] = [];
      for (let i = index + 1; i < siblings.length; i += 1) {
        const s = siblings[i];
        if (s === undefined || s.type === "heading" || s.type === "routine_heading") break;
        if (s.type === "paragraph") parts.push(node_text(s));
      }
      out.push({ address, text: parts.join(" ") });
    });
    if (section.name === "Homework") {
      const text = section_nodes(section)
        .filter((n) => n.type !== "teacher_tip" && n.type !== "collapsible" && n.type !== "callout")
        .map(node_text)
        .join(" ");
      out.push({ address: section.address, text });
    }
  }
  return out;
}
