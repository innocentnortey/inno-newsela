import type { CheckRule } from "../../types.ts";

export const vocabulary_over_cap_rule: CheckRule = {
  kind: "vocabulary_over_cap",
  level: "advisory",
  run: (ctx, policy) => {
    const n = ctx.lesson.front_matter.vocabulary.length;
    if (n <= policy.vocabulary_cap) return [];
    return [
      {
        kind: "vocabulary_over_cap",
        level: "advisory",
        message: `Vocabulary list has ${n} words; the cap is ${policy.vocabulary_cap}`,
        address: `${ctx.lesson.lesson_id}.FrontMatter`,
        span_anchor: null,
        related_lesson_id: null,
        code: null,
      },
    ];
  },
};
