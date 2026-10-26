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

## con-6 progress poll-interval (static analysis, no run)

At HEAD `use-poll.ts` and `use-run-progress.ts` match the contract (CON-6: poll every 2 s, a 2 s wait after each response); the app is not wrong. The observed first gap of ~1 s is a spec artefact: `progress.spec.ts` attached its `/progress` listeners before `startRun` signed in, and the home page that sign-in lands on (`use-units-home.ts`) reads `/runs/{id}/progress` once for any other active run left in the shared DB. That one-off read counted as poll 0, so the first "gap" ran from it to the real poll after `page.goto`. Every later gap was 2.0 s, as the usePoll timer dictates. This is an inference from the code and the logged gaps (956, then 2001...), not confirmed by a run. Fix: the spec now keeps only requests for its own run id. The commit a228ddb change (data kept when a fetch disables polling) does not touch timing. To confirm: run `e2e/integration/con-6/` once, alone, on the real stack; progress.spec.ts should pass with all gaps near 2000 ms.

## Follow-up: con-17 and con-6 after rs4 (static analysis, no real-stack run; slice D was editing)

- **con-17 (6 failed in rs4): harness env, not app code.** `e2e-rs4.sh` exported `E2E_COLLAB_PORT`, `E2E_SHEETS_BASE_URL` and `E2E_ASSIST_STUB_FILE` but not `E2E_COLLAB_INTERNAL_URL` (and not `E2E_ASSIST_TIMEOUT_MS`). `support/real-stack.ts` passes `COLLAB_INTERNAL_URL` to the web process only when that variable is set (plan NL-116 section 8 lists it). Without it the web falls back to `http://collab:1234/internal`, which does not resolve, so every route that calls collab fails: the anchor_changed spec logged `503 COLLAB_UNAVAILABLE` where it expected 409, and the accept path never applies the text (wf-14 R-28 saw the old "Today we read a fable..." not NEW_TEXT). The `askForSuggestion` timeouts (accept, blocks_transitions, untrusted_text, SCR-13 main) are the same cause: the suggestion request needs collab to read the anchor. The six that failed are exactly the ones that touch collab; the 19 that passed do not. The stub file is fine: `wiring/assist.ts` re-reads it per call and falls back to the default text if it is missing or not JSON; each spec writes its own `{"kind":"text","text":...}` body with `setStub`. Required exports for the next run: `E2E_COLLAB_PORT=4399 E2E_COLLAB_INTERNAL_URL=http://127.0.0.1:4399/internal E2E_ASSIST_TIMEOUT_MS=1500 E2E_ASSIST_STUB_FILE=<tmp>/assist-stub.json` (the URL must end in `/internal`). Not yet re-run (rule: no real stack while slice D works).
- **con-6 progress AC-1 first gap (~1163 ms): still open, not the home page.** e7e72a3 filtered to the run's own id and the gap stayed, so the home-page theory is out (home reads once and signed in before the run existed). Checked and ruled out by reading: `usePoll` effect deps (`enabled`, intervals) do not change during a run; `useCallsLost` reads `/summary`, not `/progress`; `ControlBar` calls `retry` only after an action; `SessionGate` mounts the screen once; `useNavUnitKey` does not list units on a run URL. A second request about 1.1 s after the first needs a second trigger (an effect restart or a remount), and the earlier note says it appears only with the worker running. Static reading cannot find it, so the spec now records every `/progress` fetch with its call stack (`window.__pf`, printed as "AC-1 progress fetch callers"). One real-stack run of `e2e/integration/con-6/progress.spec.ts` will name the caller. Needs a rebuilt `.next` first (mock dev runs overwrite it).
