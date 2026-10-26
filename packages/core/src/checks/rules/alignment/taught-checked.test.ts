import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY, section, LESSON_ID } from "../../test-helpers.ts";
import { standard_not_checked_rule } from "./standard_not_checked.ts";
import { standard_not_taught_rule } from "./standard_not_taught.ts";
import { lesson_with, rec, std_rows, wp1_ctx } from "./test-support.ts";

describe("standard_not_taught / standard_not_checked", () => {
  it("taught but unchecked gives one standard_not_checked at the Lab", () => {
    const ctx = wp1_ctx({ lesson: lesson_with([rec("L.6.4.b")], null) });
    const f = standard_not_checked_rule.run(ctx, DEFAULT_POLICY);
    expect(f).toHaveLength(1);
    expect(f[0]?.code).toBe("L.6.4");
    expect(f[0]?.address).toContain("LiteracyLab");
    expect(standard_not_taught_rule.run(ctx, DEFAULT_POLICY)).toEqual([]);
  });

  it("a tagged Pulse Check clears it", () => {
    expect(standard_not_checked_rule.run(wp1_ctx(), DEFAULT_POLICY)).toEqual([]);
  });

  it("checked but untaught gives one standard_not_taught", () => {
    const base = lesson_with([rec("L.6.4.b")]);
    const lesson = {
      ...base,
      sections: base.sections.map((s) =>
        s.name === "Literacy Lab"
          ? section("Literacy Lab", LESSON_ID, 10, [])
          : s.name === "Learning in Action"
            ? section("Learning in Action", LESSON_ID, 30, [
                ...(s.content.content ?? []).filter((n) => n.type !== "paragraph" || n.content?.[0]?.text !== "Teach."),
              ])
            : s,
      ),
    };
    const f = standard_not_taught_rule.run(wp1_ctx({ lesson }), DEFAULT_POLICY);
    expect(f).toHaveLength(1);
    expect(f[0]?.code).toBe("L.6.4");
  });

  it("with no leaf recorded the listed parent is the obligation and a leaf tag does not cover it", () => {
    const unrecorded = wp1_ctx({ lesson: lesson_with([], "L.6.4.b"), standards: std_rows() });
    const f = standard_not_checked_rule.run(unrecorded, DEFAULT_POLICY);
    expect(f.map((x) => x.code)).toEqual(["L.6.4"]);
    expect(standard_not_checked_rule.run(wp1_ctx(), DEFAULT_POLICY)).toEqual([]);
  });
});
