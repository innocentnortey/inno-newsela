import type { CheckRule } from "../../types.ts";

export const standard_add_suggestion_rule: CheckRule = {
  kind: "standard_add_suggestion",
  level: "advisory",
  run: () => [],
};
