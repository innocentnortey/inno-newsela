import type { CheckRule } from "../../types.ts";

export const quote_unmatched_rule: CheckRule = {
  kind: "quote_unmatched",
  level: "blocking",
  run: () => [],
};
