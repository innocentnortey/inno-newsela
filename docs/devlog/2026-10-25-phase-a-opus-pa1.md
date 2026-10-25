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
