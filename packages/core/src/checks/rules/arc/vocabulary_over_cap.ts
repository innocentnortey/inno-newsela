import type { CheckRule } from "../../types.ts";

export const vocabulary_over_cap_rule: CheckRule = {
  kind: "vocabulary_over_cap",
  level: "advisory",
  run: () => [],
};
