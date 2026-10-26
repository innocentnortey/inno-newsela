# Full-run report: run_01M5WV0E6SPZ1SZE244Q8YR95S

- git_sha: ed7a073ee78f
- prompt_version: pr_01M5WTKTZ18CGJWEAYYNWQSY5S
- models: lesson_draft=claude-sonnet-5-5, repair=claude-sonnet-5-5, unit_plan=claude-sonnet-5-5
- provider_mode: real
- n: 47
single run, n = 47

## Stages (each row is count/denominator)
| stage | value | what it measures |
|---|---|---|
| initial draft parses (schema-valid) | 32/47 | the ORIGINAL draft output validated as LessonDraft |
| initial draft compiles | 32/47 | and compile_draft accepts it (M-31) |
| initial draft had no output | 9 | counted in neither row above |
| no repair needed (recorded; checks were not re-run) | 26/47 (26/32 of compiled) | initial draft compiled, zero repairs, zero truncation retries, ended ready |
| repairs attempted | 7 | lesson jobs with at least one repair |
| repair recovered to ready | 6/7 | |
| repair output parses and compiles | 7/7 | |
| stored ready | 32/47 | |
| stored failed | 10/47 | |
| review blockers (ready lessons) | 26 of 32 checked lessons | open blocking issues at each run version |
| open content slots | 37 (23 quote_placeholder, 14 excerpt_slot) in 24 lessons | counted in the stored lesson content, independent of issues |
| checks watermark | complete through 2026-10-26T19:34:50.995Z | |

## Counts
| field | value |
|---|---|
| n | 47 |
| lessons run (ready or failed) | 42 of 47 |
| repairs | 7 |
| confirmations (median) | 0 |
| round trip | 32/32 |
| cost_usd | 2.988544 |
| p95 minutes per lesson | 1.19 |

## Initial draft failures
- unparseable: 0
- schema_invalid: 1
- compile_error: 0
- invalid issue paths (counts of zod issues, index segments dropped):
- blocks.standard_codes: 1

## failures_by_reason
- capped: 9
- check_failed:proper_noun_unsourced: 1

## failures_first_by_reason
- capped: 9
- check_failed:proper_noun_unsourced: 1

## Failure chronology
stored reasons keep the first failing check kind per lesson
| order | lesson_id | finished_at | reasons |
|---|---|---|---|
| 1 | G6.U4.L19 | 2026-10-26T19:33:08.188Z | check_failed:proper_noun_unsourced |
| 2 | G6.U4.FLEX-2b | 2026-10-26T19:34:50.886Z | capped |
| 3 | G6.U4.FLEX-3a | 2026-10-26T19:34:50.890Z | capped |
| 4 | G6.U4.FLEX-3b | 2026-10-26T19:34:50.890Z | capped |
| 5 | G6.U4.L36 | 2026-10-26T19:34:50.890Z | capped |
| 6 | G6.U4.L37 | 2026-10-26T19:34:50.890Z | capped |
| 7 | G6.U4.L38 | 2026-10-26T19:34:50.890Z | capped |
| 8 | G6.U4.L39 | 2026-10-26T19:34:50.890Z | capped |
| 9 | G6.U4.L40 | 2026-10-26T19:34:50.890Z | capped |
| 10 | G6.U4.L41 | 2026-10-26T19:34:50.890Z | capped |

## grounding_flags_by_kind
- proper_noun_unsourced: 58

## Thresholds
| id | result | detail |
|---|---|---|
| first_pass_schema_valid_rate_ge_0.90 | FAIL | 32/47 original drafts parse and compile = 0.681 (M-31; 32/47 parse, 9 had no output); no repair needed 26/47; stored ready 32/47; 42 ran |
| all_terminal_with_reasons | FAIL | a job is not terminal or has no failure reason |
| round_trip_hash_all | pass | 32/32 ready lessons match their derived hash (32 ready) |
| median_confirmations_le_4 | pass | median 0 (M-41) |
| spend_le_run_cap | pass | 2.988544 of cap 5 |
| per_lesson_cost_le_1usd | pass | max 0.179137 |
| p95_minutes_le_5 | pass | p95 1.19 min |
| wall_le_2h | pass | 336 s |
| disclosure_prompts_l31_l32_zero | pass | 0 open |
| totals_equal_call_sums | FAIL | calls 2.988544, lesson jobs 2.685121 + unit-plan call 0.235021 (also on its job row 0.235021); job cost differs from its calls for G6.U4.L30, G6.U4.FLEX-2a, api 2.988544 |
| n_is_47 | pass | n = 47, expected 47 |

## Lessons
| lesson_id | tile_state | initial draft | repairs | cost_usd | confirmations | round trip | reasons |
|---|---|---|---|---|---|---|---|
| G6.U4.FLEX-1a | ready | compiled | 0 | 0.033634 | 0 | ok | none |
| G6.U4.FLEX-1b | ready | compiled | 1 | 0.060977 | 0 | ok | none |
| G6.U4.FLEX-2a | drafting | no_output | 0 | 0 | n/a | n/a | none |
| G6.U4.FLEX-2b | failed | no_output | 0 | 0 | n/a | n/a | capped |
| G6.U4.FLEX-3a | failed | no_output | 0 | 0 | n/a | n/a | capped |
| G6.U4.FLEX-3b | failed | no_output | 0 | 0 | n/a | n/a | capped |
| G6.U4.L1 | ready | compiled | 1 | 0.082949 | 0 | ok | none |
| G6.U4.L10 | ready | compiled | 0 | 0.07908 | 0 | ok | none |
| G6.U4.L11 | ready | compiled | 0 | 0.080768 | 0 | ok | none |
| G6.U4.L12 | ready | compiled | 1 | 0.152929 | 0 | ok | none |
| G6.U4.L13 | ready | compiled | 0 | 0.065084 | 0 | ok | none |
| G6.U4.L14 | ready | compiled | 0 | 0.068952 | 0 | ok | none |
| G6.U4.L15 | ready | compiled | 0 | 0.09841 | 0 | ok | none |
| G6.U4.L16 | ready | compiled | 0 | 0.094018 | 2 | ok | none |
| G6.U4.L17 | ready | compiled | 0 | 0.089786 | 0 | ok | none |
| G6.U4.L18 | ready | compiled | 0 | 0.0917 | 0 | ok | none |
| G6.U4.L19 | failed | schema_invalid | 1 | 0.125993 | n/a | n/a | check_failed:proper_noun_unsourced |
| G6.U4.L2 | ready | compiled | 1 | 0.116891 | 0 | ok | none |
| G6.U4.L20 | ready | compiled | 0 | 0.061482 | 0 | ok | none |
| G6.U4.L21 | ready | compiled | 0 | 0.069116 | 0 | ok | none |
| G6.U4.L22 | ready | compiled | 1 | 0.179137 | 0 | ok | none |
| G6.U4.L23 | ready | compiled | 0 | 0.05799 | 0 | ok | none |
| G6.U4.L24 | ready | compiled | 0 | 0.057754 | 0 | ok | none |
| G6.U4.L25 | ready | compiled | 0 | 0.086672 | 2 | ok | none |
| G6.U4.L26 | ready | compiled | 0 | 0.074084 | 0 | ok | none |
| G6.U4.L27 | ready | compiled | 0 | 0.060646 | 0 | ok | none |
| G6.U4.L28 | ready | compiled | 1 | 0.105695 | 0 | ok | none |
| G6.U4.L29 | ready | compiled | 0 | 0.064386 | 0 | ok | none |
| G6.U4.L3 | ready | compiled | 0 | 0.033934 | 0 | ok | none |
| G6.U4.L30 | repairing | no_output | 0 | 0 | n/a | n/a | none |
| G6.U4.L31 | ready | compiled | 0 | 0.073982 | 0 | ok | none |
| G6.U4.L32 | ready | compiled | 0 | 0.08921 | 0 | ok | none |
| G6.U4.L33 | drafting | no_output | 0 | 0 | n/a | n/a | none |
| G6.U4.L34 | drafting | no_output | 0 | 0 | n/a | n/a | none |
| G6.U4.L35 | drafting | no_output | 0 | 0 | n/a | n/a | none |
| G6.U4.L36 | failed | no_output | 0 | 0 | n/a | n/a | capped |
| G6.U4.L37 | failed | no_output | 0 | 0 | n/a | n/a | capped |
| G6.U4.L38 | failed | no_output | 0 | 0 | n/a | n/a | capped |
| G6.U4.L39 | failed | no_output | 0 | 0 | n/a | n/a | capped |
| G6.U4.L4 | ready | compiled | 0 | 0.076906 | 2 | ok | none |
| G6.U4.L40 | failed | no_output | 0 | 0 | n/a | n/a | capped |
| G6.U4.L41 | failed | no_output | 0 | 0 | n/a | n/a | capped |
| G6.U4.L5 | ready | compiled | 0 | 0.080242 | 0 | ok | none |
| G6.U4.L6 | ready | compiled | 0 | 0.064998 | 0 | ok | none |
| G6.U4.L7 | ready | compiled | 0 | 0.06359 | 0 | ok | none |
| G6.U4.L8 | ready | compiled | 0 | 0.082014 | 0 | ok | none |
| G6.U4.L9 | ready | compiled | 0 | 0.062112 | 2 | ok | none |
