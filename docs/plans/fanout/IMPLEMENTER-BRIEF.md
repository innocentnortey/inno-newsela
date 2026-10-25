# Implementer brief (Phase B, all waves)

You implement ONE planned ticket in /home/linuxuser/workspaces/inno-newsela from its plan `docs/plans/fanout/<wave-dir>/<TICKET>.md` and ticket `docs/plans/tickets/<TICKET>.md`.

- Worktree: `git worktree add ../.worktrees/newsela-<ID> -b ticket/<ID>` from the repo root (current main), then `npm ci` there (if the lockfile changed on your branch run `npm install`). For `risk::security` tickets the worktree/branch already exists with FROZEN tests (manifest in `docs/plans/frozen-tests/`): never edit frozen files, make them pass, `git merge main` first.
- Stay inside the plan's owned files. Orchestrator decisions on the plan's open items: follow ticket > DO-4 > DO-3, choose sensibly, record each in the devlog entry (`docs/devlog/2026-10-25-<id>.md`, ~100 words: Changed · Why · Checked · Remaining) and update the area-map row(s) for your area. Dependency changes: exact pins, >=14-day-old releases unless an advisory says otherwise, one root lockfile, keep the diff minimal.
- Write the tests the plan names together with the code. Gates, cheapest first: eslint, `npm run typecheck`, then the affected tests (`npx vitest run <paths>`; a shared fixture/config/dependency change reaches everything → full `npm test`). DB tests: `scripts/test-db.sh up` … `scripts/test-db.sh down` (127.0.0.1:55440 only; never touch other projects' containers/ports). Never build Docker images (disk is tight) unless the ticket demands it.
- Commit on the branch; message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. No merge to main, no push.
- Never quote `docs/source/restricted/` into tracked files; test data is synthetic.
- Report in under 150 words: commit, REAL gate results, unmet ACs, deviations, requests for later tickets.
