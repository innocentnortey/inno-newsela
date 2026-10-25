// NL-27 test support: in-memory doubles that RECORD writes, plus a synthetic 47-lesson outline. No vitest import.
import Decimal from "decimal.js";
import type { AuditLog, NewAuditEvent } from "@ls/core/ports/audit";
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { JobQueue, JobRow, NewJob } from "@ls/core/ports/job-queue";
import type { LessonStateRepo } from "@ls/core/ports/lesson-state";
import type { GateInputs, OutlineRepo } from "@ls/core/ports/outlines";
import type { PromptRepo, PromptVersionRow } from "@ls/core/ports/prompts";
import type { NewRun, RunRepo, RunRow } from "@ls/core/ports/runs";
import { FakeModelCallLog } from "@ls/core/testing/fake-model-call-log";
import { FakeSpendLedger } from "@ls/core/testing/fake-spend";
import { FakeTxRunner } from "@ls/core/testing/fake-tx";
import type { IntakeChoiceRow, LessonLinkRecord, NormalizedOutline, NormalizedRow, OutlineVersionRow } from "@ls/schema/outline";
import { NormalizedRow as NormalizedRowSchema } from "@ls/schema/outline";
import type { WebSettings } from "@ls/config/settings";
import { RunService } from "../run-service.ts";

const unused = (): never => {
  throw new Error("unused");
};

export const OUTLINE_VERSION_ID = "G6.U4.ov1";
export const UNIT_ID = "G6.U4";
export const PROMPT_VERSION_ID = "pv_1";

function row(row_number: number, kind: NormalizedRow["kind"], lesson_id: string | null, number: number | null, title: string): NormalizedRow {
  return NormalizedRowSchema.parse({
    row_number, kind, lesson_id, number, title, lesson_type: "", arc: null, segments: [], focus_codes: [], eld_codes: [],
    msls_codes: [], vocabulary: [], homework: null, pages: null, text_set: null,
  });
}

/** Deterministic: row 1 arc header, rows 2-48 teaching days (41 lessons + 6 flex days), row 49 total. Row 25 is flex day FLEX-1a. */
export function build_outline(opts: { errors_unconfirmed?: boolean } = {}): NormalizedOutline {
  const rows: NormalizedRow[] = [row(1, "arc_header", null, null, "Synthetic arc")];
  const flex_rows = new Set([25, 30, 35, 40, 45, 48]); // row 25 is the first flex day, FLEX-1a
  let lesson_n = 0;
  let flex_n = 0;
  for (let n = 2; n <= 48; n++) {
    if (flex_rows.has(n)) {
      flex_n += 1;
      rows.push(row(n, "flex_day", `G6.U4.FLEX-${flex_n}a`, null, `Synthetic flex ${flex_n}`));
    } else {
      lesson_n += 1;
      rows.push(row(n, "lesson", `G6.U4.L${lesson_n}`, lesson_n, `Synthetic lesson ${lesson_n}`));
    }
  }
  rows.push(row(49, "total", null, null, "Synthetic total"));
  const findings = opts.errors_unconfirmed
    ? [{ finding_id: "f_err_1", row_number: 8, level: "error" as const, kind: "malformed_code", original_text: "synthetic", proposed_fix: null, default_choice: null }]
    : [];
  return {
    unit_as_written: "Synthetic unit", unit_from_filenames: null, rows, findings, unit_rules: [],
    counts: { lessons: lesson_n, flex_days: flex_n, arc_headers: 1, totals: 1, errors: findings.length, warnings: 0 },
  };
}

export class MemRunRepo implements RunRepo {
  readonly rows = new Map<string, RunRow>();
  readonly inserted: NewRun[] = [];
  constructor(private readonly ids: PrefixedIdGenerator, private readonly clock: FakeClock) {}

  async insert_run(run: NewRun): Promise<RunRow> {
    this.inserted.push(run);
    const r: RunRow = {
      run_id: this.ids.new_id("run"), unit_id: run.unit_id, outline_version_id: run.outline_version_id, kind: run.kind,
      state: "planning", prompt_version_id: run.prompt_version_id, cap_usd: run.cap_usd, started_by: run.started_by,
      parent_run_id: run.parent_run_id, plan_stored_at: null, paused_check: null, capped_by: null,
      choices_hash: run.choices_hash, created_at: this.clock.now(), finished_at: null,
    };
    this.rows.set(r.run_id, r);
    (this.keys ??= new Map()).set(`${run.started_by}|${run.idempotency_key ?? ""}`, r);
    return r;
  }
  private keys?: Map<string, RunRow>;
  async get(run_id: string): Promise<RunRow | null> {
    return this.rows.get(run_id) ?? null;
  }
  async find_by_idempotency_key(user_id: string, key: string, within_hours: number): Promise<RunRow | null> {
    const r = this.keys?.get(`${user_id}|${key}`);
    if (!r) return null;
    return this.clock.now().getTime() - r.created_at.getTime() < within_hours * 3_600_000 ? r : null;
  }
  lock_for_update = unused as RunRepo["lock_for_update"];
  set_state = unused as RunRepo["set_state"];
  mark_capped = unused as RunRepo["mark_capped"];
  pinned_choices = unused as RunRepo["pinned_choices"];
  mark_plan_failed = unused as RunRepo["mark_plan_failed"];
  store_unit_plan = unused as RunRepo["store_unit_plan"];
  unit_plan = unused as RunRepo["unit_plan"];
  summary_rows = unused as RunRepo["summary_rows"];
  active_runs = unused as RunRepo["active_runs"];
}

export class MemOutlineRepo implements OutlineRepo {
  constructor(
    readonly outline: NormalizedOutline,
    readonly choice_rows: IntakeChoiceRow[] = [],
    readonly link_rows: LessonLinkRecord[] = [],
  ) {}
  async version(id: string): Promise<OutlineVersionRow | null> {
    if (id !== OUTLINE_VERSION_ID) return null;
    return {
      outline_version_id: OUTLINE_VERSION_ID, unit_id: UNIT_ID, number: 1, sha256: "a".repeat(64), same_as_version: null,
      source_kind: "upload_csv", uploaded_by: "usr_synthetic_author", created_at: "2026-10-25T00:00:00.000Z", confirmed_at: null,
    } as unknown as OutlineVersionRow;
  }
  async rows(id: string): Promise<OutlineRowRecord[]> {
    return this.outline.rows.map((r) => ({ outline_version_id: id, row: r, row_hash: `h${r.row_number}` })) as unknown as OutlineRowRecord[];
  }
  async choices(): Promise<IntakeChoiceRow[]> {
    return this.choice_rows;
  }
  async links(): Promise<LessonLinkRecord[]> {
    return this.link_rows;
  }
  async generate_gate_inputs(): Promise<GateInputs> {
    return { outline: this.outline, choices: this.choice_rows };
  }
  list_units = unused as OutlineRepo["list_units"];
  insert_version = unused as OutlineRepo["insert_version"];
  upsert_choice = unused as OutlineRepo["upsert_choice"];
  mark_confirmed = unused as OutlineRepo["mark_confirmed"];
  row_context = unused as OutlineRepo["row_context"];
}
type OutlineRowRecord = Awaited<ReturnType<OutlineRepo["rows"]>>[number];

export class MemPromptRepo implements Pick<PromptRepo, "get"> {
  async get(id: string): Promise<PromptVersionRow | null> {
    if (id !== PROMPT_VERSION_ID) return null;
    return { prompt_version_id: id, number: 1, locked_hash: "b".repeat(64), guidance_text: "", author_id: null, reason: null, diff: null, created_at: new Date("2026-10-25T00:00:00.000Z") } as unknown as PromptVersionRow;
  }
}

export class MemJobQueue implements Pick<JobQueue, "create_run_jobs" | "jobs_for_run"> {
  readonly created: NewJob[] = [];
  readonly by_run = new Map<string, JobRow[]>();
  async create_run_jobs(jobs: readonly NewJob[]): Promise<number> {
    this.created.push(...jobs);
    for (const j of jobs) this.by_run.set(j.run_id, [...(this.by_run.get(j.run_id) ?? []), j as unknown as JobRow]);
    return jobs.length;
  }
  async jobs_for_run(run_id: string): Promise<JobRow[]> {
    return this.by_run.get(run_id) ?? [];
  }
}

export class MemAudit implements Pick<AuditLog, "append"> {
  readonly appended: NewAuditEvent[] = [];
  async append(e: NewAuditEvent): Promise<string> {
    this.appended.push(e);
    return `ae_${this.appended.length}`;
  }
}

export class MemStates implements Pick<LessonStateRepo, "ensure_lessons"> {
  readonly ensured: { rows: readonly NormalizedRow[]; unit_id: string }[] = [];
  async ensure_lessons(rows: readonly NormalizedRow[], unit_id: string): Promise<number> {
    this.ensured.push({ rows, unit_id });
    return rows.length;
  }
}

export const job_row = (run_id: string, lesson_id: string, status: JobRow["status"], n: number): JobRow =>
  ({
    job_id: `job_${n}`, run_id, kind: "lesson", lesson_id, status, tile_state: status === "ready" ? "ready" : "failed", attempt: 1,
    queued_at: new Date("2026-10-25T00:00:00.000Z"), started_at: null, finished_at: null, failure_reasons: [], brakes_fired: [],
    repairs: 0, truncation_retries: 0, retries: 0, calls_lost: 0, cost_usd: new Decimal(0),
  }) as unknown as JobRow;

export interface ServiceKit {
  service: RunService;
  runs: MemRunRepo;
  queue: MemJobQueue;
  outlines: MemOutlineRepo;
  audit: MemAudit;
  states: MemStates;
  spend: FakeSpendLedger;
  tx: FakeTxRunner;
  clock: FakeClock;
  ids: PrefixedIdGenerator;
}

export function allowed_decision(): Awaited<ReturnType<FakeSpendLedger["check_day_cap"]>> {
  return { allowed: true, reservation_id: null, refused_by: null, scope: null, remaining_usd: null, snapshot: {} } as unknown as Awaited<ReturnType<FakeSpendLedger["check_day_cap"]>>;
}

/** Queues 20 allowed `check_day_cap` answers; tests that need a refusal build their own spend script first. */
export function make_service(over: { outline?: NormalizedOutline; choices?: IntakeChoiceRow[]; links?: LessonLinkRecord[] } = {}): ServiceKit {
  const clock = new FakeClock(new Date("2026-10-25T12:00:00.000Z"));
  const ids = new PrefixedIdGenerator();
  const runs = new MemRunRepo(ids, clock);
  const queue = new MemJobQueue();
  const outlines = new MemOutlineRepo(over.outline ?? build_outline(), over.choices ?? [], over.links ?? []);
  const audit = new MemAudit();
  const states = new MemStates();
  const spend = new FakeSpendLedger();
  const tx = new FakeTxRunner();
  const zero = { settled_usd: new Decimal(0) } as unknown as Awaited<ReturnType<FakeSpendLedger["run_totals"]>>;
  for (let i = 0; i < 20; i++) spend.script.returns("check_day_cap", allowed_decision()).returns("run_totals", zero);
  const service = new RunService(
    runs, queue as unknown as JobQueue, outlines, states as unknown as LessonStateRepo, new MemPromptRepo() as unknown as PromptRepo,
    spend, new FakeModelCallLog(), audit as unknown as AuditLog, tx, ids, clock, { idempotency_window_h: 24 } as WebSettings,
  );
  return { service, runs, queue, outlines, audit, states, spend, tx, clock, ids };
}