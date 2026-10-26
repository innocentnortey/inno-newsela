// NL-109: the S3 suite shell-to-real wiring that needs no database: cases, the cost-guard refusal before any world,
// the real-mode branch with a fake client factory. No model call, no database.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { InvariantViolation } from "@ls/core/errors";
import { FakeClock } from "@ls/core/ports/clock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { run_cli, type CliDeps } from "../cli.ts";
import { MemoryEvidenceRepo } from "../testing/memory-evidence.ts";
import type { EvalOptions } from "../types.ts";
import { DRAFTS_DIR, load_s3_cases } from "./s3-cases.ts";
import { stub_drafts } from "./s3-run.ts";
import { make_s3 } from "./s3.ts";
import type { World } from "./s6-world.ts";

const STUB: EvalOptions = { repeat: 1, provider_mode: "stub", git_sha: "abc123def456", unit: null };

describe("make_s3 cases", () => {
  it("returns the three hand-written pairs with source and guards", () => {
    const cs = make_s3("stub").cases();
    expect(cs.map((c) => c.case_id)).toEqual(["wp-1", "wp-2", "wp-3"]);
    expect(cs.map((c) => c.source)).toEqual(["WP-1", "WP-2", "WP-3"]);
    for (const c of cs) {
      expect(c.provenance).toBe("hand-written");
      expect(c.guards.trim()).not.toBe("");
      expect(c.input_path).toBe(`evals/cases/drafts/${c.case_id}/input.json`);
    }
    expect(make_s3("real").cases()).toHaveLength(3);
  });

  it("a case folder missing expected.json throws (shared loader)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "s3-cases-"));
    try {
      fs.cpSync(DRAFTS_DIR, dir, { recursive: true });
      fs.rmSync(path.join(dir, "wp-2", "expected.json"));
      expect(() => load_s3_cases(dir)).toThrow();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("every expected.json names its authority and none cites the restricted folder", () => {
    for (const e of load_s3_cases()) {
      expect(e.expected.authority).toMatch(/^docs\/data\/worked-pairs\.md WP-\d Required output B$/);
      expect(JSON.stringify(e)).not.toContain("restricted");
    }
  });
});

describe("stub drafts", () => {
  it("WP-1 starts defective and is repaired; a --stub-draft file replaces both", () => {
    const d = stub_drafts("wp-1", null);
    expect(d.first).not.toEqual(d.repair);
    const o = { lesson_id: "x", blocks: [] };
    expect(stub_drafts("wp-2", o)).toEqual({ first: o, repair: o });
  });
  it("leaf codes are narrowed in the stub drafts, parents are kept", () => {
    const d = stub_drafts("wp-2", null).repair as { blocks: { standard_codes: string[]; code_origins: string[] }[] };
    const pairs = d.blocks.flatMap((b) => b.standard_codes.map((c, i) => [c, b.code_origins[i]]));
    expect(pairs).toContainEqual(["W.6.2.a", "narrowed"]);
    expect(pairs).toContainEqual(["W.6.2", "outline"]);
  });
});

describe("cost guard before any world (AC-6)", () => {
  let root: string;
  let repo: MemoryEvidenceRepo;
  let errs: string[];
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "nl109-")); repo = new MemoryEvidenceRepo(); errs = []; });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("cost_guard_refuses_before_any_call: --max-usd 0.01 --repeat 3 exits 2, builds no world, stores no run", async () => {
    let worlds = 0;
    const suite = make_s3("stub", { env: {}, make_world: async () => { worlds++; throw new Error("must not be built"); } });
    const deps: CliDeps = {
      evidence: repo, clock: new FakeClock(), suite_factory: () => [suite], git_sha: "abc123def456", repo_root: root, prompt_version_id: null,
      models: {}, env: {}, out: () => undefined, err: (l) => errs.push(l),
    };
    expect(await run_cli(["golden", "--suite", "drafts", "--max-usd", "0.01", "--repeat", "3"], deps)).toBe(2);
    expect(errs.join("\n")).toContain("S3 cost guard");
    expect(worlds).toBe(0);
    expect(repo.runs).toHaveLength(0);
  });

  it("a missing --stub-draft file refuses before any run", () => {
    const suite = make_s3("stub", { env: {} });
    expect(() => suite.preflight!({ ...STUB, stub_draft: "evals/cases/drafts/_fixtures/nope.json" })).toThrow(InvariantViolation);
  });
});

describe("real branch (never run here)", () => {
  const REAL: EvalOptions = { ...STUB, provider_mode: "real" };
  const case0 = () => make_s3("real").cases()[0]!;

  it("without ANTHROPIC_API_KEY, score throws before any world is built", async () => {
    let worlds = 0;
    const suite = make_s3("real", { env: {}, make_world: async () => { worlds++; throw new Error("no"); } });
    await expect(suite.score(case0(), REAL)).rejects.toThrow(/needs ANTHROPIC_API_KEY/);
    expect(worlds).toBe(0);
  });

  it("asks the client factory for effort low and the 32000 cap, and no key reaches an error message", async () => {
    const KEY = "sk-ant-FAKE-KEY-FOR-TEST-0000";
    let seen: { effort: string; cap: number; mode: string } | null = null;
    let world_opts: { client?: unknown; prices?: unknown } | null = null;
    const suite = make_s3("real", {
      env: { ANTHROPIC_API_KEY: KEY },
      make_client: (s) => { seen = { effort: s.model.model_effort, cap: s.draft_output_token_cap, mode: s.model.model_provider_mode }; return { fake: true } as never; },
      make_world: async (o) => { world_opts = o; throw new Error("stop after wiring"); },
    });
    const err = (await suite.score(case0(), REAL).catch((e: unknown) => e)) as Error;
    expect(err.message).toBe("stop after wiring");
    expect(err.message).not.toContain(KEY);
    expect(seen).toEqual({ effort: "low", cap: 32000, mode: "real" });
    expect(world_opts).toMatchObject({ client: { fake: true } });
    expect((world_opts as unknown as { prices: unknown }).prices).toBeDefined();
  });

  it("the running budget stops before the next case in real mode", async () => {
    const suite = make_s3("real", { env: { ANTHROPIC_API_KEY: "k" }, make_world: async () => ({}) as World });
    await expect(suite.score(case0(), { ...REAL, max_usd: 0.3 })).rejects.toThrow(/S3 cost guard: running total/);
  });
});
