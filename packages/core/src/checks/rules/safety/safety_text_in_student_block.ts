import type { CheckRule } from "../../types.ts";

export const safety_text_in_student_block_rule: CheckRule = {
  kind: "safety_text_in_student_block",
  level: "blocking",
  run: () => [],
};
