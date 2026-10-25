import type { CheckRule } from "../../types.ts";
import { make_finding } from "./finding.ts";
import { slot_state } from "./slots.ts";

export const cross_lesson_link_rule: CheckRule = {
  kind: "cross_lesson_link",
  level: "blocking",
  run: (ctx) => {
    const out = [];
    for (const link of ctx.links) {
      if (link.from_lesson_id !== ctx.lesson_id || link.kind === "page_continuation") continue;
      const src = ctx.linked_lessons.find((d) => d.lesson_id === link.to_lesson_id);
      if (src === undefined || slot_state(src.lesson, link.to_slot_id) === "open") {
        out.push(
          make_finding(
            "cross_lesson_link",
            "blocking",
            `Homework at ${link.from_address} waits on an empty slot in ${link.to_lesson_id} (cross_lesson_link)`,
            { address: link.from_address, related_lesson_id: link.to_lesson_id },
          ),
        );
      }
    }
    return out;
  },
};
