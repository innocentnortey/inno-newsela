import type { CheckRule } from "../../types.ts";
import { make_finding } from "./finding.ts";
import { has_tip, notes_of, tips_of } from "./notes.ts";

export const safety_note_without_tip_rule: CheckRule = {
  kind: "safety_note_without_tip",
  level: "blocking",
  run: (ctx) => {
    const tips = tips_of(ctx.lesson);
    const address = `${ctx.lesson.lesson_id}.FrontMatter`;
    return notes_of(ctx)
      .filter((n) => !has_tip(n, tips))
      .map((n) =>
        make_finding(
          "safety_note_without_tip",
          "blocking",
          `Safety note ${n.id} has no teacher tip carrying its id at ${address} (safety_note_without_tip)`,
          { address },
        ),
      );
  },
};
