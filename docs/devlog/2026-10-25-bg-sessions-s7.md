# 2026-10-25 — Launcher runs as background sessions; no budget caps

Project: Newsela Lesson Studio · Writer: Claude (Opus 5.5, Mac session) · Host: VPS · `main`.

- **Changed:**
  - `ops/vps-run/` now starts each run as a `claude --bg` background session (`bgsession.py`). It is listed in
    `claude agents` and opens with `claude attach newsela-phase-b`.
  - Dollar caps removed.
  - `run.sh` restarts after a finished launcher.
  - Phase A's usage corrected from $205.61 to $125.58.
- **Why:**
  - Innocent: "is there a way to turn it into a session"; and "we dont need to worry about a budget im on a
    subscription".
  - Print mode reports a resumed session's cost as a running total, so the launcher had counted Phase A run 2's
    $125.58 total as that run's own cost (the run itself used $45.55).
- **Checked on the VPS:**
  - Background probes: the finish signal (`state: done`) works.
  - A Haiku-requested subagent was served by Sonnet under the forced setting.
  - `--bg` ignores `--session-id`; resume after `stop` plus `rm` keeps the id and the conversation (code-word test).
  - The transcript estimator lands within 3% of Claude Code's reported cost for Phase A.
- **Remaining:** the switch happens when Phase B run 1 (started with the old $200 per-run cap) stops by itself; a
  waiter then installs this version and resumes the same session in the background.
