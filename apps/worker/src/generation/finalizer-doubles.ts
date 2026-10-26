// In-memory doubles for RunFinalizer and ClaimLoop tests. Test support only.
import Decimal from "decimal.js";
import type { Clock } from "@ls/core/ports/clock";
import type { CallPurpose, CapName, JobId, RunId, RunStateName, Usd } from "@ls/core/ports/common";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { ClaimedJob, JobOutcome, JobQueue, JobRow, RequeueReport } from "@ls/core/ports/job-queue";
import type { ModelCallLog, RecordedCall, RunCallTotals } from "@ls/core/ports/model-call-log";
import type { RunRepo, RunRow } from "@ls/core/ports/runs";
import type { RunSpend, SpendLedger } from "@ls/core/ports/spend";
import type { Tx, TxFunction, TxRunner } from "@ls/core/ports/tx";
import type { Logger, LogFields } from "@ls/obs/logger";
import type { DeriveRunState } from "./run-finalizer.ts";

const ids = new PrefixedIdGenerator();

function unused(name: string): never {
  throw new Error(`not used: ${name}`);
}

export function make_run_row(p: Partial<RunRow> = {}): RunRow {
  return {
    run_id: ids.new_id("run"),
    unit_id: "unit_test",
    outline_version_id: "olv_test",
    kind: "run",
    state: "running",
    prompt_version_id: "pv_test",
    cap_usd: new Decimal("5.00"),
    started_by: "usr_test",
    parent_run_id: null,
    plan_stored_at: new Date(0),
    paused_check: null,
    capped_by: null,
    choices_hash: "0".repeat(64),
    created_at: new Date(0),
    finished_at: null,
    ...p,
  } as RunRow;
}

export function make_job_row(p: Partial<JobRow> = {}): JobRow {
  return {
    job_id: ids.new_id("job"),
    run_id: "run_a",
    kind: "lesson",
    lesson_id: "G6.U1.L1",
    status: "queued",
    tile_state: "queued",
    attempt: 0,
    queued_at: new Date(0),
    started_at: null,
    finished_at: null,
    failure_reasons: [],
    brakes_fired: [],
    repairs: 0,
    truncation_retries: 0,
    retries: 0,
    calls_lost: 0,
    cost_usd: new Decimal("0.0123"),
    ...p,
  } as JobRow;
}

const TERMINAL_RUN: readonly RunStateName[] = ["complete", "partial", "capped", "cancelled"];

export class MemRunRepo implements RunRepo {
  readonly rows = new Map<RunId, RunRow>();
  readonly calls: string[] = [];
  constructor(private readonly clock: Clock) {}

  add(row: RunRow): RunRow {
    this.rows.set(row.run_id, row);
    return row;
  }
  private row(run_id: RunId): RunRow {
    const r = this.rows.get(run_id);
    if (!r) throw new Error(`no run ${run_id}`);
    return r;
  }
  async lock_for_update(run_id: RunId, _tx: Tx): Promise<RunRow> {
    this.calls.push("lock_for_update");
    return { ...this.row(run_id) };
  }
  async set_state(run_id: RunId, state: RunStateName, paused_check: string | null, _tx: Tx): Promise<RunRow> {
    this.calls.push(`set_state:${state}`);
    const r = this.row(run_id);
    r.state = state;
    r.paused_check = paused_check;
    if (TERMINAL_RUN.includes(state)) r.finished_at = this.clock.now();
    return { ...r };
  }
  async mark_capped(run_id: RunId, capped_by: CapName, _tx: Tx): Promise<RunRow> {
    this.calls.push(`mark_capped:${capped_by}`);
    const r = this.row(run_id);
    r.state = "capped";
    r.capped_by = capped_by;
    r.finished_at = this.clock.now();
    return { ...r };
  }
  async get(run_id: RunId): Promise<RunRow | null> {
    return this.rows.get(run_id) ?? null;
  }
  insert_run: RunRepo["insert_run"] = () => unused("insert_run");
  find_by_idempotency_key: RunRepo["find_by_idempotency_key"] = () => unused("find_by_idempotency_key");
  pinned_choices: RunRepo["pinned_choices"] = () => unused("pinned_choices");
  mark_plan_failed: RunRepo["mark_plan_failed"] = () => unused("mark_plan_failed");
  store_unit_plan: RunRepo["store_unit_plan"] = () => unused("store_unit_plan");
  unit_plan: RunRepo["unit_plan"] = () => unused("unit_plan");
  summary_rows: RunRepo["summary_rows"] = () => unused("summary_rows");
  active_runs: RunRepo["active_runs"] = () => unused("active_runs");
}

export class MemJobQueue implements JobQueue {
  readonly jobs: JobRow[] = [];
  readonly log: string[] = [];
  shared_log: string[] | null = null;
  fail_next_cancel = false;
  readonly renew_results = new Map<JobId, boolean[]>();
  readonly renew_times: number[] = [];
  requeue_ids: JobId[] = [];
  readonly cancel_calls: { run_id: RunId; reason: "cancelled" | "capped" }[] = [];
  constructor(private readonly clock: Clock) {}

  private note(name: string): void {
    this.log.push(name);
    this.shared_log?.push(name);
  }
  add(row: JobRow): JobRow {
    this.jobs.push(row);
    return row;
  }
  async jobs_for_run(run_id: RunId): Promise<JobRow[]> {
    return this.jobs.filter((j) => j.run_id === run_id).map((j) => ({ ...j }));
  }
  async cancel_run(run_id: RunId, reason: "cancelled" | "capped", _tx: Tx): Promise<number> {
    this.note("cancel_run");
    this.cancel_calls.push({ run_id, reason });
    if (this.fail_next_cancel) {
      this.fail_next_cancel = false;
      throw new Error("cancel_run failed");
    }
    let n = 0;
    for (const j of this.jobs) {
      if (j.run_id !== run_id || j.status !== "queued") continue;
      j.status = "cancelled";
      j.tile_state = "failed";
      j.failure_reasons = [{ check: reason, message: reason }];
      j.finished_at = this.clock.now();
      n += 1;
    }
    return n;
  }
  async finish(outcome: JobOutcome): Promise<void> {
    this.note("finish");
    const j = this.jobs.find((x) => x.job_id === outcome.job_id);
    if (!j) throw new Error(`no job ${outcome.job_id}`);
    j.status = outcome.status;
    j.tile_state = outcome.tile_state;
    j.failure_reasons = outcome.failure_reasons;
    j.brakes_fired = outcome.brakes_fired;
    j.repairs = outcome.repairs;
    j.truncation_retries = outcome.truncation_retries;
    j.retries = outcome.retries;
    j.calls_lost = outcome.calls_lost;
    j.cost_usd = outcome.cost_usd;
    j.finished_at = this.clock.now();
  }
  async claim(_worker_id: string, _max_active_runs: number, lease_ms: number): Promise<ClaimedJob | null> {
    this.note("claim");
    const j = this.jobs.find((x) => x.status === "queued");
    if (!j) return null;
    j.status = "running";
    j.started_at = this.clock.now();
    j.attempt += 1;
    return {
      job_id: j.job_id,
      run_id: j.run_id,
      unit_id: "unit_test",
      kind: j.kind,
      lesson_id: j.lesson_id,
      attempt: j.attempt,
      lease_until: new Date(this.clock.now().getTime() + lease_ms),
      prompt_version_id: "pv_test",
      schema_version: 1,
      outline_version_id: "olv_test",
      started_by: "usr_test",
      idempotency_key: `key_${j.job_id}`,
      reviewer_note: null,
    } as ClaimedJob;
  }
  async renew_lease(job_id: JobId, _lease_ms: number): Promise<boolean> {
    this.note("renew_lease");
    this.renew_times.push(this.clock.now().getTime());
    const planned = this.renew_results.get(job_id);
    return planned && planned.length > 0 ? (planned.shift() as boolean) : true;
  }
  async requeue_expired(_now: Date): Promise<RequeueReport> {
    this.note("requeue_expired");
    return { requeued: this.requeue_ids.length, job_ids: [...this.requeue_ids] };
  }
  async set_tile_state(): Promise<void> {
    this.note("set_tile_state");
  }
  create_run_jobs: JobQueue["create_run_jobs"] = () => unused("create_run_jobs");
  create_candidate_job: JobQueue["create_candidate_job"] = () => unused("create_candidate_job");
  requeue_failed: JobQueue["requeue_failed"] = () => unused("requeue_failed");
  is_cancelled: JobQueue["is_cancelled"] = () => unused("is_cancelled");
}

// Runs transactions one at a time (a real database serialises them through lock_for_update)
// and restores both stores' rows when the function throws.
export class MemTxRunner implements TxRunner {
  commits = 0;
  rollbacks = 0;
  private chain: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly runs: MemRunRepo,
    private readonly queue: MemJobQueue,
  ) {}

  with_tx<T>(fn: TxFunction<T>, _advisory_lock?: string | null): Promise<T> {
    const result = this.chain.then(() => this.run_one(fn));
    this.chain = result.catch(() => undefined);
    return result;
  }

  private async run_one<T>(fn: TxFunction<T>): Promise<T> {
    const run_snap = [...this.runs.rows.values()].map((r) => [r, { ...r }] as const);
    const job_snap = this.queue.jobs.map((j) => [j, { ...j }] as const);
    try {
      const out = await fn({});
      this.commits += 1;
      return out;
    } catch (err) {
      for (const [row, snap] of run_snap) Object.assign(row, snap);
      for (const [row, snap] of job_snap) Object.assign(row, snap);
      this.rollbacks += 1;
      throw err;
    }
  }
}

export class StubRunSpend implements Pick<SpendLedger, "run_totals"> {
  settled_usd: Usd = new Decimal(0);
  async run_totals(run_id: RunId): Promise<RunSpend> {
    return { run_id, cap_usd: new Decimal("1.00"), settled_usd: this.settled_usd, reserved_usd: new Decimal(0) };
  }
}

export class StubCalls implements ModelCallLog {
  readonly completed = new Map<string, Set<string>>();
  totals_cost: Usd = new Decimal(0);
  readonly lost_per_job = new Map<JobId, number>();
  readonly log: string[] = [];
  shared_log: string[] | null = null;

  add_completed(job_id: JobId, purpose: CallPurpose, attempt = 1): void {
    const set = this.completed.get(job_id) ?? new Set<string>();
    set.add(`${purpose}:${attempt}`);
    this.completed.set(job_id, set);
  }
  async mark_lost(job_id: JobId): Promise<number> {
    this.log.push("mark_lost");
    this.shared_log?.push("mark_lost");
    return this.lost_per_job.get(job_id) ?? 1;
  }
  async completed_for(job_id: JobId, purpose: CallPurpose, attempt: number): Promise<RecordedCall | null> {
    return this.completed.get(job_id)?.has(`${purpose}:${attempt}`) ? ({ purpose, attempt } as RecordedCall) : null;
  }
  async totals_for_run(run_id: RunId): Promise<RunCallTotals> {
    return {
      run_id, calls: 0, completed: 0, failed: 0, lost: 0, retries: 0, truncation_retries: 0, repairs: 0,
      cost_usd: this.totals_cost, input_tokens: 0, output_tokens: 0,
    };
  }
  insert_sent: ModelCallLog["insert_sent"] = () => unused("insert_sent");
  complete: ModelCallLog["complete"] = () => unused("complete");
  fail: ModelCallLog["fail"] = () => unused("fail");
}

// NL-27's rule text: cancelled/capped/paused stay; no stored plan -> planning;
// all jobs terminal -> complete (all ready) or partial; otherwise running.
export const reference_derive_run_state: DeriveRunState = (jobs, run) => {
  if (run.cancelled) return "cancelled";
  if (run.capped) return "capped";
  if (run.paused) return "paused";
  if (!run.plan_stored && !(jobs.length > 0 && jobs.every((j) => j.kind === "candidate"))) return "planning";
  const work = jobs.filter((j) => j.kind !== "unit_plan");
  const terminal = work.every((j) => j.status === "ready" || j.status === "generation_failed" || j.status === "cancelled");
  if (!terminal) return "running";
  return work.every((j) => j.status === "ready") ? "complete" : "partial";
};

export interface LogLine {
  level: "info" | "warn" | "error";
  event: string;
  fields: LogFields;
}

export function make_logger(): { logger: Logger; lines: LogLine[] } {
  const lines: LogLine[] = [];
  const at = (level: LogLine["level"]) => (event: string, fields: LogFields): void => {
    lines.push({ level, event, fields });
  };
  return { logger: { info: at("info"), warn: at("warn"), error: at("error") }, lines };
}
