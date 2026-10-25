import type { CheckRule } from "../../types.ts";

export const standard_not_taught_rule: CheckRule = {
  kind: "standard_not_taught",
  level: "blocking",
  run: () => [],
};
