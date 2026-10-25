import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve_build_id, git_short_sha } from "@ls/obs/build-id";
import { record_ops_event } from "./ops-event.ts";
import type { PgDatabase } from "./pool.ts";
import type { Tx } from "./tx.ts";

export interface MigrationReport {
  applied: string[];
  already_applied: number;
}

export class MigrationError extends Error {
  readonly migration_id: string;
  readonly problem: string;

  constructor(migration_id: string, problem: string) {
    super(`migration ${migration_id}: ${problem}`);
    this.name = "MigrationError";
    this.migration_id = migration_id;
    this.problem = problem;
  }
}

export interface MigrateOptions {
  dir?: string;
  build_id?: string;
  service?: string;
}

interface Pending {
  id: string;
  checksum: string;
}

async function exists(tx: Tx, name: string): Promise<boolean> {
  const r = await tx.query<{ r: string | null }>(
    "SELECT to_regclass($1)::text AS r",
    [name],
  );
  return r.rows[0]?.r != null;
}

async function applied_set(tx: Tx): Promise<Map<string, string>> {
  if (!(await exists(tx, "schema_migrations"))) return new Map();
  const r = await tx.query<{ id: string; checksum: string }>(
    "SELECT id, checksum FROM schema_migrations",
  );
  return new Map(r.rows.map((row) => [row.id, row.checksum]));
}

export async function run_migrations(
  db: PgDatabase,
  opts: MigrateOptions = {},
): Promise<MigrationReport> {
  const dir = opts.dir ?? new URL("../migrations/", import.meta.url).pathname;
  const service = opts.service ?? "migrate";
  const build_id =
    opts.build_id ?? resolve_build_id(process.env, git_short_sha);

  const names = (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort();
  const files: Array<{ id: string; sql: string; checksum: string }> = [];
  for (const id of names) {
    const bytes = await readFile(`${dir}/${id}`);
    files.push({
      id,
      sql: bytes.toString("utf8"),
      checksum: createHash("sha256").update(bytes).digest("hex"),
    });
  }

  const report: MigrationReport = { applied: [], already_applied: 0 };
  // Events for files applied before ops_event exists (0000-0011), written with the file that creates it.
  const deferred: Array<Pending & { at: Date }> = [];

  for (const file of files) {
    try {
      await db.with_tx(async (tx) => {
        const applied = await applied_set(tx);
        // Check every already-applied file first, in order, before applying anything pending.
        for (const f of files) {
          const sum = applied.get(f.id);
          if (sum !== undefined && sum !== f.checksum) {
            throw new MigrationError(
              f.id,
              "checksum mismatch: file changed after it was applied",
            );
          }
        }
        const on_disk = new Set(files.map((f) => f.id));
        for (const id of applied.keys()) {
          if (!on_disk.has(id)) {
            throw new MigrationError(
              id,
              "applied migration has no matching file (deleted or renamed after it was applied)",
            );
          }
        }
        if (applied.has(file.id)) {
          return;
        }
        await tx.query(file.sql);
        await tx.query(
          "INSERT INTO schema_migrations (id, checksum, applied_at) VALUES ($1, $2, now())",
          [file.id, file.checksum],
        );
        const now = new Date();
        if (await exists(tx, "ops_event")) {
          for (const d of deferred) await write_event(tx, d, d.at);
          deferred.length = 0;
          await write_event(tx, file, now);
        } else {
          deferred.push({ id: file.id, checksum: file.checksum, at: now });
        }
        report.applied.push(file.id);
      }, "migrate");
    } catch (err) {
      if (err instanceof MigrationError) throw err;
      throw new MigrationError(
        file.id,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // Backfill: any applied migration without an event (a crash after the file that creates ops_event, or an older run).
  await db.with_tx(async (tx) => {
    if (!(await exists(tx, "ops_event"))) return;
    const missing = await tx.query<{
      id: string;
      checksum: string;
      applied_at: Date;
    }>(
      `SELECT m.id, m.checksum, m.applied_at FROM schema_migrations m
        WHERE NOT EXISTS (SELECT 1 FROM ops_event e
                           WHERE e.kind = 'migration_applied' AND e.details_json ->> 'migration_id' = m.id)
        ORDER BY m.id`,
    );
    for (const m of missing.rows) await write_event(tx, m, m.applied_at);
  }, "migrate");

  report.already_applied = files.length - report.applied.length;
  return report;

  async function write_event(tx: Tx, f: Pending, at: Date): Promise<void> {
    await record_ops_event(tx, {
      kind: "migration_applied",
      service,
      build_id,
      details: { migration_id: f.id, checksum: f.checksum },
      at,
    });
  }
}
