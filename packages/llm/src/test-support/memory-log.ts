// NL-33 frozen test double: in-memory ModelCallLog that mirrors the model_call row shape.
import type { JobId, ModelCallId, RunId } from "@ls/core/ports/common";
import type {
  ModelCallCompletion, ModelCallLog, ModelCallStart, ProviderErrorRecord, RecordedCall, RunCallTotals,
} from "@ls/core/ports/model-call-log";
import type { CallPurpose } from "@ls/core/ports/common";
import Decimal from "decimal.js";

export interface MemoryRow extends ModelCallStart {
  id: ModelCallId;
  status: "sent" | "completed" | "failed" | "lost";
  retries: number;
  raw_output: string | null;
  served_model: string | null;
  stop_reason: string | null;
  cost_usd: Decimal | null;
  usage: ModelCallCompletion["usage"] | null;
}

export class MemoryModelCallLog implements ModelCallLog {
  readonly rows = new Map<string, MemoryRow>();
  private n = 0;

  async insert_sent(s: ModelCallStart): Promise<ModelCallId> {
    const id = `mc_${++this.n}`;
    this.rows.set(id, { ...s, id, status: "sent", retries: 0, raw_output: null, served_model: null, stop_reason: null, cost_usd: null, usage: null });
    return id;
  }
  async record_retry(id: ModelCallId): Promise<void> {
    this.row(id).retries += 1;
  }
  async complete(id: ModelCallId, d: ModelCallCompletion): Promise<void> {
    Object.assign(this.row(id), { status: "completed", raw_output: d.raw_output, stop_reason: d.stop_reason, usage: d.usage, cost_usd: d.cost_usd, served_model: d.served_model });
  }
  async fail(id: ModelCallId, e: ProviderErrorRecord): Promise<void> {
    Object.assign(this.row(id), { status: "failed", stop_reason: `error:${e.kind}${e.http_status !== null ? `:${e.http_status}` : ""}` });
  }
  async mark_lost(job_id: JobId): Promise<number> {
    let n = 0;
    for (const r of this.rows.values()) if (r.job_id === job_id && r.status === "sent") { r.status = "lost"; n++; }
    return n;
  }
  async completed_for(job_id: JobId, purpose: CallPurpose, attempt: number): Promise<RecordedCall | null> {
    for (const r of this.rows.values()) {
      if (r.job_id === job_id && r.purpose === purpose && r.attempt === attempt && r.status === "completed" && r.raw_output !== null && r.usage !== null && r.cost_usd !== null && r.served_model !== null && r.stop_reason !== null) {
        return { model_call_id: r.id, purpose, attempt, raw_output: r.raw_output, stop_reason: r.stop_reason, usage: r.usage, cost_usd: r.cost_usd, served_model: r.served_model, retries: r.retries };
      }
    }
    return null;
  }
  async totals_for_run(_run_id: RunId): Promise<RunCallTotals> {
    throw new Error("not needed by the recorder tests");
  }
  private row(id: string): MemoryRow {
    const r = this.rows.get(id);
    if (r === undefined) throw new Error(`no row ${id}`);
    return r;
  }
}
