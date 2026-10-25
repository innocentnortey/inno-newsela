// NL-28
import Decimal from "decimal.js";
import { createHash } from "node:crypto";
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { DomainRefusal, InvariantViolation } from "@ls/core/errors";
import type { JobOutcome, NewJob } from "@ls/core/ports/job-queue";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insert_row } from "../testing/insert-row.ts";
import { seed_job, seed_lost_calls, seed_run } from "../testing/seed-run.ts";
import { create_test_db, type TestDb } from "../testing/test-db.ts";
import { PgJobQueue, SCHEMA_VERSION_DEFAULT } from "./job-queue.ts";

let t: TestDb;
let clock: FakeClock;
let q: PgJobQueue;
const ids = new PrefixedIdGenerator();
const T0 = new Date("2026-10-01T10:00:00.000Z");
const at = (min: number): Date => new Date(T0.getTime() + min * 60000);
let k = 0;
const new_job = (run_id: string, over: Partial<NewJob> = {}): NewJob => ({
  run_id, kind: "lesson", lesson_id: `G6.U4.L${++k}`, idempotency_key: `key-${k}`, priority: 0, reviewer_note: null, ...over,
});
const run = <T>(fn: (tx: import("../tx.ts").Tx) => Promise<T>): Promise<T> => t.db.with_tx(fn);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- pg rows are untyped
const row = async (id: string): Promise<Record<string, any>> =>
  run(async (tx) => (await tx.query("SELECT * FROM lesson_job WHERE id=$1", [id])).rows[0]!);
const outcome = (job_id: string, over: Partial<JobOutcome> = {}): JobOutcome => ({
  job_id, status: "ready", tile_state: "ready", failure_reasons: [], brakes_fired: [], repairs: 0, truncation_retries: 0,
  retries: 0, calls_lost: 0, cost_usd: new Decimal("0"), version_id: null, ...over,
});
const reset = async (): Promise<void> => {
  await run((tx) => tx.query("TRUNCATE lesson_job, run, model_call, spend_reservation"));
  clock = new FakeClock(T0);
  q = new PgJobQueue({ db: t.db, ids, clock });
};

beforeAll(async () => {
  t = await create_test_db({ pool_max: 4 });
  clock = new FakeClock(T0);
  q = new PgJobQueue({ db: t.db, ids, clock });
});
afterAll(async () => {
  await t.drop();
});

describe("PgJobQueue", () => {
  it("skip_locked_single_claim: two concurrent claims over one job give exactly one winner", async () => {
    const r = await run((tx) => seed_run(tx));
    await run((tx) => seed_job(tx, { run_id: r }));
    // plan_stored_at is null: lesson jobs wait, so use a unit_plan job instead
    await run((tx) => tx.query("TRUNCATE lesson_job"));
    const j = await run((tx) => seed_job(tx, { run_id: r, kind: "unit_plan", lesson_id: null }));
    const [a, b] = await Promise.all([q.claim("w1", 3, 120000), q.claim("w2", 3, 120000)]);
    expect([a, b].filter((x) => x !== null)).toHaveLength(1);
    const c = (a ?? b)!;
    expect(c.job_id).toBe(j);
    expect(c.attempt).toBe(1);
    expect(c.lease_until.getTime()).toBe(clock.now().getTime() + 120000);
    expect(c.schema_version).toBe(SCHEMA_VERSION_DEFAULT);
  });

  it("lesson_jobs_wait_for_plan: lesson jobs are not claimable until plan_stored_at is set", async () => {
    await reset();
    const r = await run((tx) => seed_run(tx, { plan_stored_at: null }));
    const lj = await run((tx) => seed_job(tx, { run_id: r, kind: "lesson" }));
    expect(await q.claim("w1", 3, 1000)).toBeNull();
    await run((tx) => tx.query("UPDATE run SET plan_stored_at=$1 WHERE id=$2", [T0, r]));
    expect((await q.claim("w1", 3, 1000))?.job_id).toBe(lj);
  });

  it("fair_share_and_active_run_cap: the run with fewer running jobs goes first; the cap limits runs, oldest first", async () => {
    await reset();
    const mk = (m: number) => run((tx) => seed_run(tx, { plan_stored_at: T0, created_at: at(m) }));
    const [r1, r2, r3] = [await mk(1), await mk(2), await mk(3)];
    await run(async (tx) => {
      await seed_job(tx, { run_id: r1, status: "running", lease_until: at(60), lesson_id: "A.1" });
      await seed_job(tx, { run_id: r1, queued_at: at(1), lesson_id: "A.2" });
      await seed_job(tx, { run_id: r2, queued_at: at(2), lesson_id: "B.1" });
      await seed_job(tx, { run_id: r3, queued_at: at(3), lesson_id: "C.1" });
    });
    // r1 has one running, r2 none: r2 first, then r3 (r3 is outside a cap of 2 though)
    expect((await q.claim("w1", 2, 1000))?.run_id).toBe(r2);
    // r1 and r2 now each have 1 running; tie -> oldest run
    expect((await q.claim("w1", 2, 1000))?.run_id).toBe(r1);
    expect(await q.claim("w1", 2, 1000)).toBeNull(); // r3 sits outside the cap
    expect((await q.claim("w1", 3, 1000))?.run_id).toBe(r3);
  });

  it("expired_lease_requeues: only running jobs with a past lease move; other tables untouched", async () => {
    await reset();
    const r = await run((tx) => seed_run(tx, { plan_stored_at: T0 }));
    const [old, fresh] = await run(async (tx) => [
      await seed_job(tx, { run_id: r, status: "running", lease_until: at(1), attempt: 1, lesson_id: "E.1" }),
      await seed_job(tx, { run_id: r, status: "running", lease_until: at(30), attempt: 1, lesson_id: "E.2" }),
    ] as const);
    await run(async (tx) => {
      await insert_row(tx, "model_call", { id: ids.new_id("mc"), job_id: old, status: "lost" });
      await insert_row(tx, "spend_reservation", { id: ids.new_id("sr"), job_id: old, status: "open", day: "2026-10-01" });
    });
    const snap = async () =>
      run(async (tx) => {
        const m = await tx.query("SELECT count(*)::int AS n, md5(string_agg(m::text, '|' ORDER BY id)) AS h FROM model_call m");
        const s = await tx.query("SELECT count(*)::int AS n, md5(string_agg(s::text, '|' ORDER BY id)) AS h FROM spend_reservation s");
        return JSON.stringify([m.rows, s.rows]);
      });
    const before = await snap();
    const rep = await q.requeue_expired(at(10));
    expect(rep).toEqual({ requeued: 1, job_ids: [old] });
    expect(await snap()).toBe(before);
    expect((await row(fresh))["status"]).toBe("running");
    const o = await row(old);
    expect([o["status"], o["worker_id"], o["lease_until"], o["tile_state"]]).toEqual(["queued", null, null, "queued"]);
  });

  it("renew_and_finish_guards: renew only while leased; a second finish is a no-op", async () => {
    await reset();
    const r = await run((tx) => seed_run(tx));
    const j = await run((tx) => seed_job(tx, { run_id: r, kind: "unit_plan", lesson_id: null }));
    expect(await q.renew_lease(j, 1000)).toBe(false); // queued
    await q.claim("w1", 3, 60000);
    expect(await q.renew_lease(j, 90000)).toBe(true);
    expect((await row(j))["lease_until"].getTime()).toBe(clock.now().getTime() + 90000);
    clock.advance(100000);
    expect(await q.renew_lease(j, 90000)).toBe(false); // lease lapsed
    await q.finish(outcome(j, { cost_usd: new Decimal("0.5") }));
    await q.finish(outcome(j, { status: "generation_failed", cost_usd: new Decimal("9") }));
    const f = await row(j);
    expect([f["status"], f["cost_usd"]]).toEqual(["ready", "0.500000"]);
  });

  it("finish_records_counters: counters, reasons, cost and DB-counted lost calls land on the row", async () => {
    await reset();
    const r = await run((tx) => seed_run(tx));
    const j = await run((tx) => seed_job(tx, { run_id: r, kind: "unit_plan", lesson_id: null }));
    await q.claim("w1", 3, 60000);
    await run((tx) => seed_lost_calls(tx, j, 2));
    await q.finish(outcome(j, {
      status: "generation_failed", tile_state: "failed", failure_reasons: [{ check: "length" } as never],
      brakes_fired: ["max_repairs" as never], repairs: 2, truncation_retries: 1, retries: 3, calls_lost: 99,
      cost_usd: new Decimal("1.234567"),
    }));
    const f = await row(j);
    expect(f).toMatchObject({
      status: "generation_failed", tile_state: "failed", repairs: 2, truncation_retries: 1, retries: 3, calls_lost: 2,
      cost_usd: "1.234567", lease_until: null, failure_reasons_json: [{ check: "length" }], brakes_fired: ["max_repairs"],
    });
    expect(f["finished_at"].getTime()).toBe(clock.now().getTime());
    const [jr] = await q.jobs_for_run(r);
    expect(jr!.cost_usd.equals("1.234567")).toBe(true);
  });

  it("retry_failed_only_failed: only generation_failed jobs requeue, counters kept", async () => {
    await reset();
    const r = await run((tx) => seed_run(tx));
    const [bad, ok] = await run(async (tx) => [
      await seed_job(tx, { run_id: r, status: "generation_failed", lesson_id: "R.1" }),
      await seed_job(tx, { run_id: r, status: "ready", lesson_id: "R.2" }),
    ] as const);
    await run((tx) => tx.query("UPDATE lesson_job SET retries=2, cost_usd=1, finished_at=$2, failure_reasons_json='[{\"check\":\"x\"}]' WHERE id=$1", [bad, T0]));
    expect(await run((tx) => q.requeue_failed(r, tx))).toBe(1);
    const b = await row(bad);
    expect(b).toMatchObject({ status: "queued", tile_state: "queued", finished_at: null, failure_reasons_json: [], retries: 2, cost_usd: "1.000000" });
    expect((await row(ok))["status"]).toBe("ready");
    await expect(q.requeue_failed(r, {})).rejects.toBeInstanceOf(InvariantViolation);
  });

  it("cancel_run_and_is_cancelled: queued jobs cancel with the reason; running ones stay", async () => {
    await reset();
    const r = await run((tx) => seed_run(tx));
    const [qd, rn] = await run(async (tx) => [
      await seed_job(tx, { run_id: r, lesson_id: "C.1" }),
      await seed_job(tx, { run_id: r, status: "running", lease_until: at(5), lesson_id: "C.2" }),
    ] as const);
    expect(await q.is_cancelled(qd)).toBe(false);
    expect(await run((tx) => q.cancel_run(r, "capped", tx))).toBe(1);
    const c = await row(qd);
    expect([c["status"], c["tile_state"], c["failure_reasons_json"]]).toEqual(["cancelled", "failed", [{ check: "capped" }]]);
    expect(await q.is_cancelled(qd)).toBe(true);
    expect(await q.is_cancelled(rn)).toBe(false);
    await run((tx) => tx.query("UPDATE run SET state='cancelled' WHERE id=$1", [r]));
    expect(await q.is_cancelled(rn)).toBe(true);
    await expect(q.is_cancelled("job_missing")).rejects.toBeInstanceOf(InvariantViolation);
  });

  it("one_candidate_per_lesson: a second in-flight candidate is refused with a fixed message", async () => {
    await reset();
    const r = await run((tx) => seed_run(tx));
    const first = await run((tx) => q.create_candidate_job(new_job(r, { kind: "candidate", lesson_id: "K.1", reviewer_note: "secret note" }), tx));
    expect(first.kind).toBe("candidate");
    const err = await run((tx) => q.create_candidate_job(new_job(r, { kind: "candidate", lesson_id: "K.1", reviewer_note: "other note" }), tx)).catch((e) => e);
    expect(err).toBeInstanceOf(DomainRefusal);
    expect(String(err.message)).not.toContain("note");
    expect((await q.jobs_for_run(r)).filter((j) => j.kind === "candidate")).toHaveLength(1);
    // once the first is finished, a new one is allowed
    await run((tx) => tx.query("UPDATE lesson_job SET status='ready' WHERE id=$1", [first.job_id]));
    await run((tx) => q.create_candidate_job(new_job(r, { kind: "candidate", lesson_id: "K.1" }), tx));
  });

  it("create_idempotent: 48 jobs insert in one statement, a repeat inserts none, under 500 ms", async () => {
    await reset();
    const r = await run((tx) => seed_run(tx));
    const jobs = Array.from({ length: 48 }, (_, i) => new_job(r, { idempotency_key: createHash("sha256").update(`${r}:${i}`).digest("hex") }));
    const t0 = performance.now();
    expect(await run((tx) => q.create_run_jobs(jobs, tx))).toBe(48);
    const ms = performance.now() - t0;
    console.log(`create_run_jobs(48): ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(500);
    expect(await run((tx) => q.create_run_jobs(jobs, tx))).toBe(0);
    expect(await run((tx) => q.create_run_jobs([], tx))).toBe(0);
    // in-batch duplicates collapse; concurrent creates of the same keys insert once
    const dup = [new_job(r, { idempotency_key: "dup" }), new_job(r, { idempotency_key: "dup" })];
    const counts = await Promise.all([run((tx) => q.create_run_jobs(dup, tx)), run((tx) => q.create_run_jobs(dup, tx))]);
    expect(counts[0]! + counts[1]!).toBe(1);
    expect(await q.jobs_for_run(r)).toHaveLength(49);
  });

  it("kill_and_reclaim: a claimed job whose lease lapses is requeued and reclaimed with attempt 2", async () => {
    await reset();
    const r = await run((tx) => seed_run(tx));
    const j = await run((tx) => seed_job(tx, { run_id: r, kind: "unit_plan", lesson_id: null }));
    expect((await q.claim("w1", 3, 120000))?.attempt).toBe(1);
    clock.advance(121000);
    expect((await q.requeue_expired(clock.now())).job_ids).toEqual([j]);
    const again = await q.claim("w2", 3, 120000);
    expect([again?.job_id, again?.attempt]).toEqual([j, 2]);
    expect((await row(j))["worker_id"]).toBe("w2");
  });

  it("records_for_wf22_wf6: lifecycle columns are filled at claim, finish, requeue and cancel", async () => {
    await reset();
    const r = await run((tx) => seed_run(tx, { plan_stored_at: T0 }));
    const j = await run((tx) => seed_job(tx, { run_id: r, lesson_id: "W.1", queued_at: at(1) }));
    const other = await run((tx) => seed_job(tx, { run_id: r, lesson_id: "W.2", queued_at: at(5) }));
    await q.claim("w1", 3, 1000);
    const c = await row(j);
    expect([c["worker_id"], c["lease_until"], c["started_at"], c["attempt"]].every((v) => v !== null)).toBe(true);
    await run((tx) => q.cancel_run(r, "cancelled", tx));
    const x = await row(other);
    expect([x["finished_at"], x["failure_reasons_json"]].every((v) => v !== null)).toBe(true);
    await q.finish(outcome(j));
    expect((await row(j))["finished_at"]).not.toBeNull();
    clock.advance(1);
    const rq = await seed_job_expired(r);
    await q.requeue_expired(clock.now());
    expect((await row(rq))["queued_at"]).not.toBeNull();
  });

  it("reviewer_note_round_trip: the note is stored on a candidate job and copied to the claim", async () => {
    await reset();
    const r = await run((tx) => seed_run(tx, { plan_stored_at: T0, choices_json: { schema_version: 3 } }));
    const row1 = await run((tx) => q.create_candidate_job(new_job(r, { kind: "candidate", lesson_id: "N.1", reviewer_note: "make it shorter" }), tx));
    const c = await q.claim("w1", 3, 1000);
    expect(c?.job_id).toBe(row1.job_id);
    expect(c?.reviewer_note).toBe("make it shorter");
    expect(c?.schema_version).toBe(3);
    await run((tx) => q.create_run_jobs([new_job(r, { lesson_id: "N.2" })], tx));
    const l = await q.claim("w1", 3, 1000);
    expect(l?.reviewer_note).toBeNull();
  });
});

async function seed_job_expired(run_id: string): Promise<string> {
  return t.db.with_tx((tx) => seed_job(tx, { run_id, status: "running", lease_until: T0, lesson_id: "W.3" }));
}
