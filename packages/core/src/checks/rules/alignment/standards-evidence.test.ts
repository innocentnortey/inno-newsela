import { describe, expect, it } from "vitest";
import type { PMNode, StoredLesson } from "@ls/schema/lesson";
import { merge_resolutions, submit_gate } from "../../gates.ts";
import { DEFAULT_POLICY, LESSON_ID, cfu_item, gate_state, make_ctx, p, reading_lesson, routine, section } from "../../test-helpers.ts";
import type { CheckContext } from "../../types.ts";
import { derive_alignment } from "./derive.ts";
import { standard_confirmation_rule } from "./standard_confirmation.ts";
import { standard_not_checked_rule } from "./standard_not_checked.ts";
import { standard_not_taught_rule } from "./standard_not_taught.ts";
import { focus_obligations } from "./standards-view.ts";
import { rec, std_rows } from "./test-support.ts";

type Std = StoredLesson["front_matter"]["standards"][number];

function ctx_with(
  focus: string[],
  lia: PMNode[],
  standards: Std[] = focus.map((c) => rec(c)),
  look_back: PMNode[] = [routine("writing", "Quick Write"), p("Write.")],
): CheckContext {
  const base = reading_lesson();
  const lesson: StoredLesson = {
    ...base,
    front_matter: { ...base.front_matter, standards },
    sections: base.sections.map((s) =>
      s.name === "Learning in Action"
        ? section("Learning in Action", LESSON_ID, 30, lia)
        : s.name === "Look Back"
          ? section("Look Back", LESSON_ID, 5, look_back)
          : s,
    ),
  };
  const c = make_ctx(lesson);
  return { ...c, row: { ...c.row, focus_codes: focus }, standards: std_rows() };
}

const run = (c: CheckContext) => ({
  taught: standard_not_taught_rule.run(c, DEFAULT_POLICY).map((f) => f.code),
  checked: standard_not_checked_rule.run(c, DEFAULT_POLICY).map((f) => f.code),
});
const ALL = ["RL.6.1", "RL.6.2", "L.6.4.b"];

describe("per-code standards evidence", () => {
  it("generic_teaching_plus_all_tagged_check_is_not_taught", () => {
    const c = ctx_with(ALL, [p("Teach generally."), ...cfu_item({ code: ALL.join(", ") })]);
    const r = run(c);
    expect(r.taught).toEqual(ALL);
    expect(r.checked).toEqual(ALL);
    expect(derive_alignment(c).filter((x) => x.role === "A")).toEqual([]);
  });

  it("one_check_tagged_with_every_code_covers_none", () => {
    const two = ctx_with(["RL.6.1", "RL.6.2"], [p("Teach."), ...cfu_item({ code: "RL.6.1, RL.6.2" })]);
    expect(run(two).checked).toEqual([]);
    const three = ctx_with(ALL, [p("Teach."), ...cfu_item({ code: ALL.join(", ") })]);
    expect(run(three).checked).toEqual(ALL);
  });

  it("teaching_tag_needs_teaching_text_at_its_address", () => {
    const c = ctx_with(["RL.6.1"], [routine("notes_section", "Voice (RL.6.1)"), ...cfu_item({ code: "RL.6.1" })]);
    expect(run(c).taught).toEqual(["RL.6.1"]);
  });

  it("per_code_teaching_and_checking_pass", () => {
    const lia: PMNode[] = ALL.flatMap((code) => [
      routine("notes_section", `Teach ${code} (${code})`),
      p(`Teach ${code}.`),
      ...cfu_item({ code }),
    ]);
    const c = ctx_with(ALL, lia);
    expect(run(c)).toEqual({ taught: [], checked: [] });
    const rows = derive_alignment(c);
    for (const code of ALL) {
      expect(rows.some((r) => r.code === code && r.role === "I")).toBe(true);
      expect(rows.some((r) => r.code === code && r.role === "A")).toBe(true);
    }
  });

  it("quick_write_tag_is_a_link_not_a_check", () => {
    const c = ctx_with(
      ["RL.6.1"],
      [routine("notes_section", "Voice (RL.6.1)"), p("Teach.")],
      undefined,
      [routine("writing", "Quick Write (RL.6.1)"), p("Write.")],
    );
    expect(run(c).checked).toEqual(["RL.6.1"]);
    expect(derive_alignment(c).some((r) => r.role === "A" && r.address.endsWith("LookBack"))).toBe(true);
  });

  it("narrowed_leaf_keeps_open_confirmation", () => {
    const leaf = rec("L.6.4.b", { origin: "narrowed", asserted_by: "generator", confirmation: "open" });
    const c = ctx_with(["L.6.4"], [routine("notes_section", "Words (L.6.4.b)"), p("Teach."), ...cfu_item({ code: "L.6.4.b" })], [leaf]);
    const found = standard_confirmation_rule.run(c, DEFAULT_POLICY);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ level: "confirmation", code: "L.6.4.b" });
    const decision = submit_gate(
      gate_state({ issues: merge_resolutions(found, []), open_confirmations: found.length }),
    );
    expect(decision.refusals).toContain("CONFIRMATION_OPEN");
    const rows = derive_alignment(c).filter((r) => r.code === "L.6.4.b");
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r).toMatchObject({ origin: "narrowed", asserted_by: "generator", confirmed_by: null });
  });

  it("removed_leaf_returns_the_parent_obligation", () => {
    const leaf = rec("L.6.4.b", { origin: "narrowed", confirmation: "removed" });
    const c = ctx_with(["L.6.4"], [p("Teach.")], [leaf]);
    expect(focus_obligations(c)).toEqual([{ code: "L.6.4", parent: null }]);
    const live = ctx_with(["L.6.4"], [p("Teach.")], [rec("L.6.4.b", { origin: "narrowed" })]);
    expect(focus_obligations(live)).toEqual([{ code: "L.6.4.b", parent: "L.6.4" }]);
  });

});
