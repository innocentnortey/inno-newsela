// NL-08 AC-1..AC-3: the migration runner against a real Postgres.
import { execFileSync } from "node:child_process";
import {
  cpSync,
  appendFileSync,
  mkdtempSync,
  writeFileSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { create_test_db, type TestDb } from "./testing/test-db.ts";
import { MigrationError, run_migrations } from "./migrate.ts";

export const TABLES_DO3_S6 = [
  "alignment_link",
  "app_session",
  "app_user",
  "audit_event",
  "check_job",
  "eval_case_result",
  "eval_run",
  "experiment_run",
  "export_bundle",
  "heartbeat",
  "intake_choice",
  "issue",
  "judge_verdict",
  "lesson",
  "lesson_doc",
  "lesson_job",
  "lesson_link",
  "lesson_metrics",
  "lesson_version",
  "model_call",
  "ops_event",
  "outline_row",
  "outline_version",
  "probe_run",
  "prompt_version",
  "review_event",
  "review_session",
  "run",
  "safety_flag",
  "schema_migrations",
  "spend_reservation",
  "standard",
  "suggestion",
  "unit",
  "unit_plan",
];
const MIGRATIONS = new URL("../migrations/", import.meta.url).pathname;
const REPO = new URL("../../../", import.meta.url).pathname;

const rows = async (t: TestDb, sql: string) =>
  t.db.with_tx(async (tx) => (await tx.query(sql)).rows);
const dbs: TestDb[] = [];
async function fresh(migrate: boolean) {
  const t = await create_test_db({ migrate });
  dbs.push(t);
  return t;
}
afterAll(async () => {
  for (const t of dbs) await t.drop();
});

describe("migrations (AC-1..3)", () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await fresh(true);
  });

  it("[invariant] applies_all: 14 files, exactly the 35 tables and the view audit_log_v", async () => {
    const tables = await rows(
      t,
      "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1",
    );
    expect(tables.map((r) => r["table_name"])).toEqual(TABLES_DO3_S6);
    expect(TABLES_DO3_S6).toHaveLength(35);
    const views = await rows(
      t,
      "select table_name from information_schema.views where table_schema='public'",
    );
    expect(views.map((r) => r["table_name"])).toEqual(["audit_log_v"]);
    const m = await rows(t, "select id from schema_migrations order by id");
    expect(m.map((r) => r["id"])).toEqual(readdirSync(MIGRATIONS).sort());
    expect(m).toHaveLength(14);
  });

  it("[capture] test_migrations_recorded: ops/migrate.ts writes 14 migrations + 14 ops events; rerun applies none", async () => {
    const u = await fresh(false);
    const run = () =>
      execFileSync("npx", ["tsx", "ops/migrate.ts"], {
        cwd: REPO,
        env: { ...process.env, DATABASE_URL: u.url },
        encoding: "utf8",
      });
    const first = JSON.parse(run().trim().split("\n").pop()!);
    expect(first.applied).toHaveLength(14);
    expect(await rows(u, "select 1 from schema_migrations")).toHaveLength(14);
    const ev = await rows(
      u,
      "select kind, service, build_id, details_json from ops_event",
    );
    expect(ev).toHaveLength(14);
    for (const e of ev) {
      expect(e["kind"]).toBe("migration_applied");
      expect(e["service"]).toBe("migrate");
      expect(String(e["build_id"])).not.toBe("");
    }
    const ids = ev
      .map((e) => (e["details_json"] as { migration_id: string }).migration_id)
      .sort();
    expect(ids).toEqual(readdirSync(MIGRATIONS).sort());
    const second = JSON.parse(run().trim().split("\n").pop()!);
    expect(second).toMatchObject({ applied: [], already_applied: 14 });
    expect(await rows(u, "select 1 from ops_event")).toHaveLength(14);
  }, 60_000);

  it("[failure] checksum_mismatch_refused: a changed applied file throws MigrationError and applies nothing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mig-"));
    cpSync(MIGRATIONS, dir, { recursive: true });
    const u = await fresh(false);
    await run_migrations(u.db, { dir });
    appendFileSync(join(dir, "0003_prompts.sql"), "\n-- tampered\n");
    writeFileSync(
      join(dir, "0014_extra.sql"),
      "create table extra_t (id text);",
    );
    const err = await run_migrations(u.db, { dir }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MigrationError);
    expect((err as MigrationError).migration_id).toBe("0003_prompts.sql");
    expect(await rows(u, "select 1 from schema_migrations")).toHaveLength(14);
    expect(await rows(u, "select to_regclass('extra_t')::text as r")).toEqual([
      { r: null },
    ]);
  });

  it("[failure] failed_migration_rolls_back: no table, no row for the failing file; earlier file stays", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mig-"));
    cpSync(
      join(MIGRATIONS, "0000_migrations.sql"),
      join(dir, "0000_migrations.sql"),
    );
    writeFileSync(
      join(dir, "0001_bad.sql"),
      "create table t(); select * from missing;",
    );
    const u = await fresh(false);
    const err = await run_migrations(u.db, { dir }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MigrationError);
    expect((err as MigrationError).migration_id).toBe("0001_bad.sql");
    expect(await rows(u, "select to_regclass('t')::text as r")).toEqual([
      { r: null },
    ]);
    expect(
      (await rows(u, "select id from schema_migrations")).map((r) => r["id"]),
    ).toEqual(["0000_migrations.sql"]);
  });
});
