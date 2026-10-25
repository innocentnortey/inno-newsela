// NL-107 (WF-28): the HP-7 fault-injection script, `npx tsx ops/faults/run-faults.ts [--provider stub|real]` (the ops shim runs this file).
// Runs the S6 suite through the NL-49 runner (one eval_run, one eval_case_result per invariant, the report), then reads the
// stored rows back into a FaultSuiteReport. `real` is refused: this script never calls a provider.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { read_secret_url } from "@ls/config/env";
import { SystemClock, type Clock } from "@ls/core/ports/clock";
import type { JsonValue } from "@ls/core/ports/common";
import type { EvidenceRepo } from "@ls/core/ports/evidence";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { PgDatabase } from "@ls/db/pool";
import { PgEvidenceRepo } from "@ls/db/repos/evidence";
import { PgPromptRepo } from "@ls/db/repos/prompts";
import { locked_hash, LOCKED_DIR } from "@ls/prompts/locked";
import { EvalRunner } from "../runner.ts";
import { resolve_git_sha } from "../git-sha.ts";
import { make_s6 } from "./s6.ts";
import type { EvalOptions } from "../types.ts";
import type { ScenarioId } from "./s6-scenarios.ts";

export const WF = "WF-28";
const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

export interface FaultSuiteReport {
  eval_run_id: string;
  kill_test_passed: boolean;
  rate_limit_test_passed: boolean;
  truncation_test_passed: boolean;
  cap_test_passed: boolean;
  duplicates_found: number;
  calls_lost_counted: number;
  report_path: string;
}

export interface FaultDeps {
  db: Pick<PgDatabase, "with_tx">;
  evidence: EvidenceRepo;
  clock: Clock;
  repo_root?: string;
  reports_dir?: string;
  env?: Record<string, string | undefined>;
  /** Limits the scenarios (default: all four). */
  only?: readonly ScenarioId[];
}

export async function run_fault_suite(opts: EvalOptions, deps: FaultDeps): Promise<FaultSuiteReport> {
  const suite = make_s6(opts.provider_mode, deps.only);
  // EV-R1: name the prompt version. The locked layer is stored (idempotent) and the stored prompt_version row's id goes in the report.
  const ids = new PrefixedIdGenerator();
  const prompts = new PgPromptRepo({ db: deps.db as PgDatabase, ids, clock: deps.clock });
  await deps.db.with_tx((tx) => prompts.sync_locked_layer(locked_hash(LOCKED_DIR), tx)); // null when already stored
  const stored = await prompts.current();
  const runner = new EvalRunner(deps.evidence, [suite], deps.clock, {
    repo_root: deps.repo_root ?? REPO_ROOT,
    ...(deps.reports_dir !== undefined ? { reports_dir: deps.reports_dir } : {}),
    prompt_version_id: stored.prompt_version_id,
    models: { generation: "stub-model", repair: "stub-model", assist: "stub-model", provider_mode_note: "stub provider: no model call is made" },
    env: deps.env ?? process.env,
  });
  const summary = await runner.run("S6", opts);
  // The report is filled from the stored rows, not from what the scenarios held in memory.
  const rows = await deps.db.with_tx(async (tx) =>
    (await tx.query<{ case_id: string; passed: boolean; actual_json: Record<string, JsonValue> }>(
      "select case_id, passed, actual_json from eval_case_result where eval_run_id=$1", [summary.eval_run_id])).rows,
  );
  const by = new Map(rows.map((r) => [r.case_id, r]));
  const ok = (id: string): boolean => by.get(id)?.passed === true;
  const kill = by.get("kill")?.actual_json ?? {};
  return {
    eval_run_id: summary.eval_run_id,
    kill_test_passed: ok("kill"), rate_limit_test_passed: ok("rate_limit"), truncation_test_passed: ok("truncation"), cap_test_passed: ok("cap"),
    duplicates_found: Number(kill["duplicates_found"] ?? 0), calls_lost_counted: Number(kill["calls_lost_counted"] ?? 0),
    report_path: summary.report_path,
  };
}

/** CLI entry. Exit 0 all four pass, 1 an invariant failed, 2 usage or `--provider real`. */
export async function main(argv: string[], io: { out: (l: string) => void; err: (l: string) => void; env: Record<string, string | undefined> } = {
  out: (l) => process.stdout.write(l + "\n"), err: (l) => process.stderr.write(l + "\n"), env: process.env,
}): Promise<number> {
  let provider: "stub" | "real" = "stub";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--provider" && (argv[i + 1] === "stub" || argv[i + 1] === "real")) provider = argv[++i] as "stub" | "real";
    else {
      io.err("usage: run-faults.ts [--provider stub|real]");
      return 2;
    }
  }
  if (provider === "real") {
    io.err("run-faults refuses --provider real: S6 runs on the stub provider only");
    return 2;
  }
  io.out(`wf=${WF} script=run-faults provider=stub`);
  const url = read_secret_url(io.env, "DATABASE_URL", ["postgres:", "postgresql:"]);
  const db = new PgDatabase({ database_url: url, pg_pool_max: 2, build_id: io.env["BUILD_ID"] ?? "dev", log_level: "info" }, 2, 5000, "worker");
  try {
    const clock = new SystemClock();
    const report = await run_fault_suite(
      { repeat: 1, provider_mode: "stub", git_sha: resolve_git_sha(io.env), unit: null },
      { db, evidence: new PgEvidenceRepo({ db, ids: new PrefixedIdGenerator(), clock }), clock, env: io.env },
    );
    io.out(`kill=${report.kill_test_passed} rate_limit=${report.rate_limit_test_passed} truncation=${report.truncation_test_passed} cap=${report.cap_test_passed} duplicates_found=${report.duplicates_found} report=${report.report_path}`);
    return report.kill_test_passed && report.rate_limit_test_passed && report.truncation_test_passed && report.cap_test_passed ? 0 : 1;
  } finally {
    await db.close();
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
