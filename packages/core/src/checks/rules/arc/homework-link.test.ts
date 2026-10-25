import { describe, expect, it } from "vitest";
import type { StoredLesson } from "@ls/schema/lesson";
import type { DerivedRow } from "../../types.ts";
import {
  DEFAULT_POLICY,
  make_ctx,
  p,
  reading_lesson,
  routine,
  section,
} from "../../test-helpers.ts";

import { arc_repeat_rule } from "./arc_repeat.ts";

function lesson_n(n: number, icon: string): StoredLesson {
  const id = `G6.U4.L${n}`;
  const base = reading_lesson();
  return {
    ...base,
    lesson_id: id,
    sections: [
      section("Launch", id, 5, [routine(icon, "x"), p("y")]),
      ...base.sections.slice(1),
    ],
  };
}
const derived = (lesson: StoredLesson): DerivedRow =>
  ({
    lesson_id: lesson.lesson_id,
    seq: 1,
    store_id: "s1",
    lesson,
    content_hash: "0".repeat(64),
  }) as DerivedRow;
const card = (pages: string) => ({
  title: "T",
  author: null,
  edition: null,
  chapter: null,
  pages,
  kind: "public-domain" as const,
  content_available: true,
});

function setup(hw: string | null, pages: string | null, linked = true) {
  const me = lesson_n(4, "reading");
  const next = {
    ...lesson_n(5, "writing"),
    text_cards: pages === null ? [] : [card(pages)],
  };
  const base = make_ctx(me);
  return {
    ...base,
    row: { ...base.row, homework: hw },
    links: [
      {
        link_id: "k1",
        from_lesson_id: me.lesson_id,
        from_address: "a",
        to_lesson_id: next.lesson_id,
        to_slot_id: "s",
        kind: "homework_text" as const,
        label: "l",
      },
    ],
    linked_lessons: linked ? [derived(next)] : [],
  };
}
const run = (ctx: ReturnType<typeof setup>) =>
  arc_repeat_rule.run(ctx, DEFAULT_POLICY);

describe("arc_repeat homework link", () => {
  it("homework_matches_next_reading_none", () => {
    expect(run(setup("Ch. 1 pp. 9-15", "pp. 9-15"))).toEqual([]);
  });
  it("homework_mismatch_advisory_with_related_lesson", () => {
    const f = run(setup("Ch. 1 pp. 9-15", "pp. 20-25"));
    expect(f).toHaveLength(1);
    expect(f[0]?.level).toBe("advisory");
    expect(f[0]?.related_lesson_id).toBe("G6.U4.L5");
    expect(f[0]?.address).toBe("G6.U4.L4.Homework");
  });
  it("no_neighbour_none", () => {
    expect(run(setup("pp. 9-15", "pp. 20-25", false))).toEqual([]);
    expect(run(setup("no pages here", "pp. 20-25"))).toEqual([]);
  });
});
