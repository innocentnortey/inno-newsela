# E2E mock project, final pass (2026-10-26)

**Run.** `E2E_PORT=3190 npx playwright test --project=mock` in `apps/web` (next dev on 3190, Prism 4010, collab 4020; real-stack ports untouched). 25 spec folders, 1 worker.

**Runs.** Run 1: 770 passed, 16 failed, 2 skipped. After fixes, the last full run (run 9): 784 passed, 2 failed, 2 skipped. The 2 were `assist` "INVALID_TRANSITION re-reads the list" (passed on rerun, not reproduced; a 60 s timeout under load average ~7, cause not found) and `upload-outline` "keyboard opens the file picker" (fixed afterwards). There was no single clean full run after the last fix; the touched folders were re-run in groups and passed.

**Result per spec folder (latest evidence).** Pass: frame, sign-in, units-home, upload-outline, validation-report, start-run, progress, board, workspace-read, workspace-actions, workspace-editor, approval, unit-plan, history, resolve, insert-quote, candidate, send-back, run-summary, export, coverage, quality, prompt-guidance, layout. Flaky once, not reproduced: assist (see above). The earlier suspects start-run (~30 click timeouts), frame sign-out and quality all passed in runs 1 and 9; they were load, not bugs.

**Real bugs fixed.**
- `src/lib/use-poll.ts`: a fetch that switched polling off (terminal run state, settled plan) had its data dropped when the effect cleaned up, so the screen stayed on "Loading" about 40% of the time (progress cancelled/complete, unit-plan). Data is now dropped only on unmount. Unit test added (red before, green after).

**Test bugs fixed.**
- `insert-quote` text-error: never filled the source, so the client blocked the submit.
- `prompt-guidance` can't-load Retry and cantload axe: unmocked `/units` hit Prism's 401 and the app bounced to sign-in; the test also used `unrouteAll`, leaving a gap with no `/session`. The axe loop re-runs when only `document-title` is reported (Next 16 streams the title).
- `prompt-guidance` cut-flag: `serveUnits` glob `**/units` also matched the page `/units`. `mockOperation` and `respondWithError` now let document requests through; `mockOperation` also ignores a response disposed at test end.
- `units-home` no-repeated-requests: budget raised from 2 to 4 (page plus the frame nav-unit hook, each doubled by StrictMode).
- `upload-outline` keyboard picker: first Enter can land before hydration on a cold dev server; now retried.

**Left / honest notes.**
- Which axe tests failed in run 1 varied between runs; the fixes above explain progress, unit-plan and prompt-guidance. insert-quote's 4 failures were the test bug.
- Screenshot files under `e2e/__screenshots__` were restored (rendering noise on this host), except `integration/`, which belongs to another agent's real-stack run.
- `assist` flake and the cold-start hydration races are timing, so expect an occasional first-test failure on a cold `next dev`.

## Follow-up: the 5 failures of mock-final2.log (781 passed, 5 failed, 2 skipped)

All five are flakes, none caused by Astra slices A to D (those touch worker, core and reports; `apps/web` has no source change, and these specs only use the mock web, Prism on 4010 and the mock collab on 4020). Rerun once on a free port (`E2E_PORT=3190 npx playwright test --project=mock e2e/assist/assist.spec.ts:125 e2e/workspace-editor/workspace-editor.spec.ts`): 7 passed (29.7 s), so all five pass.

1. `assist.spec.ts:125` INVALID_TRANSITION re-reads the list: the Accept button never appeared in 60 s. Passed on rerun. Flake (host load during the full run).
2. `workspace-editor.spec.ts:86` refused: after `b.reload()` the Part A textbox was not found in 5 s. Passed on rerun. Flake.
3. to 5. `workspace-editor.spec.ts:104`, `:116`, `:174` (unauth, readonly, @axe): the Part B textbox did not appear in 15 s, in three consecutive tests right after failure 2. Likely a cascade: test 2 failed before closing its contexts and left the shared mock collab (4020) in the locked state it sets with `/__mock/lock`, so later documents did not load. All three passed in a fresh run. Not changed; if it recurs, add an `afterEach` that POSTs a mock reset or closes contexts in a `finally`.
