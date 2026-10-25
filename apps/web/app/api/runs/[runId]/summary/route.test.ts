// @vitest-environment node
// NL-78: getRunSummary against a real test database.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { body_of, call, make_run_kit, seed_call, seed_lessons, seed_reservation, seed_stub_run, set_job, type RunKit } from "@/server/services/testing/run-read-harness";

let t: TestDb;
let kit: RunKit;
const q = <T>(fn: (tx: Parameters<typeof seed_lessons>[0]) => Promise<T>): Promise<T> => t.db.with_tx(async (tx) => fn(tx));
const T0 = new Date("2026-10-25T10:00:00.000Z");

beforeAll(async () => {
  t = await create_test_db();
  kit = make_run_kit(t);
  await q((tx) => seed_lessons(tx, 3));
});
afterAll(async () => {
  await t.drop();
});

async function seed_summary_run(settled: string | null) {
  const s = await q((tx) => seed_stub_run(tx, { state: "partial", statuses: ["ready", "ready", "generation_failed"] }));
  await q(async (tx) => {
    const m = (min: number) => ({ started_at: T0, finished_at: new Date(T0.getTime() + min * 60000) });
    await set_job(tx, s.jobs[0]!, { ...m(2), cost_usd: "0.5" });
    await set_job(tx, s.jobs[1]!, { ...m(4), cost_usd: "0.7", brakes_fired: ["truncation_retry"] });
    await set_job(tx, s.jobs[2]!, { ...m(6), cost_usd: "0.3", calls_lost: 1, failure_reasons_json: JSON.stringify([{ check: "truncated", message: "m" }]) });
    const call_of = (i: number) => ({ run_id: s.run_id, job_id: s.jobs[i]!, lesson_id: s.lesson_ids[i]! });
    await seed_call(tx, { ...call_of(0), cost_usd: "0.5", retries: 1 });
    await seed_call(tx, { ...call_of(1), cost_usd: "0.4", retries: 1 });
    await seed_call(tx, { ...call_of(1), cost_usd: "0.3", purpose: "truncation_retry" });
    await seed_call(tx, { ...call_of(2), cost_usd: "0.3" });
    await seed_call(tx, { ...call_of(2), status: "lost" });
    if (settled !== null) await seed_reservation(tx, { run_id: s.run_id, status: "settled", reserved_usd: "2", settled_usd: settled });
  });
  return s;
}

describe("getRunSummary", () => {
  it("test_run_summary_totals", async () => {
    const s = await seed_summary_run("1.5");
    const r = await call(kit.handlers.summary, { run_id: s.run_id });
    expect(r.status).toBe(200);
    const b = body_of(r);
    const sql = (await q((tx) => tx.query("SELECT sum(cost_usd)::float8 c, sum(retries)::int r, count(*) FILTER (WHERE purpose = 'truncation_retry')::int tr FROM model_call WHERE run_id = $1", [s.run_id]))).rows[0]!;
    expect(b.cost_usd).toBeCloseTo(sql.c, 6);
    expect(b.retries).toBe(sql.r);
    expect(b.truncation_retries).toBe(sql.tr);
    expect(b).toMatchObject({ n: 3, lessons: { ready: 2, failed: 1 }, calls_lost_in_flight: 1, target_minutes_per_lesson: 5, trace_incomplete: false, p95_minutes_per_lesson: 6 });
    expect(b.failures_by_reason).toEqual([{ reason: "truncated", count: 1 }]);
    expect(b.brakes_fired).toEqual([{ brake: "truncation_retry", count: 1 }]);
    expect(b.cost_per_ready_lesson_usd).toBeCloseTo(b.cost_usd / 2, 6);

    const none = await q((tx) => seed_stub_run(tx, { state: "partial", statuses: ["generation_failed", "generation_failed", "generation_failed"] }));
    expect(body_of(await call(kit.handlers.summary, { run_id: none.run_id })).cost_per_ready_lesson_usd).toBeNull();
  });

  it("trace_incomplete_flag", async () => {
    const s = await seed_summary_run("0.5");
    const r = await call(kit.handlers.summary, { run_id: s.run_id });
    expect(r.status).toBe(200);
    expect(body_of(r)).toMatchObject({ trace_incomplete: true, n: 3, lessons: { ready: 2, failed: 1 } });
  });

  it("every role reads the summary", async () => {
    const s = await seed_summary_run("1.5");
    for (const token of ["author-token", "reviewer-token", "approver-token"]) {
      expect((await call(kit.handlers.summary, { run_id: s.run_id, token })).status).toBe(200);
    }
  });
});
