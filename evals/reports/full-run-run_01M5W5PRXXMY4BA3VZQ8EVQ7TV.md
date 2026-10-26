# Full-run report: run_01M5W5PRXXMY4BA3VZQ8EVQ7TV

- git_sha: 87daa293f96a-dirty
- prompt_version: n/a
- models: {"generation":"claude-sonnet-5-5","effort":"low","max_tokens":32000,"retry_max_tokens":48000,"concurrency":6,"call_timeout_s":240,"judge":"disabled"}
- provider_mode: real
- n: 47
single run, n = 47

## Counts
| field | value |
|---|---|
| n | 47 |
| first_pass_schema_valid | 47 (rate 1.000) |
| repairs | 0 |
| placeholders | 0 |
| confirmations (median) | 0 |
| round trip | 0/0 |
| cost_usd | 0 |
| p95 minutes per lesson | n/a |

## failures_by_reason
- none

## grounding_flags_by_kind
- none

## Thresholds
| id | result | detail |
|---|---|---|
| first_pass_schema_valid_rate_ge_0.90 | pass | 47/47 = 1.000 (M-31; M-5 is not computed here, the first-pass rate and repair count stand in) |
| all_terminal_with_reasons | FAIL | a job is not terminal or has no failure reason |
| round_trip_hash_all | FAIL | 0/47 ready lessons match their derived hash (0 ready) |
| median_confirmations_le_4 | pass | median 0 (M-41) |
| spend_le_run_cap | pass | 0 of cap 12 |
| per_lesson_cost_le_1usd | pass | max 0 |
| p95_minutes_le_5 | FAIL | p95 n/a min |
| wall_le_2h | pass | 0 s |
| disclosure_prompts_l31_l32_zero | pass | 0 open |
| totals_equal_call_sums | pass | calls 0, jobs 0 |
| n_is_47 | pass | n = 47, expected 47 |

## Lessons
| lesson_id | tile_state | repairs | cost_usd | confirmations | round trip |
|---|---|---|---|---|---|
| G6.U4.FLEX-1a | queued | 0 | 0 | n/a | n/a |
| G6.U4.FLEX-1b | queued | 0 | 0 | n/a | n/a |
| G6.U4.FLEX-2a | queued | 0 | 0 | n/a | n/a |
| G6.U4.FLEX-2b | queued | 0 | 0 | n/a | n/a |
| G6.U4.FLEX-3a | queued | 0 | 0 | n/a | n/a |
| G6.U4.FLEX-3b | queued | 0 | 0 | n/a | n/a |
| G6.U4.L1 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L10 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L11 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L12 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L13 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L14 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L15 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L16 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L17 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L18 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L19 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L2 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L20 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L21 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L22 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L23 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L24 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L25 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L26 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L27 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L28 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L29 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L3 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L30 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L31 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L32 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L33 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L34 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L35 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L36 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L37 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L38 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L39 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L4 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L40 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L41 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L5 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L6 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L7 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L8 | queued | 0 | 0 | n/a | n/a |
| G6.U4.L9 | queued | 0 | 0 | n/a | n/a |
