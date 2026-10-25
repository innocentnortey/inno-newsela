# Code design review — Newsela Lesson Studio (DO-3, DO-4)

**Reviewed:** [`docs/design/code-design.md`](../code-design.md) (DO-3), [`docs/design/component-contracts.md`](../component-contracts.md)
(DO-4), mirror [`.claude/reference/area-map.md`](../../../.claude/reference/area-map.md). **Against:** architecture, system design,
INTERFACE (24 agreed cards), hard problems, foundation wave, SP-2 result, rule `code-design-solid-modularity`.
**Reviewer:** `metz-code-design-agent`, 2026-10-25. No product code exists yet beyond plans, so there is no churn to read;
every finding is about the cost of the first two waves.

## The story in three sentences

This design turns an outline sheet into generated lessons and then into collaboratively reviewed, frozen and approved
lessons, across three processes (web, worker, collab) that meet in Postgres. The change it most needs to absorb is not a
new vendor; it is **its own build**: about twenty areas built by parallel agents over two days, then the SP-1/SP-3
threshold changes. The module boundaries are mostly right; the **wave table** and a handful of **shared files** are
what would make parallel tickets collide or wait.

## Module table (by package; DO-3 §2 has the per-file rows)

| Module | One-sentence responsibility | Depends on | Direction |
|---|---|---|---|
| `packages/schema`, `editor-schema` | Define every record shape and the one ProseMirror schema. | zod, prosemirror-model | OK |
| `packages/core` (intake, compile, checks, spend, lifecycle, pipeline, metrics) | Decide everything the business can change, as pure functions over typed records. | schema, editor-schema, its own ports | OK (SheetJS in `parse-grid.ts` is pure; allow-list it in the lint rule) |
| `packages/core/src/ports.ts` | Declare the interfaces adapters implement. | schema | OK, but one file for ~25 ports (S5) |
| `packages/core/src/checks/context-loader.ts` | Build one `CheckContext` for the three callers. | ports only | OK |
| `packages/db` | Implement the storage ports; own all DDL. | pg, core ports | OK; `PgLessonDocStore` writes three other areas' tables (S2) |
| `packages/llm`, `packages/prompts` | Call providers through one recorder; render the locked prompt. | SDKs, core ports | OK |
| `packages/ydoc` | Convert Lesson JSON to and from Y.Doc; hash. | yjs, y-prosemirror | OK |
| `apps/web` services | One workflow per service, ports by constructor. | ports **and the concrete `PgDatabase`** | **Not OK** (S1) |
| `apps/worker` nodes, runner | Step a typed job state through fixed nodes. | ports, pure core, `PgDatabase` | Not OK for the same reason (S1) |
| `apps/collab` | Auth, write guard, persistence, acks, internal commands. | ports, core lifecycle, Hocuspocus | OK; guard under-specified (B3) |
| composition roots (`container.ts`, `main.ts` ×2) | Build concretes once per process. | everything | OK in direction; a collision point (B2) |

## Seams

| Seam | Call | Why |
|---|---|---|
| `ModelClient`, `JudgeClient`, `SheetFetcher`, `CollabCommands` | **cut now** (as designed) | External systems or process boundaries, each with a real second implementation (stub, fake). |
| Storage ports per table group | **cut now** | Lets services be tested with fakes and areas own their SQL. |
| `TxRunner` (transaction runner) port | **cut now** (missing) | Every service takes a concrete `PgDatabase`; see S1. Five lines. |
| `LessonRepo` split by caller | **cut now** | 16 methods, consumers in six areas, file owned by a wave-2 area; see B1 and S3. |
| Per-area wiring files under the composition roots | **cut now** | Otherwise every area edits `container.ts`; see B2. |
| A paid-call helper around reserve → call → settle/release | **cut now** for the three single-call callers | Five callers repeat the money protocol; see S6. |
| Hocuspocus wrapper, generic repository base, event bus, CQRS, per-alias adapters, Redis, feature flags | **defer** (as designed) | Triggers named in DO-3 §5 are the right ones. |
| A second freeze mechanism (SP-2 option B, close every connection) | **don't** | SP-2 rejected it (120 resurrected keystrokes); keeping it in DO-3/DO-4 invites someone to build it (B3). |

## Findings, most costly first

### B1 · Blocking — the waves do not follow the dependency order the design claims (DO-3 §4, mirror *Areas and waves*)

DO-3 §4 says "Waves follow dependency order". The cross-area calls say otherwise:

- **A6 checks (wave 1)** calls `LessonDocStore.latest_derived` (A11, wave 2), `LessonRepo.dependants`,
  `SuggestionRepo.pending_for` and `SafetyFlagRepo.open_for` (A12, wave 2).
- **A10 runs and A9 generation (wave 2)** need `PgPromptRepo` (A16, **wave 3**): `RunService.start` pins
  `PromptRepo.current`, and `DraftNode`, `RepairNode` and `UnitPlanJob` take `prompts: PromptRepo`.
- **Wave 2 hangs on one A12 ticket:** A9 (`write_generated_version`), A10 (`ensure_lessons`), A11 (`state_of`,
  `write_snapshot`, `record_last_editor`, and the pure `decide_transition`) and A13 (`board_rows`) all need A12's
  `repos/lessons.ts` or `lifecycle/lesson-machine.ts`. Wave 2 is six areas on paper and one line in practice.
- **The cross-area column is incomplete**, so a §7 collision map built from it will be wrong. A9's row omits
  `OutlineRepo`, `StandardRepo`, `PromptRepo` (DraftNode), `CheckContextLoader` (CompileCheckNode), `SafetyFlagRepo`
  (StoreNode) and `ModelCallLog` (RunFinalizer). A10's row omits `LessonRepo.ensure_lessons` and `ModelCallLog.totals_for_run`.

**Change it makes expensive:** the first §7 cut. Wave-1 A6 tickets can pass unit tests on fakes but cannot be proven at
their real entry point (DO-6 capture rule) until wave 2. Wave-2 agents start together and then wait.

**Fix (re-table, no new code):** build every shared repository and the lesson state machine in the wave *before* its
first consumer. Wave 2 then holds only services, nodes, routes and UI, which really do share nothing.

| Move | From | To |
|---|---|---|
| `packages/db/src/repos/{lessons,review-extras}.ts`, `packages/core/src/lifecycle/lesson-machine.ts` | A12, wave 2 | new **A12a lesson records**, wave 1 |
| `packages/db/src/repos/lesson-docs.ts` | A11, wave 2 | A5 compile, wave 1 (it already owns `ydoc`, which the store needs) |
| `packages/db/src/repos/prompts.ts` (reads and `insert_guidance`) | A16, wave 3 | A7 llm, wave 1; A16 keeps the service and routes |
| `packages/db/src/repos/{runs,job-queue}.ts` | A10 / A9, wave 2 | wave 1 (either a new **A9a queue and runs** area or A1), so A9 and A10 stop waiting on each other |

Then regenerate §4's *Cross-area calls* column mechanically from the DO-4 constructors (every constructor parameter
whose type belongs to another area is a row), and re-mirror the area map.

### B2 · Blocking — files every area must touch have no owner, or belong to the merge (DO-3 §1, §4 rows FW and A0)

- **Package manifests and the lockfile.** Only the root `package.json` (A0) and `apps/web/{package.json,package-lock.json}`
  (FW-1) are owned. `packages/{core,db,llm,ydoc,prompts,schema,editor-schema}/package.json`, `apps/{worker,collab}/package.json`,
  each workspace `tsconfig.json`, the root `package-lock.json` and the root ESLint config that carries the boundaries rule
  (§1) belong to nobody. Wave 1 adds SheetJS (A4), yjs (A5), the Anthropic SDK (A7); wave 2 adds Hocuspocus and
  y-prosemirror (A11, A14). Each is a lockfile edit, and the batch-merge rule treats a non-context conflict as a
  send-back.
- **Composition roots "wired last in each wave by the wave's merge".** The merge agent merges and runs gates; it does not
  write code (`build-loop-test-scope`). As written, either every area edits `container.ts` / `main.ts` (a hot file) or
  no area can reach its service through a route until someone else wires it.

**Fix.**
1. A0 (wave 0, after FW-1 lands) owns **every** `*/package.json`, `*/tsconfig.json`, the root lockfile, the root ESLint
   and Vitest workspace configs. It writes the full dependency set DO-3 §1 already names, deletes
   `apps/web/package-lock.json` when it adopts `apps/web` into the workspace, and declares subpath `exports` per package
   (no barrel `index.ts` that every area appends to). A later dependency is a one-line A0 ticket, never a feature edit.
2. Per-area wiring files, created as stubs by A0 in wave 0 and owned by the area thereafter:

```ts
// apps/web/src/server/wiring/review.ts  (owned by A12)
export function wireReview(d: WebDeps): Pick<WebServices, "lesson_reads" | "issues" | "slots" | "candidates" | "transitions"> { … }
// container.ts (A0) imports every wiring file once, in wave 0, and never changes again.
```

Same shape for `apps/worker/src/wiring/*.ts` and `apps/collab/src/wiring/*.ts`.

### B3 · Blocking — the SP-2 result is not carried into DO-3/DO-4 (DO-3 §2.3, §2.5; DO-4 §1, §7)

SP-2 passed with option A and says, in its own words, "Design rule carried into DO-3/DO-4 and the editor tickets: on a
refused update the editor drops its refused local edits and tells the typist." Neither document carries it:

- DO-3 §2.5 (`lock-and-snapshot.ts`) and DO-4 §1 still describe "SP-2 fallback closes every connection instead of
  locking in place": option B, which SP-2 measured resurrecting 6 keystrokes per trial.
- The per-message guard SP-2 proved necessary (`beforeHandleMessage` refuses any update on a frozen document) has no
  signature. `WriteGuard.can_write(role, state, locked)` decides only at connect; nothing says where the frozen flag lives
  between `lock_and_snapshot` and the `mode` broadcast.
- `AckBroadcaster.refused(socket_id, code, message)` drops CON-12's `refused_from` field (the client's state vector
  before the refused updates). Without it the editor cannot tell which local edits to drop. DO-4 contradicts an agreed card here.
- DO-3 §2.3 `apps/web/src/editor/**` names no module for the drop-and-tell behaviour.

**Change it makes expensive:** A11 (server) and A14 (editor) build the two ends of this channel in parallel in wave 2,
and it is the approval-integrity path (`risk::security`). A gap here becomes a mismatch found at integration.

**Fix.**
- Delete the fallback clause from DO-3 §2.5 and DO-4 §1; record "option B rejected by SP-2" in DO-3 §5.
- DO-4 §7: `WriteGuard.on_update(ctx: SocketContext, frozen: bool) -> WriteDecision`, called from `beforeHandleMessage`;
  the frozen flag is a per-document in-memory set that `lock_and_snapshot` sets before it stores, seeded from
  `lesson.state` on load.
- DO-4 §7: `refused(socket_id, code, message, refused_from: StateVector)`, matching CON-12.
- DO-3 §2.3: add `apps/web/src/editor/refusals.ts`: "On `refused`, undoes local updates after `refused_from`, switches
  to read-only and shows the refused text to the typist." Owner A14.

*Question for the orchestrator (not a decision of mine):* SP-2 notes "Innocent has not read this result yet". Option A
is adopted under PD-32; if he reverses to B, only the guard bullets above change.

### S1 · Should — services and nodes depend on the concrete `PgDatabase` (DO-4 §5, §6, §3.3; D in SOLID)

Thirteen constructors take `db: PgDatabase` for `with_tx`, while DO-3 §8 promises "tests construct services directly
with in-memory fakes". Each implementer will invent its own cast or reach for a real database.

**Fix:** one port in core; `PgDatabase` implements it; a `FakeTxRunner` calls `fn` with a dummy `Tx`.

```ts
export interface TxRunner { withTx<T>(fn: (tx: Tx) => Promise<T>, advisoryLock?: string): Promise<T> }
```

Replace `db: PgDatabase` with `tx: TxRunner` in every service, node and `CollabCommandHandler`. Keep `PgDatabase` only in
composition roots, health and scripts.

### S2 · Should — the store transaction writes three other areas' tables in its own SQL (DO-4 §3.4 `LessonDocStore.store`, §12 `PgRepo_ctor`)

`store` "UPSERT[s] the coalesced check_job", updates `lesson.last_editor_id` and inserts `audit_event`, but
`PgRepo_ctor` gives it only `db`, `ids` and `clock`. That makes a second writer of `check_job` beside
`PgCheckQueue.enqueue` (A6) and contradicts DO-4 §11 ("`CheckQueue.enqueue` inside the store transaction") and DO-3 §6's
single owner. The coalescing rule, which CON-13's `pending` depends on, would exist twice and drift.

**Fix:** `PgLessonDocStore(db, ids, clock, checks: CheckQueue, lessons: LessonRepo, audit: AuditLog)`; `store` calls
`checks.enqueue(…, tx)`, `lessons.record_last_editor(…, tx)` and `audit.append(…, tx)` inside its one transaction. Reword the
DO-4 comment to name those calls.

### S3 · Should — `LessonRepo` is one interface for six areas (DO-4 §3.5; I in SOLID)

`BoardService` imports 16 methods to use `board_rows`; collab imports them to use three. Every new caller edits the same
interface and the same file. **Fix** (fold into B1's move): split by who asks.
`LessonStateRepo` (`get`, `lock_for_update`, `state_of`, `set_state`, `append_review_event`, `record_last_editor`),
`LessonVersionRepo` (`write_generated_version`, `write_snapshot`, `version`, `latest_snapshot`, `candidate`,
`approved_snapshots`), `LessonGraphRepo` (`dependencies`, `dependants`), `ensure_lessons` on the state repo, and
`board_rows` moved to a `BoardReadRepo` in A13's `repos/metrics.ts`. They can share one Pg class at first; the point is
narrow constructor parameters.

### S4 · Should — typed settings disagree with DO-3 §7 and over-share secrets (DO-4 §9)

`WebSettings` lacks `outline_max_bytes`, `idempotency_window_h`, `undo_window_s`, `suggestion_ttl_min`,
`heartbeat_min_spacing_s`, `app_origin` and `busy_retry_after_s`, all of which DO-3 §7 assigns to web consumers. A0 builds
settings in wave 0 from DO-4, so wave-1/2 tickets will edit A0's files. And `SharedSettings` carries
`anthropic_api_key` and the spend fields into **collab**, which never calls a model; with "required when
`MODEL_PROVIDER_MODE=real`", collab will not start without the key. **Fix:** add the missing fields; move model and spend
fields into a `ModelSettings` included by `WebSettings` and `WorkerSettings` only; add the missing ASSIST model id
(`ModelAlias` has `ASSIST`, settings have no `MODEL_ASSIST_ID`).

### S5 · Should — `ports.ts` is one "append-only" file for every port (DO-3 §2.1 row, §3; DO-4 §3)

DO-4 §3 is about 1,100 lines of ports and records. As one TypeScript file it is past the `code-structure` hard cap, and
"append-only" by several areas means parallel appends to the same file end. **Fix:**
`packages/core/src/ports/<port>.ts` (one port with its records per file), all written by A1 in wave 0 straight from
DO-4; after wave 0 each file belongs to the area that implements it, and a change is a CHG through that owner.

### S6 · Should — the money protocol is repeated in five callers (DO-4 §4–§6; three is a pattern)

`UnitPlanJob`, `SuggestionService`, `JudgeJob`, `ReserveNode`/`SettleNode` and `RepairNode` each do reserve → call →
settle, or release on failure. A leaked reservation inflates the day cap and locks a user out. **Fix:** one function in
A7 for the single-call callers (unit plan, assist, judge):
`paid_call(ctx, req, rendered, reservation: ReservationRequest) -> RecordedCall` (reserve, `recorder.call`, settle, release
in `finally`). The lesson job keeps its node-level reserve and settle, because its reservation spans the truncation retry
and repair: a real difference, not duplication.

### C1 · Could — the check registry is a shared line-list (DO-3 §2.1 `checks/registry.ts`)

"Add a rule = one file plus one registry line" is the right open/closed shape, but parallel rule tickets all edit
`registry.ts`. Have the first A6 ticket write the registry with all 28 `CheckKind` files as stubs returning `[]`; later
tickets fill bodies only.

### C2 · Could — `TransitionService` does five moves with 13 collaborators (DO-4 §5)

Approve (frozen tests, `risk::security`) and the unfreezing moves will be separate tickets in one file. Split
`ApproveService` (approve only) from `TransitionService` (submit, withdraw, request changes, reopen). It also brings both
constructors under Metz's four-parameter smell, though that alone is not a reason.

### C3 · Could — `WriteGuard` re-encodes the editable states (DO-4 §7)

Its comment lists the editable states again ("in_review / changes_requested / reopened"). Ask the lesson machine instead
(`is_editable(state, role)` beside `decide_transition`) so a new state is one edit, not two.

### C4 · Could — dead references (DO-3 §5, DO-4 §4)

`pydantic-ai-agents` §3 / §7 are cited but that rule is not in this repo (and this build is TypeScript). Cite
`agent-architecture` instead. DO-3's header cites `.claude/rules/code-structure.md`, which exists only at the workspace root.

## What's good (keep these)

- **Every external system sits behind one adapter with a real second implementation** (stub model, stub judge, fake
  sheet fetcher, `FakeClock`). This is the house rule done exactly, and none of the ports are speculative.
- **The pure core is real.** Spend decisions, the after-checks router, the circuit breaker, both state machines, heartbeat
  merging and the frozen metrics row are pure functions with typed inputs. Changing the SP-3 quote threshold is one
  constant in `CheckPolicy`.
- **`CheckContextLoader` as the single place three callers build check context.** Without it, Submit, Approve and the
  issue list would disagree about what blocks.
- **One store transaction and one DDL owner.** HP-4's hardest rule lives in one module, and no area can write a migration.
- **The deferred list is honest.** No generic repository base, no event bus, no Hocuspocus wrapper, no CQRS. Each has a
  named trigger. That is "duplication is cheaper than the wrong abstraction" applied before any code exists.
- **Composition roots are the only places concretes are named**, and `MODEL_PROVIDER_MODE` is chosen in exactly those places.
- **DO-4 links the cards rather than restating them** (with the one CON-12 slip in B3), and every signature has a
  fully spelled-out result type a planner can copy.

## Verdict

**Verdict:** FAIL

Blocking items to fix before §7 cuts tickets:
1. **B1** — re-table §4 so shared repositories, the lesson machine and the prompt repo come in the wave before their first
   consumer, and regenerate the cross-area column from DO-4's constructors.
2. **B2** — give A0 every package manifest, tsconfig, lockfile and root lint config; replace "wired by the wave's merge"
   with per-area wiring files.
3. **B3** — carry SP-2 into DO-3/DO-4: delete the fallback, specify the per-update guard and frozen flag, add
   `refused_from`, add the editor's drop-and-tell module.

All three are edits to DO-3 §4/§2 and DO-4 §7/§12 (no new design questions). After those edits, a re-check needs only those sections.

## Re-review 2026-10-25

**Scope:** the sections named in the first review, as revised in `3f25be0` (DO-3/DO-4) and `e62fbb9` (CHG-1), checked by
grep and section reads rather than a full re-read; then a skim of DO-3 §4 and DO-4 §7/§12 for anything new. Same
reviewer, same rule (`code-design-solid-modularity`).

### Prior findings

| Finding | Status | Where it is now |
|---|---|---|
| **B1** wave order vs calls | **Resolved** | DO-3 §4 now says "strictly earlier" and keeps to it. New areas A12a lesson records, A9a queue and runs, A13a metrics records (wave 1); `PgPromptRepo` moved to A7 (wave 1); A11a lesson store, A6b check context, A7b paid calls, A11b collab client, A13b metrics writer (wave 2); every service, node, route area in wave 3. Every cross-area call I traced (A6b → A12a/A5/A4a, A9 → A7b/A9a/A11a/A12a, A11 → A11a/A6b, A12 → A11b/A13b) goes to an earlier wave. The cross-area column is generated from DO-4 constructors and the area map mirrors it. |
| **B2** unowned workspace files, composition roots | **Resolved** | DO-3 §1 *Who owns the workspace files* and the §4 A0 row: every `*/package.json`, `*/tsconfig.json`, the one root lockfile, ESLint and Vitest configs, subpath `exports`, no barrel. DO-4 §12 *Per-area wiring*: A0 writes every wiring stub and the roots in wave 0; each stub passes to its area; roots never change. |
| **B3** SP-2 result not carried | **Resolved** | DO-3 §2.5 (`frozen-docs.ts`, `permissions.ts` with `beforeHandleMessage`, `lock-and-snapshot.ts` freeze-first), §2.3 `refusals.ts` (A14), §5 option B as **don't**. DO-4 §1, §3.3, §7: `FrozenDocs`, `WriteGuard.on_update`, `AckBroadcaster.refused(…, refused_from)`, `apply_refusal`. No fallback text left in DO-3/DO-4; CHG-1 removed it from the cards. |
| S1 concrete `PgDatabase` | Resolved | DO-4 §2 `TxRunner` port, `FakeTxRunner`; `PgDatabase` remains only in repo constructors, health, migrations, seed and `*Deps`. |
| S2 store writes others' tables | Resolved | DO-4 §3.4 `PgLessonDocStore_ctor` takes `checks`, `states`, `audit`; DO-3 §2.2 row says "through their ports". |
| S3 one `LessonRepo` for six areas | Resolved | DO-4 §3.5 split into state / version / graph; `BoardReadRepo` in A13a. |
| S4 settings | Resolved | DO-4 §9 `ModelSettings` (web and worker only), `model_assist_id`, `outline_max_bytes` and the other web fields. |
| S5 one `ports.ts` | Resolved | `packages/core/src/ports/<port>.ts`, all by A1 in wave 0. |
| S6 money protocol ×5 | Resolved, better than asked | DO-4 §4 `PaidCaller`; the design went further and dropped the reserve/settle nodes (per-call reservation), so the lesson job uses the same protocol. Judge (cut #2) still uses the ledger by hand; acceptable while it is cut. |
| C1 check registry | Resolved | DO-3 §4 A6a note: first ticket stubs all 28 rule files. |
| C2 `TransitionService` | Resolved | `ApproveService` split out (DO-3 §2.3, §5). |
| C3 `WriteGuard` state list | Resolved | `is_editable` in the lesson machine; DO-4 §7 says the guard keeps no state list. |
| C4 dead references | Resolved | No `pydantic-ai-agents` citations; `code-structure.md` location stated in the DO-3 header. |

### New findings

**S7 · Should — wiring stub records name service types that do not exist in wave 0 (DO-4 §12 *Per-area wiring*).**
A0's stubs "return the record with the area's services unset", but each record (`SessionWiring`, `OutlineWiring`, …) is
typed by service classes that wave 3 creates. Written literally, A0's `container.ts` does not compile in wave 0, or the
records get typed `any` and route handlers lose their types. *Change it makes expensive:* the first A0 ticket, and every
wave-3 route that reads `services.<x>`. *Fix:* say in §12 that each record lives in its wiring file with optional fields
(`sessions?: SessionService`) imported **type-only** from the service path the area will create, and that A0 writes a
one-line placeholder service type per path; or that the stub record fields are `unknown` until the owning area narrows
them in its own file. One sentence either way; a planner should not have to invent it.

**C5 · Could — A14 integration tickets share wave 3 with the backends they join (DO-3 §4 A14 row).** The table says
calls go strictly to earlier waves, but A14's wave-3 integration tickets call CON routes built in wave 3. The ticket
readiness rule already handles this (integration tickets run once both sides merge), so state it in the row:
"integration tickets depend on the route's area ticket; effectively wave 3b."

**C6 · Could — stale open item (DO-4 §13 item 6a).** It still proposes removing the close-every-connection text from
CON-12/CON-18 as a future CHG; CHG-1 did that. Mark it closed with `CHG-1`.

### What's good in the revision

The re-table is mechanical and checkable rather than argued, which is what makes it trustworthy: a planner can verify any
row against a DO-4 constructor. The per-call `PaidCaller` is simpler than my S6 suggestion and removes a node pair; that
is the right direction. The SP-2 rule now has one owner per end of the channel (A11 server, A14 editor) and a named field
between them.

**Verdict (re-review):** PASS
