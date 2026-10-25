// NL-78: PgRunProgressReader. One transaction, exactly three SELECTs (invariant: 3 statements, no writes).
import Decimal from "decimal.js";
import type { RunId } from "@ls/core/ports/common";
import type { ProgressJobRow, RunProgressReader, RunProgressRows } from "@ls/core/ports/run-progress";
import type { RunRow } from "@ls/core/ports/runs";
import type { PgDatabase } from "../pool.ts";
import type { PgRepoDeps } from "./audit.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

// Same field mapping as map_run in runs.ts (private there).
function map_run(r: Row): RunRow {
  return {
    run_id: r["id"], unit_id: r["unit_id"], outline_version_id: r["outline_version_id"], kind: r["kind"],
    state: r["state"], prompt_version_id: r["prompt_version_id"], cap_usd: new Decimal(r["cap_usd"]),
    started_by: r["started_by"], parent_run_id: r["parent_run_id"] ?? null, plan_stored_at: r["plan_stored_at"] ?? null,
    paused_check: r["paused_check"] ?? null, capped_by: r["capped_by"] ?? null, choices_hash: r["choices_hash"],
    created_at: r["created_at"], finished_at: r["finished_at"] ?? null,
  };
}

function map_job(r: Row): ProgressJobRow {
  return {
    job_id: r["id"], run_id: r["run_id"], kind: r["kind"], lesson_id: r["lesson_id"] ?? null, status: r["status"],
    tile_state: r["tile_state"], attempt: r["attempt"], queued_at: r["queued_at"], started_at: r["started_at"] ?? null,
    finished_at: r["finished_at"] ?? null, failure_reasons: r["failure_reasons_json"] ?? [], brakes_fired: r["brakes_fired"] ?? [],
    repairs: r["repairs"], truncation_retries: r["truncation_retries"], retries: r["retries"], calls_lost: r["calls_lost"],
    cost_usd: new Decimal(r["cost_usd"]), lesson_title: r["lesson_title"] ?? null, lesson_number: r["lesson_number"] ?? null,
  };
}

export class PgRunProgressReader implements RunProgressReader {
  private readonly db: PgDatabase;

  constructor(deps: PgRepoDeps) {
    this.db = deps.db;
  }

  async progress_rows(run_id: RunId): Promise<RunProgressRows | null> {
    return this.db.with_tx(async (tx) => {
      const run = (
        await tx.query(
          `SELECT r.*,
             (SELECT coalesce(sum(settled_usd),0)::text FROM spend_reservation s WHERE s.run_id = r.id) AS settled_usd,
             (SELECT coalesce(sum(CASE WHEN s.status = 'reserved' THEN s.reserved_usd ELSE 0 END),0)::text
                FROM spend_reservation s WHERE s.run_id = r.id) AS reserved_usd
           FROM run r WHERE r.id = $1`,
          [run_id],
        )
      ).rows[0] as Row | undefined;
      if (!run) return null;
      const jobs = (
        await tx.query(
          `SELECT j.id, j.run_id, j.kind, j.lesson_id, j.status, j.tile_state, j.attempt, j.queued_at, j.started_at, j.finished_at,
             j.failure_reasons_json, j.brakes_fired, j.repairs, j.truncation_retries, j.retries, j.calls_lost, j.cost_usd,
             l.title AS lesson_title, l.number AS lesson_number
           FROM lesson_job j LEFT JOIN lesson l ON l.id = j.lesson_id
           WHERE j.run_id = $1 ORDER BY j.queued_at, j.id`,
          [run_id],
        )
      ).rows as Row[];
      // Claim order is fair-share across runs; "other runs' queued jobs queued before my next queued job" is the FIFO approximation.
      const ahead = (
        await tx.query(
          `WITH mine AS (SELECT queued_at, id FROM lesson_job WHERE run_id = $1 AND status = 'queued' ORDER BY queued_at, id LIMIT 1)
           SELECT count(*)::int AS n
           FROM lesson_job j JOIN run r ON r.id = j.run_id CROSS JOIN mine
           WHERE j.run_id <> $1 AND j.status = 'queued' AND r.state IN ('planning','running')
             AND (j.kind <> 'lesson' OR r.plan_stored_at IS NOT NULL)
             AND (j.queued_at, j.id) < (mine.queued_at, mine.id)`,
          [run_id],
        )
      ).rows[0] as Row | undefined;
      return {
        run: map_run(run), settled_usd: new Decimal(run["settled_usd"]), reserved_usd: new Decimal(run["reserved_usd"]),
        jobs: jobs.map(map_job), queued_ahead: ahead ? Number(ahead["n"]) : 0,
      };
    });
  }
}
