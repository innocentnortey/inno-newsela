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
port interfaces in `ports.ts`) → `packages/{schema,editor-schema}`; adapters `packages/{db,llm,ydoc}` and
`apps/web/src/server/adapters/*` implement the ports; `packages/db/migrations/` holds **all** DDL. Detail: DO-3 §1–§3.

## Areas and waves

| Wave | Area | Responsibility | Owns (all planned) | Status |
|---|---|---|---|---|
| FW | FW presentation | Tokens, typography, accessible components, layout, gallery | `apps/web/{package.json,…}`, `apps/web/src/styles/**`, `apps/web/src/components/**`, `apps/web/app/(dev)/**` (per `docs/plans/foundation-wave.md`) | planned (FW tickets ready) |
| 0 | A0 platform | Workspace, Compose, images, settings, logger, composition roots | `package.json`, `tsconfig.base.json`, `docker-compose.yml`, `Dockerfile.web`, `Dockerfile.node`, `render.yaml`, `packages/config/**`, `packages/obs/**`, `apps/{web/src/server/container.ts,worker/src/main.ts,collab/src/main.ts}` | planned |
| 0 | A1 storage | All DDL, pool, transactions, migrations, audit log, the port interfaces | `packages/db/migrations/**`, `packages/db/src/{pool,tx,migrate}.ts`, `packages/db/src/repos/audit.ts`, `packages/core/src/ports.ts` | planned |
| 0 | A2 schema | Zod schemas (outline, UnitPlan, LessonDraft, Lesson, export, API mirrors), ProseMirror node schema, JSON Schema emitter | `packages/schema/**`, `packages/editor-schema/**`, `docs/contracts/schemas/**` | planned |
| 1 | A3 auth | Sessions, allow-list, route wrapper, refusal envelope | `apps/web/src/server/http/**` (incl. `passwords.ts`), `apps/web/src/server/services/session-service.ts`, `packages/db/src/repos/sessions.ts`, `apps/web/app/api/session/**`, `apps/web/middleware.ts` | planned |
| 1 | A4 intake | Workbook parsing, normalizer, standards index, lesson links, validation report, sheet fetch | `packages/core/src/intake/**`, `apps/web/src/server/services/outline-service.ts`, `apps/web/src/server/adapters/google-sheets.ts`, `packages/db/src/repos/outlines.ts`, `apps/web/app/api/{units,outline-versions}/**` | planned |
| 1 | A5 compile | LessonDraft → ProseMirror compiler, templates, addresses, Y.Doc conversion and hashing | `packages/core/src/compile/**`, `packages/ydoc/**` | planned |
| 1 | A6 checks | Check rules, policy, gates, check-job runner, check queue and issues | `packages/core/src/checks/**` (incl. `context-loader.ts`, shared by worker, collab freeze and web Approve), `apps/worker/src/checks/**`, `packages/db/src/repos/check-queue.ts` | planned |
| 1 | A7 llm | ModelClient port, Anthropic adapter, stub, recorder, prices, prompts | `packages/llm/src/{model-client,anthropic,stub,recorder,prices}.ts`, `packages/prompts/**`, `packages/db/src/repos/model-calls.ts` | planned |
| 1 | A8 spend | Reserve-then-settle math and ledger | `packages/core/src/spend/**`, `packages/db/src/repos/spend.ts` | planned |
| 2 | A9 generation | Claim loop, unit plan job, lesson job runner and nodes, run finalizer, queue SQL | `apps/worker/src/{queue,generation}/**`, `packages/core/src/pipeline/**`, `packages/db/src/repos/job-queue.ts` | planned |
| 2 | A10 runs | Start run, progress, control, plan, summary (CON-5…8, 21) | `apps/web/src/server/services/run-service.ts`, `packages/core/src/lifecycle/run-machine.ts`, `packages/db/src/repos/runs.ts`, `apps/web/app/api/runs/**` | planned |
| 2 | A11 collab | Hocuspocus auth, write guard, persistence, acks, internal commands; the web client for them; the store transaction | `apps/collab/**` (except `main.ts`, `health.ts`), `apps/web/src/server/adapters/collab-commands.ts`, `packages/db/src/repos/lesson-docs.ts` | planned |
| 2 | A12 review | Lesson read, issues, resolutions, slots, candidates, transitions, history (CON-11, 13–16, 18, 19) | `apps/web/src/server/services/{lesson-read,issue,slot,candidate,transition}-service.ts`, `packages/core/src/lifecycle/lesson-machine.ts`, `packages/db/src/repos/{lessons,review-extras}.ts`, `apps/web/app/api/lessons/**` (except suggestions, heartbeats) | planned |
| 2 | A13 metrics | Heartbeats, sessions, frozen metrics row, board and unit metrics (CON-9, 10, 20) | `packages/core/src/metrics/**`, `apps/web/src/server/services/{heartbeat,board,metrics-writer}-service.ts`, `packages/db/src/repos/metrics.ts`, `apps/web/app/api/units/[unitId]/{board,metrics}/**`, `apps/web/app/api/lessons/[lessonId]/heartbeats/**` | planned |
| 2 | A14 web-ui | Feature screens, the collaborative editor, the typed API client | `apps/web/app/(app)/**`, `apps/web/src/editor/**`, `apps/web/src/lib/api-client.ts`, `apps/web/src/features/**` | planned |
| 3 | A15 assist (cut #8) | AI suggestion request and decision (CON-17) | `apps/web/src/server/services/suggestion-service.ts`, `apps/web/app/api/lessons/[lessonId]/suggestions/**` | planned |
| 3 | A16 prompts (save cut #7) | Prompt versions and guidance saves (CON-24) | `apps/web/src/server/services/prompt-service.ts`, `packages/db/src/repos/prompts.ts`, `apps/web/app/api/prompt-versions/**` | planned |
| 3 | A17 export (cut #5) | Idempotent export of approved snapshots (CON-23) | `apps/web/src/server/services/export-service.ts`, `packages/db/src/repos/exports.ts`, `docs/contracts/lesson-export.schema.json`, `apps/web/app/api/{units/[unitId]/exports,exports}/**` | planned |
| 3 | A18 coverage (cut #4) | Coverage matrix route (CON-22) | `apps/web/app/api/units/[unitId]/coverage/**` | planned |
| 3 | A19 judge (cut #2) | Advisory judge job and OpenRouter adapter | `apps/worker/src/judge/**`, `packages/llm/src/openrouter-judge.ts`, `packages/db/src/repos/judge.ts` | planned |
| 2–3 | A20 evals | Eval runner and suites, full-run report, fault script, load spike, spike importer | `evals/**`, `load/**`, `ops/faults/**`, `ops/import-spike.ts`, `packages/db/src/repos/evidence.ts` | planned |
| 0–3 | A21 ops | Seeds, backup, health routes | `ops/{seed.ts,backup.sh}`, `apps/{worker,collab}/src/health.ts`, `apps/web/app/api/healthz/**` | planned |

## Ports → adapters (DO-3 §3)

`ModelClient` → `AnthropicMessagesAdapter`, `StubModelClient` · `JudgeClient` → `OpenRouterJudgeAdapter`,
`StubJudgeClient` · `SheetFetcher` → `GoogleSheetsExportFetcher` · `CollabCommands` → `HttpCollabCommandClient`
(client) and `CollabCommandHandler` (server) · storage ports → `Pg*` classes in `packages/db/src/repos/` · `Clock` →
`SystemClock`, `FakeClock` · `IdGenerator` → `PrefixedIdGenerator`. All planned.

## Tables

All tables are created only by A1 in `packages/db/migrations/` (planned); the full list with writers is DO-3 §6.
`app_user`, `app_session`, `unit`, `outline_version`, `outline_row`, `intake_choice`, `standard`, `lesson_link`,
`prompt_version`, `run`, `unit_plan`, `lesson_job`, `spend_reservation`, `model_call`, `lesson`, `lesson_version`,
`lesson_doc`, `check_job`, `issue`, `alignment_link`, `safety_flag`, `suggestion`, `review_event`, `audit_event`,
`heartbeat`, `review_session`, `lesson_metrics`, `export_bundle`, `judge_verdict`, `eval_run`, `eval_case_result`,
`probe_run`, `experiment_run`, `ops_event`, `schema_migrations`; view `audit_log_v`.
