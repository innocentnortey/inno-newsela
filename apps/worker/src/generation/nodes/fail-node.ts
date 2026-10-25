import { failure_reasons_for } from "@ls/core/pipeline/failure-reasons";
import type { FailureInput } from "@ls/core/pipeline/state";
import type { LessonStateRepo } from "@ls/core/ports/lesson-state";
import type { LessonVersionRepo } from "@ls/core/ports/lesson-versions";
import type { TxRunner } from "@ls/core/ports/tx";
import { build_outcome, type JobState } from "./job-state.ts";

export class FailNode {
  constructor(
    private readonly states: LessonStateRepo,
    private readonly versions: LessonVersionRepo,
    private readonly tx: TxRunner,
  ) {}

  async run(state: JobState): Promise<JobState> {
    const ctx = state.context;
    // Before any parse there is nothing to be schema-invalid.
    const schema_valid = ctx?.raw_output == null ? true : state.schema_issues.length === 0;
    const failure_reasons = failure_reasons_for({
      brakes_fired: state.brakes_fired,
      provider_error: ctx?.provider_error ?? null,
      schema_valid,
      compile_error: state.compile_error,
      first_failing_kind: (state.check_result?.first_failing_kind ?? null) as FailureInput["first_failing_kind"],
    });
    const cancelled = state.brakes_fired.includes("cancelled");
    const lesson_id = state.job.lesson_id;

    // Cancelled jobs and jobs that made no call (capped or timed out first) never touch lesson state (CON-6).
    if (!cancelled && state.call_ids.length > 0 && lesson_id !== null) {
      await this.tx.with_tx(async (tx) => {
        const row = await this.states.get(lesson_id);
        if (row === null || row.state === "generation_failed") return;
        if (state.job.kind === "candidate" && (await this.versions.has_generated_version(lesson_id))) return;
        await this.states.set_state(lesson_id, "generation_failed", null, tx);
      });
    }
    const outcome = build_outcome(state, {
      status: cancelled ? "cancelled" : "generation_failed",
      tile_state: "failed",
      failure_reasons,
      version_id: null,
    });
    return { ...state, outcome };
  }
}
