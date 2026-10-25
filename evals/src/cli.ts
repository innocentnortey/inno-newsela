// NL-49: `npx tsx evals/src/cli.ts <subcommand> [flags]`. Exit 0 floors met, 1 floor missed, 2 usage/empty/not built/guard.
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ConfigError } from "@ls/config/errors";
import { read_secret_url, read_string } from "@ls/config/env";
import type { SharedSettings } from "@ls/config/settings";
import { InvariantViolation } from "@ls/core/errors";
import { SystemClock, type Clock } from "@ls/core/ports/clock";
import type { JsonValue } from "@ls/core/ports/common";
import type { EvidenceRepo } from "@ls/core/ports/evidence";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { PgDatabase } from "@ls/db/pool";
import type { IdGenerator } from "@ls/core/ports/ids";
import { PgEvidenceRepo } from "@ls/db/repos/evidence";
import { UnitId } from "@ls/schema/ids";
import { EmptySuiteError, NotImplemented } from "./errors.ts";
import { floor_met } from "./floors.ts";
import { make_fixture_suite } from "./fixture-suite.ts";
import { resolve_git_sha } from "./git-sha.ts";
import { read_key } from "./seed/key.ts";
import { plant_all } from "./seed/plant.ts";
import { run_score } from "./seed/score.ts";
import type { SeedDeps } from "./seed/deps.ts";
import { default_suite_factory, resolve_suite } from "./registry.ts";
import { EvalRunner } from "./runner.ts";
import type { ProviderMode, SuiteFactory, SuiteName } from "./types.ts";

export interface CliDeps {
  evidence: EvidenceRepo;
  clock: Clock;
  suite_factory: SuiteFactory;
  git_sha: string;
  repo_root: string;
  reports_dir?: string;
  prompt_version_id: string | null;
  models: JsonValue;
  env: Record<string, string | undefined>;
  out: (line: string) => void;
  err: (line: string) => void;
  seed?: { db: PgDatabase; ids: IdGenerator; planter_email?: string }; // NL-92: only `seed --plan|--score` needs a database handle
}

export interface CliArgs {
  suites: SuiteName[];
  repeat: number;
  provider_mode: ProviderMode;
  unit: string | null;
  fixture: boolean;
  plan: string | null;
  score: string | null;
}

const FIXED: Record<string, SuiteName> = {
  grounding: "S4", faults: "S6", "full-run": "S9", seed: "S10", heldout: "S11", "judge-calibrate": "S12",
};
const USAGE = "usage: cli.ts golden --suite <name[,name]> | grounding | faults | full-run | seed | heldout | judge-calibrate [--repeat n] [--provider stub|real] [--unit G6-U4] [--fixture] [--plan key | --score run_id (seed only)]";

export function parse_args(argv: string[]): CliArgs | string {
  const [sub, ...rest] = argv;
  if (sub === undefined) return USAGE;
  let suite_arg: string | null = null;
  let repeat = 1;
  let provider_mode: ProviderMode = "stub";
  let unit: string | null = null;
  let fixture = false;
  let plan: string | null = null;
  let score: string | null = null;
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i] as string;
    const value = (): string | undefined => rest[++i];
    if (flag === "--fixture") fixture = true;
    else if (flag === "--suite") suite_arg = value() ?? "";
    else if (flag === "--repeat") {
      const v = value();
      if (v === undefined || !/^\d+$/.test(v) || Number(v) < 1) return USAGE;
      repeat = Number(v);
    } else if (flag === "--provider") {
      const v = value();
      if (v !== "stub" && v !== "real") return USAGE;
      provider_mode = v;
    } else if (flag === "--unit") {
      const v = value() ?? "";
      const m = /^G(\d+)-U(\d+)$/.exec(v);
      const norm = m ? `G${m[1]}.U${m[2]}` : v;
      if (!UnitId.safeParse(norm).success) return USAGE;
      unit = norm;
    } else if (flag === "--plan") plan = value() ?? "";
    else if (flag === "--score") score = value() ?? "";
    else return USAGE;
  }
  let suites: SuiteName[];
  if (sub === "golden") {
    if (suite_arg === null || suite_arg === "") return USAGE;
    const resolved = suite_arg.split(",").map((n) => resolve_suite(n.trim()));
    if (resolved.some((r) => r === null)) return USAGE;
    suites = resolved as SuiteName[];
  } else {
    const fixed = FIXED[sub];
    if (fixed === undefined) return USAGE;
    suites = [fixed];
  }
  if (plan === "" || score === "" || (plan !== null && score !== null)) return USAGE;
  if (score !== null && sub !== "seed") return USAGE;
  return { suites, repeat, provider_mode, unit, fixture, plan, score };
}

export async function run_cli(argv: string[], deps: CliDeps): Promise<number> {
  const args = parse_args(argv);
  if (typeof args === "string") {
    deps.err(args);
    return 2;
  }
  if (args.suites[0] === "S10" && (args.plan !== null || args.score !== null)) return run_seed(args, deps);
  const registered = deps.suite_factory(args.provider_mode);
  const suites = args.fixture ? registered.map((s) => (s.name === "S1" ? make_fixture_suite() : s)) : registered;
  const runner = new EvalRunner(deps.evidence, suites, deps.clock, {
    repo_root: deps.repo_root,
    ...(deps.reports_dir !== undefined ? { reports_dir: deps.reports_dir } : {}),
    prompt_version_id: deps.prompt_version_id, models: deps.models, env: deps.env,
  });
  let code = 0;
  try {
    for (const suite of args.suites) {
      const summary = await runner.run(suite, { repeat: args.repeat, provider_mode: args.provider_mode, git_sha: deps.git_sha, unit: args.unit });
      deps.out(`${suite} ${summary.passed}/${summary.total} report=${summary.report_path}`);
      if (!floor_met(suite, summary.passed, summary.total)) code = Math.max(code, 1);
    }
  } catch (e) {
    if (e instanceof EmptySuiteError || e instanceof NotImplemented || e instanceof InvariantViolation) {
      deps.err(e.message);
      return 2;
    }
    throw e;
  }
  return code;
}

// NL-92: `seed --plan <key>` plants; `seed --score <run_id>` scores. Exit 0 ok, 1 S10 verdict fails, 2 refused or bad input.
async function run_seed(args: CliArgs, deps: CliDeps): Promise<number> {
  if (deps.seed === undefined) {
    deps.err("seed needs a database");
    return 2;
  }
  const sd: SeedDeps = {
    db: deps.seed.db, ids: deps.seed.ids, clock: deps.clock, evidence: deps.evidence, repo_root: deps.repo_root, git_sha: deps.git_sha, env: deps.env,
    ...(deps.seed.planter_email !== undefined ? { planter_email: deps.seed.planter_email } : {}),
  };
  try {
    if (args.plan !== null) {
      const r = await plant_all(sd, await read_key(args.plan, deps.repo_root));
      deps.out(`planted ${r.n} run_id=${r.eval_run_id}`);
      return 0;
    }
    return await run_score(sd, args.score as string, deps.out);
  } catch (e) {
    if (e instanceof InvariantViolation) {
      deps.err(e.message);
      return 2;
    }
    throw e;
  }
}

async function main(): Promise<number> {
  const env = process.env;
  const repo_root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  let db: PgDatabase | null = null;
  try {
    const settings: SharedSettings = {
      database_url: read_secret_url(env, "DATABASE_URL", ["postgres:", "postgresql:"]),
      pg_pool_max: 2, build_id: env["BUILD_ID"] ?? "dev", log_level: "info",
    };
    db = new PgDatabase(settings, 2, 5000, "worker");
    const clock = new SystemClock();
    const ids = new PrefixedIdGenerator();
    return await run_cli(process.argv.slice(2), {
      evidence: new PgEvidenceRepo({ db, ids, clock }),
      clock, suite_factory: default_suite_factory, git_sha: resolve_git_sha(env), repo_root, prompt_version_id: null,
      models: {
        generation: read_string(env, "MODEL_GENERATION_ID", { default: "claude-sonnet-5-5" }),
        repair: read_string(env, "MODEL_REPAIR_ID", { default: "claude-sonnet-5-5" }),
        assist: read_string(env, "MODEL_ASSIST_ID", { default: "claude-sonnet-5-5" }),
        provider_mode_note: "stub runs make no model call",
      },
      seed: { db, ids },
      env, out: (l) => process.stdout.write(`${l}\n`), err: (l) => process.stderr.write(`${l}\n`),
    });
  } catch (e) {
    if (e instanceof ConfigError) {
      process.stderr.write(`${e.message}\n`);
      return 2;
    }
    throw e;
  } finally {
    if (db !== null) await db.close();
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
