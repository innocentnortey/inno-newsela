import { describe, expect, it } from "vitest";
import type { StoredLesson } from "@ls/schema/lesson";
import {
  DEFAULT_POLICY,
  make_ctx,
  p,
  reading_lesson,
  routine,
  section,
} from "../../test-helpers.ts";
import type { DerivedRow } from "../../types.ts";
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

const run = (me: StoredLesson, others: StoredLesson[]) =>
  arc_repeat_rule.run(
    { ...make_ctx(me), linked_lessons: others.map(derived) },
    DEFAULT_POLICY,
  );

describe("arc_repeat window", () => {
  const [l6, l7, l8] = [6, 7, 8].map((n) => lesson_n(n, "reading")) as [
    StoredLesson,
    StoredLesson,
    StoredLesson,
  ];
  it("seeded_l6_l8_one_finding_on_l8", () => {
    const f = run(l8, [l6, l7]);
    expect(f).toHaveLength(1);
    expect(f[0]?.level).toBe("advisory");
    expect(f[0]?.address).toMatch(/\.Launch$/);
    expect(f[0]?.related_lesson_id).toBe("G6.U4.L7");
  });
  it("l6_and_l7_none", () => {
    expect(run(l6, [l7, l8])).toEqual([]);
    expect(run(l7, [l6, l8])).toEqual([]);
  });
  it("changed_l7_routine_none", () => {
    expect(run(l8, [l6, lesson_n(7, "writing")])).toEqual([]);
  });
});
