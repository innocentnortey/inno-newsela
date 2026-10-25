import type { CheckRule } from "../../types.ts";
import { arc_repeat_rule } from "./arc_repeat.ts";
import { vocabulary_over_cap_rule } from "./vocabulary_over_cap.ts";

export const RULES: readonly CheckRule[] = [
  arc_repeat_rule,
  vocabulary_over_cap_rule,
];
