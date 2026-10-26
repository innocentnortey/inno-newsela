// Unit tests (no database) of the lifecycle oracles and draft builders.
import { describe, expect, it } from "vitest";
import { load_standard_rows } from "@ls/core/intake/standards-index";
import type { StoredLesson } from "@ls/schema/lesson";
import {
  flex_draft, with_blank_rationale, with_forged_card, with_planted_name, without_excerpt_slot, wp1_draft, wp2_draft, type DraftLike,
} from "./drafts.ts";
import { core, expected_evidence, fingerprint, gating, headings_of, key_of, observed_evidence } from "./evidence.ts";

const block = (role: string, section: string, codes: string[], cfu_code: string | null = null): DraftLike["blocks"][number] => ({
  role, section, part: null, text: "t", standard_codes: codes, code_origins: codes.map(() => "outline"), minutes: null,
  cfu: role === "cfu_item" ? { stem: "s", options: ["a", "b", "c", "d"], key_index: 0, rationales: ["r", "r", "r", "r"], standard_code: cfu_code } : null,
});
const draft3: DraftLike = {
  lesson_id: "X", title: "T", text_cards: [],
  blocks: [block("routine_heading", "Launch", ["RL.6.1", "RL.6.4"]), block("cfu_item", "Launch", [], "RL.6.1, RL.6.4"), block("cfu_item", "Look Back", [], null), block("quick_write", "Look Back", ["W.6.2"])],
};
const h = (icon: string, t: string) => ({ type: "routine_heading", attrs: { icon }, content: [{ type: "text", text: t }] });
const lesson_of = (nodes: unknown[]): StoredLesson => ({
  lesson_id: "X", sections: [{ address: "X.Launch", name: "Launch", minutes: 5, content: { type: "doc", content: nodes } }], front_matter: { standards: [] }, text_cards: [],
}) as unknown as StoredLesson;

describe("lifecycle oracles", () => {
  it("expected_evidence_from_draft_only", () => {
    expect(expected_evidence(draft3)).toEqual([
      "assess|RL.6.1|Launch", "assess|RL.6.4|Launch", "assess|W.6.2|Look Back", "teach|RL.6.1|Launch", "teach|RL.6.4|Launch",
    ]);
  });
  it("observed_evidence_parses_headings_not_production", () => {
    const l = lesson_of([h("notes_section", "Percy's Voice (RL.6.1, RL.6.4)"), h("cfu", "Pulse Check (RL.6.1)"), h("writing", "Quick Write (W.6.2)"), h("writing", "Quick Write")]);
    expect(observed_evidence(l)).toEqual(["assess|RL.6.1|Launch", "assess|W.6.2|Launch", "teach|RL.6.1|Launch", "teach|RL.6.4|Launch"]);
  });
  it("heading_rename_changes_observed", () => {
    // Documents the current codec: the tag lives in the heading text, so renaming the heading without the tag removes the evidence.
    const a = lesson_of([h("notes_section", "Percy's Voice (RL.6.1)")]);
    const b = lesson_of([h("notes_section", "Percy's Voice")]);
    expect(observed_evidence(a)).toEqual(["teach|RL.6.1|Launch"]);
    expect(observed_evidence(b)).toEqual([]);
    expect(headings_of(b)).toEqual([{ section: "Launch", icon: "notes_section", text: "Percy's Voice" }]);
  });
  it("fingerprint_is_stable", () => {
    const l = lesson_of([h("notes_section", "A (RL.6.1)")]);
    expect(fingerprint(l)).toEqual(fingerprint(structuredClone(l)));
    expect(fingerprint(l).evidence).toEqual(["teach|RL.6.1|Launch"]);
  });
  it("flex_draft_variants", () => {
    const none = flex_draft("G6.U4.FLEX-9", "no_standards");
    expect(none.lesson_id).toBe("G6.U4.FLEX-9");
    expect(none.blocks.every((b) => b.standard_codes.length === 0 && b.code_origins.length === 0)).toBe(true);
    expect(none.blocks.filter((b) => b.cfu !== null).every((b) => b.cfu!.standard_code === null)).toBe(true);
    const prop = flex_draft("G6.U4.FLEX-9", "proposed_code");
    const cfu = prop.blocks.find((b) => b.cfu !== null)!;
    expect(cfu.cfu!.standard_code).toBe("RL.6.7");
    expect(cfu.code_origins).toEqual(["added"]);
    expect(JSON.stringify(prop)).not.toContain('"_');
  });
  it("mutators_do_not_edit_inputs", () => {
    for (const d of [flex_draft("G6.U4.FLEX-9", "no_standards"), wp1_draft(), wp2_draft()]) {
      const before = JSON.stringify(d);
      with_blank_rationale(d); with_planted_name(d); with_forged_card(d); without_excerpt_slot(d);
      expect(JSON.stringify(d)).toBe(before);
    }
    const w2 = wp2_draft();
    expect(w2.blocks.some((b) => b.role === "excerpt_slot")).toBe(true);
    expect(without_excerpt_slot(w2).blocks.some((b) => b.role === "excerpt_slot")).toBe(false);
    expect(with_blank_rationale(w2).blocks.find((b) => b.cfu !== null)!.cfu!.rationales[1]).toBe("");
  });
  it("core_drops_human_work_kinds", () => {
    const keys = [key_of({ kind: "excerpt_slot_open", level: "blocking", address: "a" }), key_of({ kind: "code_not_allowed", level: "blocking", address: "a", code: "RL.9.9" }),
      key_of({ kind: "standard_confirmation", level: "confirmation", address: null, code: "RL.6.7" }), key_of({ kind: "vocabulary_over_cap", level: "advisory", address: "f" })];
    expect(core(keys)).toEqual(["code_not_allowed|blocking|a|RL.9.9", "vocabulary_over_cap|advisory|f|"]);
    expect(gating(keys)).toEqual(["code_not_allowed|blocking|a|RL.9.9"]);
  });
  it("bogus_code_is_not_in_the_catalogue", () => {
    const codes = new Set(load_standard_rows().map((r) => r.code));
    expect(codes.has("RL.9.9")).toBe(false);
    expect(codes.has("RL.6.7")).toBe(true);
  });
});
