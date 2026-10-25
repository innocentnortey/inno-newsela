import type { CheckRule } from "../../types.ts";

export const standard_not_checked_rule: CheckRule = {
  kind: "standard_not_checked",
  level: "blocking",
  run: () => [],
};
