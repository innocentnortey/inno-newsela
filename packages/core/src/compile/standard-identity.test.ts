import { describe, expect, it } from "vitest";
import type { LessonDraft } from "@ls/schema/lesson-draft";
import type { StandardRow } from "../ports/standards.ts";
import {
  classify_code, clean_codes, identity_notes, is_placeholder_code, split_code_list, standards_for_lesson,
} from "./standard-identity.ts";

const std = (code: string, over: Partial<StandardRow> = {}): StandardRow => ({
  code, set: "CA_CCSS_ELA_6", text: `text ${code}`, parent_code: null, is_leaf: true, eld_strand: null, ...over,
});
const leaf = (code: string, parent: string): StandardRow => std(code, { parent_code: parent });
const parent = (code: string): StandardRow => std(code, { is_leaf: false });
const row = (focus: string[], eld: string[] = [], msls: string[] = []) => ({ focus_codes: focus, eld_codes: eld, msls_codes: msls });

describe("standard identity", () => {
  it("split_handles_comma_semicolon_array_and_null", () => {
    expect(split_code_list("RL.6.1, RL.6.2")).toEqual(["RL.6.1", "RL.6.2"]);
    expect(split_code_list("RL.6.1;RL.6.2")).toEqual(["RL.6.1", "RL.6.2"]);
    expect(split_code_list(["RL.6.1", "RL.6.2"])).toEqual(["RL.6.1", "RL.6.2"]);
    expect(split_code_list(null)).toEqual([]);
    expect(split_code_list("")).toEqual([]);
    expect(split_code_list("RL.6.1, RL.6.1,")).toEqual(["RL.6.1"]);
  });

  it("placeholders_are_never_codes", () => {
    for (const t of ["N/A", "n/a", "NA", "None", "null", "-", "—", "G6.U4.L4", "G6.U4.FLEX-1a"]) {
      expect(is_placeholder_code(t, "G6.U4.L4")).toBe(true);
    }
    expect(is_placeholder_code("G6.U4.FLEX-1a", "G6.U4.FLEX-1a")).toBe(true);
    expect(clean_codes("RL.6.1, N/A", "G6.U4.L4")).toEqual({ codes: ["RL.6.1"], dropped: ["N/A"] });
  });

  it("real_codes_are_not_placeholders", () => {
    for (const t of ["RL.6.1", "L.6.4.b", "ELD.PI.6.6b", "MSLS 2.1a", "W.6.2"]) {
      expect(is_placeholder_code(t, "G6.U4.L4")).toBe(false);
    }
  });

  it("origin_comes_from_the_row_not_the_model", () => {
    const cat = [std("RL.6.1"), parent("L.6.4"), leaf("L.6.4.b", "L.6.4"), std("RL.6.7")];
    expect(classify_code("RL.6.1", row(["RL.6.1"]), cat)).toEqual({ origin: "outline", role: "focus", resolved: true, replaces: null });
    expect(classify_code("L.6.4.b", row(["L.6.4"]), cat)).toEqual({ origin: "narrowed", role: "focus", resolved: true, replaces: "L.6.4" });
    expect(classify_code("RL.6.7", row(["RL.6.1"]), cat)).toMatchObject({ origin: "added", role: "supporting" });
    expect(classify_code("RL.6.7", row([]), cat)).toMatchObject({ origin: "added", role: "focus", resolved: true });
    expect(classify_code("ZZ.9.9", row([]), cat)).toMatchObject({ origin: "added", resolved: false });
  });

  it("narrowed_leaf_replaces_its_parent", () => {
    const out = standards_for_lesson(row(["L.6.4"]), [parent("L.6.4"), leaf("L.6.4.b", "L.6.4")], ["L.6.4.b"]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ code: "L.6.4.b", role: "focus", origin: "narrowed", asserted_by: "generator", confirmation: "open" });
  });

  it("added_code_is_recorded_with_an_open_confirmation", () => {
    const out = standards_for_lesson(row([]), [std("RL.6.7")], ["RL.6.7"]);
    expect(out).toEqual([
      { code: "RL.6.7", role: "focus", origin: "added", official_text: "text RL.6.7", asserted_by: "generator", confirmation: "open" },
    ]);
  });

  it("unknown_code_is_kept_with_empty_text", () => {
    const out = standards_for_lesson(row(["RL.6.1"]), [std("RL.6.1")], ["ZZ.9.9"]);
    expect(out.map((s) => [s.code, s.official_text, s.origin])).toEqual([["RL.6.1", "text RL.6.1", "outline"], ["ZZ.9.9", "", "added"]]);
  });

  it("listed_code_is_not_added_again", () => {
    const out = standards_for_lesson(row(["RL.6.1"]), [std("RL.6.1")], ["RL.6.1"]);
    expect(out).toHaveLength(1);
    expect(out[0]?.origin).toBe("outline");
  });

  it("identity_notes_report_each_inconsistency", () => {
    const blk = (o: Record<string, unknown>) => ({
      role: "routine_heading", section: "Launch", part: null, text: "SECRET TEXT", standard_codes: [], code_origins: [], cfu: null, minutes: null, ...o,
    });
    const draft = {
      lesson_id: "G6.U4.L4",
      blocks: [
        blk({ standard_codes: ["N/A"], code_origins: ["outline"] }),
        blk({ role: "teacher_talk", standard_codes: ["RL.6.1"], code_origins: ["outline"] }),
        blk({ standard_codes: ["RL.6.1"], code_origins: ["added"] }),
      ],
    } as unknown as LessonDraft;
    const notes = identity_notes(draft, row(["RL.6.1"]));
    expect(notes.map((n) => [n.kind, n.section, n.block_index, n.code])).toEqual([
      ["placeholder_code_dropped", "Launch", 0, "N/A"],
      ["codes_on_uncarried_role", "Launch", 1, null],
      ["origin_claim_contradicts_row", "Launch", 2, "RL.6.1"],
    ]);
    for (const n of notes) expect(n.detail).not.toContain("SECRET");
  });
});
