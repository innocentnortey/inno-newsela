# Resume checkpoint

Updated 2026-10-26 (VPS, Phase B, Sonnet; real-model results folded into the docs). Replace at each handoff; history in the [dev log](../../docs/devlog/README.md).

## Where we are
- **§8 Build:** every ticket that can run without Innocent is merged and pushed (main after GEN-6; GEN-7 CHG-6 reconcile built, awaiting review). Seam audit: [docs/plans/seam-audit-2026-10-26.md](../../docs/plans/seam-audit-2026-10-26.md), no blocking seam for the Compose demo; its Mediums are fixed (nav board link and heartbeat version id GEN-5, collab role recheck S-29 GEN-6, CHG-6 GEN-7). Still open there: Render needs a `NEXT_PUBLIC_COLLAB_URL` build arg (owned by the Render deploy session).
- **Gates ticked:** FW. **Not ticked:** 8 (waits on GEN-7 merge and the capacity A/B verdict), UX-5b (Innocent), 9 and 10 (need the paid real-model runs and Innocent).
- **Capacity:** `docs/delivery/capacity-report.md`. First run: reads met, stored p95 6.0 s MISSED. PD-38 (debounce 1 s / ceiling 2 s): stored p95 now 1,124 ms (met). The re-run's HTTP half degraded (lesson open p95 7.2 s, 4.3% SERVICE_BUSY) under heavy contention; an A/B/A check (old commit vs HEAD) decides regression vs contention; its section is appended to the report.
- **Real-model results (measured 2026-10-26, `docs/delivery/real-model-results.md`):** final NL-112 run after two prompt rounds: 30 of 47 lessons ready, 17 blocked with recorded reasons (15 `proper_noun_unsourced`, 2 `page_out_of_range`), 19 of 47 clean first pass. **The 90% first-pass target is NOT met** (40%). $3.597, p50 36.3 s / p95 57.1 s per lesson, 347 s wall; the run before: 8 of 47, $4.19. S3 draft golden was 0 of 9 ($0.79) before the prompt fix and is not re-measured. Not measured: AI assist and judge on a real model, reviewer sessions, seeded errors, a human quality read. Session real spend about $9.8 of $20 authorised (plus a $0.03 probe).
- **Docs updated with those numbers:** demo script, interview prep, decision inventory, SUBMISSION, ARCHITECTURE, README, AI-USAGE, capability status (new Real model column), capacity report (still stub provider). Remaining `pending:` markers are NL-123, NL-134, NL-135, NL-132, NL-137, NL-138.

## Blocked on Innocent (exact action)
1. **NL-02:** confirm the Anthropic account limit is at least $75 (keys are set and probed 200/200 via `bin/with-provider-env --check`).
2. **Decide the next real-model move** (about $10.2 of the $20 session authorisation is left): a second repair round, a looser name rule, or checker page parsing (the two `page_out_of_range` cases may be a checker that is too strict). Each needs a code or prompt ticket and a re-run (about $3.60 per full run). Also say yes or no to re-running the S3 golden after the fix (NL-109), and to spend for NL-128..130, NL-132, NL-134, NL-135. NL-112 ran; the final numbers still need your sign-off.
3. **Human tickets:** NL-122 (label ~30 judge pairs), NL-123 (measured review sessions), NL-124 (review seeded errors), NL-133 (UX-5b final acceptance: includes looking at the NEEDS_HUMAN_REVIEW screenshots and the look-sheet comparisons), NL-03 (voice key), NL-138 (record the video), NL-143 (submit on the portal).
4. **Decisions waiting:** PD-38 debounce (adopted under PD-32; revert if you prefer the 3 s target relaxed instead); PD-36 PRD wording ("7 ELD mismatches" vs computed 16 findings over 9 codes); S-23/S-27 ratifications; repo visibility for reviewers (private now; do not change without your call); NL-125 `no_silent_loss` fix option A was your choice and is merged.
5. **Render:** the deploy prompt is `docs/delivery/render-deploy-prompt.md`; the other session owns Render. Dockerfile.web runtime-data COPY fix landed on main (afa5ad8).

## Before the final deploy gate (NL-137)
One clean Compose run (`Dockerfile.node` /app/.demo and the `seed` profile), full suite, backup, tag. No docker builds happen on the VPS until that ticket (disk is tight: keep > 5 GB free; remove a ticket's worktree and kill its dev servers at merge, retro P-12).

## Human-only list (unchanged by the real runs)
UX-5b and gates 9 and 10 stay unticked. Nothing automated (the error analysis, the run reports, the QA walk) is recorded as Innocent's sign-off or as his reading of a generated lesson. The `FT-N` list needs his check.

## Next action for the next session
Merge GEN-7 after review; read the A/B verdict; tick gate 8 if the verdict shows no regression (else fix the named commit first); rerun `env -u GITLAB_TOKEN python3 ops/vps-run/checks/checkpoint_b.py --root . --out /tmp/ck.json` (the launcher's env token is revoked, so run it with `env -u GITLAB_TOKEN`); then stop at the human blockers above.
