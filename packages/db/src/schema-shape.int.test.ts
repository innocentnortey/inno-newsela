// NL-08 AC-6 / AC-7: money and time types; review time cannot be tied to a name (GR-15, OBS-7); no plain secrets.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { create_test_db, type TestDb } from "./testing/test-db.ts";

let t: TestDb;
beforeAll(async () => {
  t = await create_test_db();
});
afterAll(async () => {
  await t.drop();
});

const columns = () =>
  t.db.with_tx(
    async (tx) =>
      (
        await tx.query<{ table_name: string; column_name: string; data_type: string; numeric_precision: number | null; numeric_scale: number | null }>(
          `select c.table_name, c.column_name, c.data_type, c.numeric_precision, c.numeric_scale
             from information_schema.columns c join information_schema.tables tb
               on tb.table_schema=c.table_schema and tb.table_name=c.table_name and tb.table_type='BASE TABLE'
            where c.table_schema='public'`,
        )
      ).rows,
  );

describe("schema shape", () => {
  it("[invariant] money_and_time_types: *_usd is numeric(12,6); *_at, at, lease_until are timestamptz", async () => {
    const cols = await columns();
    expect(cols.length).toBeGreaterThan(100);
    const usd = cols.filter((c) => c.column_name.endsWith("_usd"));
    expect(usd.length).toBeGreaterThan(5);
    const bad_usd = usd.filter((c) => !(c.data_type === "numeric" && c.numeric_precision === 12 && c.numeric_scale === 6));
    const times = cols.filter((c) => c.column_name.endsWith("_at") || c.column_name === "at" || c.column_name === "lease_until");
    expect(times.length).toBeGreaterThan(10);
    const bad_time = times.filter((c) => c.data_type !== "timestamp with time zone");
    expect([...bad_usd, ...bad_time]).toEqual([]);
  });

  it("[negative] no_person_minutes: lesson_metrics has no user column and no view reads review_session or heartbeat (GR-15)", async () => {
    const cols = await columns();
    const lm = cols.filter((c) => c.table_name === "lesson_metrics").map((c) => c.column_name);
    expect(lm).toEqual(expect.arrayContaining(["lesson_id", "active_minutes", "approved_at"]));
    expect(lm.filter((n) => /user|person|reviewer|actor|name|email/.test(n))).toEqual([]);
    const views = await t.db.with_tx(async (tx) => (await tx.query<{ viewname: string; definition: string }>("select viewname, definition from pg_views where schemaname='public'")).rows);
    expect(views.map((v) => v.viewname)).toContain("audit_log_v");
    expect(views.filter((v) => /review_session|heartbeat|active_seconds/.test(v.definition)).map((v) => v.viewname)).toEqual([]);
  });

  it("[negative] no_plain_secret_columns: only password_hash and token_hash hold credentials (OBS-7)", async () => {
    const cols = await columns();
    const names = cols.map((c) => c.column_name);
    expect(names).toContain("password_hash");
    expect(names).toContain("token_hash");
    const plain = cols.filter(({ column_name: n }) => {
      if (n.endsWith("_hash")) return false;
      return /^(password|token|api_key|secret)$/.test(n) || /(password|api_key|secret)/.test(n) || /_token$/.test(n);
    });
    expect(plain).toEqual([]);
  });
});
