# Route: shared conventions every build ticket uses

As of main `5999d9b` (2026-10-26; HEAD, the NL-137 release SHA is not cut), reconciled by NL-140. Every ticket this route served is built; rows below say what exists. These are the files most W0–W4 planners re-found by search (each was opened by 19–32 of
68 planners). Status words: [routes/README](README.md).

| Need | Where | Note |
|---|---|---|
| Domain errors | `packages/core/src/errors.ts`: `DomainRefusal`, `ProviderError`, `ModelOutputInvalid`, `SpendRefused`, `LeaseLost`, `CollabUnavailable`, `CompileError`, `InvariantViolation` | refusals reach HTTP through `apps/web/src/server/http/{with-route,refusal,error-status.generated}.ts` |
| Ids and their formats | `packages/schema/src/ids.ts` (`UNIT_ID_RE`, `LESSON_ID_RE`, `OUTLINE_VERSION_ID_RE`, `ID_PREFIXES`, `IdPrefix`) | |
| Shared domain types | `packages/core/src/ports/common.ts` (`RoleName`, `LessonStateName`, `RunStateName`, `RunKind`, `Usd`) | |
| Settings | `packages/config/src/settings.ts` (`SharedSettings`, `ModelSettings`, `SpendSettings`, `WebSettings`, `WorkerSettings`, `CollabSettings`) | a name not in these interfaces is not a setting yet |
| Ports | `packages/core/src/ports/*.ts`, one file per port, no barrel | signatures come from these files, not from DO-4 |
| Core test doubles | `packages/core/src/testing/{fake-audit,fake-collab-commands,fake-job-queue,fake-lesson-state,fake-model-call-log,fake-spend,fake-tx,scripted}.ts` | |
| Web service test kits | `apps/web/src/server/services/testing/{intake-harness,outline-harness,run-read-harness,run-service-fakes}.ts` | |
| Test database | `packages/db/src/testing/test-db.ts` `create_test_db(opts)`, `TEST_DATABASE_URL`; helpers `insert-row.ts` `insert_row`, `seed-run.ts` (`seed_run`, `seed_job`, `seed_lost_calls`), `outline-seed.ts` (`seed_standards`, `seed_users`); server `scripts/test-db.sh up` (127.0.0.1:55440); `TEST_DATABASE_URL` must be local or the helper throws (`b5034cf`) | example `apps/web/src/server/http/seeded-accounts.int.test.ts` |
| Where tests are collected | root `vitest.workspace.ts` (`packages/*/src/**`, `packages/*/tests/**`, `apps/worker/src/**`, `apps/collab/src/**`, `evals/**`, `ops/*.test.ts`); `apps/web/vitest.config.ts` projects `ui` (`tests/unit/**`, `app/**/*.test.tsx`) and `server` (`src/server/**/*.test.ts`, `app/**/*.test.ts`) | `.int.test.ts` is a naming convention only; e2e is Playwright, not vitest |
| Gates | root `package.json`: `npm run lint`, `npm run typecheck`, `npx vitest run <paths>` | rule `build-loop-test-scope` decides which tests |
| A stub waiting for a later ticket | a local `NotBuiltYet` class (e.g. `prompt-service.ts`, `run-service.ts`, `packages/db/src/repos/outlines.ts`), or a `FILLER = "NL-n"` file | the filling ticket replaces it and the test that pins it; a few `NotBuiltYet` mentions remain in `prompt-service.ts`, `run-service.ts`, `packages/db/src/repos/outlines.ts` (grep before assuming one is live) |
| Frozen tests (`risk::security`) | `docs/plans/frozen-tests/<ID>.manifest.json` | never edit a frozen file |
| Worktrees | `scripts/link-node-modules.sh <worktree>` | never `npm ci` in a worktree |
| Dev log file | wave-4 files are `docs/devlog/2026-10-25-w4-nl<id>.md` (e.g. `2026-10-25-w4-nl86.md`) | one file per ticket |
