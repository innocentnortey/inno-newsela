// NL-08 AC-4 [negative] R-35: history cannot be rewritten. 9 cases; the row reads back identical after each refusal.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { create_test_db, type TestDb } from "./testing/test-db.ts";
import { insert_row } from "./testing/insert-row.ts";

let t: TestDb;
beforeAll(async () => {
  t = await create_test_db();
});
afterAll(async () => {
  await t.drop();
});

const ins = (table: string, row: Record<string, unknown>) => t.db.with_tx((tx) => insert_row(tx, table, row));
const read = (table: string, key: string, id: unknown) =>
  t.db.with_tx(async (tx) => (await tx.query(`select to_jsonb(${table}.*) as row from ${table} where ${key}=$1`, [id])).rows[0]?.row);

async function refuses(table: string, key: string, id: unknown, sql: string, message: RegExp) {
  const before = await read(table, key, id);
  expect(before).toBeDefined();
  await expect(t.db.with_tx((tx) => tx.query(sql, [id]))).rejects.toThrow(message);
  expect(await read(table, key, id)).toEqual(before);
}

describe("append-only triggers (AC-4)", () => {
  for (const [table, set] of [
    ["review_event", "note='rewritten'"],
    ["audit_event", "reason='rewritten'"],
  ] as const) {
    it(`[negative] UPDATE on ${table} raises append-only: ${table}`, async () => {
      const r = await ins(table, {});
      await refuses(table, "id", r["id"], `update ${table} set ${set} where id=$1`, new RegExp(`append-only: ${table}`));
    });
    it(`[negative] DELETE on ${table} raises append-only: ${table}`, async () => {
      const r = await ins(table, {});
      await refuses(table, "id", r["id"], `delete from ${table} where id=$1`, new RegExp(`append-only: ${table}`));
    });
  }

  it("[negative] UPDATE on lesson_metrics raises append-only: lesson_metrics", async () => {
    const r = await ins("lesson_metrics", {});
    await refuses("lesson_metrics", "lesson_id", r["lesson_id"], "update lesson_metrics set human_sessions=99 where lesson_id=$1", /append-only: lesson_metrics/);
  });
  it("[negative] DELETE on lesson_metrics raises append-only: lesson_metrics", async () => {
    const r = await ins("lesson_metrics", {});
    await refuses("lesson_metrics", "lesson_id", r["lesson_id"], "delete from lesson_metrics where lesson_id=$1", /append-only: lesson_metrics/);
  });

  it("[negative] UPDATE of lesson_version.content_hash raises", async () => {
    const r = await ins("lesson_version", { adopted: false });
    await refuses("lesson_version", "id", r["id"], "update lesson_version set content_hash='tampered' where id=$1", /append-only: lesson_version/);
  });
  it("[negative] DELETE on lesson_version raises", async () => {
    const r = await ins("lesson_version", { adopted: false });
    await refuses("lesson_version", "id", r["id"], "delete from lesson_version where id=$1", /append-only: lesson_version/);
  });
  it("[negative] lesson_version.adopted flips false to true once, and not back", async () => {
    const r = await ins("lesson_version", { adopted: false });
    const id = r["id"];
    await t.db.with_tx((tx) => tx.query("update lesson_version set adopted=true where id=$1", [id]));
    expect((await read("lesson_version", "id", id))?.["adopted"]).toBe(true);
    await refuses("lesson_version", "id", id, "update lesson_version set adopted=false where id=$1", /append-only: lesson_version/);
  });
});
