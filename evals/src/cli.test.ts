// NL-49
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FakeClock } from "@ls/core/ports/clock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse_args, run_cli, type CliDeps } from "./cli.ts";
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
    ["heartbeat", "S8"], ["load", "S14"], // S3 was filled by NL-109, S5 by NL-125
  ])("empty_suite_never_green: %s", async (alias, suite) => {
    expect(await run_cli(["golden", "--suite", alias], deps(default_suite_factory))).toBe(2);
    expect(errs).toContain(`suite has no cases: ${suite}`);
    expect(repo.runs).toHaveLength(0);
  });

  it("empty_suite_never_green: fixed subcommands", async () => {
    for (const sub of ["seed", "heldout", "judge-calibrate"]) { // S6 (faults) is no longer empty: real cases, ~57 s
      expect(await run_cli([sub], deps(default_suite_factory))).toBe(2);
    }
    expect(repo.runs).toHaveLength(0);
  });

  it("failed_floor_case_exits_nonzero: floor-1.00 suite fails, floor-0 suite does not", async () => {
    const f1: SuiteFactory = () => [make_fixture_suite({ fail: ["fx-2"] })];
    expect(await run_cli(["golden", "--suite", "intake"], deps(f1))).toBe(1);
    const f3: SuiteFactory = () => [make_fixture_suite({ name: "S8", fail: ["fx-2"] })]; // S3 now has floor 1.0 (NL-109 R2)
    expect(await run_cli(["golden", "--suite", "heartbeat"], deps(f3))).toBe(0);
    const f4: SuiteFactory = () => [make_fixture_suite({ name: "S3", fail: ["fx-2"] })];
    expect(await run_cli(["golden", "--suite", "drafts"], deps(f4))).toBe(1);
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

  // NL-109: --max-usd and --stub-draft
  it("max_usd_and_stub_draft_flags", () => {
    expect(parse_args(["golden", "--suite", "drafts", "--max-usd", "0.01"])).toMatchObject({ max_usd: 0.01, stub_draft: null });
    expect(parse_args(["golden", "--suite", "drafts"])).toMatchObject({ max_usd: null, stub_draft: null });
    expect(parse_args(["golden", "--suite", "drafts", "--stub-draft", "x.json"])).toMatchObject({ stub_draft: "x.json", provider_mode: "stub" });
    for (const bad of [["--max-usd", "abc"], ["--max-usd", "0"], ["--max-usd"], ["--stub-draft"], ["--provider", "real", "--stub-draft", "x"], ["--stub-draft", "x", "--provider", "real"]]) {
      expect(typeof parse_args(["golden", "--suite", "drafts", ...bad]), bad.join(" ")).toBe("string");
    }
  });

  it("max_usd_and_stub_draft_reach_the_suite", async () => {
    const seen: EvalOptions[] = [];
    const base = make_fixture_suite();
    const f: SuiteFactory = () => [{ ...base, score: (c, o) => { seen.push(o); return base.score(c, o); } }];
    expect(await run_cli(["golden", "--suite", "intake", "--max-usd", "2.5", "--stub-draft", "d.json"], deps(f))).toBe(0);
    expect(seen[0]).toMatchObject({ max_usd: 2.5, stub_draft: "d.json" });
  });
});
