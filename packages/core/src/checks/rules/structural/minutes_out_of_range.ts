import type { CheckFinding, CheckRule } from "../../types.ts";
import { EXPECTED_SECTIONS, SECTION_MINUTES_TOLERANCE } from "./expected.ts";

export const minutes_out_of_range_rule: CheckRule = {
  kind: "minutes_out_of_range",
  level: "blocking",
  run: (ctx, policy) => {
    const tmpl = EXPECTED_SECTIONS(ctx.lesson.type);
    if (tmpl === null) return [];
    const out: CheckFinding[] = [];
    const finding = (message: string, address: string): CheckFinding => ({
      kind: "minutes_out_of_range",
      level: "blocking",
      message,
      address,
      span_anchor: null,
      related_lesson_id: null,
      code: null,
    });
    for (const section of ctx.lesson.sections) {
      const expected = tmpl.find((t) => t.name === section.name);
      if (expected === undefined) continue;
      if (
        Math.abs(section.minutes - expected.minutes) > SECTION_MINUTES_TOLERANCE
      ) {
        out.push(
          finding(
            `"${section.name}" is ${section.minutes} minutes; the template expects ${expected.minutes}`,
            section.address,
          ),
        );
      }
    }
    const total = ctx.lesson.sections.reduce((sum, s) => sum + s.minutes, 0);
    if (Math.abs(total - policy.minutes_target) > policy.minutes_tolerance) {
      out.push(
        finding(
          `Lesson totals ${total} minutes; expected ${policy.minutes_target} plus or minus ${policy.minutes_tolerance}`,
          ctx.lesson.lesson_id,
        ),
      );
    }
    return out;
  },
};
