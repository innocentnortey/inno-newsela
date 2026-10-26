import { describe, expect, it } from "vitest";
import { initial_state } from "@ls/core/pipeline/state";
import { route_after_checks } from "@ls/core/pipeline/route-after-checks";
import { compile_draft } from "@ls/core/compile/compile-draft";
import { template_for } from "@ls/core/compile/templates";
import { content_hash } from "@ls/schema/content-hash";
import { CompileCheckNode } from "./compile-check-node.ts";
import type { JobContext, JobState } from "./job-state.ts";
import { CHECK_POLICY, CHECK_RULES, good_wp1_draft, load_draft, load_row, make_job, make_loader, row_context_of, standard_rows } from "./testing/fixtures.ts";

function state_with(raw: string): JobState {
  const row = load_row("wp1");
  const context: JobContext = {
    row_context: row_context_of(row), standards: standard_rows(row), calls: [], draft_call: null,
    draft_max_output_tokens: 32000, effort: "high", raw_output: raw, provider_error: null,
  };
  return { ...(initial_state(make_job(), 0) as JobState), context };
}
const node = () => new CompileCheckNode(make_loader(load_row("wp1")), CHECK_RULES, CHECK_POLICY);
const route = (s: JobState) =>
  route_after_checks({ schema_valid: s.draft !== null, compiled: s.compiled !== null, check_passed: s.check_result !== null && s.check_result.blocking === 0, repair_rounds: 0, max_repair_rounds: 1 });

describe("CompileCheckNode", () => {
  it("hostile_output", async () => {
    const d = load_draft("wp1");
    const hostile = {
      ...d,
      blocks: [
        ...d.blocks,
        { ...d.blocks[0]!, role: "paragraph", text: "<script>alert(1)</script>" },
        { ...d.blocks[0]!, role: "quote", text: "x" },
      ],
    };
    const s = await node().run(state_with(JSON.stringify(hostile)));
    expect(s.draft).toBeNull();
    expect(s.schema_issues.length).toBeGreaterThan(0);
    const joined = s.schema_issues.join(" ");
    expect(joined).not.toContain("script");
    expect(joined).not.toContain("alert");
    expect(s.schema_issues.every((p) => /^[\w.$]+$/.test(p))).toBe(true);
    expect(route(s)).toBe("repair");
  });

  it("unparseable_output_is_a_root_issue", async () => {
    const s = await node().run(state_with("not json {"));
    expect(s.schema_issues).toEqual(["$"]);
    expect(s.draft).toBeNull();
  });

  it("fills_standards_and_rehashes", async () => {
    const row = load_row("wp1");
    const s = await node().run(state_with(JSON.stringify(good_wp1_draft())));
    const c = s.compiled!;
    expect(c.lesson.front_matter.standards.length).toBeGreaterThan(0);
    expect(c.lesson.front_matter.standards[0]!.code).toBe(row.focus_codes[0]);
    expect(c.content_hash).toBe(content_hash(c.lesson));
    const bare = compile_draft(good_wp1_draft(), { row, template: template_for("Reading")!, unit_id: "G6.U4" as never, schema_version: 1 });
    expect(bare.lesson.front_matter.standards).toEqual([]);
    expect(c.content_hash).not.toBe(bare.content_hash);
    expect(s.check_result!.content_hash).toBe(c.content_hash);
  });

  it("compile_error_message_has_no_text", async () => {
    const d = good_wp1_draft();
    const bad = { ...d, blocks: d.blocks.map((b, i) => (i === 0 ? { ...b, section: "Not A Section", text: "SECRET-LESSON-TEXT" } : b)) };
    const s = await node().run(state_with(JSON.stringify(bad)));
    expect(s.compile_error).toMatch(/^COMPILE_ERROR: /);
    expect(s.compile_error).not.toContain("SECRET-LESSON-TEXT");
    expect(s.compiled).toBeNull();
  });

  it("tagged_leaf_is_recorded_as_narrowed_and_asks_for_confirmation", async () => {
    const row = { ...load_row("wp1"), focus_codes: ["RL.6.1", "RL.6.2", "L.6.4"] };
    const d = good_wp1_draft();
    const blocks = d.blocks.map((b) =>
      b.cfu?.standard_code === "L.6.4.b" ? { ...b, standard_codes: ["L.6.4.b"], cfu: { ...b.cfu, standard_code: "L.6.4.b" } } : b,
    );
    const rows = [...standard_rows(row), { code: "L.6.4", set: "CA_CCSS_ELA_6" as const, text: "parent", parent_code: null, is_leaf: false, eld_strand: null }];
    const leaf_row = { code: "L.6.4.b", set: "CA_CCSS_ELA_6" as const, text: "leaf text", parent_code: "L.6.4", is_leaf: true, eld_strand: null };
    const context: JobContext = {
      row_context: row_context_of(row), standards: rows, calls: [], draft_call: null,
      draft_max_output_tokens: 32000, effort: "high", raw_output: JSON.stringify({ ...d, blocks }), provider_error: null,
    };
    const st = { ...(initial_state(make_job(), 0) as JobState), context };
    const standards = { texts: async (codes: readonly string[]) => (codes.includes("L.6.4.b") ? [leaf_row] : []) };
    const n = new CompileCheckNode(make_loader(row), CHECK_RULES, CHECK_POLICY, standards);
    const out = await n.run(st);
    const std = out.compiled!.lesson.front_matter.standards;
    expect(std.find((x) => x.code === "L.6.4.b")).toMatchObject({ origin: "narrowed", confirmation: "open", asserted_by: "generator" });
    expect(std.some((x) => x.code === "L.6.4")).toBe(false);
  });
});
