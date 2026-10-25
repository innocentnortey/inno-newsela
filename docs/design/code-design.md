# Code design (DO-3) — Newsela Lesson Studio

**Owner of:** which modules, packages and tables implement the components in the [architecture](architecture.md)
(DO-2); each module's one-sentence responsibility, the interface it exposes, what it depends on and which way the
dependency points; the build areas that §7 cuts tickets along; every seam we considered, **cut** or **deferred**; the
canonical Postgres table names and their single owner; the typed settings; and who constructs what.
**Written:** 2026-10-25 by Claude (System track, §6). **Status:** ready — Claude's recommendation adopted under
Innocent's standing authorization (PD-32). **Mirrored to:** [`.claude/reference/area-map.md`](../../.claude/reference/area-map.md)
(every path there is *planned* until it exists).
**Interface spec state:** all 24 cards `agreed` (System review [`2026-10-25-system-review.md`](../contracts/reviews/2026-10-25-system-review.md)); this design follows the agreed cards.
**Read with:** [component contracts](component-contracts.md) (DO-4: the exact signatures, record fields, error types and
constructors for everything named here), the interface spec [`docs/contracts/INTERFACE.md`](../contracts/INTERFACE.md)
(every external promise; this file never restates a card), [system design](system-design.md) (DO-1),
[observability](observability.md) (DO-6), [evaluation plan](eval-plan.md) (DO-5),
[metrics registry](metrics-registry.md) (DO-7), [foundation wave](../plans/foundation-wave.md) (FW, already ready).

Rules applied: `.claude/rules/code-design-solid-modularity.md` (look for seams, cut only the ones that pay),
`.claude/rules/agent-architecture.md` (fixed pipeline, typed state, pure routers, explicit brakes),
`.claude/rules/code-structure.md` (one file, one responsibility; size caps).

## What it looks like in practice

Take the traced job from DO-1 §4.2: row 8 becomes Lesson 4.

1. `apps/worker/src/queue/claim-loop.ts` asks the **`JobQueue` port** for a job; `PgJobQueue` (in `packages/db`) runs the
   `SKIP LOCKED` claim and returns a typed `ClaimedJob`.
2. `apps/worker/src/generation/lesson-job-runner.ts` steps a typed `LessonJobState` through fixed nodes: reserve spend
   (the **pure** `packages/core/src/spend/reservation.ts` decides, `PgSpendLedger` applies it atomically), render the
   prompt (`packages/prompts`), call the model through **`ModelCallRecorder`** (which writes the `model_call` row first
   and calls the **`ModelClient` port**; `AnthropicMessagesAdapter` is the only file that imports the Anthropic SDK),
   parse with the Zod `LessonDraft` (`packages/schema`), compile with the **pure** `packages/core/src/compile/`, run the
   **pure** check suite `packages/core/src/checks/`, let the **pure** router `route-after-checks.ts` pick store, repair
   or fail, and store v1 through the **`LessonDocStore` port** (the same store function the collaboration server uses).
3. The board's poll (`apps/web/app/api/runs/[runId]/progress/route.ts`) calls `RunService.getProgress`, which reads
   `lesson_job` rows through `RunRepo` and returns the OpenAPI `RunProgress` shape.

Swap Anthropic for another provider and one adapter file changes. Change the 3-word quote threshold after SP-3 and one
policy constant changes. Add a check rule and one file is added to `checks/rules/` plus one registry line. Nothing in
`packages/core` imports a database driver, an SDK, Next.js, Yjs or Hocuspocus.

---

## 1. Repository layout (npm workspaces, all TypeScript)

One repository, one root `package.json` with npm workspaces (npm, not pnpm: the FW record's choice — Node 24, npm 11 —
so DO-5's `pnpm <script>` commands run as `npm run <script>` with the same names). **`apps/web/` is adopted as FW
created it**; the root workspace file lists it, nothing inside it moves.

```
package.json                 # workspaces: apps/*, packages/*, evals, load, ops; root scripts (§9)
tsconfig.base.json
docker-compose.yml           # web, worker, collab, postgres (internal network; Postgres not published)
Dockerfile.web               # image 1: apps/web
Dockerfile.node              # image 2: apps/worker and apps/collab, two entry points (AD-15)
render.yaml                  # committed, not provisioned (PD-15 D)
apps/
  web/                       # Next.js App Router: pages, HTTP API for CON-1..11, 13..24, server services
  worker/                    # Node: lesson_job + check_job claim loops, generation pipeline, judge (cut #2)
  collab/                    # Node: one Hocuspocus server (CON-12) + internal command routes
packages/
  schema/                    # Zod: outline, UnitPlan, LessonDraft, Lesson, export, API shapes; JSON Schema emitter
  editor-schema/             # the one ProseMirror node schema (HP-4 addendum), shared by compiler, editor, collab
  core/                      # pure domain: intake, compile, checks, spend, lifecycle, pipeline routing, metrics
  ydoc/                      # Lesson JSON <-> Y.Doc, canonical hash, state vector (Yjs + y-prosemirror only)
  db/                        # Postgres: migrations (ALL DDL), pool, transactions, repositories (port implementations)
  llm/                       # ModelClient port + Anthropic adapter, judge port + OpenRouter adapter, stubs, recorder, prices
  prompts/                   # locked prompt layer (files), renderers for plan, draft, repair, assist, judge
  config/                    # typed settings per process (Zod over env)
  obs/                       # JSON-lines logger, request ids, ops_event helper
evals/                       # eval runner, suites S1..S13, reports/, fixtures/ (DO-5)
load/                        # 200-user spike script (S14, WF-29/WF-30)
ops/                         # migrate, seed, backup, fault-injection scripts; ops/vps-run (existing launcher)
docs/contracts/schemas/      # JSON Schemas emitted from packages/schema (planned, build work); export schema at docs/contracts/lesson-export.schema.json (CON-23)
```

**Dependency direction (arrows point at what is depended on):**

```
apps/web ─┐                 ┌─> packages/llm ─────┐
apps/worker ┼─> services ───┼─> packages/db ──────┼─> packages/core ─> packages/schema
apps/collab ┘               ├─> packages/ydoc ────┤                  └> packages/editor-schema
                            ├─> packages/prompts ─┘
                            └─> packages/config, packages/obs
```

- `packages/core` depends only on `packages/schema` and `packages/editor-schema` (types and the node schema). It defines
  the **ports** (TypeScript interfaces) that `packages/db`, `packages/llm` and the apps implement. It never imports `pg`,
  `@anthropic-ai/sdk`, `yjs`, `@hocuspocus/*`, `next` or `node:http`.
- `packages/db`, `packages/llm`, `packages/ydoc` are adapters: they depend on `core`'s port types and on their one
  external library each.
- Apps are composition roots: they read settings, construct adapters, inject them into services, and expose entry points.
  An app never imports another app.
- A lint rule (`eslint-plugin-boundaries` or `no-restricted-imports`) encodes these arrows; `code-review-agent` checks it.

## 2. Modules

Every module below has one reason to change. The *Interface* column names the DO-4 type; DO-4 has its full signature.
*Owner area* is the build area in §4.

### 2.1 Shared packages

| Module | Responsibility (one sentence) | Interface (DO-4) | Depends on | Owner area |
|---|---|---|---|---|
| `packages/schema/src/outline.ts` | Defines the normalized outline types (row kinds, segments, codes, findings). | `NormalizedOutline`, `NormalizedRow`, `IntakeFinding` | zod | A2 schema |
| `packages/schema/src/unit-plan.ts` | Defines the `UnitPlan` the model fills (R-8). | `UnitPlanDraft` | zod | A2 schema |
| `packages/schema/src/lesson-draft.ts` | Defines the `LessonDraft` of role-tagged blocks the model fills; no `quote` block type (HP-2). | `LessonDraft`, `DraftBlock` | zod | A2 schema |
| `packages/schema/src/lesson.ts` | Defines the stored `Lesson` record (front matter, sections as ProseMirror JSON, `schema_version`). | `StoredLesson` | zod, `editor-schema` | A2 schema |
| `packages/schema/src/export.ts` | Defines the export bundle shape (R-42). | `ExportBundleFile` | zod | A2 schema |
| `packages/schema/src/api/*.ts` | Zod mirrors of every OpenAPI component, named exactly as in `interface.openapi.yaml`. | OpenAPI component names | zod | A2 schema |
| `packages/schema/scripts/emit-json-schemas.ts` | Writes `docs/contracts/schemas/*.schema.json` and `docs/contracts/lesson-export.schema.json` from the Zod schemas. | `emit_json_schemas` | zod-to-json-schema | A2 schema |
| `packages/editor-schema/src/schema.ts` | Declares the ProseMirror node and mark schema mirroring Newsela's nodes and role marks; unknown nodes fail loudly. | `EDITOR_SCHEMA`, `SCHEMA_VERSION`, `assert_known_nodes` | prosemirror-model | A2 schema |
| `packages/core/src/intake/parse-grid.ts` | Turns CSV or XLSX bytes into a cell grid. | `parse_workbook` | SheetJS (pure parsing library) | A4 intake |
| `packages/core/src/intake/normalize.ts` | Normalizes a cell grid into typed rows, findings and proposals in plain code (HP-6, PD-27). | `normalize_outline` | `schema`, `standards-index.ts` | A4 intake |
| `packages/core/src/intake/standards-index.ts` | Resolves codes against the seeded CDE text (leaves, parents, ELD verdict table). | `StandardsIndex` | `schema` | A4 intake |
| `packages/core/src/intake/lesson-links.ts` | Computes cross-lesson `lesson_link` records from the rows (HP-1). | `compute_lesson_links` | `schema` | A4 intake |
| `packages/core/src/intake/report.ts` | Builds the validation report and the Generate gate from rows and choices. | `build_validation_report`, `generate_gate` | `schema` | A4 intake |
| `packages/core/src/compile/compile-draft.ts` | Compiles a `LessonDraft` into allow-listed ProseMirror JSON with section templates and minutes. | `compile_draft` | `schema`, `editor-schema`, `templates.ts` | A5 compile |
| `packages/core/src/compile/templates.ts` | Holds the section templates and minutes per lesson type (R-11). | `SECTION_TEMPLATES` | `schema` | A5 compile |
| `packages/core/src/compile/addresses.ts` | Assigns reviewer-citable part addresses (R-21). | `assign_addresses` | `schema` | A5 compile |
| `packages/core/src/checks/registry.ts` | Lists the check rules and runs them over one lesson. | `CheckRule`, `run_checks` | `checks/rules/*` | A6 checks |
| `packages/core/src/checks/rules/*.ts` | One rule per file (R-19 as amended); each returns findings, never throws for content. | `CheckRule` | `schema`, `policy.ts` | A6 checks |
| `packages/core/src/checks/policy.ts` | Holds the business-tunable thresholds (quote span ≥ 3 words, reviewer quote ≤ 12, name-scan scope, vocabulary cap). | `CheckPolicy` | — | A6 checks |
| `packages/core/src/checks/gates.ts` | Decides Submit and Approve readiness from issues, confirmations and suggestions, in the card's error precedence (CON-18). | `submit_gate`, `approve_gate` | `schema` | A6 checks |
| `packages/core/src/checks/context-loader.ts` | Assembles a `CheckContext` (outline row, standards, links, linked lessons' stored rows, suggestions, flags) for one stored lesson, through ports only. | `CheckContextLoader` | ports in `core/ports.ts` | A6 checks |
| `packages/core/src/spend/reservation.ts` | Computes a call's maximum cost and decides a reservation against run, user-day and build caps (PD-14, PD-29). | `max_call_cost`, `decide_reservation`, `settle_cost`, `run_cap_for` | — | A8 spend |
| `packages/core/src/lifecycle/lesson-machine.ts` | Decides whether a lesson move is allowed for a role and state, and what it writes (R-33 as amended). | `decide_transition` | `schema` | A12 review |
| `packages/core/src/lifecycle/run-machine.ts` | Derives run state and tile state from job rows; decides run-control moves. | `derive_run_state`, `tile_state`, `decide_run_control` | `schema` | A10 runs |
| `packages/core/src/pipeline/route-after-checks.ts` | Pure router: store, repair or fail from check results and counters (HP-1). | `route_after_checks` | `schema` | A9 generation |
| `packages/core/src/pipeline/circuit-breaker.ts` | Decides whether a run pauses (3 lessons in a row failing the same check). | `should_pause_run` | — | A9 generation |
| `packages/core/src/metrics/sessions.ts` | Merges heartbeats into active intervals across tabs (HP-8, R-49). | `merge_heartbeats` | — | A13 metrics |
| `packages/core/src/metrics/frozen-row.ts` | Computes the frozen per-lesson metrics row at first approval. | `compute_lesson_metrics` | `sessions.ts` | A13 metrics |
| `packages/core/src/ports.ts` | Declares every port interface the adapters implement (§3). | the Port table | `schema` | A1 storage (shared file, append-only) |
| `packages/ydoc/src/convert.ts` | Converts `StoredLesson` JSON to and from Y.Doc bytes (one fragment per section, front matter as a Y.Map). | `lesson_to_ydoc`, `ydoc_to_lesson` | yjs, y-prosemirror, `editor-schema` | A5 compile |
| `packages/ydoc/src/hash.ts` | Canonical JSON SHA-256 of a lesson and base64 state vectors. | `content_hash`, `state_vector_of`, `covers` | yjs, node:crypto | A5 compile |
| `packages/llm/src/model-client.ts` | The `ModelClient` port re-export and the logical aliases (GENERATION, REPAIR, ASSIST, JUDGE). | `ModelAlias` | `core/ports` | A7 llm |
| `packages/llm/src/anthropic.ts` | The only module that imports the Anthropic SDK; one structured call per request. | `AnthropicMessagesAdapter` | @anthropic-ai/sdk | A7 llm |
| `packages/llm/src/openrouter-judge.ts` | The only module that calls OpenRouter; binary verdicts (cut #2). | `OpenRouterJudgeAdapter` | fetch | A19 judge |
| `packages/llm/src/stub.ts` | Deterministic stub provider for tests, capture checks, faults and load (no spend). | `StubModelClient`, `StubJudgeClient` | `core/ports` | A7 llm |
| `packages/llm/src/recorder.ts` | The one logged, retried wrapper every model call goes through; writes `model_call` before and after. | `ModelCallRecorder` | `ModelClient`, `ModelCallLog`, `Clock` | A7 llm |
| `packages/llm/src/prices.ts` | Model prices per million tokens, confirmed at build from the provider docs (PD-12). | `PRICE_TABLE` | — | A7 llm |
| `packages/prompts/src/render.ts` | Renders the locked layer, the pinned guidance, delimited outline data and the output schema into a prompt. | `PromptRenderer` | `schema`, `locked/*.md` | A7 llm |
| `packages/prompts/locked/*.md` | The locked prompt layer, versioned by file hash; no write path exists (R-38). | file contents | — | A7 llm |
| `packages/config/src/*.ts` | Parses environment variables into typed settings, one object per process. | `SharedSettings`, `WebSettings`, `WorkerSettings`, `CollabSettings` | zod | A0 platform |
| `packages/obs/src/logger.ts` | JSON-lines logger with `service`, `build_id`, `request_id`; never logs lesson text or keys. | `Logger` | — | A0 platform |

### 2.2 Storage (`packages/db`, owner area A1)

| Module | Responsibility (one sentence) | Interface (DO-4) | Depends on | Owner area |
|---|---|---|---|---|
| `packages/db/migrations/*.sql` | Holds **all** DDL for every table in §6, applied in order; the only place a table or column is created. | SQL files | Postgres 16 | A1 storage |
| `packages/db/src/pool.ts` | Builds one `pg.Pool` per process with its size and acquire timeout. | `PgDatabase` | pg, `config` | A1 storage |
| `packages/db/src/tx.ts` | Runs a function in one transaction, with an optional advisory lock. | `PgDatabase.with_tx` | `pool.ts` | A1 storage |
| `packages/db/src/migrate.ts` | Applies pending migrations and records each in `schema_migrations` and `ops_event`. | `run_migrations` | `pool.ts` | A1 storage |
| `packages/db/src/repos/sessions.ts` | Users, sessions and the allow-list. | `PgSessionRepo` | `tx.ts` | A3 auth |
| `packages/db/src/repos/outlines.ts` | Units, outline versions, rows, intake choices, standards, lesson links. | `PgOutlineRepo`, `PgStandardRepo` | `tx.ts` | A4 intake |
| `packages/db/src/repos/runs.ts` | Runs, unit plans and run reads (progress, summary). | `PgRunRepo` | `tx.ts` | A10 runs |
| `packages/db/src/repos/job-queue.ts` | The `lesson_job` queue: create, fair-share claim, lease, finish, requeue expired. | `PgJobQueue` | `tx.ts` | A9 generation |
| `packages/db/src/repos/spend.ts` | Atomic reservation and settlement under one advisory lock. | `PgSpendLedger` | `tx.ts`, `core/spend` | A8 spend |
| `packages/db/src/repos/model-calls.ts` | `model_call` rows: insert before send, complete on arrival, mark lost, checkpoint lookup. | `PgModelCallLog` | `tx.ts` | A7 llm |
| `packages/db/src/repos/lesson-docs.ts` | The lesson store transaction (Y.Doc + derived JSON + hash + state vector + `check_job`), and v1 seeding. | `PgLessonDocStore` | `tx.ts`, `ydoc` | A11 collab |
| `packages/db/src/repos/check-queue.ts` | The coalesced `check_job` queue and issue writes keyed to a hash. | `PgCheckQueue`, `PgIssueRepo` | `tx.ts` | A6 checks |
| `packages/db/src/repos/lessons.ts` | Lessons, versions and snapshots, review events, last editor, dependencies. | `PgLessonRepo` | `tx.ts` | A12 review |
| `packages/db/src/repos/review-extras.ts` | Safety flags, alignment links, suggestions. | `PgSafetyFlagRepo`, `PgAlignmentRepo`, `PgSuggestionRepo` | `tx.ts` | A12 review |
| `packages/db/src/repos/audit.ts` | Append-only `audit_event` writes and the history view. | `PgAuditLog` | `tx.ts` | A1 storage |
| `packages/db/src/repos/metrics.ts` | Heartbeats, review sessions, frozen metrics rows, aggregate reads. | `PgMetricsRepo` | `tx.ts` | A13 metrics |
| `packages/db/src/repos/prompts.ts` | Prompt versions (locked hash + guidance) and pins. | `PgPromptRepo` | `tx.ts` | A16 prompts |
| `packages/db/src/repos/exports.ts` | Export bundles. | `PgExportRepo` | `tx.ts` | A17 export |
| `packages/db/src/repos/evidence.ts` | Eval, probe, experiment and ops records. | `PgEvidenceRepo` | `tx.ts` | A20 evals |
| `packages/db/src/repos/judge.ts` | Judge verdicts (cut #2). | `PgJudgeRepo` | `tx.ts` | A19 judge |

### 2.3 Web app (`apps/web`)

Route files are thin: parse the request with the Zod mirror of the OpenAPI request schema, call one service method, map a
`DomainRefusal` to the error envelope. Services hold one workflow each and receive their ports by constructor.

| Module | Responsibility (one sentence) | Interface (DO-4) | Depends on | Owner area |
|---|---|---|---|---|
| `apps/web/src/server/http/with-route.ts` | Wraps every route: session, `Origin` check on mutations, role check, request id, Zod parse (`INVALID_REQUEST`), pool wait (`SERVICE_BUSY` + `Retry-After`), refusal → envelope, latency log line. | `with_route` | `SessionService`, `obs` | A3 auth |
| `apps/web/src/server/http/passwords.ts` | Hashes and verifies seeded-account passwords with scrypt (CON-1). | `hash_password`, `verify_password` | node:crypto | A3 auth |
| `apps/web/src/server/http/refusal.ts` | Maps `DomainRefusal` codes to the HTTP status the card fixes and builds the envelope. | `to_error_response` | `schema/api` | A3 auth |
| `apps/web/src/server/container.ts` | Composition root: builds settings, the database, adapters and every web service once per process. | `build_web_services` | all web services | A0 platform |
| `apps/web/src/server/services/session-service.ts` | Signs in with email and password on seeded accounts, resolves sessions, signs out (CON-1). | `SessionService` | `SessionRepo`, `AuditLog`, `Clock` | A3 auth |
| `apps/web/src/server/services/outline-service.ts` | Stores outline versions, builds the validation report, records intake choices (CON-2, 3, 4). | `OutlineService` | `OutlineRepo`, `StandardRepo`, `SheetFetcher`, `core/intake`, `AuditLog` | A4 intake |
| `apps/web/src/server/adapters/google-sheets.ts` | Fetches a public Google Sheet export URL once (TB-5). | `GoogleSheetsExportFetcher` | fetch | A4 intake |
| `apps/web/src/server/services/run-service.ts` | Starts runs, reads progress, plan and summary, applies run control (CON-5, 6, 7, 8, 21). | `RunService` | `RunRepo`, `JobQueue`, `PromptRepo`, `SpendLedger`, `core/lifecycle/run-machine`, `AuditLog` | A10 runs |
| `apps/web/src/server/services/board-service.ts` | Reads the unit board, unit metrics and coverage matrix from stored rows (CON-9, 10, 22). | `BoardService` | `LessonRepo`, `MetricsRepo`, `AlignmentRepo` | A13 metrics |
| `apps/web/src/server/services/lesson-read-service.ts` | Reads a lesson (derived row or snapshot) and its history (CON-11, CON-19). | `LessonReadService` | `LessonRepo`, `LessonDocStore`, `AuditLog`, `editor-schema` | A12 review |
| `apps/web/src/server/services/issue-service.ts` | Reads issues as of a hash, records resolutions, clears safety flags, decides standards (CON-13, CON-14). | `IssueService` | `IssueRepo`, `CheckQueue`, `SafetyFlagRepo`, `CollabCommands`, `AuditLog` | A12 review |
| `apps/web/src/server/services/slot-service.ts` | Validates and fills a placeholder or excerpt slot through the collaboration server (CON-15). | `SlotService` | `LessonRepo`, `CollabCommands`, `CheckPolicy` | A12 review |
| `apps/web/src/server/services/candidate-service.ts` | Queues a one-lesson candidate run, reads a candidate, adopts it through the collaboration server (CON-16). | `CandidateService` | `RunRepo`, `JobQueue`, `LessonRepo`, `SpendLedger`, `CollabCommands` | A12 review |
| `apps/web/src/server/services/transition-service.ts` | Applies one lesson move with every gate re-checked on the server (CON-18); Submit and the unfreezing moves go through the collaboration server, Approve does not (the document is already frozen). | `TransitionService` | `LessonRepo`, `IssueRepo`, `SuggestionRepo`, `CollabCommands`, `MetricsWriter`, `CheckContextLoader`, `core/lifecycle`, `core/checks` | A12 review |
| `apps/web/src/server/services/heartbeat-service.ts` | Records review heartbeats and extends review sessions (CON-20). | `HeartbeatService` | `MetricsRepo`, `Clock` | A13 metrics |
| `apps/web/src/server/services/metrics-writer.ts` | Writes the frozen `lesson_metrics` row once at first approval (R-49, R-60). | `MetricsWriter` | `MetricsRepo`, `core/metrics` | A13 metrics |
| `apps/web/src/server/services/suggestion-service.ts` | Requests an AI rewrite and applies or rejects it (CON-17, cut #8). | `SuggestionService` | `ModelCallRecorder`, `SpendLedger`, `SuggestionRepo`, `CollabCommands`, `PromptRenderer` | A15 assist |
| `apps/web/src/server/services/prompt-service.ts` | Lists prompt versions and saves guidance versions (CON-24; the save is cut #7). | `PromptService` | `PromptRepo`, `AuditLog` | A16 prompts |
| `apps/web/src/server/services/export-service.ts` | Builds idempotent export bundles of approved snapshots (CON-23, cut #5). | `ExportService` | `LessonRepo`, `ExportRepo`, `AuditLog` | A17 export |
| `apps/web/src/server/adapters/collab-commands.ts` | Calls the collaboration server's internal command routes over the Compose network. | `HttpCollabCommandClient` | fetch, `CollabSettings.internal_url` | A11 collab |
| `apps/web/app/api/**/route.ts` | One thin route file per OpenAPI path (§5 of DO-4 lists them). | `with_route` handlers | services | the service's area |
| `apps/web/app/(app)/**` | Feature screens SCR-n, assembled from FW components against contract mocks (Prism) then the real API. | React pages | `src/components/**`, `src/lib/api-client.ts` | A14 web-ui |
| `apps/web/src/lib/api-client.ts` | Typed fetch client generated from the OpenAPI file (`openapi-typescript`). | generated types | OpenAPI file | A14 web-ui |
| `apps/web/src/editor/**` | ProseMirror editor bound to Yjs through `y-prosemirror` and `@hocuspocus/provider`. | React editor component | `editor-schema`, CON-12 | A14 web-ui |
| `apps/web/src/components/**`, `app/(dev)/**` | FW presentation components and gallery (owned by FW-1…FW-4; unchanged). | FW | — | FW |

### 2.4 Worker (`apps/worker`)

| Module | Responsibility (one sentence) | Interface (DO-4) | Depends on | Owner area |
|---|---|---|---|---|
| `apps/worker/src/main.ts` | Composition root and signal handling: builds the runtime, starts both claim loops, drains on SIGTERM. | `build_worker_runtime` | everything below | A0 platform |
| `apps/worker/src/queue/claim-loop.ts` | Claims generation jobs up to the concurrency cap, renews leases, requeues expired leases at start. | `ClaimLoop` | `JobQueue`, `Clock` | A9 generation |
| `apps/worker/src/generation/unit-plan-job.ts` | Runs the one `UnitPlan` call per run and stores it before any lesson job is claimable (R-8). | `UnitPlanJob` | `ModelCallRecorder`, `PromptRenderer`, `RunRepo`, `SpendLedger` | A9 generation |
| `apps/worker/src/generation/lesson-job-runner.ts` | Steps one lesson job through the fixed nodes and records its terminal outcome. | `LessonJobRunner` | the nodes below | A9 generation |
| `apps/worker/src/generation/nodes/*.ts` | One node per step: reserve, draft, compile-and-check, repair, store, settle, fail. | `ReserveNode`, `DraftNode`, `CompileCheckNode`, `RepairNode`, `StoreNode`, `SettleNode`, `FailNode` | ports and pure core | A9 generation |
| `apps/worker/src/generation/run-finalizer.ts` | Moves a run to its terminal or paused state and runs the end-of-run completeness query. | `RunFinalizer` | `RunRepo`, `JobQueue`, `core/lifecycle/run-machine`, `core/pipeline/circuit-breaker` | A9 generation |
| `apps/worker/src/checks/check-job-runner.ts` | Claims coalesced `check_job` rows from its own lane (never behind generation), runs the suite on the stored derived row, writes issues, re-queues dependants. | `CheckJobRunner` | `CheckQueue`, `LessonDocStore`, `IssueRepo`, `CheckContextLoader`, `core/checks` | A6 checks |
| `apps/worker/src/judge/judge-job.ts` | Runs the advisory judge per (activity, standard) and stores verdicts (cut #2). | `JudgeJob` | `JudgeClient`, `ModelCallLog`, `JudgeRepo` | A19 judge |
| `apps/worker/src/health.ts` | Serves `GET /healthz` for the worker (WF-39). | `serve_health` | `PgDatabase` | A21 ops |

### 2.5 Collaboration server (`apps/collab`)

| Module | Responsibility (one sentence) | Interface (DO-4) | Depends on | Owner area |
|---|---|---|---|---|
| `apps/collab/src/main.ts` | Composition root: builds the Hocuspocus server with its extensions and the internal routes. | `build_collab_runtime` | everything below | A0 platform |
| `apps/collab/src/auth.ts` | `onAuthenticate`: resolves the app session from the cookie and loads the lesson's state and the role. | `CollabAuthenticator` | `SessionRepo`, `LessonRepo` | A11 collab |
| `apps/collab/src/permissions.ts` | Decides read-only versus write per connection and refuses writes on a locked document with a `refused` message. | `WriteGuard` | `core/lifecycle` | A11 collab |
| `apps/collab/src/persistence.ts` | `onLoadDocument` and `onStoreDocument`: loads the latest stored doc and runs the store transaction after the debounce. | `LessonPersistence` | `LessonDocStore`, `ydoc` | A11 collab |
| `apps/collab/src/acks.ts` | Sends the `stored` and `mode` stateless messages to every connection of a document. | `AckBroadcaster` | Hocuspocus | A11 collab |
| `apps/collab/src/commands/routes.ts` | Internal HTTP routes (token-guarded, Compose network only) that execute `CollabCommands`. | `CollabCommandHandler` | `commands/*` | A11 collab |
| `apps/collab/src/commands/lock-and-snapshot.ts` | Submit (the internal freeze call): lock, store at once, check the client state vector is covered, re-run the blocking checks on the stored row, write the snapshot, the state change and the transition in one transaction, then broadcast read-only; SP-2 fallback closes every connection instead of locking in place. | `CollabCommandHandler.lock_and_snapshot` | `LessonDocStore`, `LessonRepo`, `CheckContextLoader`, `run_checks`, `submit_gate`, `core/lifecycle` | A11 collab |
| `apps/collab/src/commands/apply-edit.ts` | Applies an HTTP-started content edit (standard decision, slot fill, candidate adopt, suggestion accept) as a tagged transaction by a named person, then stores. | `CollabCommandHandler.apply_edit` | `ydoc`, `editor-schema` | A11 collab |
| `apps/collab/src/commands/set-mode.ts` | Unfreezes (Withdraw, Request changes, Reopen) or re-freezes every connection of a lesson after the web app commits the state change. | `CollabCommandHandler.set_mode` | `AckBroadcaster` | A11 collab |
| `apps/collab/src/health.ts` | `GET /healthz` through Hocuspocus `onRequest` (WF-39). | `serve_health` | `PgDatabase` | A21 ops |

### 2.6 Evaluation, load and operations scripts

| Module | Responsibility (one sentence) | Interface (DO-4) | Depends on | Owner area |
|---|---|---|---|---|
| `evals/src/runner.ts` | Runs a named suite, writes `eval_run` and one `eval_case_result` per case, writes the report file. | `EvalRunner` | `EvidenceRepo`, suite modules | A20 evals |
| `evals/src/suites/*.ts` | One module per DO-5 suite (S1…S13); each yields typed case results. | `EvalSuite` | `core`, stubs or the real pipeline | A20 evals |
| `evals/src/full-run-report.ts` | Builds the S9 report from stored rows for one real run (WF-25). | `build_full_run_report` | `RunRepo`, `PgModelCallLog` | A20 evals |
| `ops/faults/run-faults.ts` | The HP-7 fault-injection script: kill, 429, truncation and cap tests on the stub (WF-28). | `run_fault_suite` | worker runtime, `StubModelClient` | A20 evals |
| `load/spike.ts` | The 200-user spike: HTTP mix and socket editors, provider stubbed, writes `probe_run` (WF-29, WF-30). | `run_spike` | `EvidenceRepo` | A20 evals |
| `ops/seed.ts` | Seeds CDE standards and one demo account per role (WF-37). | `seed_reference_data` | `PgDatabase` | A21 ops |
| `ops/backup.sh` | One `pg_dump` with path, size and SHA-256 recorded as an `ops_event` (WF-40). | shell | pg_dump | A21 ops |
| `ops/import-spike.ts` | Imports SP-1…SP-3 reports into `experiment_run` and `model_call` (WF-32…34). | `import_spike_report` | `EvidenceRepo` | A20 evals |

## 3. Ports and their adapters

A port is a TypeScript `interface` in `packages/core/src/ports.ts`. Services and pipeline nodes receive ports by
constructor; only composition roots name the implementations. Every external system has exactly one adapter.

| Port | Implemented by | External system | Used by | Seam |
|---|---|---|---|---|
| `ModelClient` | `AnthropicMessagesAdapter`, `StubModelClient` | Anthropic Messages API (generation, repair, AI assist) | `ModelCallRecorder` only | **cut**: external system, and the stub is the second implementation every capture test needs |
| `JudgeClient` | `OpenRouterJudgeAdapter`, `StubJudgeClient` | OpenRouter (judge, cut #2) | `JudgeJob` | **cut**: different provider and trust boundary (TB-4); A-3 says only the adapter changes if the route changes |
| `SheetFetcher` | `GoogleSheetsExportFetcher` | Google Sheets export URL | `OutlineService` | **cut**: external network call; tests use an in-memory fake |
| `CollabCommands` | `HttpCollabCommandClient` | the collaboration process (Hocuspocus) | `IssueService`, `SlotService`, `CandidateService`, `TransitionService`, `SuggestionService` | **cut**: crosses a process boundary; A-1 (one content writer) depends on it |
| `LessonDocStore` | `PgLessonDocStore` | Postgres | `LessonPersistence`, `StoreNode`, `CheckJobRunner`, `LessonReadService`, collab commands | **cut**: the HP-4 transaction lives in one place |
| `JobQueue` | `PgJobQueue` | Postgres | `ClaimLoop`, `RunService`, `CandidateService`, `RunFinalizer` | **cut**: HP-7's queue code is the riskiest SQL; a fake queue makes the runner testable |
| `CheckQueue` | `PgCheckQueue` | Postgres | `CheckJobRunner`, `IssueService` | **cut** |
| `SpendLedger` | `PgSpendLedger` | Postgres | `ReserveNode`, `SettleNode`, `UnitPlanJob`, `RunService`, `CandidateService`, `SuggestionService` | **cut**: the atomic reservation must be one implementation for every caller |
| `ModelCallLog` | `PgModelCallLog` | Postgres | `ModelCallRecorder`, `JudgeJob`, `RunService` | **cut** |
| `SessionRepo` | `PgSessionRepo` | Postgres | `SessionService`, `CollabAuthenticator` | **cut** (repository) |
| `OutlineRepo` | `PgOutlineRepo` | Postgres | `OutlineService`, `RunService`, `CheckContextLoader`, `PromptRenderer` callers | **cut** (repository) |
| `StandardRepo` | `PgStandardRepo` | Postgres | `OutlineService`, `CheckContextLoader` | **cut** (repository) |
| `RunRepo` | `PgRunRepo` | Postgres | `RunService`, `UnitPlanJob`, `RunFinalizer`, `CandidateService` | **cut** (repository) |
| `LessonRepo` | `PgLessonRepo` | Postgres | review services, `BoardService`, collab, `StoreNode` | **cut** (repository) |
| `IssueRepo` | `PgIssueRepo` | Postgres | `IssueService`, `TransitionService`, `CheckJobRunner` | **cut** (repository) |
| `SafetyFlagRepo` | `PgSafetyFlagRepo` | Postgres | `IssueService`, `CheckContextLoader` | **cut** (repository) |
| `AlignmentRepo` | `PgAlignmentRepo` | Postgres | `CheckJobRunner`, `BoardService`, `IssueService` | **cut** (repository) |
| `SuggestionRepo` | `PgSuggestionRepo` | Postgres | `SuggestionService`, `TransitionService`, `CheckContextLoader` | **cut** (repository) |
| `AuditLog` | `PgAuditLog` | Postgres | every web service that acts; collab commands | **cut** (repository) |
| `MetricsRepo` | `PgMetricsRepo` | Postgres | `HeartbeatService`, `MetricsWriter`, `BoardService` | **cut** (repository) |
| `PromptRepo` | `PgPromptRepo` | Postgres | `PromptService`, `RunService`, `PromptRenderer` callers | **cut** (repository) |
| `ExportRepo` | `PgExportRepo` | Postgres | `ExportService` | **cut** (repository) |
| `JudgeRepo` | `PgJudgeRepo` | Postgres | `JudgeJob` | **cut** (repository, cut #2) |
| `EvidenceRepo` | `PgEvidenceRepo` | Postgres | `EvalRunner`, `run_spike`, `import_spike_report`, ops scripts | **cut** (repository) |
| `Clock` | `SystemClock`, `FakeClock` | system time | leases, heartbeats, sessions, timeouts | **cut**: leases and heartbeat merging are untestable without it |
| `IdGenerator` | `PrefixedIdGenerator` | — | every writer of a new id (`run_…`, `job_…`, `mc_…`) | **cut**: ids appear in fixtures and must be deterministic in tests |

## 4. Build areas

One area = one set of files one ticket stream owns. Waves follow dependency order; areas in the same wave share no files.
*Cross-area calls* are the only calls from an area into another area's modules; each has a DO-4 signature with a fully
spelled-out result type.

| Wave | Area | Owns | Cross-area calls (out) | Notes |
|---|---|---|---|---|
| FW | FW presentation | `apps/web/{package.json,…}`, `apps/web/src/styles/**`, `apps/web/src/components/**`, `apps/web/app/(dev)/**` (as in `foundation-wave.md`) | none | already ready; DO-3 adopts `apps/web/` in place |
| 0 | A0 platform | `package.json`, `tsconfig.base.json`, `docker-compose.yml`, `Dockerfile.web`, `Dockerfile.node`, `render.yaml`, `packages/config/**`, `packages/obs/**`, `apps/*/src/main.ts`, `apps/web/src/server/container.ts` | constructs every adapter and service (constructors in DO-4 §8) | composition roots are wired last in each wave by the wave's merge |
| 0 | A1 storage | `packages/db/migrations/**`, `packages/db/src/{pool,tx,migrate}.ts`, `packages/db/src/repos/audit.ts`, `packages/core/src/ports.ts` | none | owns **all DDL**; other areas own their repo files but never write a migration (they raise a CHG to A1) |
| 0 | A2 schema | `packages/schema/**`, `packages/editor-schema/**`, `docs/contracts/schemas/**` | none | schema fixed before the batch run (HP-4 addendum) |
| 1 | A3 auth | `apps/web/src/server/http/**` (incl. `passwords.ts`), `apps/web/src/server/services/session-service.ts`, `packages/db/src/repos/sessions.ts`, `apps/web/app/api/session/**`, `apps/web/middleware.ts` | `AuditLog.append` (A1) | `risk::security` |
| 1 | A4 intake | `packages/core/src/intake/**`, `apps/web/src/server/services/outline-service.ts`, `apps/web/src/server/adapters/google-sheets.ts`, `packages/db/src/repos/outlines.ts`, `apps/web/app/api/{units,outline-versions}/**` | `AuditLog.append` (A1); `SessionService.require` via `with_route` (A3) | untrusted input (`risk::security` for the sheet fetch) |
| 1 | A5 compile | `packages/core/src/compile/**`, `packages/ydoc/**` | `assert_known_nodes` (A2) | |
| 1 | A6 checks | `packages/core/src/checks/**` (incl. `context-loader.ts`), `apps/worker/src/checks/**`, `packages/db/src/repos/check-queue.ts` | `LessonDocStore.latest_derived` (A11); `OutlineRepo.row_context` (A4); `LessonRepo.dependants` (A12); `SuggestionRepo.pending_for` (A12); `SafetyFlagRepo.open_for` (A12) | |
| 1 | A7 llm | `packages/llm/src/{model-client,anthropic,stub,recorder,prices}.ts`, `packages/prompts/**`, `packages/db/src/repos/model-calls.ts` | `SpendLedger.reserve` / `settle` (A8) through the recorder's caller, never inside the adapter | provider key handling: `risk::security` |
| 1 | A8 spend | `packages/core/src/spend/**`, `packages/db/src/repos/spend.ts` | none | money movement: `risk::security` |
| 2 | A9 generation | `apps/worker/src/{queue,generation}/**`, `packages/core/src/pipeline/**`, `packages/db/src/repos/job-queue.ts` | `ModelCallRecorder.call` (A7); `PromptRenderer.render_*` (A7); `SpendLedger.reserve/settle/release` (A8); `compile_draft` (A5); `run_checks` (A6); `LessonDocStore.seed_initial` (A11); `LessonRepo.write_generated_version` (A12); `RunRepo.store_unit_plan` (A10) | |
| 2 | A10 runs | `apps/web/src/server/services/run-service.ts`, `packages/core/src/lifecycle/run-machine.ts`, `packages/db/src/repos/runs.ts`, `apps/web/app/api/runs/**` | `JobQueue.create_jobs/requeue_failed/cancel_run` (A9); `PromptRepo.current` (A16); `SpendLedger.run_totals` (A8); `OutlineRepo.generate_gate_inputs` (A4); `AuditLog.append` (A1) | |
| 2 | A11 collab | `apps/collab/**` (except `main.ts`, `health.ts`), `apps/web/src/server/adapters/collab-commands.ts`, `packages/db/src/repos/lesson-docs.ts` | `SessionRepo.resolve` (A3); `LessonRepo.state_of/write_snapshot/record_last_editor` (A12); `decide_transition` (A12); `CheckQueue.enqueue` inside the store tx (A6); `CheckContextLoader.load`, `run_checks`, `submit_gate` inside the freeze (A6) | the internal command route and socket auth are `risk::security` |
| 2 | A12 review | `apps/web/src/server/services/{lesson-read,issue,slot,candidate,transition}-service.ts`, `packages/core/src/lifecycle/lesson-machine.ts`, `packages/db/src/repos/{lessons,review-extras}.ts`, `apps/web/app/api/lessons/**` (except suggestions, heartbeats) | `CollabCommands.*` (A11); `run_checks`, `approve_gate`, `submit_gate` (A6); `JobQueue.create_candidate_job` (A9); `SpendLedger.check_day_cap` (A8); `MetricsWriter.write_first_approval` (A13); `AuditLog.append` (A1) | approval integrity: `risk::security` for TransitionService |
| 2 | A13 metrics | `packages/core/src/metrics/**`, `apps/web/src/server/services/{heartbeat,board,metrics-writer}-service.ts`, `packages/db/src/repos/metrics.ts`, `apps/web/app/api/units/[unitId]/{board,metrics}/**`, `apps/web/app/api/lessons/[lessonId]/heartbeats/**` | `LessonRepo.board_rows` (A12); `IssueRepo.counts_by_lesson` (A6) | GR-15: aggregate only |
| 2 | A14 web-ui | `apps/web/app/(app)/**`, `apps/web/src/editor/**`, `apps/web/src/lib/api-client.ts`, `apps/web/src/features/**` | HTTP: every CON route; socket: CON-12 | frontend tickets per screen spec SCR-n |
| 3 | A15 assist (cut #8) | `apps/web/src/server/services/suggestion-service.ts`, `apps/web/app/api/lessons/[lessonId]/suggestions/**` | `ModelCallRecorder.call` (A7); `SpendLedger.reserve/settle` (A8); `CollabCommands.apply_edit` (A11); `SuggestionRepo` (A12) | untrusted model text: `risk::security` |
| 3 | A16 prompts (save is cut #7) | `apps/web/src/server/services/prompt-service.ts`, `packages/db/src/repos/prompts.ts`, `apps/web/app/api/prompt-versions/**` | `AuditLog.append` (A1) | the locked layer has no write path (R-38) |
| 3 | A17 export (cut #5) | `apps/web/src/server/services/export-service.ts`, `packages/db/src/repos/exports.ts`, `docs/contracts/lesson-export.schema.json`, `apps/web/app/api/{units/[unitId]/exports,exports}/**` | `LessonRepo.approved_snapshots` (A12); `AuditLog.append` (A1) | |
| 3 | A18 coverage (cut #4) | `apps/web/app/api/units/[unitId]/coverage/**`, `BoardService.get_coverage_matrix` body | `AlignmentRepo.coverage_rows` (A12) | one query (R-41) |
| 3 | A19 judge (cut #2) | `apps/worker/src/judge/**`, `packages/llm/src/openrouter-judge.ts`, `packages/db/src/repos/judge.ts` | `PromptRenderer.render_judge` (A7); `ModelCallLog` (A7) | second provider key: `risk::security` |
| 2–3 | A20 evals | `evals/**`, `load/**`, `ops/faults/**`, `ops/import-spike.ts`, `packages/db/src/repos/evidence.ts` | the real entry points of every workflow (DO-6 capture rule); `StubModelClient` (A7) | golden tiers run in the merge gate |
| 0–3 | A21 ops | `ops/{seed.ts,backup.sh}`, `apps/{worker,collab}/src/health.ts`, `apps/web/app/api/healthz/**` | `run_migrations` (A1) | |

**Cross-process calls** (the only ones; everything else meets in Postgres):

| From | To | How | Signature |
|---|---|---|---|
| browser | web | HTTP, CON-1…11, 13…24 | the OpenAPI file |
| browser | collab | websocket, CON-12 | `x-collaboration-channel` |
| web | collab | internal HTTP on the Compose network, bearer `COLLAB_INTERNAL_TOKEN` | `CollabCommands` (DO-4 §4.3) |
| collab, web | worker | none directly: `check_job` and `lesson_job` rows plus `NOTIFY lesson_job` / `NOTIFY check_job` | `JobQueue`, `CheckQueue` |
| worker, web | Anthropic | HTTPS through `ModelCallRecorder` → `AnthropicMessagesAdapter` | `ModelClient` |
| worker | OpenRouter | HTTPS (cut #2) | `JudgeClient` |
| web | Google Sheets | one HTTPS GET per import | `SheetFetcher` |

## 5. Seams considered

| Seam | Decision | Why |
|---|---|---|
| Model provider behind `ModelClient` | **cut** | External system; the stub is a real second implementation (capture tests, faults, load). |
| One adapter per alias (generation vs repair) | **deferred** | Same provider and SDK; the alias picks the model id inside one adapter. Split when a second provider serves one alias. |
| Judge behind `JudgeClient` | **cut** | Different provider and trust boundary (A-3). |
| Prompt rendering apart from model calls (`packages/prompts`) | **cut** | Prompts change for content reasons, calls for vendor reasons; rule `pydantic-ai-agents` §3 equivalent. |
| Check rules as a registry of one-file rules | **cut** | 20+ rules, each changed for its own reason; a new rule adds a file (open/closed). |
| Check thresholds in `CheckPolicy` | **cut** | SP-3 will change the quote span and name-scan scope; policy apart from mechanism. |
| Checks run where (`CheckJobRunner` in the worker, the same pure suite in web for Approve) | **cut** | D-6; the suite is pure so both callers share it. |
| `CheckContextLoader` in `packages/core` over ports (shared by worker, collab freeze and web Approve) | **cut** | Three callers must build the same context or the blocking set differs between Submit, Approve and the issue list. |
| A generic check-runner interface over workers | **deferred** | One runner process; the `CheckQueue` port is enough. |
| Spend math pure, ledger in SQL | **cut** | Money: pure decision is unit-testable; the advisory-locked transaction is the only writer. |
| Queue behind `JobQueue` (Postgres now, pg-boss or a batch API later) | **cut** | HP-7's riskiest code; scale step 4–5 may swap it. |
| Lesson store transaction in one module (`PgLessonDocStore`) | **cut** | HP-4: two writers would drift; worker seeding and collab stores share it. |
| Web → collab as internal HTTP behind `CollabCommands` | **cut** | Process boundary; Submit needs a synchronous lock-and-snapshot answer. Rejected: a Postgres command table (adds ≥ 0.5 s and a second poller). |
| Hocuspocus behind its own interface | **deferred** | One server library, used only in `apps/collab`; wrapping it hides nothing yet. |
| Y.Doc conversion in `packages/ydoc` | **cut** | Used by collab, worker and SP-2's round-trip test; isolates the Yjs dependency. |
| ProseMirror schema as its own package | **cut** | HP-4 addendum: one module shared by compiler, editor and collab. |
| Lesson state machine as a pure function | **cut** | Web (most moves) and collab (Submit) both apply it; one rule set. |
| Repository per table group | **cut** | Lets areas own their SQL in parallel; ports keep services testable with fakes. |
| A generic repository base class | **deferred** | Duplication across ~16 small repos is cheaper than the wrong abstraction. |
| Event bus between services | **deferred** | Synchronous calls plus queue tables cover every flow; no second consumer exists. |
| Separate read models (CQRS) for board and metrics | **deferred** | One query each over stored rows meets p95 < 1 s at 47 rows. |
| Multi-tenant / per-district isolation | **deferred** | One organisation in the demo. |
| Redis pub/sub for a second Hocuspocus process | **deferred** | Scale step 3 only (DO-1 §7.2). |
| Batch API path for whole-program runs | **deferred** | Scale step 5, roadmap. |
| Feature-flag service | **deferred** | Cut items are absent code, not flags; settings toggle only `FOUR_EYES_ENABLED` and provider mode. |

## 6. Postgres tables (canonical names, one owner)

**DDL owner: A1 storage, `packages/db/migrations/`.** No other area writes DDL. Every append-only table has a trigger
that raises on UPDATE and DELETE (R-35). *Writer* is the process allowed to write rows (DO-2 §3 data authority);
*Repo* is the port that does it. Key columns are the ones metrics, workflows and cards read; DO-4 §7 has the row types.

| Table | Writer → repo | Readers | Key columns | DDL file |
|---|---|---|---|---|
| `app_user` | seed script → `PgSessionRepo` | all | `id`, `email`, `name`, `role`, `synthetic` (seed-only), `password_hash` (scrypt) | `0001_identity.sql` |
| `app_session` | web → `PgSessionRepo` | web, collab | `token_hash`, `user_id`, `created_at`, `expires_at`, `revoked_at` | `0001_identity.sql` |
| `unit` | web → `PgOutlineRepo` | web, worker | `id` (`G6.U4`), `grade`, `title` | `0002_intake.sql` |
| `outline_version` | web → `PgOutlineRepo` | web, worker | `id`, `unit_id`, `number`, `sha256`, `source_kind`, `uploaded_by`, `confirmed_at` | `0002_intake.sql` |
| `outline_row` | web → `PgOutlineRepo` | web, worker | `outline_version_id`, `row_number`, `kind`, `lesson_id`, `segments_json`, `codes_json`, `findings_json`, `row_hash` | `0002_intake.sql` |
| `intake_choice` | web → `PgOutlineRepo` | worker, web | `outline_version_id`, `finding_id`, `choice`, `status` (`default` / `confirmed`), `confirmed_by` | `0002_intake.sql` |
| `standard` | seed → `PgStandardRepo` | all | `code`, `set`, `text`, `parent_code`, `is_leaf`, `eld_strand` | `0002_intake.sql` |
| `lesson_link` | web (intake) → `PgOutlineRepo` | worker, web | `outline_version_id`, `from_lesson_id`, `to_lesson_id`, `kind`, `slot_id` | `0002_intake.sql` |
| `prompt_version` | web → `PgPromptRepo` | worker | `id`, `locked_hash`, `guidance_text`, `number`, `author_id`, `reason`, `diff` | `0003_prompts.sql` |
| `run` | web (create, control), worker (state) → `PgRunRepo` | web | `id`, `unit_id`, `outline_version_id`, `kind` (`run` / `trial` / `candidate`), `state`, `scope_json`, `parent_run_id`, `prompt_version_id`, `choices_json`, `choices_hash` (UXQ-9: the choice set copied at start), `cap_usd`, `capped_by`, `paused_check`, `idempotency_key` (unique per user for 24 h), `started_by`, `plan_stored_at`, `created_at`, `finished_at`, `eval_run_id` | `0004_runs.sql` |
| `unit_plan` | web (row and `lesson_links_json` copied at run start), worker (entries) → `PgRunRepo` | web, worker | `run_id`, `state` (`planning` / `stored` / `failed`), `entries_json`, `lesson_links_json`, `model_call_id`, `stored_at` | `0004_runs.sql` |
| `lesson_job` | web (create), worker (claim, finish) → `PgJobQueue` | web | `id`, `run_id`, `kind` (`unit_plan` / `lesson` / `candidate`), `lesson_id`, `idempotency_key`, `status`, `tile_state`, `attempt`, `lease_until`, `queued_at`, `started_at`, `finished_at`, `failure_reasons_json`, `brakes_fired`, `calls_lost`, `repairs`, `truncation_retries`, `retries`; partial unique index: one queued or running candidate job per lesson (CON-16) | `0004_runs.sql` |
| `spend_reservation` | worker, web (assist) → `PgSpendLedger` | web | `id`, `run_id`, `user_id`, `model_call_id`, `reserved_usd`, `settled_usd`, `status`, `day` | `0004_runs.sql` |
| `model_call` | worker, web (assist) → `PgModelCallLog` | web (summary), operator | `id`, `run_id`, `lesson_id`, `job_id`, `attempt`, `purpose`, `alias`, `requested_model`, `served_model`, `rendered_prompt`, `raw_output`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cost_usd`, `stop_reason`, `status` (`sent` / `completed` / `failed` / `lost`), `provider_request_id`, `request_id`, `sent_at`, `completed_at`, `experiment_id` | `0005_traces.sql` |
| `lesson` | worker (create, `generation_failed`), web and collab (state) → `PgLessonRepo` | all | `id`, `unit_id`, `number`, `type`, `title`, `state`, `current_version_id`, `reviewer_id`, `last_editor_id`, `schema_version` | `0006_lessons.sql` |
| `lesson_version` | worker (v1, candidates), collab (Submit), web (Approve, reopen) → `PgLessonRepo` | all | `id`, `lesson_id`, `number`, `kind` (`generated` / `candidate` / `submit` / `approve` / `reopen`), `adopted`, `content_hash`, `state_vector`, `lesson_json`, `draft_json`, `teacher_word_count`, `provenance_json` (model fields nullable for human-made versions), `derived_from_version_id`, `run_id`, `model_call_ids`, `dependency_record_json`, `created_by`, `stored_at` | `0006_lessons.sql` |
| `lesson_doc` | **collab only** (worker seeds seq 1 through the same function) → `PgLessonDocStore` | web, worker | `lesson_id`, `seq`, `store_id`, `ydoc_bytes`, `derived_json`, `content_hash`, `state_vector`, `schema_version`, `stored_by`, `stored_at`, `request_id` | `0006_lessons.sql` |
| `check_job` | collab, web (inside the store transaction) → `PgCheckQueue` | worker | `lesson_id`, `content_hash`, `store_id`, `status`, `enqueued_at`, `claimed_at`, `finished_at`, `lease_until` | `0007_checks.sql` |
| `issue` | worker → `PgIssueRepo`; resolution columns by web | web | `id`, `lesson_id`, `content_hash`, `level`, `kind`, `message`, `address`, `span_anchor`, `related_lesson_id`, `resolved_by`, `resolution_reason`, `resolved_at`, `cleared_by` (`fix` / `resolution`), `created_at` | `0007_checks.sql` |
| `alignment_link` | worker (checks), web (confirmations) → `PgAlignmentRepo` | web | `lesson_id`, `content_hash`, `code`, `address`, `role` (I / P / A), `origin` (`outline` / `narrowed` / `added`), `asserted_by`, `confirmed_by` | `0007_checks.sql` |
| `safety_flag` | worker (from `safety_note` rows), web (clear) → `PgSafetyFlagRepo` | web, worker | `id`, `lesson_id`, `source_row`, `teacher_tip_address`, `status`, `cleared_by`, `note`, `cleared_at` | `0007_checks.sql` |
| `suggestion` | web → `PgSuggestionRepo` | web, worker (checks) | `id`, `lesson_id`, `anchor_start`, `anchor_end`, `selected_text`, `note`, `suggested_text`, `status`, `requested_by`, `decided_by`, `decided_at`, `expires_at` (30 min, CON-17), `model_call_id` | `0008_review.sql` |
| `review_event` | web, collab (Submit) → `PgLessonRepo` | web, metrics | `id`, `lesson_id`, `version_id`, `from_state`, `to_state`, `actor_id`, `reason`, `reason_tag`, `note`, `content_hash`, `request_id`, `at` (append-only) | `0008_review.sql` |
| `audit_event` | web, collab → `PgAuditLog` | web (history), operator | `id`, `actor_id`, `action`, `target_kind`, `target_id`, `version_hash`, `reason`, `details_json`, `request_id`, `store_id`, `at` (append-only) | `0008_review.sql` |
| `heartbeat` | web → `PgMetricsRepo` | web | `user_id`, `tab_id`, `lesson_id`, `version_id`, `at`, `synthetic` | `0009_metrics.sql` |
| `review_session` | web → `PgMetricsRepo` | web | `user_id`, `lesson_id`, `version_id`, `started_at`, `last_at`, `active_seconds` | `0009_metrics.sql` |
| `lesson_metrics` | web (first approval only) → `PgMetricsRepo` | web | `lesson_id`, `version_id`, `active_minutes`, `teacher_word_count`, `g2_threshold_minutes` (CON-10), `draft_rating`, `human_sessions`, `approved_at` (one row per lesson, written once at the first approval; never updated) | `0009_metrics.sql` |
| `export_bundle` | web → `PgExportRepo` | operator | `id`, `unit_id`, `version_number`, `payload_sha256`, `lesson_versions_json`, `held_back_json`, `created_by`, `created_at` | `0010_exports.sql` |
| `judge_verdict` | worker (cut #2) → `PgJudgeRepo` | web, evals | `id`, `lesson_id`, `content_hash`, `address`, `code`, `question`, `verdict`, `model_call_id`, `served_model` | `0011_judge.sql` |
| `eval_run` | eval runner → `PgEvidenceRepo` | operator | `id`, `suite`, `git_sha`, `prompt_version_id`, `models_json`, `provider_mode`, `case_set`, `report_path`, `passed`, `total`, `started_at` | `0012_evidence.sql` |
| `eval_case_result` | eval runner → `PgEvidenceRepo` | operator | `eval_run_id`, `case_id`, `provenance`, `source`, `guards`, `passed`, `failure_category`, `expected_json`, `actual_json` | `0012_evidence.sql` |
| `probe_run` | load script → `PgEvidenceRepo` | operator | `id`, `kind` (`http` / `yjs`), `users`, `machine`, `provider_mode`, `p95_json`, `error_rate`, `lost_updates`, `event_loop_lag_p95_ms`, `n` | `0012_evidence.sql` |
| `experiment_run` | spike importer → `PgEvidenceRepo` | operator | `id` (`SP-1`…), `config_json`, `result_json`, `report_path`, `imported_at` | `0012_evidence.sql` |
| `ops_event` | migration runner, seed, backup, health, process start → `PgEvidenceRepo` | operator | `id`, `kind`, `build_id`, `service`, `details_json`, `at` | `0012_evidence.sql` |
| `schema_migrations` | migration runner → `run_migrations` | operator | `id`, `checksum`, `applied_at` | `0000_migrations.sql` |

**One live document per lesson, many stores.** `lesson_doc` keeps one row per durable store (`seq` ascending; the latest
row is the live document). That is what DO-6's capture check WF-9 asserts ("one `lesson_doc` row per store"), and it gives
a store history for the round-trip test. Snapshots that approval pins are `lesson_version` rows, never `lesson_doc`.

**History view.** `audit_log_v` (a view, owned by A1) is the union of `review_event` and `audit_event` ordered by time;
CON-19 reads it. Lesson moves go to `review_event` only; every other person's action goes to `audit_event`; nothing is
written twice. Together they are "the audit log" of INTERFACE shared guarantee 4.

### 6.1 Reconciling the working names in DO-6 and DO-7

DO-2 and DO-6 already use the names above, except one change made in DO-6 with this design: WF-15's lesson moves write
`review_event` (DO-7's name for the transition log), and WF-23's verdicts write `judge_verdict`. DO-7's *Source* column
used working names; they map as follows (DO-7 says a rename here updates its column; that edit is an open item for the
DO-7 owner, recorded in DO-4 *Open items*):

| DO-7 working name | Canonical table and column |
|---|---|
| `check_result` (`cleared_by`, `created_at`, kinds) | `issue` (`cleared_by`, `created_at`, `kind`) |
| `review_event` | `review_event` (same) |
| `heartbeat`, `review_session`, `lesson_metrics` | same names |
| `seeded_error` | `eval_case_result` rows of suite S10 (`expected_json` holds the hidden key) |
| `ai_assist_event` | `suggestion` (`status`, `requested_by`, `decided_by`, `decided_at`) |
| `judge_label` | `eval_case_result` rows of suite S12 (the label in `expected_json`) |
| `judge_verdict` | `judge_verdict` (same) |
| `safety_flag` | `safety_flag` (same) |
| `outline_version.confirmed_at` | same |
| `load_test_run` | `probe_run` |
| `lesson_version.stored_at` (M-26) | `lesson_doc.stored_at` for edits (`lesson_version.stored_at` for snapshots); paired with `issue.created_at` |

## 7. Settings (typed, from the environment)

Parsed once at start by `packages/config` with Zod; a missing or malformed value stops the process with the variable's
name (never its value). Provider keys come only from `bin/with-provider-env` (workspace rule shared-provider-credentials).

| Variable | Type | Default | Consumers |
|---|---|---|---|
| `DATABASE_URL` | url (secret) | — | web, worker, collab, scripts |
| `PG_POOL_MAX` | int | web 10, collab 5, worker 4 [T] | `PgDatabase` |
| `PG_ACQUIRE_TIMEOUT_MS` | int | 2000 [A] (CG-1) | `PgDatabase` (web) |
| `BUILD_ID` | string | `RENDER_GIT_COMMIT` or local git SHA | `Logger`, `ops_event` start events |
| `LOG_LEVEL` | `debug` / `info` / `warn` / `error` | `info` | `Logger` |
| `ANTHROPIC_API_KEY` | secret | — (required when `MODEL_PROVIDER_MODE=real`) | `AnthropicMessagesAdapter` (worker, web) |
| `OPENROUTER_API_KEY` | secret | — (judge only, cut #2) | `OpenRouterJudgeAdapter` |
| `MODEL_PROVIDER_MODE` | `real` / `stub` | `stub` | composition roots (choose adapter) |
| `MODEL_GENERATION_ID`, `MODEL_REPAIR_ID`, `MODEL_JUDGE_ID` | string | confirmed at build (PD-12) | `AnthropicMessagesAdapter`, `OpenRouterJudgeAdapter`, `PRICE_TABLE` lookup |
| `MODEL_CALL_TIMEOUT_MS` | int | 2 × SP-1 p95 [A] | `ModelCallRecorder` |
| `ASSIST_CALL_TIMEOUT_MS` | int | 20000 (CON-17) | `SuggestionService` |
| `SUGGESTION_TTL_MIN` | int | 30 [A] (CON-17) | `SuggestionService`, `PgSuggestionRepo.pending_for` |
| `UNDO_WINDOW_S` | int | 60 [A] (CON-14) | `IssueService.decide_standard` |
| `DRAFT_OUTPUT_TOKEN_CAP` | int | 16000 [A] → SP-1 | `DraftNode`, `max_call_cost` |
| `TRUNCATION_RETRY_TOKEN_CAP` | int | 24000 [A] | `DraftNode` |
| `PROVIDER_MAX_RETRIES` | int | 3 | `ModelCallRecorder` |
| `GENERATION_CONCURRENCY` | int 1–6 | 4 [A] → SP-1 | `ClaimLoop` |
| `MAX_ACTIVE_RUNS` | int | 3 [A] | `PgJobQueue.claim` |
| `JOB_WALL_CLOCK_MS` | int | 600000 [T] | `LessonJobRunner` |
| `JOB_LEASE_MS` | int | 120000, renewed every 30 s [A] | `ClaimLoop`, `PgJobQueue` |
| `JOB_POLL_MS`, `CHECK_POLL_MS` | int | 1000, 500 [A] | `ClaimLoop`, `CheckJobRunner` |
| `CIRCUIT_BREAKER_SAME_CHECK` | int | 3 | `should_pause_run` |
| `BUILD_SPEND_CEILING_USD` | decimal | 75 [T] (PD-29) | `PgSpendLedger` |
| `COST_PER_LESSON_ESTIMATE_USD` | decimal | 0.50 until SP-1 [A] | `run_cap_for` (the cap the board proposes) |
| `RUN_CAP_MULTIPLIER` | decimal | 1.5 (PD-14) | `run_cap_for` |
| `USER_DAY_CAP_MULTIPLIER` | decimal | 2 [A] | `PgSpendLedger` |
| `FOUR_EYES_ENABLED` | bool | true (PD-10) | `TransitionService` |
| `OUTLINE_MAX_ROWS` | int | 200 [T] | `normalize_outline` caller |
| `OUTLINE_MAX_BYTES` | int | 5242880 (CON-2) | `OutlineService`, `GoogleSheetsExportFetcher` |
| `IDEMPOTENCY_WINDOW_H` | int | 24 (CON-5) | `RunService.start` |
| `SHEETS_FETCH_TIMEOUT_MS` | int | 10000 [A] | `GoogleSheetsExportFetcher` |
| `SESSION_COOKIE_NAME` | string | `ls_session` (OpenAPI security scheme) | `SessionService`, `CollabAuthenticator` |
| `SESSION_TTL_HOURS` | int | 12 [A] | `SessionService` |
| `APP_ORIGIN` | url | `http://localhost:3000` | `with_route` (mutations refused unless `Origin` matches, CON-1) |
| `BUSY_RETRY_AFTER_S` | int | 2 [A] | `with_route` (`SERVICE_BUSY`, CG-1) |
| `AUDIT_HASH_SALT` | secret | — | `SessionService` (unknown-email hashing, WF-1) |
| `COLLAB_PORT` | int | 1234 | collab |
| `COLLAB_INTERNAL_URL` | url | `http://collab:1234/internal` | `HttpCollabCommandClient` |
| `COLLAB_INTERNAL_TOKEN` | secret | — | `HttpCollabCommandClient`, `CollabCommandHandler` |
| `STORE_DEBOUNCE_MS`, `STORE_MAX_DEBOUNCE_MS` | int | 2000 [T], 4000 [A] | `LessonPersistence` |
| `HEARTBEAT_MERGE_GAP_S` | int | 60 [A], allowed 60–90 (HP-8, CON-20) | `merge_heartbeats`, `HeartbeatService` |
| `HEARTBEAT_MIN_SPACING_S` | int | 10 (CON-20) | `HeartbeatService` |
| `UNCHECKED_AFTER_S` | int | 30 (DO-6 missing-instrumentation check 3) | `IssueService.get_issues` (`pending`) |

## 8. Constructors (who builds what)

Each process has one composition root. Services and adapters never construct their own dependencies.

| Built by | Builds, in order |
|---|---|
| `apps/web/src/server/container.ts` → `build_web_services(settings)` | `WebSettings` → `Logger` → `PgDatabase` → repos (`PgSessionRepo`, `PgOutlineRepo`, `PgStandardRepo`, `PgRunRepo`, `PgJobQueue`, `PgSpendLedger`, `PgModelCallLog`, `PgLessonRepo`, `PgLessonDocStore`, `PgCheckQueue`, `PgIssueRepo`, `PgSafetyFlagRepo`, `PgAlignmentRepo`, `PgSuggestionRepo`, `PgAuditLog`, `PgMetricsRepo`, `PgPromptRepo`, `PgExportRepo`) → adapters (`GoogleSheetsExportFetcher`, `HttpCollabCommandClient`, `AnthropicMessagesAdapter` or `StubModelClient`) → `ModelCallRecorder` → `PromptRenderer` → `CheckContextLoader` → services (`SessionService`, `OutlineService`, `RunService`, `BoardService`, `LessonReadService`, `IssueService`, `SlotService`, `CandidateService`, `MetricsWriter`, `TransitionService`, `HeartbeatService`, `SuggestionService`, `PromptService`, `ExportService`). Cached on `globalThis` once per server process. |
| `apps/worker/src/main.ts` → `build_worker_runtime(settings)` | `WorkerSettings` → `Logger` → `PgDatabase` → repos → `AnthropicMessagesAdapter` or `StubModelClient` → `ModelCallRecorder` → `PromptRenderer` → nodes → `LessonJobRunner`, `UnitPlanJob`, `RunFinalizer` → `ClaimLoop`; `CheckContextLoader` → `CheckJobRunner`; `JudgeJob` (if built); health server. |
| `apps/collab/src/main.ts` → `build_collab_runtime(settings)` | `CollabSettings` → `Logger` → `PgDatabase` → `PgSessionRepo`, `PgLessonRepo`, `PgLessonDocStore`, `PgAuditLog`, the read repos `CheckContextLoader` needs → `CheckContextLoader` → `CollabAuthenticator`, `WriteGuard`, `LessonPersistence`, `AckBroadcaster` → Hocuspocus `Server` (extensions, debounce) → `CollabCommandHandler` mounted on `onRequest`. |
| `evals/src/cli.ts`, `load/spike.ts`, `ops/*.ts` | their settings → `PgDatabase` → `PgEvidenceRepo` → the suite or script; S6 and capture tests build a worker runtime with `StubModelClient` and `FakeClock`. |
| Tests | construct services directly with in-memory fakes of the ports (`FakeJobQueue`, `FakeSpendLedger`, `FakeCollabCommands`, `StubModelClient`, `FakeClock`). |

## 9. Commands (root `package.json`)

`npm run lint`, `npm run typecheck`, `npm test` (Vitest, affected projects), `npm run test:e2e` (Playwright),
`npm run db:migrate`, `npm run db:seed`, `npm run schemas:emit`, `npm run eval:golden -- --suite intake,checks`,
`npm run eval:golden -- --suite drafts --repeat 3`, `npm run eval:grounding`, `npm run eval:faults`,
`npm run eval:full-run -- --unit G6-U4`, `npm run eval:seed`, `npm run eval:heldout`, `npm run eval:judge-calibrate`,
`npm run load:spike`, `npm run ops:backup`, `npm run dev` (Compose). DO-5's `pnpm X` lines are these with `npm run`.

## 10. Where each contract lives in code

| Contract | Lives in |
|---|---|
| External HTTP (CON-1…11, 13…24) | `docs/contracts/interface.openapi.yaml` → `packages/schema/src/api/*.ts` (Zod mirrors, contract-tested against the file) → `apps/web/app/api/**/route.ts` |
| Collaboration channel (CON-12) | `x-collaboration-channel` → `apps/collab/src/{auth,permissions,persistence,acks}.ts`, `apps/web/src/editor/**` |
| Model output (UnitPlan, LessonDraft, repair, assist, judge) | `packages/schema/src/{unit-plan,lesson-draft}.ts`, verdict schema in `packages/llm/src/openrouter-judge.ts` |
| Stored lesson and export | `packages/schema/src/{lesson,export}.ts` → emitted to `docs/contracts/schemas/lesson.schema.json` and, for the export, `docs/contracts/lesson-export.schema.json` (the path CON-23 names) |
| Internal ports | `packages/core/src/ports.ts` (DO-4 §3–§4) |
| Tables | `packages/db/migrations/*.sql` (§6) |
