// NL-107 / HP-7: the four fault scenarios. Each makes its own migrated database and seeded 47-lesson run, scripts the stub, and
// returns `actual` built from SQL reads made after the scenario (the stored rows), not from process memory.
import { spawn, type ChildProcess } from "node:child_process";
import { closeSync, mkdirSync, openSync } from "node:fs";
import path from "node:path";
import { ProviderError } from "@ls/core/errors";
import type { JsonValue } from "@ls/core/ports/common";
import type { StubScriptItem } from "@ls/llm/stub";
import { calls_in_status, correlation, duplicate_versions, job_counts, lesson_calls, ready_count, repaid_calls, spend_facts } from "./s6-assertions.ts";
import { make_healthy } from "./s6-drafts.ts";
import { lesson_of, make_world, plan_for, type World } from "./s6-world.ts";

export const CANARY = "sk-FAULT-CANARY-001";
export const LESSONS = 47;
export const KILL_AFTER_READY = 10;
export const TRUNCATED_LESSON = "G6.U4.L4";
const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
export const OUT_DIR = path.join(REPO_ROOT, "ops/faults/out");

export interface ScenarioEnv {
  /** Written into the stub's environment and the worker child's (AC-6); the scenario must never let it reach a log or a row. */
  canary?: string;
}
export interface ScenarioResult { passed: boolean; failure_category: string | null; actual: JsonValue }

const verdict = (checks: Record<string, boolean>, actual: Record<string, JsonValue>): ScenarioResult => {
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  return { passed: failed.length === 0, failure_category: failed.length === 0 ? null : failed.join(","), actual: { ...actual, checks } };
};

async function plain_world(env: Record<string, string> = {}): Promise<World> {
  const w = await make_world({ env: { GENERATION_CONCURRENCY: "4", ...env } });
  w.stub.script("GENERATION", "unit_plan", (req) => plan_for(w.rows, req));
  return w;
}

/** Drives the real claim loop in this process until the run reaches a terminal state. */
async function run_to_end(w: World, run_id: string): Promise<void> {
  if (!(await w.drive_until(() => w.run_finished(run_id), 180_000))) throw new Error("run did not finish");
}

// 429: the first attempt of each of the first 8 lessons is answered rate_limited (retry-after 0), the retry is healthy.
export async function run_rate_limit(): Promise<ScenarioResult> {
  const w = await plain_world();
  try {
    const healthy = make_healthy(w.rows);
    const limited = new Set<string>();
    const script = (req: Parameters<typeof healthy>[0]): StubScriptItem => {
      const id = lesson_of(req);
      if (limited.size < 8 && !limited.has(id)) {
        limited.add(id);
        return { kind: "error", error: new ProviderError({ kind: "rate_limited", http_status: 429, retry_after_s: 0 }) };
      }
      return healthy(req);
    };
    w.stub.script("GENERATION", "lesson_draft", script);
    w.stub.script("REPAIR", "lesson_draft", healthy);
    const run_id = await w.start_all();
    await run_to_end(w, run_id);
    const jobs = await job_counts(w, run_id);
    const [retried] = await w.query<{ n: string; rows: string }>("select coalesce(sum(retries),0) n, count(*) filter (where retries>0) rows from model_call where run_id=$1 and purpose='lesson_draft'", [run_id]);
    const [lost] = await w.query<{ n: string }>(
      `select count(*) n from lesson_job where run_id=$1 and kind='lesson' and failure_reasons_json @> '[{"check":"rate_limited"}]'`, [run_id]);
    const [failed_calls] = await w.query<{ n: string }>("select count(*) n from model_call where run_id=$1 and status='failed'", [run_id]);
    return verdict(
      {
        all_ready: jobs.total === LESSONS && jobs.ready === LESSONS,
        none_not_ready: jobs.not_ready === 0,
        none_lost_to_rate_limit: Number(lost!.n) === 0,
        retries_visible: Number(retried!.rows) === 8 && Number(retried!.n) === 8,
        no_failed_call: Number(failed_calls!.n) === 0,
      },
      { run_id, lessons: jobs.total, ready: jobs.ready, lost_to_rate_limit: Number(lost!.n), rate_limited_first_attempts: 8, calls_with_retries: Number(retried!.rows), retries_recorded: Number(retried!.n) },
    );
  } finally {
    await w.close();
  }
}

// Truncation: one lesson's first draft stops at max_tokens. Variant A: the retry is healthy. Variant B: the retry is truncated too.
async function truncation_variant(second_truncated: boolean): Promise<Record<string, JsonValue> & { run_id: string }> {
  const w = await plain_world();
  try {
    const healthy = make_healthy(w.rows);
    let seen = 0;
    const partial: StubScriptItem = { kind: "text", text: '{"lesson_id":"' + TRUNCATED_LESSON + '","title":"Les', stop_reason: "max_tokens" };
    const script = (req: Parameters<typeof healthy>[0]): StubScriptItem => {
      if (lesson_of(req) !== TRUNCATED_LESSON) return healthy(req);
      seen += 1;
      return seen === 1 || (second_truncated && seen === 2) ? partial : healthy(req);
    };
    w.stub.script("GENERATION", "lesson_draft", script);
    w.stub.script("REPAIR", "lesson_draft", healthy);
    const run_id = await w.start_all();
    await run_to_end(w, run_id);
    const jobs = await job_counts(w, run_id);
    const lc = await lesson_calls(w, run_id, TRUNCATED_LESSON);
    const caps = w.stub.calls.filter((c) => c.alias === "GENERATION" && lesson_of(c) === TRUNCATED_LESSON).map((c) => c.max_output_tokens);
    return {
      run_id, lesson: TRUNCATED_LESSON, model_call_rows: lc.rows, purposes: lc.purposes, stop_reasons: lc.stop_reasons,
      max_output_tokens: caps, lesson_status: lc.status, failure_reason: lc.reason, brakes: lc.brakes,
      others_ready: jobs.ready - (lc.status === "ready" ? 1 : 0), lessons: jobs.total,
    };
  } finally {
    await w.close();
  }
}

export async function run_truncation(): Promise<ScenarioResult> {
  const a = await truncation_variant(false);
  const b = await truncation_variant(true);
  const same = (x: unknown, y: unknown): boolean => JSON.stringify(x) === JSON.stringify(y);
  return verdict(
    {
      a_two_calls: a["model_call_rows"] === 2,
      a_raised_cap_on_retry: same(a["max_output_tokens"], [32000, 48000]),
      a_lesson_ready: a["lesson_status"] === "ready",
      b_two_calls_no_third: b["model_call_rows"] === 2 && same(b["max_output_tokens"], [32000, 48000]),
      b_failed_truncated: b["lesson_status"] === "generation_failed" && b["failure_reason"] === "truncated",
      others_unaffected: a["others_ready"] === LESSONS - 1 && b["others_ready"] === LESSONS - 1,
    },
    { variant_a_once: a, variant_b_twice: b },
  );
}

// Cap: the cap is 60% of the healthy 47-lesson cost (measured from a one-lesson calibration run in the same database).
export async function run_cap(): Promise<ScenarioResult> {
  const w = await plain_world({ GENERATION_CONCURRENCY: "1" }); // one reservation at a time: the ledger reserves far more than a stub call costs
  try {
    const healthy = make_healthy(w.rows);
    w.stub.script("GENERATION", "lesson_draft", healthy);
    w.stub.script("REPAIR", "lesson_draft", healthy);
    const first = w.generatable[0]!.row_number;
    const cal = await w.start_run([first]);
    await run_to_end(w, cal);
    const [c] = await w.query<{ draft: string; plan: string }>(
      `select coalesce(sum(cost_usd) filter (where purpose='lesson_draft'),0)::text draft, coalesce(sum(cost_usd) filter (where purpose='unit_plan'),0)::text plan from model_call where run_id=$1`, [cal]);
    const healthy_total = Number(c!.draft) * LESSONS + Number(c!.plan);
    // 60% of the healthy total: the ledger reserves a worst-case estimate (about 0.33 USD) before each call, so 40% left the unit-plan call itself unaffordable.
    const cap = Math.round(healthy_total * 0.6 * 1e6) / 1e6;
    if (!(cap > 0)) throw new Error("calibration produced no cost");
    const run_id = await w.start_run(w.generatable.map((r) => r.row_number), cap);
    await run_to_end(w, run_id);
    const s = await spend_facts(w, run_id);
    const corr = await correlation(w, run_id);
    const ready = s.by_status["ready"] ?? 0;
    return verdict(
      {
        settled_within_cap: s.settled_usd <= s.cap_usd,
        run_capped: s.run_state === "capped",
        some_lessons_finished: ready >= 1,
        some_lessons_not_started: (s.by_status["cancelled"] ?? 0) >= 1,
        not_started_made_no_call: s.calls_for_unstarted_jobs === 0,
        nothing_left_reserved: s.reserved_open === 0,
        capped_lesson_not_paid: s.paid_for_capped_jobs === 0,
        one_run_id_on_every_row: corr.call_run_mismatches === 0 && corr.jobs > 0 && corr.calls > 0,
      },
      { run_id, cap_usd: s.cap_usd, settled_usd: s.settled_usd, run_state: s.run_state, lessons_by_status: s.by_status, reserved_open: s.reserved_open, capped_jobs: s.capped_jobs, paid_for_capped_jobs: s.paid_for_capped_jobs, jobs: corr.jobs, model_calls: corr.calls },
    );
  } finally {
    await w.close();
  }
}

// ---- kill ----------------------------------------------------------------------------------------------------------------

function spawn_child(name: string, tdb_url: string, w: World, canary: string, log: number, worker_id: string): ChildProcess {
  const env = {
    PATH: process.env["PATH"] ?? "", HOME: process.env["HOME"] ?? "", DATABASE_URL: tdb_url, AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t",
    MODEL_PROVIDER_MODE: "stub", GENERATION_CONCURRENCY: "3", JOB_POLL_MS: "20", JOB_LEASE_MS: "5000", WORKER_ID: worker_id,
    ANTHROPIC_API_KEY: canary, FAULT_OUTLINE_VERSION_ID: w.outline_version_id, FAULT_DRAFT_DELAY_MS: "300", FAULT_CHILD: name,
  };
  return spawn(process.execPath, ["--import", "tsx", path.join(REPO_ROOT, "evals/src/suites/s6-child.ts")], { cwd: REPO_ROOT, env, stdio: ["ignore", log, log] });
}
const exited = (c: ChildProcess): Promise<void> => new Promise((r) => (c.exitCode !== null || c.signalCode !== null ? r() : c.once("exit", () => r())));
async function until(pred: () => Promise<boolean>, timeout_ms: number, what: string): Promise<void> {
  const end = Date.now() + timeout_ms;
  while (Date.now() < end) {
    if (await pred()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("timed out waiting for " + what);
}

export async function run_kill(env: ScenarioEnv = {}): Promise<ScenarioResult> {
  const canary = env.canary ?? CANARY;
  const w = await make_world({ env: { GENERATION_CONCURRENCY: "3", JOB_LEASE_MS: "5000" } });
  mkdirSync(OUT_DIR, { recursive: true });
  const log = openSync(path.join(OUT_DIR, "worker-kill.log"), "w");
  const children: ChildProcess[] = [];
  try {
    const run_id = await w.start_all();
    const first = spawn_child("first", w.tdb.url, w, canary, log, "fault-worker-1");
    children.push(first);
    // At least 10 lessons stored AND a call in flight: the loop works in waves, so the instant the tenth lesson lands can have none.
    await until(async () => (await ready_count(w, run_id)) >= KILL_AFTER_READY && (await calls_in_status(w, run_id, "sent")) >= 1, 120_000, `${KILL_AFTER_READY} stored lessons and a call in flight`);
    first.kill("SIGKILL");
    await exited(first);
    // The process is dead, so these rows no longer change.
    const in_flight = await calls_in_status(w, run_id, "sent");
    const ready_at_kill = await ready_count(w, run_id);
    // Event barrier: the restart's recovery only requeues jobs whose lease has lapsed.
    await until(async () => Number((await w.query<{ n: string }>("select count(*) n from lesson_job where run_id=$1 and status='running' and lease_until > now()", [run_id]))[0]!.n) === 0, 60_000, "leases to lapse");
    const second = spawn_child("second", w.tdb.url, w, canary, log, "fault-worker-2");
    children.push(second);
    await until(() => w.run_finished(run_id), 180_000, "the resumed run to finish");
    second.kill("SIGTERM");
    await exited(second);

    const jobs = await job_counts(w, run_id);
    const dup = await duplicate_versions(w, run_id);
    const repaid = await repaid_calls(w, run_id);
    const lost = await calls_in_status(w, run_id, "lost");
    const [rest] = await w.query<{ n: string }>("select count(*) n from lesson_job where run_id=$1 and kind='lesson' and status in ('queued','running')", [run_id]);
    return verdict(
      {
        killed_at_or_after_threshold: ready_at_kill >= KILL_AFTER_READY,
        calls_in_flight_at_kill: in_flight >= 1,
        all_terminal: jobs.total === LESSONS && Number(rest!.n) === 0,
        all_ready: jobs.ready === LESSONS,
        no_duplicate_versions: dup === 0,
        no_repaid_call: repaid === 0,
        lost_calls_counted_equal_in_flight: lost === in_flight,
      },
      { run_id, lessons: jobs.total, ready: jobs.ready, terminal: jobs.total - Number(rest!.n), duplicates_found: dup, repaid_calls: repaid, kill_threshold: KILL_AFTER_READY, calls_in_flight_at_kill: in_flight, calls_lost_counted: lost, killed_at_or_after_threshold: ready_at_kill >= KILL_AFTER_READY, lost_calls_counted_equal_in_flight: lost === in_flight },
    );
  } finally {
    for (const c of children) if (c.exitCode === null && c.signalCode === null) c.kill("SIGKILL");
    closeSync(log);
    await w.close();
  }
}

export const SCENARIOS = { kill: run_kill, rate_limit: run_rate_limit, truncation: run_truncation, cap: run_cap } as const;
export type ScenarioId = keyof typeof SCENARIOS;

