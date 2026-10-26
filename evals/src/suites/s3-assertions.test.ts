// NL-109: the eight S3 assertions, each failing alone on a one-field mutation of a passing observation, plus the trajectory
// and the failure-kind mapping. Pure: no database, no model.
import { describe, expect, it } from "vitest";
import { FailureReason } from "@ls/schema/api/runs";
import { ALL_CHECK_KINDS, ASSERTION_NAMES, CHECK_KIND_TO_FC, derive_trajectory, FAILURE_KIND_TO_FC, run_assertions, type S3Expected, type S3Observed } from "./s3-assertions.ts";
import { load_s3_cases } from "./s3-cases.ts";

const cases = load_s3_cases();
const E = (id: string): S3Expected => cases.find((c) => c.file.case_id === id)!.expected;
const wp1 = E("wp-1");
const wp2 = E("wp-2");
const wp3 = E("wp-3");

const blocks_for = (e: S3Expected) => e.sections.flatMap((s) => s.required_roles.flatMap((r) => r.roles.map((role) => ({
  role, section: s.name, part: r.part, standard_codes: [] as string[], code_origins: [] as string[],
}))));
const calls = (extra: Partial<S3Observed["calls"][number]>[] = []) => [
  { purpose: "unit_plan", attempt: 1, status: "completed", stop_reason: "end_turn", served_model: "m", requested_model: "m", input_tokens: 1, output_tokens: 1, cost_usd: "0.1" },
  { purpose: "lesson_draft", attempt: 1, status: "completed", stop_reason: "end_turn", served_model: "m", requested_model: "m", input_tokens: 1, output_tokens: 1, cost_usd: "0.1" },
  ...extra.map((x) => ({ purpose: "repair", attempt: 1, status: "completed", stop_reason: "end_turn", served_model: "m", requested_model: "m", input_tokens: 1, output_tokens: 1, cost_usd: "0.1", ...x })),
];
function good(e: S3Expected): S3Observed {
  const placeholders = e.placeholders.exact;
  return {
    run_state: "ready", lesson_stored: true,
    draft: { blocks: blocks_for(e) },
    schema_valid_first_pass: true, repairs_used: 0, truncation_retries: 0,
    sections: e.sections.map((s) => ({ name: s.name, minutes: s.minutes })),
    minutes_total: 50,
    node_types: { excerpt_slot: placeholders, quote_placeholder: 0 },
    codes: e.focus_codes.map((f) => ({ code: f.parent === null ? f.code : f.parent, origin: "outline" })),
    cfu_tags: e.focus_codes.map((f) => f.parent ?? f.code),
    teaching_parts: 2,
    link: e.lesson_links.length === 0 ? null : { present: true, blocks: ["submit", "approve"] },
    failure_reasons: [], brakes: [], calls: calls(),
  };
}
const failed = (e: S3Expected, o: S3Observed) => run_assertions(e, o).filter((r) => !r.passed);

describe("run_assertions", () => {
  it.each([["wp-1", wp1], ["wp-2", wp2], ["wp-3", wp3]] as const)("a passing observation passes all eight on %s", (_id, e) => {
    const r = run_assertions(e, good(e));
    expect(r.map((x) => x.name)).toEqual([...ASSERTION_NAMES]);
    expect(r.filter((x) => !x.passed)).toEqual([]);
  });

  const mutate = (label: string, e: S3Expected, f: (o: S3Observed) => void, name: string, fc: string) =>
    it(`${label}: only ${name} fails, with ${fc}`, () => {
      const o = good(e);
      f(o);
      const bad = failed(e, o);
      expect(bad.map((b) => b.name)).toEqual([name]);
      expect(bad[0]?.fc).toBe(fc);
    });

  mutate("required_blocks", wp1, (o) => { o.draft!.blocks = o.draft!.blocks.filter((b) => !(b.role === "support_table" && b.part === "Part B")); }, "required_blocks", "FC-3");
  mutate("section_minutes (section off by 6)", wp1, (o) => { o.sections[1]!.minutes = 16; }, "section_minutes", "FC-3");
  mutate("section_minutes (total 44)", wp1, (o) => { o.minutes_total = 44; }, "section_minutes", "FC-3");
  mutate("section_minutes (total 56)", wp1, (o) => { o.minutes_total = 56; }, "section_minutes", "FC-3");
  mutate("placeholder_count (WP-1 has 1)", wp1, (o) => { o.node_types = { excerpt_slot: 1 }; }, "placeholder_count", "FC-7");
  mutate("placeholder_count (WP-1 has 3)", wp1, (o) => { o.node_types = { excerpt_slot: 2, quote_placeholder: 1 }; }, "placeholder_count", "FC-7");
  mutate("placeholder_count (WP-2 has 0)", wp2, (o) => { o.node_types = {}; }, "placeholder_count", "FC-7");
  mutate("placeholder_count (WP-2 has 2)", wp2, (o) => { o.node_types = { excerpt_slot: 2 }; }, "placeholder_count", "FC-7");
  mutate("placeholder_count (WP-3 has 1)", wp3, (o) => { o.node_types = { quote_placeholder: 1 }; }, "placeholder_count", "FC-7");
  mutate("no_quote_node", wp1, (o) => { o.node_types = { ...o.node_types, quote: 1 }; }, "no_quote_node", "FC-6");
  mutate("origin_present (missing origin)", wp1, (o) => { o.codes[0]!.origin = null; }, "origin_present", "FC-4");
  mutate("origin_present (L.6.4.b recorded as outline)", wp1, (o) => { o.codes.push({ code: "L.6.4.b", origin: "outline" }); }, "origin_present", "FC-4");
  mutate("origin_present (an added code recorded as outline)", wp3, (o) => { o.codes.push({ code: "RL.6.7", origin: "outline" }); }, "origin_present", "FC-4");
  mutate("taught_and_checked (no Pulse Check)", wp1, (o) => { o.cfu_tags = ["RL.6.1", "RL.6.2"]; }, "taught_and_checked", "FC-5");
  mutate("taught_and_checked (no teaching part)", wp1, (o) => { o.teaching_parts = 0; }, "taught_and_checked", "FC-5");
  mutate("lesson_link_blocking (link absent)", wp1, (o) => { o.link = { present: false, blocks: [] }; }, "lesson_link_blocking", "FC-9");
  mutate("lesson_link_blocking (blocks approve only)", wp1, (o) => { o.link = { present: true, blocks: ["approve"] }; }, "lesson_link_blocking", "FC-9");

  it("a recorded narrowed leaf passes, and a leaf covered through its parent passes with a note", () => {
    const o = good(wp1);
    o.codes.push({ code: "L.6.4.b", origin: "narrowed" });
    expect(failed(wp1, o)).toEqual([]);
    const via_parent = run_assertions(wp1, good(wp1)).find((r) => r.name === "origin_present");
    expect(via_parent?.detail).toContain("L.6.4.b not recorded");
  });

  it("an optional added code that is absent passes", () => {
    expect(failed(wp3, good(wp3))).toEqual([]);
  });

  it.each([
    ["no draft parsed", { draft: null, lesson_stored: false, run_state: "generation_failed", failure_reasons: [{ check: "schema_invalid", check_kind: null }] }, "FC-2"],
    ["compile failed", { lesson_stored: false, run_state: "generation_failed", failure_reasons: [{ check: "compile_error", check_kind: null }] }, "FC-3"],
    ["a check failed (grounding)", { lesson_stored: false, run_state: "generation_failed", failure_reasons: [{ check: "check_failed", check_kind: "proper_noun_unsourced" }] }, "FC-6"],
    ["a check failed (standard_not_checked)", { lesson_stored: false, run_state: "generation_failed", failure_reasons: [{ check: "check_failed", check_kind: "standard_not_checked" }] }, "FC-5"],
  ] as [string, Partial<S3Observed>, string][])("draft_stored fails with the mapped FC: %s", (_l, patch, fc) => {
    const o: S3Observed = { ...good(wp2), ...patch };
    const d = run_assertions(wp2, o).find((r) => r.name === "draft_stored")!;
    expect(d.passed).toBe(false);
    expect(d.fc).toBe(fc);
  });

  it("details carry names and counts only", () => {
    const o = good(wp1);
    o.draft!.blocks = [];
    for (const r of run_assertions(wp1, o)) expect(r.detail).not.toMatch(/restricted|sk-/);
  });
});

describe("derive_trajectory", () => {
  const traj = (o: S3Observed) => derive_trajectory(o, run_assertions(wp2, o));
  it("trajectory_first_failing_step_draft: a truncated first draft", () => {
    const o = { ...good(wp2), lesson_stored: false, run_state: "generation_failed", draft: null, failure_reasons: [{ check: "truncated", check_kind: null }], calls: calls([]) } as S3Observed;
    o.calls[1] = { ...o.calls[1]!, stop_reason: "max_tokens" };
    expect(traj(o)).toMatchObject({ first_failing_step: "draft", fc: "FC-2" });
  });
  it("trajectory_first_failing_step_compile", () => {
    const o = { ...good(wp2), lesson_stored: false, run_state: "generation_failed", draft: null, failure_reasons: [{ check: "compile_error", check_kind: null }] } as S3Observed;
    expect(traj(o)).toMatchObject({ first_failing_step: "compile", fc: "FC-3" });
  });
  it("trajectory_first_failing_step_checks: the first check pass failed and the repair recovered", () => {
    const o = { ...good(wp2), repairs_used: 1, calls: calls([{}]) } as S3Observed;
    expect(traj(o)).toMatchObject({ first_failing_step: "checks", fc: null, repair_recovered: true });
  });
  it("trajectory_first_failing_step_repair: a repair was used and the lesson still failed", () => {
    const o = { ...good(wp2), repairs_used: 1, lesson_stored: false, run_state: "generation_failed", draft: null, failure_reasons: [{ check: "check_failed", check_kind: "section_missing" }], calls: calls([{}]) } as S3Observed;
    const t = traj(o);
    expect(t.steps.find((s) => s.step === "repair")?.ok).toBe(false);
    expect(t.first_failing_step).toBe("checks");
    expect(t.fc).toBe("FC-3");
  });
  it("trajectory_first_failing_step_normalize and plan", () => {
    expect(traj({ ...good(wp2), run_state: "missing", lesson_stored: false, draft: null })).toMatchObject({ first_failing_step: "normalize" });
    expect(traj({ ...good(wp2), calls: calls().slice(1) }).first_failing_step).toBe("plan");
  });
  it("a clean run has no failing step", () => {
    expect(traj(good(wp2))).toMatchObject({ first_failing_step: null, fc: null, repair_recovered: false });
  });
});

describe("failure-kind mapping", () => {
  it("maps every FailureReason check and every CHECK_KIND", () => {
    for (const k of FailureReason.shape.check.options) expect(FAILURE_KIND_TO_FC[k], k).toBeDefined();
    for (const k of ALL_CHECK_KINDS) expect((CHECK_KIND_TO_FC as Record<string, string>)[k], k).toBeDefined();
  });
});
