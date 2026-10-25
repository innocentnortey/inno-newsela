import type { ClaimedJob, JobQueue } from "@ls/core/ports/job-queue";
import type { RunRepo } from "@ls/core/ports/runs";
import type { OutlineRepo } from "@ls/core/ports/outlines";
import type { PromptRepo } from "@ls/core/ports/prompts";
import type { ModelCallLog, RecordedCall } from "@ls/core/ports/model-call-log";
import type { StructuredCallRequest } from "@ls/core/ports/model-client";
import type { TxRunner } from "@ls/core/ports/tx";
import type { BrakeName, CallPurpose, CapName, JobId, LessonId, ModelAlias, ModelCallId, RunId, UserId } from "@ls/core/ports/common";
import { InvariantViolation, ProviderError, SpendRefused } from "@ls/core/errors";
import { failure_reasons_for } from "@ls/core/pipeline/failure-reasons";
import type { FailureReasonRecord } from "@ls/core/pipeline/state";
import type { WorkerSettings } from "@ls/config/settings";
import { UnitPlanDraft } from "@ls/schema/unit-plan";
import type { PromptRenderer } from "@ls/prompts/render";
import type { RenderedPrompt } from "@ls/prompts/inputs";
import { SchemaRegistry } from "@ls/prompts/schemas";

// Local structural mirrors of DO-4 section 4 (PaidCaller lands with NL-33; its type satisfies these).
export interface UnitPlanCallContext {
  run_id: RunId;
  lesson_id: null;
  job_id: JobId;
  attempt: number;
  purpose: CallPurpose;
  request_id: null;
  experiment_id: null;
  reservation_id: null;
}
export interface UnitPlanPaidCallRequest {
  ctx: UnitPlanCallContext;
  req: StructuredCallRequest;
  rendered: RenderedPrompt;
  run_id: RunId;
  job_id: JobId;
  user_id: UserId;
}
export interface UnitPlanPaidCaller {
  call(p: UnitPlanPaidCallRequest): Promise<RecordedCall>;
}
export type UnitPlanRuns = Pick<RunRepo, "pinned_choices" | "store_unit_plan" | "mark_plan_failed" | "mark_capped">;
export type UnitPlanOutlines = Pick<OutlineRepo, "rows" | "links" | "row_context">;
export type UnitPlanPrompts = Pick<PromptRepo, "get">;
export type UnitPlanQueue = Pick<JobQueue, "jobs_for_run">;
export type UnitPlanCalls = Pick<ModelCallLog, "completed_for">;
export type UnitPlanRenderer = Pick<PromptRenderer, "render_unit_plan">;
export type UnitPlanSettings = Pick<WorkerSettings, "draft_output_token_cap" | "model">;

export interface UnitPlanOutcome {
  run_id: RunId;
  stored: boolean;
  entries: number;
  model_call_id: ModelCallId | null;
  failure: FailureReasonRecord | null;
}

export interface PlanValidation {
  plan: UnitPlanDraft | null;
  issues: string[];
}

// Pure: parse, schema-check, then check the plan covers exactly the in-scope days in ascending order.
export function validate_plan(raw: string, expected: readonly LessonId[]): PlanValidation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { plan: null, issues: ["output: not valid JSON"] };
  }
  const result = UnitPlanDraft.safeParse(parsed);
  if (!result.success) {
    return {
      plan: null,
      issues: result.error.issues.map((i) => `${i.path.length === 0 ? "$" : i.path.join(".")}: ${i.message}`),
    };
  }
  const plan = result.data;
  const issues: string[] = [];
  const allowed = new Set<string>(expected);
  const present = new Set<string>();
  plan.entries.forEach((e, i) => {
    present.add(e.lesson_id);
    if (!allowed.has(e.lesson_id)) issues.push(`entries.${i}.lesson_id: ${e.lesson_id} is not in this run's scope`);
    const prev = plan.entries[i - 1];
    if (prev !== undefined && e.day <= prev.day) issues.push(`entries.${i}.day: days must be strictly ascending`);
  });
  for (const id of expected) if (!present.has(id)) issues.push(`missing entry for ${id}`);
  return { plan: issues.length === 0 ? plan : null, issues };
}

const BRAKE_FOR_CAP: Record<CapName, BrakeName> = {
  run_cap: "spend_run_cap",
  day_cap: "spend_day_cap",
  project_cap: "spend_project_cap",
};

export class UnitPlanJob {
  private readonly schemas = new SchemaRegistry();

  constructor(
    private readonly paid: UnitPlanPaidCaller,
    private readonly renderer: UnitPlanRenderer,
    private readonly runs: UnitPlanRuns,
    private readonly outlines: UnitPlanOutlines,
    private readonly prompts: UnitPlanPrompts,
    private readonly settings: UnitPlanSettings,
    private readonly queue: UnitPlanQueue,
    private readonly calls: UnitPlanCalls,
    private readonly tx: TxRunner,
  ) {}

  async run(job: ClaimedJob): Promise<UnitPlanOutcome> {
    if (job.kind !== "unit_plan") throw new InvariantViolation("unit_plan_job.wrong_kind", { job_id: job.job_id });
    const prompt = await this.prompts.get(job.prompt_version_id);
    if (prompt === null) throw new InvariantViolation("unit_plan_job.prompt_missing", { job_id: job.job_id });
    const choices = await this.runs.pinned_choices(job.run_id);

    // The run's lesson jobs are its scope (created before the plan runs).
    const jobs = await this.queue.jobs_for_run(job.run_id);
    const scope = new Set<string>();
    for (const j of jobs) if (j.kind === "lesson" && j.lesson_id !== null) scope.add(j.lesson_id);
    if (scope.size === 0) throw new InvariantViolation("unit_plan_job.empty_scope", { job_id: job.job_id });

    const records = await this.outlines.rows(job.outline_version_id);
    const rows = records
      .map((r) => r.row)
      .filter((r) => (r.kind === "lesson" || r.kind === "flex_day") && r.lesson_id !== null && scope.has(r.lesson_id))
      .sort((a, b) => a.row_number - b.row_number);
    const first = rows[0];
    if (first === undefined || first.lesson_id === null) throw new InvariantViolation("unit_plan_job.no_rows_in_scope", { job_id: job.job_id });
    const unit_rules = (await this.outlines.row_context(job.outline_version_id, first.lesson_id, choices)).unit_rules;
    const links = await this.outlines.links(job.outline_version_id);
    const expected: LessonId[] = [];
    for (const r of rows) if (r.lesson_id !== null) expected.push(r.lesson_id);

    const base = { run_id: job.run_id, prompt, rows, unit_rules, links };

    try {
      // First plan, checkpointed: a completed call is never paid twice.
      let call = await this.calls.completed_for(job.job_id, "unit_plan", 1);
      if (call === null) {
        const rendered = this.renderer.render_unit_plan({ ...base, repair_of: null });
        call = await this.paid.call(this.request(job, "unit_plan", rendered, "GENERATION"));
      }
      const first_check = validate_plan(call.raw_output, expected);
      if (first_check.plan !== null) return await this.store(job, first_check.plan, call);

      // One repair, never a second.
      let repair = await this.calls.completed_for(job.job_id, "repair", 1);
      if (repair === null) {
        const rendered = this.renderer.render_unit_plan({
          ...base,
          repair_of: { draft_raw: call.raw_output, issues: first_check.issues },
        });
        repair = await this.paid.call(this.request(job, "repair", rendered, "REPAIR"));
      }
      const second_check = validate_plan(repair.raw_output, expected);
      if (second_check.plan !== null) return await this.store(job, second_check.plan, repair);

      await this.tx.with_tx((t) => this.runs.mark_plan_failed(job.run_id, t));
      return this.failed(job, failure_reasons_for({ brakes_fired: [], provider_error: null, schema_valid: false, compile_error: null, first_failing_kind: null })[0]);
    } catch (e) {
      if (e instanceof SpendRefused) {
        const cap = e.refused_by;
        await this.tx.with_tx((t) => this.runs.mark_capped(job.run_id, cap, t));
        return this.failed(job, failure_reasons_for({ brakes_fired: [BRAKE_FOR_CAP[cap]], provider_error: null, schema_valid: true, compile_error: null, first_failing_kind: null })[0]);
      }
      if (e instanceof ProviderError) {
        await this.tx.with_tx((t) => this.runs.mark_plan_failed(job.run_id, t));
        return this.failed(job, failure_reasons_for({ brakes_fired: [], provider_error: e.kind, schema_valid: true, compile_error: null, first_failing_kind: null })[0]);
      }
      throw e;
    }
  }

  private async store(job: ClaimedJob, plan: UnitPlanDraft, call: RecordedCall): Promise<UnitPlanOutcome> {
    await this.runs.store_unit_plan(job.run_id, plan, call.model_call_id);
    return { run_id: job.run_id, stored: true, entries: plan.entries.length, model_call_id: call.model_call_id, failure: null };
  }

  private failed(job: ClaimedJob, failure: FailureReasonRecord | undefined): UnitPlanOutcome {
    if (failure === undefined) throw new InvariantViolation("unit_plan_job.no_failure_reason", { job_id: job.job_id });
    return { run_id: job.run_id, stored: false, entries: 0, model_call_id: null, failure };
  }

  private request(job: ClaimedJob, purpose: CallPurpose, rendered: RenderedPrompt, alias: ModelAlias): UnitPlanPaidCallRequest {
    return {
      ctx: { run_id: job.run_id, lesson_id: null, job_id: job.job_id, attempt: 1, purpose, request_id: null, experiment_id: null, reservation_id: null },
      req: {
        alias,
        system_blocks: [...rendered.system_blocks],
        user_blocks: [...rendered.user_blocks],
        output_schema_name: "UnitPlanDraft",
        output_json_schema: this.schemas.json_schema("UnitPlanDraft"),
        output_mode: "schema_enforced",
        max_output_tokens: this.settings.draft_output_token_cap,
        timeout_ms: this.settings.model.model_call_timeout_ms,
        effort: this.settings.model.model_effort,
        temperature: null,
      },
      rendered,
      run_id: job.run_id,
      job_id: job.job_id,
      user_id: job.started_by,
    };
  }
}
