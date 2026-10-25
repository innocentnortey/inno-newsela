import type { CheckRule } from "../../types.ts";

export const excerpt_slot_open_rule: CheckRule = {
  kind: "excerpt_slot_open",
  level: "blocking",
  run: () => [],
};
