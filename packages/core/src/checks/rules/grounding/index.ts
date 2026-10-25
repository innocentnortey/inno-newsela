import type { CheckRule } from "../../types.ts";
import { quote_placeholder_open_rule } from "./quote_placeholder_open.ts";
import { excerpt_slot_open_rule } from "./excerpt_slot_open.ts";
import { quote_unmatched_rule } from "./quote_unmatched.ts";
import { page_out_of_range_rule } from "./page_out_of_range.ts";
import { proper_noun_unsourced_rule } from "./proper_noun_unsourced.ts";
import { quote_without_source_rule } from "./quote_without_source.ts";
import { quote_too_long_rule } from "./quote_too_long.ts";
import { rights_to_clear_rule } from "./rights_to_clear.ts";

export const RULES: readonly CheckRule[] = [
  quote_placeholder_open_rule,
  excerpt_slot_open_rule,
  quote_unmatched_rule,
  page_out_of_range_rule,
  proper_noun_unsourced_rule,
  quote_without_source_rule,
  quote_too_long_rule,
  rights_to_clear_rule,
];
