// NL-97: the expected answer. Every summary field recomputed with SQL over model_call, lesson_job and run.
// Must not import build_summary: the point is an independent derivation from the stored rows.
import Decimal from "decimal.js";
import type { Db } from "../support/db";

export interface Oracle {
  cost_usd: Decimal;
  cost_all_calls: Decimal;
  cost_failed_lessons: Decimal;
  ready: number;
  failed: number;
  work: number;
  retries: number;
  truncation_retries: number;
  repairs: number;
  lost_calls_rows: number;
  calls_lost_in_flight: number;
  brakes_fired: { brake: string; count: number }[];
  failures_by_reason: { reason: string; count: number }[];
  state: string;
}

const byName = <T extends { count: number }>(a: (T & Record<string, string | number>)[], k: string) =>
  [...a].sort((x, y) => (String(x[k]) < String(y[k]) ? -1 : 1));

export async function oracleSummary(db: Db, runId: string): Promise<Oracle> {
  const [c] = await db.query<{ cost: string; retries: string; trunc: number; repairs: number; lost: number }>(
    `select coalesce(sum(cost_usd),0)::text cost, coalesce(sum(retries),0)::text retries,
            (count(*) filter (where purpose='truncation_retry'))::int trunc, (count(*) filter (where purpose='repair'))::int repairs,
            (count(*) filter (where status='lost'))::int lost from model_call where run_id=$1`, [runId]);
  const [j] = await db.query<{ ready: number; failed: number; work: number; lost: string }>(
    `select (count(*) filter (where status='ready'))::int ready,
            (count(*) filter (where status in ('generation_failed','cancelled')))::int failed,
            count(*)::int work, coalesce(sum(calls_lost),0)::text lost
       from lesson_job where run_id=$1 and kind in ('lesson','candidate')`, [runId]);
  const [f] = await db.query<{ cost: string }>(
    `select coalesce(sum(m.cost_usd),0)::text cost from model_call m join lesson_job j on j.id=m.job_id
      where m.run_id=$1 and j.kind in ('lesson','candidate') and j.status in ('generation_failed','cancelled')`, [runId]);
  const brakes = await db.query<{ brake: string; count: number }>(
    `select b brake, count(*)::int count from lesson_job j, jsonb_array_elements_text(j.brakes_fired::jsonb) b where j.run_id=$1 group by b`, [runId]);
  const reasons = await db.query<{ reason: string; count: number }>(
    `select reason, count(*)::int count from (
        select distinct j.id, r->>'check' reason from lesson_job j, jsonb_array_elements(j.failure_reasons_json::jsonb) r
         where j.run_id=$1 and j.kind in ('lesson','candidate') and j.status in ('generation_failed','cancelled')) x group by reason`, [runId]);
  const [r] = await db.query<{ state: string }>("select state from run where id=$1", [runId]);
  return {
    cost_usd: new Decimal(c!.cost), cost_all_calls: new Decimal(c!.cost), cost_failed_lessons: new Decimal(f!.cost),
    ready: j!.ready, failed: j!.failed, work: j!.work, retries: Number(c!.retries), truncation_retries: c!.trunc, repairs: c!.repairs,
    lost_calls_rows: c!.lost, calls_lost_in_flight: Number(j!.lost),
    brakes_fired: byName(brakes, "brake"), failures_by_reason: byName(reasons, "reason"), state: r!.state,
  };
}
