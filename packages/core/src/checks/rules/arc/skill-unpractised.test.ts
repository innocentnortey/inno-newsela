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
type Cell = { code: string; lesson_id: string; role: "I" | "P" | "A" };
const run = (cells: Cell[]) =>
  arc_repeat_rule.run(
    {
      ...make_ctx(lesson_n(4, "reading")),
      unit_coverage: cells as unknown as ReturnType<
        typeof make_ctx
      >["unit_coverage"],
    },
    DEFAULT_POLICY,
  );

describe("arc_repeat unpractised skill", () => {
  it("a_without_p_one_finding", () => {
    const f = run([{ code: "RL.6.1", lesson_id: "G6.U4.L4", role: "A" }]);
    expect(f).toHaveLength(1);
    expect(f[0]?.code).toBe("skill_unpractised");
    expect(f[0]?.level).toBe("advisory");
  });
  it("p_elsewhere_none", () => {
    expect(
      run([
        { code: "RL.6.1", lesson_id: "G6.U4.L4", role: "A" },
        { code: "RL.6.1", lesson_id: "G6.U4.L2", role: "P" },
      ]),
    ).toEqual([]);
  });
  it("empty_coverage_none", () => {
    expect(run([])).toEqual([]);
  });
});
