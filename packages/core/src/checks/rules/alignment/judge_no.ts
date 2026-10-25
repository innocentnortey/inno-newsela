import type { CheckRule } from "../../types.ts";

export const judge_no_rule: CheckRule = {
  kind: "judge_no",
  level: "advisory",
  run: () => [],
};
