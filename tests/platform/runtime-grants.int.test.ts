// NL-23 AC-11 (risk::security) FROZEN: the runtime Postgres role is not the owner and cannot
// TRUNCATE / UPDATE / DELETE the append-only tables. The grants script is
// scripts/apply-runtime-grants.mjs, configured by DATABASE_URL (owner) and RUNTIME_DATABASE_URL.
// Needs this project's test Postgres (host port 55440, TEST_DATABASE_URL).
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { create_test_db, type TestDb } from "../../packages/db/src/testing/test-db.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPT = path.join(root, "scripts/apply-runtime-grants.mjs");
const APPEND_ONLY = ["review_event", "audit_event", "lesson_metrics", "lesson_version"] as const;
const ROLE = `ls_rt_${randomBytes(6).toString("hex")}`;
const PASSWORD = randomBytes(12).toString("hex");

let t: TestDb;
let runtime_url: string;

function run_script(env: Record<string, string>) {
  const r = spawnSync("node", [SCRIPT], { cwd: root, encoding: "utf8", env: { PATH: process.env["PATH"] ?? "", ...env } });
  return { status: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
}
async function as_owner<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: t.url });
  await c.connect();
  try { return await fn(c); } finally { await c.end(); }
}
async function as_runtime<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: runtime_url });
  await c.connect();
  try { return await fn(c); } finally { await c.end(); }
}
async function code_of(c: pg.Client, sql: string): Promise<string> {
  try { await c.query(sql); return "ok"; } catch (e) { return (e as { code?: string }).code ?? "unknown"; }
}

beforeAll(async () => {
  t = await create_test_db();
  const u = new URL(t.url);
  u.username = ROLE;
  u.password = PASSWORD;
  runtime_url = u.toString();
  const r = run_script({ DATABASE_URL: t.url, RUNTIME_DATABASE_URL: runtime_url });
  (globalThis as Record<string, unknown>)["__nl23_first_run"] = r;
}, 60_000);

afterAll(async () => {
  if (!t) return;
  const c = new pg.Client({ connectionString: t.url });
  await c.connect();
  await c.query(`DROP OWNED BY ${ROLE}`).catch(() => undefined);
  await c.query(`DROP ROLE IF EXISTS ${ROLE}`).catch(() => undefined);
  await c.end();
  await t.drop();
});

describe("NL-23 AC-11 [invariant] runtime role is least-privilege", () => {
  it("test_grants_script_exists_and_first_run_succeeds", () => {
    expect(fs.existsSync(SCRIPT), "scripts/apply-runtime-grants.mjs exists").toBe(true);
    const r = (globalThis as Record<string, unknown>)["__nl23_first_run"] as { status: number | null; out: string };
    expect(r.status, r.out).toBe(0);
    expect(r.out).not.toContain(PASSWORD);
  });

  it("test_runtime_role_is_not_owner_or_superuser", async () => {
    const q = await as_owner((c) => c.query<{ rolsuper: boolean; rolcreaterole: boolean; rolcreatedb: boolean }>(
      "select rolsuper, rolcreaterole, rolcreatedb from pg_roles where rolname=$1", [ROLE]));
    expect(q.rows).toHaveLength(1);
    expect(q.rows[0]).toEqual({ rolsuper: false, rolcreaterole: false, rolcreatedb: false });
    const owners = await as_owner((c) => c.query<{ tableowner: string }>(
      "select distinct tableowner from pg_tables where schemaname='public'"));
    expect(owners.rows.map((r) => r.tableowner)).not.toContain(ROLE);
  });

  it("test_runtime_can_insert_ops_event_and_read", async () => {
    await as_runtime(async (c) => {
      await c.query("insert into ops_event (id, kind, build_id, service) values ($1,'process_start','nl23-test','worker')", [`ev_${ROLE}`]);
      const r = await c.query("select count(*)::int as n from ops_event where id=$1", [`ev_${ROLE}`]);
      expect(r.rows[0].n).toBe(1);
    });
  });

  it.each(APPEND_ONLY)("test_truncate_denied_on_append_only: %s (SQLSTATE 42501)", async (table) => {
    await as_runtime(async (c) => {
      expect(await code_of(c, `TRUNCATE ${table}`)).toBe("42501");
    });
  });

  it.each(["ops_event", "schema_migrations"])("test_truncate_denied_on_logically_append_only: %s", async (table) => {
    await as_runtime(async (c) => {
      expect(await code_of(c, `TRUNCATE ${table}`)).toBe("42501");
    });
  });

  it.each(["review_event", "audit_event", "lesson_metrics", "ops_event"])(
    "test_update_delete_denied: %s (42501 and no privilege)", async (table) => {
      await as_runtime(async (c) => {
        expect(await code_of(c, `DELETE FROM ${table} WHERE false`)).toBe("42501");
        const p = await c.query<{ u: boolean; d: boolean; tr: boolean }>(
          `select has_table_privilege(current_user,'${table}','UPDATE') u, has_table_privilege(current_user,'${table}','DELETE') d, has_table_privilege(current_user,'${table}','TRUNCATE') tr`);
        expect(p.rows[0]).toEqual({ u: false, d: false, tr: false });
      });
    });

  it("test_lesson_version_update_kept_delete_revoked", async () => {
    await as_runtime(async (c) => {
      const p = await c.query<{ u: boolean; d: boolean; tr: boolean; i: boolean }>(
        "select has_table_privilege(current_user,'lesson_version','UPDATE') u, has_table_privilege(current_user,'lesson_version','DELETE') d, has_table_privilege(current_user,'lesson_version','TRUNCATE') tr, has_table_privilege(current_user,'lesson_version','INSERT') i");
      expect(p.rows[0]).toEqual({ u: true, d: false, tr: false, i: true });
      expect(await code_of(c, "DELETE FROM lesson_version WHERE false")).toBe("42501");
    });
  });

  it("test_no_table_with_guard_trigger_is_truncatable_or_deletable_by_runtime (drift guard)", async () => {
    const guarded = await as_owner((c) => c.query<{ relname: string }>(
      `select distinct c.relname from pg_trigger g join pg_class c on c.oid=g.tgrelid join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and not g.tgisinternal`));
    expect(guarded.rows.length).toBeGreaterThanOrEqual(4);
    await as_runtime(async (c) => {
      for (const { relname } of guarded.rows) {
        const p = await c.query<{ tr: boolean; d: boolean }>(
          `select has_table_privilege(current_user,$1,'TRUNCATE') tr, has_table_privilege(current_user,$1,'DELETE') d`, [relname]);
        expect(p.rows[0]!.tr, `${relname} TRUNCATE`).toBe(false);
        expect(p.rows[0]!.d, `${relname} DELETE`).toBe(false);
      }
    });
  });

  it("test_second_run_idempotent", async () => {
    const r = run_script({ DATABASE_URL: t.url, RUNTIME_DATABASE_URL: runtime_url });
    expect(r.status, r.out).toBe(0);
    await as_runtime(async (c) => {
      expect(await code_of(c, "TRUNCATE review_event")).toBe("42501");
      expect(await code_of(c, "select 1")).toBe("ok");
    });
  });

  it("test_refuses_runtime_role_equal_to_owner_and_never_prints_password (negative)", async () => {
    const owner = new URL(t.url);
    const r = run_script({ DATABASE_URL: t.url, RUNTIME_DATABASE_URL: t.url });
    expect(r.status).not.toBe(0);
    expect(r.out).not.toContain(decodeURIComponent(owner.password));
    expect(fs.existsSync(SCRIPT)).toBe(true); // a missing script must not satisfy this test
  });

  it("test_refuses_missing_runtime_url_naming_variable_only (boundary)", () => {
    const r = run_script({ DATABASE_URL: t.url });
    expect(r.status).not.toBe(0);
    expect(r.out).toContain("RUNTIME_DATABASE_URL");
    expect(r.out).not.toContain(new URL(t.url).password);
  });
});
