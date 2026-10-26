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
    expect(r.first_pass_schema_valid).toBe(world.lessons.filter((l) => l.initial === "valid").length);
    expect(r.repairs).toBe(world.lessons.reduce((a, l) => a + l.repairs, 0));
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
    expect(d.facts.stages.initial.no_output).toBe(0); // lessons that never ran are not "no output"
    const t = d.thresholds.find((x) => x.id === "first_pass_schema_valid_rate_ge_0.90")!;
    expect(t.passed).toBe(false);
    expect(t.detail).toContain("0 of 47 lessons ran");
    const text = fs.readFileSync(path.join(root, d.report.report_path), "utf8");
    expect(text).not.toContain("47/47");
    expect(text).toContain("lessons run (ready or failed) | 0 of 47");
  });
  async function detailed(world = make_stub_world({ n: 47, seed: 86 })) {
    const { c } = ctx(world);
    const d = await build_full_run_report_detailed(world.run_id as never, c);
    return { d, text: fs.readFileSync(path.join(root, d.report.report_path), "utf8") };
  }
  type W = ReturnType<typeof make_stub_world>;
  const L = (w: W, i: number) => w.lessons[i] as W["lessons"][number];

  it("valid draft needing content repair stays schema-valid", async () => {
    const w = make_stub_world({ n: 47, seed: 86 });
    L(w, 1).repairs = 1;
    const base = w.lessons.filter((l) => l.repairs === 0).length;
    const { d } = await detailed(w);
    expect(d.facts.stages.initial.parse_valid.count).toBe(47);
    expect(d.facts.stages.initial.compiled.count).toBe(47);
    expect(d.facts.stages.initial.check_clean.count).toBe(base); // base already excludes the repaired lesson
    expect(d.facts.lessons[1]?.initial_stage).toBe("compiled");
  });

  it("invalid draft is not counted valid", async () => {
    const w = make_stub_world({ n: 47, seed: 86 });
    L(w, 0).initial = "schema_invalid";
    L(w, 2).initial = "compile_error";
    const { d, text } = await detailed(w);
    const i = d.facts.stages.initial;
    expect(i.parse_valid.count).toBe(46);
    expect(i.compiled.count).toBe(45);
    expect(i.schema_invalid).toBe(1);
    expect(i.compile_error).toBe(1);
    expect(i.invalid_issue_paths["blocks.cfu"]).toBeGreaterThanOrEqual(1);
    expect(text).toContain("initial draft parses (schema-valid) | 46/47");
    expect(text).toContain("initial draft compiles | 45/47");
  });

  it("no-output failure does not count valid", async () => {
    const w = make_stub_world({ n: 47, seed: 86 });
    Object.assign(L(w, 3), { initial: "none", tile_state: "failed", reasons: [{ check: "provider_error" }] });
    const { d } = await detailed(w);
    expect(d.facts.stages.initial.no_output).toBe(1);
    expect(d.facts.stages.initial.parse_valid.count).toBe(46);
    expect(d.facts.stages.initial.compiled.count).toBe(46);
    expect(d.facts.failures_by_reason).toEqual({ provider_error: 1 });
  });

  it("repairs===0 is not the validity test", async () => {
    const w = make_stub_world({ n: 47, seed: 86 });
    Object.assign(L(w, 4), { repairs: 0, initial: "schema_invalid" });
    const { d } = await detailed(w);
    expect(d.facts.lessons[4]?.repairs).toBe(0);
    expect(d.facts.lessons[4]?.initial_stage).toBe("schema_invalid");
    expect(d.facts.stages.initial.compiled.count).toBe(46);
  });

  it("stages are separate rows with their own denominators", async () => {
    const w = make_stub_world({ n: 47, seed: 86 });
    L(w, 0).initial = "schema_invalid";
    L(w, 5).initial = "compile_error";
    for (const i of [6, 7, 8]) Object.assign(L(w, i), { repairs: 1, tile_state: "failed", reasons: [{ check: "check_failed", check_kind: "quote_unmatched" }] });
    const A = w.lessons.filter((l) => l.initial === "valid" || l.initial === "compile_error").length;
    const B = w.lessons.filter((l) => l.initial === "valid").length;
    const C = w.lessons.filter((l) => l.initial === "valid" && l.repairs === 0 && l.tile_state === "ready").length;
    const K = w.lessons.filter((l) => l.repairs >= 1).length;
    const R = w.lessons.filter((l) => l.repairs >= 1 && l.tile_state === "ready").length;
    const ready = w.lessons.filter((l) => l.tile_state === "ready").length;
    const { text } = await detailed(w);
    for (const row of [
      `initial draft parses (schema-valid) | ${A}/47`, `initial draft compiles | ${B}/47`, `no repair needed (recorded; checks were not re-run) | ${C}/47`,
      `repair recovered to ready | ${R}/${K}`, `stored ready | ${ready}/47`,
    ]) expect(text).toContain(row);
  });

  it("failures keep their check kind", async () => {
    const w = make_stub_world({ n: 47, seed: 86 });
    const fail = (i: number, at: number, reasons: { check: string; check_kind?: string }[]) =>
      Object.assign(L(w, i), { tile_state: "failed", reasons, finished: new Date(Date.UTC(2026, 9, 25, 12, at)) });
    fail(10, 5, [{ check: "check_failed", check_kind: "proper_noun_unsourced" }]);
    fail(11, 1, [{ check: "check_failed", check_kind: "page_out_of_range" }, { check: "check_failed", check_kind: "quote_unmatched" }]);
    const { d, text } = await detailed(w);
    expect(d.facts.failures_by_reason).toEqual({
      "check_failed:page_out_of_range": 1, "check_failed:proper_noun_unsourced": 1, "check_failed:quote_unmatched": 1,
    });
    expect(d.facts.failures_by_reason).not.toHaveProperty("check_failed");
    expect(d.facts.failures_first_by_reason).toEqual({ "check_failed:page_out_of_range": 1, "check_failed:proper_noun_unsourced": 1 });
    expect(d.facts.failure_chronology.map((f) => f.lesson_id)).toEqual([L(w, 11).lesson_id, L(w, 10).lesson_id]);
    expect(text).toContain("check_failed:page_out_of_range > check_failed:quote_unmatched");
    expect(text).toContain("stored reasons keep the first failing check kind per lesson");
  });

  it("pending checks print pending, not zero", async () => {
    const w = make_stub_world({ n: 47, seed: 86 });
    for (const l of w.lessons) l.check_state = "pending";
    const { d, text } = await detailed(w);
    expect(d.facts.stages.review.lessons_pending).toBe(47);
    expect(text).toContain("pending: 47 ready lessons not yet checked");
    expect(text).toContain("- none yet");
    expect(text).toContain("incomplete: 47 lessons pending");
    expect(text).not.toMatch(/review blockers \(ready lessons\) \| 0 of/);
  });

  it("open slots do not depend on issues", async () => {
    const w = make_stub_world({ n: 47, seed: 86 });
    for (const l of w.lessons) { l.open_grounding = []; l.blocking_open = 0; }
    const { d, text } = await detailed(w);
    expect(d.facts.stages.open_slots).toMatchObject({ total: 3, quote_placeholder: 2, excerpt_slot: 1, lessons_with_slots: 2 });
    expect(text).toContain("open content slots | 3 (2 quote_placeholder, 1 excerpt_slot) in 2 lessons");
  });

  it("totals reconcile with and without the unit-plan rollup", async () => {
    const th = async (w: W) => (await detailed(w)).d.thresholds.find((t) => t.id === "totals_equal_call_sums")!;
    const a = make_stub_world({ n: 47, seed: 86 });
    a.unattributed = new Decimal("0.4");
    const ta = await th(a);
    expect(ta.passed).toBe(true);
    expect(ta.detail).toContain("added back here");
    const b = make_stub_world({ n: 47, seed: 86 });
    b.unattributed = new Decimal("0.4");
    b.extra_jobs = [{ cost: new Decimal("0.4") }];
    const tb = await th(b);
    expect(tb.passed).toBe(true);
    expect(tb.detail).toContain("also on its job row");
    const c2 = make_stub_world({ n: 47, seed: 86 });
    c2.unattributed = new Decimal("0.4");
    c2.extra_jobs = [{ cost: new Decimal("0.3") }];
    expect((await th(c2)).passed).toBe(false);
    const d2 = make_stub_world({ n: 47, seed: 86 });
    d2.calls_cost_override[L(d2, 2).lesson_id] = new Decimal("9");
    const td = await th(d2);
    expect(td.passed).toBe(false);
    expect(td.detail).toContain(L(d2, 2).lesson_id);
  });
});
