// @vitest-environment node
// NL-77: pure choice validation, one accept, one reject, and one kind/target mismatch per kind.
import { describe, expect, it } from "vitest";
import { normalize_outline } from "@ls/core/intake/normalize";
import { load_standards_index } from "@ls/core/intake/standards-index";
import type { IntakeChoiceRequest } from "@ls/schema/api/outlines";
import type { IntakeFinding } from "@ls/schema/outline";
import { load_issued_grid } from "../../../../../packages/core/tests/fixtures/outline/index.ts";
import { find_target, stored_default, validate_choice, type ChoiceTarget } from "./outline-choices.ts";

const standards = load_standards_index();
const outline = normalize_outline(load_issued_grid(), standards, 200);
const ctx = { outline, standards, unit_id: "G6.U4" };
const first = (kind: string): IntakeFinding => outline.findings.find((f) => f.kind === kind)!;
const target = (id: string): ChoiceTarget => find_target(outline, id)!;
const note_segment = (): string => {
  for (const r of outline.rows) {
    const i = r.segments.findIndex((s) => s.kind !== "content");
    if (i >= 0) return `S${r.row_number}.${i}`;
  }
  throw new Error("no note segment in fixture");
};
const content_segment = "S4.0";
const ask = (req: IntakeChoiceRequest, t: ChoiceTarget): string => validate_choice(req, t, ctx);
const reason = (req: IntakeChoiceRequest, t: ChoiceTarget): unknown => {
  try {
    ask(req, t);
  } catch (e) {
    expect((e as { code: string }).code).toBe("INVALID_CHOICE");
    return (e as { details: { reason: string } }).details.reason;
  }
  throw new Error("expected a refusal");
};
const mismatch = (kind: IntakeChoiceRequest["kind"], id: string, value?: IntakeChoiceRequest["value"]): unknown =>
  reason({ target_id: id, kind, value }, target(id));

describe("find_target", () => {
  it("finds findings, segments and unit rules; unknown ids are null", () => {
    expect(target(first("malformed_code").finding_id).kind).toBe("finding");
    expect(target(content_segment)).toMatchObject({ kind: "segment", row_number: 4, index: 0 });
    expect(target("unit_rule:0").kind).toBe("unit_rule");
    expect(find_target(outline, "unit_rule:99")).toBeNull();
    expect(find_target(outline, "S4.999")).toBeNull();
    expect(find_target(outline, "F-nope")).toBeNull();
  });
});

describe("validate_choice", () => {
  const unit = first("unit_conflict").finding_id;
  it("confirm_unit: accepts omitted and a unit id, rejects a bad id and a wrong target", () => {
    expect(ask({ target_id: unit, kind: "confirm_unit" }, target(unit))).toBe("G6.U4");
    expect(ask({ target_id: unit, kind: "confirm_unit", value: "G6.U3" }, target(unit))).toBe("G6.U3");
    expect(reason({ target_id: unit, kind: "confirm_unit", value: "nope" }, target(unit))).toBe("bad_unit_id");
    expect(mismatch("confirm_unit", first("malformed_code").finding_id)).toBe("kind_target_mismatch");
  });
  it("confirm_fix: stores the proposed fix, falls back to the default; a segment is a mismatch", () => {
    const m = first("malformed_code");
    expect(ask({ target_id: m.finding_id, kind: "confirm_fix" }, target(m.finding_id))).toBe(m.proposed_fix);
    expect(ask({ target_id: unit, kind: "confirm_fix" }, target(unit))).toBe("U4");
    expect(mismatch("confirm_fix", content_segment)).toBe("kind_target_mismatch");
  });
  it("edit_fix: accepts a known code, rejects unknown, missing and wrong kind", () => {
    const m = first("malformed_code").finding_id;
    expect(ask({ target_id: m, kind: "edit_fix", value: " RL.6.2 " }, target(m))).toBe("RL.6.2");
    expect(mismatch("edit_fix", m, "ZZ.9.9")).toBe("unknown_standard_code");
    expect(mismatch("edit_fix", m)).toBe("value_required");
    expect(mismatch("edit_fix", m, ["RL.6.2"])).toBe("value_required");
    expect(mismatch("edit_fix", first("eld_mismatch").finding_id, "RL.6.2")).toBe("kind_target_mismatch");
  });
  it("set_note_action: accepts the three actions on a note, rejects content, bad action and a finding", () => {
    const n = note_segment();
    expect(ask({ target_id: n, kind: "set_note_action", value: "show_only" }, target(n))).toBe("show_only");
    expect(mismatch("set_note_action", content_segment, "apply")).toBe("segment_not_a_note");
    expect(mismatch("set_note_action", n, "delete")).toBe("bad_action");
    expect(mismatch("set_note_action", first("malformed_code").finding_id, "apply")).toBe("kind_target_mismatch");
  });
  it("change_split: accepts the two answers, rejects others and other kinds", () => {
    const v = first("vocabulary_over_cap").finding_id;
    expect(ask({ target_id: v, kind: "change_split", value: "keep_whole" }, target(v))).toBe("keep_whole");
    expect(mismatch("change_split", v, "halve")).toBe("bad_split");
    expect(mismatch("change_split", first("malformed_code").finding_id, "keep_whole")).toBe("kind_target_mismatch");
  });
  it("set_unit_rule_scope: sorts and dedupes lesson rows, rejects non-lists and non-lesson rows", () => {
    const lessons = outline.rows.filter((r) => r.kind === "lesson").map((r) => r.row_number);
    const [a, b] = [lessons[0]!, lessons[1]!];
    expect(ask({ target_id: "unit_rule:0", kind: "set_unit_rule_scope", value: [b, a, b] }, target("unit_rule:0"))).toBe(JSON.stringify([a, b]));
    expect(mismatch("set_unit_rule_scope", "unit_rule:0", "all")).toBe("bad_scope");
    expect(mismatch("set_unit_rule_scope", "unit_rule:0", ["4"])).toBe("bad_scope");
    expect(mismatch("set_unit_rule_scope", "unit_rule:0", [100000])).toBe("row_outside_sheet");
    expect(mismatch("set_unit_rule_scope", content_segment, [a])).toBe("kind_target_mismatch");
  });
  it("eld_keep and eld_remap: store keep and remap, refuse other findings", () => {
    const e = first("eld_mismatch").finding_id;
    expect(ask({ target_id: e, kind: "eld_keep" }, target(e))).toBe("keep");
    expect(ask({ target_id: e, kind: "eld_remap" }, target(e))).toBe("remap");
    expect(mismatch("eld_remap", first("malformed_code").finding_id)).toBe("kind_target_mismatch");
    expect(mismatch("eld_keep", content_segment)).toBe("kind_target_mismatch");
  });
  it("confirm_safety_note and reject_safety_note: store the kind, refuse other findings", () => {
    const s = first("safety_note_proposed").finding_id;
    expect(ask({ target_id: s, kind: "confirm_safety_note" }, target(s))).toBe("confirm_safety_note");
    expect(ask({ target_id: s, kind: "reject_safety_note" }, target(s))).toBe("reject_safety_note");
    expect(mismatch("confirm_safety_note", first("eld_mismatch").finding_id)).toBe("kind_target_mismatch");
    expect(mismatch("reject_safety_note", "unit_rule:0")).toBe("kind_target_mismatch");
  });
  it("revert: returns the stored default of any target", () => {
    const s = first("safety_note_proposed").finding_id;
    expect(ask({ target_id: s, kind: "revert" }, target(s))).toBe("confirm_safety_note");
    expect(ask({ target_id: first("malformed_code").finding_id, kind: "revert" }, target(first("malformed_code").finding_id))).toBe("");
    const n = note_segment();
    expect(stored_default(target(n))).toBe("apply");
    expect(stored_default(target(content_segment))).toBe("");
    expect(stored_default(target("unit_rule:0"))).toBe("");
  });
});
