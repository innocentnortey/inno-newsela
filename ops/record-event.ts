// CLI used by ops/backup.sh: tsx ops/record-event.ts <kind> <service> <details-json>
// Writes one ops_event. DATABASE_URL comes from the environment only. Never prints the URL or an error message.
import { pathToFileURL } from "node:url";
import { read_secret_url } from "@ls/config/env";
import { git_short_sha, resolve_build_id } from "@ls/obs/build-id";
import { record_ops_event } from "@ls/db/ops-event";
import { PgDatabase } from "@ls/db/pool";

const KINDS = new Set(["backup", "samples.built"]);

export async function main(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const [kind, service, details_json] = argv;
  if (!kind || !KINDS.has(kind) || !service || !details_json) {
    process.stderr.write("usage: record-event <backup|samples.built> <service> <details-json>\n");
    return 2;
  }
  try {
    const details = JSON.parse(details_json) as Record<string, unknown>;
    const build_id = env["BUILD_ID"] ? env["BUILD_ID"] : resolve_build_id(env, git_short_sha);
    const settings = {
      database_url: read_secret_url(env, "DATABASE_URL", ["postgres:", "postgresql:"]),
      pg_pool_max: 1,
      build_id,
      log_level: "info" as const,
    };
    const db = new PgDatabase(settings, 1, 2000);
    try {
      const id = await record_ops_event(db, { kind, service, build_id, details });
      process.stdout.write(`${JSON.stringify({ event: "ops_event", id })}\n`);
    } finally {
      await db.close().catch(() => undefined);
    }
    return 0;
  } catch (e) {
    process.stderr.write(`record-event failed: ${e instanceof Error ? e.name : "Error"}\n`);
    return 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((c) => process.exit(c));
}
