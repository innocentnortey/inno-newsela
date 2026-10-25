// NL-107 AC-5, AC-6, AC-7: the script records one eval_run, one eval_case_result per invariant and a report; refuses a real provider;
// leaks no key. Runs the cap scenario (and the kill scenario for the canary) over a real Postgres.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { PgEvidenceRepo } from "@ls/db/repos/evidence";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { CANARY, OUT_DIR } from "./s6-scenarios.ts";
import { main, run_fault_suite, type FaultSuiteReport } from "./s6-run.ts";

let evidence_db: TestDb;
let reports_dir: string;
const clock = new SystemClock();
const OPTS = { repeat: 1, provider_mode: "stub", git_sha: "abc123def456", unit: null } as const;
const q = async <T>(sql: string, params: unknown[] = []): Promise<T[]> => evidence_db.db.with_tx(async (tx) => (await tx.query<T & Record<string, unknown>>(sql, params)).rows as T[]);
const count = async (table: string): Promise<number> => Number((await q<{ n: string }>(`select count(*) n from ${table}`))[0]!.n);
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(path.join(dir, f)).isDirectory() ? files(path.join(dir, f)) : [path.join(dir, f)]));

beforeAll(async () => {
  evidence_db = await create_test_db({ pool_max: 4, acquire_timeout_ms: 10_000 });
  reports_dir = mkdtempSync(path.join(tmpdir(), "faults-reports-"));
}, 60_000);
afterAll(async () => {
  rmSync(reports_dir, { recursive: true, force: true });
  await evidence_db?.drop();
});

const deps = (only: Array<"kill" | "rate_limit" | "truncation" | "cap">) => ({
  db: evidence_db.db, evidence: new PgEvidenceRepo({ db: evidence_db.db, ids: new PrefixedIdGenerator(), clock }), clock, reports_dir,
  env: { ANTHROPIC_API_KEY: CANARY }, only,
});

describe("run-faults", () => {
  let report: FaultSuiteReport;
  beforeAll(async () => {
    report = await run_fault_suite(OPTS, deps(["kill", "cap"]));
  }, 400_000);

  it("test_fault_script_records: one eval_run, one eval_case_result per invariant, capped recorded, report names the EV-R1 fields", async () => {
    expect(await count("eval_run")).toBe(1);
    const cases = await q<{ case_id: string; passed: boolean; actual_json: Record<string, unknown> }>("select case_id, passed, actual_json from eval_case_result order by case_id");
    expect(cases.map((c) => c.case_id)).toEqual(["cap", "kill"]);
    expect(cases.every((c) => c.passed)).toBe(true);
    const cap = cases.find((c) => c.case_id === "cap")!.actual_json;
    expect(cap["run_state"]).toBe("capped");
    expect(Number(cap["settled_usd"])).toBeLessThanOrEqual(Number(cap["cap_usd"]));
    expect(String(cap["run_id"])).toMatch(/^run_/);
    expect(cap["model_calls"]).toBeGreaterThan(0);
    expect(report.cap_test_passed && report.kill_test_passed).toBe(true);
    expect(report.rate_limit_test_passed).toBe(false); // not run in this test
    expect(report.duplicates_found).toBe(0);
    const text = readFileSync(path.join(reports_dir, "faults-abc123def456.md"), "utf8");
    expect(text).toContain("- git_sha: abc123def456");
    expect(text).toMatch(/- prompt_version: locked-layer [0-9a-f]{12}/);
    expect(text).toContain('"generation":"stub-model"');
    expect(text).toContain("- n: 2");
    expect(text).toContain("- provider_mode: stub");
    const [row] = await q<{ passed: number; total: number; report_path: string }>("select passed, total, report_path from eval_run");
    expect(row).toMatchObject({ passed: 2, total: 2 });
  });

  it("canary_absent: the fake key is in no report, no case result and no worker log", async () => {
    expect(report.eval_run_id).toBeTruthy();
    for (const dir of [reports_dir, OUT_DIR, path.join(import.meta.dirname, "../../reports")]) {
      let found: string[] = [];
      try { found = files(dir); } catch { /* the directory does not exist yet */ }
      for (const f of found) expect(readFileSync(f, "utf8"), f).not.toContain(CANARY);
    }
    expect(files(OUT_DIR).some((f) => f.endsWith("worker-kill.log"))).toBe(true);
    expect(await q("select 1 from eval_case_result where actual_json::text like $1 or expected_json::text like $1", [`%${CANARY}%`])).toEqual([]);
  });

  it("real_provider_refused: exit 2, one stderr line, no eval_run and no model_call row written", async () => {
    const before = [await count("eval_run"), await count("model_call")];
    const err: string[] = [];
    const out: string[] = [];
    const code = await main(["--provider", "real"], { out: (l) => out.push(l), err: (l) => err.push(l), env: {} });
    expect(code).toBe(2);
    expect(err).toHaveLength(1);
    expect(out).toEqual([]);
    expect([await count("eval_run"), await count("model_call")]).toEqual(before);
  });

  it("real_provider_refused (ops entry): the shipped command exits 2 with one stderr line", () => {
    const repo = path.resolve(import.meta.dirname, "../../..");
    const r = spawnSync(process.execPath, ["--import", "tsx", path.join(repo, "ops/faults/run-faults.ts"), "--provider", "real"], { cwd: repo, encoding: "utf8" });
    expect(r.status).toBe(2);
    expect(r.stderr.trim().split("\n")).toHaveLength(1);
    expect(r.stdout).toBe("");
  });
});
