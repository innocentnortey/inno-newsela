// NL-125 (WF-43): `npx tsx apps/web/e2e/integrity/run.ts --trials 20 [--grep <assertion>] [--fault-fixture]` from the repo root.
// 1. runs the assertion specs under Playwright (real stack, three contexts per trial), each trial appending a line to trials.jsonl;
// 2. scores the lines through the S5 suite (`evals/src/cli.ts golden --suite S5 --repeat n`) into eval_run / eval_case_result
//    rows of a throwaway migrated test database and writes evals/reports/integrity-<git-sha>.md;
// 3. appends the report notes (contexts, n, models, store p95 verdict, failing trials, not-built rows);
// 4. exits non-zero when Playwright failed, a floor-1.00 assertion is below 20 of 20, or anything above went wrong.
// `npm run test:e2e -- integrity --trials n` cannot reach this (scripts/script-targets.json routes test:e2e to the mock config and is not
// owned by NL-125): see seam-followups S-23. Use this form until then.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// apps/web is a CommonJS package (Playwright loads e2e as CJS), so the ESM evals helpers are imported dynamically.
const ROOT = resolve(__dirname, "../../../..");
const WEB = join(ROOT, "apps/web");
const TRIALS_FILE = join(WEB, "test-results/integrity/trials.jsonl");
const TOKENS = ["stale_approve", "zero_edits_after_lock", "no_silent_loss", "four_eyes", "suggestion_blocks", "round_trip"] as const;
const FILES: Record<string, string> = {
  stale_approve: "stale-approve", zero_edits_after_lock: "zero-edits-after-lock", no_silent_loss: "no-silent-loss",
  four_eyes: "four-eyes", suggestion_blocks: "suggestion-blocks", round_trip: "round-trip", ids: "ids",
};

function args(argv: string[]): { trials: number; grep: string | null; fault: boolean } | string {
  let trials = 20;
  let grep: string | null = null;
  let fault = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--trials") {
      const v = argv[++i];
      if (v === undefined || !/^\d+$/.test(v) || Number(v) < 1) return "--trials needs a positive integer";
      trials = Number(v);
    } else if (a === "--grep") grep = argv[++i] ?? "";
    else if (a === "--fault-fixture") fault = true;
    else return `unknown argument ${a}`;
  }
  if (grep !== null && FILES[grep] === undefined) return `--grep must be one of ${Object.keys(FILES).join(", ")}`;
  return { trials, grep, fault };
}

function sh(cmd: string, a: string[], opts: { cwd: string; env?: NodeJS.ProcessEnv; inherit?: boolean }) {
  return spawnSync(cmd, a, { cwd: opts.cwd, env: opts.env ?? process.env, encoding: "utf8", stdio: opts.inherit ? "inherit" : "pipe", maxBuffer: 64 * 1024 * 1024 });
}

async function main(): Promise<number> {
  const { add_notes, integrity_notes } = await import("../../../../evals/src/suites/s5-report.ts");
  const { make_read_trials, read_available } = await import("../../../../evals/src/suites/s5-support.ts");
  const parsed = args(process.argv.slice(2));
  if (typeof parsed === "string") {
    process.stderr.write(`${parsed}\nusage: run.ts --trials n [--grep ${Object.keys(FILES).join("|")}] [--fault-fixture]\n`);
    return 2;
  }
  const { trials, grep, fault } = parsed;
  mkdirSync(dirname(TRIALS_FILE), { recursive: true });
  writeFileSync(TRIALS_FILE, "");

  const env: NodeJS.ProcessEnv = { ...process.env, INTEGRITY_TRIALS: String(trials), INTEGRITY_FAULT: fault ? "1" : "0" };
  if (grep !== null && (TOKENS as readonly string[]).includes(grep)) env["INTEGRITY_ONLY"] = grep;
  const files = grep === null ? TOKENS.map((t) => FILES[t]!) : [FILES[grep]!];
  const pw = sh("npx", ["playwright", "test", "-c", "e2e/integrity/playwright.config.ts", ...files.map((f) => `${f}.spec.ts`)], { cwd: WEB, env, inherit: true });
  let code = pw.status === 0 ? 0 : 1;
  if (grep === "ids") return code; // ids are not a scored assertion

  // Score through the S5 suite into a throwaway migrated test database.
  const made = sh("npx", ["tsx", "apps/web/e2e/integration/support/db-admin.ts", "create"], { cwd: ROOT });
  if (made.status !== 0) {
    process.stderr.write(`test database create failed: ${(made.stderr || made.stdout).slice(-800)}\n`);
    return 2;
  }
  const testDb = JSON.parse(made.stdout) as { url: string; name: string };
  // A fault-fixture run must not overwrite the full-run evidence: remember the existing integrity reports and put them back.
  const reportsDir = join(ROOT, "evals/reports");
  const before = new Map<string, string>();
  if (existsSync(reportsDir)) for (const f of readdirSync(reportsDir)) if (/^integrity-.*\.md$/.test(f)) before.set(f, readFileSync(join(reportsDir, f), "utf8"));
  try {
    const scored = sh("npx", ["tsx", "evals/src/cli.ts", "golden", "--suite", "S5", "--repeat", String(trials), "--provider", "stub"], {
      cwd: ROOT, env: { ...env, DATABASE_URL: testDb.url, MODEL_PROVIDER_MODE: "stub" },
    });
    process.stdout.write(scored.stdout);
    process.stderr.write(scored.stderr);
    code = Math.max(code, scored.status ?? 2);
    const m = /report=(\S+)/.exec(scored.stdout);
    if (m === null) return Math.max(code, 2);
    const rows = sh("node", ["--input-type=module", "-e", `import pg from "pg"; const c = new pg.Client({connectionString: process.env.DATABASE_URL}); await c.connect(); const r = await c.query("select count(*)::int n from eval_case_result"); console.log(r.rows[0].n); await c.end();`], {
      cwd: ROOT, env: { ...process.env, DATABASE_URL: testDb.url },
    });
    process.stdout.write(`eval_case_result rows stored: ${rows.stdout.trim()}\n`);

    const report = join(ROOT, m[1]!);
    const available = read_available(ROOT);
    const lines = await make_read_trials(ROOT)();
    const sha = /integrity-(.+)\.md$/.exec(m[1]!)![1]!;
    const notes = integrity_notes({ lines, git_sha: sha, available, ...(grep === null ? {} : { tokens: [grep] }) });
    const text = add_notes(readFileSync(report, "utf8"), notes);
    if (fault) {
      writeFileSync(report.replace(/\.md$/, "-fault-fixture.md"), text);
      const was = before.get(report.split("/").pop()!);
      if (was === undefined) rmSync(report);
      else writeFileSync(report, was);
    } else writeFileSync(report, text);
    process.stdout.write(`${notes}\n`);
  } finally {
    const name = testDb.name;
    if (/^ls_t_[0-9a-f]+$/.test(name)) sh("npx", ["tsx", "apps/web/e2e/integration/support/db-admin.ts", "drop", name], { cwd: ROOT });
  }
  return code;
}

void main().then((code) => {
  process.exitCode = code;
});
