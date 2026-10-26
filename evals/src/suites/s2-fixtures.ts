// NL-85: check contexts for the S2 golden cases, one recipe per case. Synthetic lessons only.
// Imports core test support on purpose (see plan Risks 3); this is the only file in S2 that does.
import type { PMNode } from "@ls/schema/lesson";
import type { CheckContext, SuggestionRow } from "@ls/core/checks/types";
import { cfu_item, eld_block, h, make_ctx, reading_lesson, section } from "@ls/core/checks/test-helpers";
import { clean_reading_ctx, lesson_with, rec, wp1_ctx } from "@ls/core/checks/rules/alignment/test-support";
import { ctx_with_link, l5 } from "@ls/core/checks/rules/links/test-support";
import { ctx_with, flag, lesson_with_tip, note_segment } from "@ls/core/checks/rules/safety/test-support";
import { build_ctx, build_planted, load_plants } from "@ls/core/checks/rules/grounding/fixtures/build";

const plant_ctx = (id: string): CheckContext => build_planted(load_plants().find((x) => x.id === id)!);

const words = (n: number): string => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");
const quote = (attrs: Record<string, unknown>, text = "A short line."): PMNode => ({
  type: "quote",
  attrs,
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});
const launch_with = (node: PMNode): CheckContext => {
  const lesson = reading_lesson();
  lesson.sections[0] = section("Launch", lesson.lesson_id, 5, [node]);
  return make_ctx(lesson);
};
const with_segment = (ctx: CheckContext): CheckContext => ({ ...ctx, row: { ...ctx.row, segments: [note_segment()] } });
const pending: SuggestionRow = {
  suggestion_id: "sg1", lesson_id: "G6.U4.L4", anchor_start: "a", anchor_end: "b",
  selected_text: "synthetic words", suggested_text: "other", status: "pending",
};

export const RECIPES: Record<string, () => CheckContext> = {
  quote_placeholder_open: () => build_ctx("wp1"),
  excerpt_slot_open: () => build_ctx("wp1"),
  cross_lesson_link: () => ctx_with_link(l5({ rights: "unset", source_ref: null })),
  standard_not_taught: () => {
    const base = lesson_with([rec("L.6.4.b")]);
    const lesson = {
      ...base,
      sections: base.sections.map((s) =>
        s.name === "Literacy Lab"
          ? section("Literacy Lab", base.lesson_id, 10, [])
          : s.name === "Learning in Action"
            ? section("Learning in Action", base.lesson_id, 30, (s.content.content ?? []).filter((n) => n.type !== "paragraph" || n.content?.[0]?.text !== "Teach."))
            : s,
      ),
    };
    return wp1_ctx({ lesson });
  },
  standard_not_checked: () => wp1_ctx({ lesson: lesson_with([rec("L.6.4.b")], null) }),
  code_not_allowed: () => wp1_ctx({ lesson: lesson_with([rec("RL.6.7")]), allowed_codes: [] }),
  minutes_out_of_range: () => make_ctx(reading_lesson({}, { Launch: 25 })),
  section_missing: () => {
    const lesson = reading_lesson();
    lesson.sections = lesson.sections.filter((s) => s.name !== "Homework");
    return make_ctx(lesson);
  },
  schema_invalid: () => {
    const lesson = reading_lesson();
    const i = lesson.sections.findIndex((s) => s.name === "Learning in Action");
    lesson.sections[i] = section("Learning in Action", lesson.lesson_id, 30, [eld_block(), h(2, "Part A"), h(4, "Deep"), ...cfu_item({})]);
    return make_ctx(lesson);
  },
  quote_unmatched: () => plant_ctx("P06"),
  page_out_of_range: () => plant_ctx("P03"),
  proper_noun_unsourced: () => plant_ctx("P04"),
  quote_without_source: () => launch_with(quote({ rights: "licensed", source_ref: null })),
  quote_too_long: () => launch_with(quote({ rights: "short-quote-commentary", source_ref: "x" }, words(13))),
  rights_to_clear: () => launch_with(quote({ rights: "to-clear", source_ref: "Zanzibar Tales, ch. 1" })),
  suggestion_pending: () => ({ ...make_ctx(reading_lesson()), pending_suggestions: [pending] }),
  safety_flag_open: () => {
    const f = flag();
    return ctx_with(lesson_with_tip(f.flag_id), { safety_flags: [f] });
  },
  safety_note_without_tip: () => with_segment(make_ctx(lesson_with_tip(null))),
  safety_text_in_student_block: () =>
    with_segment(ctx_with(lesson_with_tip("G6.U4.L4.sn1", { homework: "Read how the chapter describes the loss of a pet today." }))),
  linked_text_changed: () =>
    ctx_with_link(l5({ rights: "cleared", source_ref: "ref" }), { recorded_link_hashes: { lk1: "a".repeat(64) } }),
  vocabulary_word_missing: () => make_ctx(reading_lesson(), ["defiance"]),
  standard_confirmation: () => wp1_ctx({ lesson: lesson_with([rec("L.6.4.b", { origin: "narrowed" })]) }),
  clean_reading: () => clean_reading_ctx(),
  wp1: () => build_ctx("wp1"),
  wp2: () => build_ctx("wp2"),
  wp3: () => build_ctx("wp3"),
  wp4: () => build_ctx("wp4"),
};

