// NL-08 AC-9: pool exhaustion and ping.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SecretStr } from "@ls/config/secret";
import { PgDatabase } from "./pool.ts";
import { PoolExhausted } from "./pool-exhausted.ts";
import {
  create_test_db,
  settings_for,
  type TestDb,
} from "./testing/test-db.ts";

let t: TestDb;
beforeAll(async () => {
  t = await create_test_db({
    migrate: false,
    pool_max: 1,
    acquire_timeout_ms: 200,
  });
});
afterAll(async () => {
  await t.drop();
});

describe("pool (AC-9)", () => {
  it("[failure] a second concurrent with_tx throws PoolExhausted while the first still commits", async () => {
    await t.db.with_tx((tx) => tx.query("create table held (k text)"));
    const first = t.db.with_tx(async (tx) => {
      await tx.query("insert into held values ('a')");
      await new Promise((r) => setTimeout(r, 600));
      return "ok";
    });
    await new Promise((r) => setTimeout(r, 50));
    const err = await t.db.with_tx(async () => 1).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PoolExhausted);
    expect(err).toMatchObject({ pool: "web" });
    expect((err as PoolExhausted).waited_ms).toBeGreaterThanOrEqual(200);
    expect(await first).toBe("ok");
    const n = await t.db.with_tx(
      async (tx) => (await tx.query("select 1 from held")).rows.length,
    );
    expect(n).toBe(1);
  });

  it("[invariant] ping is true when reachable and false when the database is down", async () => {
    expect(await t.db.ping()).toBe(true);
    const down = new PgDatabase(
      {
        ...settings_for("postgres://ls:x@127.0.0.1:1/x", 1),
        database_url: new SecretStr("postgres://ls:x@127.0.0.1:1/x"),
      },
      1,
      500,
    );
    expect(await down.ping()).toBe(false);
    await down.close();
  });
});
