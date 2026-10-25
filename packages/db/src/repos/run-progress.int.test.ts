// NL-78: PgRunProgressReader against real Postgres (synthetic rows).
import Decimal from "decimal.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { insert_row } from "../testing/insert-row.ts";
import { seed_job, seed_run } from "../testing/seed-run.ts";
import { create_test_db, type TestDb } from "../testing/test-db.ts";
import { PgRunProgressReader } from "./run-progress.ts";

let t: TestDb;
let reader: PgRunProgressReader;
const ids = new PrefixedIdGenerator();
const at = (min: number, day = 25) => new Date(Date.UTC(2026, 9, day, 10, min, 0));
const early = (min: number) => at(min, 24); // earlier than the rows other tests in this file seed
const q = async <T>(fn: (tx: Parameters<typeof seed_run>[0]) => Promise<T>): Promise<T> => t.db.with_tx(async (tx) => fn(tx));

beforeAll(async () => {
  t = await create_test_db();
  reader = new PgRunProgressReader({ db: t.db, ids, clock: { now: () => new Date(), sleep: async () => {} } });
});
afterAll(async () => {
  await t.drop();
});

describe("PgRunProgressReader", () => {
  it("returns null for an unknown run", async () => {
    expect(await reader.progress_rows("run_missing")).toBeNull();
  });

  it("joins lesson title and number, and sums only this run's reservations", async () => {
    const { run_id, other } = await q(async (tx) => {
      const run_id = await seed_run(tx, { state: "running", plan_stored_at: at(0) });
      const other = await seed_run(tx, { state: "running", plan_stored_at: at(0) });
      await insert_row(tx, "lesson", { id: "G6.U4.L1", unit_id: "G6.U4", number: 1, type: "Reading", title: "Synthetic lesson 1", state: "draft", schema_version: 1 });
      await seed_job(tx, { run_id, kind: "lesson", lesson_id: "G6.U4.L1", queued_at: at(1) });
      await seed_job(tx, { run_id, kind: "unit_plan", queued_at: at(1) });
      for (const [rid, status, reserved, settled] of [[run_id, "reserved", "1.5", "0"], [run_id, "settled", "2", "1.25"], [other, "reserved", "9", "0"]] as const) {
        await insert_row(tx, "spend_reservation", { id: ids.new_id("sr"), run_id: rid, user_id: "u", purpose: "p", status, reserved_usd: reserved, settled_usd: settled, day: "2026-10-25" });
      }
      return { run_id, other };
    });
    const rows = await reader.progress_rows(run_id);
    expect(rows?.run.run_id).toBe(run_id);
    expect(rows?.jobs).toHaveLength(2);
    const lesson = rows?.jobs.find((j) => j.lesson_id === "G6.U4.L1");
    expect([lesson?.lesson_title, lesson?.lesson_number]).toEqual(["Synthetic lesson 1", 1]);
    expect(rows?.jobs.find((j) => j.kind === "unit_plan")?.lesson_title).toBeNull();
    expect(rows?.settled_usd.eq(new Decimal("1.25"))).toBe(true);
    expect(rows?.reserved_usd.eq(new Decimal("1.5"))).toBe(true);
    expect((await reader.progress_rows(other))?.reserved_usd.eq(9)).toBe(true);
  });

  it("queued_ahead counts only eligible older queued jobs of other runs", async () => {
    const r = await q(async (tx) => {
      const older = await seed_run(tx, { state: "running", plan_stored_at: early(0) });
      await seed_job(tx, { run_id: older, kind: "lesson", queued_at: early(1) });
      await seed_job(tx, { run_id: older, kind: "lesson", queued_at: early(2) });
      const done = await seed_run(tx, { state: "complete", plan_stored_at: early(0) });
      await seed_job(tx, { run_id: done, kind: "lesson", queued_at: early(1) });
      const unplanned = await seed_run(tx, { state: "planning", plan_stored_at: null });
      await seed_job(tx, { run_id: unplanned, kind: "lesson", queued_at: early(1) });
      await seed_job(tx, { run_id: unplanned, kind: "unit_plan", queued_at: early(1) });
      const mine = await seed_run(tx, { state: "running", plan_stored_at: early(0) });
      await seed_job(tx, { run_id: mine, kind: "lesson", queued_at: early(5) });
      await seed_job(tx, { run_id: mine, kind: "lesson", queued_at: early(6) });
      const newer = await seed_run(tx, { state: "running", plan_stored_at: early(0) });
      await seed_job(tx, { run_id: newer, kind: "lesson", queued_at: early(9) });
      const none = await seed_run(tx, { state: "running", plan_stored_at: early(0) });
      await seed_job(tx, { run_id: none, kind: "lesson", status: "ready", queued_at: early(5) });
      return { older, mine, newer, none };
    });
    // mine: older's 2 + unplanned's unit_plan job (its lesson job is held back) = 3
    expect((await reader.progress_rows(r.mine))?.queued_ahead).toBe(3);
    expect((await reader.progress_rows(r.none))?.queued_ahead).toBe(0);
    expect((await reader.progress_rows(r.older))?.queued_ahead).toBe(0);
    expect((await reader.progress_rows(r.newer))?.queued_ahead).toBe(5);
  });
});
