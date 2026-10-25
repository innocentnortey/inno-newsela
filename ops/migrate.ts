// `npm run db:migrate` (WF-36): apply the SQL files in packages/db/migrations and record each one.
import { pathToFileURL } from "node:url";
import { read_int, read_secret_url, type Env } from "@ls/config/env";
import { git_short_sha, resolve_build_id } from "@ls/obs/build-id";
import {
  run_migrations,
  MigrationError,
  type MigrationReport,
} from "@ls/db/migrate";
import { PgDatabase } from "@ls/db/pool";

export async function main(env: Env = process.env): Promise<MigrationReport> {
  const build_id = resolve_build_id(env, git_short_sha);
  const settings = {
    database_url: read_secret_url(env, "DATABASE_URL", [
      "postgres:",
      "postgresql:",
    ]),
    pg_pool_max: 1,
    build_id,
    log_level: "info" as const,
  };
  const acquire_timeout_ms = read_int(env, "PG_ACQUIRE_TIMEOUT_MS", {
    default: 2000,
    min: 1,
  });
  const db = new PgDatabase(settings, 1, acquire_timeout_ms);
  try {
    return await run_migrations(db, { build_id, service: "migrate" });
  } finally {
    await db.close();
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().then(
    (report) => {
      console.log(
        JSON.stringify({
          event: "migrations",
          applied: report.applied,
          already_applied: report.already_applied,
        }),
      );
      process.exit(0);
    },
    (err: unknown) => {
      const e =
        err instanceof MigrationError
          ? { migration_id: err.migration_id, problem: err.problem }
          : { problem: err instanceof Error ? err.message : "unknown error" };
      console.error(JSON.stringify({ event: "migrations_failed", ...e }));
      process.exit(1);
    },
  );
}
