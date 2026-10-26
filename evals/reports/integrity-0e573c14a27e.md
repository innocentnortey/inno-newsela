# Eval report: integrity @ 0e573c14a27e

## Suite S5
- eval_run_id: ev_01M5V9QZD2E1GVFPS8VDFTQN81
- git_sha: 0e573c14a27e
- prompt_version: none (stub)
- models: {"generation":"claude-sonnet-5-5","repair":"claude-sonnet-5-5","assist":"claude-sonnet-5-5","provider_mode_note":"stub runs make no model call"}
- provider_mode: stub
- n: 20
- passed: 6/20
- cost_usd: 0

| case_id | result | source | failure_category |
|---|---|---|---|
| no_silent_loss#1 | fail | DO-5 S5 / WP-3 flex-day compiled draft (WP-1 Lesson 4 is flawed on purpose and can never be approved) | invariant_failed |
| no_silent_loss#2 | pass | DO-5 S5 / WP-3 flex-day compiled draft (WP-1 Lesson 4 is flawed on purpose and can never be approved) |  |
| no_silent_loss#3 | fail | DO-5 S5 / WP-3 flex-day compiled draft (WP-1 Lesson 4 is flawed on purpose and can never be approved) | invariant_failed |
| no_silent_loss#4 | fail | DO-5 S5 / WP-3 flex-day compiled draft (WP-1 Lesson 4 is flawed on purpose and can never be approved) | invariant_failed |
| no_silent_loss#5 | fail | DO-5 S5 / WP-3 flex-day compiled draft (WP-1 Lesson 4 is flawed on purpose and can never be approved) | invariant_failed |
| no_silent_loss#6 | fail | DO-5 S5 / WP-3 flex-day compiled draft (WP-1 Lesson 4 is flawed on purpose and can never be approved) | invariant_failed |
| no_silent_loss#7 | fail | DO-5 S5 / WP-3 flex-day compiled draft (WP-1 Lesson 4 is flawed on purpose and can never be approved) | invariant_failed |
| no_silent_loss#8 | fail | DO-5 S5 / WP-3 flex-day compiled draft (WP-1 Lesson 4 is flawed on purpose and can never be approved) | invariant_failed |
| no_silent_loss#9 | fail | DO-5 S5 / WP-3 flex-day compiled draft (WP-1 Lesson 4 is flawed on purpose and can never be approved) | invariant_failed |
| no_silent_loss#10 | pass | DO-5 S5 / WP-3 flex-day compiled draft (WP-1 Lesson 4 is flawed on purpose and can never be approved) |  |
| no_silent_loss#11 | pass | DO-5 S5 / WP-3 flex-day compiled draft (WP-1 Lesson 4 is flawed on purpose and can never be approved) |  |
| no_silent_loss#12 | pass | DO-5 S5 / WP-3 flex-day compiled draft (WP-1 Lesson 4 is flawed on purpose and can never be approved) |  |
| no_silent_loss#13 | fail | DO-5 S5 / WP-3 flex-day compiled draft (WP-1 Lesson 4 is flawed on purpose and can never be approved) | invariant_failed |
| no_silent_loss#14 | fail | DO-5 S5 / WP-3 flex-day compiled draft (WP-1 Lesson 4 is flawed on purpose and can never be approved) | invariant_failed |
| no_silent_loss#15 | fail | DO-5 S5 / WP-3 flex-day compiled draft (WP-1 Lesson 4 is flawed on purpose and can never be approved) | invariant_failed |
| no_silent_loss#16 | fail | DO-5 S5 / WP-3 flex-day compiled draft (WP-1 Lesson 4 is flawed on purpose and can never be approved) | invariant_failed |
| no_silent_loss#17 | fail | DO-5 S5 / WP-3 flex-day compiled draft (WP-1 Lesson 4 is flawed on purpose and can never be approved) | invariant_failed |
| no_silent_loss#18 | pass | DO-5 S5 / WP-3 flex-day compiled draft (WP-1 Lesson 4 is flawed on purpose and can never be approved) |  |
| no_silent_loss#19 | pass | DO-5 S5 / WP-3 flex-day compiled draft (WP-1 Lesson 4 is flawed on purpose and can never be approved) |  |
| no_silent_loss#20 | fail | DO-5 S5 / WP-3 flex-day compiled draft (WP-1 Lesson 4 is flawed on purpose and can never be approved) | invariant_failed |

### Integrity run notes

- contexts per trial: A reviewer editing, B second reviewer co-editing, C approver (three live browser contexts, real collaboration process, stub provider)
- git_sha: 0e573c14a27e
- model IDs: stub (no provider call)
- prompt version: none (stub)
- n (trials per assertion): no_silent_loss 6/20
- Store p95: not measured (no trial recorded a store latency)
- failing trials: no_silent_loss trial 1; no_silent_loss trial 3; no_silent_loss trial 4; no_silent_loss trial 5; no_silent_loss trial 6; no_silent_loss trial 7; no_silent_loss trial 8; no_silent_loss trial 9; no_silent_loss trial 13; no_silent_loss trial 14; no_silent_loss trial 15; no_silent_loss trial 16; no_silent_loss trial 17; no_silent_loss trial 20
  - no_silent_loss trial 1: {"submit_attempts":1,"boundary_tokens":1,"typed":19,"in_snapshot":12,"refused":6,"split":0,"union":18,"lost":["n01b07"],"lost_at_boundary":1,"error":"tokens in neither the snapshot nor the refused notice (typed 19, snapshot 12, refused 6, split 0)"}
  - no_silent_loss trial 3: {"submit_attempts":1,"boundary_tokens":1,"typed":18,"in_snapshot":10,"refused":6,"split":1,"union":17,"lost":["n03b06"],"lost_at_boundary":1,"error":"tokens in neither the snapshot nor the refused notice (typed 18, snapshot 10, refused 6, split 1)"}
  - no_silent_loss trial 4: {"submit_attempts":1,"boundary_tokens":1,"typed":18,"in_snapshot":10,"refused":6,"split":1,"union":17,"lost":["n04b06"],"lost_at_boundary":1,"error":"tokens in neither the snapshot nor the refused notice (typed 18, snapshot 10, refused 6, split 1)"}
  - no_silent_loss trial 5: {"submit_attempts":1,"boundary_tokens":1,"typed":18,"in_snapshot":11,"refused":6,"split":0,"union":17,"lost":["n05b06"],"lost_at_boundary":1,"error":"tokens in neither the snapshot nor the refused notice (typed 18, snapshot 11, refused 6, split 0)"}
  - no_silent_loss trial 6: {"submit_attempts":1,"boundary_tokens":1,"typed":18,"in_snapshot":10,"refused":6,"split":1,"union":17,"lost":["n06b06"],"lost_at_boundary":1,"error":"tokens in neither the snapshot nor the refused notice (typed 18, snapshot 10, refused 6, split 1)"}
  - no_silent_loss trial 7: {"submit_attempts":1,"boundary_tokens":1,"typed":18,"in_snapshot":10,"refused":6,"split":1,"union":17,"lost":["n07b06"],"lost_at_boundary":1,"error":"tokens in neither the snapshot nor the refused notice (typed 18, snapshot 10, refused 6, split 1)"}
  - no_silent_loss trial 8: {"submit_attempts":1,"boundary_tokens":1,"typed":18,"in_snapshot":10,"refused":6,"split":1,"union":17,"lost":["n08b06"],"lost_at_boundary":1,"error":"tokens in neither the snapshot nor the refused notice (typed 18, snapshot 10, refused 6, split 1)"}
  - no_silent_loss trial 9: {"submit_attempts":1,"boundary_tokens":1,"typed":18,"in_snapshot":11,"refused":6,"split":0,"union":17,"lost":["n09b06"],"lost_at_boundary":1,"error":"tokens in neither the snapshot nor the refused notice (typed 18, snapshot 11, refused 6, split 0)"}
  - no_silent_loss trial 13: {"submit_attempts":1,"boundary_tokens":1,"typed":18,"in_snapshot":10,"refused":6,"split":1,"union":17,"lost":["n13b06"],"lost_at_boundary":1,"error":"tokens in neither the snapshot nor the refused notice (typed 18, snapshot 10, refused 6, split 1)"}
  - no_silent_loss trial 14: {"submit_attempts":1,"boundary_tokens":1,"typed":18,"in_snapshot":10,"refused":6,"split":1,"union":17,"lost":["n14b06"],"lost_at_boundary":1,"error":"tokens in neither the snapshot nor the refused notice (typed 18, snapshot 10, refused 6, split 1)"}
  - no_silent_loss trial 15: {"submit_attempts":1,"boundary_tokens":1,"typed":18,"in_snapshot":10,"refused":6,"split":1,"union":17,"lost":["n15b06"],"lost_at_boundary":1,"error":"tokens in neither the snapshot nor the refused notice (typed 18, snapshot 10, refused 6, split 1)"}
  - no_silent_loss trial 16: {"submit_attempts":1,"boundary_tokens":1,"typed":18,"in_snapshot":10,"refused":6,"split":1,"union":17,"lost":["n16b06"],"lost_at_boundary":1,"error":"tokens in neither the snapshot nor the refused notice (typed 18, snapshot 10, refused 6, split 1)"}
  - no_silent_loss trial 17: {"submit_attempts":1,"boundary_tokens":1,"typed":18,"in_snapshot":10,"refused":6,"split":1,"union":17,"lost":["n17b06"],"lost_at_boundary":1,"error":"tokens in neither the snapshot nor the refused notice (typed 18, snapshot 10, refused 6, split 1)"}
  - no_silent_loss trial 20: {"submit_attempts":1,"boundary_tokens":1,"typed":18,"in_snapshot":10,"refused":6,"split":1,"union":17,"lost":["n20b06"],"lost_at_boundary":1,"error":"tokens in neither the snapshot nor the refused notice (typed 18, snapshot 10, refused 6, split 1)"}
