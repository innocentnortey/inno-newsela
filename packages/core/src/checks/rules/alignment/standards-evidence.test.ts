import { describe, expect, it } from "vitest";
import type { PMNode, StoredLesson } from "@ls/schema/lesson";
import { merge_resolutions, submit_gate } from "../../gates.ts";
import { DEFAULT_POLICY, LESSON_ID, callout, cfu_item, gate_state, h, make_ctx, p, reading_lesson, routine, section } from "../../test-helpers.ts";
import type { CheckContext } from "../../types.ts";
import { code_not_allowed_rule } from "./code_not_allowed.ts";
import { derive_alignment } from "./derive.ts";
import { read_evidence } from "./evidence.ts";
import { standard_confirmation_rule } from "./standard_confirmation.ts";
import { standard_not_checked_rule } from "./standard_not_checked.ts";
import { standard_not_taught_rule } from "./standard_not_taught.ts";
import { focus_obligations, teaching_parts } from "./standards-view.ts";
import { rec, std_rows } from "./test-support.ts";

const h2 = (t: string): PMNode => h(2, t);
const say_eld_block = (): PMNode => ({
  type: "collapsible",
  attrs: { label: "Integrated ELD Instructions" },
  content: [callout("say", "Say: look at the word.")],
});

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

  it("quick_write_counts_as_a_check", () => {
    const c = ctx_with(
      ["RL.6.1"],
      [routine("notes_section", "Voice (RL.6.1)"), p("Teach.")],
      undefined,
      [routine("writing", "Quick Write (RL.6.1)"), p("Write.")],
    );
    expect(run(c).checked).toEqual([]);
    expect(derive_alignment(c).some((r) => r.role === "A" && r.address.endsWith("LookBack"))).toBe(true);
  });

  it("quick_write_with_three_codes_covers_none", () => {
    const c = ctx_with(
      ALL,
      [p("Teach.")],
      undefined,
      [routine("writing", `Quick Write (${ALL.join(", ")})`), p("Write.")],
    );
    expect(run(c).checked).toEqual(ALL);
  });

  it("unsubstantiated_quick_write_covers_none", () => {
    const c = ctx_with(["RL.6.1"], [p("Teach.")], undefined, [routine("writing", "Quick Write (RL.6.1)")]);
    const f = standard_not_checked_rule.run(c, DEFAULT_POLICY);
    expect(f.map((x) => x.code)).toEqual(["RL.6.1"]);
    expect(f[0]?.message).toContain("no question or prompt under it");
  });

  it("tagged_heading_with_no_text_under_it_is_not_taught", () => {
    const c = ctx_with(["RL.6.1"], [routine("notes_section", "Voice (RL.6.1)"), routine("notes_section", "Other"), p("Text.")]);
    const f = standard_not_taught_rule.run(c, DEFAULT_POLICY);
    expect(f).toHaveLength(1);
    expect(f[0]?.message).toContain("no teaching text follows that heading");
  });

  it("wp1_look_back_quick_write_checks_rl_6_1", () => {
    // WP-1 alignment map: RL.6.1 checked in Look Back by a Quick Write; Part B's Pulse Check is tagged RL.6.2 only.
    const lia: PMNode[] = [
      h2("Part A"),
      routine("notes_section", "Close reading (RL.6.1)"), p("Teach RL.6.1 in part A."),
      h2("Part B"),
      routine("notes_section", "Argument (RL.6.2)"), p("Teach RL.6.2."),
      ...cfu_item({ code: "RL.6.2" }),
    ];
    const base = ctx_with(ALL, lia, ALL.map((c) => rec(c)), [routine("writing", "Quick Write (RL.6.1)"), p("Write.")]);
    const ll = base.lesson.sections.map((sec) =>
      sec.name === "Literacy Lab" ? section("Literacy Lab", LESSON_ID, 10, [routine("notes_section", "Words (L.6.4.b)"), p("Teach."), ...cfu_item({ code: "L.6.4.b" })]) : sec);
    const c = { ...base, lesson: { ...base.lesson, sections: ll } };
    expect(run(c)).toEqual({ taught: [], checked: [] });
    const a = derive_alignment(c).filter((r) => r.role === "A" && r.code === "RL.6.1");
    expect(a.map((r) => r.address)).toEqual(["G6.U4.L4.LookBack"]);
  });

  it("wp2_narrowed_leaves_with_checklist_items", () => {
    const leaves = ["W.6.2.a", "W.6.2.b", "W.6.2.f"];
    const std = leaves.map((code) => rec(code, { origin: "narrowed", asserted_by: "generator", confirmation: "open" }));
    const lia: PMNode[] = leaves.flatMap((code) => [routine("notes_section", `Draft (${code})`), p(`Teach ${code}.`), ...cfu_item({ code })]);
    const c = ctx_with(["W.6.2"], lia, std);
    expect(run(c)).toEqual({ taught: [], checked: [] });
    const found = standard_confirmation_rule.run(c, DEFAULT_POLICY);
    expect(found).toHaveLength(3);
    const d = submit_gate(gate_state({ issues: merge_resolutions(found, []), open_confirmations: found.length }));
    expect(d.refusals).toContain("CONFIRMATION_OPEN");
  });

  it("teaching_parts_differs_from_evidence_only_for_launch_and_say_callouts", () => {
    const say = ctx_with(["RL.6.1"], [routine("notes_section", "Voice (RL.6.1)"), say_eld_block()]);
    const lia_item = read_evidence(say.lesson).find((e) => e.kind === "teach" && e.section === "Learning in Action")!;
    expect(lia_item.substantiated).toBe(true);
    expect(teaching_parts(say.lesson)).not.toContain(lia_item.address);
    // (a) Literacy Lab routine with a paragraph: in both.
    const base = reading_lesson();
    const ll = { ...base, sections: base.sections.map((sec) => sec.name === "Literacy Lab" ? section("Literacy Lab", LESSON_ID, 10, [routine("notes_section", "Words (L.6.4.b)"), p("Teach.")]) : sec) };
    const ll_item = read_evidence(ll).find((e) => e.section === "Literacy Lab")!;
    expect(ll_item.substantiated).toBe(true);
    expect(teaching_parts(ll)).toContain(ll_item.address);
    // (c) Launch routine with a paragraph: evidence yes, teaching_parts no Launch address.
    const la = { ...base, sections: base.sections.map((sec) => sec.name === "Launch" ? section("Launch", LESSON_ID, 5, [routine("notes_section", "Hook (RL.6.1)"), p("Warm up.")]) : sec) };
    const la_item = read_evidence(la).find((e) => e.section === "Launch")!;
    expect(la_item.substantiated).toBe(true);
    expect(teaching_parts(la).some((a) => a.includes("Launch"))).toBe(false);
  });

  it("two_content_codes_plus_a_real_eld_code_cover_all_three", () => {
    const c = ctx_with(["RL.6.1", "RL.6.2"], [p("Teach."), ...cfu_item({ code: "RL.6.1, RL.6.2, ELD.PI.6.6b" })]);
    expect(run(c).checked).toEqual([]);
  });

  it("three_content_codes_cover_none", () => {
    const c = ctx_with(ALL, [p("Teach."), ...cfu_item({ code: ALL.join(", ") })]);
    expect(run(c).checked).toEqual(ALL);
  });

  it("an_unknown_code_is_content_and_is_blocked", () => {
    const c = ctx_with(["RL.6.1", "RL.6.2"], [p("Teach."), ...cfu_item({ code: "RL.6.1, RL.6.2, ZZ.9.9" })]);
    expect(run(c).checked).toEqual(["RL.6.1", "RL.6.2"]);
    const f = code_not_allowed_rule.run(c, DEFAULT_POLICY);
    expect(f.filter((x) => x.code === "ZZ.9.9")).toHaveLength(1);
    expect(f.find((x) => x.code === "ZZ.9.9")?.level).toBe("blocking");
  });

  it("a_forged_eld_looking_code_is_not_eld", () => {
    const c = ctx_with(["RL.6.1", "RL.6.2"], [p("Teach."), ...cfu_item({ code: "RL.6.1, RL.6.2, ELD.PI.9.9" })]);
    expect(run(c).checked).toEqual(["RL.6.1", "RL.6.2"]);
    expect(code_not_allowed_rule.run(c, DEFAULT_POLICY).map((x) => x.code)).toContain("ELD.PI.9.9");
  });

  it("a_real_eld_code_is_recognised_only_through_the_catalogue", () => {
    const c = ctx_with(["RL.6.1", "RL.6.2"], [p("Teach."), ...cfu_item({ code: "RL.6.1, RL.6.2, ELD.PI.6.6b" })]);
    expect(run({ ...c, standards: [] }).checked).toEqual(["RL.6.1", "RL.6.2"]);
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


  const say_only = (code: string): PMNode[] => [
    routine("notes_section", `Teach (${code})`),
    {
      type: "collapsible",
      attrs: { label: "Integrated ELD Instructions" },
      content: [callout("purpose", "Purpose note"), callout("say", "Say: look at the word."), callout("watch", "Watch note")],
    },
    ...cfu_item({ code }),
  ];

  it("say_callout_under_a_tagged_routine_is_teaching", () => {
    expect(run(ctx_with(["RL.6.1"], say_only("RL.6.1"))).taught).toEqual([]);
  });

  it("purpose_and_watch_callouts_are_not_teaching", () => {
    const lia: PMNode[] = [
      routine("notes_section", "Teach (RL.6.1)"),
      { type: "collapsible", attrs: { label: "Integrated ELD Instructions" }, content: [callout("purpose", "Purpose"), callout("watch", "Watch")] },
      ...cfu_item({ code: "RL.6.1" }),
    ];
    expect(run(ctx_with(["RL.6.1"], lia)).taught).toEqual(["RL.6.1"]);
  });

  it("a_code_with_no_tagged_teaching_still_blocks_even_with_say_callouts", () => {
    const lia: PMNode[] = [...say_only("RL.6.1").slice(1)];
    expect(run(ctx_with(["RL.6.1"], lia)).taught).toEqual(["RL.6.1"]);
  });

  it("eld_codes_do_not_count_toward_the_two_code_limit", () => {
    const eld = [rec("ELD.PI.6.10", { role: "eld" }), rec("ELD.PI.6.7", { role: "eld" })];
    const lia: PMNode[] = [routine("notes_section", "Teach (W.6.2)"), p("Teach."), ...cfu_item({ code: "W.6.2, ELD.PI.6.10, ELD.PI.6.7" })];
    const c = ctx_with(["W.6.2"], lia, [rec("W.6.2"), ...eld]);
    expect(run(c).checked).toEqual([]);
    const three = ctx_with(["RL.6.1", "RL.6.2"], [p("Teach."), ...cfu_item({ code: "RL.6.1, RL.6.2, L.6.4.b" })]);
    expect(run(three).checked).toEqual(["RL.6.1", "RL.6.2"]);
  });

  it("a_row_with_no_codes_has_nothing_to_check", () => {
    const c = ctx_with([], [p("Teach."), ...cfu_item({ code: "RL.6.1" }).map((n) => n)], []);
    const lia = [p("Teach."), routine("cfu", "Pulse Check"), p("Which?")];
    const none = ctx_with([], lia, []);
    expect(run(none)).toEqual({ taught: [], checked: [] });
    expect(c.row.focus_codes).toEqual([]);
  });
});
