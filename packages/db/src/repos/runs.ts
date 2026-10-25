// NL-27: PgRunRepo — run rows, the unit plan, and the run-level transitions (DO-4 section 3.5).
import Decimal from "decimal.js";
import { DomainRefusal, InvariantViolation } from "@ls/core/errors";
import type { Clock } from "@ls/core/ports/clock";
import type { CapName, ModelCallId, RunId, RunStateName, UserId } from "@ls/core/ports/common";
import type { IdGenerator } from "@ls/core/ports/ids";
import type { JobRow } from "@ls/core/ports/job-queue";
import type { IntakeChoiceRow, LessonLinkRecord } from "@ls/core/ports/outlines";
import type { NewRun, RunRepo, RunRow, RunSummaryRows, UnitPlanRow } from "@ls/core/ports/runs";
import type { Tx } from "@ls/core/ports/tx";
import { IntakeChoiceRow as IntakeChoiceRowSchema } from "@ls/schema/outline";
import { UnitPlanDraft } from "@ls/schema/unit-plan";
import type { PgDatabase } from "../pool.ts";
import { Tx as DbTx } from "../tx.ts";
import type { PgRepoDeps } from "./audit.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- pg rows are untyped; every field is read through a mapper
type Row = Record<string, any>;

const TERMINAL = new Set<RunStateName>(["complete", "partial", "capped", "cancelled"]);
const IDEMPOTENCY_WINDOW_H_DEFAULT = 24;
const HOUR_MS = 3_600_000;

function assert_tx(tx: Tx): DbTx {
  if (!(tx instanceof DbTx)) throw new InvariantViolation("run repo needs a real transaction");
  return tx;
}

function map_run(r: Row): RunRow {
  return {
    run_id: r["id"], unit_id: r["unit_id"], outline_version_id: r["outline_version_id"], kind: r["kind"],
    state: r["state"], prompt_version_id: r["prompt_version_id"], cap_usd: new Decimal(r["cap_usd"]),
    started_by: r["started_by"], parent_run_id: r["parent_run_id"] ?? null, plan_stored_at: r["plan_stored_at"] ?? null,
    paused_check: r["paused_check"] ?? null, capped_by: r["capped_by"] ?? null, choices_hash: r["choices_hash"],
    created_at: r["created_at"], finished_at: r["finished_at"] ?? null,
  };
}

function map_job(r: Row): JobRow {
  return {
    job_id: r["id"], run_id: r["run_id"], kind: r["kind"], lesson_id: r["lesson_id"] ?? null, status: r["status"],
    tile_state: r["tile_state"], attempt: r["attempt"], queued_at: r["queued_at"], started_at: r["started_at"] ?? null,
    finished_at: r["finished_at"] ?? null, failure_reasons: r["failure_reasons_json"] ?? [], brakes_fired: r["brakes_fired"] ?? [],
    repairs: r["repairs"], truncation_retries: r["truncation_retries"], retries: r["retries"], calls_lost: r["calls_lost"],
    cost_usd: new Decimal(r["cost_usd"]),
  };
}

export class PgRunRepo implements RunRepo {
  private readonly db: PgDatabase;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;
  private readonly window_h: number;

  // `idempotency_window_h`: how long a key holds a run (NL-78's wiring passes settings.idempotency_window_h).
  constructor(deps: PgRepoDeps, opts: { idempotency_window_h?: number } = {}) {
    this.db = deps.db;
    this.ids = deps.ids;
    this.clock = deps.clock;
    this.window_h = opts.idempotency_window_h ?? IDEMPOTENCY_WINDOW_H_DEFAULT;
  }

  async insert_run(run: NewRun, tx: Tx): Promise<RunRow> {
    const t = assert_tx(tx);
    const run_id = this.ids.new_id("run");
    const now = this.clock.now();
    const scope_json = {
      kind: run.parent_run_id ? "unfinished_of_run" : run.scope_rows ? "rows" : "all",
      rows: run.scope_rows,
      run_id: run.parent_run_id,
    };
    if (run.idempotency_key !== null) {
      // An expired holder of the key gives it up (the table has no time window in its unique constraint).
      const cutoff = new Date(now.getTime() - this.window_h * HOUR_MS);
      await t.query(
        `UPDATE run SET idempotency_key = idempotency_key || '~' || id
         WHERE started_by = $1 AND idempotency_key = $2 AND created_at <= $3::timestamptz`,
        [run.started_by, run.idempotency_key, cutoff.toISOString()],
      );
    }
    const res = await t.query(
      `INSERT INTO run (id, unit_id, outline_version_id, kind, state, scope_json, parent_run_id, prompt_version_id,
                        choices_json, choices_hash, cap_usd, idempotency_key, started_by, created_at, eval_run_id)
       VALUES ($1,$2,$3,$4,'planning',$5::jsonb,$6,$7,$8::jsonb,$9,$10,$11,$12,$13::timestamptz,$14) RETURNING *`,
      [
        run_id, run.unit_id, run.outline_version_id, run.kind, JSON.stringify(scope_json), run.parent_run_id,
        run.prompt_version_id, JSON.stringify(run.choices), run.choices_hash, run.cap_usd.toFixed(6),
        run.idempotency_key ?? run_id, run.started_by, now.toISOString(), run.eval_run_id,
      ],
    );
    if (run.kind !== "trial") {
      await t.query(`INSERT INTO unit_plan (run_id, state, lesson_links_json) VALUES ($1,'planning',$2::jsonb)`, [
        run_id, JSON.stringify(run.lesson_links),
      ]);
    }
    // Postgres delivers a NOTIFY at COMMIT, so workers wake only once the jobs are visible.
    await t.query(`SELECT pg_notify('lesson_job', $1)`, [run_id]);
    return map_run(res.rows[0] as Row);
  }

  async get(run_id: RunId): Promise<RunRow | null> {
    const rows = await this.db.with_tx(async (tx) => (await tx.query("SELECT * FROM run WHERE id = $1", [run_id])).rows);
    return rows[0] ? map_run(rows[0]) : null;
  }

  async find_by_idempotency_key(user_id: UserId, key: string, within_hours: number): Promise<RunRow | null> {
    const since = new Date(this.clock.now().getTime() - within_hours * HOUR_MS);
    const rows = await this.db.with_tx(
      async (tx) =>
        (
          await tx.query(
            `SELECT * FROM run WHERE started_by = $1 AND idempotency_key = $2 AND created_at > $3::timestamptz
             ORDER BY created_at DESC, id DESC LIMIT 1`,
            [user_id, key, since.toISOString()],
          )
        ).rows,
    );
    return rows[0] ? map_run(rows[0]) : null;
  }

  async lock_for_update(run_id: RunId, tx: Tx): Promise<RunRow> {
    const res = await assert_tx(tx).query("SELECT * FROM run WHERE id = $1 FOR UPDATE", [run_id]);
    if (!res.rows[0]) throw new DomainRefusal("NOT_FOUND", "Run not found.");
    return map_run(res.rows[0]);
  }

  async set_state(run_id: RunId, state: RunStateName, paused_check: string | null, tx: Tx): Promise<RunRow> {
    const now = this.clock.now();
    const res = await assert_tx(tx).query(
      `UPDATE run SET state = $2, paused_check = $3, finished_at = $4::timestamptz WHERE id = $1 RETURNING *`,
      [run_id, state, paused_check, TERMINAL.has(state) ? now.toISOString() : null],
    );
    if (!res.rows[0]) throw new DomainRefusal("NOT_FOUND", "Run not found.");
    return map_run(res.rows[0]);
  }

  async mark_capped(run_id: RunId, capped_by: CapName, tx: Tx): Promise<RunRow> {
    const res = await assert_tx(tx).query(
      `UPDATE run SET state = 'capped', capped_by = $2, finished_at = $3::timestamptz WHERE id = $1 RETURNING *`,
      [run_id, capped_by, this.clock.now().toISOString()],
    );
    if (!res.rows[0]) throw new DomainRefusal("NOT_FOUND", "Run not found.");
    return map_run(res.rows[0]);
  }

  async pinned_choices(run_id: RunId): Promise<IntakeChoiceRow[]> {
    const rows = await this.db.with_tx(async (tx) => (await tx.query("SELECT choices_json FROM run WHERE id = $1", [run_id])).rows);
    if (!rows[0]) throw new DomainRefusal("NOT_FOUND", "Run not found.");
    const json = rows[0]["choices_json"] as unknown[];
    return json.map((c) => IntakeChoiceRowSchema.parse(c));
  }

  async mark_plan_failed(run_id: RunId, tx: Tx): Promise<RunRow> {
    const t = assert_tx(tx);
    await t.query("UPDATE unit_plan SET state = 'failed' WHERE run_id = $1", [run_id]);
    const res = await t.query(
      `UPDATE run SET state = 'paused', paused_check = 'unit_plan', finished_at = NULL WHERE id = $1 RETURNING *`,
      [run_id],
    );
    if (!res.rows[0]) throw new DomainRefusal("NOT_FOUND", "Run not found.");
    return map_run(res.rows[0]);
  }

  async store_unit_plan(run_id: RunId, plan: UnitPlanDraft, model_call_id: ModelCallId): Promise<UnitPlanRow> {
    const now = this.clock.now().toISOString();
    const row = await this.db.with_tx(async (tx) => {
      const res = await tx.query(
        `UPDATE unit_plan SET entries_json = $2::jsonb, state = 'stored', model_call_id = $3, stored_at = $4::timestamptz
         WHERE run_id = $1 RETURNING *`,
        [run_id, JSON.stringify(plan), model_call_id, now],
      );
      if (!res.rows[0]) throw new DomainRefusal("NOT_FOUND", "Unit plan not found.");
      // A run cancelled meanwhile stays cancelled; the plan is still kept.
      await tx.query(
        `UPDATE run SET plan_stored_at = $2::timestamptz, state = 'running', paused_check = NULL
         WHERE id = $1 AND state IN ('planning','paused')`,
        [run_id, now],
      );
      return res.rows[0] as Row;
    });
    return this.map_plan(row);
  }

  async unit_plan(run_id: RunId): Promise<UnitPlanRow | null> {
    const rows = await this.db.with_tx(async (tx) => (await tx.query("SELECT * FROM unit_plan WHERE run_id = $1", [run_id])).rows);
    return rows[0] ? this.map_plan(rows[0]) : null;
  }

  async summary_rows(run_id: RunId): Promise<RunSummaryRows> {
    return this.db.with_tx(async (tx) => {
      const run_res = await tx.query("SELECT * FROM run WHERE id = $1", [run_id]);
      if (!run_res.rows[0]) throw new DomainRefusal("NOT_FOUND", "Run not found.");
      const jobs = (await tx.query("SELECT * FROM lesson_job WHERE run_id = $1 ORDER BY queued_at, id", [run_id])).rows.map(map_job);
      const c = (
        await tx.query(
          `SELECT count(*)::int AS calls,
                  (count(*) FILTER (WHERE status = 'completed'))::int AS completed,
                  (count(*) FILTER (WHERE status = 'failed'))::int AS failed,
                  (count(*) FILTER (WHERE status = 'lost'))::int AS lost,
                  coalesce(sum(retries), 0)::int AS retries,
                  (count(*) FILTER (WHERE purpose = 'truncation_retry'))::int AS truncation_retries,
                  (count(*) FILTER (WHERE purpose = 'repair'))::int AS repairs,
                  coalesce(sum(cost_usd), 0)::text AS cost_usd,
                  coalesce(sum(input_tokens), 0)::bigint::text AS input_tokens,
                  coalesce(sum(output_tokens), 0)::bigint::text AS output_tokens
           FROM model_call WHERE run_id = $1`,
          [run_id],
        )
      ).rows[0] as Row;
      const placeholders = (
        await tx.query(
          `SELECT count(*)::int AS n FROM issue
           WHERE kind IN ('quote_placeholder_open','excerpt_slot_open') AND resolved_at IS NULL AND cleared_by IS NULL
             AND lesson_id IN (SELECT lesson_id FROM lesson_job WHERE run_id = $1 AND lesson_id IS NOT NULL)`,
          [run_id],
        )
      ).rows[0] as Row;
      const report = (
        await tx.query(`SELECT report_path FROM eval_run WHERE id = (SELECT eval_run_id FROM run WHERE id = $1)`, [run_id])
      ).rows[0] as Row | undefined;
      return {
        run: map_run(run_res.rows[0] as Row),
        jobs,
        calls: {
          run_id, calls: c["calls"], completed: c["completed"], failed: c["failed"], lost: c["lost"], retries: c["retries"],
          truncation_retries: c["truncation_retries"], repairs: c["repairs"], cost_usd: new Decimal(c["cost_usd"]),
          input_tokens: Number(c["input_tokens"]), output_tokens: Number(c["output_tokens"]),
        },
        placeholders_left: placeholders["n"],
        report_path: (report?.["report_path"] as string | null | undefined) ?? null,
      };
    });
  }

  async active_runs(): Promise<RunRow[]> {
    const rows = await this.db.with_tx(
      async (tx) => (await tx.query("SELECT * FROM run WHERE state IN ('planning','running') ORDER BY created_at, id")).rows,
    );
    return rows.map(map_run);
  }

  private map_plan(r: Row): UnitPlanRow {
    return {
      run_id: r["run_id"], state: r["state"],
      plan: r["entries_json"] ? UnitPlanDraft.parse(r["entries_json"]) : null,
      lesson_links: (r["lesson_links_json"] ?? []) as LessonLinkRecord[],
      model_call_id: r["model_call_id"] ?? null, stored_at: r["stored_at"] ?? null,
    };
  }
}
