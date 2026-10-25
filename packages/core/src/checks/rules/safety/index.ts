import type { CheckRule } from "../../types.ts";
import { safety_flag_open_rule } from "./safety_flag_open.ts";
import { safety_note_without_tip_rule } from "./safety_note_without_tip.ts";
import { safety_text_in_student_block_rule } from "./safety_text_in_student_block.ts";
import { disclosure_prompt_rule } from "./disclosure_prompt.ts";

export const RULES: readonly CheckRule[] = [
  safety_flag_open_rule,
  safety_note_without_tip_rule,
  safety_text_in_student_block_rule,
  disclosure_prompt_rule,
];
