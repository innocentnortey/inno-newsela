import { InvariantViolation } from "@ls/core/errors";
import type { LessonDocStore } from "@ls/core/ports/lesson-docs";
import type { LessonStateRepo } from "@ls/core/ports/lesson-state";
import type { LessonVersionRepo, NewGeneratedVersion, ProvenanceRecord } from "@ls/core/ports/lesson-versions";
import type { SafetyFlagRepo } from "@ls/core/ports/safety-flags";
import type { TxRunner } from "@ls/core/ports/tx";
import type { LessonId, VersionId } from "@ls/core/ports/common";
import type { NormalizedRow } from "@ls/schema/outline";
import { build_outcome, SYSTEM_ACTOR, sum_cost, type JobState } from "./job-state.ts";

/** A safety_note segment survives in the row exactly when the run's pinned choice confirmed it. */
export function safety_source_rows(row: NormalizedRow): number[] {
  return row.segments.some((s) => s.kind === "safety_note") ? [row.row_number] : [];
}

export class StoreNode {
  constructor(
    private readonly versions: LessonVersionRepo,
    private readonly states: LessonStateRepo,
    private readonly docs: LessonDocStore,
    private readonly flags: SafetyFlagRepo,
    private readonly tx: TxRunner,
  ) {}

  async run(state: JobState): Promise<JobState> {
    const { job, context, compiled, draft } = state;
    const lesson_id = job.lesson_id;
    if (lesson_id === null || context === null || compiled === null || draft === null || context.draft_call === null) {
      throw new InvariantViolation("store_without_checked_draft", { job_id: job.job_id });
    }
    const provenance: ProvenanceRecord = {
      outline_row_hash: context.row_context.row_hash,
      prompt_version_id: job.prompt_version_id,
      model: context.draft_call.served_model,
      parameters: { effort: context.effort, max_output_tokens: context.draft_max_output_tokens, output_mode: "prompt_embedded" },
      schema_version: job.schema_version,
      example_set_id: null,
      run_id: job.run_id,
      model_call_ids: [...state.call_ids] as ProvenanceRecord["model_call_ids"],
      cost_usd: sum_cost(context.calls),
      ai_assisted_spans: 0,
      derived_from_version_id: null,
    };
    const base = {
      lesson_id,
      unit_id: job.unit_id,
      lesson: compiled.lesson,
      draft,
      content_hash: compiled.content_hash,
      idempotency_key: job.idempotency_key,
      provenance,
    };

    const version_id = await this.tx.with_tx(async (tx): Promise<VersionId> => {
      const as_generated = async (): Promise<VersionId> => {
        const v: NewGeneratedVersion = { ...base, kind: "generated" };
        const w = await this.versions.write_generated_version(v, tx);
        if (!w.created) return w.version.version_id; // an earlier run already stored it: write nothing else
        await this.docs.seed_initial(lesson_id, compiled.lesson, SYSTEM_ACTOR, tx);
        const rows = safety_source_rows(context.row_context.row);
        if (rows.length > 0) await this.flags.create_for_lesson(lesson_id, rows, tx);
        await this.states.set_state(lesson_id, "draft", null, tx);
        return w.version.version_id;
      };
      if (job.kind === "candidate") return this.store_candidate(lesson_id, base, as_generated, tx);
      return as_generated();
    });

    const outcome = build_outcome(state, { status: "ready", tile_state: "ready", failure_reasons: [], version_id });
    return { ...state, outcome };
  }

  private async store_candidate(
    lesson_id: LessonId,
    base: Omit<NewGeneratedVersion, "kind">,
    as_generated: () => Promise<VersionId>,
    tx: object,
  ): Promise<VersionId> {
    const has = await this.versions.has_generated_version(lesson_id);
    const row = await this.states.lock_for_update(lesson_id, tx);
    // CON-16: a candidate for a lesson whose own generation failed becomes v1.
    if (!has && row.state === "generation_failed") return as_generated();
    const w = await this.versions.write_generated_version({ ...base, kind: "candidate" }, tx);
    return w.version.version_id;
  }
}
