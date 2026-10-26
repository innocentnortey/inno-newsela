// NL-86 AC-4, AC-6, AC-8 (and AC-9 over fakes). The Postgres variant is full-run-report.int.test.ts.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Decimal from "decimal.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build_full_run_report, build_full_run_report_detailed, type FullRunContext } from "./full-run-report.ts";
import { make_leak_guard } from "./leak-guard.ts";
import { MemoryEvidenceRepo } from "./testing/memory-evidence.ts";
import { make_stub_world } from "./testing/full-run-world.ts";

let root: string;
beforeAll(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "nl86-")); });
afterAll(() => { fs.rmSync(root, { recursive: true, force: true }); });

function ctx(world = make_stub_world({ n: 47, seed: 86 }), env: Record<string, string | undefined> = {}) {
  const evidence = new MemoryEvidenceRepo();
  const c: FullRunContext = {
    ports: world.ports, evidence, repo_root: root, git_sha: "abc123def456", prompt_version_id: "pv_1",
    models: { generation: "model-gen-x", repair: "model-rep-x" }, provider_mode: "stub", env,
  };
  return { world, evidence, c };
}

describe("full-run report", () => {
  it("test_full_run_report_shape", async () => {
    const { world, evidence, c } = ctx();
    const r = await build_full_run_report(world.run_id as never, c);
    // independent sums over the same fixture arrays
    const cost = world.calls.reduce((a, x) => a.plus(x.cost), new Decimal(0));
    expect(r.n).toBe(47);
    expect(r.first_pass_schema_valid).toBe(world.lessons.filter((l) => l.repairs === 0).length);
    expect(r.repairs).toBe(world.calls.filter((x) => x.purpose === "repair").length);
    expect(r.placeholders).toBe(3);
    expect(r.cost_usd.eq(cost)).toBe(true);
    const flagged = world.lessons.filter((l) => l.open_grounding.length > 0).length;
    expect(r.grounding_flags_by_kind).toEqual(flagged === 0 ? {} : { quote_unmatched: flagged });
    const sorted = world.lessons.map((l) => l.confirmations).sort((a, b) => a - b);
    expect(r.confirmations).toBe(Math.ceil((sorted[23] as number)));
    expect(evidence.runs).toHaveLength(1);
    expect(evidence.runs[0]).toMatchObject({ suite: "S9", total: 47, report_path: r.report_path });
    expect(evidence.cases).toHaveLength(47);
  });

  it("path_stored_and_run_named", async () => {
    const { world, evidence, c } = ctx();
    const r = await build_full_run_report(world.run_id as never, c);
    expect(r.report_path).toBe("evals/reports/full-run-run_world.md");
    const text = fs.readFileSync(path.join(root, r.report_path), "utf8");
    for (const s of ["abc123def456", "pv_1", "model-gen-x", "single run, n = 47", "run_world"]) expect(text).toContain(s);
    expect(evidence.runs[0]?.report_path).toBe(r.report_path);
  });

  it("no_secrets_or_names_in_report", async () => {
    const world = make_stub_world({ n: 47, seed: 86 });
    const env = { DRIVER_PASSWORD: "pw-seeded-marker-0002", ANTHROPIC_API_KEY: "sk-seeded-marker-0001" };
    const { c } = ctx(world, env);
    const r = await build_full_run_report(world.run_id as never, c);
    const text = fs.readFileSync(path.join(root, r.report_path), "utf8");
    const guard = make_leak_guard({ ...env, SESSION_TOKEN: "tok-seeded-marker-0003" });
    expect(() => guard("report", text)).not.toThrow();
    expect(text).not.toMatch(/Reviewer A|12\.5 min|restricted\//);
    // a leak in the text is refused, not written
    const bad = ctx(make_stub_world({ n: 47, seed: 86 }), { DRIVER_PASSWORD: "run_world" }); // the run id appears in the text
    await expect(build_full_run_report(bad.world.run_id as never, bad.c)).rejects.toThrow(/secret or restricted/);
  });

  it("detailed result carries thresholds and the eval_run id", async () => {
    const { world, c } = ctx();
    const d = await build_full_run_report_detailed(world.run_id as never, c);
    expect(d.thresholds.map((t) => t.id)).toContain("n_is_47");
    expect(d.eval_run_id).toMatch(/^ev_mem_/);
  });

  it("GEN-8: with zero lessons run the first-pass line is not a pass and the report says so", async () => {
    const world = make_stub_world({ n: 47, seed: 86 });
    for (const l of world.lessons) (l as { tile_state: string }).tile_state = "queued";
    const { c } = ctx(world);
    const d = await build_full_run_report_detailed(world.run_id as never, c);
    expect(d.facts.lessons_run).toBe(0);
    expect(d.facts.first_pass_schema_valid).toBe(0);
    const t = d.thresholds.find((x) => x.id === "first_pass_schema_valid_rate_ge_0.90")!;
    expect(t.passed).toBe(false);
    expect(t.detail).toContain("0 of 47 lessons ran");
    const text = fs.readFileSync(path.join(root, d.report.report_path), "utf8");
    expect(text).not.toContain("47/47");
    expect(text).toContain("lessons run (ready or failed) | 0 of 47");
  });
});
