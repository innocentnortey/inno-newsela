import type { CheckPolicy } from "./types.ts";

// SP-3 values.
export const CHECK_POLICY: CheckPolicy = Object.freeze({
  quote_span_min_words: 3,
  reviewer_quote_max_words: 12,
  quote_and_page_scans: "blocking_everywhere",
  name_scan_scope: "blocking_in_cfu_items",
  name_scan_engine: "heuristic_plus_compromise",
  minutes_target: 50,
  minutes_tolerance: 5,
  vocabulary_cap: 6,
  safety_run_min_words: 6,
});
