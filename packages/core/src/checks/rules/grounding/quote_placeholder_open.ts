import type { CheckRule } from "../../types.ts";

export const quote_placeholder_open_rule: CheckRule = {
  kind: "quote_placeholder_open",
  level: "blocking",
  run: () => [],
};
