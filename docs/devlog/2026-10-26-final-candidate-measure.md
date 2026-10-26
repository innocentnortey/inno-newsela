# NL-109 / NL-112 / NL-134: paid measurement of the final candidate (ed7a073), 2026-10-26

DRAFT. Not committed anywhere (the repo had to stay untouched while the isolated e2e ran). Run from a throwaway worktree at ed7a073.

## What was run (one pass, nothing retried to improve a number)
- S3 drafts x3 on the real model: `eval:golden --suite drafts --repeat 3 --provider real --max-usd 3.2`. The first start with `--max-usd 3` was refused by the cost guard (estimate $3.17 > $3.00, no call made). The limit was raised to 3.2 for the guard only. A second start was killed by my own 15-minute tool timeout (exit 137, no report; one draft call stayed `sent` for 11 minutes) and was restarted once as a background job: infrastructure interruption, not a result. Only the last start is reported.
- One whole-unit G6-U4 run (47 lessons), `--cap-usd 5` (the task said `--max-usd 5`; the driver flag is `--cap-usd`): web in `MODEL_PROVIDER_MODE=stub`, worker real under `with-provider-env`, `MODEL_JUDGE_ID` unset, new database, ports 35201/35202/35203.

## Rerun-rule evidence (NL-134)
| | run 3 (`run_01M5W7VQFD6AEVPMPZA2Z4S9ZK`) | this run (`run_01M5WV0E6SPZ1SZE244Q8YR95S`) |
|---|---|---|
| code sha | 64fe0e9 (dirty) | ed7a073 |
| prompt_version | `pr_01M5W7TNXN3RW5HBTC37H9SSPN` (no. 1) | `pr_01M5WTKTZ18CGJWEAYYNWQSY5S` (no. 1) |
| locked hash | c8fb93065d88... | f1d29f98868a... |
| model | claude-sonnet-5-5 requested and served, all purposes | same |
| schema | `packages/schema/src/lesson-draft.ts` | changed since 64fe0e9 (schema and prompt paths: 12 files, +423/-35) |
| checks | structural/template rules rewritten | changed since 64fe0e9 (63 files in the checks, prompts, schema paths) |
The prompt version changed, so the rerun rule fired; numbers below are NOT comparable like for like with run 3 (different prompt, schema and checks).

## S3 (n = 9, real model, cost $0.7457, 19 of 19 calls completed)
Pass 3/9. See `drafts-ed7a073ee78f.md`. M-31 initial draft parses and compiles 9/9, repairs used 1 of 9.

## Whole unit (n = 47)
The run ended `capped` (run_cap) at settled spend $3.385, not $5: every draft reserves about $0.34 at worst case, six run at once, so the reservation held the cap before the money was spent. 9 lessons (FLEX-2b, FLEX-3a, FLEX-3b, L36..L41) never started: 8 cancelled plus 1 failed, all reason `capped`. 38 lessons were drafted. Denominators are therefore 47 (as the report prints) and 38 drafted.

| | run 3 (old prompt) | this run |
|---|---|---|
| initial draft parses and compiles | 44/47 | 37/47 (37/38 drafted; 9 never drafted) |
| ready with no repair | 19/47 | 28/47 (28/38 drafted) |
| stored ready | 30/47 | 37/47 (37/38 drafted) |
| repairs attempted / recovered | 28 / 11 | 10 / 9 |
| failed | 17 (15 name check) | 10: 9 capped, 1 content (L19, name check after schema-invalid first draft) |
| cost (stored `model_call` sum) | $3.597 | $3.385 (drafts 2.613, repairs 0.537, plan 0.235) |
| lesson time p50 / p95 | 36.3 s / 57.1 s | 44.3 s / 65.1 s (39 lessons with a start time) |
| calls | 76 | 49 (1 plan, 38 drafts, 10 repairs) |
| tokens in / out / cache read | 344,252 / 280,624 / 212,285 | 310,888 / 272,296 / 203,519 |
Round trip 37/37. Threshold `first_pass_schema_valid_rate_ge_0.90`: FAIL (0.787 of 47; 37/38 = 0.974 of those drafted). Open slots 40 (25 quote_placeholder, 15 excerpt_slot) in 27 lessons: these are the human-fill slots, not defects.

## Initial-draft findings (the repair requests, 10 lessons)
minutes_out_of_range x4 (L1 32/30, L28 34/30, FLEX-2a 42/40, L35 33/30), proper_noun_unsourced x5 (L1 "Opinions", L2, L12, FLEX-1b, L35 "Length"), section_missing x2 (L2 excerpt slot, L30 support_table), standard_not_taught + standard_not_checked (L22, RL.6.9.a), schema_invalid blocks.standard_codes (L19). Full text: `repair_findings.txt`.

## New checks, one honest read
- Teaching tags: 1 lesson (L22, RL.6.9.a, `standard_not_taught`): true positive; the repair fixed it.
- Standards evidence: same lesson, `standard_not_checked`: true positive, same cause, fixed by the repair.
- Part A/B: L2 missing excerpt slot, L30 missing support_table: true positives, fixed by repair; 1 lesson each of 38.
- Flex roles: 0 failures in the 3 Flex lessons that were drafted (FLEX-1a, 1b, 2a); the other three Flex lessons were capped, so this is not tested.
- Name check "Length"/"Opinions" (5 of 10 repairs): checker false positives (capitalised label words, the known residual in the final status note); the repair removed them at about $0.05 each.
- Open question: L19's final name finding is not stored beyond the kind, so true or false positive cannot be said.

## Spend
Stored-row sums: S3 $0.7457 + killed S3 attempt $0.2505 ($0.2360 stored in the eval database, $0.0145 in its leftover world database) + whole unit $3.3854 = $4.38, plus at most about $0.10 for one hung draft call that never recorded. Session total about $14.5 of $20.
