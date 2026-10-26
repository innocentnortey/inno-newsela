import { InvariantViolation } from "@ls/core/errors";
import type { Clock } from "@ls/core/ports/clock";
import type { CallPurpose, JobId, ModelCallId, RunId } from "@ls/core/ports/common";
import type { IdGenerator } from "@ls/core/ports/ids";
import type {
  ModelCallCompletion, ModelCallLog, ModelCallStart, ProviderErrorRecord, RecordedCall, RunCallTotals,
} from "@ls/core/ports/model-call-log";
import Decimal from "decimal.js";
import type { PgDatabase } from "../pool.ts";
import type { PgRepoDeps } from "./audit.ts";

// Every method runs in its own transaction: the `sent` row is committed before the send.
export class PgModelCallLog implements ModelCallLog {
  private readonly db: PgDatabase;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;

  constructor(deps: PgRepoDeps) {
    this.db = deps.db;
    this.ids = deps.ids;
    this.clock = deps.clock;
  }

  async insert_sent(s: ModelCallStart): Promise<ModelCallId> {
    const id = this.ids.new_id("mc") as ModelCallId;
    await this.db.with_tx((tx) =>
      tx.query(
        `INSERT INTO model_call (id, run_id, lesson_id, job_id, attempt, reservation_id, purpose, alias, requested_model, rendered_prompt, status, retries, request_id, sent_at, experiment_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'sent',0,$11,$12::timestamptz,$13)`,
        [id, s.run_id, s.lesson_id, s.job_id, s.attempt, s.reservation_id, s.purpose, s.alias, s.requested_model, s.rendered_prompt, s.request_id, this.now(), s.experiment_id],
      ),
    );
    return id;
  }

  // Not on the port: the recorder calls it when present.
  async record_retry(id: ModelCallId): Promise<void> {
    await this.db.with_tx((tx) => tx.query(`UPDATE model_call SET retries = retries + 1 WHERE id=$1 AND status='sent'`, [id]));
  }

  async complete(id: ModelCallId, d: ModelCallCompletion): Promise<void> {
    const r = await this.db.with_tx((tx) =>
      tx.query(
        `UPDATE model_call SET status='completed', raw_output=$2, served_model=$3, input_tokens=$4, output_tokens=$5,
           cache_read_tokens=$6, cache_write_tokens=$7, cost_usd=$8, stop_reason=$9, provider_request_id=$10, completed_at=$11::timestamptz
         WHERE id=$1 AND status='sent'`,
        [id, d.raw_output, d.served_model, d.usage.input_tokens, d.usage.output_tokens, d.usage.cache_read_tokens, d.usage.cache_write_tokens,
          d.cost_usd.toFixed(6), d.stop_reason, d.provider_request_id, this.now()],
      ),
    );
    if (r.rowCount !== 1) throw new InvariantViolation("model_call not in sent state", { model_call_id: id });
  }

  async fail(id: ModelCallId, e: ProviderErrorRecord): Promise<void> {
    // e.message is ignored on purpose: no message text is stored.
    const stop_reason = `error:${e.kind}${e.http_status !== null ? `:${e.http_status}` : ""}`;
    const r = await this.db.with_tx((tx) =>
      tx.query(`UPDATE model_call SET status='failed', stop_reason=$2, completed_at=$3::timestamptz WHERE id=$1 AND status='sent'`, [id, stop_reason, this.now()]),
    );
    if (r.rowCount !== 1) throw new InvariantViolation("model_call not in sent state", { model_call_id: id });
  }

  async mark_lost(job_id: JobId): Promise<number> {
    const r = await this.db.with_tx((tx) =>
      tx.query(`UPDATE model_call SET status='lost', completed_at=$2::timestamptz WHERE job_id=$1 AND status='sent'`, [job_id, this.now()]),
    );
    return r.rowCount ?? 0;
  }

  async completed_for(job_id: JobId, purpose: CallPurpose, attempt: number): Promise<RecordedCall | null> {
    const rows = await this.db.with_tx(
      async (tx) =>
        (
          await tx.query<{
            id: string; raw_output: string; stop_reason: string; served_model: string; cost_usd: string; retries: number;
            input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_write_tokens: number;
          }>(
            `SELECT id, raw_output, stop_reason, served_model, cost_usd, retries, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens
             FROM model_call WHERE job_id=$1 AND purpose=$2 AND attempt=$3 AND status='completed' AND raw_output IS NOT NULL
             ORDER BY sent_at DESC, id DESC LIMIT 1`,
            [job_id, purpose, attempt],
          )
        ).rows,
    );
    const r = rows[0];
    if (r === undefined) return null;
    return {
      model_call_id: r.id as ModelCallId, purpose, attempt, raw_output: r.raw_output, stop_reason: r.stop_reason,
      usage: { input_tokens: r.input_tokens, output_tokens: r.output_tokens, cache_read_tokens: r.cache_read_tokens, cache_write_tokens: r.cache_write_tokens },
      cost_usd: new Decimal(r.cost_usd), served_model: r.served_model, retries: r.retries,
    };
  }

  async totals_for_run(run_id: RunId): Promise<RunCallTotals> {
    const rows = await this.db.with_tx(
      async (tx) =>
        (
          await tx.query<{
            calls: number; completed: number; failed: number; lost: number; retries: string; truncation_retries: number; repairs: number;
            cost_usd: string; input_tokens: string; output_tokens: string;
          }>(
            `SELECT count(*)::int AS calls,
               (count(*) FILTER (WHERE status='completed'))::int AS completed,
               (count(*) FILTER (WHERE status='failed'))::int AS failed,
               (count(*) FILTER (WHERE status='lost'))::int AS lost,
               coalesce(sum(retries),0)::text AS retries,
               (count(*) FILTER (WHERE purpose='truncation_retry'))::int AS truncation_retries,
               (count(*) FILTER (WHERE purpose='repair'))::int AS repairs,
               coalesce(sum(cost_usd) FILTER (WHERE status='completed'),0)::text AS cost_usd,
               coalesce(sum(input_tokens) FILTER (WHERE status='completed'),0)::text AS input_tokens,
               coalesce(sum(output_tokens) FILTER (WHERE status='completed'),0)::text AS output_tokens
             FROM model_call WHERE run_id=$1`,
            [run_id],
          )
        ).rows,
    );
    const r = rows[0]!;
    const extra = await this.db.with_tx(async (tx) => ({
      unattributed: (await tx.query<{ c: string }>(
        "SELECT coalesce(sum(cost_usd),0)::text AS c FROM model_call WHERE run_id=$1 AND job_id IS NULL AND status='completed'", [run_id])).rows[0]!.c,
      models: (await tx.query<{ purpose: string; requested_model: string; served_model: string | null }>(
        "SELECT DISTINCT purpose, requested_model, served_model FROM model_call WHERE run_id=$1 AND status='completed' ORDER BY purpose, requested_model", [run_id])).rows,
    }));
    return {
      unattributed_cost_usd: new Decimal(extra.unattributed),
      models_used: extra.models.map((m) => ({ purpose: m.purpose, requested: m.requested_model, served: m.served_model })),
      run_id, calls: r.calls, completed: r.completed, failed: r.failed, lost: r.lost, retries: Number(r.retries),
      truncation_retries: r.truncation_retries, repairs: r.repairs, cost_usd: new Decimal(r.cost_usd),
      input_tokens: Number(r.input_tokens), output_tokens: Number(r.output_tokens),
    };
  }

  private now(): string {
    return this.clock.now().toISOString();
  }
}
