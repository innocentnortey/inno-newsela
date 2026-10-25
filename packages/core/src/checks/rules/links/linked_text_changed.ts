import type { CheckRule } from "../../types.ts";

export const linked_text_changed_rule: CheckRule = {
  kind: "linked_text_changed",
  level: "blocking",
  run: () => [],
};
