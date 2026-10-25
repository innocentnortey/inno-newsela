// NL-49
import { InvariantViolation } from "@ls/core/errors";
import type { Clock } from "@ls/core/ports/clock";
import type {
  EvalCaseResultRecord,
  EvalRunRow,
  EvidenceRepo,
  ExperimentRunRecord,
  NewEvalRun,
  OpsEventRecord,
  ProbeRunRecord,
} from "@ls/core/ports/evidence";
import type { IdGenerator } from "@ls/core/ports/ids";
import { record_ops_event } from "../ops-event.ts";
import type { PgDatabase } from "../pool.ts";
import type { PgRepoDeps } from "./audit.ts";

export class PgEvidenceRepo implements EvidenceRepo {
  private readonly db: PgDatabase;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;

  constructor(deps: PgRepoDeps) {
    this.db = deps.db;
    this.ids = deps.ids;
    this.clock = deps.clock;
  }

  async start_eval_run(r: NewEvalRun): Promise<EvalRunRow> {
    const id = this.ids.new_id("ev");
    const started = this.clock.now();
    await this.db.with_tx(async (tx) => {
      await tx.query(
        `INSERT INTO eval_run (id, suite, git_sha, prompt_version_id, models_json, provider_mode, case_set, run_id, started_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)`,
        [id, r.suite, r.git_sha, r.prompt_version_id, JSON.stringify(r.models), r.provider_mode, r.case_set, r.run_id, started],
      );
    });
    return { eval_run_id: id, suite: r.suite, passed: 0, total: 0, report_path: null, started_at: started, finished_at: null };
  }

  async add_case_result(r: EvalCaseResultRecord): Promise<void> {
    await this.db.with_tx(async (tx) => {
      await tx.query(
        `INSERT INTO eval_case_result (eval_run_id, case_id, provenance, source, guards, passed, failure_category, expected_json, actual_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb)`,
        [r.eval_run_id, r.case_id, r.provenance, r.source, r.guards, r.passed, r.failure_category, JSON.stringify(r.expected), JSON.stringify(r.actual)],
      );
    });
  }

  async finish_eval_run(eval_run_id: string, passed: number, total: number, report_path: string): Promise<EvalRunRow> {
    const finished = this.clock.now();
    const row = await this.db.with_tx(async (tx) => {
      const res = await tx.query<{ suite: EvalRunRow["suite"]; started_at: Date }>(
        `UPDATE eval_run SET passed=$2, total=$3, report_path=$4, finished_at=$5 WHERE id=$1 RETURNING suite, started_at`,
        [eval_run_id, passed, total, report_path, finished],
      );
      return res.rows[0];
    });
    if (row === undefined) throw new InvariantViolation("eval run not found", { eval_run_id });
    return { eval_run_id, suite: row.suite, passed, total, report_path, started_at: row.started_at, finished_at: finished };
  }

  async insert_probe_run(p: ProbeRunRecord): Promise<string> {
    await this.db.with_tx(async (tx) => {
      await tx.query(
        `INSERT INTO probe_run (id, kind, users, duration_s, machine, provider_mode, p95_json, error_rate, lost_updates, event_loop_lag_p95_ms, max_db_connections, n)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12)`,
        [p.probe_run_id, p.kind, p.users, p.duration_s, p.machine, p.provider_mode, JSON.stringify(p.p95_ms), p.error_rate, p.lost_updates, p.event_loop_lag_p95_ms, p.max_db_connections, p.n],
      );
    });
    return p.probe_run_id;
  }

  async insert_experiment_run(e: ExperimentRunRecord): Promise<string> {
    await this.db.with_tx(async (tx) => {
      await tx.query(
        `INSERT INTO experiment_run (id, config_json, result_json, report_path) VALUES ($1,$2::jsonb,$3::jsonb,$4)`,
        [e.experiment_id, JSON.stringify(e.config), JSON.stringify(e.result), e.report_path],
      );
    });
    return e.experiment_id;
  }

  async ops_event(e: OpsEventRecord): Promise<string> {
    return record_ops_event(this.db, { kind: e.kind, service: e.service, build_id: e.build_id, details: e.details as Record<string, unknown> });
  }
}
