// NL-33 AC-12 (WF-22 component record): one paid call leaves one model_call row, one settled
// spend_reservation and one content-free log line. Needs the test Postgres: scripts/test-db.sh up
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { SpendLedger } from "@ls/core/ports/spend";
import { create_logger } from "@ls/obs/logger";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PgModelCallLog } from "../../packages/db/src/repos/model-calls.ts";
import { create_test_db, type TestDb } from "../../packages/db/src/testing/test-db.ts";
import { PaidCaller } from "../../packages/llm/src/paid-call.ts";
import { ModelCallRecorder } from "../../packages/llm/src/recorder.ts";
import { cost_math, ctx, prices, rendered, request, settings } from "../../packages/llm/src/test-support/fixtures.ts";
import { response, ScriptedClient } from "../../packages/llm/src/test-support/scripted-client.ts";

let t: TestDb;
beforeAll(async () => {
  t = await create_test_db();
});
afterAll(async () => {
  await t.drop();
});

// PgSpendLedger is NL-35's and not merged: a minimal table-backed stand-in.
function table_ledger(db: TestDb["db"]): SpendLedger {
  const q = (text: string, values: unknown[]) => db.with_tx((tx) => tx.query(text, values));
  return {
    async reserve(r) {
      const id = "sr_cap_1";
      await q(
        `INSERT INTO spend_reservation (id, run_id, job_id, user_id, purpose, reserved_usd, status, day) VALUES ($1,$2,$3,$4,$5,$6,'reserved','2026-10-01')`,
        [id, r.run_id, r.job_id, r.user_id, r.purpose, r.amount_usd.toFixed(6)],
      );
      return { allowed: true, reservation_id: id, refused_by: null, scope: null, remaining_usd: null, snapshot: {} } as never;
    },
    async settle(id, actual, model_call_id) {
      await q(`UPDATE spend_reservation SET status='settled', settled_usd=$2, model_call_id=$3, closed_at=now() WHERE id=$1`, [id, actual.toFixed(6), model_call_id]);
      return {} as never;
    },
    async release(id) {
      await q(`UPDATE spend_reservation SET status='released', closed_at=now() WHERE id=$1 AND status='reserved'`, [id]);
      return {} as never;
    },
    release_for_jobs: () => Promise.reject(new Error("unused")),
    run_totals: () => Promise.reject(new Error("unused")),
    check_day_cap: () => Promise.reject(new Error("unused")),
  };
}

describe("model call capture (WF-22)", () => {
  it("one paid call leaves a model_call row, a settled reservation and one log line", async () => {
    const clock = new FakeClock(new Date("2026-10-01T10:00:00.000Z"));
    const lines: string[] = [];
    const logger = create_logger({ service: "worker", build_id: "t", write: (l) => lines.push(l) });
    const log = new PgModelCallLog({ db: t.db, ids: new PrefixedIdGenerator(), clock });
    const client = new ScriptedClient(clock).script(response({ raw_text: "RAW-OUT", usage: { input_tokens: 100, output_tokens: 50, cache_read_tokens: 0, cache_write_tokens: 0 } }));
    const recorder = new ModelCallRecorder(client, log, clock, prices, settings(), cost_math, { logger });
    const caller = new PaidCaller(recorder, table_ledger(t.db), prices, cost_math);

    const recorded = await caller.call({
      ctx: ctx({ reservation_id: null }), req: request(), rendered: rendered("synthetic prompt A"),
      run_id: "run_1" as never, job_id: "job_1" as never, user_id: "usr_1" as never,
    });

    const calls = await t.db.with_tx(async (tx) => (await tx.query("SELECT * FROM model_call")).rows as Array<Record<string, unknown>>);
    const reservations = await t.db.with_tx(async (tx) => (await tx.query("SELECT * FROM spend_reservation")).rows as Array<Record<string, unknown>>);
    console.log("model_call row:", JSON.stringify(calls[0]));
    console.log("spend_reservation row:", JSON.stringify(reservations[0]));
    console.log("log line:", lines[0]);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      id: recorded.model_call_id, status: "completed", rendered_prompt: "synthetic prompt A", raw_output: "RAW-OUT",
      input_tokens: 100, output_tokens: 50, cost_usd: "0.000350", served_model: "stub-model", reservation_id: "sr_cap_1",
    });
    expect(reservations).toHaveLength(1);
    expect(reservations[0]).toMatchObject({ id: "sr_cap_1", status: "settled", model_call_id: recorded.model_call_id, settled_usd: "0.000350" });
    expect(lines).toHaveLength(1);
    const line = JSON.parse(lines[0]!) as { event: string; extra: { model_call_id: string } };
    expect(line.event).toBe("model_call");
    expect(line.extra.model_call_id).toBe(recorded.model_call_id);
    expect(lines[0]).not.toContain("synthetic prompt A");
    expect(lines[0]).not.toContain("RAW-OUT");
  });
});
