# 2026-10-26 Capacity A/B check (HTTP half, `1d9e78d` against main `52b6902`)

**Changed.** Added the section "A/B check" to `docs/delivery/capacity-report.md` and this log. No source touched; the seed script and run scripts live in `/tmp/ab` and were not committed. Worktrees, `.next` builds and the four throwaway databases were removed.

**Why.** The re-run after PD-38 showed lesson open p95 7,188 ms and 4.33% `SERVICE_BUSY` where the first NL-127 run showed 23 ms and 0%. The question was code regression or contention.

**Checked.** Same native setup, same padded `G6.U1` seed, 200 users, 30/120/30 s, no sockets. Quiet machine (load about 5): `1d9e78d` lesson open 13 ms, board 9 ms; main 13 ms, 8 ms; 0 errors both. With 20 busy-loop processes (load about 33): both 168 ms and 84 ms, 0 errors. No regression on the HTTP path; the re-run's seconds-long figures were not reproduced.

**Remaining.** Cause of the re-run's slowness unidentified (untested differences: 140 socket editors on the same database, 900 s plateau, `ls_app` role, shared container behind a busy Docker daemon). A quiet-machine full re-run with sockets is still needed.
