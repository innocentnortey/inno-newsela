# 2026-10-25 — zero-to-hero 2.0.0 migration and VPS handoff

Project: Newsela Lesson Studio · Writer: Claude (Opus 5.5) · Host: Mac → VPS · `main`.

## Workflow revision and UX-3

- **Changed:** zero-to-hero 2.0.0, which adds a Joint track (UX-3a contracts), UX-3b screens and tokens, per-ticket
  readiness, a foundation wave, an optional UX-4 and a UX-5 split into 5a and 5b. The checklist was migrated; D1
  Clear Ledger was picked; PD-31 to PD-35 were recorded; `docs/contracts/` was added (24 CON, `proposed`); FW-1 to
  FW-4 are ready.
- **Why:** Innocent's process change (2026-10-25), so frontend work can start before the backend design is closed.
- **Checked:** `ticket_readiness` 37 tests; the real cases give FW READY, the SCR-14 and CON-3 probes NOT READY.
- **Remaining:** System review of the CON cards; §5 and §6.

## VPS handoff

- **Changed:**
  - `ops/vps-run/`: a launcher with checkpoints, prompts and a workflow lock.
  - The workflow is pinned under `.claude/`.
  - The VPS copy is authoritative (PD-34).
  - GitLab project 2346 was found public and set to private.
- **Why:** one Opus run through ticketing, then Sonnet through delivery, with no AI supervisor (PD-35).
- **Checked:** see the VPS preparation entry below.
- **Remaining:** Innocent starts `bash ops/vps-run/run.sh`.

## VPS preparation (2026-10-25, 11:20–11:45 UTC)

- **Changed:**
  - Copied to the VPS. First push `407339c` fast-forwarded over GitLab's README commit.
  - Guard hook fixed: a project that pins zero-to-hero is not mistaken for the workspace root. Mac and VPS copies
    are identical.
  - `claudeMdExcludes` covers the six duplicated workspace rules.
  - `adopt_updates.py` and the shared release manifest added; R-1 and R-2 adopted; lock written.
- **Why:** Innocent: shared updates are fine when "based on data and not something its currently experimenting".
- **Checked:**
  - Smoke tests ($1.03): Opus init and usage show `claude-opus-5-5` only.
  - The forced-Sonnet run's Haiku-requested Explore was served by Sonnet only.
  - The Opus run counted one loaded copy each of the excluded rules.
  - Preflight OK (19.3 GB free).
  - checkpoint_a fails as expected (41/50 open); checkpoint_b fails as expected (14/18).
  - Zero-to-hero tests: 37 passed.
- **Remaining:** HX-R1 releases R-3 when its Step B numbers are final; Innocent starts the run.
