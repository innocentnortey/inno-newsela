// NL-121: `npm run eval:heldout`. Compares the generated G6.U4 (database) with the published one (git-ignored folder)
// by structure only. Prints integers, fixed words and the run id; never a message from a file or JSON operation.
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { read_secret_url } from "@ls/config/env";
import type { SharedSettings } from "@ls/config/settings";
import { SystemClock, type Clock } from "@ls/core/ports/clock";
import type { EvidenceRepo } from "@ls/core/ports/evidence";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { PgDatabase } from "@ls/db/pool";
import { PgEvidenceRepo } from "@ls/db/repos/evidence";
import { resolve_git_sha } from "../git-sha.ts";
import { EvalRunner } from "../runner.ts";
import { make_s11 } from "../suites/s11.ts";
import { build_report, compare_lesson, HeldoutEmpty } from "./compare.ts";
import type { LessonCounts } from "./schema.ts";
import { HeldoutReport } from "./schema.ts";
import { make_pg_generated_reader, type GeneratedReader } from "./generated.ts";
import { assert_output_ignored, RefusedPath } from "./guard.ts";
import { DEFAULT_PUBLISHED_DIR, read_published } from "./published.ts";

export interface HeldoutDeps {
  evidence: EvidenceRepo;
  clock: Clock;
  reader: GeneratedReader;
  git_sha: string;
  repo_root: string;
  published_dir?: string; // default join(repo_root, DEFAULT_PUBLISHED_DIR); tests pass the stand-in
  out: (line: string) => void;
  err: (line: string) => void;
  env: Record<string, string | undefined>;
}

const USAGE = "usage: cli.ts [--unit G6-U4]";
const FAILED = "heldout failed (see exit code); no content printed";

function args_ok(argv: string[]): boolean {
  if (argv.length === 0) return true;
  return argv.length === 2 && argv[0] === "--unit" && (argv[1] === "G6-U4" || argv[1] === "G6.U4");
}

export async function run_heldout(argv: string[], deps: HeldoutDeps): Promise<number> {
  if (!args_ok(argv)) {
    deps.err(USAGE);
    return 2;
  }
  const out_rel = `evals/local/held-out/${deps.clock.now().toISOString().slice(0, 10)}.json`;
  try {
    assert_output_ignored(deps.repo_root, out_rel);
  } catch (e) {
    if (e instanceof RefusedPath) {
      deps.err("held-out report path is not ignored or is tracked; refusing to run");
      return 2;
    }
    throw e;
  }
  const dir = deps.published_dir ?? path.join(deps.repo_root, DEFAULT_PUBLISHED_DIR);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    deps.err("published folder is missing");
    return 2;
  }

  const generated = await deps.reader.lessons("G6.U4");
  const compared: LessonCounts[] = [];
  const failed = new Map<number, "unreadable" | "no_published">();
  let unreadable = 0;
  let no_published = 0;
  for (const g of generated.lessons) {
    const p = read_published(dir, g.number);
    if (p.kind === "ok") compared.push(compare_lesson(g.number, g.facts, p.facts));
    else if (p.kind === "missing") {
      no_published++;
      failed.set(g.number, "no_published");
    } else {
      deps.err(`lesson ${g.number} unreadable`);
      unreadable++;
      failed.set(g.number, "unreadable");
    }
  }

  let report: HeldoutReport;
  try {
    report = HeldoutReport.parse(build_report(generated.lessons.length, compared, unreadable, no_published));
  } catch (e) {
    if (e instanceof HeldoutEmpty) {
      deps.err("no lessons could be compared; nothing written");
      return 2;
    }
    throw e;
  }

  const by_number = new Map(compared.map((c) => [c.number, c] as const));
  const suite = make_s11("stub", {
    cases: generated.lessons.map((g) => ({ number: g.number })),
    score: async (n) => {
      const c = by_number.get(n);
      if (c !== undefined) return { passed: true, failure_category: null, counts: { ...c } };
      return { passed: false, failure_category: failed.get(n) ?? "unreadable", counts: { number: n } };
    },
  });
  const runner = new EvalRunner(deps.evidence, [suite], deps.clock, {
    repo_root: deps.repo_root, reports_dir: path.join(deps.repo_root, "evals/local/reports"),
    prompt_version_id: null, models: { provider_mode_note: "no model call" }, env: deps.env,
  });
  const summary = await runner.run("S11", { repeat: 1, provider_mode: "stub", git_sha: deps.git_sha, unit: "G6.U4" });

  const out_abs = path.join(deps.repo_root, out_rel);
  mkdirSync(path.dirname(out_abs), { recursive: true });
  writeFileSync(out_abs, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  deps.out(`heldout compared=${report.lessons_compared} type_match=${report.type_match_count} sequence_match=${report.sequence_match_count} eval_run_id=${summary.eval_run_id}`);
  return 0;
}

async function main(): Promise<number> {
  const env = process.env;
  const repo_root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  let db: PgDatabase | null = null;
  try {
    const settings: SharedSettings = {
      database_url: read_secret_url(env, "DATABASE_URL", ["postgres:", "postgresql:"]),
      pg_pool_max: 2, build_id: env["BUILD_ID"] ?? "dev", log_level: "info",
    };
    db = new PgDatabase(settings, 2, 5000, "worker");
    const clock = new SystemClock();
    const ids = new PrefixedIdGenerator();
    return await run_heldout(process.argv.slice(2), {
      evidence: new PgEvidenceRepo({ db, ids, clock }), clock, reader: make_pg_generated_reader(db),
      git_sha: resolve_git_sha(env), repo_root, env,
      out: (l) => process.stdout.write(`${l}\n`), err: (l) => process.stderr.write(`${l}\n`),
    });
  } catch {
    process.stderr.write(`${FAILED}\n`);
    return 2;
  } finally {
    if (db !== null) await db.close();
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
