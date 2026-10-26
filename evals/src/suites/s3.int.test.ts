// NL-109 (S3) against a real Postgres, stub provider only. No model call is made anywhere in this file.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { PgEvidenceRepo } from "@ls/db/repos/evidence";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { run_cli, type CliDeps } from "../cli.ts";
import { EvalRunner } from "../runner.ts";
import type { EvalOptions, EvalSuite } from "../types.ts";
import { DRAFTS_DIR, REPO_ROOT } from "./s3-cases.ts";
import type { S3Actual } from "./s3-report.ts";
import { narrow_leaf_origins } from "./s3-run.ts";
import { make_s3 } from "./s3.ts";
import { load_fixture } from "./s6-world.ts";

const CANARY = "sk-ant-S3-CANARY-0000000000";
const SHA = "abc123def456";
const OPTS: EvalOptions = { repeat: 1, provider_mode: "stub", git_sha: SHA, unit: null };
const clock = new SystemClock();
let db: TestDb;
let evidence: PgEvidenceRepo;
let reports: string;
const saved_key = process.env["ANTHROPIC_API_KEY"];

const q = async <T>(sql: string, params: unknown[] = []): Promise<T[]> => db.db.with_tx(async (tx) => (await tx.query<T & Record<string, unknown>>(sql, params)).rows as T[]);
const first = (n: number) => (s: EvalSuite): EvalSuite => ({ ...s, cases: () => s.cases().slice(0, n) });
const sha_of = (dir: string): Record<string, string> => {
  const out: Record<string, string> = {};
  const walk = (d: string): void => {
    for (const f of readdirSync(d)) {
      const p = path.join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f === "expected.json" || f === "bad-draft.json") out[p] = createHash("sha256").update(readFileSync(p)).digest("hex");
    }
  };
  walk(dir);
  return out;
};

beforeAll(async () => {
  db = await create_test_db({ pool_max: 4, acquire_timeout_ms: 10_000 });
  evidence = new PgEvidenceRepo({ db: db.db, ids: new PrefixedIdGenerator(), clock });
  reports = mkdtempSync(path.join(tmpdir(), "s3-reports-"));
}, 60_000);
afterAll(async () => {
  rmSync(reports, { recursive: true, force: true });
  await db?.drop();
});
afterEach(() => {
  if (saved_key === undefined) delete process.env["ANTHROPIC_API_KEY"]; else process.env["ANTHROPIC_API_KEY"] = saved_key;
});

const runner = (suite: EvalSuite, env: Record<string, string | undefined> = { ANTHROPIC_API_KEY: CANARY }) =>
  new EvalRunner(evidence, [suite], clock, { repo_root: REPO_ROOT, reports_dir: reports, prompt_version_id: null, models: { generation: "stub-model" }, env });

describe("S3 on the stub provider (cases wp-1, wp-2)", () => {
  let summary: Awaited<ReturnType<EvalRunner["run"]>>;
  let report: string;
  beforeAll(async () => {
    process.env["ANTHROPIC_API_KEY"] = CANARY; // stub mode never reads it; the leak guard must still not trip
    summary = await runner(first(2)(make_s3("stub", { env: process.env }))).run("S3", OPTS);
    report = readFileSync(path.resolve(REPO_ROOT, summary.report_path), "utf8");
    if (process.env["S3_SHOW"]) writeFileSync("/tmp/s3-report.md", report);
  }, 300_000);

  it("test_eval_runner_writes_results: one run, two case rows with source and guards, report path set", async () => {
    expect(await q("select * from eval_run where id=$1", [summary.eval_run_id])).toHaveLength(1);
    const rows = await q<{ case_id: string; source: string; guards: string; passed: boolean }>("select case_id, source, guards, passed from eval_case_result where eval_run_id=$1 order by case_id", [summary.eval_run_id]);
    expect(rows.map((r) => [r.case_id, r.source])).toEqual([["wp-1", "WP-1"], ["wp-2", "WP-2"]]);
    for (const r of rows) { expect(r.guards).not.toBe(""); }
    expect(summary).toMatchObject({ passed: 2, total: 2 });
    expect((await q<{ report_path: string }>("select report_path from eval_run where id=$1", [summary.eval_run_id]))[0]?.report_path).toBe(summary.report_path);
    expect(summary.report_path).toMatch(/drafts-abc123def456\.md$/);
  });

  it("stub_wp1_passes_all_assertions: one repair, eight assertions pass, the link blocks submit and approve", async () => {
    const [row] = await q<{ actual_json: S3Actual }>("select actual_json from eval_case_result where eval_run_id=$1 and case_id='wp-1'", [summary.eval_run_id]);
    const a = row!.actual_json;
    expect(a.assertions).toHaveLength(8);
    expect(a.assertions.filter((x) => !x.passed)).toEqual([]);
    expect(a.repairs_used).toBe(1);
    expect(a.trajectory).toMatchObject({ first_failing_step: "checks", repair_recovered: true, fc: null });
    expect(a.counts.placeholders).toBe(2);
    expect(a.served_models).toEqual(["stub-model"]);
  });

  it("canary_key_absent_from_report_and_rows: no key, no restricted path in the report or the stored rows", async () => {
    const rows = await q<{ expected_json: unknown; actual_json: unknown }>("select expected_json, actual_json from eval_case_result where eval_run_id=$1", [summary.eval_run_id]);
    for (const t of [report, JSON.stringify(rows)]) for (const bad of ["S3-CANARY", "sk-ant", "sk-or", "restricted/"]) expect(t).not.toContain(bad);
    expect(report).toContain("## Detail S3");
  });
});

describe("S3 case wp-3 (Flex Day)", () => {
  it("stub_wp3_passes_all_assertions: zero placeholders, an added RL.6.7 keeps origin added", async () => {
    const s = await runner(make_s3("stub", { env: {} })).run("S3", OPTS);
    const rows = await q<{ case_id: string; passed: boolean; actual_json: S3Actual }>("select case_id, passed, actual_json from eval_case_result where eval_run_id=$1 order by case_id", [s.eval_run_id]);
    const wp3 = rows.find((r) => r.case_id === "wp-3")!;
    expect(wp3.actual_json.assertions.filter((x) => !x.passed)).toEqual([]);
    expect(wp3.actual_json.counts.placeholders).toBe(0);
    expect(s).toMatchObject({ passed: 3, total: 3 });
  }, 300_000);
});

describe("S3 --stub-draft (AC-5)", () => {
  it("stub_draft_fixture_fails_with_fc: exit 1, every failing case lists an FC and a first_failing_step, no case file changes", async () => {
    const before = sha_of(DRAFTS_DIR);
    const out: string[] = [];
    const errs: string[] = [];
    const deps: CliDeps = {
      evidence, clock, suite_factory: (mode) => [make_s3(mode, { env: {} })], git_sha: "bad000bad000", repo_root: REPO_ROOT, reports_dir: reports,
      prompt_version_id: null, models: { generation: "stub-model" }, env: {}, out: (l) => out.push(l), err: (l) => errs.push(l),
    };
    const code = await run_cli(["golden", "--suite", "drafts", "--stub-draft", "evals/cases/drafts/_fixtures/bad-draft.json"], deps);
    expect(errs).toEqual([]);
    expect(code).toBe(1);
    const report = readFileSync(path.join(reports, "drafts-bad000bad000.md"), "utf8");
    for (const id of ["wp-1", "wp-2", "wp-3"]) {
      const section = report.slice(report.indexOf(`### ${id} `)).split("\n### ")[0] as string;
      expect(section).toMatch(/first_failing_step: \w+, FC-\d/);
    }
    expect(sha_of(DRAFTS_DIR)).toEqual(before);
    expect(execFileSync("git", ["diff", "--stat", "--", "evals/cases"], { cwd: REPO_ROOT, encoding: "utf8" })).toBe("");
  }, 300_000);
});

type Blk = { role: string; section: string; part: string | null; minutes: number | null; text: string; standard_codes: string[]; code_origins: string[]; cfu: unknown };
type Draft = { blocks: Blk[] };
const slot = (part: string): Blk => ({ role: "excerpt_slot", section: "Learning in Action", part, minutes: null, text: "Reviewer to insert a passage.", standard_codes: [], code_origins: [], cfu: null });

// Mutations of the passing WP-2 stub draft. Only mutations that survive LessonDraft and the compiler can fail one assertion alone
// (an extra placeholder); the generation gate refuses the rest, so they end generation_failed and fail draft_stored with their FC.
// Unit-level mutations of all eight assertions are in s3-assertions.test.ts.
const MUTATIONS: [string, (d: Draft) => void, string, string][] = [
  ["extra_placeholder", (d) => { d.blocks.push(slot("Part B")); }, "placeholder_count", "FC-7"],
  ["dropped_required_block", (d) => { d.blocks = d.blocks.filter((b) => !(b.role === "support_table" && b.part === "Part B")); }, "required_blocks", "FC-3"],
  ["minutes_over_range", (d) => { d.blocks.find((b) => b.part === "Part A" && b.minutes !== null)!.minutes = 45; }, "draft_stored", "FC-3"],
];

describe("S3 mutated stub drafts (bad_draft_each_assertion_fails_alone)", () => {
  it.each(MUTATIONS)("%s", async (_label, mutate, assertion, fc) => {
    const d = narrow_leaf_origins(load_fixture("wp-2.json").draft) as Draft;
    mutate(d);
    const dir = mkdtempSync(path.join(tmpdir(), "s3-mut-"));
    const file = path.join(dir, "draft.json");
    writeFileSync(file, JSON.stringify(d));
    try {
      const suite = make_s3("stub", { env: {} });
      const one: EvalSuite = { ...suite, cases: () => suite.cases().filter((c) => c.case_id === "wp-2") };
      const s = await runner(one).run("S3", { ...OPTS, stub_draft: file });
      const [row] = await q<{ passed: boolean; failure_category: string; actual_json: S3Actual }>("select passed, failure_category, actual_json from eval_case_result where eval_run_id=$1", [s.eval_run_id]);
      const failed = row!.actual_json.assertions.filter((a) => !a.passed).map((a) => a.name);
      expect(row!.passed).toBe(false);
      expect(failed).toContain(assertion);
      expect(row!.failure_category).toBe(fc);
      if (assertion !== "draft_stored") expect(failed).toEqual([assertion]); // fails alone
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
