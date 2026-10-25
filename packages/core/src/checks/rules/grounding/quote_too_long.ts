import type { CheckRule } from "../../types.ts";

export const quote_too_long_rule: CheckRule = {
  kind: "quote_too_long",
  level: "blocking",
  run: () => [],
};
