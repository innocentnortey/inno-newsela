// NL-35 AC-9 and AC-15 (implementer-written; the frozen spend.int.test.ts stays untouched).
import Decimal from "decimal.js";
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { InvariantViolation } from "@ls/core/errors";
import type { SpendSettings } from "@ls/config/settings";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { insert_row } from "../testing/insert-row.ts";
import { create_test_db, type TestDb } from "../testing/test-db.ts";
import { PgSpendLedger } from "./spend.ts";

const D = (s: string): Decimal => new Decimal(s);
const settings: SpendSettings = {
  build_spend_ceiling_usd: D("75"),
  run_cap_default_usd: D("13.00"),
  user_day_cap_multiplier: D("2"),
  cost_per_lesson_estimate_usd: D("0.182"),
  unit_plan_cost_estimate_usd: D("0.16"),
  run_cap_multiplier: D("1.5"),
};

let t: TestDb;
const ids = new PrefixedIdGenerator();
const clock = new FakeClock(new Date("2026-10-25T10:00:00.000Z"));
const ledger = () => new PgSpendLedger({ db: t.db, ids, clock, settings });
async function q(text: string, values: unknown[] = []): Promise<Record<string, unknown>[]> {
  return t.db.with_tx(async (tx) => (await tx.query(text, values)).rows as Record<string, unknown>[]);
}
async function make_run(cap = "10.00"): Promise<string> {
  const id = ids.new_id("run");
  await t.db.with_tx(async (tx) => { await insert_row(tx, "run", { id, cap_usd: cap }); });
  return id;
}
const req = (run_id: string, user_id: string, amount: string, job_id: string | null = ids.new_id("job")) =>
  ({ run_id, job_id, user_id, purpose: "lesson_draft" as const, amount_usd: D(amount) });

beforeAll(async () => { t = await create_test_db({ pool_max: 4 }); });
afterAll(async () => { await t.drop(); });
beforeEach(async () => { await q("delete from spend_reservation"); });

describe("PgSpendLedger settle and release", () => {
  it("settle_release_idempotent [invariant]: settle 0.42 of 1.00, repeat is stable, release is a no-op after settle", async () => {
    const run = await make_run();
    const user = ids.new_id("usr");
    const l = ledger();
    const a = (await l.reserve(req(run, user, "1.00"))).reservation_id!;
    const t0 = await l.run_totals(run);
    expect(t0.reserved_usd.equals(D("1.00"))).toBe(true);
    const mc = ids.new_id("mc");
    const s1 = await l.settle(a, D("0.42"), mc);
    expect(s1.reserved_usd.equals(D("1.00"))).toBe(true);
    expect(s1.settled_usd.equals(D("0.42"))).toBe(true);
    expect(s1.released_usd.equals(D("0.58"))).toBe(true);
    expect(s1.overshoot_usd.equals(D("0"))).toBe(true);
    const t1 = await l.run_totals(run);
    expect(t1.settled_usd.equals(D("0.42"))).toBe(true);
    expect(t1.reserved_usd.equals(D("0"))).toBe(true);
    const s2 = await l.settle(a, D("0.42"), mc);
    expect(s2).toEqual(s1);
    expect((await l.run_totals(run)).settled_usd.equals(D("0.42"))).toBe(true);
    // a different model call on a settled row is refused
    await expect(l.settle(a, D("0.42"), ids.new_id("mc"))).rejects.toBeInstanceOf(InvariantViolation);
    // release on settled changes nothing
    const rel = await l.release(a);
    expect(rel.status).toBe("settled");
    expect(rel.settled_usd.equals(D("0.42"))).toBe(true);
    // release on a fresh reservation returns the full amount, and a second release is a no-op
    const b = (await l.reserve(req(run, user, "1.00"))).reservation_id!;
    const r1 = await l.release(b);
    expect(r1.status).toBe("released");
    expect(r1.released_usd.equals(D("1.00"))).toBe(true);
    expect(await l.release(b)).toEqual(r1);
    await expect(l.release("sr_missing")).rejects.toBeInstanceOf(InvariantViolation);
    await expect(l.settle("sr_missing", D("1"), ids.new_id("mc"))).rejects.toBeInstanceOf(InvariantViolation);
  });

  it("records_for_wf22_wf28 [capture]: settled and released rows carry every column; nothing stays reserved after the job", async () => {
    const run = await make_run();
    const user = ids.new_id("usr");
    const job = ids.new_id("job");
    const l = ledger();
    const a = (await l.reserve(req(run, user, "1.00", job))).reservation_id!;
    const b = (await l.reserve(req(run, user, "2.00", job))).reservation_id!;
    const mc = ids.new_id("mc");
    await l.settle(a, D("0.80"), mc);
    expect(await l.release_for_jobs([job])).toBe(1);
    const rows = await q("select * from spend_reservation order by id");
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      for (const col of ["run_id", "job_id", "user_id", "purpose", "reserved_usd", "settled_usd", "overshoot_usd", "status", "day", "closed_at"]) {
        expect(r[col], col).not.toBeNull();
        expect(r[col], col).not.toBeUndefined();
      }
    }
    const sa = rows.find((r) => r["id"] === a)!;
    expect(sa["status"]).toBe("settled");
    expect(sa["model_call_id"]).toBe(mc);
    const sb = rows.find((r) => r["id"] === b)!;
    expect(sb["status"]).toBe("released");
    expect(new Decimal(String(sb["settled_usd"])).equals(0)).toBe(true);
    expect(rows.some((r) => r["status"] === "reserved")).toBe(false);
  });
});
