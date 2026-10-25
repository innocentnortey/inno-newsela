import { InvariantViolation, ProviderError, SpendRefused } from "@ls/core/errors";
import { template_for } from "@ls/core/compile/templates";
import { with_brake } from "@ls/core/pipeline/state";
import type { PromptRepo } from "@ls/core/ports/prompts";
import type { PromptRenderer } from "@ls/prompts/render";
import type { PromptFinding } from "@ls/prompts/inputs";
import type { WorkerSettings } from "@ls/config/settings";
import type { CheckpointPort, PaidCallerPort } from "./collaborators.ts";
import { brake_for, with_call, type JobState } from "./job-state.ts";

export class RepairNode {
  constructor(
    private readonly paid: PaidCallerPort,
    private readonly renderer: Pick<PromptRenderer, "render_repair">,
    private readonly prompts: PromptRepo,
    private readonly settings: WorkerSettings,
    private readonly recorder: CheckpointPort,
  ) {}

  async run(state: JobState, signal?: AbortSignal): Promise<JobState> {
    const job = state.job;
    const ctx = state.context;
    if (ctx === null) throw new InvariantViolation("job_context_missing");
    try {
      let call = await this.recorder.checkpoint(job.job_id, "repair", 1);
      if (call === null) {
        const prompt = await this.prompts.get(job.prompt_version_id);
        if (prompt === null) throw new InvariantViolation("prompt_version_missing", { prompt_version_id: job.prompt_version_id });
        const template = template_for(ctx.row_context.row.lesson_type);
        if (template === undefined) throw new InvariantViolation("template_missing");
        const failing: PromptFinding[] = (state.check_result?.findings ?? [])
          .filter((f) => f.level === "blocking")
          .map((f) => ({ kind: f.kind, message: f.message, address: f.address }));
        if (state.compile_error !== null) failing.push({ kind: "compile_error", message: state.compile_error, address: null });
        const rendered = this.renderer.render_repair({
          prompt,
          draft_raw: ctx.raw_output ?? "",
          failing,
          schema_issues: state.schema_issues,
          template,
        });
        call = await this.paid.call({
          ctx: { run_id: job.run_id, lesson_id: job.lesson_id, job_id: job.job_id, attempt: 1, purpose: "repair", request_id: null, experiment_id: null, reservation_id: null },
          req: {
            alias: "REPAIR",
            system_blocks: rendered.system_blocks,
            user_blocks: rendered.user_blocks,
            output_schema_name: "LessonDraft",
            output_json_schema: null,
            output_mode: "prompt_embedded",
            max_output_tokens: this.settings.draft_output_token_cap,
            timeout_ms: this.settings.model.model_call_timeout_ms,
            effort: this.settings.model.model_effort,
            temperature: null,
          },
          rendered,
          run_id: job.run_id,
          job_id: job.job_id,
          user_id: job.started_by,
          ...(signal ? { signal } : {}),
        });
      }
      const next = with_call(state, call);
      return { ...next, repair_rounds: next.repair_rounds + 1, context: { ...next.context!, raw_output: call.raw_output } };
    } catch (e) {
      if (signal?.aborted) throw e;
      if (e instanceof SpendRefused) return with_brake({ ...state, context: { ...ctx, raw_output: null } }, brake_for(e));
      if (e instanceof ProviderError) {
        let next: JobState = { ...state, context: { ...ctx, provider_error: e.kind, raw_output: null } };
        if (e.kind === "rate_limited" || e.kind === "overloaded") next = with_brake(next, "rate_limit_retries");
        return next;
      }
      throw e;
    }
  }
}
