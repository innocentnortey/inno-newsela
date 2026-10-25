// NL-111: `npm run eval:judge-calibrate [-- --real --cap-usd <n>] [--labels p] [--out p]`. Exit 0 ok, 2 refusal/usage/config.
// cli.ts rejects --real and --cap-usd, so this is its own entry. Provider keys only via bin/with-provider-env.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ConfigError } from "@ls/config/errors";
import { read_secret, read_secret_url, read_string } from "@ls/config/env";
import type { SecretStr } from "@ls/config/secret";
import type { SharedSettings } from "@ls/config/settings";
import { SystemClock } from "@ls/core/ports/clock";
import type { ModelPrice } from "@ls/core/ports/common";
import type { EvidenceRepo } from "@ls/core/ports/evidence";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { JudgeClient } from "@ls/core/ports/judge-client";
import type { LessonDocReader } from "@ls/core/ports/lesson-docs";
import type { ModelCallLog } from "@ls/core/ports/model-call-log";
import type { SpendLedger } from "@ls/core/ports/spend";
import type { StandardRepo } from "@ls/core/ports/standards";
import { PgDatabase } from "@ls/db/pool";
import { PgEvidenceRepo } from "@ls/db/repos/evidence";
import { PgLessonDocReader } from "@ls/db/repos/lesson-doc-reads";
import { PgModelCallLog } from "@ls/db/repos/model-calls";
import { PgStandardRepo } from "@ls/db/repos/outlines";
import { load_spend_settings } from "@ls/config/settings";
import { PgSpendLedger } from "@ls/db/repos/spend";
import { OpenRouterJudgeAdapter } from "@ls/llm/openrouter-judge";
import { PRICE_TABLE } from "@ls/llm/prices";
import { StubJudgeClient } from "@ls/llm/stub";
import type { UserId } from "@ls/schema/ids";
import { resolve_git_sha } from "../git-sha.ts";
import { CalibrationRefused, REPORT_PATH, check_labels, run_calibration } from "./calibrate.ts";
import { LabelsInvalid } from "./labels.ts";
import { write_report_file, type WriteFile } from "./report.ts";

export interface Repos {
  lessons: LessonDocReader;
  standards: StandardRepo;
  call_log: ModelCallLog;
  ledger: SpendLedger | null;
  evidence: EvidenceRepo;
  user_id: UserId | null;
  close(): Promise<void>;
}

export interface MainDeps {
  env: Record<string, string | undefined>;
  out: (line: string) => void;
  err: (line: string) => void;
  git_sha: string;
  read_labels: (file: string) => string | null;
  write_report: WriteFile;
  repos: (real: boolean) => Promise<Repos>;
  judge?: JudgeClient; // tests inject the scripted stub
  make_real_judge: (api_key: SecretStr, model_id: string) => JudgeClient;
  price_for: (model_id: string) => ModelPrice;
}

interface Args { real: boolean; cap_arg: string | null; labels: string; out: string }
const USAGE = "usage: eval:judge-calibrate [--real --cap-usd <n>] [--labels <path>] [--out <path>]";

function parse(argv: string[]): Args | string {
  const a: Args = { real: false, cap_arg: null, labels: "evals/judge/labels.csv", out: REPORT_PATH };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i] as string;
    if (flag === "--real") a.real = true;
    else if (flag === "--cap-usd" || flag === "--labels" || flag === "--out") {
      const v = argv[++i];
      if (v === undefined) return USAGE;
      if (flag === "--cap-usd") a.cap_arg = v;
      else if (flag === "--labels") a.labels = v;
      else a.out = v;
    } else return USAGE;
  }
  return a;
}

/** NL-86 cap rule (copied, not imported across the driver): a real run needs a cap at or below the ceiling. */
export function resolve_cap(args: { real: boolean; cap_arg: string | null; env: Record<string, string | undefined> }): number | null {
  if (!args.real) return null;
  const ceiling = Number(args.env["BUILD_SPEND_CEILING_USD"] ?? "75");
  if (args.cap_arg === null || args.cap_arg === "") throw new CalibrationRefused("a real-provider run needs --cap-usd");
  const cap = Number(args.cap_arg);
  if (!Number.isFinite(cap) || cap <= 0) throw new CalibrationRefused("the cap must be a number above 0");
  if (Number.isFinite(ceiling) && cap > ceiling) throw new CalibrationRefused(`the cap exceeds the spend ceiling ${ceiling}`);
  return cap;
}

export async function run_judge_calibrate(argv: string[], deps: MainDeps): Promise<number> {
  const args = parse(argv);
  if (typeof args === "string") {
    deps.err(args);
    return 2;
  }
  let repos: Repos | null = null;
  try {
    const cap_usd = resolve_cap({ real: args.real, cap_arg: args.cap_arg, env: deps.env });
    const labels_text = deps.read_labels(args.labels);
    const rows = check_labels(labels_text);
    let judge: JudgeClient;
    let model_id: string;
    if (args.real) {
      const key = read_secret(deps.env, "OPENROUTER_API_KEY");
      model_id = read_string(deps.env, "MODEL_JUDGE_ID");
      deps.price_for(model_id); // fails with a clear message when no price row exists
      judge = deps.make_real_judge(key, model_id);
    } else {
      model_id = "stub-judge";
      // answers yes to everything and is never built from the labels, which would leak them into the stub
      judge = deps.judge ?? new StubJudgeClient(rows.map(() => ({ verdict: "yes" as const })));
    }
    repos = await deps.repos(args.real);
    if (args.real && repos.user_id === null) throw new CalibrationRefused("no seeded user for spend reservations (run ops/seed.ts)");
    const r = await run_calibration({
      labels_text, lessons: repos.lessons, standards: repos.standards, judge, call_log: repos.call_log, ledger: args.real ? repos.ledger : null,
      evidence: repos.evidence, provider_mode: args.real ? "real" : "stub", model_id, git_sha: deps.git_sha, out_path: args.out,
      write_report: deps.write_report, user_id: repos.user_id, cap_usd, price_for: deps.price_for,
    });
    deps.out(`S12 dev ${r.dev.agreed}/${r.dev.n} holdout ${r.holdout.agreed}/${r.holdout.n} report=${args.out}`);
    return 0;
  } catch (e) {
    if (e instanceof CalibrationRefused || e instanceof LabelsInvalid || e instanceof ConfigError) {
      deps.err(e.message);
      return 2;
    }
    // a price_for failure is a clear InvariantViolation message about the missing price row
    if (e instanceof Error && e.name === "InvariantViolation" && e.message.startsWith("no price for")) {
      deps.err(`${e.message}; add the judge model to packages/llm/src/prices.ts first`);
      return 2;
    }
    throw e;
  } finally {
    if (repos !== null) await repos.close();
  }
}

async function main(): Promise<number> {
  const env = process.env;
  const repo_root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  return run_judge_calibrate(process.argv.slice(2), {
    env, out: (l) => process.stdout.write(`${l}\n`), err: (l) => process.stderr.write(`${l}\n`),
    git_sha: resolve_git_sha(env),
    read_labels: (f) => {
      const p = path.resolve(repo_root, f);
      return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
    },
    write_report: (f, lines) => write_report_file(path.resolve(repo_root, f), lines),
    repos: async (real) => {
      const settings: SharedSettings = {
        database_url: read_secret_url(env, "DATABASE_URL", ["postgres:", "postgresql:"]),
        pg_pool_max: 2, build_id: env["BUILD_ID"] ?? "dev", log_level: "info",
      };
      const db = new PgDatabase(settings, 2, 5000, "worker");
      const d = { db, ids: new PrefixedIdGenerator(), clock: new SystemClock() };
      let user_id: UserId | null = null;
      if (real) {
        const email = env["JUDGE_CALIBRATE_USER_EMAIL"] ?? "approver.demo@example.test";
        const found = await db.with_tx(async (tx) => (await tx.query<{ id: string }>("SELECT id FROM app_user WHERE lower(email) = lower($1)", [email])).rows[0]);
        user_id = (found?.id ?? null) as UserId | null;
      }
      return {
        lessons: new PgLessonDocReader({ db }), standards: new PgStandardRepo(d), call_log: new PgModelCallLog(d),
        ledger: real ? new PgSpendLedger({ ...d, settings: load_spend_settings(env) }) : null, evidence: new PgEvidenceRepo(d), user_id, close: () => db.close(),
      };
    },
    make_real_judge: (api_key, model_id) => new OpenRouterJudgeAdapter({ api_key, model_id, timeout_ms: 30_000 }),
    price_for: (m) => PRICE_TABLE.price_for(m),
  });
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
