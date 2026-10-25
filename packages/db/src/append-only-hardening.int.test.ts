// NL-08 security-review fixes: TRUNCATE is refused, lesson_version updates are allow-listed, and a deleted migration file fails the runner.
import { mkdtempSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { create_test_db, type TestDb } from "./testing/test-db.ts";
import { insert_row } from "./testing/insert-row.ts";
import { MigrationError, run_migrations } from "./migrate.ts";

const MIGRATIONS = new URL("../migrations/", import.meta.url).pathname;
let t: TestDb;
beforeAll(async () => {
  t = await create_test_db();
});
afterAll(async () => {
  await t.drop();
});
const ins = (table: string, row: Record<string, unknown>) => t.db.with_tx((tx) => insert_row(tx, table, row));

describe("append-only hardening", () => {
  for (const table of ["review_event", "audit_event", "lesson_metrics", "lesson_version"]) {
    it(`[negative] TRUNCATE ${table} raises append-only and keeps the row`, async () => {
      await ins(table, table === "lesson_version" ? { adopted: false } : {});
      await expect(t.db.with_tx((tx) => tx.query(`truncate ${table}`))).rejects.toThrow(
        new RegExp(`append-only: ${table}`),
      );
      const n = await t.db.with_tx(async (tx) => (await tx.query(`select count(*)::int as n from ${table}`)).rows[0]?.["n"]);
      expect(n).toBeGreaterThan(0);
    });
  }

  for (const [col, val] of [
    ["created_by", "'someone-else'"],
    ["model_call_ids", `'["x"]'::jsonb`],
  ] as const) {
    it(`[negative] UPDATE of lesson_version.${col} raises`, async () => {
      const r = await ins("lesson_version", { adopted: false });
      await expect(
        t.db.with_tx((tx) => tx.query(`update lesson_version set ${col}=${val} where id=$1`, [r["id"]])),
      ).rejects.toThrow(/append-only: lesson_version/);
    });
  }

  it("[invariant] adopted false to true is still allowed", async () => {
    const r = await ins("lesson_version", { adopted: false });
    await t.db.with_tx((tx) => tx.query("update lesson_version set adopted=true where id=$1", [r["id"]]));
  });

  it("[negative] an applied migration whose file is gone fails the runner", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mig-"));
    try {
      cpSync(MIGRATIONS, dir, { recursive: true });
      // t was migrated from the real directory; run against a copy missing the last file.
      rmSync(join(dir, "0012_evidence.sql"));
      await expect(run_migrations(t.db, { dir })).rejects.toThrow(MigrationError);
      await expect(run_migrations(t.db, { dir })).rejects.toThrow(/0012_evidence\.sql.*no matching file/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
