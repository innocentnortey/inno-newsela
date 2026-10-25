import { describe, expect, it } from "vitest";
import {
  DEFAULT_POLICY,
  make_ctx,
  p,
  reading_lesson,
  routine,
  section,
} from "../../test-helpers.ts";
import type { StoredLesson } from "@ls/schema/lesson";
import { vocabulary_word_missing_rule } from "./vocabulary_word_missing.ts";

const run = (l: StoredLesson, vocab: string[]) =>
  vocabulary_word_missing_rule.run(make_ctx(l, vocab), DEFAULT_POLICY);

describe("vocabulary_word_missing", () => {
  it("one blocking finding naming a word in neither list", () => {
    const f = run(reading_lesson(), ["defiance"]);
    expect(f).toHaveLength(1);
    expect(f[0]?.level).toBe("blocking");
    expect(f[0]?.message).toContain("defiance");
    expect(f[0]?.address).toBe("G6.U4.L4.FrontMatter");
  });
  it("none when the word is in front matter", () => {
    const l = reading_lesson();
    l.front_matter.vocabulary = ["Defiance"];
    expect(run(l, ["defiance"])).toEqual([]);
  });
  it("none when the word is in the personal dictionary list", () => {
    const l = reading_lesson();
    const i = l.sections.findIndex((s) => s.name === "Launch");
    l.sections[i] = section("Launch", l.lesson_id, 5, [
      routine("personal_dictionary", "Personal Dictionary"),
      p("recognize p. 4, defiance"),
    ]);
    expect(run(l, ["defiance", "recognize"])).toEqual([]);
  });
  it("ignores case and surrounding spaces", () => {
    const l = reading_lesson();
    l.front_matter.vocabulary = ["  DEFIANCE  "];
    expect(run(l, [" defiance "])).toEqual([]);
  });
});
