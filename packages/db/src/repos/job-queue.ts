import Decimal from "decimal.js";
import type { Clock } from "@ls/core/ports/clock";
import type { IdGenerator } from "@ls/core/ports/ids";
import type { Tx } from "@ls/core/ports/tx";
import type { JobId, RunId } from "@ls/core/ports/common";
import type { ClaimedJob, JobOutcome, JobQueue, JobRow, NewJob, RequeueReport } from "@ls/core/ports/job-queue";
import { DomainRefusal, InvariantViolation } from "@ls/core/errors";
import type { TileState } from "@ls/schema/api/runs";
import type { PgDatabase } from "../pool.ts";
import { Tx as DbTx } from "../tx.ts";
import type { PgRepoDeps } from "./audit.ts";

// lesson_job has no schema_version column; run.choices_json may pin one (NL-27), else this.
export const SCHEMA_VERSION_DEFAULT = 1;

function db_tx(tx: Tx): DbTx {
  if (!(tx instanceof DbTx)) throw new InvariantViolation("job queue needs a real transaction");
  return tx;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- pg rows are untyped
function to_job_row(r: Record<string, any>): JobRow {
  return {
    job_id: r["id"], run_id: r["run_id"], kind: r["kind"], lesson_id: r["lesson_id"], status: r["status"],
    tile_state: r["tile_state"], attempt: r["attempt"], queued_at: r["queued_at"], started_at: r["started_at"],
    finished_at: r["finished_at"], failure_reasons: r["failure_reasons_json"], brakes_fired: r["brakes_fired"],
    repairs: r["repairs"], truncation_retries: r["truncation_retries"], retries: r["retries"],
    calls_lost: r["calls_lost"], cost_usd: new Decimal(r["cost_usd"]), reviewer_note: r["reviewer_note"] ?? null,
  };
}

const JOB_COLUMNS = `id, run_id, kind, lesson_id, status, tile_state, attempt, queued_at, started_at, finished_at,
  failure_reasons_json, brakes_fired, repairs, truncation_retries, retries, calls_lost, cost_usd, reviewer_note`;

const CLAIM_SQL = `
WITH active AS (
  SELECT id, created_at FROM run
   WHERE state IN ('planning','running')
     AND EXISTS (SELECT 1 FROM lesson_job q WHERE q.run_id = run.id AND q.status IN ('queued','running'))
   ORDER BY created_at, id LIMIT $1
), load AS (
  SELECT run_id, count(*) AS n FROM lesson_job WHERE status='running' AND run_id IN (SELECT id FROM active) GROUP BY run_id
), pick AS (
  SELECT j.id FROM lesson_job j
  JOIN active a ON a.id = j.run_id
  JOIN run r ON r.id = j.run_id
  LEFT JOIN load l ON l.run_id = j.run_id
  WHERE j.status = 'queued' AND (j.kind <> 'lesson' OR r.plan_stored_at IS NOT NULL)
  ORDER BY coalesce(l.n,0), a.created_at, a.id, j.queued_at, j.id
  LIMIT 1
  FOR UPDATE OF j SKIP LOCKED
)
UPDATE lesson_job j SET status='running', attempt=j.attempt+1, worker_id=$2,
  lease_until=$3::timestamptz + ($4::int * interval '1 millisecond'),
  started_at=coalesce(j.started_at,$3::timestamptz),
  tile_state = CASE WHEN j.kind='unit_plan' THEN 'planning' ELSE 'drafting' END
FROM pick, run r WHERE j.id = pick.id AND r.id = j.run_id
RETURNING j.id, j.run_id, j.kind, j.lesson_id, j.attempt, j.lease_until, j.idempotency_key, j.reviewer_note,
  r.unit_id, r.prompt_version_id, r.outline_version_id, r.started_by, r.choices_json->>'schema_version' AS schema_version`;

export class PgJobQueue implements JobQueue {
  private readonly db: PgDatabase;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;

  constructor(deps: PgRepoDeps) {
    this.db = deps.db;
    this.ids = deps.ids;
    this.clock = deps.clock;
  }

  private now(): string {
    return this.clock.now().toISOString();
  }

  // lesson_job has no unique index on idempotency_key, so a per-run advisory lock plus NOT EXISTS
  // stands in for ON CONFLICT DO NOTHING. priority has no column and is ignored.
  async create_run_jobs(jobs: readonly NewJob[], tx: Tx): Promise<number> {
    const t = db_tx(tx);
    if (jobs.length === 0) return 0;
    for (const run_id of [...new Set(jobs.map((j) => j.run_id))].sort())
      await t.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`lesson_job_create:${run_id}`]);
    const r = await t.query(
      `INSERT INTO lesson_job (id, run_id, kind, lesson_id, idempotency_key, status, tile_state, queued_at, reviewer_note)
       SELECT u.id, u.run_id, u.kind, u.lesson_id, u.key, 'queued', 'queued', $7::timestamptz, u.note
       FROM (SELECT DISTINCT ON (key) * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[])
               AS t(id, run_id, kind, lesson_id, key, note) ORDER BY key) u
       WHERE NOT EXISTS (SELECT 1 FROM lesson_job x WHERE x.idempotency_key = u.key)`,
      [
        jobs.map(() => this.ids.new_id("job")), jobs.map((j) => j.run_id), jobs.map((j) => j.kind),
        jobs.map((j) => j.lesson_id), jobs.map((j) => j.idempotency_key), jobs.map((j) => j.reviewer_note),
        this.now(),
      ],
    );
    return r.rowCount;
  }

  async create_candidate_job(job: NewJob, tx: Tx): Promise<JobRow> {
    const t = db_tx(tx);
    try {
      const r = await t.query(
        `INSERT INTO lesson_job (id, run_id, kind, lesson_id, idempotency_key, status, tile_state, queued_at, reviewer_note)
         VALUES ($1, $2, 'candidate', $3, $4, 'queued', 'queued', $5::timestamptz, $6) RETURNING ${JOB_COLUMNS}`,
        [this.ids.new_id("job"), job.run_id, job.lesson_id, job.idempotency_key, this.now(), job.reviewer_note],
      );
      return to_job_row(r.rows[0]!);
    } catch (err) {
      const e = err as { code?: string; constraint?: string };
      if (e.code === "23505" && e.constraint === "lesson_job_one_candidate")
        throw new DomainRefusal("INVALID_TRANSITION", "candidate job already in flight", {
          reason: "candidate_in_flight", lesson_id: job.lesson_id,
        });
      throw err;
    }
  }

  async claim(worker_id: string, max_active_runs: number, lease_ms: number): Promise<ClaimedJob | null> {
    return this.db.with_tx(async (tx) => {
      const r = await tx.query(CLAIM_SQL, [max_active_runs, worker_id, this.now(), lease_ms]);
      const c = r.rows[0];
      if (c === undefined) return null;
      const sv = c["schema_version"] === null ? NaN : Number(c["schema_version"]);
      return {
        job_id: c["id"], run_id: c["run_id"], unit_id: c["unit_id"], kind: c["kind"], lesson_id: c["lesson_id"],
        attempt: c["attempt"], lease_until: c["lease_until"], prompt_version_id: c["prompt_version_id"],
        schema_version: Number.isInteger(sv) ? sv : SCHEMA_VERSION_DEFAULT,
        outline_version_id: c["outline_version_id"], started_by: c["started_by"],
        idempotency_key: c["idempotency_key"], reviewer_note: c["reviewer_note"],
      } as ClaimedJob;
    });
  }

  async renew_lease(job_id: JobId, lease_ms: number): Promise<boolean> {
    return this.db.with_tx(async (tx) => {
      const r = await tx.query(
        `UPDATE lesson_job SET lease_until = $2::timestamptz + ($3::int * interval '1 millisecond')
         WHERE id = $1 AND status = 'running' AND lease_until >= $2::timestamptz`,
        [job_id, this.now(), lease_ms],
      );
      return r.rowCount === 1;
    });
  }

  async set_tile_state(job_id: JobId, tile_state: TileState): Promise<void> {
    await this.db.with_tx((tx) => tx.query("UPDATE lesson_job SET tile_state = $2 WHERE id = $1", [job_id, tile_state]));
  }

  // calls_lost comes from model_call (the DB count is the truth); version_id belongs to NL-30.
  async finish(o: JobOutcome): Promise<void> {
    await this.db.with_tx((tx) =>
      tx.query(
        `UPDATE lesson_job SET status = $2, tile_state = $3, failure_reasons_json = $4::jsonb, brakes_fired = $5::jsonb,
           repairs = $6, truncation_retries = $7, retries = $8, cost_usd = $9::numeric, finished_at = $10::timestamptz,
           calls_lost = (SELECT count(*)::int FROM model_call WHERE job_id = lesson_job.id AND status = 'lost'),
           lease_until = NULL
         WHERE id = $1 AND status = 'running'`,
        [
          o.job_id, o.status, o.tile_state, JSON.stringify(o.failure_reasons), JSON.stringify(o.brakes_fired),
          o.repairs, o.truncation_retries, o.retries, o.cost_usd.toFixed(6), this.now(),
        ],
      ),
    );
  }

  async requeue_expired(now: Date): Promise<RequeueReport> {
    return this.db.with_tx(async (tx) => {
      const r = await tx.query(
        `UPDATE lesson_job SET status = 'queued', worker_id = NULL, lease_until = NULL, tile_state = 'queued'
         WHERE status = 'running' AND lease_until < $1::timestamptz RETURNING id`,
        [now.toISOString()],
      );
      return { requeued: r.rows.length, job_ids: r.rows.map((x) => x["id"] as JobId) };
    });
  }

  async requeue_failed(run_id: RunId, tx: Tx): Promise<number> {
    const r = await db_tx(tx).query(
      `UPDATE lesson_job SET status = 'queued', tile_state = 'queued', failure_reasons_json = '[]', brakes_fired = '[]',
         finished_at = NULL, worker_id = NULL, lease_until = NULL, queued_at = $2::timestamptz
       WHERE run_id = $1 AND status = 'generation_failed'`,
      [run_id, this.now()],
    );
    return r.rowCount;
  }

  async cancel_run(run_id: RunId, reason: "cancelled" | "capped", tx: Tx): Promise<number> {
    const r = await db_tx(tx).query(
      `UPDATE lesson_job SET status = 'cancelled', tile_state = 'failed',
         failure_reasons_json = jsonb_build_array(jsonb_build_object('check', $2::text)), finished_at = $3::timestamptz
       WHERE run_id = $1 AND status = 'queued'`,
      [run_id, reason, this.now()],
    );
    return r.rowCount;
  }

  async jobs_for_run(run_id: RunId): Promise<JobRow[]> {
    return this.db.with_tx(async (tx) => {
      const r = await tx.query(`SELECT ${JOB_COLUMNS} FROM lesson_job WHERE run_id = $1 ORDER BY queued_at, id`, [run_id]);
      return r.rows.map(to_job_row);
    });
  }

  async is_cancelled(job_id: JobId): Promise<boolean> {
    return this.db.with_tx(async (tx) => {
      const r = await tx.query(
        "SELECT (j.status = 'cancelled' OR r.state = 'cancelled') AS c FROM lesson_job j JOIN run r ON r.id = j.run_id WHERE j.id = $1",
        [job_id],
      );
      if (r.rows[0] === undefined) throw new InvariantViolation("unknown job id", { job_id });
      return r.rows[0]["c"] === true;
    });
  }
}
