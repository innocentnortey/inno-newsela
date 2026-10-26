// NL-49
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { InvariantViolation } from "@ls/core/errors";
import { FakeClock } from "@ls/core/ports/clock";
import Decimal from "decimal.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EmptySuiteError } from "./errors.ts";
import { make_fixture_suite } from "./fixture-suite.ts";
import { merge_section, render_suite_section, type SectionInput } from "./report.ts";
import { EvalRunner, type RunnerConfig } from "./runner.ts";
import { make_s2 } from "./suites/s2.ts";
import { make_s4 } from "./suites/s4.ts";
import { make_shell } from "./suites/shell.ts";
import { MemoryEvidenceRepo } from "./testing/memory-evidence.ts";
import type { EvalOptions, EvalSuite } from "./types.ts";

let root: string;
let repo: MemoryEvidenceRepo;
const OPTS: EvalOptions = { repeat: 1, provider_mode: "stub", git_sha: "abc123def456", unit: null };
const cfg = (over: Partial<RunnerConfig> = {}): RunnerConfig => ({
  repo_root: root, prompt_version_id: null, models: { generation: "claude-sonnet-5-5" }, env: {}, ...over,
});
const runner = (suites: EvalSuite[], over: Partial<RunnerConfig> = {}) =>
  new EvalRunner(repo, suites, new FakeClock(), cfg(over));

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "nl49-"));
  repo = new MemoryEvidenceRepo();
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("EvalRunner", () => {
  it("test_eval_runner_writes_results: one run, two case rows, report on disk", async () => {
    const s = await runner([make_fixture_suite({ fail: ["fx-2"] })]).run("S1", OPTS);
    expect(repo.runs).toHaveLength(1);
    expect(repo.cases).toHaveLength(2);
    for (const c of repo.cases) {
      expect(c.provenance).not.toBe("");
      expect(c.source).not.toBe("");
      expect(c.guards).not.toBe("");
      expect(c.expected).toEqual({ ok: true });
      expect(c.actual).toBeDefined();
    }
    expect(s).toMatchObject({ passed: 1, total: 2, report_path: "evals/reports/golden-abc123def456.md" });
    expect(repo.runs[0]).toMatchObject({ passed: 1, total: 2, report_path: s.report_path });
    expect(fs.existsSync(path.join(root, s.report_path))).toBe(true);
  });

  it("report_names_sha_models_n", async () => {
    const s = await runner([make_fixture_suite()]).run("S1", OPTS);
    const text = fs.readFileSync(path.join(root, s.report_path), "utf8");
    for (const needle of ["git_sha: abc123def456", "prompt_version:", "models: ", "claude-sonnet-5-5", "provider_mode: stub", "n: 2", "SYN-fixture-1", "SYN-fixture-2"]) {
      expect(text).toContain(needle);
    }
  });

  it("two_suites_share_one_golden_report: rerun replaces only its own section", async () => {
    const r = runner([make_fixture_suite(), make_fixture_suite({ name: "S2" })]);
    await r.run("S2", OPTS);
    await r.run("S1", OPTS);
    const file = path.join(root, "evals/reports/golden-abc123def456.md");
    let text = fs.readFileSync(file, "utf8");
    expect(text.indexOf("## Suite S1")).toBeGreaterThan(-1);
    expect(text.indexOf("## Suite S1")).toBeLessThan(text.indexOf("## Suite S2"));
    await r.run("S1", OPTS);
    text = fs.readFileSync(file, "utf8");
    expect(text.match(/## Suite S1/g)).toHaveLength(1);
    expect(text.match(/## Suite S2/g)).toHaveLength(1);
  });

  it("no_secret_or_restricted_in_outputs", async () => {
    await runner([make_fixture_suite()], { env: { ANTHROPIC_API_KEY: "sk-test-NL49" } }).run("S1", OPTS);
    const report = fs.readFileSync(path.join(root, "evals/reports/golden-abc123def456.md"), "utf8");
    for (const blob of [JSON.stringify(repo.cases), JSON.stringify(repo.runs), report]) {
      expect(blob).not.toContain("sk-test-NL49");
      expect(blob).not.toContain("restricted/");
    }
  });

  it("leak_guard_blocks_key_in_actual", async () => {
    const base = make_fixture_suite();
    const leaky: EvalSuite = { ...base, score: async (c) => ({ case_id: c.case_id, passed: true, failure_category: null, actual: { v: "sk-test-NL49" }, cost_usd: new Decimal(0) }) };
    let err: unknown;
    try { await runner([leaky], { env: { ANTHROPIC_API_KEY: "sk-test-NL49" } }).run("S1", OPTS); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(InvariantViolation);
    expect((err as Error).message).not.toContain("sk-test-NL49");
    expect(JSON.stringify(repo.cases)).not.toContain("sk-test-NL49");
  });

  it("empty_suite_stores_no_run", async () => {
    await expect(runner([make_shell("S2", "NL-85")]).run("S2", OPTS)).rejects.toBeInstanceOf(EmptySuiteError);
    expect(repo.runs).toHaveLength(0);
  });

  it("repeat_index_in_case_id", async () => {
    await runner([make_fixture_suite()]).run("S1", { ...OPTS, repeat: 3 });
    expect(repo.cases.map((c) => c.case_id)).toEqual(["fx-1#1", "fx-1#2", "fx-1#3", "fx-2#1", "fx-2#2", "fx-2#3"]);
  });

  it("unregistered suite and bad repeat throw", async () => {
    await expect(runner([]).run("S1", OPTS)).rejects.toBeInstanceOf(InvariantViolation);
    await expect(runner([make_fixture_suite()]).run("S1", { ...OPTS, repeat: 0 })).rejects.toBeInstanceOf(InvariantViolation);
  });
});

describe("report", () => {
  const sec = (suite: "S1" | "S2", passed: boolean): SectionInput => ({
    suite, eval_run_id: "ev_1", git_sha: "x", prompt_version: null, models: {}, provider_mode: "stub", n: 1, repeat: 1,
    passed: passed ? 1 : 0, total: 1, cost_usd: "0", rows: [{ case_id: "c", passed, source: "s", failure_category: null }],
  });
  it("renders labels and merges by suite", () => {
    expect(render_suite_section(sec("S1", true))).toContain("prompt_version: none (stub)");
    const a = merge_section(null, "x", "golden", sec("S2", true));
    const b = merge_section(a, "x", "golden", sec("S1", false));
    expect(b.indexOf("## Suite S1")).toBeLessThan(b.indexOf("## Suite S2"));
    expect(b).toContain("passed: 0/1");
  });
});

// NL-85
describe("S2/S4 records", () => {
  it("test_eval_runner_writes_results (S2)", async () => {
    const suite = make_s2("stub");
    const s = await runner([suite]).run("S2", OPTS);
    expect(repo.runs).toHaveLength(1);
    expect(repo.cases).toHaveLength(suite.cases().length);
    for (const c of repo.cases) {
      expect(c.source).not.toBe("");
      expect(c.provenance).not.toBe("");
      expect(c.guards).not.toBe("");
    }
    expect(s.passed).toBe(s.total);
  }, 60_000);

  it("test_grounding_suite_records", async () => {
    const s = await runner([make_s4("stub")]).run("S4", OPTS);
    expect(repo.runs).toHaveLength(1);
    expect(repo.cases).toHaveLength(19);
    expect(s.passed).toBe(19);
    for (const c of repo.cases) expect(c.source).not.toBe("");
    expect(repo.cases.filter((c) => c.case_id.startsWith("plant-"))).toHaveLength(12);
    expect(repo.cases.some((c) => c.case_id === "plant-P05-not-caught-by-code")).toBe(true);
    for (const c of repo.cases.filter((c) => c.case_id.startsWith("clean-"))) {
      expect(c.actual).toHaveProperty("false_flags");
    }
    expect(s.report_path).toBe("evals/reports/grounding-abc123def456.md");
  }, 60_000);
});

// NL-109: the optional `preflight` and `report_text` hooks of EvalSuite
describe("suite hooks", () => {
  it("preflight_refusal_starts_no_run: a throwing preflight means start_eval_run is never called", async () => {
    const base = make_fixture_suite();
    const refusing: EvalSuite = { ...base, preflight: () => { throw new InvariantViolation("S3 cost guard: test"); } };
    await expect(runner([refusing]).run("S1", OPTS)).rejects.toBeInstanceOf(InvariantViolation);
    expect(repo.runs).toHaveLength(0);
    expect(repo.cases).toHaveLength(0);
  });

  it("report_text_is_appended_and_replaced: a second run replaces the Detail block, never duplicates it", async () => {
    let n = 0;
    const base = make_fixture_suite();
    const detailed: EvalSuite = { ...base, report_text: (s) => `## Detail S1\n- run ${++n} of ${s.total}\n` };
    const r = runner([detailed]);
    const s = await r.run("S1", OPTS);
    await r.run("S1", OPTS);
    const text = fs.readFileSync(path.join(root, s.report_path), "utf8");
    expect(text.match(/## Detail S1/g)).toHaveLength(1);
    expect(text.match(/## Suite S1/g)).toHaveLength(1);
    expect(text).toContain("- run 2 of 2");
    expect(text).not.toContain("- run 1 of 2");
    expect(text.indexOf("## Suite S1")).toBeLessThan(text.indexOf("## Detail S1"));
  });
});

