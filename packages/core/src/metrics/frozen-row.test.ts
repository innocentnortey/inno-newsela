// NL-48
import { describe, expect, it } from "vitest";
import type { LessonVersionRow } from "../ports/lesson-versions.ts";
import type { ReviewSessionRow } from "../ports/metrics.ts";
import { compute_lesson_metrics } from "./frozen-row.ts";

const ver = (words: number) =>
  ({ version_id: "lv_1", lesson_id: "G6.U4.L1", teacher_word_count: words }) as unknown as LessonVersionRow;
const sess = (secs: number, synthetic: boolean): ReviewSessionRow => ({
  user_id: "usr_a" as ReviewSessionRow["user_id"],
  lesson_id: "G6.U4.L1" as ReviewSessionRow["lesson_id"],
  version_id: "lv_1" as ReviewSessionRow["version_id"],
  started_at: new Date(0),
  last_at: new Date(secs * 1000),
  active_seconds: secs,
  synthetic,
});
const AT = new Date("2026-10-01T10:00:00.000Z");

describe("compute_lesson_metrics", () => {
  it("synthetic_excluded", () => {
    const r = compute_lesson_metrics([sess(600, false), sess(6000, true)], ver(1250), "usable_as_drafted", AT);
    expect(r.active_minutes.toString()).toBe("10");
    expect(r.human_sessions).toBe(1);
  });
  it("threshold_half_read_time", () => {
    expect(compute_lesson_metrics([], ver(1250), "rewritten", AT).g2_threshold_minutes.toString()).toBe("2.5");
    expect(compute_lesson_metrics([], ver(0), "rewritten", AT).g2_threshold_minutes.toString()).toBe("0");
  });
  it("no_person_field", () => {
    const r = compute_lesson_metrics([sess(60, false)], ver(250), "usable_with_edits", AT);
    expect(Object.keys(r).sort()).toEqual(
      ["active_minutes", "approved_at", "draft_rating", "g2_threshold_minutes", "human_sessions", "lesson_id", "teacher_word_count", "version_id"],
    );
  });
});
