import type { CheckRule } from "../../types.ts";

export const page_out_of_range_rule: CheckRule = {
  kind: "page_out_of_range",
  level: "blocking",
  run: () => [],
};
