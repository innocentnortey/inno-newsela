# 2026-10-26 · Checkpoint relaunch (Phase B)

**Changed.** Moved Astra's three untracked helper scripts `evals/src/zz-{replay,row,t}.mts` (superseded by `evals/src/replay-finals*`, and the only source of the full-typecheck error) to `/home/linuxuser/workspaces/.snapshots/newsela-astra-helpers-2026-10-26/`; ignored `tsconfig.tsbuildinfo`; corrected `.claude/state/resume.md` (the push state was stale: main is on GitLab through `2bd24db`).

**Why.** The launcher checkpoint failed on gates UX-5b, 9, 10, the open ticket issues and an unclean working tree. Only the working tree was fixable here.

**Checked.** `npm run typecheck`: 0 errors (was 1, in the moved helper). Checkpoint re-run after this commit; see the final line of the run.

**Remaining (only Innocent can do, or needs paid runs).** Gates UX-5b, 9, 10. Open issues: NL-02, NL-03, NL-122, NL-123, NL-124, NL-133, NL-138, NL-143 are human tickets; NL-109, NL-112, NL-120, NL-128 to NL-130, NL-134, NL-135 need the final-candidate paid measurement and their own verify commands before they can close (docs/delivery/2026-10-26-final-status.md); NL-136, NL-137, NL-139 to NL-142 wait on those numbers or the Compose run. No issue was closed without its evidence.
