import { describe, expect, it } from "vitest";
import { summarize, type ReplayRecord } from "./replay-finals.ts";
import { render_comparison, transitions, type Boundary } from "./replay-finals-compare.ts";

const f = (kind: string) => ({ kind, level: "blocking", address: null, code: null });
const rec = (lesson: string, gen: ReturnType<typeof f>[] | null, review: ReturnType<typeof f>[] | null = gen): ReplayRecord => ({
  lesson, which: "final", status: "ready", source: null, no_output_reason: null, schema_issues: [], compile_error: null, gen, review,
  review_context: "generation_time", identity: null, state_probe: null, historical: { tile_state: "ready", repairs: 0, truncation_retries: 0, failure_reasons: [] },
});
const boundary = (commit: string, records: ReplayRecord[], input_hash = "a".repeat(64)): Boundary => ({
  label: `L-${commit}`, commit: commit.padEnd(40, "0"), code_dirty: false, input_hash, review_context: "generation_time", summaries: { final: summarize(records) }, records,
});

describe("transitions", () => {
  it("test_transitions_by_lesson", () => {
    const prev = [rec("a", []), rec("b", [f("x")]), rec("c", []), rec("d", [f("x")])];
    const next = [rec("a", [f("y")]), rec("b", []), rec("c", []), rec("d", [f("x")])];
    expect(transitions(prev, next, "gen")).toEqual({ newly_blocked: ["a"], newly_unblocked: ["b"], still_blocked: 1, still_passing: 1 });
  });
  it("test_not_compiled_is_not_passing", () => {
    expect(transitions([rec("a", [])], [rec("a", null)], "gen").newly_blocked).toEqual(["a"]);
    expect(transitions([rec("a", null)], [rec("a", [])], "gen").newly_unblocked).toEqual(["a"]);
    expect(transitions([rec("a", null)], [rec("a", null)], "gen").still_blocked).toBe(1);
  });
});

describe("render_comparison", () => {
  const b0 = boundary("aaaaaaa", [rec("a", [f("x")]), rec("b", []), rec("c", null)]);
  const b1 = boundary("bbbbbbb", [rec("a", []), rec("b", [f("y")]), rec("c", null)]);
  it("test_render_has_both_denominators_in_every_pass_cell", () => {
    const md = render_comparison([b0, b1], "final");
    expect(md).toContain("1/3 of all, 1/2 of compiled");
    const cells = md.split("\n").filter((l) => /^\| [01] \| [ab]{7} \| \d+\/\d+ of all/.test(l));
    expect(cells).toHaveLength(4);
    expect(cells.every((l) => /of all, \d+\/\d+ of compiled/.test(l))).toBe(true);
    expect(md).toContain("Attribution is order-dependent");
  });
  it("test_render_warns_when_input_hash_differs", () => {
    expect(render_comparison([b0, boundary("bbbbbbb", b1.records, "c".repeat(64))], "final")).toContain("WARNING");
    expect(render_comparison([b0, b1], "final")).not.toContain("WARNING");
  });
  it("test_render_per_kind_delta_column", () => {
    const md = render_comparison([b0, b1], "final");
    expect(md).toContain("d 0->1");
    expect(md).toContain("| x | 1 | 0 | -1 |");
    expect(md).toContain("| y | 0 | 1 | +1 |");
    expect(md).toContain("newly blocked 1 (b); newly unblocked 1 (a)");
  });
});
