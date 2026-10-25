import type { CheckRule } from "../../types.ts";
import { make_finding } from "./finding.ts";

export const linked_text_changed_rule: CheckRule = {
  kind: "linked_text_changed",
  level: "blocking",
  run: (ctx) => {
    const recorded = ctx.recorded_link_hashes;
    if (recorded === undefined) return [];
    const out = [];
    for (const link of ctx.links) {
      if (link.from_lesson_id !== ctx.lesson_id) continue;
      const hash = recorded[link.link_id];
      const src = ctx.linked_lessons.find((d) => d.lesson_id === link.to_lesson_id);
      if (hash !== undefined && src !== undefined && src.content_hash !== hash) {
        out.push(
          make_finding(
            "linked_text_changed",
            "blocking",
            `Linked lesson ${link.to_lesson_id} changed since this lesson recorded it at ${link.from_address} (linked_text_changed)`,
            { address: link.from_address, related_lesson_id: link.to_lesson_id },
          ),
        );
      }
    }
    return out;
  },
};
