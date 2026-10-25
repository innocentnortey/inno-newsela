import type { StoredLesson } from "@ls/schema/lesson";
import type { CheckContext, StandardRow } from "../../types.ts";
import { cfu_item, make_ctx, p, reading_lesson, section, LESSON_ID } from "../../test-helpers.ts";

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
    eld("ELD.PI.6.6b", "PI", "synthetic strand one label"),
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

/** Lesson taught in Literacy Lab and checked by one Pulse Check tagged `tag`. */
export function lesson_with(standards: Std[], tag: string | null = "L.6.4.b"): StoredLesson {
  const base = reading_lesson();
  return {
    ...base,
    front_matter: { ...base.front_matter, standards },
    sections: base.sections.map((s) =>
      s.name === "Learning in Action"
        ? section("Learning in Action", LESSON_ID, 30, [p("Teach."), ...(tag === null ? [] : cfu_item({ code: tag }))])
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
