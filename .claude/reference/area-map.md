# Area map — inno-newsela (Newsela Lesson Studio)

> Extracted from: [`docs/design/code-design.md`](../../docs/design/code-design.md) (DO-3) and
> [`docs/design/component-contracts.md`](../../docs/design/component-contracts.md) (DO-4).
> As of: 2026-10-25 (§6, before any feature ticket; interface spec: 24 cards agreed). Only the FW foundation wave's `apps/web/` scaffold may exist; every
> other path is **planned**.
> Authority: **DO-3 wins.** This file only routes; when it disagrees with DO-3, fix this file.

**Every code path below is planned unless its row marks it actual.** When a slice lands, change its row from *planned*
to *actual* with the commit, in the same change (`rules/context-maintenance.md`).

## How the code is layered (one line)

`apps/{web,worker,collab}` (composition roots, routes, services, pipeline nodes) → `packages/core` (pure domain and the
port interfaces, one file each in `packages/core/src/ports/`) → `packages/{schema,editor-schema}`; adapters `packages/{db,llm,ydoc}` and
`apps/web/src/server/adapters/*` implement the ports; `packages/db/migrations/` holds **all** DDL. Detail: DO-3 §1–§3.

## Areas and waves

Mirrors DO-3 §4 row for row (waves in dependency order; each area's cross-area calls and notes are in DO-3 §4).

| Wave | Area | Owns (all planned) | Status |
|---|---|---|---|
| FW | FW presentation | `apps/web/src/styles/**`, `apps/web/src/components/**`, `apps/web/app/(dev)/**`, and `apps/web/{package.json,tsconfig.json,…}` until A0 adopts them (as in `foundation-wave.md`); NL-06 adopted `apps/web` as workspace `@ls/web` (`package.json`, `tsconfig.json`, own lockfile deleted) | FW-1 built: `apps/web/{package.json,app/,scripts/build-tokens.mjs,src/styles/tokens.css,src/lib/cn.ts,tests/unit/tokens/}`; FW-2 built: `apps/web/src/components/ui/`, `apps/web/tests/unit/ui/`; FW-3 built: `apps/web/src/components/layout/`, `apps/web/tests/unit/layout/`; FW-4 built: `apps/web/app/(dev)/gallery/`, `apps/web/e2e/gallery/`, `apps/web/playwright.config.ts` (screenshots in `apps/web/e2e/__screenshots__/gallery/`) |
| 0 | A0 platform | root `package.json`, root `package-lock.json` (the only lockfile; A0 deletes `apps/web/package-lock.json` when it adopts `apps/web`), `tsconfig.base.json`, **every** workspace `*/package.json` and `*/tsconfig.json` (with subpath `exports`, no barrel `index.ts`), root `eslint.config.js` (boundaries rule, allow-list for SheetJS and `compromise` in core), `vitest.workspace.ts`, `docker-compose.yml`, `Dockerfile.web`, `Dockerfile.node`, `render.yaml`, `packages/config/**`, `packages/obs/**`, `apps/web/src/server/container.ts`, `apps/worker/src/main.ts`, `apps/collab/src/main.ts`, `.dockerignore`, `.env.example`, `scripts/docker-entrypoint.sh`, `scripts/apply-runtime-grants.mjs`, `apps/*/src/start-event.ts`, `apps/web/instrumentation.ts`, and the **stubs** of every `apps/web/src/server/wiring/*.ts`, `apps/worker/src/wiring/*.ts`, `apps/collab/src/wiring/collab.ts` | in progress: NL-01 built (workspace manifests, root configs, eslint/vitest configs, scripts/, packages/config, packages/obs, Compose files); NL-07 built worker/collab main.ts + wiring shells; NL-06 built `apps/web/src/server/{container,deps,deps-types}.ts` + nine `wiring/*.ts` stubs; NL-23 built: `Dockerfile.web`, `Dockerfile.node`, `.dockerignore`, `.env.example`, full `docker-compose.yml`, `render.yaml`, `scripts/{docker-entrypoint.sh,apply-runtime-grants.mjs}`, `start-event.ts` helpers (worker, collab, web) + `apps/web/instrumentation.ts` |
| 0 | A1 storage | `packages/db/migrations/**`, `packages/db/src/{pool,tx,migrate}.ts`, `packages/db/src/repos/audit.ts`, **every** `packages/core/src/ports/*.ts` (then each to its implementing area), `packages/core/src/testing/fake-tx.ts` | NL-08 built (migrations, pool, tx, migrate, ops-event, `ops/migrate.ts`); NL-12 built: 31 files in `packages/core/src/ports/` (no barrel), `core/src/errors.ts`, `core/src/testing/{scripted,fake-*}.ts`, `packages/db/src/repos/audit.ts` (`PgAuditLog`), the three `deps-types.ts` re-pointed |
| 0 | A2 schema | `packages/schema/**` (incl. `content-hash.ts`; actual (NL-11): `src/api/*.ts` Zod mirrors of every OpenAPI component incl. `transition.ts`, and `tests/contract/**`), `packages/editor-schema/**`, `docs/contracts/schemas/**` | NL-09 built: `packages/schema/src/{ids,outline,unit-plan,lesson-draft,lesson,content-hash,export}.ts`, `packages/schema/scripts/emit-json-schemas.ts`, `docs/contracts/schemas/*.schema.json`, `docs/contracts/lesson-export.schema.json`; NL-11 built: `src/api/**`, `tests/contract/**`; NL-10 built: `packages/editor-schema/{src/schema.ts,src/errors.ts,tests/fixtures/}` |
| 1 | A3 auth | `apps/web/src/server/http/**`, `packages/core/src/auth/passwords.ts`, `apps/web/src/server/services/session-service.ts`, `packages/db/src/repos/sessions.ts`, `apps/web/app/api/session/**`, `apps/web/middleware.ts`, `apps/web/src/server/wiring/sessions.ts` | planned NL-13 built: apps/web/src/server/http/{with-route,refusal,error-status.generated}.ts, apps/web/scripts/gen-error-status.ts |
| 1 | A4a intake core | `packages/core/src/intake/**`, `packages/db/src/repos/outlines.ts` | NL-15 built: `intake/standards-index.ts`, `packages/core/data/standards/**`; rest planned ; `intake/report.ts` built (NL-17); rest planned ; NL-16 built: `packages/core/src/intake/{errors,parse-grid,normalize,normalize-codes,normalize-segments,lesson-links,instruction-patterns,safety-patterns}.ts`, `packages/core/scripts/build-outline-fixtures.ts`, `packages/core/tests/fixtures/outline/**`; `standards-index.ts` (NL-15), `report.ts` (NL-17) and `repos/outlines.ts` planned |
| 1 | A5 compile | `packages/core/src/compile/**`, `packages/ydoc/{src/convert.ts,src/hash.ts,tests/fixtures/}` (built, NL-19), `packages/ydoc/**` (rest), `packages/db/src/repos/lesson-doc-reads.ts` | planned ; planned (ydoc convert/hash built) |
| 1 | A6a check core | `packages/core/src/checks/{registry,policy,gates,types}.ts`, `packages/core/src/checks/rules/**`, `packages/db/src/repos/check-queue.ts` | checks kernel actual (NL-20); `check-queue.ts` planned |
| 1 | A7 llm | `packages/llm/src/{model-client,anthropic,stub,prices}.ts`, `packages/prompts/**` (built by NL-14), `packages/db/src/repos/{model-calls,prompts}.ts` | planned |
| 1 | A8 spend | `packages/core/src/spend/**`, `packages/db/src/repos/spend.ts` | planned |
| 1 | A9a queue and runs | `packages/db/src/repos/{runs,job-queue}.ts`, `packages/core/src/lifecycle/run-machine.ts` | planned |
| 1 | A12a lesson records | `packages/db/src/repos/{lessons,review-extras}.ts`, `packages/core/src/lifecycle/lesson-machine.ts` | `lesson-machine.ts` built (NL-21); repos planned |
| 1 | A13a metrics records | `packages/core/src/metrics/**`, `packages/db/src/repos/metrics.ts` (incl. `PgBoardReadRepo`) | planned |
| 1–3 | A14 web-ui | `apps/web/app/(app)/**`, `apps/web/src/editor/**` (incl. `refusals.ts`), `apps/web/src/lib/api-client.ts`, `apps/web/src/features/**` | planned |
| 2 | A11a lesson store | `packages/db/src/repos/lesson-docs.ts` | planned |
| 2 | A6b check context | `packages/core/src/checks/context-loader.ts` | NL-38 built: context-loader.ts |
| 2 | A7b paid calls | `packages/llm/src/{recorder,paid-call}.ts` | planned |
| 2 | A11b collab client | `apps/web/src/server/adapters/collab-commands.ts` | planned |
| 2 | A13b metrics writer | `apps/web/src/server/services/metrics-writer.ts` | planned |
| 3 | A4 intake service | `apps/web/src/server/services/outline-service.ts`, `apps/web/src/server/adapters/google-sheets.ts`, `apps/web/app/api/units/route.ts`, `apps/web/app/api/outline-versions/**`, `apps/web/src/server/wiring/outlines.ts` | planned |
| 3 | A6 check runner | `apps/worker/src/checks/**`, `apps/worker/src/wiring/checks.ts` | planned |
| 3 | A9 generation | `apps/worker/src/{queue,generation}/**`, `packages/core/src/pipeline/**` (built, NL-22), `apps/worker/src/wiring/generation.ts` | planned |
| 3 | A10 runs | `apps/web/src/server/services/run-service.ts`, `apps/web/app/api/runs/**`, `apps/web/src/server/wiring/runs.ts` | planned |
| 3 | A11 collab server | `apps/collab/**` (except `main.ts`, `health.ts`; incl. `frozen-docs.ts`, `wiring/collab.ts`) | planned |
| 3 | A12 review | `apps/web/src/server/services/{lesson-read,issue,slot,candidate,transition,approve}-service.ts`, `apps/web/app/api/lessons/**` (except suggestions, heartbeats), `apps/web/src/server/wiring/review.ts` | planned |
| 3 | A13 metrics | `apps/web/src/server/services/{heartbeat,board}-service.ts`, `apps/web/app/api/units/[unitId]/{board,metrics}/**`, `apps/web/app/api/lessons/[lessonId]/heartbeats/**`, `apps/web/src/server/wiring/metrics.ts` | planned |
| 3–4 | A20 evals | `evals/**`, `load/**`, `ops/faults/**`, `ops/import-spike.ts`, `packages/db/src/repos/evidence.ts` | planned |
| 0–3 | A21 ops | `ops/{seed.ts,backup.sh}`, `apps/{worker,collab}/src/health.ts`, `apps/web/app/api/healthz/**` | NL-07 built the worker/collab `health.ts` shells; rest planned |
| 4 | A15 assist (cut #8) | `apps/web/src/server/services/suggestion-service.ts`, `apps/web/app/api/lessons/[lessonId]/suggestions/**`, `apps/web/src/server/wiring/assist.ts` | planned |
| 4 | A16 prompts (save is cut #7) | `apps/web/src/server/services/prompt-service.ts`, `apps/web/app/api/prompt-versions/**`, `apps/web/src/server/wiring/prompts.ts` | planned |
| 4 | A17 export (cut #5) | `apps/web/src/server/services/export-service.ts`, `packages/db/src/repos/exports.ts`, `docs/contracts/lesson-export.schema.json`, `apps/web/app/api/{units/[unitId]/exports,exports}/**`, `apps/web/src/server/wiring/exports.ts` | planned |
| 4 | A18 coverage (cut #4) | `apps/web/src/server/services/coverage-service.ts`, `apps/web/app/api/units/[unitId]/coverage/**`, `apps/web/src/server/wiring/coverage.ts` | planned |
| 4 | A19 judge (cut #2) | `apps/worker/src/judge/**`, `packages/llm/src/openrouter-judge.ts`, `packages/db/src/repos/judge.ts`, `apps/worker/src/wiring/judge.ts` | planned |

## Ports → adapters (DO-3 §3)

`ModelClient` → `AnthropicMessagesAdapter`, `StubModelClient` · `JudgeClient` → `OpenRouterJudgeAdapter`,
`StubJudgeClient` · `SheetFetcher` → `GoogleSheetsExportFetcher` · `CollabCommands` → `HttpCollabCommandClient`
(client) and `CollabCommandHandler` (server) · `TxRunner` → `PgDatabase`, `FakeTxRunner` (test helper) ·
`BoardReadRepo` → `PgBoardReadRepo` · other storage ports → `Pg*` classes in `packages/db/src/repos/` · `Clock` →
`SystemClock`, `FakeClock` · `IdGenerator` → `PrefixedIdGenerator`. All planned.

## Tables

All tables are created only by A1 in `packages/db/migrations/` (planned); the full list with writers is DO-3 §6.
`app_user`, `app_session`, `unit`, `outline_version`, `outline_row`, `intake_choice`, `standard`, `lesson_link`,
`prompt_version`, `run`, `unit_plan`, `lesson_job`, `spend_reservation`, `model_call`, `lesson`, `lesson_version`,
`lesson_doc`, `check_job`, `issue`, `alignment_link`, `safety_flag`, `suggestion`, `review_event`, `audit_event`,
`heartbeat`, `review_session`, `lesson_metrics`, `export_bundle`, `judge_verdict`, `eval_run`, `eval_case_result`,
`probe_run`, `experiment_run`, `ops_event`, `schema_migrations`; view `audit_log_v`.

Built (NL-20): `packages/core/src/checks/{types,policy,registry,gates}.ts`, 28 rule files at `rules/<group>/<kind>.ts` + 6 group `index.ts` + `rules/alignment/derive.ts` stub. Groups: structural (bodies, NL-20), alignment/safety/links (NL-39), grounding (NL-40), arc (NL-41); later tickets fill only their own group's files.

Built (NL-07): `apps/{worker,collab}/src/{main,health,drain,deps,deps-types}.ts`, `apps/worker/src/wiring/{generation,checks,judge}.ts`, `apps/collab/src/wiring/{server,commands}.ts`, `apps/collab/src/commands/{routes,apply-edit,set-mode,lock-and-snapshot}.ts` shells.
