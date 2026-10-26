// NL-125 (WF-43): the S5 suite turns trial lines into eval_case_result rows. In-memory evidence; no browser.
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { SystemClock } from "@ls/core/ports/clock";
import { describe, expect, it } from "vitest";
import { floor_met } from "../floors.ts";
import { EvalRunner } from "../runner.ts";
import { MemoryEvidenceRepo } from "../testing/memory-evidence.ts";
import type { EvalOptions } from "../types.ts";
import { add_notes, integrity_notes } from "./s5-report.ts";
import { percentile, read_available, store_p95, type TrialLine } from "./s5-support.ts";
import { make_s5 } from "./s5.ts";

const OPTS: EvalOptions = { repeat: 1, provider_mode: "stub", git_sha: "abc123def456", unit: null };
const line = (token: string, trial: number, passed = true, store_ms: number | null = null): TrialLine => ({
  token, trial, passed, detail: passed ? "ok" : "forced", ms: 10, store_ms, request_ids: [], store_id: null,
});
const BOTH = { suggestion: true, export: true };

async function runner(): Promise<{ repo: MemoryEvidenceRepo; run: EvalRunner; dir: string }> {
  const repo = new MemoryEvidenceRepo();
  const dir = await mkdtemp(path.join(tmpdir(), "s5-"));
  const run = new EvalRunner(repo, [make_s5("stub", { read_trials: async () => [line("stale_approve", 1, true, 620)], available: BOTH })], new SystemClock(), {
    repo_root: dir, reports_dir: dir, prompt_version_id: null, models: { generation: "stub" },
  });
  return { repo, run, dir };
}

describe("S5 integrity suite", () => {
  it("test_integrity_suite_records", async () => {
    process.env["INTEGRITY_ONLY"] = "stale_approve";
    try {
      const { repo, run, dir } = await runner();
      const s = await run.run("S5", { ...OPTS, repeat: 1 });
      expect(s.passed).toBe(1);
      expect(repo.cases).toHaveLength(1);
      expect(repo.cases[0]).toMatchObject({ case_id: "stale_approve", passed: true, actual: { trial: 1, n: 1, store_ms: 620 } });
      expect(repo.runs[0]?.report_path).toBe("integrity-abc123def456.md");
      const file = path.join(dir, "integrity-abc123def456.md");
      const text = add_notes(await readFile(file, "utf8"), integrity_notes({ lines: [line("stale_approve", 1, true, 620)], git_sha: OPTS.git_sha, available: BOTH, tokens: ["stale_approve"] }));
      expect(text).toContain("abc123def456");
      expect(text).toContain("prompt version: none (stub)");
      expect(text).toContain("model IDs: stub");
      expect(text).toContain("stale_approve 1/1");
      expect(text).toContain("A reviewer editing, B second reviewer co-editing, C approver");
      expect(text).toContain("Store p95: 620 ms raw, 120 ms net");
    } finally {
      delete process.env["INTEGRITY_ONLY"];
    }
  });

  it("counter_maps_rep_to_trial", async () => {
    const lines = [line("four_eyes", 1), line("four_eyes", 2, false), line("four_eyes", 3)];
    process.env["INTEGRITY_ONLY"] = "four_eyes";
    try {
      const repo = new MemoryEvidenceRepo();
      const dir = await mkdtemp(path.join(tmpdir(), "s5-"));
      const run = new EvalRunner(repo, [make_s5("stub", { read_trials: async () => lines, available: BOTH })], new SystemClock(), { repo_root: dir, reports_dir: dir, prompt_version_id: null, models: {} });
      const s = await run.run("S5", { ...OPTS, repeat: 3 });
      expect(repo.cases.map((c) => [c.case_id, c.passed])).toEqual([["four_eyes#1", true], ["four_eyes#2", false], ["four_eyes#3", true]]);
      expect(s.passed).toBe(2);
      expect(floor_met("S5", s.passed, s.total)).toBe(false); // 2/3 is never averaged away
    } finally {
      delete process.env["INTEGRITY_ONLY"];
    }
  });

  it("trial_missing_fails", async () => {
    const suite = make_s5("stub", { read_trials: async () => [], available: BOTH });
    const c = suite.cases().find((x) => x.case_id === "round_trip")!;
    const out = await suite.score(c, { ...OPTS, repeat: 20 });
    expect(out).toMatchObject({ passed: false, failure_category: "trial_missing" });
  });

  it("not_built_excluded", () => {
    const none = make_s5("stub", { read_trials: async () => [], available: { suggestion: false, export: false } });
    expect(none.cases().map((c) => c.case_id)).toEqual(["stale_approve", "zero_edits_after_lock", "no_silent_loss", "four_eyes", "round_trip"]);
    const notes = integrity_notes({ lines: [], git_sha: "x", available: { suggestion: false, export: false } });
    expect(notes).toContain("suggestion_blocks: not built (cut #8)");
    expect(notes).toContain("export hash: not built (NL-102)");
    const all = make_s5("stub", { read_trials: async () => [], available: BOTH });
    expect(all.cases()).toHaveLength(6);
  });

  it("floor_is_one", () => {
    expect(floor_met("S5", 20, 20)).toBe(true);
    expect(floor_met("S5", 19, 20)).toBe(false);
  });

  it("availability_reads_the_merge_ledger", () => {
    const here = path.resolve(import.meta.dirname, "../../..");
    expect(read_available(here)).toEqual({ suggestion: true, export: true });
  });

  it("p95_is_nearest_rank_and_names_the_failing_trial", () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
    expect(percentile([], 95)).toBeNull();
    const ls = [line("a", 1, true, 900), line("a", 2, true, 700)];
    expect(store_p95(ls)).toEqual({ n: 2, raw: 900, net: 400, met: true });
    const notes = integrity_notes({ lines: [line("zero_edits_after_lock", 10, false)], git_sha: "x", available: BOTH, tokens: ["zero_edits_after_lock"] });
    expect(notes).toContain("zero_edits_after_lock trial 10");
    expect(notes).toContain("zero_edits_after_lock 0/1");
  });
});
