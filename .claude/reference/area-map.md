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
| FW | FW presentation | `apps/web/src/styles/**`, `apps/web/src/components/**`, `apps/web/app/(dev)/**`, and `apps/web/{package.json,tsconfig.json,…}` until A0 adopts them (as in `foundation-wave.md`) | FW-1 built: `apps/web/{package.json,app/,scripts/build-tokens.mjs,src/styles/tokens.css,src/lib/cn.ts,tests/unit/tokens/}`; FW-2..4 planned |
| 0 | A0 platform | root `package.json`, root `package-lock.json` (the only lockfile; A0 deletes `apps/web/package-lock.json` when it adopts `apps/web`), `tsconfig.base.json`, **every** workspace `*/package.json` and `*/tsconfig.json` (with subpath `exports`, no barrel `index.ts`), root `eslint.config.js` (boundaries rule, allow-list for SheetJS and `compromise` in core), `vitest.workspace.ts`, `docker-compose.yml`, `Dockerfile.web`, `Dockerfile.node`, `render.yaml`, `packages/config/**`, `packages/obs/**`, `apps/web/src/server/container.ts`, `apps/worker/src/main.ts`, `apps/collab/src/main.ts`, and the **stubs** of every `apps/web/src/server/wiring/*.ts`, `apps/worker/src/wiring/*.ts`, `apps/collab/src/wiring/collab.ts` | in progress: NL-01 built (workspace manifests, root configs, eslint/vitest configs, scripts/, packages/config, packages/obs, Compose files); Dockerfiles, render.yaml, container.ts, main.ts, wiring stubs planned (NL-06/07/23) |
| 0 | A1 storage | `packages/db/migrations/**`, `packages/db/src/{pool,tx,migrate}.ts`, `packages/db/src/repos/audit.ts`, **every** `packages/core/src/ports/*.ts` (then each to its implementing area), `packages/core/src/testing/fake-tx.ts` | planned |
| 0 | A2 schema | `packages/schema/**` (incl. `content-hash.ts`; actual (NL-11): `src/api/*.ts` Zod mirrors of every OpenAPI component incl. `transition.ts`, and `tests/contract/**`), `packages/editor-schema/**`, `docs/contracts/schemas/**` | partly actual (NL-09 paths planned) |
| 1 | A3 auth | `apps/web/src/server/http/**`, `packages/core/src/auth/passwords.ts`, `apps/web/src/server/services/session-service.ts`, `packages/db/src/repos/sessions.ts`, `apps/web/app/api/session/**`, `apps/web/middleware.ts`, `apps/web/src/server/wiring/sessions.ts` | planned |
| 1 | A4a intake core | `packages/core/src/intake/**`, `packages/db/src/repos/outlines.ts` | planned |
| 1 | A5 compile | `packages/core/src/compile/**`, `packages/ydoc/**`, `packages/db/src/repos/lesson-doc-reads.ts` | planned |
| 1 | A6a check core | `packages/core/src/checks/{registry,policy,gates}.ts`, `packages/core/src/checks/rules/**`, `packages/db/src/repos/check-queue.ts` | planned |
| 1 | A7 llm | `packages/llm/src/{model-client,anthropic,stub,prices}.ts`, `packages/prompts/**`, `packages/db/src/repos/{model-calls,prompts}.ts` | planned |
| 1 | A8 spend | `packages/core/src/spend/**`, `packages/db/src/repos/spend.ts` | planned |
| 1 | A9a queue and runs | `packages/db/src/repos/{runs,job-queue}.ts`, `packages/core/src/lifecycle/run-machine.ts` | planned |
| 1 | A12a lesson records | `packages/db/src/repos/{lessons,review-extras}.ts`, `packages/core/src/lifecycle/lesson-machine.ts` | planned |
| 1 | A13a metrics records | `packages/core/src/metrics/**`, `packages/db/src/repos/metrics.ts` (incl. `PgBoardReadRepo`) | planned |
| 1–3 | A14 web-ui | `apps/web/app/(app)/**`, `apps/web/src/editor/**` (incl. `refusals.ts`), `apps/web/src/lib/api-client.ts`, `apps/web/src/features/**` | planned |
| 2 | A11a lesson store | `packages/db/src/repos/lesson-docs.ts` | planned |
| 2 | A6b check context | `packages/core/src/checks/context-loader.ts` | planned |
| 2 | A7b paid calls | `packages/llm/src/{recorder,paid-call}.ts` | planned |
| 2 | A11b collab client | `apps/web/src/server/adapters/collab-commands.ts` | planned |
| 2 | A13b metrics writer | `apps/web/src/server/services/metrics-writer.ts` | planned |
| 3 | A4 intake service | `apps/web/src/server/services/outline-service.ts`, `apps/web/src/server/adapters/google-sheets.ts`, `apps/web/app/api/units/route.ts`, `apps/web/app/api/outline-versions/**`, `apps/web/src/server/wiring/outlines.ts` | planned |
| 3 | A6 check runner | `apps/worker/src/checks/**`, `apps/worker/src/wiring/checks.ts` | planned |
| 3 | A9 generation | `apps/worker/src/{queue,generation}/**`, `packages/core/src/pipeline/**`, `apps/worker/src/wiring/generation.ts` | planned |
| 3 | A10 runs | `apps/web/src/server/services/run-service.ts`, `apps/web/app/api/runs/**`, `apps/web/src/server/wiring/runs.ts` | planned |
| 3 | A11 collab server | `apps/collab/**` (except `main.ts`, `health.ts`; incl. `frozen-docs.ts`, `wiring/collab.ts`) | planned |
| 3 | A12 review | `apps/web/src/server/services/{lesson-read,issue,slot,candidate,transition,approve}-service.ts`, `apps/web/app/api/lessons/**` (except suggestions, heartbeats), `apps/web/src/server/wiring/review.ts` | planned |
| 3 | A13 metrics | `apps/web/src/server/services/{heartbeat,board}-service.ts`, `apps/web/app/api/units/[unitId]/{board,metrics}/**`, `apps/web/app/api/lessons/[lessonId]/heartbeats/**`, `apps/web/src/server/wiring/metrics.ts` | planned |
| 3–4 | A20 evals | `evals/**`, `load/**`, `ops/faults/**`, `ops/import-spike.ts`, `packages/db/src/repos/evidence.ts` | planned |
| 0–3 | A21 ops | `ops/{seed.ts,backup.sh}`, `apps/{worker,collab}/src/health.ts`, `apps/web/app/api/healthz/**` | planned |
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
