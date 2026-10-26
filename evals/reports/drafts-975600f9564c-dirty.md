# Eval report: drafts @ 975600f9564c-dirty

## Suite S3
- eval_run_id: ev_01M5W6X7V0SB8WH2K7A5B7AWAJ
- git_sha: 975600f9564c-dirty
- prompt_version: none (stub)
- models: {"generation":"claude-sonnet-5-5","repair":"claude-sonnet-5-5","assist":"claude-sonnet-5-5","provider_mode_note":"stub runs make no model call"}
- provider_mode: real
- n: 9
- passed: 0/9
- cost_usd: 0.791329

| case_id | result | source | failure_category |
|---|---|---|---|
| wp-1#1 | fail | WP-1 | FC-3 |
| wp-1#2 | fail | WP-1 | FC-3 |
| wp-1#3 | fail | WP-1 | FC-5 |
| wp-2#1 | fail | WP-2 | FC-6 |
| wp-2#2 | fail | WP-2 | FC-6 |
| wp-2#3 | fail | WP-2 | FC-3 |
| wp-3#1 | fail | WP-3 | FC-2 |
| wp-3#2 | fail | WP-3 | FC-3 |
| wp-3#3 | fail | WP-3 | FC-3 |

## Detail S3
- git_sha: 975600f9564c-dirty
- prompt_version: none (stub)
- served_models: [claude-sonnet-5-5]
- requested_models: [claude-sonnet-5-5]
- effort: low
- max_tokens: 32000 (retry 48000)
- n: 9 (3 cases x 3 repeats)
- provider_mode: real
- cost_total_usd: 0.791329   (S3 guard: estimated reservation $3.17 for 9 runs; limit $5.00 (min of --max-usd, PD-29 ceiling); PD-29 headroom not read (no total reader))
- M-31 first-pass schema-valid: 3/9 (repairs used: 8 of 9)

### wp-1 (WP-1)

| assertion | repeat 1 | repeat 2 | repeat 3 | FC |
|---|---|---|---|---|
| draft_stored | pass | pass | fail | FC-5 |
| required_blocks | fail | fail | fail | FC-3 |
| section_minutes | pass | pass | fail | FC-3 |
| placeholder_count | fail | pass | fail | FC-7 |
| no_quote_node | pass | pass | pass |  |
| origin_present | pass | pass | pass |  |
| taught_and_checked | pass | pass | fail | FC-5 |
| lesson_link_blocking | pass | pass | fail | FC-9 |

passes: 0/3, minutes_total [50, 50, none], placeholders [0, 2, 0], output tokens [7904..9974]
cost_usd: 0.370718
- repeat 1: first_failing_step: checks, FC-3 (repair recovered); required_blocks FC-3: missing 5: Learning in Action Part A:teacher_talk, Learning in Action Part A:text_evidence_needed, Learning in Action Part A:support_table, Learning in Action Part B:cfu_item, Learning in Action Part B:support_table; placeholder_count FC-7: 0 placeholders, expected exactly 2
- repeat 2: first_failing_step: checks, FC-3 (repair recovered); required_blocks FC-3: missing 5: Learning in Action Part A:teacher_talk, Learning in Action Part A:text_evidence_needed, Learning in Action Part A:support_table, Learning in Action Part B:cfu_item, Learning in Action Part B:support_table
- repeat 3: first_failing_step: draft, FC-5; draft_stored FC-5: run_state=generation_failed; check_failed: standard_not_checked; required_blocks FC-3: missing 14: Launch:routine_heading, Launch:teacher_talk, Launch:sample_response, Literacy Lab:routine_heading, Literacy Lab:cfu_item, Literacy Lab:support_table, Learning in Action Part A:teacher_talk, Learning in Action Part A:text_evidence_needed, Learning in Action Part A:support_table, Learning in Action Part B:cfu_item, Learning in Action Part B:support_table, Look Back:quick_write, Look Back:sample_response, Homework:homework; section_minutes FC-3: Launch absent; Literacy Lab absent; Learning in Action absent; Look Back absent; Homework absent; total none outside 50 +/- 5; placeholder_count FC-7: 0 placeholders, expected exactly 2; taught_and_checked FC-5: RL.6.1 no teaching part; RL.6.1 no Pulse Check; RL.6.2 no teaching part; RL.6.2 no Pulse Check; L.6.4.b no teaching part; L.6.4.b no Pulse Check; lesson_link_blocking FC-9: no lesson_link G6.U4.L4 -> G6.U4.L5

### wp-2 (WP-2)

| assertion | repeat 1 | repeat 2 | repeat 3 | FC |
|---|---|---|---|---|
| draft_stored | fail | fail | pass | FC-6 |
| required_blocks | fail | fail | fail | FC-3 |
| section_minutes | fail | fail | pass | FC-3 |
| placeholder_count | fail | fail | pass | FC-7 |
| no_quote_node | pass | pass | pass |  |
| origin_present | pass | pass | pass |  |
| taught_and_checked | fail | fail | pass | FC-5 |
| lesson_link_blocking | pass | pass | pass |  |

passes: 0/3, minutes_total [none, none, 50], placeholders [0, 0, 1], output tokens [4326..7986]
cost_usd: 0.274801
- repeat 1: first_failing_step: draft, FC-6; draft_stored FC-6: run_state=generation_failed; check_failed: quote_unmatched; required_blocks FC-3: missing 10: Launch:teacher_talk, Launch:sample_response, Literacy Lab:cfu_item, Literacy Lab:support_table, Learning in Action Part A:excerpt_slot, Learning in Action Part A:support_table, Learning in Action Part B:cfu_item, Learning in Action Part B:support_table, Look Back:quick_write, Homework:homework; section_minutes FC-3: Launch absent; Literacy Lab absent; Learning in Action absent; Look Back absent; Homework absent; total none outside 50 +/- 5; placeholder_count FC-7: 0 placeholders, expected exactly 1; taught_and_checked FC-5: W.6.2.a no teaching part; W.6.2.a no Pulse Check; W.6.2.b no teaching part; W.6.2.b no Pulse Check; W.6.2.f no teaching part; W.6.2.f no Pulse Check
- repeat 2: first_failing_step: draft, FC-6; draft_stored FC-6: run_state=generation_failed; check_failed: quote_unmatched; required_blocks FC-3: missing 10: Launch:teacher_talk, Launch:sample_response, Literacy Lab:cfu_item, Literacy Lab:support_table, Learning in Action Part A:excerpt_slot, Learning in Action Part A:support_table, Learning in Action Part B:cfu_item, Learning in Action Part B:support_table, Look Back:quick_write, Homework:homework; section_minutes FC-3: Launch absent; Literacy Lab absent; Learning in Action absent; Look Back absent; Homework absent; total none outside 50 +/- 5; placeholder_count FC-7: 0 placeholders, expected exactly 1; taught_and_checked FC-5: W.6.2.a no teaching part; W.6.2.a no Pulse Check; W.6.2.b no teaching part; W.6.2.b no Pulse Check; W.6.2.f no teaching part; W.6.2.f no Pulse Check
- repeat 3: first_failing_step: none, FC-3; required_blocks FC-3: missing 4: Learning in Action Part A:excerpt_slot, Learning in Action Part A:support_table, Learning in Action Part B:cfu_item, Learning in Action Part B:support_table

### wp-3 (WP-3)

| assertion | repeat 1 | repeat 2 | repeat 3 | FC |
|---|---|---|---|---|
| draft_stored | fail | fail | fail | FC-2 |
| required_blocks | fail | fail | fail | FC-3 |
| section_minutes | fail | fail | fail | FC-3 |
| placeholder_count | pass | pass | pass |  |
| no_quote_node | pass | pass | pass |  |
| origin_present | pass | pass | pass |  |
| taught_and_checked | pass | pass | pass |  |
| lesson_link_blocking | pass | pass | pass |  |

passes: 0/3, minutes_total [none, none, none], placeholders [0, 0, 0], output tokens [3242..4479]
cost_usd: 0.145810
- repeat 1: first_failing_step: draft, FC-2; draft_stored FC-2: run_state=generation_failed; schema_invalid; required_blocks FC-3: missing 6: Launch:teacher_talk, Launch:sample_response, Learning in Action:teacher_tip, Learning in Action:routine_heading, Learning in Action:cfu_item, Look Back:quick_write; section_minutes FC-3: Launch absent; Learning in Action absent; Look Back absent; total none outside 50 +/- 5
- repeat 2: first_failing_step: draft, FC-3; draft_stored FC-3: run_state=generation_failed; check_failed: section_missing; required_blocks FC-3: missing 6: Launch:teacher_talk, Launch:sample_response, Learning in Action:teacher_tip, Learning in Action:routine_heading, Learning in Action:cfu_item, Look Back:quick_write; section_minutes FC-3: Launch absent; Learning in Action absent; Look Back absent; total none outside 50 +/- 5
- repeat 3: first_failing_step: draft, FC-3; draft_stored FC-3: run_state=generation_failed; check_failed: section_missing; required_blocks FC-3: missing 6: Launch:teacher_talk, Launch:sample_response, Learning in Action:teacher_tip, Learning in Action:routine_heading, Learning in Action:cfu_item, Look Back:quick_write; section_minutes FC-3: Launch absent; Learning in Action absent; Look Back absent; total none outside 50 +/- 5

### Compared with SP-1

| case | SP-1 row | SP-1 cost | SP-1 wall s | SP-1 words | SP-1 schema valid | this run cost (median) | this run output tokens (median) |
|---|---|---|---|---|---|---|---|
| wp-1 | 8 | $0.1445 | 83.1 | 3476 | yes / yes | $0.1282 | 9679 |
| wp-2 | 9 | $0.2573 | 119.7 | 3281 | no / yes (1 repair) | $0.1064 | 7960 |
| wp-3 | 25 | $0.1444 | 56.6 | 1603 | no / yes (1 repair) | $0.0454 | 3423 |

SP-1 mean per lesson including repairs: $0.182.
