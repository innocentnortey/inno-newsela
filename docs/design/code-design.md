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
`code-structure.md` (one file, one responsibility; size caps; it lives in the workspace root's `.claude/rules/`, not
copied into this repo).

## What it looks like in practice

Take the traced job from DO-1 §4.2: row 8 becomes Lesson 4.

1. `apps/worker/src/queue/claim-loop.ts` asks the **`JobQueue` port** for a job; `PgJobQueue` (in `packages/db`) runs the
   `SKIP LOCKED` claim and returns a typed `ClaimedJob`.
2. `apps/worker/src/generation/lesson-job-runner.ts` steps a typed `LessonJobState` through fixed nodes: render the
   prompt with the `LessonDraft` JSON Schema embedded in it (`packages/prompts`; SP-1: the API's schema-enforced mode
   rejected this schema as too large), then call the model through **`PaidCaller`**, which reserves that call's worst
   case (the **pure** `packages/core/src/spend/reservation.ts` decides, `PgSpendLedger` applies it atomically), calls
   **`ModelCallRecorder`** (which writes the `model_call` row first and calls the **`ModelClient` port**;
   `AnthropicMessagesAdapter` is the only file that imports the Anthropic SDK) and settles the actual cost; then it
   parses with the Zod `LessonDraft` (`packages/schema`), compiles with the **pure** `packages/core/src/compile/`, runs the
   **pure** check suite `packages/core/src/checks/`, let the **pure** router `route-after-checks.ts` pick store, repair
   or fail, and store v1 through the **`LessonDocStore` port** (the same store function the collaboration server uses).
3. The board's poll (`apps/web/app/api/runs/[runId]/progress/route.ts`) calls `RunService.getProgress`, which reads
   `lesson_job` rows through `RunRepo` and returns the OpenAPI `RunProgress` shape.

Swap Anthropic for another provider and one adapter file changes. Change the 3-word quote threshold SP-3 confirmed and
one policy constant changes. Add a check rule and one stubbed file in `checks/rules/` gets its body. Nothing in
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
  Its allow-list for `packages/core` names two pure libraries: SheetJS (workbook parsing) and `compromise` (proper-noun
  tagging for the name scan, SP-3). `packages/schema` adds `@noble/hashes` for `content_hash` (pure JS, so the one hash
  function serves the compiler and `packages/ydoc` alike).
- **Who owns the workspace files (Metz B2):** A0 owns every `*/package.json`, every `*/tsconfig.json`, the root
  `package-lock.json` (the only lockfile), the root ESLint and Vitest workspace configs, and one wiring file per area
  under each composition root (stubs in wave 0). Packages export by subpath (`@ls/core/ports/spend`), with no barrel file
  that every area appends to. A later dependency is a one-line A0 ticket.

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
| `packages/schema/src/content-hash.ts` | Computes the one canonical SHA-256 of a stored lesson, used by both the compiler and the Y.Doc store (spec dry run G-29). | `content_hash` | `@noble/hashes` (pure JS) | A2 schema |
| `packages/schema/src/export.ts` | Defines the export bundle shape (R-42). | `ExportBundleFile` | zod | A2 schema |
| `packages/schema/src/api/*.ts` | Zod mirrors of every OpenAPI component, named exactly as in `interface.openapi.yaml`, plus the one lenient route mirror `TransitionRequestInput` (DO-4 §5, G-11). | OpenAPI component names | zod | A2 schema |
| `packages/schema/scripts/emit-json-schemas.ts` | Writes `docs/contracts/schemas/*.schema.json` and `docs/contracts/lesson-export.schema.json` from the Zod schemas. | `emit_json_schemas` | zod-to-json-schema | A2 schema |
| `packages/editor-schema/src/schema.ts` | Declares the ProseMirror node and mark schema mirroring Newsela's nodes and role marks; unknown nodes fail loudly. | `EDITOR_SCHEMA`, `SCHEMA_VERSION`, `assert_known_nodes` | prosemirror-model | A2 schema |
| `packages/core/src/ports/*.ts` | Declares one port interface and its records per file (§3; Metz S5). | the Port table | `schema` | A1 storage writes them all in wave 0; each file then belongs to the area that implements its port (§3) |
| `packages/core/src/intake/parse-grid.ts` | Turns CSV or XLSX bytes into a cell grid. | `parse_workbook` | SheetJS (pure parsing library, lint allow-list) | A4a intake core |
| `packages/core/src/intake/normalize.ts` | Normalizes a cell grid into typed rows, findings and proposals in plain code (HP-6, PD-27). | `normalize_outline` | `schema`, `standards-index.ts` | A4a intake core |
| `packages/core/src/intake/standards-index.ts` | Resolves codes against the seeded CDE text (leaves, parents, ELD verdict table). | `StandardsIndex` | `schema` | A4a intake core |
| `packages/core/src/intake/lesson-links.ts` | Computes cross-lesson `lesson_link` records from the rows (HP-1). | `compute_lesson_links` | `schema` | A4a intake core |
| `packages/core/src/intake/report.ts` | Builds the validation report and the Generate gate from rows and choices. | `build_validation_report`, `generate_gate` | `schema` | A4a intake core |
| `packages/core/src/compile/compile-draft.ts` | Compiles a `LessonDraft` into allow-listed ProseMirror JSON with section templates and minutes, or raises `CompileError`. | `compile_draft`, `CompileError` | `schema` (incl. `content_hash`), `editor-schema`, `templates.ts` | A5 compile |
| `packages/core/src/compile/templates.ts` | Holds the section templates and minutes per lesson type (R-11). | `SECTION_TEMPLATES` | `schema` | A5 compile |
| `packages/core/src/compile/addresses.ts` | Assigns reviewer-citable part addresses (R-21). | `assign_addresses` | `schema` | A5 compile |
| `packages/core/src/checks/registry.ts` | Lists the registered check rules (`CHECK_RULES`, one per `CheckKind`) and runs them over one lesson. | `CheckRule`, `CHECK_RULES`, `run_checks` | `checks/rules/*` | A6a check core |
| `packages/core/src/checks/rules/*.ts` | One rule per file (R-19 as amended); each returns findings, never throws for content; the name-scan rule uses a capitalised-token heuristic plus `compromise` (SP-3). | `CheckRule` | `schema`, `policy.ts`, `compromise` (pure NLP library, lint allow-list) | A6a check core |
| `packages/core/src/checks/policy.ts` | Holds the business-tunable thresholds as SP-3 set them: quote span ≥ 3 words, quote and page scans blocking everywhere, name scan blocking in `cfu_item`s and advisory elsewhere, reviewer quote ≤ 12, vocabulary cap. | `CheckPolicy`, `CHECK_POLICY` | — | A6a check core |
| `packages/core/src/checks/gates.ts` | Decides Submit and Approve readiness from the re-run findings matched to recorded resolutions, in the card's error precedence (CON-18). | `merge_resolutions`, `submit_gate`, `approve_gate` | `schema` | A6a check core |
| `packages/core/src/checks/context-loader.ts` | Assembles a `CheckContext` (outline row, standards, links, linked lessons' stored rows, suggestions, flags) for one lesson, through ports only. | `CheckContextLoader` | `OutlineRepo`, `StandardRepo`, `LessonGraphRepo`, `LessonDocReader`, `SuggestionRepo`, `SafetyFlagRepo`, `AlignmentRepo` | A6b check context |
| `packages/core/src/spend/reservation.ts` | Computes a call's maximum cost and decides a reservation against run, user-day and project caps (PD-14, PD-29). | `max_call_cost`, `decide_reservation`, `settle_cost`, `run_cap_for`, `user_day_cap_for` | — | A8 spend |
| `packages/core/src/lifecycle/lesson-machine.ts` | Decides whether a lesson move is allowed for a role and state, which roles may ask, and which states are editable (R-33 as amended). | `decide_transition`, `transition_roles`, `is_editable` | `schema` | A12a lesson records |
| `packages/core/src/lifecycle/run-machine.ts` | Derives run state and tile state from job rows; decides run-control moves. | `derive_run_state`, `tile_state`, `decide_run_control` | `schema` | A9a queue and runs |
| `packages/core/src/pipeline/route-after-checks.ts` | Pure router: store, repair or fail from parse, compile and check results and counters (HP-1). | `route_after_checks` | `schema` | A9 generation |
| `packages/core/src/pipeline/failure-reasons.ts` | Maps brakes, provider errors, compile errors and findings to the OpenAPI `FailureReason.check` values (G-20). | `failure_reasons_for` | `schema` | A9 generation |
| `packages/core/src/pipeline/circuit-breaker.ts` | Decides whether a run pauses (3 lessons in a row failing the same check). | `should_pause_run` | — | A9 generation |
| `packages/core/src/metrics/sessions.ts` | Merges heartbeats into active intervals across tabs (HP-8, R-49). | `merge_heartbeats` | — | A13a metrics records |
| `packages/core/src/metrics/frozen-row.ts` | Computes the frozen per-lesson metrics row at first approval. | `compute_lesson_metrics` | `sessions.ts` | A13a metrics records |
| `packages/ydoc/src/convert.ts` | Converts `StoredLesson` JSON to and from Y.Doc bytes (one fragment per section, front matter as a Y.Map). | `lesson_to_ydoc`, `ydoc_to_lesson` | yjs, y-prosemirror, `editor-schema` | A5 compile |
| `packages/ydoc/src/hash.ts` | Re-exports `content_hash` from `schema` and computes base64 state vectors and their cover test. | `content_hash`, `state_vector_of`, `covers` | yjs, `schema` | A5 compile |
| `packages/llm/src/model-client.ts` | The `ModelClient` port re-export and the logical aliases (GENERATION, REPAIR, ASSIST, JUDGE). | `ModelAlias` | `core/ports` | A7 llm |
| `packages/llm/src/anthropic.ts` | The only module that imports the Anthropic SDK; one call per request, schema-enforced or prompt-embedded output (SP-1). | `AnthropicMessagesAdapter` | @anthropic-ai/sdk | A7 llm |
| `packages/llm/src/openrouter-judge.ts` | The only module that calls OpenRouter; binary verdicts (cut #2). | `OpenRouterJudgeAdapter` | fetch | A19 judge |
| `packages/llm/src/stub.ts` | Deterministic stub provider for tests, capture checks, faults and load (no spend). | `StubModelClient`, `StubJudgeClient` | `core/ports` | A7 llm |
| `packages/llm/src/recorder.ts` | The one logged, retried wrapper every model call goes through; writes `model_call` before and after. | `ModelCallRecorder` | `ModelClient`, `ModelCallLog`, `Clock`, `settle_cost` | A7b paid calls |
| `packages/llm/src/paid-call.ts` | The one reserve → call → settle-or-release protocol every paid model call uses (Metz S6). | `PaidCaller` | `ModelCallRecorder`, `SpendLedger`, `max_call_cost`, `PriceTable` | A7b paid calls |
| `packages/llm/src/prices.ts` | Model prices per million tokens, confirmed from the provider docs: `claude-sonnet-5-5` $2 input, $10 output, $2.50 cache write, $0.20 cache read (SP-1, checked 2026-10-25; PD-12). | `PRICE_TABLE` | — | A7 llm |
| `packages/prompts/src/render.ts` | Renders the locked layer, the pinned guidance, delimited outline data and the output schema (embedded in the prompt for draft and repair, SP-1) into a prompt. | `PromptRenderer` | `schema`, `locked/*.md` | A7 llm |
| `packages/prompts/locked/*.md` | The locked prompt layer, versioned by file hash; no write path exists (R-38). | file contents | — | A7 llm |
| `packages/config/src/*.ts` | Parses environment variables into typed settings, one object per process; model and spend settings only for web and worker. | `SharedSettings`, `ModelSettings`, `SpendSettings`, `WebSettings`, `WorkerSettings`, `CollabSettings` | zod | A0 platform |
| `packages/obs/src/logger.ts` | JSON-lines logger with `service`, `build_id`, `request_id`; never logs lesson text or keys. | `Logger` | — | A0 platform |

### 2.2 Storage (`packages/db`; each repository file belongs to the area named, all DDL to A1)

| Module | Responsibility (one sentence) | Interface (DO-4) | Depends on | Owner area |
|---|---|---|---|---|
| `packages/db/migrations/*.sql` | Holds **all** DDL for every table in §6, applied in order; the only place a table or column is created. | SQL files | Postgres 16 | A1 storage |
| `packages/db/src/pool.ts` | Builds one `pg.Pool` per process with its size and acquire timeout. | `PgDatabase` | pg, `config` | A1 storage |
| `packages/db/src/tx.ts` | Runs a function in one transaction, with an optional advisory lock (`PgDatabase` implements the `TxRunner` port). | `PgDatabase.with_tx` | `pool.ts` | A1 storage |
| `packages/db/src/migrate.ts` | Applies pending migrations and records each in `schema_migrations` and `ops_event`. | `run_migrations` | `pool.ts` | A1 storage |
| `packages/db/src/repos/sessions.ts` | Users, sessions and the allow-list. | `PgSessionRepo` | `tx.ts` | A3 auth |
| `packages/db/src/repos/outlines.ts` | Units, outline versions, rows, intake choices, standards, lesson links. | `PgOutlineRepo`, `PgStandardRepo` | `tx.ts` | A4a intake core |
| `packages/db/src/repos/runs.ts` | Runs, unit plans, pinned choices, capping and run reads (progress, summary). | `PgRunRepo` | `tx.ts` | A9a queue and runs |
| `packages/db/src/repos/job-queue.ts` | The `lesson_job` queue: create, fair-share claim, lease, finish, requeue expired, cancel. | `PgJobQueue` | `tx.ts` | A9a queue and runs |
| `packages/db/src/repos/spend.ts` | Atomic reservation, settlement, release and job-release under one advisory lock. | `PgSpendLedger` | `tx.ts`, `core/spend`, `SpendSettings` | A8 spend |
| `packages/db/src/repos/model-calls.ts` | `model_call` rows: insert before send, complete on arrival, mark lost, checkpoint lookup. | `PgModelCallLog` | `tx.ts` | A7 llm |
| `packages/db/src/repos/lesson-doc-reads.ts` | Reads the latest stored Y.Doc and derived row of a lesson. | `PgLessonDocReader` | `tx.ts` | A5 compile |
| `packages/db/src/repos/lesson-docs.ts` | The lesson store transaction (Y.Doc + derived JSON + hash + state vector, then the check job, last editor and audit through their ports) and v1 seeding inside the caller's transaction. | `PgLessonDocStore` | `tx.ts`, `ydoc`, `CheckQueue`, `LessonStateRepo`, `AuditLog` | A11a lesson store |
| `packages/db/src/repos/check-queue.ts` | The coalesced `check_job` queue and issue writes keyed to a hash, with resolution lookups. | `PgCheckQueue`, `PgIssueRepo` | `tx.ts` | A6a check core |
| `packages/db/src/repos/lessons.ts` | Lessons, versions and snapshots, review events, last editor, dependencies (one class implementing `LessonStateRepo`, `LessonVersionRepo`, `LessonGraphRepo`). | `PgLessonRepo` | `tx.ts` | A12a lesson records |
| `packages/db/src/repos/review-extras.ts` | Safety flags, alignment links, suggestions. | `PgSafetyFlagRepo`, `PgAlignmentRepo`, `PgSuggestionRepo` | `tx.ts` | A12a lesson records |
| `packages/db/src/repos/audit.ts` | Append-only `audit_event` writes and the history view. | `PgAuditLog` | `tx.ts` | A1 storage |
| `packages/db/src/repos/metrics.ts` | Heartbeats, review sessions, frozen metrics rows, aggregate reads and the board rows. | `PgMetricsRepo`, `PgBoardReadRepo` | `tx.ts` | A13a metrics records |
| `packages/db/src/repos/prompts.ts` | Prompt versions (locked hash + guidance), pins and guidance inserts. | `PgPromptRepo` | `tx.ts` | A7 llm |
| `packages/db/src/repos/exports.ts` | Export bundles. | `PgExportRepo` | `tx.ts` | A17 export |
| `packages/db/src/repos/evidence.ts` | Eval, probe, experiment and ops records. | `PgEvidenceRepo` | `tx.ts` | A20 evals |
| `packages/db/src/repos/judge.ts` | Judge verdicts (cut #2). | `PgJudgeRepo` | `tx.ts` | A19 judge |

### 2.3 Web app (`apps/web`)

Route files are thin: parse the request with the Zod mirror of the OpenAPI request schema, call one service method, map a
`DomainRefusal` to the error envelope. Services hold one workflow each and receive their ports by constructor, with
`tx: TxRunner` for transactions (never the concrete `PgDatabase`, Metz S1).

| Module | Responsibility (one sentence) | Interface (DO-4) | Depends on | Owner area |
|---|---|---|---|---|
| `apps/web/src/server/http/with-route.ts` | Wraps every route: session, `Origin` check on mutations, role check, request id, Zod parse (`INVALID_REQUEST`), pool wait (`SERVICE_BUSY` + `Retry-After`), refusal → envelope, latency log line. | `with_route` | `SessionService`, `obs` | A3 auth |
| `apps/web/src/server/http/passwords.ts` | Hashes and verifies seeded-account passwords with scrypt (CON-1). | `hash_password`, `verify_password` | node:crypto | A3 auth |
| `apps/web/src/server/http/refusal.ts` | Maps `DomainRefusal` codes to the HTTP status the card fixes and builds the envelope. | `to_error_response` | `schema/api` | A3 auth |
| `apps/web/src/server/container.ts` | Composition root: builds settings, `WebDeps` (database, ids, clock, the chosen model client) once per process and merges every wiring file's services. | `build_web_services` | `wiring/*` | A0 platform |
| `apps/web/src/server/wiring/<area>.ts` | One file per area that builds that area's concrete repositories, adapters and services from `WebDeps` (Metz B2). | `wire_sessions`, `wire_outlines`, `wire_runs`, `wire_review`, `wire_metrics`, `wire_assist`, `wire_prompts`, `wire_exports`, `wire_coverage` | the area's services | A0 writes the stubs in wave 0; then sessions A3, outlines A4, runs A10, review A12, metrics A13, assist A15, prompts A16, exports A17, coverage A18 |
| `apps/web/src/server/services/session-service.ts` | Signs in with email and password on seeded accounts, resolves sessions, signs out (CON-1). | `SessionService` | `SessionRepo`, `AuditLog`, `TxRunner`, `Clock` | A3 auth |
| `apps/web/src/server/services/outline-service.ts` | Stores outline versions, builds the validation report, records intake choices (CON-2, 3, 4). | `OutlineService` | `OutlineRepo`, `StandardRepo`, `SheetFetcher`, `core/intake`, `AuditLog`, `TxRunner` | A4 intake service |
| `apps/web/src/server/adapters/google-sheets.ts` | Fetches a public Google Sheet export URL once (TB-5). | `GoogleSheetsExportFetcher` | fetch | A4 intake service |
| `apps/web/src/server/services/run-service.ts` | Starts runs, reads progress, plan and summary, applies run control (CON-5, 6, 7, 8, 21). | `RunService` | `RunRepo`, `JobQueue`, `OutlineRepo`, `LessonStateRepo`, `PromptRepo`, `SpendLedger`, `ModelCallLog`, `core/lifecycle/run-machine`, `AuditLog`, `TxRunner` | A10 runs |
| `apps/web/src/server/services/board-service.ts` | Reads the unit board and unit metrics from stored rows (CON-9, 10). | `BoardService` | `BoardReadRepo`, `IssueRepo`, `MetricsRepo` | A13 metrics |
| `apps/web/src/server/services/coverage-service.ts` | Reads the coverage matrix in one query (CON-22, cut #4). | `CoverageService` | `AlignmentRepo` | A18 coverage |
| `apps/web/src/server/services/lesson-read-service.ts` | Reads a lesson (derived row or snapshot) and its history (CON-11, CON-19). | `LessonReadService` | `LessonStateRepo`, `LessonVersionRepo`, `LessonDocReader`, `AuditLog`, `editor-schema` | A12 review |
| `apps/web/src/server/services/issue-service.ts` | Reads issues as of a hash, records resolutions, clears safety flags, decides standards (CON-13, CON-14). | `IssueService` | `IssueRepo`, `CheckQueue`, `SafetyFlagRepo`, `AlignmentRepo`, `LessonStateRepo`, `CollabCommands`, `AuditLog`, `TxRunner` | A12 review |
| `apps/web/src/server/services/slot-service.ts` | Validates and fills a placeholder or excerpt slot through the collaboration server (CON-15). | `SlotService` | `LessonStateRepo`, `CollabCommands`, `CheckPolicy` | A12 review |
| `apps/web/src/server/services/candidate-service.ts` | Queues a one-lesson candidate run, reads a candidate, adopts it through the collaboration server (CON-16). | `CandidateService` | `LessonStateRepo`, `LessonVersionRepo`, `RunRepo`, `JobQueue`, `SpendLedger`, `CollabCommands`, `TxRunner` | A12 review |
| `apps/web/src/server/services/transition-service.ts` | Applies one lesson move (start review, submit, withdraw, request changes, reopen) in CON-18's precedence; Submit and the unfreezing moves go through the collaboration server; Approve is handed to `ApproveService`. | `TransitionService` | `LessonStateRepo`, `LessonVersionRepo`, `CollabCommands`, `ApproveService`, `core/lifecycle`, `TxRunner` | A12 review |
| `apps/web/src/server/services/approve-service.ts` | Approves one frozen snapshot: pin compare, checks re-run on the snapshot, gate, approval snapshot and frozen metrics row in one transaction (CON-18; Metz C2). | `ApproveService` | `LessonStateRepo`, `LessonVersionRepo`, `LessonGraphRepo`, `IssueRepo`, `CheckContextLoader`, `CHECK_RULES`, `core/checks`, `MetricsWriter`, `TxRunner` | A12 review (`risk::security`) |
| `apps/web/src/server/services/heartbeat-service.ts` | Records review heartbeats and extends review sessions (CON-20). | `HeartbeatService` | `MetricsRepo`, `Clock` | A13 metrics |
| `apps/web/src/server/services/metrics-writer.ts` | Writes the frozen `lesson_metrics` row once at first approval (R-49, R-60). | `MetricsWriter` | `MetricsRepo`, `core/metrics` | A13b metrics writer |
| `apps/web/src/server/services/suggestion-service.ts` | Requests an AI rewrite and hands an accept to the collaboration server, which applies it against the live document (CON-17, cut #8). | `SuggestionService` | `PaidCaller`, `PromptRenderer`, `PromptRepo`, `SuggestionRepo`, `CollabCommands`, `AuditLog`, `TxRunner` | A15 assist |
| `apps/web/src/server/services/prompt-service.ts` | Lists prompt versions and saves guidance versions (CON-24; the save is cut #7). | `PromptService` | `PromptRepo`, `AuditLog`, `TxRunner` | A16 prompts |
| `apps/web/src/server/services/export-service.ts` | Builds idempotent export bundles of approved snapshots (CON-23, cut #5). | `ExportService` | `LessonVersionRepo`, `ExportRepo`, `AuditLog`, `TxRunner` | A17 export |
| `apps/web/src/server/adapters/collab-commands.ts` | Calls the collaboration server's internal command routes over the Compose network and maps its answers (refusals pass through with the same code and details; transport failures become `COLLAB_UNAVAILABLE`). | `HttpCollabCommandClient`, `collab_refusal_from` | fetch, `COLLAB_INTERNAL_URL` | A11b collab client |
| `apps/web/app/api/**/route.ts` | One thin route file per OpenAPI path (DO-4 §1 lists them). | `with_route` handlers | services | the service's area |
| `apps/web/app/(app)/**` | Feature screens SCR-n, assembled from FW components against contract mocks (Prism) then the real API. | React pages | `src/components/**`, `src/lib/api-client.ts` | A14 web-ui |
| `apps/web/src/lib/api-client.ts` | Typed fetch client generated from the OpenAPI file (`openapi-typescript`). | generated types | OpenAPI file | A14 web-ui |
| `apps/web/src/editor/**` | ProseMirror editor bound to Yjs through `y-prosemirror` and `@hocuspocus/provider`. | React editor component | `editor-schema`, CON-12 | A14 web-ui |
| `apps/web/src/editor/refusals.ts` | On a `refused` message, undoes the local updates after `refused_from`, switches the editor to read-only and shows the refused text to the typist (SP-2's design rule). | `apply_refusal` | yjs (`UndoManager`), CON-12 | A14 web-ui |
| `apps/web/src/components/**`, `app/(dev)/**` | FW presentation components and gallery (owned by FW-1…FW-4; unchanged). | FW | — | FW |

### 2.4 Worker (`apps/worker`)

| Module | Responsibility (one sentence) | Interface (DO-4) | Depends on | Owner area |
|---|---|---|---|---|
| `apps/worker/src/main.ts` | Composition root and signal handling: builds `WorkerDeps` (worker id, chosen model client), merges the wiring files, starts both claim loops, drains on SIGTERM. | `build_worker_runtime` | `wiring/*` | A0 platform |
| `apps/worker/src/wiring/<area>.ts` | One file per area that builds its concrete repositories, nodes and runners from `WorkerDeps`. | `wire_generation`, `wire_checks`, `wire_judge` | the area's runners | A0 writes the stubs in wave 0; then generation A9, checks A6, judge A19 |
| `apps/worker/src/queue/claim-loop.ts` | Claims generation jobs up to the concurrency cap under its worker id, renews leases, and at start requeues expired leases, marks their lost calls and releases their reservations. | `ClaimLoop` | `JobQueue`, `ModelCallLog`, `SpendLedger`, `Clock` | A9 generation |
| `apps/worker/src/generation/unit-plan-job.ts` | Runs the one `UnitPlan` call per run (schema-enforced output) and stores it before any lesson job is claimable (R-8). | `UnitPlanJob` | `PaidCaller`, `PromptRenderer`, `RunRepo`, `OutlineRepo`, `PromptRepo` | A9 generation |
| `apps/worker/src/generation/lesson-job-runner.ts` | Steps one lesson job through the fixed nodes and records its terminal outcome. | `LessonJobRunner` | the nodes below | A9 generation |
| `apps/worker/src/generation/nodes/*.ts` | One node per step: draft (with the truncation retry), compile-and-check, repair, store, fail; every call goes through `PaidCaller`, so there is no separate reserve or settle node. | `DraftNode`, `CompileCheckNode`, `RepairNode`, `StoreNode`, `FailNode` | ports and pure core | A9 generation |
| `apps/worker/src/generation/run-finalizer.ts` | Moves a run to its terminal, capped or paused state and runs the end-of-run completeness query. | `RunFinalizer` | `RunRepo`, `JobQueue`, `core/lifecycle/run-machine`, `core/pipeline/circuit-breaker`, `TxRunner` | A9 generation |
| `apps/worker/src/checks/check-job-runner.ts` | Claims coalesced `check_job` rows from its own lane (never behind generation), runs the suite on the stored derived row, writes issues, re-queues dependants. | `CheckJobRunner` | `CheckQueue`, `LessonDocReader`, `IssueRepo`, `AlignmentRepo`, `LessonGraphRepo`, `CheckContextLoader`, `core/checks` | A6 check runner |
| `apps/worker/src/judge/judge-job.ts` | Runs the advisory judge per (activity, standard) and stores verdicts (cut #2). | `JudgeJob` | `JudgeClient`, `ModelCallLog`, `JudgeRepo`, `SpendLedger` | A19 judge |
| `apps/worker/src/health.ts` | Serves `GET /healthz` for the worker (WF-39). | `serve_health` | `PgDatabase` | A21 ops |

### 2.5 Collaboration server (`apps/collab`)

| Module | Responsibility (one sentence) | Interface (DO-4) | Depends on | Owner area |
|---|---|---|---|---|
| `apps/collab/src/main.ts` | Composition root: builds `CollabDeps` and the Hocuspocus server, mounts what `wire_collab` returns as extensions and internal routes. | `build_collab_runtime` | `wiring/collab.ts` | A0 platform |
| `apps/collab/src/wiring/collab.ts` | Builds the collaboration server's concrete repositories and its auth, guard, frozen set, persistence, acks and command handler. | `wire_collab` | everything below | A0 writes the stub in wave 0; then A11 collab server |
| `apps/collab/src/auth.ts` | `onAuthenticate`: resolves the app session from the cookie, loads the lesson's state and the role, and seeds the frozen set on a document's first connection. | `CollabAuthenticator` | `SessionRepo`, `LessonStateRepo`, `WriteGuard`, `FrozenDocs` | A11 collab server |
| `apps/collab/src/frozen-docs.ts` | Holds the per-document frozen flag in memory for the one collaboration process (SP-2 option A). | `FrozenDocs` | — | A11 collab server |
| `apps/collab/src/permissions.ts` | Decides read-only versus write per connection at connect, and refuses every update to a frozen document per message (`beforeHandleMessage`) with a `refused` message carrying `refused_from`. | `WriteGuard` | `FrozenDocs`, `is_editable` | A11 collab server |
| `apps/collab/src/persistence.ts` | `onLoadDocument` and `onStoreDocument`: loads the latest stored doc and runs the store transaction after the debounce. | `LessonPersistence` | `LessonDocStore`, `LessonDocReader`, `ydoc` | A11 collab server |
| `apps/collab/src/acks.ts` | Sends the `stored`, `mode` and `refused` stateless messages to the connections of a document. | `AckBroadcaster` | Hocuspocus | A11 collab server |
| `apps/collab/src/commands/routes.ts` | Internal HTTP routes (token-guarded, Compose network only) that execute `CollabCommands`. | `CollabCommandHandler` | `commands/*` | A11 collab server |
| `apps/collab/src/commands/lock-and-snapshot.ts` | Submit (the internal freeze call, SP-2 option A): freeze the document first so every later update is refused, store at once, check the client state vector is covered, re-run the blocking checks on the stored row, write the snapshot, the state change and the transition in one transaction, then broadcast read-only; unfreeze on any refusal. | `CollabCommandHandler.lock_and_snapshot` | `FrozenDocs`, `LessonDocStore`, `LessonStateRepo`, `LessonVersionRepo`, `IssueRepo`, `CheckContextLoader`, `run_checks`, `merge_resolutions`, `submit_gate`, `core/lifecycle` | A11 collab server |
| `apps/collab/src/commands/apply-edit.ts` | Applies an HTTP-started content edit (standard decision, slot fill, candidate adopt, suggestion accept resolved against the live document) as a tagged transaction by a named person, then stores. | `CollabCommandHandler.apply_edit` | `ydoc`, `editor-schema`, `FrozenDocs`, `is_editable` | A11 collab server |
| `apps/collab/src/commands/set-mode.ts` | Unfreezes (Withdraw, Request changes, Reopen) or re-freezes every connection of a lesson after the web app commits the state change, updating the frozen set first. | `CollabCommandHandler.set_mode` | `FrozenDocs`, `AckBroadcaster` | A11 collab server |
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

A port is a TypeScript `interface` in its own file under `packages/core/src/ports/` (Metz S5; A1 writes them all in wave
0 from DO-4 §3, then each file belongs to the area in *Implemented by*'s owner column of §2). Services and pipeline nodes
receive ports by constructor; only composition roots and the per-area wiring files name the implementations. Every
external system has exactly one adapter.

| Port | Implemented by | External system | Used by | Seam |
|---|---|---|---|---|
| `ModelClient` | `AnthropicMessagesAdapter`, `StubModelClient` | Anthropic Messages API (generation, repair, AI assist) | `ModelCallRecorder` only | **cut**: external system, and the stub is the second implementation every capture test needs |
| `JudgeClient` | `OpenRouterJudgeAdapter`, `StubJudgeClient` | OpenRouter (judge, cut #2) | `JudgeJob` | **cut**: different provider and trust boundary (TB-4); A-3 says only the adapter changes if the route changes |
| `SheetFetcher` | `GoogleSheetsExportFetcher` | Google Sheets export URL | `OutlineService` | **cut**: external network call; tests use an in-memory fake |
| `CollabCommands` | `HttpCollabCommandClient` (web side), `CollabCommandHandler` (collab side) | the collaboration process (Hocuspocus) | `IssueService`, `SlotService`, `CandidateService`, `TransitionService`, `SuggestionService` | **cut**: crosses a process boundary; A-1 (one content writer) depends on it |
| `TxRunner` | `PgDatabase`, `FakeTxRunner` | Postgres transactions | every service, node, runner and `CollabCommandHandler` that writes | **cut** (Metz S1): services stop depending on the concrete `PgDatabase`, so tests construct them with fakes |
| `LessonDocReader` | `PgLessonDocReader` | Postgres | `CheckContextLoader`, `CheckJobRunner`, `LessonReadService`, `LessonPersistence`, collab commands | **cut**: readers never see the write methods (I in SOLID), and the reader exists a wave before the store |
| `LessonDocStore` | `PgLessonDocStore` | Postgres | `LessonPersistence`, `StoreNode`, collab commands | **cut**: the HP-4 transaction lives in one place |
| `JobQueue` | `PgJobQueue` | Postgres | `ClaimLoop`, `RunService`, `CandidateService`, `RunFinalizer` | **cut**: HP-7's queue code is the riskiest SQL; a fake queue makes the runner testable |
| `CheckQueue` | `PgCheckQueue` | Postgres | `CheckJobRunner`, `IssueService`, `PgLessonDocStore` | **cut** |
| `SpendLedger` | `PgSpendLedger` | Postgres | `PaidCaller`, `ClaimLoop`, `RunService`, `CandidateService`, `JudgeJob` | **cut**: the atomic reservation must be one implementation for every caller |
| `ModelCallLog` | `PgModelCallLog` | Postgres | `ModelCallRecorder`, `ClaimLoop`, `JudgeJob`, `RunService`, `RunFinalizer` | **cut** |
| `SessionRepo` | `PgSessionRepo` | Postgres | `SessionService`, `CollabAuthenticator` | **cut** (repository) |
| `OutlineRepo` | `PgOutlineRepo` | Postgres | `OutlineService`, `RunService`, `CheckContextLoader`, `DraftNode`, `UnitPlanJob` | **cut** (repository) |
| `StandardRepo` | `PgStandardRepo` | Postgres | `OutlineService`, `CheckContextLoader`, `DraftNode` | **cut** (repository) |
| `RunRepo` | `PgRunRepo` | Postgres | `RunService`, `UnitPlanJob`, `DraftNode`, `RunFinalizer`, `CandidateService` | **cut** (repository) |
| `LessonStateRepo` | `PgLessonRepo` | Postgres | review services, `RunService`, collab, `StoreNode`, `FailNode`, `PgLessonDocStore` | **cut** (repository; Metz S3 split of the old `LessonRepo` by who asks) |
| `LessonVersionRepo` | `PgLessonRepo` | Postgres | review services, `ExportService`, collab commands, `StoreNode`, `FailNode` | **cut** (repository; S3 split) |
| `LessonGraphRepo` | `PgLessonRepo` | Postgres | `CheckContextLoader`, `CheckJobRunner`, `ApproveService` | **cut** (repository; S3 split) |
| `BoardReadRepo` | `PgBoardReadRepo` | Postgres | `BoardService` | **cut** (repository; the board read lives with metrics, A13a) |
| `IssueRepo` | `PgIssueRepo` | Postgres | `IssueService`, `ApproveService`, `CheckJobRunner`, `BoardService`, collab commands, `JudgeJob` | **cut** (repository) |
| `SafetyFlagRepo` | `PgSafetyFlagRepo` | Postgres | `IssueService`, `CheckContextLoader`, `StoreNode` | **cut** (repository) |
| `AlignmentRepo` | `PgAlignmentRepo` | Postgres | `CheckJobRunner`, `CheckContextLoader`, `CoverageService`, `IssueService`, `LessonReadService` | **cut** (repository) |
| `SuggestionRepo` | `PgSuggestionRepo` | Postgres | `SuggestionService`, `CheckContextLoader`, `LessonReadService` | **cut** (repository) |
| `AuditLog` | `PgAuditLog` | Postgres | every web service that acts; collab commands; `PgLessonDocStore` | **cut** (repository) |
| `MetricsRepo` | `PgMetricsRepo` | Postgres | `HeartbeatService`, `MetricsWriter`, `BoardService` | **cut** (repository) |
| `PromptRepo` | `PgPromptRepo` | Postgres | `PromptService`, `RunService`, `DraftNode`, `RepairNode`, `UnitPlanJob`, `SuggestionService` | **cut** (repository) |
| `ExportRepo` | `PgExportRepo` | Postgres | `ExportService` | **cut** (repository) |
| `JudgeRepo` | `PgJudgeRepo` | Postgres | `JudgeJob` | **cut** (repository, cut #2) |
| `EvidenceRepo` | `PgEvidenceRepo` | Postgres | `EvalRunner`, `run_spike`, `import_spike_report`, ops scripts | **cut** (repository) |
| `Clock` | `SystemClock`, `FakeClock` | system time | leases, heartbeats, sessions, timeouts | **cut**: leases and heartbeat merging are untestable without it |
| `IdGenerator` | `PrefixedIdGenerator` | — | every writer of a new id (`run_…`, `job_…`, `mc_…`) | **cut**: ids appear in fixtures and must be deterministic in tests |

## 4. Build areas

One area = one set of files one ticket stream owns. **Waves follow dependency order, strictly** (Metz B1): every
*cross-area call* goes to an area in an **earlier** wave, never to the same or a later one, and areas in the same wave
share no files. So every shared repository, the lesson state machine and the prompt repository are built in the wave
*before* their first consumer, and wave 3 holds only services, nodes, routes and UI. *Cross-area calls* are generated
mechanically from the DO-4 constructors: every constructor parameter or called function whose type or module belongs to
another area is listed, with its owner; each has a DO-4 signature with a fully spelled-out result type. Port interfaces
themselves are wave 0 (A1), so a same-or-later-wave *implementation* is never needed to compile or unit-test with fakes.

| Wave | Area | Owns | Cross-area calls (out) | Notes |
|---|---|---|---|---|
| FW | FW presentation | `apps/web/src/styles/**`, `apps/web/src/components/**`, `apps/web/app/(dev)/**`, and `apps/web/{package.json,tsconfig.json,…}` until A0 adopts them (as in `foundation-wave.md`) | none | already ready; DO-3 adopts `apps/web/` in place; FW-1 lands before A0 |
| 0 | A0 platform | root `package.json`, root `package-lock.json` (the only lockfile; A0 deletes `apps/web/package-lock.json` when it adopts `apps/web`), `tsconfig.base.json`, **every** workspace `*/package.json` and `*/tsconfig.json` (with subpath `exports`, no barrel `index.ts`), root `eslint.config.js` (boundaries rule, allow-list for SheetJS and `compromise` in core), `vitest.workspace.ts`, `docker-compose.yml`, `Dockerfile.web`, `Dockerfile.node`, `render.yaml`, `packages/config/**`, `packages/obs/**`, `apps/web/src/server/container.ts`, `apps/worker/src/main.ts`, `apps/collab/src/main.ts`, and the **stubs** of every `apps/web/src/server/wiring/*.ts`, `apps/worker/src/wiring/*.ts`, `apps/collab/src/wiring/collab.ts` | none at build; at run time the roots call `wire_*` (DO-4 §12) | writes the full dependency set of §1 once; a later dependency is a one-line A0 ticket, never a feature edit; each wiring stub passes to its area after wave 0, and the roots never change again (Metz B2) |
| 0 | A1 storage | `packages/db/migrations/**`, `packages/db/src/{pool,tx,migrate}.ts`, `packages/db/src/repos/audit.ts`, **every** `packages/core/src/ports/*.ts` (then each to its implementing area), `packages/core/src/testing/fake-tx.ts` | none | owns **all DDL**; other areas own their repo files but never write a migration (they raise a CHG to A1) |
| 0 | A2 schema | `packages/schema/**` (incl. `content-hash.ts`, `api/transition.ts`), `packages/editor-schema/**`, `docs/contracts/schemas/**` | none | schema fixed before the batch run (HP-4 addendum) |
| 1 | A3 auth | `apps/web/src/server/http/**` (incl. `passwords.ts`), `apps/web/src/server/services/session-service.ts`, `packages/db/src/repos/sessions.ts`, `apps/web/app/api/session/**`, `apps/web/middleware.ts`, `apps/web/src/server/wiring/sessions.ts` | `AuditLog.append`, `TxRunner.with_tx` (A1) | `risk::security`; `with_route` is the shared route wrapper, so it comes before every route area |
| 1 | A4a intake core | `packages/core/src/intake/**`, `packages/db/src/repos/outlines.ts` | none (types from A2) | pure parsing plus the outline repositories |
| 1 | A5 compile | `packages/core/src/compile/**`, `packages/ydoc/**`, `packages/db/src/repos/lesson-doc-reads.ts` | `assert_known_nodes`, `content_hash` (A2) | |
| 1 | A6a check core | `packages/core/src/checks/{registry,policy,gates}.ts`, `packages/core/src/checks/rules/**`, `packages/db/src/repos/check-queue.ts` | none (types from A2) | the first ticket writes all 28 rule files as stubs (Metz C1) |
| 1 | A7 llm | `packages/llm/src/{model-client,anthropic,stub,prices}.ts`, `packages/prompts/**`, `packages/db/src/repos/{model-calls,prompts}.ts` | none | provider key handling: `risk::security`; `PgPromptRepo` moved here from A16 (B1) |
| 1 | A8 spend | `packages/core/src/spend/**`, `packages/db/src/repos/spend.ts` | none (`SpendSettings` from A0) | money movement: `risk::security` |
| 1 | A9a queue and runs | `packages/db/src/repos/{runs,job-queue}.ts`, `packages/core/src/lifecycle/run-machine.ts` | none | moved out of A9/A10 so neither waits on the other (B1) |
| 1 | A12a lesson records | `packages/db/src/repos/{lessons,review-extras}.ts`, `packages/core/src/lifecycle/lesson-machine.ts` | none | moved out of A12 (B1); `PgLessonRepo` implements the three split ports (S3) |
| 1 | A13a metrics records | `packages/core/src/metrics/**`, `packages/db/src/repos/metrics.ts` (incl. `PgBoardReadRepo`) | none | GR-15: aggregate only |
| 1–3 | A14 web-ui | `apps/web/app/(app)/**`, `apps/web/src/editor/**` (incl. `refusals.ts`), `apps/web/src/lib/api-client.ts`, `apps/web/src/features/**` | HTTP: every CON route; socket: CON-12 | frontend tickets per screen spec SCR-n against Prism mocks from wave 1; integration tickets in wave 3 |
| 2 | A11a lesson store | `packages/db/src/repos/lesson-docs.ts` | `CheckQueue.enqueue` (A6a); `LessonStateRepo.record_last_editor` (A12a); `AuditLog.append` (A1); `lesson_to_ydoc`, `state_vector_of` (A5) | HP-4's one store transaction (S2) |
| 2 | A6b check context | `packages/core/src/checks/context-loader.ts` | `OutlineRepo.row_context`, `StandardRepo.texts` / `index` (A4a); `LessonGraphRepo.dependencies` (A12a); `LessonDocReader.latest_derived` (A5); `SuggestionRepo.pending_for`, `SafetyFlagRepo.open_for`, `AlignmentRepo.for_lesson` (A12a) | one context for worker, freeze and Approve |
| 2 | A7b paid calls | `packages/llm/src/{recorder,paid-call}.ts` | `ModelClient.complete`, `ModelCallLog.insert_sent` / `complete` / `fail` / `completed_for` (A7); `SpendLedger.reserve` / `settle` / `release`, `max_call_cost`, `settle_cost` (A8) | `risk::security` (money) |
| 2 | A11b collab client | `apps/web/src/server/adapters/collab-commands.ts` | none (implements the A1 port; tested against a stub server) | the internal-call client, ready before its five callers |
| 2 | A13b metrics writer | `apps/web/src/server/services/metrics-writer.ts` | `MetricsRepo.sessions_for` / `write_lesson_metrics`, `compute_lesson_metrics` (A13a) | ready before Approve |
| 3 | A4 intake service | `apps/web/src/server/services/outline-service.ts`, `apps/web/src/server/adapters/google-sheets.ts`, `apps/web/app/api/units/route.ts`, `apps/web/app/api/outline-versions/**`, `apps/web/src/server/wiring/outlines.ts` | `with_route` (A3); `OutlineRepo`, `StandardRepo`, `parse_workbook`, `normalize_outline`, `compute_lesson_links`, `build_validation_report`, `generate_gate` (A4a); `AuditLog.append`, `TxRunner` (A1) | untrusted input (`risk::security` for the sheet fetch) |
| 3 | A6 check runner | `apps/worker/src/checks/**`, `apps/worker/src/wiring/checks.ts` | `CheckQueue.claim` / `finish` / `enqueue`, `IssueRepo.replace_for_hash`, `run_checks`, `CHECK_RULES`, `CHECK_POLICY` (A6a); `CheckContextLoader.load` (A6b); `LessonDocReader.latest_derived` (A5); `AlignmentRepo.replace_for_hash`, `LessonGraphRepo.dependants` (A12a); `TxRunner` (A1) | |
| 3 | A9 generation | `apps/worker/src/{queue,generation}/**`, `packages/core/src/pipeline/**`, `apps/worker/src/wiring/generation.ts` | `PaidCaller.call`, `ModelCallRecorder.checkpoint` (A7b); `PromptRenderer.render_*`, `PromptRepo.get`, `ModelCallLog.mark_lost` (A7); `SpendLedger.release_for_jobs` (A8); `JobQueue.*`, `RunRepo.pinned_choices` / `store_unit_plan` / `mark_plan_failed` / `mark_capped` / `set_state`, `derive_run_state` (A9a); `OutlineRepo.row_context`, `StandardRepo.texts` (A4a); `compile_draft`, `SECTION_TEMPLATES` (A5); `CheckContextLoader.load` (A6b); `run_checks`, `CHECK_RULES`, `CHECK_POLICY` (A6a); `LessonDocStore.seed_initial` (A11a); `LessonVersionRepo.write_generated_version` / `has_generated_version`, `LessonStateRepo.set_state`, `SafetyFlagRepo.create_for_lesson` (A12a); `TxRunner` (A1) | |
| 3 | A10 runs | `apps/web/src/server/services/run-service.ts`, `apps/web/app/api/runs/**`, `apps/web/src/server/wiring/runs.ts` | `with_route` (A3); `RunRepo.*`, `JobQueue.create_run_jobs` / `requeue_failed` / `cancel_run` / `jobs_for_run`, `decide_run_control`, `derive_run_state`, `tile_state` (A9a); `OutlineRepo.generate_gate_inputs`, `generate_gate` (A4a); `LessonStateRepo.ensure_lessons` (A12a); `PromptRepo.current`, `ModelCallLog.totals_for_run` (A7); `SpendLedger.check_day_cap` / `run_totals`, `run_cap_for` (A8); `AuditLog.append`, `TxRunner` (A1) | |
| 3 | A11 collab server | `apps/collab/**` (except `main.ts`, `health.ts`; incl. `frozen-docs.ts`, `wiring/collab.ts`) | `SessionRepo.resolve` (A3); `LessonStateRepo.state_of` / `lock_for_update` / `set_state` / `append_review_event`, `LessonVersionRepo.write_snapshot`, `is_editable`, `decide_transition` (A12a); `LessonDocStore.store` (A11a); `LessonDocReader.latest`, `lesson_to_ydoc`, `ydoc_to_lesson`, `covers` (A5); `content_hash` (A2); `CheckContextLoader.load` (A6b); `run_checks`, `CHECK_RULES`, `merge_resolutions`, `submit_gate`, `IssueRepo.resolutions_for` (A6a); `AuditLog.append`, `TxRunner` (A1) | the internal command route, socket auth and the freeze are `risk::security` |
| 3 | A12 review | `apps/web/src/server/services/{lesson-read,issue,slot,candidate,transition,approve}-service.ts`, `apps/web/app/api/lessons/**` (except suggestions, heartbeats), `apps/web/src/server/wiring/review.ts` | `with_route` (A3); `CollabCommands.*` via `HttpCollabCommandClient` (A11b); `LessonStateRepo`, `LessonVersionRepo`, `LessonGraphRepo`, `SafetyFlagRepo`, `AlignmentRepo`, `SuggestionRepo`, `transition_roles`, `decide_transition` (A12a); `IssueRepo`, `CheckQueue.pending_for`, `run_checks`, `CHECK_RULES`, `merge_resolutions`, `approve_gate` (A6a); `CheckContextLoader.load` (A6b); `LessonDocReader.latest_derived` (A5); `assert_known_nodes` (A2); `RunRepo.insert_run`, `JobQueue.create_candidate_job` (A9a); `SpendLedger.check_day_cap` (A8); `MetricsWriter.write_first_approval` (A13b); `AuditLog.append` / `history`, `TxRunner` (A1) | approval integrity: `risk::security` for `ApproveService` and `TransitionService` |
| 3 | A13 metrics | `apps/web/src/server/services/{heartbeat,board}-service.ts`, `apps/web/app/api/units/[unitId]/{board,metrics}/**`, `apps/web/app/api/lessons/[lessonId]/heartbeats/**`, `apps/web/src/server/wiring/metrics.ts` | `with_route` (A3); `BoardReadRepo.board_rows`, `MetricsRepo.*`, `merge_heartbeats` (A13a); `IssueRepo.counts_by_lesson` (A6a) | GR-15: aggregate only |
| 3–4 | A20 evals | `evals/**`, `load/**`, `ops/faults/**`, `ops/import-spike.ts`, `packages/db/src/repos/evidence.ts` | the real entry points of every workflow (DO-6 capture rule); `StubModelClient` (A7) | golden tiers run in the merge gate |
| 0–3 | A21 ops | `ops/{seed.ts,backup.sh}`, `apps/{worker,collab}/src/health.ts`, `apps/web/app/api/healthz/**` | `run_migrations`, `PgDatabase.ping` (A1) | |
| 4 | A15 assist (cut #8) | `apps/web/src/server/services/suggestion-service.ts`, `apps/web/app/api/lessons/[lessonId]/suggestions/**`, `apps/web/src/server/wiring/assist.ts` | `with_route` (A3); `PaidCaller.call` (A7b); `PromptRenderer.render_assist`, `PromptRepo.current` (A7); `SuggestionRepo`, `LessonStateRepo.state_of` (A12a); `CollabCommands.apply_edit` (A11b); `AuditLog.append`, `TxRunner` (A1) | untrusted model text: `risk::security` |
| 4 | A16 prompts (save is cut #7) | `apps/web/src/server/services/prompt-service.ts`, `apps/web/app/api/prompt-versions/**`, `apps/web/src/server/wiring/prompts.ts` | `with_route` (A3); `PromptRepo.all` / `insert_guidance` (A7); `AuditLog.append`, `TxRunner` (A1) | the locked layer has no write path (R-38) |
| 4 | A17 export (cut #5) | `apps/web/src/server/services/export-service.ts`, `packages/db/src/repos/exports.ts`, `docs/contracts/lesson-export.schema.json`, `apps/web/app/api/{units/[unitId]/exports,exports}/**`, `apps/web/src/server/wiring/exports.ts` | `with_route` (A3); `LessonVersionRepo.approved_snapshots` (A12a); `AuditLog.append`, `TxRunner` (A1) | |
| 4 | A18 coverage (cut #4) | `apps/web/src/server/services/coverage-service.ts`, `apps/web/app/api/units/[unitId]/coverage/**`, `apps/web/src/server/wiring/coverage.ts` | `with_route` (A3); `AlignmentRepo.coverage_rows` (A12a) | one query (R-41); its own service file, so no edit to A13's `BoardService` |
| 4 | A19 judge (cut #2) | `apps/worker/src/judge/**`, `packages/llm/src/openrouter-judge.ts`, `packages/db/src/repos/judge.ts`, `apps/worker/src/wiring/judge.ts` | `PromptRenderer.render_judge`, `ModelCallLog.insert_sent` / `complete` (A7); `SpendLedger.reserve` / `settle` / `release`, `max_call_cost` (A8); `IssueRepo.replace_for_hash` (A6a); `TxRunner` (A1) | second provider key: `risk::security` |

**Cross-process calls** (the only ones; everything else meets in Postgres):

| From | To | How | Signature |
|---|---|---|---|
| browser | web | HTTP, CON-1…11, 13…24 | the OpenAPI file |
| browser | collab | websocket, CON-12 | `x-collaboration-channel` |
| web | collab | internal HTTP on the Compose network, bearer `COLLAB_INTERNAL_TOKEN` | `CollabCommands` (DO-4 §3.3) |
| collab, web | worker | none directly: `check_job` and `lesson_job` rows plus `NOTIFY lesson_job` / `NOTIFY check_job` | `JobQueue`, `CheckQueue` |
| worker, web | Anthropic | HTTPS through `PaidCaller` → `ModelCallRecorder` → `AnthropicMessagesAdapter` | `ModelClient` |
| worker | OpenRouter | HTTPS (cut #2) | `JudgeClient` |
| web | Google Sheets | one HTTPS GET per import | `SheetFetcher` |

## 5. Seams considered

| Seam | Decision | Why |
|---|---|---|
| Model provider behind `ModelClient` | **cut** | External system; the stub is a real second implementation (capture tests, faults, load). |
| One adapter per alias (generation vs repair) | **deferred** | Same provider and SDK; the alias picks the model id inside one adapter. Split when a second provider serves one alias. |
| Judge behind `JudgeClient` | **cut** | Different provider and trust boundary (A-3). |
| Prompt rendering apart from model calls (`packages/prompts`) | **cut** | Prompts change for content reasons, calls for vendor reasons (rule `agent-architecture`: prompts are code-owned artifacts apart from the call path). |
| Output schema enforced by the API vs embedded in the prompt | **decided per call by SP-1** | The API's schema-enforced mode rejected `LessonDraft` ("compiled grammar is too large"), so draft and repair embed the JSON Schema in the prompt and Zod validates in code (one repair); `UnitPlanDraft`, assist and judge keep schema-enforced output. One `output_mode` field on the request; one adapter. |
| `TxRunner` port instead of the concrete `PgDatabase` in services (Metz S1) | **cut** | Thirteen constructors took `PgDatabase` while tests must use fakes; five lines of interface. `PgDatabase` stays in composition roots, repositories, health and scripts. |
| One reserve → call → settle helper (`PaidCaller`, Metz S6) | **cut** | Every paid call repeats the money protocol; a leaked reservation inflates the day cap. We went one step past Metz's proposal: the lesson job also reserves **per call** instead of once per job, because each call's worst case is known only after its prompt is rendered (spec dry run G-17, G-18) and SP-1 fixed one draft, one truncation retry and one repair, each with its own output cap. |
| `LessonRepo` split by caller (`LessonStateRepo`, `LessonVersionRepo`, `LessonGraphRepo`, `BoardReadRepo`; Metz S3) | **cut** | One 16-method interface had consumers in six areas; narrow constructor parameters, one Pg class at first. |
| `LessonDocReader` apart from `LessonDocStore` | **cut** | Readers (loader, check runner, lesson read, persistence load) need no write method, and the reader can be built a wave before the store (B1). |
| Per-area wiring files under the composition roots (Metz B2) | **cut** | Otherwise every area edits `container.ts` / `main.ts`, or a route cannot reach its service until someone else wires it. |
| One port per file under `packages/core/src/ports/` (Metz S5) | **cut** | A single append-only `ports.ts` would be past the size cap and a parallel-append collision point. |
| Approve in its own service (`ApproveService`, Metz C2) | **cut** | Approve is the `risk::security` path with frozen tests; the unfreezing moves are separate tickets; one file each. |
| Editable-state list in `WriteGuard` (Metz C3) | **don't** | `WriteGuard` and `apply_edit` ask `is_editable` in the lesson machine, so a new state is one edit. |
| A second freeze mechanism (SP-2 option B: close every connection at Submit) | **don't** | SP-2 rejected it: refused keystrokes came back on reconnect (120 in 20 trials) while option A (read-only flip plus a per-update guard) had 0. Building it "just in case" invites someone to wire it. |
| Check registry with all rule files stubbed up front (Metz C1) | **cut** | Parallel rule tickets otherwise all edit `registry.ts`; the first A6a ticket writes all 28 stubs. |
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
| `run` | web (create, control), worker (state) → `PgRunRepo` | web | `id`, `unit_id`, `outline_version_id`, `kind` (`run` / `trial` / `candidate`), `state`, `scope_json`, `parent_run_id`, `prompt_version_id`, `choices_json`, `choices_hash` (UXQ-9: the choice set copied at start), `cap_usd`, `capped_by` (`run_cap` / `day_cap` / `project_cap`, CON-6's names), `paused_check`, `idempotency_key` (unique per user for 24 h), `started_by`, `plan_stored_at`, `created_at`, `finished_at`, `eval_run_id` | `0004_runs.sql` |
| `unit_plan` | web (row and `lesson_links_json` copied at run start), worker (entries) → `PgRunRepo` | web, worker | `run_id`, `state` (`planning` / `stored` / `failed`), `entries_json`, `lesson_links_json`, `model_call_id`, `stored_at` | `0004_runs.sql` |
| `lesson_job` | web (create), worker (claim, finish) → `PgJobQueue` | web | `id`, `run_id`, `kind` (`unit_plan` / `lesson` / `candidate`), `lesson_id`, `idempotency_key`, `status`, `tile_state`, `attempt` (claim count), `worker_id`, `lease_until`, `queued_at`, `started_at`, `finished_at`, `failure_reasons_json`, `brakes_fired`, `calls_lost`, `repairs`, `truncation_retries`, `retries`; partial unique index: one queued or running candidate job per lesson (CON-16) | `0004_runs.sql` |
| `spend_reservation` | worker, web (assist, candidate) → `PgSpendLedger` | web | `id`, `run_id`, `job_id`, `user_id`, `purpose`, `model_call_id`, `reserved_usd`, `settled_usd`, `overshoot_usd`, `status` (`reserved` / `settled` / `released`), `day` (UTC date), `created_at`, `closed_at`; one row per paid call | `0004_runs.sql` |
| `model_call` | worker, web (assist) → `PgModelCallLog` | web (summary), operator | `id`, `run_id`, `lesson_id`, `job_id`, `attempt` (the call's ordinal for its job and purpose, the checkpoint key), `reservation_id` (null only for imported spike calls), `purpose`, `alias`, `requested_model`, `served_model`, `rendered_prompt`, `raw_output`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`, `cost_usd`, `stop_reason`, `status` (`sent` / `completed` / `failed` / `lost`), `provider_request_id`, `request_id`, `sent_at`, `completed_at`, `experiment_id` | `0005_traces.sql` |
| `lesson` | worker (create, `generation_failed`), web and collab (state) → `PgLessonRepo` | all | `id`, `unit_id`, `number`, `type`, `title`, `state`, `current_version_id`, `reviewer_id`, `last_editor_id`, `schema_version` | `0006_lessons.sql` |
| `lesson_version` | worker (v1, candidates), collab (Submit), web (Approve, reopen) → `PgLessonRepo` | all | `id`, `lesson_id`, `number`, `kind` (`generated` / `candidate` / `submit` / `approve` / `reopen`), `adopted`, `content_hash`, `state_vector`, `lesson_json`, `draft_json`, `teacher_word_count`, `provenance_json` (model fields nullable for human-made versions), `derived_from_version_id`, `run_id`, `model_call_ids`, `dependency_record_json`, `created_by`, `stored_at` | `0006_lessons.sql` |
| `lesson_doc` | **collab only** (worker seeds seq 1 through the same function) → `PgLessonDocStore` | web, worker | `lesson_id`, `seq`, `store_id`, `ydoc_bytes`, `derived_json`, `content_hash`, `state_vector`, `schema_version`, `stored_by`, `stored_at`, `request_id` | `0006_lessons.sql` |
| `check_job` | collab, web (inside the store transaction) → `PgCheckQueue` | worker | `lesson_id`, `content_hash`, `store_id`, `status`, `enqueued_at`, `claimed_at`, `finished_at`, `lease_until` | `0007_checks.sql` |
| `issue` | worker → `PgIssueRepo`; resolution columns by web | web | `id`, `lesson_id`, `content_hash`, `level`, `kind`, `message`, `address`, `span_anchor`, `related_lesson_id`, `code`, `resolved_by`, `resolution_reason`, `resolved_at`, `cleared_by` (`fix` / `resolution`), `created_at` | `0007_checks.sql` |
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
Model and spend settings (`ModelSettings`, `SpendSettings`, DO-4 §9) are parsed by web and worker only: the
collaboration server never calls a model and starts without a provider key (Metz S4). Values marked SP-1 / SP-3 are the
spike results of 2026-10-25 (`docs/analysis/spikes/`).

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
| `MODEL_GENERATION_ID`, `MODEL_REPAIR_ID`, `MODEL_ASSIST_ID` | string | `claude-sonnet-5-5` for all three [M] (SP-1 generated and repaired on it; assist [A]) | `AnthropicMessagesAdapter`, `PRICE_TABLE` lookup |
| `MODEL_JUDGE_ID` | string | confirmed at build (PD-12; cut #2) | `OpenRouterJudgeAdapter` |
| `MODEL_EFFORT` | `low` / `medium` / `high` | `low` [M] (SP-1) | `AnthropicMessagesAdapter` via `StructuredCallRequest.effort` |
| `MODEL_CALL_TIMEOUT_MS` | int | 240000 [C] (SP-1: 2 × the slowest call, 119.7 s, under the 300 s line) | `ModelCallRecorder` |
| `ASSIST_CALL_TIMEOUT_MS` | int | 20000 (CON-17) | `SuggestionService` |
| `SUGGESTION_TTL_MIN` | int | 30 [A] (CON-17) | `SuggestionService`, `PgSuggestionRepo.pending_for` |
| `UNDO_WINDOW_S` | int | 60 [A] (CON-14) | `IssueService.decide_standard` |
| `DRAFT_OUTPUT_TOKEN_CAP` | int | 32000 [M] (SP-1: 0 truncations; a lesson used ~11.2k output tokens) | `DraftNode`, `RepairNode`, `max_call_cost` |
| `TRUNCATION_RETRY_TOKEN_CAP` | int | 48000 [C] (SP-1) | `DraftNode` |
| `PROVIDER_MAX_RETRIES` | int | 3 | `ModelCallRecorder` |
| `GENERATION_CONCURRENCY` | int 1–6 | 6 [C] (SP-1: ~50k output tokens/min at 6 in flight against a 400k/min limit; PD-13) | `ClaimLoop` |
| `WORKER_ID` | string | `<hostname>-<pid>`, filled at start | `ClaimLoop` → `JobQueue.claim` (G-27) |
| `MAX_ACTIVE_RUNS` | int | 3 [A] | `PgJobQueue.claim` |
| `JOB_WALL_CLOCK_MS` | int | 600000 [T] | `LessonJobRunner` |
| `JOB_LEASE_MS` | int | 120000, renewed every 30 s [A] | `ClaimLoop`, `PgJobQueue` |
| `JOB_POLL_MS`, `CHECK_POLL_MS` | int | 1000, 500 [A] | `ClaimLoop`, `CheckJobRunner` |
| `CIRCUIT_BREAKER_SAME_CHECK` | int | 3 | `should_pause_run` |
| (no setting) temperature, example set | — | temperature = provider default, as SP-1 ran; example set = none (SP-1 used no few-shot examples, the only ones are restricted, GR-9) | `StructuredCallRequest.temperature = null`, `DraftPromptInput.example_set_id = null` (G-28) |
| `BUILD_SPEND_CEILING_USD` | decimal | 75 [T] (PD-29): the "project" scope of `DAY_CAP_REACHED` | `PgSpendLedger` (via `SpendSettings`, G-1) |
| `RUN_CAP_DEFAULT_USD` | decimal | 13.00 [C] (SP-1: $0.182 × 47 × 1.5 + $0.16, rounded up to the dollar; PD-14) | `RunService.start` (suggested cap), `user_day_cap_for` |
| `COST_PER_LESSON_ESTIMATE_USD` | decimal | 0.182 [M] (SP-1 mean per lesson, repairs included) | `run_cap_for` |
| `UNIT_PLAN_COST_ESTIMATE_USD` | decimal | 0.16 [M] (SP-1) | `run_cap_for` |
| `RUN_CAP_MULTIPLIER` | decimal | 1.5 (PD-14) | `run_cap_for` |
| `USER_DAY_CAP_MULTIPLIER` | decimal | 2 [A] → user day cap = 2 × `RUN_CAP_DEFAULT_USD` = $26.00 [C] (G-2) | `PgSpendLedger` (`user_day_cap_for`) |
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

Each process has one composition root, which builds only the shared dependencies (`WebDeps`, `WorkerDeps`,
`CollabDeps`: settings, logger, `PgDatabase`, ids, clock and, for web and worker, the model client chosen by
`MODEL_PROVIDER_MODE`) and merges what each **per-area wiring file** returns (DO-4 §12; Metz B2). A wiring file builds
its area's concrete repositories, adapters and services from those deps. Services and adapters never construct their own
dependencies.

| Built by | Builds, in order |
|---|---|
| `apps/web/src/server/container.ts` → `build_web_services(settings)` (A0) | `WebSettings` → `Logger` → `PgDatabase` → `PrefixedIdGenerator`, `SystemClock` → `AnthropicMessagesAdapter` or `StubModelClient` → `WebDeps` → `wire_sessions`, `wire_outlines`, `wire_runs`, `wire_review`, `wire_metrics`, `wire_assist`, `wire_prompts`, `wire_exports`, `wire_coverage` → merged `WebServices`. Cached on `globalThis` once per server process. |
| `apps/web/src/server/wiring/review.ts` (A12; the largest, as an example) | `PgLessonRepo`, `PgIssueRepo`, `PgCheckQueue`, `PgSafetyFlagRepo`, `PgAlignmentRepo`, `PgSuggestionRepo`, `PgLessonDocReader`, `PgOutlineRepo`, `PgStandardRepo`, `PgRunRepo`, `PgJobQueue`, `PgSpendLedger` (with `SpendSettings`), `PgMetricsRepo`, `PgAuditLog` → `HttpCollabCommandClient` → `CheckContextLoader` → `MetricsWriter` → `LessonReadService`, `IssueService`, `SlotService`, `CandidateService`, `ApproveService` (with `CHECK_RULES`, `CHECK_POLICY`) → `TransitionService` (with `ApproveService`). |
| `apps/worker/src/main.ts` → `build_worker_runtime(settings)` (A0) | `WorkerSettings` (with `WORKER_ID`) → `Logger` → `PgDatabase` → ids, clock → model client → `WorkerDeps` → `wire_generation` (repos → `ModelCallRecorder` → `PaidCaller` → `PromptRenderer` → `CheckContextLoader` → nodes → `LessonJobRunner`, `UnitPlanJob`, `RunFinalizer` → `ClaimLoop`), `wire_checks` (repos → `CheckContextLoader` → `CheckJobRunner`), `wire_judge` (if built) → health server. |
| `apps/collab/src/main.ts` → `build_collab_runtime(settings)` (A0) | `CollabSettings` → `Logger` → `PgDatabase` → ids, clock → `CollabDeps` → Hocuspocus `Server` → `wire_collab` (`PgSessionRepo`, `PgLessonRepo`, `PgLessonDocReader`, `PgLessonDocStore`, `PgIssueRepo`, `PgCheckQueue`, `PgAuditLog`, the read repos `CheckContextLoader` needs → `CheckContextLoader` → `FrozenDocs` → `WriteGuard` → `CollabAuthenticator`, `LessonPersistence`, `AckBroadcaster` → `CollabCommandHandler`) → extensions (`onAuthenticate`, `beforeHandleMessage` → `WriteGuard.on_update`, `onLoadDocument`, `onStoreDocument`, debounce) and `CollabCommandHandler` mounted on `onRequest`. |
| `evals/src/cli.ts`, `load/spike.ts`, `ops/*.ts` | their settings → `PgDatabase` → `PgEvidenceRepo` → the suite or script; S6 and capture tests build a worker runtime with `StubModelClient` and `FakeClock`. |
| Tests | construct services directly with in-memory fakes of the ports (`FakeTxRunner`, `FakeJobQueue`, `FakeSpendLedger`, `FakeCollabCommands`, `StubModelClient`, `FakeClock`). |

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
| Internal ports | `packages/core/src/ports/*.ts` (DO-4 §3–§4) |
| Tables | `packages/db/migrations/*.sql` (§6) |
