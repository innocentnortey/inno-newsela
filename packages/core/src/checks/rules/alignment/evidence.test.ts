import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { PMNode, StoredLesson } from "@ls/schema/lesson";
import { DEFAULT_POLICY, LESSON_ID, callout, cfu_item, eld_block, make_ctx, p, reading_lesson, routine, section } from "../../test-helpers.ts";
import type { CheckContext } from "../../types.ts";
import { read_evidence } from "./evidence.ts";
import { standard_not_checked_rule } from "./standard_not_checked.ts";
import { standard_not_taught_rule } from "./standard_not_taught.ts";
import { std_rows } from "./test-support.ts";

function lesson_in(name: string, nodes: PMNode[]): StoredLesson {
  const base = reading_lesson();
  return {
    ...base,
    sections: base.sections.map((s) => (s.name === name ? section(name, LESSON_ID, s.minutes, nodes) : s)),
  };
}
const lia = (nodes: PMNode[]) => lesson_in("Learning in Action", nodes);
const ctx_for = (lesson: StoredLesson, focus: string[]): CheckContext => {
  const c = make_ctx(lesson);
  return { ...c, row: { ...c.row, focus_codes: focus }, standards: std_rows() };
};
const say_eld = (): PMNode => ({
  type: "collapsible",
  attrs: { label: "Integrated ELD Instructions" },
  content: [callout("say", "Say: look at the word.")],
});

describe("read_evidence", () => {
  it("reads_codes_from_pulse_check_quick_write_and_routine_headings", () => {
    const l = lia([routine("notes_section", "Percy (RL.6.1)"), p("Teach."), ...cfu_item({ code: "RL.6.2, L.6.4.b" })]);
    const lb = { ...l, sections: l.sections.map((s) => (s.name === "Look Back" ? section("Look Back", LESSON_ID, 5, [routine("writing", "Quick Write (RL.6.1)"), p("Write.")]) : s)) };
    const items = read_evidence(lb).filter((e) => e.section !== "Literacy Lab");
    expect(items.map((e) => [e.code, e.kind, e.activity])).toEqual([
      ["RL.6.1", "teach", "routine"],
      ["RL.6.2", "assess", "pulse_check"],
      ["L.6.4.b", "assess", "pulse_check"],
      ["RL.6.1", "assess", "quick_write"],
    ]);
    expect(items[1]?.tag_codes).toEqual(["RL.6.2", "L.6.4.b"]);
  });

  it("a_routine_heading_is_credited_only_with_its_own_text", () => {
    const own = read_evidence(lia([routine("notes_section", "Voice (RL.6.1)"), p("text"), routine("notes_section", "Next"), p("more")]));
    expect(own[0]?.substantiated).toBe(true);
    const none = read_evidence(lia([routine("notes_section", "Voice (RL.6.1)"), routine("notes_section", "Next"), p("text")]));
    expect(none[0]?.substantiated).toBe(false);
  });

  it("teaching_text_in_another_routine_of_the_same_section_does_not_count", () => {
    const c = ctx_for(lia([routine("notes_section", "Voice (RL.6.1)"), routine("notes_section", "Next"), p("text")]), ["RL.6.1"]);
    const f = standard_not_taught_rule.run(c, DEFAULT_POLICY);
    expect(f).toHaveLength(1);
    expect(f[0]?.message).toContain("no teaching text follows that heading");
  });

  it("say_callout_after_the_heading_is_teaching_text", () => {
    expect(read_evidence(lia([routine("notes_section", "Voice (RL.6.1)"), say_eld()]))[0]?.substantiated).toBe(true);
  });

  it("purpose_and_watch_callouts_are_not_teaching_text", () => {
    const only = { type: "collapsible", attrs: { label: "Integrated ELD Instructions" }, content: [callout("purpose", "Purpose"), callout("watch", "Watch")] } as PMNode;
    expect(read_evidence(lia([routine("notes_section", "Voice (RL.6.1)"), only]))[0]?.substantiated).toBe(false);
    expect(read_evidence(lia([routine("notes_section", "Voice (RL.6.1)"), eld_block()]))[0]?.substantiated).toBe(true);
  });

  it("renaming_a_title_keeps_the_evidence", () => {
    const a = read_evidence(lia([routine("notes_section", "Percy (RL.6.1)"), p("t")]));
    const b = read_evidence(lia([routine("notes_section", "Percy's voice, renamed (RL.6.1)"), p("t")]));
    expect(b).toEqual(a);
  });

  it("renaming_a_pulse_check_keeps_it_an_assessment_while_the_icon_is_cfu", () => {
    const as_cfu = read_evidence(lia([routine("cfu", "Quick check (RL.6.1)"), p("Q?")]));
    expect(as_cfu[0]).toMatchObject({ kind: "assess", activity: "pulse_check" });
    const as_notes = read_evidence(lia([routine("notes_section", "Quick check (RL.6.1)"), p("Q?")]));
    expect(as_notes[0]).toMatchObject({ kind: "teach", activity: "routine" });
  });

  it("removing_the_tag_removes_the_evidence", () => {
    const l = lia([p("Teach."), ...cfu_item({ untagged: true })]);
    expect(read_evidence(l).filter((e) => e.section === "Learning in Action")).toEqual([]);
    expect(standard_not_checked_rule.run(ctx_for(l, ["RL.6.1"]), DEFAULT_POLICY)).toHaveLength(1);
  });

  it("a_parenthetical_that_is_not_a_code_adds_nothing", () => {
    expect(read_evidence(lia([routine("notes_section", "Turn and Talk (Pairs)"), p("t"), routine("notes_section", "Notes (L.6.4 b)"), p("t")]))).toEqual([]);
  });

  it("placeholders_in_a_heading_are_not_codes", () => {
    const l = lia([
      routine("cfu", "Pulse Check (N/A)"), p("Q"),
      routine("cfu", `Pulse Check (${LESSON_ID})`), p("Q"),
      routine("cfu", "Pulse Check (RL.6.1, N/A)"), p("Q"),
    ]);
    const items = read_evidence(l);
    expect(items.map((e) => e.code)).toEqual(["RL.6.1"]);
    expect(items[0]?.tag_codes).toEqual(["RL.6.1"]);
  });

  it("a_malformed_code_in_a_pulse_check_is_still_read", () => {
    expect(read_evidence(lia([routine("cfu", "Pulse Check (RL 6.1)"), p("Q")])).map((e) => e.code)).toEqual(["RL 6.1"]);
  });

  it("ordinal_counts_routine_headings_per_section", () => {
    const items = read_evidence(lia([routine("notes_section", "One"), p("a"), routine("notes_section", "Two (RL.6.1)"), p("b"), ...cfu_item({ code: "RL.6.2" })]));
    expect(items.map((e) => e.ordinal)).toEqual([2, 3]);
  });

  it("homework_is_never_read", () => {
    const base = reading_lesson();
    const l = { ...base, sections: base.sections.map((s) => (s.name === "Homework" ? section("Homework", LESSON_ID, 0, [routine("notes_section", "Read (RL.6.1)"), p("t")]) : s)) };
    expect(read_evidence(l).filter((e) => e.section === "Homework")).toEqual([]);
  });

  it("quick_write_needs_a_prompt_paragraph", () => {
    const empty = lesson_in("Look Back", [routine("writing", "Quick Write (RL.6.1)")]);
    expect(read_evidence(empty).find((e) => e.section === "Look Back")?.substantiated).toBe(false);
    const full = lesson_in("Look Back", [routine("writing", "Quick Write (RL.6.1)"), p("Write.")]);
    expect(read_evidence(full).find((e) => e.section === "Look Back")?.substantiated).toBe(true);
  });

  it("pulse_check_needs_options", () => {
    expect(read_evidence(lia([routine("cfu", "Pulse Check (RL.6.1)"), p("Q?")]))[0]?.substantiated).toBe(false);
    expect(read_evidence(lia([...cfu_item({ code: "RL.6.1" })]))[0]?.substantiated).toBe(true);
  });

  it("old_documents_read_the_same", () => {
    const path = new URL("../../../../../ydoc/tests/fixtures/stored-wp1.json", import.meta.url);
    const stored = JSON.parse(readFileSync(path, "utf8")) as StoredLesson;
    expect(read_evidence(stored)).toEqual([]);
    const edited = structuredClone(stored);
    const heading = (edited.sections[0]?.content.content ?? []).find((n) => n.type === "routine_heading")!;
    heading.content = [{ type: "text", text: "Pulse Check (RL.6.1)" }];
    expect(read_evidence(edited).map((e) => e.code)).toEqual(["RL.6.1"]);
  });
});
