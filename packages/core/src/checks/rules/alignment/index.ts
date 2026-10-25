import type { CheckRule } from "../../types.ts";
import { standard_not_taught_rule } from "./standard_not_taught.ts";
import { standard_not_checked_rule } from "./standard_not_checked.ts";
import { code_not_allowed_rule } from "./code_not_allowed.ts";
import { eld_label_mismatch_rule } from "./eld_label_mismatch.ts";
import { standard_confirmation_rule } from "./standard_confirmation.ts";
import { standard_add_suggestion_rule } from "./standard_add_suggestion.ts";
import { judge_no_rule } from "./judge_no.ts";

export const RULES: readonly CheckRule[] = [
  standard_not_taught_rule,
  standard_not_checked_rule,
  code_not_allowed_rule,
  eld_label_mismatch_rule,
  standard_confirmation_rule,
  standard_add_suggestion_rule,
  judge_no_rule,
];
