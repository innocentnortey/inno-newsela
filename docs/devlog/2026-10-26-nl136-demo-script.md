# NL-136 demo script and interview-prep table (2026-10-26)

**Changed.** Added `docs/delivery/2026-10-26-demo-script.md` (five sections in the two-layer order; product 290 s, decisions 300 s, total 590 s; shot line per row; cannot-be-shown list) and `docs/delivery/2026-10-26-interview-prep.md` (18 rows: choice, rejected alternative, evidence with n, limit). Router row updated.
**Why.** The recording (NL-138) and the interview check (NL-141) need a script written from the record, not memory.
**Checked.** Path-exists loop over both files, no MISSING; AC-5 grep clean; lane guard on `git diff --name-only`.
**Remaining.** Rows marked pending: NL-112, NL-123, NL-135, NL-132 stay empty until those reports exist. The stored p95 miss (6,008 ms vs 3,000 ms) and QA findings F-1 to F-4 are stated as open facts; re-read after the fixes land.
