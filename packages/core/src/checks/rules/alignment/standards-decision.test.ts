// F2-D3: the one decision on empty, narrowed and added standards, driven through compile -> identity -> rules -> gates.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "@ls/editor-schema/schema";
import type { UnitId } from "@ls/schema/ids";
import type { StoredLesson } from "@ls/schema/lesson";
import { LessonDraft } from "@ls/schema/lesson-draft";
import { NormalizedRow } from "@ls/schema/outline";
import { compile_draft } from "../../../compile/compile-draft.ts";
import { split_code_list, standards_for_lesson } from "../../../compile/standard-identity.ts";
import { template_for } from "../../../compile/templates.ts";
import { CHECK_RULES, run_checks } from "../../registry.ts";
import { approve_gate, merge_resolutions, submit_gate } from "../../gates.ts";
import { DEFAULT_POLICY, gate_state, make_ctx } from "../../test-helpers.ts";
import type { CheckContext } from "../../types.ts";
import { clean_reading_ctx, std_rows } from "./test-support.ts";
import { tagged_codes } from "./standards-view.ts";

const fixture = (n: string): unknown => JSON.parse(readFileSync(new URL(`../../../../tests/fixtures/${n}.json`, import.meta.url), "utf8"));
const row_of = (n: string, over: Record<string, unknown> = {}) => NormalizedRow.parse({ ...(fixture(`row-${n}`) as object), ...over });

type Spec = { teach: string[]; cfu: (string | null)[] };
function draft_for(lesson_id: string, spec: Spec): LessonDraft {
  const cfu_block = (code: string | null) => ({
    role: "cfu_item", section: "Learning in Action", part: null, text: "", standard_codes: split_code_list(code),
    code_origins: split_code_list(code).map(() => "outline"), minutes: null,
    cfu: { stem: "Which?", options: ["a", "b", "c", "d"], key_index: 0, rationales: ["1", "2", "3", "4"], standard_code: code },
  });
  return LessonDraft.parse({
    lesson_id, title: "T", text_cards: [],
    blocks: [
      { role: "routine_heading", section: "Learning in Action", part: null, text: "Close reading", standard_codes: spec.teach, code_origins: spec.teach.map(() => "outline"), cfu: null, minutes: 30 },
      { role: "teacher_talk", section: "Learning in Action", part: null, text: "Say: model the thinking.", standard_codes: [], code_origins: [], cfu: null, minutes: null },
      ...spec.cfu.map(cfu_block),
    ],
  });
}

function build(row: NormalizedRow, draft: LessonDraft, type = "Reading") {
  const compiled = compile_draft(draft, { row, template: template_for(type)!, unit_id: "G6.U4" as UnitId, schema_version: SCHEMA_VERSION });
  const standards = standards_for_lesson(row, std_rows(), tagged_codes(compiled.lesson));
  const lesson: StoredLesson = { ...compiled.lesson, front_matter: { ...compiled.lesson.front_matter, standards } };
  const ctx: CheckContext = {
    ...make_ctx(lesson), row, standards: std_rows(),
    allowed_codes: [...new Set([...row.focus_codes].flatMap((c) => std_rows().filter((r) => r.parent_code === c).map((r) => r.code)))],
  };
  const result = run_checks(ctx, CHECK_RULES, DEFAULT_POLICY);
  const of = (kind: string) => result.findings.filter((f) => f.kind === kind);
  return { compiled, standards, ctx, result, of };
}

describe("standards decision", () => {
  it("code_less_row_null_cfu_is_valid", () => {
    const d = fixture("draft-wp3") as { blocks: { cfu: { standard_code: string | null } | null; standard_codes: string[]; code_origins: string[] }[] };
    const blocks = d.blocks.map((b) => (b.cfu === null ? b : { ...b, standard_codes: [], code_origins: [], cfu: { ...b.cfu, standard_code: null } }));
    const b = build(row_of("wp3"), LessonDraft.parse({ ...d, blocks }), "Flex Day");
    expect(b.standards).toEqual([]);
    expect(b.of("code_not_allowed")).toEqual([]);
    expect(b.of("standard_not_checked")).toEqual([]);
    expect(b.of("standard_not_taught")).toEqual([]);
  });

  it("null_cfu_code_cannot_satisfy_a_focus_obligation", () => {
    const row = row_of("wp1", { focus_codes: ["RL.6.1"] });
    const b = build(row, draft_for(row.lesson_id!, { teach: ["RL.6.1"], cfu: [null] }));
    expect(b.of("standard_not_checked").map((f) => f.code)).toEqual(["RL.6.1"]);
  });

  it("narrowed_leaf_through_the_shared_mapping", () => {
    const row = row_of("wp1", { focus_codes: ["L.6.4"] });
    const b = build(row, draft_for(row.lesson_id!, { teach: ["L.6.4.b"], cfu: ["L.6.4.b"] }));
    expect(b.standards).toHaveLength(1);
    expect(b.standards[0]).toMatchObject({ code: "L.6.4.b", origin: "narrowed", asserted_by: "generator", confirmation: "open" });
    expect(b.of("code_not_allowed")).toEqual([]);
    expect(b.of("standard_not_taught")).toEqual([]);
    expect(b.of("standard_not_checked")).toEqual([]);
    expect(b.of("standard_confirmation")).toHaveLength(1);
  });

  it("added_code_on_a_code_less_row_is_recorded_open", () => {
    const row = row_of("wp1", { focus_codes: [] });
    const b = build(row, draft_for(row.lesson_id!, { teach: ["RL.6.7"], cfu: ["RL.6.7"] }));
    expect(b.standards).toEqual([
      { code: "RL.6.7", role: "focus", origin: "added", official_text: "synthetic reading seven", asserted_by: "generator", confirmation: "open" },
    ]);
    expect(b.of("code_not_allowed")).toEqual([]);
    expect(b.of("standard_confirmation")).toHaveLength(1);
  });

  it("added_code_on_a_row_with_a_list_is_blocked", () => {
    const row = row_of("wp1", { focus_codes: ["RL.6.1"] });
    const b = build(row, draft_for(row.lesson_id!, { teach: ["RL.6.1"], cfu: ["RL.6.1", "RL.6.7"] }));
    expect(b.standards.find((s) => s.code === "RL.6.7")).toMatchObject({ origin: "added", role: "supporting" });
    expect(b.of("code_not_allowed").map((f) => f.code)).toEqual(["RL.6.7"]);
  });

  it("unknown_code_is_blocked_not_recorded_as_valid", () => {
    const row = row_of("wp1", { focus_codes: ["RL.6.1"] });
    const b = build(row, draft_for(row.lesson_id!, { teach: ["RL.6.1"], cfu: ["RL.6.1", "L.6.3a"] }));
    expect(b.standards.find((s) => s.code === "L.6.3a")).toMatchObject({ official_text: "", origin: "added" });
    const f = b.of("code_not_allowed");
    expect(f.map((x) => x.code)).toEqual(["L.6.3a"]);
    expect(f[0]?.level).toBe("blocking");
  });

  it("placeholder_and_lesson_id_never_become_codes", () => {
    const row = row_of("wp1", { focus_codes: [] });
    const b = build(row, draft_for(row.lesson_id!, { teach: ["G6.U4.FLEX-1a"], cfu: ["N/A"] }));
    expect(tagged_codes(b.compiled.lesson)).toEqual([]);
    // The routine's id, the CFU block's own standard_codes entry and cfu.standard_code each report once.
    const dropped = b.compiled.identity_notes.filter((n) => n.kind === "placeholder_code_dropped");
    expect(dropped.map((n) => n.code).sort()).toEqual(["G6.U4.FLEX-1a", "N/A", "N/A"]);
  });

  it("narrowed_and_added_codes_block_approval_until_confirmed", () => {
    const row = row_of("wp1", { focus_codes: ["L.6.4"] });
    const b = build(row, draft_for(row.lesson_id!, { teach: ["L.6.4.b"], cfu: ["L.6.4.b"] }));
    const conf = b.of("standard_confirmation");
    const state = (open: number) => gate_state({ issues: merge_resolutions(b.result.findings, []), open_confirmations: open });
    expect(submit_gate(state(conf.length)).refusals).toContain("CONFIRMATION_OPEN");
    expect(approve_gate({ ...state(conf.length), action: "approve" }).refusals).toContain("CONFIRMATION_OPEN");
    const confirmed = b.standards.map((s) => ({ ...s, confirmation: "confirmed" as const }));
    const lesson = { ...b.ctx.lesson, front_matter: { ...b.ctx.lesson.front_matter, standards: confirmed } };
    const after = run_checks({ ...b.ctx, lesson }, CHECK_RULES, DEFAULT_POLICY);
    expect(after.findings.filter((f) => f.kind === "standard_confirmation")).toEqual([]);
    expect(submit_gate(gate_state({ issues: merge_resolutions(after.findings, []), open_confirmations: 0 })).refusals).not.toContain("CONFIRMATION_OPEN");
  });

  it("clean_reading_ctx_has_zero_blocking_findings", () => {
    expect(run_checks(clean_reading_ctx(), CHECK_RULES, DEFAULT_POLICY).blocking).toBe(0);
  });
});
