import { describe, expect, it } from "vitest";
import { CHECK_POLICY } from "../../policy.ts";
import { make_ctx, p, reading_lesson, section } from "../../test-helpers.ts";
import { quote_unmatched_rule } from "./quote_unmatched.ts";

const ctx_with = (line: string) => {
  const lesson = reading_lesson();
  lesson.sections[0] = section("Launch", lesson.lesson_id, 5, [p(line)]);
  return make_ctx(lesson);
};
const run = (line: string, policy = CHECK_POLICY) =>
  quote_unmatched_rule.run(ctx_with(line), policy);

describe("quote span threshold comes from the policy", () => {
  it("a 2-word quote is not checked", () => {
    expect(run("He said “alpha beta” today.")).toEqual([]);
  });
  it("a 3-word quote not in the sources is blocking", () => {
    const found = run("He said “alpha beta gamma” today.");
    expect(found).toHaveLength(1);
    expect(found[0]?.level).toBe("blocking");
  });
  it("the same 3-word quote passes when the policy minimum is 4", () => {
    expect(run("He said “alpha beta gamma” today.", { ...CHECK_POLICY, quote_span_min_words: 4 })).toEqual([]);
  });
  it("a fill-in blank is not a quotation", () => {
    expect(run("Write “___ because ___ and ___”.")).toEqual([]);
  });
});
