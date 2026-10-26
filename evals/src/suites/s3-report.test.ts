// NL-109 AC-4: the S3 detail block.
import { describe, expect, it } from "vitest";
import { render_drafts_report, type S3Actual, type S3ReportInput } from "./s3-report.ts";

const actual = (pair: string, over: Partial<S3Actual> = {}): S3Actual => ({
  pair,
  assertions: [{ name: "draft_stored", passed: true, fc: null, detail: "" }, { name: "required_blocks", passed: true, fc: null, detail: "" }],
  trajectory: { first_failing_step: null, fc: null, steps: [], repair_recovered: false },
  counts: { placeholders: 2, minutes_total: 50, sections: 5 },
  schema_valid_first_pass: true, initial_stage: "compiled", prompt_versions: [], calls_completed: 2, repairs_used: 0, tokens: { input: 100, output: 3000 },
  served_models: ["claude-sonnet-5-5"], requested_models: ["claude-sonnet-5-5"], cost_usd: "0.2", ...over,
});
const input = (over: Partial<S3ReportInput> = {}): S3ReportInput => ({
  git_sha: "abc123def456", prompt_version: "pv_1", provider_mode: "real", repeat: 2, cost_total: "0.8", guard_line: "S3 guard: estimated $3.17",
  effort: "low", max_tokens: "32000 (retry 48000)",
  history: [1, 2].flatMap((r) => ["wp-1", "wp-2"].map((id) => ({ case_id: id, repeat: r, actual: actual(id.toUpperCase().replace("WP-", "WP-")) }))),
  sp1: { mean_usd_per_lesson: { value: 0.182 }, rows: { "wp-1": { sheet_row: 8, wall_s: 83.1, cost_usd: 0.1445, words: 3476, schema_valid: "yes / yes", required_blocks: "10/12" } } },
  ...over,
});

describe("render_drafts_report", () => {
  it("has the six AC-4 fields in the first 40 lines", () => {
    const head = render_drafts_report(input()).split("\n").slice(0, 40).join("\n");
    for (const f of ["git_sha: abc123def456", "prompt_version: pv_1", "served_models: [claude-sonnet-5-5]", "requested_models: [claude-sonnet-5-5]", "effort: low", "max_tokens: 32000 (retry 48000)"]) expect(head).toContain(f);
  });
  it("shows the M-31 count as parse and compile", () => {
    const h = input().history.map((x, i) => (i === 0 ? { ...x, actual: actual("WP-1", { schema_valid_first_pass: false, initial_stage: "compile_error", repairs_used: 1 }) } : x));
    expect(render_drafts_report(input({ history: h }))).toContain("M-31 initial draft parses and compiles: 3/4 (parse 4/4, no output 0; repairs used: 1 of 4)");
  });
  it("recorded provenance replaces none (stub)", () => {
    const h = input().history.map((x) => ({ ...x, actual: actual("WP-1", { prompt_versions: ["v1 locked abcdef012345"] }) }));
    const text = render_drafts_report(input({ prompt_version: null, provider_mode: "real", history: h }));
    expect(text).toContain("prompt_version: v1 locked abcdef012345");
    expect(text).not.toContain("none (stub)");
    expect(text).toContain("calls_recorded: 8 completed of 0");
  });
  it("real mode with no completed call warns", () => {
    const h = input().history.map((x) => ({ ...x, actual: actual("WP-1", { calls_completed: 0 }) }));
    expect(render_drafts_report(input({ history: h }))).toContain("provider_mode: real (WARNING: no completed model call was recorded)");
  });
  it("falls back to the runner value when no run recorded one", () => {
    expect(render_drafts_report(input({ prompt_version: "pv_1" }))).toContain("prompt_version: pv_1");
  });
  it("lists the spread per case and names the first failing step and FC", () => {
    const bad = actual("WP-1", {
      assertions: [{ name: "placeholder_count", passed: false, fc: "FC-7", detail: "3 placeholders, expected exactly 2" }],
      trajectory: { first_failing_step: "checks", fc: "FC-7", steps: [], repair_recovered: false },
    });
    const text = render_drafts_report(input({ history: [{ case_id: "wp-1", repeat: 1, actual: actual("WP-1") }, { case_id: "wp-1", repeat: 2, actual: bad }] }));
    expect(text).toContain("passes: 1/2");
    expect(text).toContain("first_failing_step: checks, FC-7");
    expect(text).toContain("placeholder_count FC-7: 3 placeholders");
  });
  it("stub mode says no model was called", () => {
    expect(render_drafts_report(input({ provider_mode: "stub", prompt_version: null }))).toContain("provider_mode: stub (no model was called)");
  });
  it("carries no body text: only ids, counts and costs", () => {
    const text = render_drafts_report(input());
    expect(text).not.toMatch(/restricted\/|sk-/);
  });
  it("prints SP-1 figures only where they exist and invents nothing", () => {
    const text = render_drafts_report(input());
    expect(text).toContain("| wp-1 | 8 | $0.1445 | 83.1 | 3476 |");
    expect(text).toContain("| wp-2 | none |");
    expect(render_drafts_report(input({ sp1: null }))).toContain("SP-1 per-row figures: see the SP-1 record");
  });
});
