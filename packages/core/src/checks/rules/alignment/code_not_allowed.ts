import type { CheckRule } from "../../types.ts";

export const code_not_allowed_rule: CheckRule = {
  kind: "code_not_allowed",
  level: "blocking",
  run: () => [],
};
