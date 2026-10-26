# Real-model results (2026-10-26)

Synthetic data only. Model for every call: `claude-sonnet-5-5`, requested and served. This is the one place that says what was
run on a real model, what it measured, and what it did not. Numbers come from the reports named in each row; nothing here is
estimated.

## What was run

| Run | What | Report |
|---|---|---|
| NL-112 attempt 1 | Full unit G6-U4; the unit-plan call was rejected (HTTP 400, schema min/max), 0 lessons generated, $0.00 | `evals/reports/full-run-run_01M5W5PRXXMY4BA3VZQ8EVQ7TV.md`, devlog `docs/devlog/2026-10-26-nl112-full-run.md`; not used for any claim |
| NL-112 attempt 2 | Full unit, before any prompt fix | `evals/reports/full-run-run_01M5W6JK5XJQ7VE0WMR7HR1Z11.md` |
| Error analysis (NL-120) | Replay of attempt 2's stored drafts through the checks, then an 8-lesson re-run after prompt round 1 | `docs/delivery/error-analysis-real-run.md` |
| NL-112 attempt 3 (final) | Full unit after two prompt rounds | `evals/reports/full-run-run_01M5W7VQFD6AEVPMPZA2Z4S9ZK.md`, devlog `docs/devlog/2026-10-26-nl112-full-run-3.md` |
| NL-109 (S3 draft golden) | 9 golden cases, run before the prompt fix | `evals/reports/drafts-975600f9564c-dirty.md` |

## The numbers

| Measure | Attempt 2 (before fixes) | Attempt 3 (final, n = 47, one run) |
|---|---|---|
| Lessons ready (passed every blocking check, round trip ok) | 8 of 47 (17%) | **30 of 47 (64%)** |
| Lessons blocked with a recorded reason | 39 | **17** |
| Clean first pass (no repair needed) | 0 of 47 (every first draft schema-invalid) | **19 of 47 (40%)** |
| Repairs used | 47 | 28 (11 became ready, 17 stayed blocked) |
| First failing check on the blocked lessons | `standard_not_checked` 23, `section_missing` 6, others | `proper_noun_unsourced` 15, `page_out_of_range` 2 |
| Round-trip hash on ready lessons | 8 of 8 | 30 of 30 |
| Placeholders / open disclosure prompts / median confirmations | 0 / 0 / 0 | 0 / 0 / 0 |
| Model spend for the run | $4.19 | **$3.60** (cap $6.00; max $0.137 per lesson) |
| Time per lesson job | p95 0.97 min | **p50 36.3 s, p95 57.1 s** |
| Wall time for the whole unit | 474 s | **347 s** |
| Provider retries, truncations, lost calls | n/a | 0 / 0 / 0 (76 calls: 1 plan, 47 drafts, 28 repairs) |

Failure counts are the first failing check stored on each blocked job (the job keeps one). The replay in the error analysis
shows attempt 2 had more hidden findings per lesson, so the attempt 2 column undercounts its causes.

Other real-model measurements: the S3 draft golden passed **0 of 9** at $0.79. It was taken before the prompt fix and has
**not been re-measured**; do not read it as the current state. An 8-lesson sample after prompt round 1 went from 0 of 8 ready
to 3 of 8 (about $1.22).

Real spend this session: about $9.8 of the $20 authorised, plus a $0.03 probe.

## What the numbers say

- After two prompt rounds, 30 of 47 lessons are ready on the issued unit; 17 are blocked with recorded reasons.
- The **90% first-pass target is not met**: 40% were clean on the first pass, 64% ready after one repair.
- Blocked lessons are held, not shipped: the checks stopped them. The remaining cause is the name check (15 lessons) and the
  page/chapter check (2 lessons).
- Rounds 1 and 2 removed `standard_not_checked`, `section_missing`, `minutes_out_of_range` and `quote_unmatched` as causes of
  blocking in the final run.

## What is not measured

- **AI assist** (SCR-13) and the **alignment judge** have not been run on a real model. The judge was disabled in the full run
  (`MODEL_JUDGE_ID` unset); no calibration exists (NL-122 labels, NL-132).
- **S3 after the fix**: not re-measured (0 of 9 predates it).
- **Seeded-error catch rate** (NL-124, NL-135) and **reviewer minutes** (NL-123): not run.
- **Quality of a ready lesson as a teacher would judge it**: no human read. Ready means every code check passed.
- **Capacity** was measured with the **stub provider**. The real run's latency above is a single sequential-fan-out run, not a
  load test; no real-model generation ran under the 200-user load.
- Single run, n = 47, one unit, one model; no variance estimate. A re-run can differ.
- The `-dirty` git sha in the reports means other sessions shared the tree; the prompt version is recorded in the run row.
- Experiments (NL-128..130, NL-134) were not scored as `XP-N` on a frozen set. The two prompt rounds were fixes driven by the
  error analysis, not scored experiments, and no `FT-N` taxonomy was signed by Innocent.

## Decisions for Innocent

The two `page_out_of_range` cases, and most of the 15 name failures, are the next layer. Three options, none taken:

1. **A second repair round.** Allow the model one more try on the name and page findings. Costs more per blocked lesson (a
   repair averaged about $0.044 per call in the final run) and does not change what the checker accepts. Tradeoff: more lessons ready, but the
   repair limit is a design decision (currently 1).
2. **A looser name rule.** Stop flagging names that are places, organizations or well-known figures, or accept names from the
   model's own knowledge with a reviewer note. Tradeoff: fewer false blocks, but the rule exists so that no invented name
   reaches a reviewer unmarked; loosening it moves that burden to people.
3. **Checker page parsing.** Read page ranges like `pp. 224 ("A few minutes later,...")-233` correctly and stop treating a
   title such as "Chapter 4" as a chapter range source. This fixes the two cases the error analysis calls checker-too-strict
   (G6.U4.L21, G6.U4.L11 in attempt 2). Tradeoff: a code change to the checker, so a build-loop ticket.

These can be combined. No recommendation is recorded as decided.

**Decision needed:** Which of a second repair round, a looser name rule, or checker page parsing (or none) should the next
round use?

## Ticket evidence (documents only; no GitLab issue was closed)

| Ticket | Evidence now in the repo | Still missing |
|---|---|---|
| NL-112 full run | Attempts 2 and 3 above; devlogs `2026-10-26-nl112-full-run-2.md` and `-3.md` | 90% target not met; final-numbers sign-off is Innocent's |
| NL-120 error analysis | `docs/delivery/error-analysis-real-run.md` (47 traces replayed, causes counted, fixes listed) | `FT-N` taxonomy and Innocent's check |
| NL-134 experiment scoring | None beyond the prompt rounds above | Scored `XP-N` runs on the frozen set |
| NL-135 seeded-error report | None | Needs NL-124 reviews of planted errors |
| NL-109 S3 golden | Run once, 0 of 9, pre-fix | A re-run after the prompt fix |
