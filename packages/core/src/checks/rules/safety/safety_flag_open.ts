import type { CheckRule } from "../../types.ts";

export const safety_flag_open_rule: CheckRule = {
  kind: "safety_flag_open",
  level: "blocking",
  run: () => [],
};
