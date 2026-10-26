import type { StoredLesson } from "@ls/schema/lesson";
import type { CheckContext, StandardRow } from "../../types.ts";
import { cfu_item, make_ctx, p, reading_lesson, routine, section, LESSON_ID } from "../../test-helpers.ts";

type Std = StoredLesson["front_matter"]["standards"][number];

export function std_rows(): StandardRow[] {
  const r = (code: string, parent_code: string | null, is_leaf: boolean, text: string): StandardRow => ({
    code,
    set: "CA_CCSS_ELA_6",
    text,
    parent_code,
    is_leaf,
    eld_strand: null,
  });
  const eld = (code: string, strand: string, text: string): StandardRow => ({
    code,
    set: "CA_ELD_6",
    text,
    parent_code: null,
    is_leaf: true,
    eld_strand: strand,
  });
  return [
    r("RL.6.1", null, true, "synthetic reading one"),
    r("L.6.4", null, false, "synthetic language four"),
    r("L.6.4.b", "L.6.4", true, "synthetic language four b"),
    r("L.6.4.c", "L.6.4", true, "synthetic language four c"),
    r("RL.6.7", null, true, "synthetic reading seven"),
    r("W.6.2", null, false, "synthetic writing two"),
    r("W.6.2.a", "W.6.2", true, "synthetic writing two a"),
    r("W.6.2.b", "W.6.2", true, "synthetic writing two b"),
    r("W.6.2.f", "W.6.2", true, "synthetic writing two f"),
    eld("ELD.PI.6.6b", "PI", "synthetic strand one label"),
    eld("ELD.PI.6.6b.Em", "PI", "synthetic strand one emerging"),
    eld("ELD.PI.6.10", "PI", "synthetic strand ten label"),
    eld("ELD.PI.6.7", "PI", "synthetic strand seven label"),
    eld("ELD.PII.6.2b", "PII", "synthetic strand two label"),
  ];
}

export function rec(code: string, over: Partial<Std> = {}): Std {
  return {
    code,
    role: "focus",
    origin: "outline",
    official_text: "",
    asserted_by: "outline",
    confirmation: null,
    ...over,
  };
}

/**
 * Lesson with a teaching routine tagged `teach` (null omits the heading) and one Pulse Check tagged `tag`
 * (null omits it). Teaching text sits in Literacy Lab, Launch and Learning in Action.
 */
export function lesson_with(
  standards: Std[],
  tag: string | null = "L.6.4.b",
  teach: string | null = "L.6.4.b",
): StoredLesson {
  const base = reading_lesson();
  return {
    ...base,
    front_matter: { ...base.front_matter, standards },
    sections: base.sections.map((s) =>
      s.name === "Learning in Action"
        ? section("Learning in Action", LESSON_ID, 30, [
          ...(teach === null ? [] : [routine("notes_section", `Teaching (${teach})`)]),
          p("Teach."),
          ...(tag === null ? [] : cfu_item({ code: tag })),
        ])
        : s,
    ),
  };
}

/** WP-1 shaped context: parent L.6.4 listed, leaf L.6.4.b recorded and tagged. */
export function wp1_ctx(over: Partial<CheckContext> = {}): CheckContext {
  const ctx = make_ctx(lesson_with([rec("L.6.4.b")]));
  return {
    ...ctx,
    row: { ...ctx.row, focus_codes: ["L.6.4"] },
    allowed_codes: ["L.6.4.b", "L.6.4.c"],
    standards: std_rows(),
    ...over,
  };
}

/**
 * The clean Reading lesson of S2's `clean_reading` recipe with everything the standards rules need: a listed, recorded
 * focus code (RL.6.1) that is taught in Learning in Action and checked by that section's Pulse Check, and the catalogue.
 * Setup only (F2-D7): the earlier recipe tagged a Pulse Check with no listed code, nothing recorded and no catalogue.
 */
export function clean_reading_ctx(): CheckContext {
  const base = make_ctx(reading_lesson());
  const lesson: StoredLesson = {
    ...base.lesson,
    front_matter: { ...base.lesson.front_matter, standards: [rec("RL.6.1")] },
    sections: base.lesson.sections.map((s) => ({
      ...s,
      content: {
        ...s.content,
        content: (s.content.content ?? []).map((n) => {
          const t = n.content?.[0]?.text;
          return s.name === "Learning in Action" && n.type === "routine_heading" && t === "Close reading"
            ? { ...n, content: [{ type: "text", text: "Close reading (RL.6.1)" }] }
            : n;
        }),
      },
    })),
  };
  return { ...base, lesson, row: { ...base.row, focus_codes: ["RL.6.1"] }, standards: std_rows() };
}
