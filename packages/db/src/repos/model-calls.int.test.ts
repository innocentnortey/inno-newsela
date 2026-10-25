// NL-33 frozen tests (risk::security). Needs the test Postgres: scripts/test-db.sh up
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { ModelCallStart } from "@ls/core/ports/model-call-log";
import Decimal from "decimal.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { create_test_db, type TestDb } from "../testing/test-db.ts";
import { PgModelCallLog } from "./model-calls.ts";

let t: TestDb;
let log: PgModelCallLog;
const ids = new PrefixedIdGenerator();
const usage = (i: number, o: number) => ({ input_tokens: i, output_tokens: o, cache_read_tokens: 0, cache_write_tokens: 0 });
const start = (over: Partial<ModelCallStart> = {}): ModelCallStart => ({
  run_id: "run_1" as never, lesson_id: "G6.U4.L1" as never, job_id: "job_1" as never, attempt: 1, purpose: "lesson_draft",
  alias: "GENERATION", requested_model: "claude-sonnet-5-5", rendered_prompt: "synthetic prompt A", request_id: "req_1" as never,
  experiment_id: null, reservation_id: "sr_1" as never, ...over,
});
const done = (cost: string, i: number, o: number, raw = "{}") => ({
  raw_output: raw, stop_reason: "end_turn", usage: usage(i, o), cost_usd: new Decimal(cost), served_model: "stub-model", provider_request_id: "p_1", latency_ms: 5,
});
const row = async (id: string): Promise<Record<string, unknown>> =>
  t.db.with_tx(async (tx) => (await tx.query("SELECT * FROM model_call WHERE id=$1", [id])).rows[0] as Record<string, unknown>);

beforeAll(async () => {
  t = await create_test_db();
  log = new PgModelCallLog({ db: t.db, ids, clock: new FakeClock(new Date("2026-10-01T10:00:00.000Z")) });
});
afterAll(async () => {
  await t.drop();
});

describe("PgModelCallLog", () => {
  it("sent_then_completed [invariant]: the sent row is committed (visible to another connection) before completion fills it", async () => {
    const id = await log.insert_sent(start());
    expect(id).toMatch(/^mc_[0-9A-HJKMNP-TV-Z]{26}$/);
    const sent = await row(id);
    expect(sent).toMatchObject({
      status: "sent", rendered_prompt: "synthetic prompt A", purpose: "lesson_draft", alias: "GENERATION",
      requested_model: "claude-sonnet-5-5", attempt: 1, reservation_id: "sr_1", request_id: "req_1", retries: 0, raw_output: null,
    });
    expect(sent["sent_at"]).toBeInstanceOf(Date);

    await log.complete(id, done("0.000350", 100, 50, "RAW TEXT"));
    const final = await row(id);
    expect(final).toMatchObject({ status: "completed", raw_output: "RAW TEXT", served_model: "stub-model", input_tokens: 100, output_tokens: 50, stop_reason: "end_turn" });
    expect(final["cost_usd"]).toBe("0.000350");
    expect(final["completed_at"]).toBeInstanceOf(Date);
  });

  it("sent_then_completed [invariant]: fail stores error:<kind>:<status> and no message text", async () => {
    const id = await log.insert_sent(start({ job_id: "job_f" as never }));
    await log.fail(id, { kind: "rate_limited", http_status: 429, message: "SECRET-MESSAGE", retry_after_s: 5 });
    const r = await row(id);
    expect(r).toMatchObject({ status: "failed", stop_reason: "error:rate_limited:429" });
    expect(JSON.stringify(r)).not.toContain("SECRET-MESSAGE");
  });

  it("lost_and_totals [invariant]: mark_lost flips only sent rows; totals equal the hand-computed sums over completed rows", async () => {
    const run = "run_totals" as never;
    const job = "job_totals" as never;
    const base = { run_id: run, job_id: job };
    const a = await log.insert_sent(start({ ...base, attempt: 1 }));
    await log.record_retry(a);
    await log.complete(a, done("0.010000", 100, 50));
    const b = await log.insert_sent(start({ ...base, purpose: "truncation_retry", attempt: 1 }));
    await log.complete(b, done("0.020000", 200, 80));
    const c = await log.insert_sent(start({ ...base, purpose: "repair", alias: "REPAIR", attempt: 1 }));
    await log.complete(c, done("0.030000", 300, 120));
    const d = await log.insert_sent(start({ ...base, attempt: 2 }));
    await log.fail(d, { kind: "timeout", http_status: null, message: "x", retry_after_s: null });
    const e = await log.insert_sent(start({ ...base, attempt: 3 }));

    expect(await log.mark_lost(job)).toBe(1);
    expect((await row(e))["status"]).toBe("lost");
    expect((await row(a))["status"]).toBe("completed");
    expect(await log.mark_lost(job)).toBe(0);

    const totals = await log.totals_for_run(run);
    expect(totals).toMatchObject({ run_id: run, calls: 5, completed: 3, failed: 1, lost: 1, retries: 1, truncation_retries: 1, repairs: 1, input_tokens: 600, output_tokens: 250 });
    expect(totals.cost_usd.toFixed(6)).toBe("0.060000");
  });

  it("completed_for_ordinal [invariant]: lookup is by the (job, purpose) ordinal; unknown ordinal is null", async () => {
    const job = "job_ord" as never;
    const d = await log.insert_sent(start({ job_id: job, purpose: "lesson_draft", attempt: 1 }));
    await log.complete(d, done("0.001000", 10, 5, "DRAFT"));
    const r = await log.insert_sent(start({ job_id: job, purpose: "repair", alias: "REPAIR", attempt: 1 }));
    await log.complete(r, done("0.002000", 10, 5, "REPAIR"));
    expect(await log.completed_for(job, "lesson_draft", 1)).toMatchObject({ model_call_id: d, raw_output: "DRAFT", attempt: 1 });
    expect(await log.completed_for(job, "repair", 1)).toMatchObject({ model_call_id: r, raw_output: "REPAIR" });
    expect(await log.completed_for(job, "lesson_draft", 2)).toBeNull();
  });

  it("completed_for_ordinal [negative]: a sent or failed row is never returned as a checkpoint", async () => {
    const job = "job_nocp" as never;
    await log.insert_sent(start({ job_id: job }));
    expect(await log.completed_for(job, "lesson_draft", 1)).toBeNull();
  });

  it("correlation_ids [invariant]: worker row carries run, lesson, job, request ids; assist row has run_id null and its web request_id", async () => {
    const w = await log.insert_sent(start());
    const a = await log.insert_sent(start({ run_id: null, job_id: null, lesson_id: null, purpose: "assist", alias: "ASSIST", request_id: "req_web_9" as never }));
    expect(await row(w)).toMatchObject({ run_id: "run_1", lesson_id: "G6.U4.L1", job_id: "job_1", request_id: "req_1" });
    expect(await row(a)).toMatchObject({ run_id: null, request_id: "req_web_9", purpose: "assist" });
  });
});
