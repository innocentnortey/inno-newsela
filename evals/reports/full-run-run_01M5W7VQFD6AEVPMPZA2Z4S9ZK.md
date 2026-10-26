# Full-run report: run_01M5W7VQFD6AEVPMPZA2Z4S9ZK

- git_sha: 64fe0e951216-dirty
- prompt_version: pr_01M5W7TNXN3RW5HBTC37H9SSPN
- models: lesson_draft=claude-sonnet-5-5, repair=claude-sonnet-5-5, unit_plan=claude-sonnet-5-5
- provider_mode: real
- n: 47
single run, n = 47

## Counts
| field | value |
|---|---|
| n | 47 |
| lessons run (ready or failed) | 47 of 47 |
| first_pass_schema_valid | 19 (rate 0.404) |
| repairs | 28 |
| placeholders | 0 |
| confirmations (median) | 0 |
| round trip | 30/30 |
| cost_usd | 3.596973 |
| p95 minutes per lesson | 0.96 |

## failures_by_reason
- check_failed: 17

## grounding_flags_by_kind
- proper_noun_unsourced: 3

## Thresholds
| id | result | detail |
|---|---|---|
| first_pass_schema_valid_rate_ge_0.90 | FAIL | 19/47 = 0.404, 47 ran (M-31; M-5 is not computed here, the first-pass rate and repair count stand in) |
| all_terminal_with_reasons | pass | every job ready or failed with a reason |
| round_trip_hash_all | pass | 30/30 ready lessons match their derived hash (30 ready) |
| median_confirmations_le_4 | pass | median 0 (M-41) |
| spend_le_run_cap | pass | 3.596973 of cap 6 |
| per_lesson_cost_le_1usd | pass | max 0.137304 |
| p95_minutes_le_5 | pass | p95 0.96 min |
| wall_le_2h | pass | 347 s |
| disclosure_prompts_l31_l32_zero | pass | 0 open |
| totals_equal_call_sums | pass | calls 3.596973, jobs 3.369496 + unit-plan call 0.227477 |
| n_is_47 | pass | n = 47, expected 47 |

## Lessons
| lesson_id | tile_state | repairs | cost_usd | confirmations | round trip |
|---|---|---|---|---|---|
| G6.U4.FLEX-1a | ready | 0 | 0.024797 | 0 | ok |
| G6.U4.FLEX-1b | failed | 1 | 0.044656 | n/a | n/a |
| G6.U4.FLEX-2a | ready | 0 | 0.019773 | 0 | ok |
| G6.U4.FLEX-2b | failed | 1 | 0.04412 | n/a | n/a |
| G6.U4.FLEX-3a | ready | 1 | 0.037712 | 0 | ok |
| G6.U4.FLEX-3b | ready | 0 | 0.016487 | 0 | ok |
| G6.U4.L1 | ready | 1 | 0.071825 | 0 | ok |
| G6.U4.L10 | failed | 1 | 0.107316 | n/a | n/a |
| G6.U4.L11 | ready | 0 | 0.063177 | 0 | ok |
| G6.U4.L12 | ready | 1 | 0.112954 | 0 | ok |
| G6.U4.L13 | ready | 0 | 0.054655 | 0 | ok |
| G6.U4.L14 | ready | 0 | 0.060311 | 0 | ok |
| G6.U4.L15 | ready | 1 | 0.088716 | 0 | ok |
| G6.U4.L16 | ready | 0 | 0.065179 | 0 | ok |
| G6.U4.L17 | ready | 1 | 0.137304 | 0 | ok |
| G6.U4.L18 | ready | 0 | 0.047031 | 0 | ok |
| G6.U4.L19 | failed | 1 | 0.104136 | n/a | n/a |
| G6.U4.L2 | ready | 1 | 0.064174 | 0 | ok |
| G6.U4.L20 | failed | 1 | 0.0889 | n/a | n/a |
| G6.U4.L21 | failed | 1 | 0.095474 | n/a | n/a |
| G6.U4.L22 | failed | 1 | 0.110052 | n/a | n/a |
| G6.U4.L23 | failed | 1 | 0.08026 | n/a | n/a |
| G6.U4.L24 | failed | 1 | 0.090126 | n/a | n/a |
| G6.U4.L25 | ready | 0 | 0.062719 | 0 | ok |
| G6.U4.L26 | ready | 1 | 0.103028 | 0 | ok |
| G6.U4.L27 | ready | 0 | 0.040311 | 0 | ok |
| G6.U4.L28 | failed | 1 | 0.088182 | n/a | n/a |
| G6.U4.L29 | ready | 0 | 0.053175 | 0 | ok |
| G6.U4.L3 | ready | 0 | 0.037891 | 0 | ok |
| G6.U4.L30 | ready | 0 | 0.050465 | 0 | ok |
| G6.U4.L31 | ready | 1 | 0.087422 | 0 | ok |
| G6.U4.L32 | failed | 1 | 0.09643 | n/a | n/a |
| G6.U4.L33 | failed | 1 | 0.107494 | n/a | n/a |
| G6.U4.L34 | ready | 0 | 0.043123 | 0 | ok |
| G6.U4.L35 | failed | 1 | 0.094174 | n/a | n/a |
| G6.U4.L36 | ready | 1 | 0.073736 | 0 | ok |
| G6.U4.L37 | ready | 0 | 0.038895 | 0 | ok |
| G6.U4.L38 | ready | 1 | 0.078762 | 0 | ok |
| G6.U4.L39 | ready | 1 | 0.087542 | 0 | ok |
| G6.U4.L4 | failed | 1 | 0.121488 | n/a | n/a |
| G6.U4.L40 | failed | 1 | 0.080758 | n/a | n/a |
| G6.U4.L41 | ready | 0 | 0.042639 | 0 | ok |
| G6.U4.L5 | ready | 0 | 0.049283 | 0 | ok |
| G6.U4.L6 | ready | 0 | 0.060233 | 0 | ok |
| G6.U4.L7 | ready | 0 | 0.049727 | 0 | ok |
| G6.U4.L8 | failed | 1 | 0.092334 | n/a | n/a |
| G6.U4.L9 | failed | 1 | 0.10055 | n/a | n/a |
