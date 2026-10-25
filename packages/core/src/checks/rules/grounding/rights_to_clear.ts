import type { CheckRule } from "../../types.ts";

export const rights_to_clear_rule: CheckRule = {
  kind: "rights_to_clear",
  level: "blocking",
  run: () => [],
};
