# Full-run report: run_01M5WY33SBM3C860VHP7ZDD479

- git_sha: f08da39c2ce0
- prompt_version: pr_01M5WXE455TG2GHDWHQZRVSZEY
- models: lesson_draft=claude-sonnet-5-5, repair=claude-sonnet-5-5, unit_plan=claude-sonnet-5-5
- provider_mode: real
- n: 9
single run, n = 9

## Stages (each row is count/denominator)
| stage | value | what it measures |
|---|---|---|
| initial draft parses (schema-valid) | 8/9 | the ORIGINAL draft output validated as LessonDraft |
| initial draft compiles | 8/9 | and compile_draft accepts it (M-31) |
| initial draft had no output | 0 | counted in neither row above |
| no repair needed (recorded; checks were not re-run) | 5/9 (5/8 of compiled) | initial draft compiled, zero repairs, zero truncation retries, ended ready |
| repairs attempted | 4 | lesson jobs with at least one repair |
| repair recovered to ready | 3/4 | |
| repair output parses and compiles | 4/4 | |
| stored ready | 8/9 | |
| stored failed | 1/9 | |
| review blockers (ready lessons) | 5 of 8 checked lessons | open blocking issues at each run version |
| open content slots | 5 (0 quote_placeholder, 5 excerpt_slot) in 5 lessons | counted in the stored lesson content, independent of issues |
| checks watermark | complete through 2026-10-26T20:25:33.428Z | |

## Counts
| field | value |
|---|---|
| n | 9 |
| lessons run (ready or failed) | 9 of 9 |
| repairs | 4 |
| confirmations (median) | 0 |
| round trip | 8/8 |
| cost_usd | 0.781691 |
| p95 minutes per lesson | 1.10 |

## Initial draft failures
- unparseable: 0
- schema_invalid: 1
- compile_error: 0
- invalid issue paths (counts of zod issues, index segments dropped):
- blocks.standard_codes: 3

## failures_by_reason
- check_failed:proper_noun_unsourced: 1

## failures_first_by_reason
- check_failed:proper_noun_unsourced: 1

## Failure chronology
stored reasons keep the first failing check kind per lesson
| order | lesson_id | finished_at | reasons |
|---|---|---|---|
| 1 | G6.U4.L36 | 2026-10-26T20:24:27.174Z | check_failed:proper_noun_unsourced |

## grounding_flags_by_kind
- proper_noun_unsourced: 10

## Thresholds
| id | result | detail |
|---|---|---|
| first_pass_schema_valid_rate_ge_0.90 | FAIL | 8/9 original drafts parse and compile = 0.889 (M-31; 8/9 parse, 0 had no output); no repair needed 5/9; stored ready 8/9; 9 ran |
| all_terminal_with_reasons | pass | every job ready or failed with a reason |
| round_trip_hash_all | pass | 8/8 ready lessons match their derived hash (8 ready) |
| median_confirmations_le_4 | pass | median 0 (M-41) |
| spend_le_run_cap | pass | 0.781691 of cap 1.7 |
| per_lesson_cost_le_1usd | pass | max 0.142988 |
| p95_minutes_le_5 | pass | p95 1.10 min |
| wall_le_2h | pass | 145 s |
| disclosure_prompts_l31_l32_zero | pass | 0 open |
| totals_equal_call_sums | pass | calls 0.781691, lesson jobs 0.735309 + unit-plan call 0.046382 (also on its job row 0.046382), api 0.781691 |
| n_is_47 | FAIL | n = 9, expected 47 |

## Lessons
| lesson_id | tile_state | initial draft | repairs | cost_usd | confirmations | round trip | reasons |
|---|---|---|---|---|---|---|---|
| G6.U4.FLEX-1a | ready | compiled | 1 | 0.067368 | 0 | ok | none |
| G6.U4.FLEX-2a | ready | compiled | 0 | 0.019999 | 0 | ok | none |
| G6.U4.FLEX-2b | ready | compiled | 0 | 0.018919 | 0 | ok | none |
| G6.U4.L36 | failed | schema_invalid | 1 | 0.142671 | n/a | n/a | check_failed:proper_noun_unsourced |
| G6.U4.L37 | ready | compiled | 0 | 0.07785 | 0 | ok | none |
| G6.U4.L38 | ready | compiled | 0 | 0.077783 | 0 | ok | none |
| G6.U4.L39 | ready | compiled | 0 | 0.062639 | 0 | ok | none |
| G6.U4.L40 | ready | compiled | 1 | 0.142988 | 0 | ok | none |
| G6.U4.L41 | ready | compiled | 1 | 0.125092 | 0 | ok | none |
