# Final status, 2026-10-26 (wrap-up after the Astra audit fixes)

Written at main `05ff31f`. Honest and short: what changed, what was checked, what was not, and what only Innocent can do. No GitLab issue was closed. Nothing here is a measurement of the final candidate with a real model: none was run.

## 1. What changed since the original Astra handoff, and where

Handoff: [`2026-10-26-astra-fix-handoff.md`](2026-10-26-astra-fix-handoff.md). Range `git log --oneline e7e72a3..HEAD` (about 33 commits). Grouped by slice:

| Slice | Commits | What |
|---|---|---|
| A | d727537, 6cc5e07 | Checker/compiler parity and source trust (proper-noun and page-range false positives); invented name first after an option label is still flagged |
| B | 18a52cf | Stage-by-stage full-run and S3 reports pinned to the run's own versions |
| C | 42f6989 | Repair request carries the pinned generation context and parseable matched findings |
| D | f236214, 99b8e77, 88d6b97, f3aa33f, 45a2a63 | Canonical Part A/B contract, per-code standard tags and evidence rules; missing excerpt slot is blocking; front matter records narrowed/added codes; PD-39 rulings (45a2a63); area map and devlog (f3aa33f) |
| F1 | e8a7f27, a554848, 7f6efd3 | One production owner of sections, parts, required roles and minutes; contract matrix CM-1..CM-6; stub drafts meet the production template |
| F2 | 7c5e87d, 21ba5ad, 8ed5e83 | One standards-evidence reader and identity mapping, no empty-catalogue hole; prompt offers sub-codes, allows narrowing, Quick Write counts as a check; S2 setup |
| F3 | c0e12f6, bbe2bf2, 30d5f74, 400be71, 70df16b | Real lifecycle boundary tests with independent oracles; queue/version compatibility inventory and runbook; isolated real-stack e2e runner; M-41 source count |
| F3 fixes | 47549fe, 14a5a7a | `alignment_link` keyed on role (migration 0016), submit gate reads dependencies, background check writes its own alignment first; pin-aware job claim |
| F4 | 97b7b1d, 902ba67 | Trustworthy offline replay tool (pinned identity, enforced read-only, provenance, both denominators); per-commit re-run and correction |
| Template | 62f372f | Learning in Action heading not required; parts for Reading and Writing only; Flex Launch `sample_response` in the prompt |
| Review follow-ups | 3bbe94f | Judge pair dedupe, CM-5 row, name-scan limit note, self-contained V3 tests |
| Runner | 05ff31f | e2e runner folder filter ends with a slash (con-1 no longer matches con-10..19) |
| Other | e6e0900 NL-120, 3dcb1b0 | Error-analysis round (PD-32 fallback); section_missing analysis after F1 |

Replay artefacts: [`docs/testing/error-analysis/replay-2026-10-26-final/`](../testing/error-analysis/replay-2026-10-26-final/README.md).

## 2. Verified behaviour

- **Full vitest at 3bbe94f:** 569 of 572 files pass, 4130 tests pass. Two load-timeout failures that pass in isolation: `generation.int` restart_reuses_checkpoint and `metrics.int` sessions_match_script. (No full run at 05ff31f; that commit touches only the e2e runner filter.)
- **Lifecycle tests:** 23 of 23, three times.
- **Independent reviews:** A re-review PASS WITH FINDINGS; B PASS WITH FINDINGS; C PASS WITH FINDINGS; F1+F2 PASS WITH FINDINGS; F3 fixes PASS WITH FINDINGS. D's initial review FAILED on S6; fixed in 45a2a63 and 7f6efd3. The findings were folded in by 3bbe94f where they were code; none of the later commits was re-reviewed.

## 3. Stage-specific results (with denominators)

- **Attempt 3, as recorded (real model, old prompt):** 44 of 47 originals parse and compile; 19 of 47 needed no repair; 30 of 47 stored ready; 17 blocked; 20 open slots in 16 lessons.
- **Offline replay of those OLD drafts under the current code:** 1 of 47 passes the generation gate (L7). This is reanalysis of drafts written under an older prompt. It is not a forecast and not the run's metric: the obligations (teaching tags, Part A/B, Flex roles, standards evidence) were added by A, D, F1 and F2, and the old prompt never asked for them. Peak: 47 of 47 final after slice A alone. Per-step table: the replay report.
- **Production defects found and fixed this session:** `alignment_link` duplicate key killing real background checks; submit gate dependencies; advisory order; claim SQL pin; bogus tag on the empty-focus row hole; invented name first after a label (regression); judge duplicate pairs.

## 4. Costs

Real-model spend this session about $10.1 of the authorised $20: run 2 $4.19, run 3 $3.60, S3 x3 $0.79 (before the fixes), repair sample $1.22, probes about $0.03.

The paid agent that was stopped made no report. Check done at wrap-up (read-only): `model_call` in `ls_nl112_dev` (95 calls, $4.19, last 13:39 UTC) and `ls_nl112c` (76 calls, $3.60, last 14:00 UTC) has no call after 17:00 UTC, and the 94 temporary test databases have none either. `ls_astra_s3` and `ls_eval_s3` refused the read (permission denied), so for those two, and for any spend outside the project databases, the claim "nothing was spent after 17:00 UTC" is **unverified**; the provider dashboard is the authority.

## 5. Not done, and why

The user asked to wrap up, so there is **no paid measurement of the final candidate**.

- **S3 x3:** `/home/linuxuser/workspaces/bin/with-provider-env -- npm run eval:golden -- --suite drafts --repeat 3 --provider real --max-usd 3` against a fresh migrated database.
- **One whole-unit run:** `evals/src/full-run-main.ts` with `--max-usd 5`, per [`docs/devlog/2026-10-26-nl112-full-run-3.md`](../devlog/2026-10-26-nl112-full-run-3.md).
- **NL-134 rerun rule fires:** the prompt version changed (locked hash `f1d29f98868a...`). Expected first-pass impact is unknown until the run.
- **Isolated real-stack run (`ops/e2e-real-stack.sh`)** was started once, found a folder-filter bug (con-1 matched con-10..19), fixed in 05ff31f, and was **not re-run**. Earlier non-isolated evidence is not evidence for the final commit: serial run at f3aa33f-era code, con-2 40 and con-9 63 pass; con-17 and con-6 failures traced to harness env (`E2E_COLLAB_INTERNAL_URL`) and a con-6 first-poll gap whose cause is unresolved (diagnostic added in d56d7e2). Mock Playwright at an earlier commit: 781 passed, 5 failed (flakes), 2 skipped.

## 6. Remaining limitations and human decisions

- `skill_unpractised` counts only role P as practice: open product decision.
- Adding standards to an empty-list row is not solicited: deferred.
- `page_out_of_range` checker strictness; Length/Preference/Describes and Hunter/Storm/Hope residual names; lowercase-use clearing; a second repair round versus looser rules.
- **Deploy notes:** migrate 0016 before worker and collab. The new locked hash means queued old-pin jobs stay queued under the pin-aware claim: run the `ops/queue-compat.ts` inventory and follow [`2026-10-26-locked-prompt-worker-replacement-runbook.md`](2026-10-26-locked-prompt-worker-replacement-runbook.md); drain before the swap.

## 7. Still unproven

Reviewer minutes per approved lesson; lesson quality (no human sample); the judge (disabled, uncalibrated); AI assist quality; seeded-error catch rate (NL-135 needs the blind human review).

## 8. Human-only items

NL-02, NL-03, NL-122, NL-123, NL-124, NL-133 (UX-5b), NL-138 video, NL-143 portal submission; Render provisioning (no live URL known); repo visibility; PD-36 and PD-38 decisions.

## 9. Ticket dispositions (per the handoff's "Ticket disposition" table; none closed)

| Ticket | Disposition | Evidence |
|---|---|---|
| NL-112 | Baseline only | Its own verify commands still need running before it closes |
| NL-109 | Re-measure on the final candidate pending | S3 0/9 is historical; no new run |
| NL-120 | Facts reconciled; treat as pending review | The PD-32 fallback line was recorded early; it needs Innocent's review or a genuine fallback event |
| NL-128..130, NL-134 | No experiment evidence | NL-128's proposal duplicated an instruction already in the prompt |
| NL-135 | Open | Needs the blind human review |
