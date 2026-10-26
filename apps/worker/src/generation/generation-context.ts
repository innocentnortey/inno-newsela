import type { GenerationPromptContext } from "@ls/prompts/inputs";
import type { JobContext } from "./nodes/job-state.ts";

/** The one place the generation prompt context is assembled from a job's loaded state. DraftNode and RepairNode both call it, so a repair sees exactly what the draft saw. */
export function pinned_prompt_context(
  ctx: JobContext,
  reviewer_note: string | null,
): GenerationPromptContext {
  return {
    context: ctx.row_context,
    plan_entries: ctx.plan_entries ?? [],
    standards: ctx.standards,
    reviewer_note,
  };
}
