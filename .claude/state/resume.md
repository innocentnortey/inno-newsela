# Resume checkpoint

Updated 2026-10-26 (VPS, Phase B, Sonnet; real-model results folded into the docs). Replace at each handoff; history in the [dev log](../../docs/devlog/README.md).

## Where we are
- **§8 Build:** every ticket that can run without Innocent is merged and pushed (main after GEN-6; GEN-7 CHG-6 reconcile built, awaiting review). Seam audit: [docs/plans/seam-audit-2026-10-26.md](../../docs/plans/seam-audit-2026-10-26.md), no blocking seam for the Compose demo; its Mediums are fixed (nav board link and heartbeat version id GEN-5, collab role recheck S-29 GEN-6, CHG-6 GEN-7). Still open there: Render needs a `NEXT_PUBLIC_COLLAB_URL` build arg (owned by the Render deploy session).
- **Gates ticked:** FW. **Not ticked:** 8 (waits on GEN-7 merge and the capacity A/B verdict), UX-5b (Innocent), 9 and 10 (need the paid real-model runs and Innocent).
- **Capacity:** `docs/delivery/capacity-report.md`. First run: reads met, stored p95 6.0 s MISSED. PD-38 (debounce 1 s / ceiling 2 s): stored p95 now 1,124 ms (met). The re-run's HTTP half degraded (lesson open p95 7.2 s, 4.3% SERVICE_BUSY) under heavy contention; an A/B/A check (old commit vs HEAD) decides regression vs contention; its section is appended to the report.
- **Real-model results (measured 2026-10-26, `docs/delivery/real-model-results.md`):** final NL-112 run after two prompt rounds: 30 of 47 lessons ready, 17 blocked with recorded reasons (15 `proper_noun_unsourced`, 2 `page_out_of_range`), 44 of 47 original drafts parse and compile (meets the 90% M-31 target), 19 of 47 needed no repair, 30 of 47 stored-ready. **Audit note 2026-10-26:** the 17 blocked were checker false positives per an offline replay (47/47 finals clean with the committed fixes d727537, 42f6989, 18a52cf; replay is not a fresh run, the stored 30/17 stands); a fresh measurement on the fixed candidate is pending. Source of truth: `docs/testing/error-analysis/astra-audit-2026-10-26.json`; handoff `docs/delivery/2026-10-26-astra-fix-handoff.md`. Not proven: reviewer minutes per approved lesson, lesson quality (no human sample), judge (disabled, uncalibrated), assist, seeded-error catch rate. $3.597, p50 36.3 s / p95 57.1 s per lesson, 347 s wall; the run before: 8 of 47, $4.19. S3 draft golden was 0 of 9 ($0.79) before the prompt fix and is not re-measured. Not measured: AI assist and judge on a real model, reviewer sessions, seeded errors, a human quality read; S3's 0/9 predates both prompt rounds. Session real spend about $9.8 of $20 authorised (plus a $0.03 probe).
- **Docs updated with those numbers:** demo script, interview prep, decision inventory, SUBMISSION, ARCHITECTURE, README, AI-USAGE, capability status (new Real model column), capacity report (still stub provider). Remaining `pending:` markers are NL-123, NL-134, NL-135, NL-132, NL-137, NL-138.

## Blocked on Innocent (exact action)
1. **NL-02:** confirm the Anthropic account limit is at least $75 (keys are set and probed 200/200 via `bin/with-provider-env --check`).
2. **Decide the spend for the fresh measurement on the fixed candidate** (about $10.2 of the $20 session authorisation is left; about $3.60 per full run). The name rule and page parsing are already fixed in code (d727537); a second repair round waits until false findings and missing repair evidence are shown not to be the cause. Also say yes or no to re-running the S3 golden after the fix (NL-109), and to spend for NL-128..130, NL-132, NL-134, NL-135. NL-112 ran; the final numbers still need your sign-off.
3. **Human tickets:** NL-122 (label ~30 judge pairs), NL-123 (measured review sessions), NL-124 (review seeded errors), NL-133 (UX-5b final acceptance: includes looking at the NEEDS_HUMAN_REVIEW screenshots and the look-sheet comparisons), NL-03 (voice key), NL-138 (record the video), NL-143 (submit on the portal).
4. **Decisions waiting:** PD-38 debounce (adopted under PD-32; revert if you prefer the 3 s target relaxed instead); PD-36 PRD wording ("7 ELD mismatches" vs computed 16 findings over 9 codes); S-23/S-27 ratifications; repo visibility for reviewers (private now; do not change without your call); NL-125 `no_silent_loss` fix option A was your choice and is merged.
5. **Render:** the deploy prompt is `docs/delivery/render-deploy-prompt.md`; the other session owns Render. Dockerfile.web runtime-data COPY fix landed on main (afa5ad8).

## Before the final deploy gate (NL-137)
One clean Compose run (`Dockerfile.node` /app/.demo and the `seed` profile), full suite, backup, tag. No docker builds happen on the VPS until that ticket (disk is tight: keep > 5 GB free; remove a ticket's worktree and kill its dev servers at merge, retro P-12).

## Human-only list (unchanged by the real runs)
UX-5b and gates 9 and 10 stay unticked. Nothing automated (the error analysis, the run reports, the QA walk) is recorded as Innocent's sign-off or as his reading of a generated lesson. The `FT-N` list needs his check.

## Next action for the next session
Merge GEN-7 after review; read the A/B verdict; tick gate 8 if the verdict shows no regression (else fix the named commit first); rerun `env -u GITLAB_TOKEN python3 ops/vps-run/checks/checkpoint_b.py --root . --out /tmp/ck.json` (the launcher's env token is revoked, so run it with `env -u GITLAB_TOKEN`); then stop at the human blockers above.

## Ticket dispositions after the 2026-10-26 audit (from the handoff table; none closed)
- **NL-112:** baseline-only; it may finish as a measured baseline only after its exact verification commands pass. Record the actual run history (attempts 1 to 3) and that later runs were not prospectively controlled experiments.
- **NL-109:** the suite exists; 0/9 is historical. Re-measure the final candidate; the 1.0 floor and all-repeat placeholder/link criteria cannot be claimed met by a failing report.
- **NL-120:** needs corrected facts (Audit note in `docs/delivery/error-analysis-real-run.md`), trace selection and first failures, an observed FT taxonomy, a model/version table, and recorded human review or the exact PD-32 fallback label.
- **NL-128..130 and NL-134:** need explicit changes, fixed comparison evidence, cost and keep/revert decisions; no invented experiment records for the earlier mixed prompt rounds.
- **NL-135:** stays open for the blind human review; the audit did not open the seed key.

Next action after the in-flight slices merge: handoff execution order step 3 onward (trusted repair context done in 42f6989; production structure contract, slot obligations and standards provenance with slice D), replay stored drafts to isolate each change, then the frozen S3 run and one whole-unit run on the fixed candidate. Correction work log: `docs/devlog/2026-10-26-astra-audit-corrections.md`.
