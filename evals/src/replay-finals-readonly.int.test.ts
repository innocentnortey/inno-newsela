// F4-3 on a real Postgres: a URL that asks for read-only OFF must still not be able to write.
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ReplaySetupError, connect_read_only } from "./replay-finals-readonly.ts";

let t: TestDb;
beforeAll(async () => { t = await create_test_db({ migrate: false }); });
afterAll(async () => { await t.drop(); });

describe("read-only on Postgres", () => {
  it("test_write_rejected_even_when_url_says_read_only_off", async () => {
    const off = `${t.url}${t.url.includes("?") ? "&" : "?"}options=-c%20default_transaction_read_only%3Doff`;
    const { db, evidence } = await connect_read_only({ DATABASE_URL: off });
    try {
      expect(evidence.write_probe).toBe("rejected_25006");
      await expect(db.with_tx(async (tx) => { await tx.query("create table replay_must_not_exist (x int)"); })).rejects.toMatchObject({ code: "25006" });
      expect(await db.with_tx(async (tx) => (await tx.query("select 1 as one")).rows[0])).toEqual({ one: 1 });
      const left = await t.db.with_tx(async (tx) => (await tx.query("select to_regclass('replay_must_not_exist') as r")).rows[0]);
      expect(left).toEqual({ r: null });
    } finally {
      await db.close();
    }
  });
  it("test_setup_failure_does_not_fall_back", async () => {
    let err: unknown;
    try { await connect_read_only({ DATABASE_URL: "postgres://u:p@127.0.0.1:1/none", TEST_DATABASE_URL: t.url }); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(ReplaySetupError);
    expect((err as ReplaySetupError).code).toBe("connect_failed");
    expect((err as Error).message).not.toContain(":p@");
  });
});
