// In-memory doubles for the UnitPlanJob tests, typed against the real ports.
import Decimal from "decimal.js";
import type { CallPurpose, CapName, JobId, LessonId, ModelCallId, RunId } from "@ls/core/ports/common";
import type { JobRow } from "@ls/core/ports/job-queue";
import type { RecordedCall } from "@ls/core/ports/model-call-log";
import type { OutlineRowRecord, RowContext } from "@ls/core/ports/outlines";
import type { RunRow, UnitPlanRow } from "@ls/core/ports/runs";
import { FakeTxRunner } from "@ls/core/testing/fake-tx";
import { LOCKED_DIR } from "@ls/prompts/locked";
import { PromptRenderer } from "@ls/prompts/render";
import type { RenderedPrompt, UnitPlanPromptInput } from "@ls/prompts/inputs";
import { SchemaRegistry } from "@ls/prompts/schemas";
import type { IntakeChoiceRow, LessonLinkRecord, NormalizedRow, UnitRuleRecord } from "@ls/schema/outline";
import type { UnitPlanDraft } from "@ls/schema/unit-plan";
import {
  UnitPlanJob,
  type UnitPlanCalls,
  type UnitPlanOutlines,
  type UnitPlanPaidCallRequest,
  type UnitPlanPaidCaller,
  type UnitPlanPrompts,
  type UnitPlanQueue,
  type UnitPlanRenderer,
  type UnitPlanRuns,
} from "../unit-plan-job.ts";
import { JOB_ID, OV_ID, RUN_ID, UNIT_ID, USER_ID, claimed_job, make_plan, make_rows, prompt_row, teaching_rows, ulid, worker_settings } from "./unit-plan-fixtures.ts";
import type { ClaimedJob } from "@ls/core/ports/job-queue";

export class MemoryClock {
  private n = 0;
  tick(): Date {
    this.n += 1;
    return new Date(Date.UTC(2026, 9, 25, 12, 0, 0) + this.n * 1000);
  }
}

export class MemoryRuns implements UnitPlanRuns {
  stored: { plan: UnitPlanDraft; model_call_id: ModelCallId } | null = null;
  plan_stored_at: Date | null = null;
  state: RunRow["state"] = "planning";
  paused_check: string | null = null;
  capped_by: CapName | null = null;
  calls: string[] = [];
  on_store: (() => void) | null = null;

  constructor(private readonly clock: MemoryClock = new MemoryClock()) {}

  private run_row(): RunRow {
    return {
      run_id: RUN_ID,
      unit_id: UNIT_ID,
      outline_version_id: OV_ID,
      kind: "run",
      state: this.state,
      prompt_version_id: "pv_test_1",
      cap_usd: new Decimal(20),
      started_by: USER_ID,
      parent_run_id: null,
      plan_stored_at: this.plan_stored_at,
      paused_check: this.paused_check,
      capped_by: this.capped_by,
      choices_hash: "0".repeat(64),
      created_at: new Date("2026-10-25T00:00:00Z"),
      finished_at: null,
    };
  }

  async pinned_choices(): Promise<IntakeChoiceRow[]> {
    this.calls.push("pinned_choices");
    return [];
  }
  async store_unit_plan(run_id: RunId, plan: UnitPlanDraft, model_call_id: ModelCallId): Promise<UnitPlanRow> {
    this.calls.push("store_unit_plan");
    this.stored = { plan, model_call_id };
    this.plan_stored_at = this.clock.tick();
    this.state = "running";
    this.on_store?.();
    return { run_id, state: "stored", plan, lesson_links: [], model_call_id, stored_at: this.plan_stored_at };
  }
  async mark_plan_failed(): Promise<RunRow> {
    this.calls.push("mark_plan_failed");
    this.state = "paused";
    this.paused_check = "unit_plan";
    return this.run_row();
  }
  async mark_capped(_run_id: RunId, capped_by: CapName): Promise<RunRow> {
    this.calls.push("mark_capped");
    this.state = "capped";
    this.capped_by = capped_by;
    return this.run_row();
  }
}

export class MemoryOutlines implements UnitPlanOutlines {
  row_context_args: { lesson_id: LessonId }[] = [];
  constructor(
    private readonly all_rows: NormalizedRow[],
    readonly link_records: LessonLinkRecord[] = [],
    private readonly unit_rules: UnitRuleRecord[] = [],
  ) {}

  async rows(): Promise<OutlineRowRecord[]> {
    return this.all_rows.map((row) => ({ outline_version_id: OV_ID, row, row_hash: "0".repeat(64) }));
  }
  async links(): Promise<LessonLinkRecord[]> {
    return this.link_records;
  }
  async row_context(_ov: string, lesson_id: LessonId): Promise<RowContext> {
    this.row_context_args.push({ lesson_id });
    const row = this.all_rows.find((r) => r.lesson_id === lesson_id);
    if (row === undefined) throw new Error("row_context: unknown lesson");
    return { outline_version_id: OV_ID, row, row_hash: "0".repeat(64), arc_header: null, neighbours: [], unit_rules: this.unit_rules, links: this.link_records, choices: [] };
  }
}

export class MemoryQueue implements UnitPlanQueue {
  constructor(private readonly lesson_ids: readonly LessonId[]) {}
  async jobs_for_run(run_id: RunId): Promise<JobRow[]> {
    const fixed = {
      run_id,
      status: "queued" as const,
      tile_state: "queued" as const,
      attempt: 0,
      queued_at: new Date("2026-10-25T00:00:00Z"),
      started_at: null,
      finished_at: null,
      failure_reasons: [],
      brakes_fired: [],
      repairs: 0,
      truncation_retries: 0,
      retries: 0,
      calls_lost: 0,
      cost_usd: new Decimal(0),
    };
    const plan: JobRow = { ...fixed, job_id: JOB_ID, kind: "unit_plan", lesson_id: null };
    const lessons: JobRow[] = this.lesson_ids.map((id, i) => ({ ...fixed, job_id: `job_${ulid(10 + i)}`, kind: "lesson", lesson_id: id }));
    return [plan, ...lessons];
  }
}

export interface MemoryCallRow {
  model_call_id: ModelCallId;
  job_id: JobId;
  purpose: CallPurpose;
  attempt: number;
  rendered_prompt: string;
  raw_output: string;
  output_mode: string;
}

export class MemoryModelCalls implements UnitPlanCalls {
  rows: MemoryCallRow[] = [];
  on_insert: (() => void) | null = null;

  recorded(r: MemoryCallRow): RecordedCall {
    return {
      model_call_id: r.model_call_id,
      purpose: r.purpose,
      attempt: r.attempt,
      raw_output: r.raw_output,
      stop_reason: "end_turn",
      usage: { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0 },
      cost_usd: new Decimal("0.16"),
      served_model: "stub",
      retries: 0,
    };
  }
  insert(r: Omit<MemoryCallRow, "model_call_id">): MemoryCallRow {
    const row: MemoryCallRow = { ...r, model_call_id: `mc_${ulid(100 + this.rows.length)}` };
    this.rows.push(row);
    this.on_insert?.();
    return row;
  }
  async completed_for(job_id: JobId, purpose: CallPurpose, attempt: number): Promise<RecordedCall | null> {
    const r = this.rows.find((x) => x.job_id === job_id && x.purpose === purpose && x.attempt === attempt);
    return r === undefined ? null : this.recorded(r);
  }
}

export class StubPaidCaller implements UnitPlanPaidCaller {
  requests: UnitPlanPaidCallRequest[] = [];
  constructor(
    private readonly calls: MemoryModelCalls,
    private readonly script: Array<string | Error>,
  ) {}

  async call(p: UnitPlanPaidCallRequest): Promise<RecordedCall> {
    this.requests.push(p);
    const next = this.script.shift();
    if (next === undefined) throw new Error("unscripted paid call");
    if (next instanceof Error) throw next; // refusals and provider errors write no completed row
    const row = this.calls.insert({
      job_id: p.job_id,
      purpose: p.ctx.purpose,
      attempt: p.ctx.attempt,
      rendered_prompt: p.rendered.text,
      raw_output: next,
      output_mode: p.req.output_mode,
    });
    return this.calls.recorded(row);
  }
}

export class SpyRenderer implements UnitPlanRenderer {
  inputs: UnitPlanPromptInput[] = [];
  outputs: RenderedPrompt[] = [];
  private readonly real = new PromptRenderer(LOCKED_DIR, new SchemaRegistry());
  render_unit_plan(i: UnitPlanPromptInput): RenderedPrompt {
    this.inputs.push(i);
    const out = this.real.render_unit_plan(i);
    this.outputs.push(out);
    return out;
  }
}

export interface BuiltJob {
  job: UnitPlanJob;
  claimed: ClaimedJob;
  runs: MemoryRuns;
  outlines: MemoryOutlines;
  queue: MemoryQueue;
  calls: MemoryModelCalls;
  paid: StubPaidCaller;
  renderer: SpyRenderer;
  tx: FakeTxRunner;
  clock: MemoryClock;
  rows: NormalizedRow[];
}

export interface BuildOptions {
  script: Array<string | Error>;
  rows?: NormalizedRow[];
  scope_row_numbers?: readonly number[]; // default: every teaching row
  links?: LessonLinkRecord[];
  unit_rules?: UnitRuleRecord[];
  clock?: MemoryClock;
}

export function build_job(opts: BuildOptions): BuiltJob {
  const rows = opts.rows ?? make_rows(47);
  const scoped = teaching_rows(rows).filter((r) => opts.scope_row_numbers === undefined || opts.scope_row_numbers.includes(r.row_number));
  const clock = opts.clock ?? new MemoryClock();
  const runs = new MemoryRuns(clock);
  const outlines = new MemoryOutlines(rows, opts.links ?? [], opts.unit_rules ?? []);
  const queue = new MemoryQueue(scoped.map((r) => r.lesson_id as LessonId));
  const calls = new MemoryModelCalls();
  const paid = new StubPaidCaller(calls, [...opts.script]);
  const renderer = new SpyRenderer();
  const tx = new FakeTxRunner();
  const prompts: UnitPlanPrompts = { get: async () => prompt_row() };
  const job = new UnitPlanJob(paid, renderer, runs, outlines, prompts, worker_settings(), queue, calls, tx);
  return { job, claimed: claimed_job(), runs, outlines, queue, calls, paid, renderer, tx, clock, rows };
}

export function valid_plan_json(rows: readonly NormalizedRow[], scope_row_numbers?: readonly number[]): string {
  const scoped = teaching_rows(rows).filter((r) => scope_row_numbers === undefined || scope_row_numbers.includes(r.row_number));
  return JSON.stringify(make_plan(scoped));
}
