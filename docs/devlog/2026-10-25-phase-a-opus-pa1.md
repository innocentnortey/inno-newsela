# 2026-10-25 — Phase A (Opus): contracts, spikes, design, ticketing

Project: Newsela Lesson Studio · Writer: Claude (Opus 5.5, main session) · Host: VPS · `main`. Started by the
`ops/vps-run` launcher (Phase A, run 1). Subagent results are reported here by the main session only.

## Orientation

- **Changed:** nothing; read the checklist, the Phase A checkpoint (41 failing at start) and the pinned workflow.
- **Why:** the checkpoint is the mechanical bar for handing over to Phase B.
- **Checked:** GitLab API reachable over HTTPS (project 2346 private, 0 labels, 0 issues). SSH to
  `labs.gauntletai.com:22022` stalls after key exchange (TCP opens; no auth reply) — retried before push; HTTPS with
  glab's credential helper is the fallback. No Docker socket access for this user (spikes use PGlite in-process).
- **Remaining:** everything below.

## UX-3b waves 2 and 3 signed

- **Changed:** SCR-2, 3, 6, 7, 12, 16, 17 (wave 2) and SCR-13, 18, 19, 20, 21 (wave 3) set to `signed` in
  `docs/ux/03-structure/SCREEN_SPECS.md`; checklist UX-3b gate line records it.
- **Why:** every planned wave is ticketed in Phase A; frontend tickets need signed screens (`ticket_readiness.py`).
- **Checked:** each spec lists its states and names its CONs (script count); UXP/UXQ decided (PD-31). Claude
  recommendation adopted under Innocent's standing authorization (PD-32); he has not read them.
- **Remaining:** nothing for UX-3b.

## §6 design outputs drafted (DO-1, DO-2, DO-5, DO-6, DO-7, readiness report)

- **Changed:** `docs/design/system-design-readiness.md` (READY; 60 items, 0 Missing), `system-design.md`,
  `architecture.md`, `observability.md` (40 WF rows), `eval-plan.md`, `metrics-registry.md` (44 metrics); register
  rows set `ready`; stale 25-user interview cells marked superseded by PD-33.
- **Why:** §6 gate; PD-33 replaced the 25-user load figures.
- **Checked:** `design_outputs.py check-obs`, `check-eval`, `check-metrics` and `--gate readiness` exit 0.
  Proposals adopted under PD-32: SDQ-1 (checks run in the worker from `check_job`), SDQ-2 (judge via OpenRouter),
  SDQ-3 (reservations also enforce the $75 build total). Contract gaps CG-1…CG-3 sent to the System review.
- **Remaining:** DO-3/DO-4, area map, Metz review, signature check, spec dry run, coverage sweep, Stage 6 page.

## UX-3a closed; §5 spikes run; DO-3/DO-4; slice plan (run 1, to ~13:50 UTC)

- **Changed:** CON-1…24 `agreed` (System review; OpenAPI 1.0.0; Prism, generated types, trace_check clean); SP-1, SP-2,
  SP-3 records with orchestrator re-runs (all pass; SP-3 with its fallback scope); HP cards and PD-4/13/14 updated;
  DO-3, DO-4, area map; coverage requirements sweep (187 rows; WF-41…45); slice plan (147 tickets, 13 waves);
  ticket template, board/matrix generator; 16 ticket specs.
- **Why:** UX-3a, §5, §6, §7a.
- **Checked:** see each commit (`f680273`, `b7fc7ed`, `952ec72`, `e970cd1`, `212ffd7`, `4bdd974`). Push to GitLab works
  over HTTPS with glab's credential helper (SSH stalls after key exchange):
  `git -c credential.helper= -c credential.helper='!glab auth git-credential' push https://labs.gauntletai.com/innocentnortey/inno-newsela.git main`.
- **Remaining:** run 1 hit its $150 budget with the DO-3/DO-4 fix pass and two spec writers mid-task.

## Run 2 start: budget-driven model change for specs

- **Changed:** the remaining 131 ticket specs go to **Sonnet** writers using the Opus-written tickets as exemplars
  (`docs/plans/spec-brief.md` addendum); one Opus agent closes the 29 dry-run gaps and the 2 signature findings.
- **Why:** run 1 spent ~$77 on two Opus spec writers for 16 tickets; at that rate 131 more would exceed the last
  Phase A budget (PD-35: $300 total). Deviation from the to-tickets "Opus writes specs" row, adopted under PD-32.
- **Checked:** —
- **Remaining:** design gate, specs, coverage audit, publication, handoff.

## Workflow proposals for the next stage boundary

- `ticket_readiness.py` has no kind for `lane::direct` / `lane::human` tickets; Newsela records them as `integration`
  with honest `depends_on` (artifacts/gates for wave-0 items).
- `checkpoint_a.py` requires local ticket files while to-tickets §6 says GitLab is the only record; Newsela keeps both
  (local files are the publish source; GitLab owns status).
