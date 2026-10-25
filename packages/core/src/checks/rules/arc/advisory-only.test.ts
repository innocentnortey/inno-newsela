import { describe, expect, it } from "vitest";
import { run_checks } from "../../registry.ts";
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
import { vocabulary_over_cap_rule } from "./vocabulary_over_cap.ts";

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

const rules = [arc_repeat_rule, vocabulary_over_cap_rule];
const words = ["a", "b", "c", "d", "e", "f", "g"];

describe("arc rules are advisory only", () => {
  const repeat = {
    ...make_ctx(lesson_n(8, "reading")),
    linked_lessons: [
      derived(lesson_n(6, "reading")),
      derived(lesson_n(7, "reading")),
    ],
  };
  const l = lesson_n(4, "reading");
  const over = make_ctx({
    ...l,
    front_matter: { ...l.front_matter, vocabulary: words },
  });
  const next = lesson_n(5, "reading");
  const mismatch = {
    ...make_ctx(l),
    row: { ...make_ctx(l).row, homework: "pp. 9-15" },
    links: [
      {
        link_id: "k1",
        from_lesson_id: l.lesson_id,
        from_address: "a",
        to_lesson_id: next.lesson_id,
        to_slot_id: "s",
        kind: "homework_text" as const,
        label: "l",
      },
    ],
    linked_lessons: [
      derived({
        ...next,
        text_cards: [
          {
            title: "T",
            author: null,
            edition: null,
            chapter: null,
            pages: "pp. 20-25",
            kind: "public-domain",
            content_available: true,
          },
        ],
      }),
    ],
  };
  it("blocking_zero_advisory_n", () => {
    for (const ctx of [repeat, over, mismatch]) {
      const r = run_checks(ctx, rules, DEFAULT_POLICY);
      expect(r.findings.length).toBeGreaterThan(0);
      expect(r.blocking).toBe(0);
      expect(r.first_failing_kind).toBeNull();
      expect(r.findings.every((f) => f.level === "advisory")).toBe(true);
      expect(r.advisory).toBe(r.findings.length);
    }
  });
});
