// NL-35 frozen tests (risk::security, money movement): AC-6, AC-7, AC-8, AC-10, AC-11, AC-12, AC-13. Do not edit.
import Decimal from "decimal.js";
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { SpendLedger } from "@ls/core/ports/spend";
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
type Warn = [string, unknown];
let warns: Warn[] = [];
const logger = {
  info(): void {},
  warn(e: string, f: unknown): void { warns.push([e, f]); },
  error(): void {},
};
function ledger(clock = new FakeClock(new Date("2026-10-25T10:00:00.000Z"))): SpendLedger {
  return new PgSpendLedger({ db: t.db, ids, clock, settings, logger });
}
async function q(text: string, values: unknown[] = []): Promise<Record<string, any>[]> {
  return t.db.with_tx(async (tx) => (await tx.query(text, values)).rows as Record<string, any>[]);
}
const total_rows = async (): Promise<number> => Number((await q("select count(*)::int n from spend_reservation"))[0]!["n"]);
async function make_run(cap: string): Promise<string> {
  const id = ids.new_id("run");
  await t.db.with_tx(async (tx) => { await insert_row(tx, "run", { id, cap_usd: cap }); });
  return id;
}
// Seed a settled reservation for the day/project sums without going through the ledger.
async function seed_settled(user_id: string, day: string, amount: string): Promise<void> {
  await t.db.with_tx(async (tx) => {
    await insert_row(tx, "spend_reservation", {
      id: ids.new_id("sr"), user_id, purpose: "lesson_draft", reserved_usd: amount,
      settled_usd: amount, status: "settled", day,
    });
  });
}
const req = (run_id: string | null, user_id: string, amount: string, job_id: string | null = ids.new_id("job")) =>
  ({ run_id, job_id, user_id, purpose: "lesson_draft" as const, amount_usd: D(amount) });

beforeAll(async () => {
  t = await create_test_db({ pool_max: 8 });
});
afterAll(async () => {
  await t.drop();
});
beforeEach(async () => {
  warns = [];
  await q("delete from spend_reservation");
  await q("delete from model_call");
});

describe("PgSpendLedger", () => {
  it("reserve_inserts_one_row [invariant]: an allowed reserve writes exactly one reserved row with today's UTC day and the job id", async () => {
    const run = await make_run("10.00");
    const user = ids.new_id("usr");
    const job = ids.new_id("job");
    const clock = new FakeClock(new Date("2026-10-25T10:00:00.000Z"));
    const d = await ledger(clock).reserve(req(run, user, "1.00", job));
    expect(d.allowed).toBe(true);
    expect(d.reservation_id).toMatch(/^sr_/);
    const rows = await q("select * from spend_reservation");
    expect(rows).toHaveLength(1);
    const r = rows[0]!;
    expect(r["id"]).toBe(d.reservation_id);
    expect(r["status"]).toBe("reserved");
    expect(new Decimal(String(r["reserved_usd"])).equals(D("1.000000"))).toBe(true);
    expect(r["day"]).toBe("2026-10-25");
    expect(r["job_id"]).toBe(job);
    expect(r["run_id"]).toBe(run);
    expect(r["user_id"]).toBe(user);
    expect(r["purpose"]).toBe("lesson_draft");
  });

  it("concurrent_reserves_never_pass_cap [invariant]: 20 parallel reserves of 1.00 on a 10.00 run give 10 allowed, 10 run_cap refusals, sum 10.00", async () => {
    const run = await make_run("10.00");
    const user = ids.new_id("usr");
    const l = ledger();
    const results = await Promise.all(Array.from({ length: 20 }, () => l.reserve(req(run, user, "1.00"))));
    expect(results.filter((r) => r.allowed)).toHaveLength(10);
    const refused = results.filter((r) => !r.allowed);
    expect(refused).toHaveLength(10);
    expect(refused.every((r) => r.refused_by === "run_cap")).toBe(true);
    const sum = (await q("select sum(reserved_usd) s, count(*)::int n from spend_reservation where run_id=$1", [run]))[0]!;
    expect(new Decimal(String(sum["s"])).equals(D("10.00"))).toBe(true);
    expect(sum["n"]).toBe(10);
  });

  describe("refusal_writes_nothing", () => {
    it("refusal_writes_nothing [failure] run cap: no row written, snapshot returned", async () => {
      const run = await make_run("1.00");
      const before = await total_rows();
      const d = await ledger().reserve(req(run, ids.new_id("usr"), "2.00"));
      expect(d.allowed).toBe(false);
      expect(d.refused_by).toBe("run_cap");
      expect(d.reservation_id).toBeNull();
      expect(d.snapshot).toBeDefined();
      expect(await total_rows()).toBe(before);
    });

    it("refusal_writes_nothing [failure] day cap: no row written", async () => {
      const run = await make_run("100.00");
      const user = ids.new_id("usr");
      await seed_settled(user, "2026-10-25", "25.50");
      const before = await total_rows();
      const d = await ledger().reserve(req(run, user, "1.00"));
      expect(d.allowed).toBe(false);
      expect(d.refused_by).toBe("day_cap");
      expect(d.scope).toBe("user");
      expect(d.reservation_id).toBeNull();
      expect(await total_rows()).toBe(before);
    });

    it("refusal_writes_nothing [failure] project cap: no row written", async () => {
      const run = await make_run("100.00");
      for (const [u, day] of [["usr_a", "2026-10-20"], ["usr_b", "2026-10-21"], ["usr_c", "2026-10-22"]] as const) {
        await seed_settled(u, day, u === "usr_c" ? "24.50" : "25.00");
      }
      const before = await total_rows();
      const d = await ledger().reserve(req(run, ids.new_id("usr"), "1.00"));
      expect(d.allowed).toBe(false);
      expect(d.refused_by).toBe("project_cap");
      expect(d.scope).toBe("project");
      expect(d.reservation_id).toBeNull();
      expect(await total_rows()).toBe(before);
    });
  });

  describe("overshoot_and_status_moves", () => {
    async function open(run: string, user: string, amount = "1.00"): Promise<string> {
      const d = await ledger().reserve(req(run, user, amount));
      expect(d.allowed).toBe(true);
      return d.reservation_id!;
    }

    it("overshoot_and_status_moves [invariant] overshoot: settle 1.30 on 1.00 stores overshoot 0.30, logs spend.overshoot, and later cap checks count it", async () => {
      const run = await make_run("10.00");
      const user = ids.new_id("usr");
      const id = await open(run, user);
      const res = await ledger().settle(id, D("1.30"), ids.new_id("mc"));
      expect(res.settled_usd.equals(D("1.30"))).toBe(true);
      expect(res.overshoot_usd.equals(D("0.30"))).toBe(true);
      expect(res.released_usd.equals(D("0"))).toBe(true);
      const row = (await q("select * from spend_reservation where id=$1", [id]))[0]!;
      expect(row["status"]).toBe("settled");
      expect(new Decimal(String(row["settled_usd"])).equals(D("1.30"))).toBe(true);
      expect(new Decimal(String(row["overshoot_usd"])).equals(D("0.30"))).toBe(true);
      expect(warns.some(([e]) => e === "spend.overshoot")).toBe(true);
      // The cap check counts the overshoot: 1.30 + 8.80 > 10.00, but 1.30 + 8.70 fits.
      const over = await ledger().reserve(req(run, user, "8.80"));
      expect(over.allowed).toBe(false);
      expect(over.refused_by).toBe("run_cap");
      const fits = await ledger().reserve(req(run, user, "8.70"));
      expect(fits.allowed).toBe(true);
    });

    it("overshoot_and_status_moves [invariant] released -> settled: a call that completes after release records the real spend", async () => {
      const run = await make_run("10.00");
      const user = ids.new_id("usr");
      const id = await open(run, user);
      await ledger().release(id);
      expect((await q("select status from spend_reservation where id=$1", [id]))[0]!["status"]).toBe("released");
      const mc = ids.new_id("mc");
      const res = await ledger().settle(id, D("0.40"), mc);
      expect(res.settled_usd.equals(D("0.40"))).toBe(true);
      const row = (await q("select * from spend_reservation where id=$1", [id]))[0]!;
      expect(row["status"]).toBe("settled");
      expect(new Decimal(String(row["settled_usd"])).equals(D("0.40"))).toBe(true);
      expect(row["model_call_id"]).toBe(mc);
    });

    it("overshoot_and_status_moves [invariant] settled is terminal: release and a second settle never change it", async () => {
      const run = await make_run("10.00");
      const id = await open(run, ids.new_id("usr"));
      const mc = ids.new_id("mc");
      await ledger().settle(id, D("0.42"), mc);
      const before = (await q("select * from spend_reservation where id=$1", [id]))[0]!;
      await ledger().release(id);
      await ledger().settle(id, D("0.99"), ids.new_id("mc")).catch(() => undefined);
      const after = (await q("select * from spend_reservation where id=$1", [id]))[0]!;
      expect(after["status"]).toBe("settled");
      expect(new Decimal(String(after["settled_usd"])).equals(new Decimal(String(before["settled_usd"])))).toBe(true);
      expect(after["model_call_id"]).toBe(mc);
    });
  });

  it("release_for_jobs [invariant]: releases every reserved row of the named jobs only, returns the count, and restores headroom", async () => {
    const run = await make_run("10.00");
    const user = ids.new_id("usr");
    const [j1, j2, j3] = [ids.new_id("job"), ids.new_id("job"), ids.new_id("job")] as const;
    const l = ledger();
    await l.reserve(req(run, user, "3.00", j1));
    await l.reserve(req(run, user, "2.00", j2));
    await l.reserve(req(run, user, "1.00", j3));
    // A settled row of j1 must not be touched.
    const s = await l.reserve(req(run, user, "0.50", j1));
    await l.settle(s.reservation_id!, D("0.50"), ids.new_id("mc"));
    const before = await l.run_totals(run);
    expect(before.reserved_usd.equals(D("6.00"))).toBe(true);
    // Headroom before: 10 - 0.50 - 6 = 3.50, so 4.00 is refused.
    expect((await l.reserve(req(run, user, "4.00"))).allowed).toBe(false);

    const n = await l.release_for_jobs([j1, j2]);
    expect(n).toBe(2);
    const rows = await q("select job_id, status from spend_reservation order by created_at");
    expect(rows.filter((r) => r["job_id"] === j3).every((r) => r["status"] === "reserved")).toBe(true);
    expect(rows.filter((r) => r["status"] === "released")).toHaveLength(2);
    expect(rows.filter((r) => r["status"] === "settled")).toHaveLength(1);
    const after = await l.run_totals(run);
    expect(after.reserved_usd.equals(D("1.00"))).toBe(true);
    // Headroom restored: 10 - 0.50 - 1 = 8.50.
    expect((await l.reserve(req(run, user, "8.50"))).allowed).toBe(true);
    expect(await l.release_for_jobs([])).toBe(0);
  });

  it("check_day_cap_dry_and_utc_day [invariant]: dry run writes nothing, orders day then project, and the day is the UTC calendar day", async () => {
    const clock = new FakeClock(new Date("2026-10-25T23:59:59.000Z"));
    const l = ledger(clock);
    const user = ids.new_id("usr");
    const run = await make_run("100.00");
    await seed_settled(user, "2026-10-25", "25.50");
    let before = await total_rows();
    const ok = await l.check_day_cap(user, D("0.40"));
    expect(ok.allowed).toBe(true);
    expect(ok.reservation_id).toBeNull();
    const no = await l.check_day_cap(user, D("1.00"));
    expect(no.allowed).toBe(false);
    expect(no.refused_by).toBe("day_cap");
    expect(no.scope).toBe("user");
    expect(no.reservation_id).toBeNull();
    // Project ceiling is checked too (no run cap): other users' spend on other days.
    await seed_settled("usr_x", "2026-10-10", "24.00");
    await seed_settled("usr_y", "2026-10-11", "24.00");
    const fresh = ids.new_id("usr");
    const proj = await l.check_day_cap(fresh, D("1.00")); // 25.50 + 48.00 = 73.50, +1.00 fits
    expect(proj.allowed).toBe(true);
    const proj2 = await l.check_day_cap(fresh, D("2.00")); // 75.50 > 75
    expect(proj2.allowed).toBe(false);
    expect(proj2.refused_by).toBe("project_cap");
    before += 2; // the two seeds above
    expect(await total_rows()).toBe(before);

    // UTC day roll: 23:59:59Z on the 25th, then 00:00:01Z on the 26th.
    await q("delete from spend_reservation");
    const u2 = ids.new_id("usr");
    const a = await l.reserve(req(run, u2, "20.00"));
    expect(a.allowed).toBe(true);
    clock.advance(2000);
    const b = await l.reserve(req(run, u2, "20.00")); // 40.00 would breach 26.00 if the day had not rolled
    expect(b.allowed).toBe(true);
    const days = (await q("select day from spend_reservation order by created_at")).map((r) => r["day"]);
    expect(days).toEqual(["2026-10-25", "2026-10-26"]);
    expect((await l.check_day_cap(u2, D("6.00"))).allowed).toBe(true); // 20 + 6 = 26.00, inclusive
    expect((await l.check_day_cap(u2, D("6.01"))).allowed).toBe(false);
  });

  it("project_total_includes_spike_calls [invariant]: imported model_call rows with no reservation count toward the 75.00 ceiling", async () => {
    const run = await make_run("10.00");
    await t.db.with_tx(async (tx) => {
      await insert_row(tx, "model_call", { id: ids.new_id("mc"), reservation_id: null, cost_usd: "12.00" });
    });
    await seed_settled("usr_a", "2026-10-20", "20.00");
    await seed_settled("usr_b", "2026-10-21", "20.00");
    await seed_settled("usr_c", "2026-10-22", "20.00");
    const before = await total_rows();
    const d = await ledger().reserve(req(run, ids.new_id("usr"), "3.50"));
    expect(d.allowed).toBe(false);
    expect(d.refused_by).toBe("project_cap");
    expect(d.scope).toBe("project");
    expect(d.remaining_usd?.equals(D("3.00"))).toBe(true);
    expect(await total_rows()).toBe(before);
    // A reservation-linked model_call is not double counted: 3.00 still fits.
    expect((await ledger().reserve(req(run, ids.new_id("usr"), "3.00"))).allowed).toBe(true);
  });
});
