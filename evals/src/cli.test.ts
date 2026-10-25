// NL-49
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FakeClock } from "@ls/core/ports/clock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { run_cli, type CliDeps } from "./cli.ts";
import { make_fixture_suite } from "./fixture-suite.ts";
import { default_suite_factory } from "./registry.ts";
import { MemoryEvidenceRepo } from "./testing/memory-evidence.ts";
import type { EvalOptions, EvalSuite, ProviderMode, SuiteFactory } from "./types.ts";

let root: string;
let repo: MemoryEvidenceRepo;
let out: string[];
let errs: string[];
const deps = (suite_factory: SuiteFactory): CliDeps => ({
  evidence: repo, clock: new FakeClock(), suite_factory, git_sha: "abc123def456", repo_root: root, prompt_version_id: null,
  models: { generation: "m" }, env: {}, out: (l) => out.push(l), err: (l) => errs.push(l),
});

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "nl49-"));
  repo = new MemoryEvidenceRepo();
  out = [];
  errs = [];
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("cli", () => {
  it.each([
    ["drafts", "S3"], ["S5", "S5"], ["load", "S14"],
  ])("empty_suite_never_green: %s", async (alias, suite) => {
    expect(await run_cli(["golden", "--suite", alias], deps(default_suite_factory))).toBe(2);
    expect(errs).toContain(`suite has no cases: ${suite}`);
    expect(repo.runs).toHaveLength(0);
  });

  it("empty_suite_never_green: fixed subcommands", async () => {
    for (const sub of ["faults", "full-run", "seed", "heldout", "judge-calibrate"]) {
      expect(await run_cli([sub], deps(default_suite_factory))).toBe(2);
    }
    expect(repo.runs).toHaveLength(0);
  });

  it("failed_floor_case_exits_nonzero: floor-1.00 suite fails, floor-0 suite does not", async () => {
    const f1: SuiteFactory = () => [make_fixture_suite({ fail: ["fx-2"] })];
    expect(await run_cli(["golden", "--suite", "intake"], deps(f1))).toBe(1);
    const f3: SuiteFactory = () => [make_fixture_suite({ name: "S3", fail: ["fx-2"] })];
    expect(await run_cli(["golden", "--suite", "drafts"], deps(f3))).toBe(0);
  });

  it("suite_names_repeat_and_stub_default", async () => {
    const modes: ProviderMode[] = [];
    const order: string[] = [];
    const wrap = (s: EvalSuite): EvalSuite => ({ ...s, score: (c, o: EvalOptions) => { order.push(s.name); return s.score(c, o); } });
    const factory: SuiteFactory = (m) => { modes.push(m); return [wrap(make_fixture_suite()), wrap(make_fixture_suite({ name: "S2" }))]; };
    expect(await run_cli(["golden", "--suite", "intake,checks"], deps(factory))).toBe(0);
    expect(modes).toEqual(["stub"]);
    expect([...new Set(order)]).toEqual(["S1", "S2"]);
    expect(out[0]).toMatch(/^S1 2\/2 report=evals\/reports\/golden-abc123def456\.md$/);

    repo = new MemoryEvidenceRepo();
    expect(await run_cli(["golden", "--suite", "intake", "--repeat", "3"], deps(factory))).toBe(0);
    expect(repo.cases.filter((c) => c.case_id.startsWith("fx-1#")).map((c) => c.case_id)).toEqual(["fx-1#1", "fx-1#2", "fx-1#3"]);
  });

  it("unknown_suite_and_flag_exit_2", async () => {
    const d = deps(default_suite_factory);
    expect(await run_cli(["golden", "--suite", "nope"], d)).toBe(2);
    expect(await run_cli(["golden"], d)).toBe(2);
    expect(await run_cli(["golden", "--suite", "intake", "--wat"], d)).toBe(2);
    expect(await run_cli(["bogus"], d)).toBe(2);
    expect(await run_cli([], d)).toBe(2);
    expect(errs.every((e) => e.startsWith("usage:"))).toBe(true);
  });

  it("unit_flag_normalised", async () => {
    const seen: (string | null)[] = [];
    const base = make_fixture_suite();
    const f: SuiteFactory = () => [{ ...base, score: (c, o) => { seen.push(o.unit); return base.score(c, o); } }];
    expect(await run_cli(["golden", "--suite", "intake", "--unit", "G6-U4"], deps(f))).toBe(0);
    expect(new Set(seen)).toEqual(new Set(["G6.U4"]));
    expect(await run_cli(["golden", "--suite", "intake", "--unit", "bad"], deps(f))).toBe(2);
  });

  it("fixture_flag_runs_two_cases", async () => {
    expect(await run_cli(["golden", "--suite", "intake", "--fixture"], deps(default_suite_factory))).toBe(0);
    expect(repo.cases).toHaveLength(2);
    expect(repo.cases.every((c) => c.source !== "")).toBe(true);
  });
});
