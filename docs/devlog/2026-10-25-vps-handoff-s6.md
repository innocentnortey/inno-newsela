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
