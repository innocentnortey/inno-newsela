# Full-run report: run_01M5W6JK5XJQ7VE0WMR7HR1Z11

- git_sha: 975600f9564c-dirty
- prompt_version: n/a
- models: {"provider_mode_note":"stub runs make no model call"}
- provider_mode: real
- n: 47
single run, n = 47

## Counts
| field | value |
|---|---|
| n | 47 |
| lessons run (ready or failed) | 47 of 47 |
| first_pass_schema_valid | 0 (rate 0.000) |
| repairs | 47 |
| placeholders | 0 |
| confirmations (median) | 0 |
| round trip | 8/8 |
| cost_usd | 4.190604 |
| p95 minutes per lesson | 0.97 |

## failures_by_reason
- check_failed: 39

## grounding_flags_by_kind
- none

## Thresholds
| id | result | detail |
|---|---|---|
| first_pass_schema_valid_rate_ge_0.90 | FAIL | 0/47 = 0.000, 47 ran (M-31; M-5 is not computed here, the first-pass rate and repair count stand in) |
| all_terminal_with_reasons | pass | every job ready or failed with a reason |
| round_trip_hash_all | pass | 8/47 ready lessons match their derived hash (8 ready) |
| median_confirmations_le_4 | pass | median 0 (M-41) |
| spend_le_run_cap | pass | 4.190604 of cap 12 |
| per_lesson_cost_le_1usd | pass | max 0.127118 |
| p95_minutes_le_5 | pass | p95 0.97 min |
| wall_le_2h | pass | 474 s |
| disclosure_prompts_l31_l32_zero | pass | 0 open |
| totals_equal_call_sums | FAIL | calls 4.190604, jobs 3.953017 |
| n_is_47 | pass | n = 47, expected 47 |

## Lessons
| lesson_id | tile_state | repairs | cost_usd | confirmations | round trip |
|---|---|---|---|---|---|
| G6.U4.FLEX-1a | failed | 1 | 0.037555 | n/a | n/a |
| G6.U4.FLEX-1b | failed | 1 | 0.036833 | n/a | n/a |
| G6.U4.FLEX-2a | failed | 1 | 0.022303 | n/a | n/a |
| G6.U4.FLEX-2b | failed | 1 | 0.027719 | n/a | n/a |
| G6.U4.FLEX-3a | failed | 1 | 0.025191 | n/a | n/a |
| G6.U4.FLEX-3b | failed | 1 | 0.022727 | n/a | n/a |
| G6.U4.L1 | failed | 1 | 0.058218 | n/a | n/a |
| G6.U4.L10 | failed | 1 | 0.102577 | n/a | n/a |
| G6.U4.L11 | failed | 1 | 0.119087 | n/a | n/a |
| G6.U4.L12 | failed | 1 | 0.096367 | n/a | n/a |
| G6.U4.L13 | ready | 1 | 0.115781 | 0 | ok |
| G6.U4.L14 | ready | 1 | 0.104027 | 0 | ok |
| G6.U4.L15 | failed | 1 | 0.093071 | n/a | n/a |
| G6.U4.L16 | failed | 1 | 0.102003 | n/a | n/a |
| G6.U4.L17 | failed | 1 | 0.125715 | n/a | n/a |
| G6.U4.L18 | failed | 1 | 0.096295 | n/a | n/a |
| G6.U4.L19 | failed | 1 | 0.076457 | n/a | n/a |
| G6.U4.L2 | failed | 1 | 0.065864 | n/a | n/a |
| G6.U4.L20 | ready | 1 | 0.088947 | 0 | ok |
| G6.U4.L21 | failed | 1 | 0.091129 | n/a | n/a |
| G6.U4.L22 | failed | 1 | 0.091673 | n/a | n/a |
| G6.U4.L23 | failed | 1 | 0.082555 | n/a | n/a |
| G6.U4.L24 | failed | 1 | 0.079629 | n/a | n/a |
| G6.U4.L25 | failed | 1 | 0.094743 | n/a | n/a |
| G6.U4.L26 | failed | 1 | 0.095603 | n/a | n/a |
| G6.U4.L27 | ready | 1 | 0.079407 | 0 | ok |
| G6.U4.L28 | failed | 1 | 0.097027 | n/a | n/a |
| G6.U4.L29 | failed | 1 | 0.086125 | n/a | n/a |
| G6.U4.L3 | failed | 1 | 0.06498 | n/a | n/a |
| G6.U4.L30 | failed | 1 | 0.094307 | n/a | n/a |
| G6.U4.L31 | failed | 1 | 0.087665 | n/a | n/a |
| G6.U4.L32 | failed | 1 | 0.109857 | n/a | n/a |
| G6.U4.L33 | failed | 1 | 0.089249 | n/a | n/a |
| G6.U4.L34 | failed | 1 | 0.107253 | n/a | n/a |
| G6.U4.L35 | failed | 1 | 0.101301 | n/a | n/a |
| G6.U4.L36 | failed | 1 | 0.076029 | n/a | n/a |
| G6.U4.L37 | failed | 1 | 0.081639 | n/a | n/a |
| G6.U4.L38 | failed | 1 | 0.077637 | n/a | n/a |
| G6.U4.L39 | failed | 1 | 0.071547 | n/a | n/a |
| G6.U4.L4 | ready | 1 | 0.127118 | 0 | ok |
| G6.U4.L40 | failed | 1 | 0.077335 | n/a | n/a |
| G6.U4.L41 | failed | 1 | 0.067423 | n/a | n/a |
| G6.U4.L5 | ready | 1 | 0.09889 | 0 | ok |
| G6.U4.L6 | ready | 1 | 0.109042 | 0 | ok |
| G6.U4.L7 | failed | 1 | 0.100801 | n/a | n/a |
| G6.U4.L8 | ready | 1 | 0.111023 | 0 | ok |
| G6.U4.L9 | failed | 1 | 0.085293 | n/a | n/a |
