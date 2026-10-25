// WF-35: run docs/data/scripts/build_samples.py once and record one `samples.built` ops_event with input and output hashes.
// Usage: tsx ops/run-sample-builder.ts [--root <dir>]. Relative paths only in the event.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { read_secret_url } from "@ls/config/env";
import { git_short_sha, resolve_build_id } from "@ls/obs/build-id";
import { record_ops_event } from "@ls/db/ops-event";
import { PgDatabase } from "@ls/db/pool";

const SHEET = "docs/data/samples/g6-u4-lesson-outline.json";
const SCRIPT = "docs/data/scripts/build_samples.py";
const SAMPLES = "docs/data/samples";

const sha = (p: string): string => createHash("sha256").update(readFileSync(p)).digest("hex");
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : statSync(p).isFile() ? [p] : [];
  });
}

export async function main(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const i = argv.indexOf("--root");
  const root = path.resolve(i >= 0 && argv[i + 1] ? argv[i + 1]! : path.resolve(import.meta.dirname, ".."));
  if (!env["DATABASE_URL"]) {
    process.stderr.write("samples: DATABASE_URL is not set\n");
    return 2;
  }
  try {
    const build_id = env["BUILD_ID"] ? env["BUILD_ID"] : resolve_build_id(env, git_short_sha);
    const settings = {
      database_url: read_secret_url(env, "DATABASE_URL", ["postgres:", "postgresql:"]),
      pg_pool_max: 1,
      build_id,
      log_level: "info" as const,
    };
    const inputs = { [SHEET]: sha(path.join(root, SHEET)), [SCRIPT]: sha(path.join(root, SCRIPT)) };
    const run = spawnSync("python3", [path.join(root, SCRIPT)], {
      cwd: root,
      env: { PATH: env["PATH"] ?? "", LANG: env["LANG"] ?? "C.UTF-8" },
      stdio: "ignore",
    });
    if (run.status !== 0) {
      process.stderr.write(`samples: build_samples.py exited ${run.status ?? "abnormally"}\n`);
      return 1;
    }
    const outs = walk(path.join(root, SAMPLES))
      .map((p) => path.relative(root, p).split(path.sep).join("/"))
      .filter((p) => p !== SHEET)
      .sort();
    const outputs = Object.fromEntries(outs.map((p) => [p, sha(path.join(root, p))]));
    const db = new PgDatabase(settings, 1, 2000);
    try {
      const id = await record_ops_event(db, {
        kind: "samples.built", service: "ops", build_id,
        details: { inputs, outputs, output_count: outs.length },
      });
      process.stdout.write(`${JSON.stringify({ event: "ops_event", id, output_count: outs.length })}\n`);
    } finally {
      await db.close().catch(() => undefined);
    }
    return 0;
  } catch (e) {
    process.stderr.write(`samples: failed: ${e instanceof Error ? e.name : "Error"}\n`);
    return 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((c) => process.exit(c));
}
