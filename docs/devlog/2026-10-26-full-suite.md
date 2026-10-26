# Full suite at main 0aa561b+ (2026-10-26)

**Changed.** Nothing (a check). `npm test` over all vitest projects on main after GEN-7.
**Checked.** 521 test files: 517 passed, 1 skipped, 3 failed; 3,606 tests passed, 1 expected fail, 16 skipped, 1 todo. The 3 failures (`load/spike-yjs.int`, `load/spike.int`, `load/wf-29-obligations.int`) all stopped on "run `npx next build` in apps/web first" (those probes refuse to build on a shared machine); after `npx next build` (exit 0) the same three passed, 10 of 10. Lint 0 errors / 18 warnings and typecheck 0 errors earlier on the same tree. `.next` removed afterwards.
**Not run.** The Playwright suites (mock and real stack) were not re-run as a whole at this SHA; they ran per ticket. `eval:golden`, `test:e2e` and the Compose run are NL-137's steps.
**Remaining.** NL-137 repeats this at the release SHA with Compose.
