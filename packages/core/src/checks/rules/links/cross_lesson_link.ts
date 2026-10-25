import type { CheckRule } from "../../types.ts";

export const cross_lesson_link_rule: CheckRule = {
  kind: "cross_lesson_link",
  level: "blocking",
  run: () => [],
};
