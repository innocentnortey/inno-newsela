import type { CheckRule } from "../../types.ts";

export const proper_noun_unsourced_rule: CheckRule = {
  kind: "proper_noun_unsourced",
  level: "blocking",
  run: () => [],
};
