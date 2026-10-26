# Eval report: integrity @ 988d2cd73a6a

## Suite S5
- eval_run_id: ev_01M5V74048BRT8VFGHN80NGJ11
- git_sha: 988d2cd73a6a
- prompt_version: none (stub)
- models: {"generation":"claude-sonnet-5-5","repair":"claude-sonnet-5-5","assist":"claude-sonnet-5-5","provider_mode_note":"stub runs make no model call"}
- provider_mode: stub
- n: 20
- passed: 19/20
- cost_usd: 0

| case_id | result | source | failure_category |
|---|---|---|---|
| zero_edits_after_lock#1 | pass | DO-5 S5 / WP-1 Lesson 4 stub |  |
| zero_edits_after_lock#2 | pass | DO-5 S5 / WP-1 Lesson 4 stub |  |
| zero_edits_after_lock#3 | pass | DO-5 S5 / WP-1 Lesson 4 stub |  |
| zero_edits_after_lock#4 | pass | DO-5 S5 / WP-1 Lesson 4 stub |  |
| zero_edits_after_lock#5 | pass | DO-5 S5 / WP-1 Lesson 4 stub |  |
| zero_edits_after_lock#6 | pass | DO-5 S5 / WP-1 Lesson 4 stub |  |
| zero_edits_after_lock#7 | pass | DO-5 S5 / WP-1 Lesson 4 stub |  |
| zero_edits_after_lock#8 | pass | DO-5 S5 / WP-1 Lesson 4 stub |  |
| zero_edits_after_lock#9 | pass | DO-5 S5 / WP-1 Lesson 4 stub |  |
| zero_edits_after_lock#10 | fail | DO-5 S5 / WP-1 Lesson 4 stub | invariant_failed |
| zero_edits_after_lock#11 | pass | DO-5 S5 / WP-1 Lesson 4 stub |  |
| zero_edits_after_lock#12 | pass | DO-5 S5 / WP-1 Lesson 4 stub |  |
| zero_edits_after_lock#13 | pass | DO-5 S5 / WP-1 Lesson 4 stub |  |
| zero_edits_after_lock#14 | pass | DO-5 S5 / WP-1 Lesson 4 stub |  |
| zero_edits_after_lock#15 | pass | DO-5 S5 / WP-1 Lesson 4 stub |  |
| zero_edits_after_lock#16 | pass | DO-5 S5 / WP-1 Lesson 4 stub |  |
| zero_edits_after_lock#17 | pass | DO-5 S5 / WP-1 Lesson 4 stub |  |
| zero_edits_after_lock#18 | pass | DO-5 S5 / WP-1 Lesson 4 stub |  |
| zero_edits_after_lock#19 | pass | DO-5 S5 / WP-1 Lesson 4 stub |  |
| zero_edits_after_lock#20 | pass | DO-5 S5 / WP-1 Lesson 4 stub |  |

### Integrity run notes

- contexts per trial: A reviewer editing, B second reviewer co-editing, C approver (three live browser contexts, real collaboration process, stub provider)
- git_sha: 988d2cd73a6a
- model IDs: stub (no provider call)
- prompt version: none (stub)
- n (trials per assertion): zero_edits_after_lock 19/20
- Store p95: 648 ms raw, 148 ms net of the 500 ms collab debounce (n=20); target <= 500 ms [A] -> SP-2: MET
- failing trials: zero_edits_after_lock trial 10
  - zero_edits_after_lock trial 10: {"error":"lesson_doc rows after the lock"}
