// NL-77: pure validation of one intake choice against its target. No I/O.
import { DomainRefusal } from "@ls/core/errors";
import type { StandardsIndex } from "@ls/core/ports/standards";
import type { IntakeChoiceRequest } from "@ls/schema/api/outlines";
import { UNIT_ID_RE } from "@ls/schema/ids";
import type { IntakeFinding, NormalizedOutline } from "@ls/schema/outline";

export type ChoiceTarget =
  | { kind: "finding"; finding: IntakeFinding }
  | { kind: "segment"; row_number: number; index: number; segment_kind: string; applies: string }
  | { kind: "unit_rule"; index: number };

export interface ChoiceContext {
  outline: NormalizedOutline;
  standards: StandardsIndex;
  unit_id: string;
}

export function find_target(outline: NormalizedOutline, target_id: string): ChoiceTarget | null {
  const finding = outline.findings.find((f) => f.finding_id === target_id);
  if (finding !== undefined) return { kind: "finding", finding };
  const seg = /^S(\d+)\.(\d+)$/.exec(target_id);
  if (seg !== null) {
    const row_number = Number(seg[1]);
    const index = Number(seg[2]);
    const s = outline.rows.find((r) => r.row_number === row_number)?.segments[index];
    return s === undefined ? null : { kind: "segment", row_number, index, segment_kind: s.kind, applies: s.applies };
  }
  const rule = /^unit_rule:(\d+)$/.exec(target_id);
  if (rule !== null && Number(rule[1]) < outline.unit_rules.length) return { kind: "unit_rule", index: Number(rule[1]) };
  return null;
}

/** What a target holds when nobody has chosen. The column is not null, hence "" when there is no default. */
export function stored_default(t: ChoiceTarget): string {
  if (t.kind === "finding") return t.finding.default_choice ?? "";
  if (t.kind === "segment") return t.segment_kind === "content" ? "" : t.applies;
  return "";
}

const refuse = (reason: string, message: string): DomainRefusal => new DomainRefusal("INVALID_CHOICE", message, { reason });
const mismatch = (): DomainRefusal => refuse("kind_target_mismatch", "That choice does not apply to this item.");

function finding_of(t: ChoiceTarget, kinds: readonly string[] | null): IntakeFinding {
  if (t.kind !== "finding" || (kinds !== null && !kinds.includes(t.finding.kind))) throw mismatch();
  return t.finding;
}

/** Returns the string to store in `intake_choice.choice`, or throws INVALID_CHOICE. */
export function validate_choice(req: IntakeChoiceRequest, t: ChoiceTarget, ctx: ChoiceContext): string {
  const v = req.value;
  switch (req.kind) {
    case "confirm_unit": {
      finding_of(t, ["unit_conflict"]);
      if (v === undefined || v === null) return ctx.unit_id;
      if (typeof v !== "string" || !UNIT_ID_RE.test(v)) throw refuse("bad_unit_id", "That is not a unit id such as G6.U4.");
      return v;
    }
    case "confirm_fix": {
      const f = finding_of(t, null);
      return f.proposed_fix ?? f.default_choice ?? "confirmed";
    }
    case "edit_fix": {
      finding_of(t, ["malformed_code", "nonexistent_code", "parent_code"]);
      if (typeof v !== "string" || v.trim() === "") throw refuse("value_required", "Enter a standard code.");
      if (ctx.standards.text_of(v.trim()) === null) throw refuse("unknown_standard_code", "That is not a known standard code.");
      return v.trim();
    }
    case "set_note_action": {
      if (t.kind !== "segment") throw mismatch();
      if (t.segment_kind === "content") throw refuse("segment_not_a_note", "Only notes and tasks have an action.");
      if (v !== "apply" && v !== "show_only" && v !== "ignore") throw refuse("bad_action", "Choose apply, show only or ignore.");
      return v;
    }
    case "change_split": {
      finding_of(t, ["vocabulary_over_cap"]);
      if (v !== "confirm_split" && v !== "keep_whole") throw refuse("bad_split", "Choose confirm_split or keep_whole.");
      return v;
    }
    case "set_unit_rule_scope": {
      if (t.kind !== "unit_rule") throw mismatch();
      if (!Array.isArray(v) || !v.every((n) => typeof n === "number" && Number.isInteger(n))) {
        throw refuse("bad_scope", "Give a list of row numbers.");
      }
      const lessons = new Set(ctx.outline.rows.filter((r) => r.kind === "lesson").map((r) => r.row_number));
      if (!v.every((n) => lessons.has(n as number))) throw refuse("row_outside_sheet", "A row in the list is not a lesson row of this sheet.");
      return JSON.stringify([...new Set(v as number[])].sort((a, b) => a - b));
    }
    case "eld_keep":
      finding_of(t, ["eld_mismatch"]);
      return "keep";
    case "eld_remap":
      finding_of(t, ["eld_mismatch"]);
      return "remap";
    case "confirm_safety_note":
    case "reject_safety_note":
      finding_of(t, ["safety_note_proposed"]);
      return req.kind;
    case "revert":
      return stored_default(t);
  }
}
