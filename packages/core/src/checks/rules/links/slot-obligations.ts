import type { CheckContext } from "../../types.ts";

export type SlotObligation = { needed: boolean; reasons: string[] };

/**
 * Whether the lesson must hold an excerpt slot: an applied outline writer task, or another lesson's homework
 * pointing at this one. One slot satisfies every reason.
 */
export function excerpt_obligation(ctx: CheckContext): SlotObligation {
  const reasons: string[] = [];
  if (ctx.row.segments.some((s) => s.kind === "writer_task" && s.applies === "apply")) {
    reasons.push("outline writer task");
  }
  for (const l of ctx.links) {
    if (l.to_lesson_id === ctx.lesson_id && l.kind !== "page_continuation") {
      reasons.push(`homework link from ${l.from_lesson_id}`);
    }
  }
  return { needed: reasons.length > 0, reasons };
}
