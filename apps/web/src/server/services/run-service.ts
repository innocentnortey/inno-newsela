// RunService (DO-4 section 5). NL-27 built `start`; NL-78 built progress/control/plan/summary.
import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import { DomainRefusal, InvariantViolation } from "@ls/core/errors";
import { decide_run_control } from "@ls/core/lifecycle/run-machine";
import { generate_gate } from "@ls/core/intake/report";
import type { AuditLog } from "@ls/core/ports/audit";
import type { Clock } from "@ls/core/ports/clock";
import type { RequestUser } from "@ls/core/ports/common";
import type { IdGenerator } from "@ls/core/ports/ids";
import type { JobQueue, NewJob } from "@ls/core/ports/job-queue";
import type { LessonStateRepo } from "@ls/core/ports/lesson-state";
import type { ModelCallLog } from "@ls/core/ports/model-call-log";
import type { OutlineRepo } from "@ls/core/ports/outlines";
import type { PromptRepo } from "@ls/core/ports/prompts";
import type { RunProgressReader } from "@ls/core/ports/run-progress";
import type { RunRepo, RunRow } from "@ls/core/ports/runs";
import type { SpendLedger } from "@ls/core/ports/spend";
import type { TxRunner } from "@ls/core/ports/tx";
import type { WebSettings } from "@ls/config/settings";
import { SCHEMA_VERSION } from "@ls/editor-schema/schema";
import type { Run, RunControlRequest, RunControlResult, RunProgress, StartRunRequest, UnitPlan } from "@ls/schema/api/runs";
import { canonical_json } from "@ls/schema/content-hash";
import type { NormalizedRow } from "@ls/schema/outline";
import { build_progress, build_summary, plan_links, type RunSummaryResult } from "./run-read-model.ts";

export type { RunSummaryResult };

// NL-78: optional collaborators for the read and control methods; the 12-argument DO-4 shape stays valid without them.
export interface RunServiceExtras {
  progress?: RunProgressReader;
  concurrency_cap?: number; // default 6 (GENERATION_CONCURRENCY default and max)
  notify?: (run_id: string) => Promise<void>; // runs AFTER commit when jobs were re-queued
}

export class NotBuiltYet extends Error {
  constructor(readonly owner: string) {
    super(`NOT BUILT: ${owner}`);
    this.name = "NotBuiltYet";
  }
}

const sha256_hex = (s: string): string => createHash("sha256").update(s).digest("hex");

// D-2: a "lesson row" is a lesson or flex day that has an id.
const is_lesson_row = (r: NormalizedRow): boolean => (r.kind === "lesson" || r.kind === "flex_day") && r.lesson_id !== null;

export function job_key(run_id: string, lesson_id: string | null, prompt_version_id: string): string {
  return sha256_hex([run_id, lesson_id ?? "unit_plan", prompt_version_id, String(SCHEMA_VERSION)].join("\n"));
}

function invalid(...fields: string[]): DomainRefusal {
  return new DomainRefusal("INVALID_REQUEST", "The request is not valid.", { fields });
}

function to_run(row: RunRow, scope: StartRunRequest["scope"], spent: Decimal): Run {
  return {
    run_id: row.run_id, state: row.state, mode: row.kind === "trial" ? "trial" : "run", scope,
    outline_version_id: row.outline_version_id, prompt_version_id: row.prompt_version_id, choices_hash: row.choices_hash,
    cap_usd: row.cap_usd.toNumber(), spent_usd: spent.toNumber(), created_by: row.started_by, created_at: row.created_at.toISOString(),
  } as Run;
}

export class RunService {
  constructor(
    private readonly runs: RunRepo,
    private readonly queue: JobQueue,
    private readonly outlines: OutlineRepo,
    private readonly states: LessonStateRepo,
    private readonly prompts: PromptRepo,
    private readonly spend: SpendLedger,
    private readonly calls: ModelCallLog,
    private readonly audit: AuditLog,
    private readonly tx: TxRunner,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly settings: WebSettings,
    private readonly extras: RunServiceExtras = {},
  ) {}

  // The scope of a stored run, rebuilt from the run and its jobs: a replay returns the original run, never the retry's body.
  private async stored_scope(run: RunRow): Promise<StartRunRequest["scope"]> {
    if (run.parent_run_id) return { kind: "unfinished_of_run", run_id: run.parent_run_id } as StartRunRequest["scope"];
    const lesson_ids = new Set(
      (await this.queue.jobs_for_run(run.run_id)).filter((j) => j.kind === "lesson" || j.kind === "candidate").map((j) => j.lesson_id),
    );
    const generatable = (await this.outlines.rows(run.outline_version_id)).map((r) => r.row).filter(is_lesson_row);
    const picked = generatable.filter((r) => lesson_ids.has(r.lesson_id));
    if (run.kind !== "trial" && picked.length === generatable.length) return { kind: "all" } as StartRunRequest["scope"];
    return { kind: "rows", rows: picked.map((r) => r.row_number) } as StartRunRequest["scope"];
  }

  async start(user: RequestUser, req: StartRunRequest, idempotency_key: string | null): Promise<Run> {
    if (user.role !== "author") throw new DomainRefusal("ROLE_FORBIDDEN", "Only authors can start a run.");
    const key = idempotency_key?.trim() || null;
    const lock = key === null ? null : "run:start:" + user.user_id + key;
    // One transaction: a refusal throws inside it and rolls everything back; a twin request waits on the lock.
    return this.tx.with_tx(async (tx) => {
      if (key !== null) {
        const existing = await this.runs.find_by_idempotency_key(user.user_id, key, this.settings.idempotency_window_h);
        if (existing) {
          const spent = (await this.spend.run_totals(existing.run_id)).settled_usd;
          return to_run(existing, await this.stored_scope(existing), spent);
        }
      }

      const bad: string[] = [];
      if (!(Number.isFinite(req.cap_usd) && req.cap_usd > 0)) bad.push("cap_usd");
      if (req.mode === "trial" && !req.lesson_id) bad.push("lesson_id");
      if (req.scope.kind === "rows" && (!req.scope.rows || req.scope.rows.length === 0)) bad.push("scope.rows");
      if (req.scope.kind === "unfinished_of_run" && !req.scope.run_id) bad.push("scope.run_id");
      if (bad.length > 0) throw invalid(...bad);

      const ov = await this.outlines.version(req.outline_version_id);
      if (!ov) throw new DomainRefusal("NOT_FOUND", "Outline version not found.");
      const prompt = await this.prompts.get(req.prompt_version_id);
      if (!prompt) throw new DomainRefusal("NOT_FOUND", "Prompt version not found.");

      const id = ov.outline_version_id;
      const generatable = (await this.outlines.rows(id)).map((r) => r.row).filter(is_lesson_row);
      let in_scope: NormalizedRow[];
      if (req.mode === "trial") {
        const one = generatable.find((r) => r.lesson_id === req.lesson_id);
        if (!one) throw invalid("lesson_id");
        in_scope = [one];
      } else if (req.scope.kind === "all") {
        in_scope = generatable;
      } else if (req.scope.kind === "rows") {
        const wanted = [...new Set(req.scope.rows ?? [])];
        const picked = wanted.map((n) => generatable.find((r) => r.row_number === n));
        if (picked.some((r) => r === undefined)) throw invalid("scope.rows");
        const set = new Set(wanted);
        in_scope = generatable.filter((r) => set.has(r.row_number));
      } else {
        const old = await this.runs.get(req.scope.run_id as string);
        if (!old) throw new DomainRefusal("NOT_FOUND", "Run not found.");
        if (old.outline_version_id !== id) throw invalid("scope.run_id");
        const unfinished = new Set(
          (await this.queue.jobs_for_run(old.run_id)).filter((j) => j.kind === "lesson" && j.status !== "ready").map((j) => j.lesson_id),
        );
        in_scope = generatable.filter((r) => unfinished.has(r.lesson_id));
        if (in_scope.length === 0) throw invalid("scope.run_id");
      }

      const choices = await this.outlines.choices(id);
      const links = await this.outlines.links(id);
      const sorted = [...choices].sort((a, b) => (a.finding_id < b.finding_id ? -1 : a.finding_id > b.finding_id ? 1 : 0));
      const choices_hash = sha256_hex(canonical_json(sorted));

      const gi = await this.outlines.generate_gate_inputs(id);
      const gate = generate_gate(gi.outline, gi.choices);
      if (!gate.allowed) {
        throw new DomainRefusal("VALIDATION_INCOMPLETE", "Confirm the intake errors before generating.", {
          errors_unconfirmed: gate.details.unconfirmed_finding_ids.length,
        });
      }

      const cap = new Decimal(req.cap_usd);
      const d = await this.spend.check_day_cap(user.user_id, cap);
      if (!d.allowed) {
        const scope = d.scope ?? (d.refused_by === "project_cap" ? "project" : "user");
        throw new DomainRefusal("DAY_CAP_REACHED", "Today's spend limit would be passed.", {
          scope, remaining_usd: d.remaining_usd === null ? null : d.remaining_usd.toNumber(),
        });
      }

      const row = await this.runs.insert_run(
        {
          unit_id: ov.unit_id, outline_version_id: id, kind: req.mode, prompt_version_id: prompt.prompt_version_id, cap_usd: cap,
          scope_rows: req.scope.kind === "all" ? null : in_scope.map((r) => r.row_number), started_by: user.user_id,
          parent_run_id: req.mode === "run" && req.scope.kind === "unfinished_of_run" ? (req.scope.run_id as string) : null,
          eval_run_id: null, choices, choices_hash, lesson_links: links, idempotency_key: key,
        },
        tx,
      );

      await this.states.ensure_lessons(in_scope, ov.unit_id, tx);
      const job = (kind: NewJob["kind"], lesson_id: string | null): NewJob => ({
        run_id: row.run_id, kind, lesson_id, idempotency_key: job_key(row.run_id, lesson_id, prompt.prompt_version_id),
        priority: 0, reviewer_note: null,
      });
      const jobs: NewJob[] =
        req.mode === "trial"
          ? [job("candidate", in_scope[0]?.lesson_id ?? null)]
          : [job("unit_plan", null), ...in_scope.map((r) => job("lesson", r.lesson_id))];
      await this.queue.create_run_jobs(jobs, tx);

      await this.audit.append(
        {
          actor_id: user.user_id, action: "run.start", target_kind: "run", target_id: row.run_id, version_hash: null, reason: null,
          details: {
            outline_version_id: id, prompt_version_id: prompt.prompt_version_id, mode: req.mode, scope_kind: req.scope.kind,
            lessons: in_scope.length, cap_usd: cap.toFixed(2), choices_hash,
          },
          request_id: user.request_id, store_id: null,
        },
        tx,
      );
      return to_run(row, req.scope, new Decimal(0));
    }, lock);
  }

  async progress(_user: RequestUser, run_id: string): Promise<RunProgress> {
    const reader = this.extras.progress;
    if (!reader) throw new InvariantViolation("progress reader not wired");
    const rows = await reader.progress_rows(run_id);
    if (rows === null) throw new DomainRefusal("NOT_FOUND", "Run not found.");
    return build_progress(rows, this.extras.concurrency_cap ?? 6);
  }

  async plan(_user: RequestUser, run_id: string): Promise<UnitPlan> {
    const run = await this.runs.get(run_id);
    if (!run) throw new DomainRefusal("NOT_FOUND", "Run not found.");
    const row = await this.runs.unit_plan(run_id);
    if (!row) throw new DomainRefusal("NOT_FOUND", "Unit plan not found.");
    // A resumed run is planning again, but RunRepo cannot reset the stored row.
    const state = row.state === "failed" && run.state !== "paused" ? "planning" : row.state;
    return {
      run_id, state, stored_at: row.stored_at?.toISOString() ?? null,
      entries: [...(row.plan?.entries ?? [])].sort((a, b) => a.day - b.day) as UnitPlan["entries"],
      lesson_links: row.lesson_links.map(plan_links),
    };
  }

  async summary(_user: RequestUser, run_id: string): Promise<RunSummaryResult> {
    const rows = await this.runs.summary_rows(run_id); // throws NOT_FOUND itself
    const totals = await this.calls.totals_for_run(run_id);
    const spend = await this.spend.run_totals(run_id);
    return build_summary(rows, totals, spend.settled_usd, this.clock.now());
  }

  async control(user: RequestUser, run_id: string, req: RunControlRequest): Promise<RunControlResult> {
    if (user.role !== "author") throw new DomainRefusal("ROLE_FORBIDDEN", "Only authors can control a run.");
    const out = await this.tx.with_tx(async (tx) => {
      // The row lock comes first so two clicks serialise; a refusal throws inside the tx so nothing is written.
      const run = await this.runs.lock_for_update(run_id, tx);
      const d = decide_run_control(run.state, req.action);
      if (!d.allowed) throw new DomainRefusal("INVALID_TRANSITION", "That action does not fit the run's state.", { state: run.state });
      if (d.to_state === null) throw new InvariantViolation("allowed run control without a target state");
      const plan_retry = req.action === "resume" && run.paused_check === "unit_plan";
      let requeued: string[] = [];
      if (d.cancel_jobs) {
        // Queued jobs only; in-flight jobs stop at the worker's next node. No lesson row is created or deleted.
        await this.queue.cancel_run(run_id, "cancelled", tx);
      } else if (d.requeue_failed) {
        const failed = (await this.queue.jobs_for_run(run_id)).filter((j) => j.status === "generation_failed");
        await this.queue.requeue_failed(run_id, tx);
        requeued = failed.map((j) => j.lesson_id).filter((x): x is string => x !== null);
      } else if (plan_retry) {
        await this.queue.requeue_failed(run_id, tx); // the failed unit_plan job has no lesson id
      }
      await this.runs.set_state(run_id, d.to_state, null, tx);
      await this.audit.append(
        {
          actor_id: user.user_id, action: `run.${req.action}`, target_kind: "run", target_id: run_id, version_hash: null, reason: null,
          details: { from_state: run.state, to_state: d.to_state, requeued: requeued.length },
          request_id: user.request_id, store_id: null,
        },
        tx,
      );
      return { result: { run_id, state: d.to_state, requeued_lessons: requeued } as RunControlResult, wake: d.requeue_failed || plan_retry };
    });
    if (out.wake && this.extras.notify) await this.extras.notify(run_id); // after COMMIT
    return out.result;
  }
}
