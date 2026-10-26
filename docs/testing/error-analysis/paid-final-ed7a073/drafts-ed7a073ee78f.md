# Eval report: drafts @ ed7a073ee78f

## Suite S3
- eval_run_id: ev_01M5WTK0FXFE86BNGCWTKH22ZM
- git_sha: ed7a073ee78f
- prompt_version: none (stub)
- models: {"generation":"claude-sonnet-5-5","repair":"claude-sonnet-5-5","assist":"claude-sonnet-5-5","provider_mode_note":"stub runs make no model call"}
- provider_mode: real
- n: 9
- passed: 3/9
- cost_usd: 0.745676

| case_id | result | source | failure_category |
|---|---|---|---|
| wp-1#1 | fail | WP-1 | FC-7 |
| wp-1#2 | fail | WP-1 | FC-3 |
| wp-1#3 | fail | WP-1 | FC-3 |
| wp-2#1 | fail | WP-2 | FC-3 |
| wp-2#2 | fail | WP-2 | FC-7 |
| wp-2#3 | fail | WP-2 | FC-7 |
| wp-3#1 | pass | WP-3 |  |
| wp-3#2 | pass | WP-3 |  |
| wp-3#3 | pass | WP-3 |  |

## Detail S3
- git_sha: ed7a073ee78f
- prompt_version: v1 locked f1d29f98868a
- provenance: recorded from the run rows of each case-repeat (prompt_version table, model_call rows). The "Suite S3" section above shows the runner's configured prompt_version and models, not what this run used.
- served_models: [claude-sonnet-5-5]
- requested_models: [claude-sonnet-5-5]
- effort: low
- max_tokens: 32000 (retry 48000)
- n: 9 (3 cases x 3 repeats)
- calls_recorded: 19 completed of 19 (served_models above come from them)
- provider_mode: real
- cost_total_usd: 0.745676   (S3 guard: estimated reservation $3.17 for 9 runs; limit $3.20 (min of --max-usd, PD-29 ceiling); PD-29 headroom not read (no total reader))
- M-31 initial draft parses and compiles: 9/9 (parse 9/9, no output 0; repairs used: 1 of 9)

### wp-1 (WP-1)

| assertion | repeat 1 | repeat 2 | repeat 3 | FC |
|---|---|---|---|---|
| draft_stored | pass | pass | pass |  |
| required_blocks | pass | fail | fail | FC-3 |
| section_minutes | pass | pass | pass |  |
| placeholder_count | fail | fail | fail | FC-7 |
| no_quote_node | pass | pass | pass |  |
| origin_present | pass | pass | pass |  |
| taught_and_checked | pass | pass | pass |  |
| lesson_link_blocking | pass | pass | pass |  |

passes: 0/3, minutes_total [50, 50, 50], placeholders [1, 0, 0], output tokens [6690..6947]
cost_usd: 0.290055
- repeat 1: first_failing_step: none, FC-7; placeholder_count FC-7: 1 placeholders, expected exactly 2
- repeat 2: first_failing_step: none, FC-3; required_blocks FC-3: missing 1: Learning in Action Part A:text_evidence_needed; placeholder_count FC-7: 0 placeholders, expected exactly 2
- repeat 3: first_failing_step: none, FC-3; required_blocks FC-3: missing 1: Learning in Action Part A:text_evidence_needed; placeholder_count FC-7: 0 placeholders, expected exactly 2

### wp-2 (WP-2)

| assertion | repeat 1 | repeat 2 | repeat 3 | FC |
|---|---|---|---|---|
| draft_stored | pass | pass | pass |  |
| required_blocks | fail | pass | pass | FC-3 |
| section_minutes | pass | pass | pass |  |
| placeholder_count | fail | fail | fail | FC-7 |
| no_quote_node | pass | pass | pass |  |
| origin_present | pass | pass | pass |  |
| taught_and_checked | pass | pass | pass |  |
| lesson_link_blocking | pass | pass | pass |  |

passes: 0/3, minutes_total [50, 50, 50], placeholders [2, 2, 2], output tokens [6796..11135]
cost_usd: 0.365072
- repeat 1: first_failing_step: none, FC-3; required_blocks FC-3: missing 2: Learning in Action Part A:excerpt_slot, Learning in Action Part A:support_table; placeholder_count FC-7: 2 placeholders, expected exactly 1
- repeat 2: first_failing_step: checks, FC-7 (repair recovered); placeholder_count FC-7: 2 placeholders, expected exactly 1
- repeat 3: first_failing_step: none, FC-7; placeholder_count FC-7: 2 placeholders, expected exactly 1

### wp-3 (WP-3)

| assertion | repeat 1 | repeat 2 | repeat 3 | FC |
|---|---|---|---|---|
| draft_stored | pass | pass | pass |  |
| required_blocks | pass | pass | pass |  |
| section_minutes | pass | pass | pass |  |
| placeholder_count | pass | pass | pass |  |
| no_quote_node | pass | pass | pass |  |
| origin_present | pass | pass | pass |  |
| taught_and_checked | pass | pass | pass |  |
| lesson_link_blocking | pass | pass | pass |  |

passes: 3/3, minutes_total [50, 50, 50], placeholders [0, 0, 0], output tokens [2091..2334]
cost_usd: 0.090549

### Compared with SP-1

| case | SP-1 row | SP-1 cost | SP-1 wall s | SP-1 words | SP-1 schema valid | this run cost (median) | this run output tokens (median) |
|---|---|---|---|---|---|---|---|
| wp-1 | 8 | $0.1445 | 83.1 | 3476 | yes / yes | $0.0922 | 6859 |
| wp-2 | 9 | $0.2573 | 119.7 | 3281 | no / yes (1 repair) | $0.1121 | 9200 |
| wp-3 | 25 | $0.1444 | 56.6 | 1603 | no / yes (1 repair) | $0.0303 | 2212 |

SP-1 mean per lesson including repairs: $0.182.
