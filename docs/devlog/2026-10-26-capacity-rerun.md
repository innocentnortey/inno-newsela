# 2026-10-26 Capacity re-run after PD-38 (NL-127 spike, native stack)

**Changed.** Added `evals/reports/load-2026-10-26-rerun.md` (probe output plus run record) and a section "Re-run after PD-38" in `docs/delivery/capacity-report.md`. No source or setting touched; the throwaway seed script for the padded unit `G6.U1` was deleted, not committed.

**Why.** PD-38 lowered the collab store debounce defaults to 1 s with a 2 s ceiling; the first run's stored p95 of 6,008 ms missed the 3 s target because of the old 4 s ceiling. This run measures the target again with the same load. Native run (`next build` + `next start`, `tsx` collab and worker, database `ls_nl127b` in the shared test Postgres, stub provider, no key) because the disk was too small for image builds. Machine load average was 13 before the run and 27 during it (first run about 8).

**Checked.** Stored p95 clean **1,124 ms** (n = 22,517), met; split from `collab.stored` (n = 22,520): wait p95 1,007 ms, db write p95 117 ms. Remote edit 6.8 ms (n = 44,588), lost updates 0, reconnect p95 8.39 s, `check.failed` 0. HTTP half **missed**: lesson open p95 7,188 ms, board 4,032 ms, error rate 4.33% (1,684 `SERVICE_BUSY` of 38,909), recovery not reached. Not diagnosed: heavy contention, a shared database container and a native web process all differ from the first run.

**Remaining.** A quiet-machine re-run on the Compose stack to settle the HTTP numbers; four orphaned `next-server` processes from deleted worktrees (NL-90, NL-110, NL-73, GEN-3) were burning CPU and were left alone (not mine); the stack was stopped, `ls_nl127b` dropped and `.next` removed.
