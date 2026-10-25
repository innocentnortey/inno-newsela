import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { StoredLesson } from "@ls/schema/lesson";
import {
  DEFAULT_POLICY,
  make_ctx,
  reading_lesson,
} from "../../test-helpers.ts";
import { minutes_out_of_range_rule } from "./minutes_out_of_range.ts";
import { section_missing_rule } from "./section_missing.ts";
import { schema_invalid_rule } from "./schema_invalid.ts";
import { vocabulary_word_missing_rule } from "./vocabulary_word_missing.ts";

const minutes = (l = reading_lesson()) =>
  minutes_out_of_range_rule.run(make_ctx(l), DEFAULT_POLICY);
const total_findings = (l: ReturnType<typeof reading_lesson>) =>
  minutes(l).filter((f) => f.address === l.lesson_id);

describe("structural minutes and sections", () => {
  it("WP-3 clean flex day has no finding from any structural rule", () => {
    const raw: unknown = JSON.parse(
      readFileSync(
        new URL("../../fixtures/wp3-clean.json", import.meta.url),
        "utf8",
      ),
    );
    const lesson = StoredLesson.parse(raw);
    const ctx = make_ctx(lesson);
    for (const rule of [
      schema_invalid_rule,
      section_missing_rule,
      minutes_out_of_range_rule,
      vocabulary_word_missing_rule,
    ]) {
      expect(rule.run(ctx, DEFAULT_POLICY), rule.kind).toEqual([]);
    }
  });

  it("clean Reading lesson has no minutes or section findings", () => {
    expect(minutes()).toEqual([]);
    expect(
      section_missing_rule.run(make_ctx(reading_lesson()), DEFAULT_POLICY),
    ).toEqual([]);
  });

  it("flags a 3-minute Look Back (WP-1)", () => {
    const f = minutes(reading_lesson({}, { "Look Back": 3 }));
    expect(f).toHaveLength(1);
    expect(f[0]?.address).toBe("G6.U4.L4.LookBack");
  });

  it("flags a missing Learning in Action as section_missing", () => {
    const l = reading_lesson();
    l.sections = l.sections.filter((s) => s.name !== "Learning in Action");
    const f = section_missing_rule.run(make_ctx(l), DEFAULT_POLICY);
    expect(f).toHaveLength(1);
    expect(f[0]?.address).toBe("G6.U4.L4.LearninginAction");
    expect(f[0]?.message).toContain("Learning in Action");
  });

  it("flags a total of 44", () => {
    const l = reading_lesson(
      {},
      {
        "Literacy Lab": 9,
        "Learning in Action": 29,
        Launch: 4,
        "Look Back": 4,
      },
    );
    // 4+9+29+4 = 46; use explicit sections instead
    l.sections[0]!.minutes = 5;
    l.sections[1]!.minutes = 10;
    l.sections[2]!.minutes = 29;
    l.sections[3]!.minutes = 0;
    expect(l.sections.reduce((s, x) => s + x.minutes, 0)).toBe(44);
    expect(total_findings(l)).toHaveLength(1);
  });

  it("flags a total of 56", () => {
    const l = reading_lesson();
    l.sections[0]!.minutes = 6;
    l.sections[1]!.minutes = 11;
    l.sections[2]!.minutes = 31;
    l.sections[3]!.minutes = 6;
    l.sections[4]!.minutes = 2;
    expect(l.sections.reduce((s, x) => s + x.minutes, 0)).toBe(56);
    expect(total_findings(l)).toHaveLength(1);
  });

  it("ignores minutes for an unknown lesson type; schema_invalid reports it", () => {
    const l = reading_lesson({ type: "Mystery" });
    expect(minutes(l)).toEqual([]);
    expect(
      schema_invalid_rule
        .run(make_ctx(l), DEFAULT_POLICY)
        .some((f) => f.message.includes("Unknown lesson type")),
    ).toBe(true);
  });

  it("boundary totals 45 and 55 are clean", () => {
    for (const [extra, total] of [
      [-5, 45],
      [5, 55],
    ] as const) {
      const l = reading_lesson();
      l.sections[4]!.minutes = 0;
      l.sections[2]!.minutes = 30 + extra; // may flag the section, not the total
      expect(l.sections.reduce((s, x) => s + x.minutes, 0)).toBe(total);
      expect(total_findings(l)).toEqual([]);
    }
  });
});
