// Test helper (NOT frozen): one fresh, migrated database per test file.
// Never points at anything but TEST_DATABASE_URL (default: this project's docker-compose.test.yml).
import { randomBytes } from "node:crypto";
import pg from "pg";
import { SecretStr } from "@ls/config/secret";
import type { SharedSettings } from "@ls/config/settings";
import { PgDatabase } from "../pool.ts";
import { run_migrations } from "../migrate.ts";

export const TEST_DATABASE_URL: string =
  process.env["TEST_DATABASE_URL"] ??
  "postgres://ls:ls_dev_only@127.0.0.1:55440/ls_test";

// Test databases are created and dropped on this server, so it must be local (security review, 2026-10-25).
const host = new URL(TEST_DATABASE_URL).hostname;
if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host)) {
  throw new Error(`TEST_DATABASE_URL must point at a local database (found host ${host.length > 40 ? "<long>" : host})`);
}

export interface TestDb {
  db: PgDatabase;
  url: string;
  name: string;
  drop(): Promise<void>;
}

export function settings_for(url: string, pool_max: number): SharedSettings {
  return {
    database_url: new SecretStr(url),
    pg_pool_max: pool_max,
    build_id: "test",
    log_level: "info",
  };
}

export async function create_test_db(
  opts: {
    migrate?: boolean;
    pool_max?: number;
    acquire_timeout_ms?: number;
  } = {},
): Promise<TestDb> {
  const name = `ls_t_${randomBytes(6).toString("hex")}`;
  const admin = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE ${name}`);
  } finally {
    await admin.end();
  }
  const u = new URL(TEST_DATABASE_URL);
  u.pathname = `/${name}`;
  const url = u.toString();
  const db = new PgDatabase(
    settings_for(url, opts.pool_max ?? 4),
    opts.pool_max ?? 4,
    opts.acquire_timeout_ms ?? 2000,
  );
  if (opts.migrate !== false) await run_migrations(db);
  return {
    db,
    url,
    name,
    async drop() {
      await db.close();
      const a = new pg.Client({ connectionString: TEST_DATABASE_URL });
      await a.connect();
      try {
        await a.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      } finally {
        await a.end();
      }
    },
  };
}
