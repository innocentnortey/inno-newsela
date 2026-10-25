import type { CheckRule } from "../../types.ts";

export const disclosure_prompt_rule: CheckRule = {
  kind: "disclosure_prompt",
  level: "advisory",
  run: () => [],
};
