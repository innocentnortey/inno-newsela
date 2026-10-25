// NL-08 AC-8 [invariant] with_tx commits on return, rolls back on throw, serialises on one advisory-lock key.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { create_test_db, type TestDb } from "./testing/test-db.ts";

let t: TestDb;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  t = await create_test_db({ migrate: false, pool_max: 4 });
  await t.db.with_tx(async (tx) => {
    await tx.query("create table tx_probe (k text primary key)");
  });
});
afterAll(async () => {
  await t.drop();
});

describe("with_tx (AC-8)", () => {
  it("[invariant] commits the writes of a callback that returns", async () => {
    const out = await t.db.with_tx(async (tx) => {
      await tx.query("insert into tx_probe (k) values ('committed')");
      return "done";
    });
    expect(out).toBe("done");
    const rows = await t.db.with_tx(async (tx) => (await tx.query("select k from tx_probe where k='committed'")).rows);
    expect(rows).toHaveLength(1);
  });

  it("[invariant] rolls back a callback that throws, rethrows the original error, and the row is absent", async () => {
    const boom = new Error("boom");
    await expect(
      t.db.with_tx(async (tx) => {
        await tx.query("insert into tx_probe (k) values ('rolled_back')");
        throw boom;
      }),
    ).rejects.toBe(boom);
    const rows = await t.db.with_tx(async (tx) => (await tx.query("select k from tx_probe where k='rolled_back'")).rows);
    expect(rows).toHaveLength(0);
  });

  it("[invariant] same advisory-lock key runs one after the other; different keys run together", async () => {
    async function pair(key_a: string, key_b: string) {
      const stamps: Record<string, number> = {};
      const a = t.db.with_tx(async () => {
        stamps["a_start"] = Date.now();
        await sleep(400);
        stamps["a_end"] = Date.now();
      }, key_a);
      await sleep(100);
      const b = t.db.with_tx(async () => {
        stamps["b_start"] = Date.now();
        await sleep(50);
        stamps["b_end"] = Date.now();
      }, key_b);
      await Promise.all([a, b]);
      return stamps;
    }
    const same = await pair("lesson:L1", "lesson:L1");
    expect(same["b_start"]!).toBeGreaterThanOrEqual(same["a_end"]!);
    const diff = await pair("lesson:L2", "lesson:L3");
    expect(diff["b_start"]!).toBeLessThan(diff["a_end"]!);
    console.log("tx order timestamps", { same, diff });
  });
});
