import type { CheckRule } from "../../types.ts";

export const safety_note_without_tip_rule: CheckRule = {
  kind: "safety_note_without_tip",
  level: "blocking",
  run: () => [],
};
