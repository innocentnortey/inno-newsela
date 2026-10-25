import type { CheckRule } from "../../types.ts";

export const quote_without_source_rule: CheckRule = {
  kind: "quote_without_source",
  level: "blocking",
  run: () => [],
};
