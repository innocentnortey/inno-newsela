// NL-84
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FakeClock } from "@ls/core/ports/clock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { run_cli, type CliDeps } from "../cli.ts";
import { floor_met } from "../floors.ts";
import { EvalRunner } from "../runner.ts";
import { MemoryEvidenceRepo } from "../testing/memory-evidence.ts";
import type { EvalOptions, EvalSuite } from "../types.ts";
import { type CaseFile, load_cases } from "./case-files.ts";
import { canonical, DEFECT_KINDS, drop_kind } from "./s1-support.ts";
import { make_s1 } from "./s1.ts";

const OPTS: EvalOptions = { repeat: 1, provider_mode: "stub", git_sha: "abc123def456", unit: null };
const CASES_DIR = path.join(import.meta.dirname, "../../cases/s1");
const all = (): CaseFile[] => load_cases(CASES_DIR, "evals/cases/s1", "s1-");
const one = (id: string): CaseFile => {
  const c = all().find((x) => x.case_id === id);
  if (c === undefined) throw new Error(`no case ${id}`);
  return c;
};
const score = (s: EvalSuite, id: string) => {
  const c = s.cases().find((x) => x.case_id === id);
  if (c === undefined) throw new Error(`no case ${id}`);
  return s.score(c, OPTS);
};

let root: string;
let repo: MemoryEvidenceRepo;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "nl84-"));
  repo = new MemoryEvidenceRepo();
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
const runner = (s: EvalSuite) => new EvalRunner(repo, [s], new FakeClock(), { repo_root: root, prompt_version_id: null, models: { generation: "m" }, env: {} });

describe("S1 intake golden", () => {
  it("issued_sheet_all_fields", async () => {
    const s = make_s1("stub");
    for (const id of ["s1-issued-counts", "s1-issued-row-index", "s1-issued-row8"]) {
      const o = await score(s, id);
      expect(o, id).toMatchObject({ passed: true, failure_category: null });
    }
    const counts = (await score(s, "s1-issued-counts")).actual as Record<string, unknown>;
    // The explicit code list is the PRD's 7; the report counter is findings (16), on a different scale.
    expect(counts["eld_mismatch_whole_code_set"]).toHaveLength(7);
    expect((counts["counts"] as Record<string, number>)["eld_mismatches"]).toBe(16);
    expect(counts["eld_partial_code_label_mismatches"]).toEqual({ "ELD.PI.6.6": 2, "ELD.PI.6.7": 4 });
    expect((one("s1-issued-row-index").expected as { row_index: unknown[] }).row_index).toHaveLength(55);
  });

  it("wp5_syn2_and_one_case_per_defect", async () => {
    const s = make_s1("stub");
    for (const id of ["s1-syn2-layout", "s1-wp5-clean-control"]) expect((await score(s, id)).passed, id).toBe(true);
    const defects = all().filter((c) => c.case_id.startsWith("s1-defect-"));
    expect(defects).toHaveLength(7);
    for (const c of defects) {
      expect((await score(s, c.case_id)).passed, c.case_id).toBe(true);
      const own = Object.entries((c.expected as { defect_kinds: Record<string, number> }).defect_kinds).filter(([, n]) => n > 0 && n !== undefined);
      for (const [kind] of own.filter(([k]) => DEFECT_KINDS.includes(k as never))) {
        if (kind === "unit_conflict" && c.case_id !== "s1-defect-unit-conflict") continue;
        const mutated = make_s1("stub", { mutate: drop_kind(kind) });
        expect((await score(mutated, c.case_id)).passed, `${c.case_id} without ${kind}`).toBe(false);
      }
    }
    const every_kind_covered = new Set(defects.flatMap((c) => Object.entries((c.expected as { defect_kinds: Record<string, number> }).defect_kinds).filter(([, n]) => n > 0).map(([k]) => k)));
    expect([...every_kind_covered].sort()).toEqual([...DEFECT_KINDS].sort());
  });

  it("byte_identical_and_modelless", async () => {
    const digest = async (): Promise<string[]> => {
      const s = make_s1("stub");
      return Promise.all(s.cases().map(async (c) => createHash("sha256").update(canonical((await s.score(c, OPTS)).actual)).digest("hex")));
    };
    expect(await digest()).toEqual(await digest());
    for (const f of ["s1.ts", "s1-support.ts", "case-files.ts"]) expect(fs.readFileSync(path.join(import.meta.dirname, f), "utf8")).not.toMatch(/@ls\/llm/);
  });

  it("failing_case_fails_the_suite", async () => {
    const broken = structuredClone(one("s1-issued-counts"));
    (broken.expected as { counts: Record<string, number> }).counts["teaching_days"] = 46;
    const suite = make_s1("stub", { cases: [broken] });
    const o = await score(suite, "s1-issued-counts");
    expect(o).toMatchObject({ passed: false, failure_category: "expected_field_mismatch" });
    expect((o.actual as Record<string, unknown>)["mismatched_fields"]).toEqual(["counts"]);
    const s = await runner(suite).run("S1", OPTS);
    expect(s.passed).toBeLessThan(s.total);
    expect(repo.cases[0]).toMatchObject({ passed: false, failure_category: "expected_field_mismatch" });
    expect(floor_met("S1", s.passed, s.total)).toBe(false);
    const out: string[] = [];
    const deps: CliDeps = {
      evidence: repo, clock: new FakeClock(), suite_factory: () => [suite], git_sha: "abc123def456", repo_root: root, prompt_version_id: null,
      models: { generation: "m" }, env: {}, out: (l) => out.push(l), err: (l) => out.push(l),
    };
    expect(await run_cli(["golden", "--suite", "intake"], deps)).toBe(1);
  });

  it("test_eval_runner_writes_results_s1", async () => {
    const s = await runner(make_s1("stub")).run("S1", OPTS);
    expect(repo.runs).toHaveLength(1);
    expect(repo.cases).toHaveLength(make_s1("stub").cases().length);
    for (const c of repo.cases) {
      expect(c.provenance).not.toBe("");
      expect(c.source).not.toBe("");
      expect(c.guards).not.toBe("");
    }
    expect(s.passed).toBe(s.total);
    expect(repo.runs[0]).toMatchObject({ passed: s.total, total: s.total });
  });
});
