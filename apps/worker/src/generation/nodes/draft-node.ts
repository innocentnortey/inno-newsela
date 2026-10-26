import { InvariantViolation, ProviderError, SpendRefused } from "@ls/core/errors";
import { template_for } from "@ls/core/compile/templates";
import { with_brake } from "@ls/core/pipeline/state";
import type { CallPurpose } from "@ls/core/ports/common";
import type { RecordedCall } from "@ls/core/ports/model-call-log";
import type { OutlineRepo } from "@ls/core/ports/outlines";
import type { PromptRepo } from "@ls/core/ports/prompts";
import type { RunRepo } from "@ls/core/ports/runs";
import type { StandardRepo } from "@ls/core/ports/standards";
import type { PromptRenderer } from "@ls/prompts/render";
import type { RenderedPrompt } from "@ls/prompts/inputs";
import type { WorkerSettings } from "@ls/config/settings";
import type { CheckpointPort, PaidCallerPort } from "./collaborators.ts";
import { pinned_prompt_context } from "../generation-context.ts";
import { brake_for, with_call, type JobContext, type JobState } from "./job-state.ts";

type CallResult = { kind: "ok"; state: JobState; call: RecordedCall } | { kind: "stop"; state: JobState };

export class DraftNode {
  constructor(
    private readonly paid: PaidCallerPort,
    private readonly renderer: Pick<PromptRenderer, "render_lesson_draft">,
    private readonly outlines: OutlineRepo,
    private readonly runs: RunRepo,
    private readonly standards: StandardRepo,
    private readonly prompts: PromptRepo,
    private readonly settings: WorkerSettings,
    private readonly recorder: CheckpointPort,
  ) {}

  async run(state: JobState, signal?: AbortSignal): Promise<JobState> {
    const job = state.job;
    const lesson_id = job.lesson_id;
    if (lesson_id === null) throw new InvariantViolation("lesson_job_without_lesson", { job_id: job.job_id });

    // G-24: the run's pinned choices, not the outline version's.
    const pinned = await this.runs.pinned_choices(job.run_id);
    const row_context = await this.outlines.row_context(job.outline_version_id, lesson_id, pinned);
    const row = row_context.row;
    const codes = [...new Set([...row.focus_codes, ...row.eld_codes, ...row.msls_codes])];
    const standards = await this.standards.texts(codes);

    // A candidate run reuses its parent's plan (R-8).
    const run = await this.runs.get(job.run_id);
    const plan_row = await this.runs.unit_plan(run?.parent_run_id ?? job.run_id);
    const near = new Set<string>([lesson_id, ...row_context.neighbours.map((n) => n.lesson_id).filter((x): x is string => x !== null)]);
    const plan_entries = (plan_row?.plan?.entries ?? []).filter((e) => near.has(e.lesson_id));

    const prompt = await this.prompts.get(job.prompt_version_id);
    if (prompt === null) throw new InvariantViolation("prompt_version_missing", { prompt_version_id: job.prompt_version_id });
    const template = template_for(row.lesson_type);
    if (template === undefined) throw new InvariantViolation("template_missing", { lesson_type: row.lesson_type });

    const context: JobContext = {
      row_context,
      standards,
      plan_entries,
      calls: [],
      draft_call: null,
      draft_max_output_tokens: this.settings.draft_output_token_cap,
      effort: this.settings.model.model_effort,
      raw_output: null,
      provider_error: null,
    };
    const pinned_ctx = pinned_prompt_context(context, job.reviewer_note);
    const rendered = this.renderer.render_lesson_draft({
      prompt,
      context: pinned_ctx.context,
      plan_entries: pinned_ctx.plan_entries,
      standards: pinned_ctx.standards,
      template,
      example_set_id: null,
      reviewer_note: pinned_ctx.reviewer_note,
    });
    let s: JobState = { ...state, context };

    const first = await this.call(s, rendered, "lesson_draft", this.settings.draft_output_token_cap, signal);
    if (first.kind === "stop") return first.state;
    s = first.state;
    if (first.call.stop_reason !== "max_tokens") return this.accept(s, first.call, this.settings.draft_output_token_cap);

    // Truncated: one retry with the larger cap. Not a repair round.
    s = { ...s, truncation_retries: 1 };
    const retry = await this.call(s, rendered, "truncation_retry", this.settings.truncation_retry_token_cap, signal);
    if (retry.kind === "stop") return retry.state;
    if (retry.call.stop_reason === "max_tokens") return with_brake(retry.state, "truncation_retry");
    return this.accept(retry.state, retry.call, this.settings.truncation_retry_token_cap);
  }

  private accept(s: JobState, call: RecordedCall, cap: number): JobState {
    const ctx = s.context!;
    return { ...s, draft_call: call, context: { ...ctx, draft_call: call, draft_max_output_tokens: cap, raw_output: call.raw_output } };
  }

  private async call(s: JobState, rendered: RenderedPrompt, purpose: CallPurpose, cap: number, signal?: AbortSignal): Promise<CallResult> {
    const job = s.job;
    const hit = await this.recorder.checkpoint(job.job_id, purpose, 1);
    try {
      const call =
        hit ??
        (await this.paid.call({
          ctx: { run_id: job.run_id, lesson_id: job.lesson_id, job_id: job.job_id, attempt: 1, purpose, request_id: null, experiment_id: null, reservation_id: null },
          req: {
            alias: "GENERATION",
            system_blocks: rendered.system_blocks,
            user_blocks: rendered.user_blocks,
            output_schema_name: "LessonDraft",
            output_json_schema: null,
            output_mode: "prompt_embedded",
            max_output_tokens: cap,
            timeout_ms: this.settings.model.model_call_timeout_ms,
            effort: this.settings.model.model_effort,
            temperature: null,
          },
          rendered,
          run_id: job.run_id,
          job_id: job.job_id,
          user_id: job.started_by,
          ...(signal ? { signal } : {}),
        }));
      return { kind: "ok", state: with_call(s, call), call };
    } catch (e) {
      if (signal?.aborted) throw e;
      if (e instanceof SpendRefused) return { kind: "stop", state: with_brake(s, brake_for(e)) };
      if (e instanceof ProviderError) {
        const ctx = s.context!;
        let next: JobState = { ...s, context: { ...ctx, provider_error: e.kind, raw_output: null } };
        if (e.kind === "rate_limited" || e.kind === "overloaded") next = with_brake(next, "rate_limit_retries");
        return { kind: "stop", state: next };
      }
      throw e;
    }
  }
}
