# Real-stack e2e, serial run at HEAD 110ebb1 (2026-10-26)

Serial run, one folder at a time, default ports, `E2E_SKIP_BUILD=1`. Source: `rs3.log`.

| Folder | Result |
|---|---|
| con-1 | 22 passed |
| con-2 | 2 failed, 38 passed |
| con-3 | 29 passed |
| con-5 | 37 passed |
| con-6 | 1 failed, 52 passed |
| con-9 | 2 failed, 61 passed |
| con-10 | 58 passed |
| con-11 | 41 passed |
| con-12 | 27 passed |
| con-13 | 18 passed |
| con-14 | 24 passed |
| con-15 | 25 passed |
| con-16 | 51 passed |
| con-17 | 11 failed, 1 passed (harness: `E2E_ASSIST_STUB_FILE` not exported; not an app bug) |
| con-18 | 23 passed |
| con-20 | 35 passed |
| con-21 | 26 passed |
| con-22 | 24 passed |
| con-23 | 28 passed |
| con-24 | 31 passed |
| judge | 5 passed |

## Diagnosis and fixes (not re-verified, see below)

- **con-9 (2 failed): test fixture stale.** GEN-3 (1acff32, S-34) made one definition of a filled slot: rights other than `unset` AND a non-blank source. The con-9 seed wrote an `excerpt_slot` with `source_ref` only, so the board correctly no longer said "Waits on Lesson N's approval". Fix: seed adds `rights: "free"` (`e2e/integration/con-9/seed.ts`), as con-18's seed already does.
- **con-2 (2 failed): GEN-5 side effect.** a008f13 made the nav frame read `/api/units` to point "Unit board" at the latest unit, so `/units` makes two reads, not one. Not polling. Both specs now allow at most two reads.
- **con-17 (11 failed): harness env.** The run needs `E2E_ASSIST_STUB_FILE` and the other plan section 8 exports. With them, 19 passed and 3 failed on my rerun: two `error-model-unavailable` axe/visual timeouts (not diagnosed; may be due to the contention below) and wf-14 CON-G8, which scanned the lesson body for the reviewer's name. NL-126 G3 (F-6) deliberately returns `reviewer`/`last_editor` display names, so that spec now removes those two fields before scanning (names anywhere else still fail).

## Left open

- **con-6 progress AC-1 (1 failed): not fixed.** Reproduced twice: the first gap between a progress response and the next request is about 1.0 to 1.1 s, all later gaps 2.0 s. An extra early request exists on a page with the worker running. A plain load without the worker polls normally (first gap 2 s). Cause not found; `usePoll` and `useRunProgress` code looks right. Treat as a real, unexplained app-side or harness-side issue.
- **Verification:** my reruns were disturbed by another session running `--project=mock` Playwright in the same `apps/web` (it wipes `test-results/integration-stack/stack.json`, giving "real stack not started"), and a stale port-3121 server. con-2 rerun passed (40) before that. The con-9, con-2 (edited) and con-17 fixes were not confirmed by a clean rerun.
