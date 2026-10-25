import type { CheckRule } from "../../types.ts";

export const standard_confirmation_rule: CheckRule = {
  kind: "standard_confirmation",
  level: "confirmation",
  run: () => [],
};
