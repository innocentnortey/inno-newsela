import { z } from "zod";
import { LessonId } from "./ids.ts";

export const UnitPlanEntryDraft = z.object({
  lesson_id: LessonId,
  day: z.int().min(1),
  purpose: z.string(),
  routines: z.array(z.string()),
  hands_forward: z.string(),
  performance_task_thread: z.string(),
});
export type UnitPlanEntryDraft = z.infer<typeof UnitPlanEntryDraft>;

export const UnitPlanDraft = z
  .object({ entries: z.array(UnitPlanEntryDraft).min(1) })
  .superRefine((plan, ctx) => {
    const seen = new Set<string>();
    plan.entries.forEach((e, i) => {
      if (seen.has(e.lesson_id)) {
        ctx.addIssue({ code: "custom", path: ["entries", i, "lesson_id"], message: "duplicate lesson_id" });
      }
      seen.add(e.lesson_id);
    });
  });
export type UnitPlanDraft = z.infer<typeof UnitPlanDraft>;
