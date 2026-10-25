// NL-107: the SQL reads every fault assertion is built from. Every query is filtered by the scenario's run id (OBS-2).
import type { World } from "./s6-world.ts";

export interface JobCounts { total: number; ready: number; not_ready: number; by_status: Record<string, number> }

export async function job_counts(w: World, run_id: string): Promise<JobCounts> {
  const rows = await w.query<{ status: string; n: string }>("select status, count(*) n from lesson_job where run_id=$1 and kind='lesson' group by 1", [run_id]);
  const by_status = Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
  const total = rows.reduce((s, r) => s + Number(r.n), 0);
  const ready = by_status["ready"] ?? 0;
  return { total, ready, not_ready: total - ready, by_status };
}

export async function ready_count(w: World, run_id: string): Promise<number> {
  return Number((await w.query<{ n: string }>("select count(*) n from lesson_job where run_id=$1 and kind='lesson' and status='ready'", [run_id]))[0]!.n);
}

/** Pairs (lesson, version number) stored more than once. */
export async function duplicate_versions(w: World, run_id: string): Promise<number> {
  const r = await w.query("select lesson_id, number, count(*) from lesson_version where run_id=$1 group by 1,2 having count(*)>1", [run_id]);
  return r.length;
}

/** Calls made again after one for the same job, purpose and attempt had completed (a re-paid call), plus keys with two completions. */
export async function repaid_calls(w: World, run_id: string): Promise<number> {
  const r = await w.query<{ n: string }>(
    `select count(*) n from model_call a join model_call b
       on a.run_id=b.run_id and a.job_id=b.job_id and a.purpose=b.purpose and a.attempt=b.attempt and a.id<>b.id
     where a.run_id=$1 and a.status='completed' and (b.status='completed' or b.sent_at > a.sent_at)`,
    [run_id],
  );
  return Number(r[0]!.n);
}

export async function calls_in_status(w: World, run_id: string, status: string): Promise<number> {
  return Number((await w.query<{ n: string }>("select count(*) n from model_call where run_id=$1 and status=$2", [run_id, status]))[0]!.n);
}

export interface LessonCalls { rows: number; purposes: string[]; stop_reasons: string[]; status: string; reason: string | null; brakes: string[] }

export async function lesson_calls(w: World, run_id: string, lesson_id: string): Promise<LessonCalls> {
  const calls = await w.query<{ purpose: string; stop_reason: string | null }>("select purpose, stop_reason from model_call where run_id=$1 and lesson_id=$2 order by sent_at, id", [run_id, lesson_id]);
  const [job] = await w.query<{ status: string; failure_reasons_json: Array<{ check: string }>; brakes_fired: string[] }>(
    "select status, failure_reasons_json, brakes_fired from lesson_job where run_id=$1 and lesson_id=$2 and kind='lesson'", [run_id, lesson_id]);
  return {
    rows: calls.length, purposes: calls.map((c) => c.purpose), stop_reasons: calls.map((c) => c.stop_reason ?? ""),
    status: job!.status, reason: job!.failure_reasons_json[0]?.check ?? null, brakes: job!.brakes_fired,
  };
}

export interface SpendFacts {
  cap_usd: number; settled_usd: number; run_state: string; reserved_open: number;
  by_status: Record<string, number>; calls_for_unstarted_jobs: number; paid_for_capped_jobs: number; capped_jobs: number;
}

export async function spend_facts(w: World, run_id: string): Promise<SpendFacts> {
  const [run] = await w.query<{ state: string; cap: string }>("select state, cap_usd::text cap from run where id=$1", [run_id]);
  const [s] = await w.query<{ settled: string }>("select coalesce(sum(settled_usd),0)::text settled from spend_reservation where run_id=$1", [run_id]);
  const [open] = await w.query<{ n: string }>("select count(*) n from spend_reservation where run_id=$1 and status='reserved'", [run_id]);
  const jobs = await w.query<{ status: string; n: string }>("select status, count(*) n from lesson_job where run_id=$1 and kind='lesson' group by 1", [run_id]);
  const [unstarted] = await w.query<{ n: string }>(
    `select count(*) n from model_call c join lesson_job j on j.id=c.job_id where c.run_id=$1 and j.status='cancelled'`, [run_id]);
  const [capped] = await w.query<{ n: string; paid: string }>(
    `select count(distinct j.id) n, coalesce(sum(r.settled_usd),0)::text paid from lesson_job j left join spend_reservation r on r.job_id=j.id
       where j.run_id=$1 and j.kind='lesson' and j.brakes_fired ? 'spend_run_cap'`, [run_id]);
  return {
    cap_usd: Number(run!.cap), settled_usd: Number(s!.settled), run_state: run!.state, reserved_open: Number(open!.n),
    by_status: Object.fromEntries(jobs.map((j) => [j.status, Number(j.n)])),
    calls_for_unstarted_jobs: Number(unstarted!.n), paid_for_capped_jobs: Number(capped!.paid), capped_jobs: Number(capped!.n),
  };
}

/** The correlation facts of OBS-2 / R-48: every job and model call of the run carries the run id; none is missing it. */
export async function correlation(w: World, run_id: string): Promise<{ jobs: number; calls: number; calls_without_run: number; call_run_mismatches: number }> {
  const [j] = await w.query<{ n: string }>("select count(*) n from lesson_job where run_id=$1", [run_id]);
  const [c] = await w.query<{ n: string }>("select count(*) n from model_call where run_id=$1", [run_id]);
  const [x] = await w.query<{ n: string }>("select count(*) n from model_call where run_id is null", []);
  const [m] = await w.query<{ n: string }>("select count(*) n from model_call c join lesson_job j on j.id=c.job_id where j.run_id=$1 and c.run_id is distinct from $1", [run_id]);
  return { jobs: Number(j!.n), calls: Number(c!.n), calls_without_run: Number(x!.n), call_run_mismatches: Number(m!.n) };
}
