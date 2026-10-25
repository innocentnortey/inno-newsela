import type { CheckRule } from "../../types.ts";
import { schema_invalid_rule } from "./schema_invalid.ts";
import { section_missing_rule } from "./section_missing.ts";
import { minutes_out_of_range_rule } from "./minutes_out_of_range.ts";
import { vocabulary_word_missing_rule } from "./vocabulary_word_missing.ts";

export const RULES: readonly CheckRule[] = [
  schema_invalid_rule,
  section_missing_rule,
  minutes_out_of_range_rule,
  vocabulary_word_missing_rule,
];
