# Component contracts (DO-4) — Newsela Lesson Studio

**Owner of:** the **internal** signatures behind every boundary named in the [code design](code-design.md) (DO-3):
producers and consumers, port and service methods, field-level record and result types, constructors, error types and
the table each required record lands in. **Written:** 2026-10-25 by Claude (System track, §6). **Status:** ready —
Claude's recommendation adopted under Innocent's standing authorization (PD-32).
**Interface spec state:** all 24 cards `agreed` (System review [`2026-10-25-system-review.md`](../contracts/reviews/2026-10-25-system-review.md)); every link below points at an agreed card.
**External behaviour is never restated here.** Every promise a screen or a person relies on lives in its card in
[`docs/contracts/INTERFACE.md`](../contracts/INTERFACE.md) and in [`interface.openapi.yaml`](../contracts/interface.openapi.yaml);
this file links the card and adds only what the code needs (§1). If design work finds a card wrong, the fix is a `CHG-N`
in [`CHANGES.md`](../contracts/CHANGES.md), never a different promise here.

## How to read the signatures

**These are language-neutral stubs written in Python syntax** so the readiness checker
(`.claude/workflow/system-design-readiness/scripts/signature_check.py`) can parse them. The build implements them as
**TypeScript `interface`s (ports and services), Zod schemas (records and model output) and string-literal unions
(`Literal[...]` aliases), with the same names and the same field names** (snake_case on the wire and in rows; the TS code
may use camelCase locally but every Zod schema and SQL column keeps the names below).

| Stub form | TypeScript form |
|---|---|
| `class X(Protocol):` with `def m(self, a: T) -> R: ...` | `interface X { m(a: T): R }` |
| `async def m(...) -> R` | `m(...): Promise<R>` |
| `class Rec:` with `field: type` lines | `const Rec = z.object({...}); type Rec = z.infer<typeof Rec>` |
| `Name = Literal["a", "b"]` | `type Name = "a" \| "b"` (and `z.enum([...])`) |
| `class Impl(Port): ...  # implements Port` | `class Impl implements Port` |
| a return type that is an OpenAPI component (`Session`, `RunProgress`, …) | the Zod mirror in `packages/schema/src/api/` with that exact name |
| `Optional[X]` / `X \| None` | `X \| null` |
| `Sequence[X]` / `list[X]` | `readonly X[]` / `X[]` |

**JSON Schemas (register DO-4 row).** The model-facing and published schemas are emitted from Zod by
`npm run schemas:emit` (`packages/schema/scripts/emit-json-schemas.ts`) into `docs/contracts/schemas/`:
`outline.schema.json` (`NormalizedOutline`), `unit-plan.schema.json` (`UnitPlanDraft`), `lesson-draft.schema.json`
(`LessonDraft`) and `lesson.schema.json` (`StoredLesson`); the export schema (`ExportBundleFile`) goes to
`docs/contracts/lesson-export.schema.json`, the path CON-23 names. The files are build work (wave 0, area A2; the
export schema with the export ticket, A17); a contract test fails when a committed file differs from the emitted one.

---

## 1. External contracts → the internal code that serves them

Each row links the card; the card owns fields, states, permissions, errors, guarantees and timing.

| Card | Operation(s) (OpenAPI `operationId`) | Route file | Service method | Other internal producers |
|---|---|---|---|---|
| [CON-1](../contracts/INTERFACE.md#con-1) | `signIn`, `getSession`, `signOut` | `apps/web/app/api/session/route.ts` | `SessionService.sign_in` / `get_session` / `sign_out` | `with_route` (every route resolves the session) |
| [CON-2](../contracts/INTERFACE.md#con-2) | `listUnits`, `uploadOutline`, `importOutlineLink` | `app/api/units/route.ts`, `app/api/outline-versions/route.ts`, `app/api/outline-versions/import/route.ts` | `OutlineService.list_units` / `upload` / `import_link` | `parse_workbook`, `normalize_outline`, `compute_lesson_links`, `SheetFetcher` |
| [CON-3](../contracts/INTERFACE.md#con-3) | `getValidationReport` | `app/api/outline-versions/[outlineVersionId]/report/route.ts` | `OutlineService.report` | `build_validation_report` |
| [CON-4](../contracts/INTERFACE.md#con-4) | `recordIntakeChoice` | `app/api/outline-versions/[outlineVersionId]/choices/route.ts` | `OutlineService.record_choice` | `generate_gate` |
| [CON-5](../contracts/INTERFACE.md#con-5) | `startRun` | `app/api/runs/route.ts` | `RunService.start` | `JobQueue.create_run_jobs`, `SpendLedger.check_day_cap`, `run_cap_for`, `LessonStateRepo.ensure_lessons` |
| [CON-6](../contracts/INTERFACE.md#con-6) | `getRunProgress` | `app/api/runs/[runId]/progress/route.ts` | `RunService.progress` | `derive_run_state`, `tile_state`; rows written by `LessonJobRunner` |
| [CON-7](../contracts/INTERFACE.md#con-7) | `controlRun` | `app/api/runs/[runId]/actions/route.ts` | `RunService.control` | `decide_run_control`, `JobQueue.requeue_failed` / `cancel_run`; worker honours cancel at the next node |
| [CON-8](../contracts/INTERFACE.md#con-8) | `getUnitPlan` | `app/api/runs/[runId]/plan/route.ts` | `RunService.plan` | `UnitPlanJob` writes it |
| [CON-9](../contracts/INTERFACE.md#con-9) | `getUnitBoard` | `app/api/units/[unitId]/board/route.ts` | `BoardService.board` | `BoardReadRepo.board_rows`, `IssueRepo.counts_by_lesson` |
| [CON-10](../contracts/INTERFACE.md#con-10) | `getUnitMetrics` | `app/api/units/[unitId]/metrics/route.ts` | `BoardService.metrics` | `MetricsRepo.unit_metrics_rows` (aggregate only) |
| [CON-11](../contracts/INTERFACE.md#con-11) | `getLesson` | `app/api/lessons/[lessonId]/route.ts` | `LessonReadService.get_lesson` | `LessonDocStore.latest_derived`, `assert_known_nodes` |
| [CON-12](../contracts/INTERFACE.md#con-12) | socket `lesson:<lesson_id>` (`x-collaboration-channel`) | `apps/collab/src/main.ts` | `CollabAuthenticator`, `WriteGuard` (`can_write` at connect, `on_update` per message), `FrozenDocs`, `LessonPersistence`, `AckBroadcaster` | `LessonDocStore.store` (one transaction), `CheckQueue.enqueue` inside it |
| [CON-13](../contracts/INTERFACE.md#con-13) | `getLessonIssues` | `app/api/lessons/[lessonId]/issues/route.ts` | `IssueService.get_issues` | `CheckJobRunner` writes issues; `CheckQueue.pending_for` gives `pending` |
| [CON-14](../contracts/INTERFACE.md#con-14) | `recordResolution`, `clearSafetyFlag`, `decideStandard` | `app/api/lessons/[lessonId]/issues/[issueId]/resolution/route.ts`, `…/safety-flags/[flagId]/clear/route.ts`, `…/standards/decision/route.ts` | `IssueService.record_resolution` / `clear_safety_flag` / `decide_standard` | `CollabCommands.apply_edit` (`StandardEdit`) for front-matter changes |
| [CON-15](../contracts/INTERFACE.md#con-15) | `fillSlot` | `app/api/lessons/[lessonId]/slots/[slotId]/fill/route.ts` | `SlotService.fill` | `CollabCommands.apply_edit` (`SlotFillEdit`) |
| [CON-16](../contracts/INTERFACE.md#con-16) | `regenerateLesson`, `getCandidate`, `adoptCandidate` | `app/api/lessons/[lessonId]/candidates/**/route.ts` | `CandidateService.regenerate` / `get` / `adopt` | `JobQueue.create_candidate_job`, `LessonJobRunner`, `CollabCommands.apply_edit` (`AdoptEdit`) |
| [CON-17](../contracts/INTERFACE.md#con-17) | `listSuggestions`, `requestSuggestion`, `decideSuggestion` | `app/api/lessons/[lessonId]/suggestions/**/route.ts` | `SuggestionService.list_pending` / `request` / `decide` | `ModelCallRecorder.call`, `CollabCommands.apply_edit` (`SuggestionAcceptEdit`) |
| [CON-18](../contracts/INTERFACE.md#con-18) | `transitionLesson` | `app/api/lessons/[lessonId]/transitions/route.ts` | `TransitionService.transition` (Approve delegated to `ApproveService.approve`) | `transition_roles`, `decide_transition`, `merge_resolutions`, `approve_gate`, `run_checks` over `CHECK_RULES`, `CheckContextLoader`; Submit → `CollabCommands.lock_and_snapshot` (which runs `submit_gate` on the stored row); Withdraw, Request changes, Reopen → `CollabCommands.set_mode`; Approve → `MetricsWriter.write_first_approval`, no collaboration hop |
| [CON-19](../contracts/INTERFACE.md#con-19) | `getLessonHistory` | `app/api/lessons/[lessonId]/history/route.ts` | `LessonReadService.history` | `AuditLog.history` (view `audit_log_v`) |
| [CON-20](../contracts/INTERFACE.md#con-20) | `sendHeartbeat` | `app/api/lessons/[lessonId]/heartbeats/route.ts` | `HeartbeatService.record` | `merge_heartbeats` |
| [CON-21](../contracts/INTERFACE.md#con-21) | `getRunSummary` | `app/api/runs/[runId]/summary/route.ts` | `RunService.summary` | `ModelCallLog.totals_for_run`, `RunRepo.summary_rows` |
| [CON-22](../contracts/INTERFACE.md#con-22) | `getCoverageMatrix` | `app/api/units/[unitId]/coverage/route.ts` | `CoverageService.coverage` | `AlignmentRepo.coverage_rows` |
| [CON-23](../contracts/INTERFACE.md#con-23) | `listExports`, `createExport`, `downloadExport` | `app/api/units/[unitId]/exports/route.ts`, `app/api/exports/[exportId]/download/route.ts` | `ExportService.list` / `create` / `download` | `LessonVersionRepo.approved_snapshots` |
| [CON-24](../contracts/INTERFACE.md#con-24) | `listPromptVersions`, `saveGuidance` | `app/api/prompt-versions/route.ts` | `PromptService.list` / `save_guidance` | `PromptRepo` |

**How this design carries the System review's mechanisms** (the card states each promise; these are the code paths):
the `stored` acknowledgement is a Hocuspocus stateless message sent by `AckBroadcaster` after the store transaction
commits; the Submit freeze is `CollabCommands.lock_and_snapshot` (internal HTTP), which **SP-2 proved with option A**
(server-side read-only flip plus a per-update guard; option B, closing every connection, was rejected because refused
keystrokes came back on reconnect, 120 in 20 trials): it adds the lesson to `FrozenDocs` *before* it stores, so
`WriteGuard.on_update` (called from Hocuspocus `beforeHandleMessage`) refuses every later update with a `refused` message
carrying CON-12's `refused_from`; then it stores at once, checks the `client_state_vector` cover, re-runs the blocking
checks on the stored row and writes snapshot, state and transition in one transaction, then broadcasts `mode: read_only`;
on any refusal it removes the lesson from `FrozenDocs` again. In the browser, `apps/web/src/editor/refusals.ts` undoes the
local updates after `refused_from`, switches the editor to read-only and tells the typist which text was refused. The
card's close-every-connection fallback is not built (DO-3 §5). Approve stays inside the web app (`ApproveService`: lesson
row locked, pin compared, checks re-run on the snapshot, one transaction); `pending` on CON-13 comes from
`CheckQueue.pending_for`; checks run in the worker's check lane (DO-1 D-6); a regenerate is a one-lesson `run` of kind
`candidate` with its own cap, counted against the day cap, one in flight per lesson; **a suggestion accept is applied by
the collaboration server, never by the browser** (CON-17): `SuggestionService.decide` sends a `SuggestionAcceptEdit` to
`CollabCommandHandler.apply_edit`, which resolves the stored anchor against the live document, compares the text there
with the stored `selected_text` (`ANCHOR_CHANGED` on a mismatch; the client's `anchored_text_now` is never trusted) and
applies the replacement as one Yjs transaction tagged `ai-assist`, attributed to the acceptor, then stores; `startRun`
copies the intake choices (`choices_json`, `choices_hash`) and the lesson links into the run in its creating
transaction; `SERVICE_BUSY` comes from a pool wait past `PG_ACQUIRE_TIMEOUT_MS` and `INVALID_REQUEST` from a failed Zod
parse, both in `with_route`; **a refused call writes no audit row** (only an application-log line), per INTERFACE shared
guarantee 2 and the agreed cards (spec dry run G-15); every service writes inside one `TxRunner.with_tx` and rolls back
on refusal.

---

## 2. Shared types and identifiers

```python
from decimal import Decimal
from datetime import datetime

# Identifiers (validated string types in packages/schema/src/ids.ts; one regex each, never built inline)
UserId = str            # "usr_…"
UnitId = str            # "G6.U4"
LessonId = str          # "G6.U4.L4", "G6.U4.FLEX-1a"
OutlineVersionId = str  # "G6.U4.ov1"
RunId = str             # "run_…"
JobId = str             # "job_…"
ModelCallId = str       # "mc_…"
VersionId = str         # "lv_…"
StoreId = str           # "st_…"
IssueId = str           # "iss_…"
SuggestionId = str      # "sug_…"
ReservationId = str     # "sr_…"
AuditEventId = str      # "ae_…"
RequestId = str         # "req_…" or the client's X-Request-Id
Usd = Decimal           # money is Decimal end to end; numeric(12,6) in SQL
YDocBytes = bytes       # Y.encodeStateAsUpdate output
IdPrefix = Literal["usr", "run", "job", "mc", "lv", "st", "iss", "sug", "sr", "ae", "req", "ov", "exp", "ev", "pr", "ops"]

RoleName = Literal["author", "reviewer", "approver"]
LessonStateName = Literal["draft", "generation_failed", "in_review", "submitted", "changes_requested", "approved", "reopened", "exported"]
RunStateName = Literal["planning", "running", "complete", "partial", "capped", "paused", "cancelled"]
RunKind = Literal["run", "trial", "candidate"]
JobKind = Literal["unit_plan", "lesson", "candidate"]
JobStatus = Literal["queued", "running", "ready", "generation_failed", "cancelled"]
IssueLevelName = Literal["blocking", "confirmation", "advisory"]
CheckKind = Literal["quote_placeholder_open", "excerpt_slot_open", "cross_lesson_link", "standard_not_taught", "standard_not_checked", "code_not_allowed", "minutes_out_of_range", "section_missing", "schema_invalid", "quote_unmatched", "page_out_of_range", "proper_noun_unsourced", "quote_without_source", "quote_too_long", "rights_to_clear", "suggestion_pending", "safety_flag_open", "safety_note_without_tip", "safety_text_in_student_block", "disclosure_prompt", "standard_confirmation", "standard_add_suggestion", "eld_label_mismatch", "arc_repeat", "vocabulary_over_cap", "vocabulary_word_missing", "linked_text_changed", "judge_no"]
ModelAlias = Literal["GENERATION", "REPAIR", "ASSIST", "JUDGE"]
CallPurpose = Literal["unit_plan", "lesson_draft", "truncation_retry", "repair", "assist", "judge", "spike"]
BrakeName = Literal["repair_round", "rate_limit_retries", "truncation_retry", "job_wall_clock", "spend_run_cap", "spend_day_cap", "spend_project_cap", "circuit_breaker", "cancelled"]
CapName = Literal["run_cap", "day_cap", "project_cap"]   # one name everywhere: CON-6 capped_by, refusals, brakes (spec dry run G-4)
DayCapScope = Literal["user", "project"]                 # DAY_CAP_REACHED details.scope (CON-5): day_cap -> "user", project_cap -> "project"
FailureCheck = Literal["schema_invalid", "truncated", "rate_limited", "provider_error", "timeout", "compile_error", "check_failed", "cancelled", "capped"]   # = OpenAPI FailureReason.check
SheetKind = Literal["csv", "xlsx"]
DraftRating = Literal["usable_as_drafted", "usable_with_edits", "rewritten"]
CollabMode = Literal["editable", "read_only"]

class Actor:
    user_id: UserId | None      # None only for the system (worker seeding v1)
    name: str
    role: RoleName | None
    synthetic: bool

class RequestUser:
    user_id: UserId
    name: str
    email: str
    role: RoleName
    synthetic: bool
    request_id: RequestId

class TokenUsage:
    input_tokens: int
    output_tokens: int
    cache_read_tokens: int
    cache_write_tokens: int

class ModelPrice:
    model_id: str
    input_per_mtok: Usd                  # claude-sonnet-5-5: 2.00 (SP-1, checked 2026-10-25)
    output_per_mtok: Usd                 # 10.00 (thinking tokens bill as output)
    cache_read_per_mtok: Usd             # 0.20
    cache_write_per_mtok: Usd            # 2.50 (5-minute cache write; GP-33 sets cache_control)

class Tx(Protocol): ...  # an open transaction handle from TxRunner.with_tx; repos accept it to join one commit

class TxRunner(Protocol):  # packages/core/src/ports/tx.ts (S1): services and nodes depend on this, never on PgDatabase
    async def with_tx(self, fn: TxFunction, advisory_lock: str | None) -> TxResult: ...
    # PgDatabase implements it; FakeTxRunner (test helper) calls fn with a dummy Tx

class FakeTxRunner(TxRunner):  # implements TxRunner; packages/core/src/testing/fake-tx.ts (A1); test helper only, never wired in a composition root
    def __init__(self) -> None: ...
    async def with_tx(self, fn: TxFunction, advisory_lock: str | None) -> TxResult: ...
    # calls fn with a dummy Tx once and returns its result; records advisory_lock so a test can assert the lock name
```

Lesson-level OpenAPI shapes used below without redefinition: `Session`, `UnitList`, `OutlineVersion`,
`ValidationReport`, `IntakeChoiceRequest`, `IntakeChoiceResult`, `StartRunRequest`, `Run`, `RunProgress`,
`RunControlRequest`, `RunControlResult`, `UnitPlan`, `RunSummary`, `UnitBoard`, `UnitMetrics`, `CoverageMatrix`,
`ExportList`, `ExportCreated`, `LessonExportFile`, `Lesson`, `IssueList`, `ResolutionRequest`,
`SafetyFlagClearRequest`, `StandardDecisionRequest`, `ResolveResult`, `FillSlotRequest`, `FillSlotResult`,
`RegenerateRequest`, `Candidate`, `AdoptRequest`, `AdoptResult`, `SuggestionRequest`, `SuggestionDecisionRequest`,
`Suggestion`, `TransitionRequest`, `TransitionResult`, `LessonHistory`, `Heartbeat`, `PromptVersions`,
`SaveGuidanceRequest`, `GuidanceVersion`, `SignInRequest`, `ImportLinkRequest`, `Sha256`, `StateVector`, `Timestamp`,
`TileState`, `LessonState`, `ProseMirrorDoc`, `Section`, `Anchor`, `SourceRef`, `RightsStatus`, `FailureReason`,
`LessonLink`, `IssueCounts`, `SnapshotRef`, `VersionRef`, `Standard`, `AlignmentEntry`.

## 3. Ports (`packages/core/src/ports/<port>.ts`)

One port and the records it owns per file (`ports/model-client.ts`, `ports/lesson-docs.ts`, `ports/spend.ts`, …;
Metz S5). A1 writes every file in wave 0 straight from this section; after wave 0 each file belongs to the area that
implements the port (DO-3 §4), and a change to it is a `CHG` through that owner. `packages/core` exports them by subpath
(`@ls/core/ports/spend`); there is no barrel file that every area appends to.

### 3.1 Model providers

```python
class StructuredCallRequest:
    alias: ModelAlias
    system_blocks: list[PromptBlock]     # stable prefix first; cache_control on the last stable block (GP-33)
    user_blocks: list[PromptBlock]       # outline data only inside labelled delimiters (R-6)
    output_schema_name: str              # e.g. "LessonDraft"; the JSON Schema comes from packages/schema
    output_json_schema: JsonValue
    output_mode: Literal["schema_enforced", "prompt_embedded"]
    # SP-1: the API's schema-enforced output rejected LessonDraft ("compiled grammar is too large"), so lesson draft and
    # repair calls are "prompt_embedded" (the JSON Schema is a "schema" system block; Zod validates in code; one repair);
    # UnitPlanDraft, assist and judge stay "schema_enforced" (their schemas compile)
    max_output_tokens: int               # DRAFT_OUTPUT_TOKEN_CAP 32000; truncation retry 48000 (SP-1)
    timeout_ms: int                      # MODEL_CALL_TIMEOUT_MS 240000 (SP-1)
    effort: Literal["low", "medium", "high"] | None   # MODEL_EFFORT "low" (SP-1); None = provider default
    temperature: float | None            # None = provider default, as SP-1 measured; no setting overrides it (G-28)

class PromptBlock:  # owner: packages/core/src/ports/model-client.ts (NL-12); packages/prompts and packages/llm import it (§13 R-19)
    text: str
    cacheable: bool
    label: Literal["locked", "guidance", "schema", "examples", "context", "data", "instruction"]

class ModelResponse:
    raw_text: str                        # saved verbatim before any parsing
    stop_reason: Literal["end_turn", "max_tokens", "stop_sequence", "refusal", "tool_use"]
    usage: TokenUsage
    requested_model: str
    served_model: str                    # from the response body, never from the request (DO-6)
    provider_request_id: str | None
    latency_ms: int

class ModelClient(Protocol):
    async def complete(self, req: StructuredCallRequest) -> ModelResponse: ...
    # raises ProviderError (kinds in §10); never retries itself: ModelCallRecorder owns retries

class AnthropicMessagesAdapter(ModelClient): ...  # implements ModelClient; packages/llm/src/anthropic.ts; the only Anthropic SDK import
class StubModelClient(ModelClient): ...  # implements ModelClient; packages/llm/src/stub.ts; scripted responses, 429s, truncation and delays for tests, faults and load

class JudgeRequest:
    lesson_id: LessonId
    content_hash: Sha256
    address: str
    code: str
    standard_text: str
    activity_text: str
    question: Literal["teaches_standard", "eld_keeps_task"]
    rubric_version: str

class JudgeVerdictResult:
    verdict: Literal["yes", "no"]
    rationale: str
    served_model: str
    usage: TokenUsage
    raw_text: str
    provider_request_id: str | None

class JudgeClient(Protocol):
    async def verdict(self, req: JudgeRequest) -> JudgeVerdictResult: ...

class OpenRouterJudgeAdapter(JudgeClient): ...  # implements JudgeClient; packages/llm/src/openrouter-judge.ts (cut #2)
class StubJudgeClient(JudgeClient): ...  # implements JudgeClient; packages/llm/src/stub.ts (cut #2)
```

### 3.2 External inputs

```python
class FetchedSheet:
    url: str
    kind: SheetKind
    data: bytes
    sha256: Sha256
    fetched_at: datetime

class SheetFetcher(Protocol):
    async def fetch_export(self, sheet_url: str) -> FetchedSheet: ...
    # raises DomainRefusal(SHEET_NOT_PUBLIC) on a sign-in redirect or 401/403; one GET, no retry

class GoogleSheetsExportFetcher(SheetFetcher): ...  # implements SheetFetcher; apps/web/src/server/adapters/google-sheets.ts
```

### 3.3 The collaboration process (`CollabCommands`)

Producer: `apps/collab/src/commands/*` (`CollabCommandHandler`). Consumers: `IssueService`, `SlotService`,
`CandidateService`, `TransitionService`, `SuggestionService` through `HttpCollabCommandClient`. Transport: `POST
{COLLAB_INTERNAL_URL}/lessons/{lesson_id}/{command}` with `Authorization: Bearer {COLLAB_INTERNAL_TOKEN}` and
`X-Request-Id`; JSON bodies are the records below; refusals come back as the `Error` envelope with an `ApiErrorCode`.
Timeout 5 s; no automatic retry (commands are not idempotent unless stated).

```python
class SubmitCommand:
    lesson_id: LessonId
    actor: Actor
    client_state_vector: StateVector     # NOT_STORED unless the stored state vector covers it
    request_id: RequestId

class SnapshotResult:
    lesson_id: LessonId
    version_id: VersionId
    version_number: int
    content_hash: Sha256
    state_vector: StateVector
    review_event_id: str
    from_state: LessonStateName
    to_state: LessonStateName            # "submitted"

class StandardEdit:
    kind: Literal["standard"]
    code: str
    decision: Literal["confirm", "remove", "add", "undo"]
    restore: Standard | None             # undo only (§13 R-4): the front-matter entry exactly as it stood before the undone
                                         # decision (StandardDecisionRow.before_entry); None on undo of an "add" = delete it

class SlotFillEdit:
    kind: Literal["slot_fill"]
    slot_id: str
    text: str
    source_ref: SourceRef
    rights_status: RightsStatus

class AdoptEdit:
    kind: Literal["adopt"]
    candidate_version_id: VersionId
    scope: Literal["whole", "section"]
    section_address: str | None

class SuggestionAcceptEdit:
    kind: Literal["suggestion_accept"]
    suggestion_id: SuggestionId
    anchor: Anchor
    expected_text: str                   # applied only if the live text under the anchor equals this (ANCHOR_CHANGED)
    replacement_text: str

LessonEdit = StandardEdit | SlotFillEdit | AdoptEdit | SuggestionAcceptEdit

class EditCommand:
    lesson_id: LessonId
    actor: Actor
    edit: LessonEdit
    tag: Literal["standard-decision", "slot-fill", "candidate-adopt", "ai-assist"]
    request_id: RequestId

class StoreAck:
    lesson_id: LessonId
    store_id: StoreId
    seq: int
    content_hash: Sha256
    state_vector: StateVector
    stored_at: datetime
    stored_by: UserId | None
    check_job_enqueued: bool

class ModeCommand:
    lesson_id: LessonId
    mode: CollabMode
    state: LessonStateName
    request_id: RequestId

class ModeResult:
    lesson_id: LessonId
    mode: CollabMode
    connections_notified: int

class CollabCommands(Protocol):
    async def lock_and_snapshot(self, cmd: SubmitCommand) -> SnapshotResult: ...
    # SP-2 option A: FrozenDocs.freeze(lesson_id) FIRST (from here WriteGuard.on_update refuses every update, with
    # refused_from) → store at once → covers(stored, client) else unfreeze + NOT_STORED → CheckContextLoader.load +
    # run_checks(CHECK_RULES) on the stored row → merge_resolutions(findings, IssueRepo.resolutions_for) → submit_gate
    # (SUGGESTION_PENDING, BLOCKED, CONFIRMATION_OPEN in CON-18's order) else unfreeze → one tx: lesson row locked,
    # decide_transition re-checked, lesson_version(kind submit), lesson.state = submitted, review_event → commit →
    # AckBroadcaster.mode(read_only). Nothing else; there is no close-every-connection path (SP-2 rejected option B).
    # Refusals: LESSON_LOCKED, NOT_STORED, BLOCKED, CONFIRMATION_OPEN, SUGGESTION_PENDING, INVALID_TRANSITION.
    async def apply_edit(self, cmd: EditCommand) -> StoreAck: ...
    # one Yjs transaction with origin {actor, tag} through a server-side direct connection (openDirectConnection), then an
    # immediate store (no debounce). LESSON_LOCKED if FrozenDocs.is_frozen or the state is not editable (is_editable).
    # SuggestionAcceptEdit (CON-17): the server resolves `anchor` against the LIVE document, compares the text there with
    # expected_text (the stored suggestion's selected_text, never the browser's anchored_text_now) and on a match replaces
    # it with replacement_text in the same tagged transaction attributed to the acceptor; else ANCHOR_CHANGED, nothing
    # applied. Refusals: LESSON_LOCKED, ANCHOR_CHANGED, NOT_FOUND.
    async def set_mode(self, cmd: ModeCommand) -> ModeResult: ...
    # idempotent; called after the web app commits Withdraw, Request changes or Reopen (unfreeze). Approve needs no call.
# Any transport failure or timeout surfaces as CollabUnavailable → COLLAB_UNAVAILABLE; nothing was changed (A-1).

class HttpCollabCommandClient(CollabCommands): ...  # implements CollabCommands; apps/web/src/server/adapters/collab-commands.ts
class CollabCommandHandler(CollabCommands): ...  # implements CollabCommands; apps/collab/src/commands/routes.ts (server side)

# collab_refusal_from (apps/web/src/server/adapters/collab-commands.ts)
def collab_refusal_from(status: int, body: JsonValue, command: str, lesson_id: LessonId, request_id: RequestId) -> DomainRefusal | CollabUnavailable: ...
# How HttpCollabCommandClient maps a collab answer (spec dry run G-16): 2xx → the command's result record. A non-2xx whose
# body parses as the OpenAPI Error envelope → DomainRefusal with the SAME code, message and details (so NOT_STORED,
# BLOCKED with details.issues, LESSON_LOCKED with details.state, ANCHOR_CHANGED reach the browser unchanged; with_route
# re-derives the HTTP status from the code); details.request_id is replaced by the web request's id and the collab
# request id is logged as collab_request_id. Timeout (5 s), connection failure, a body that is not an envelope, or 401
# from the command route (a token mismatch: a deploy fault, logged as InvariantViolation) → CollabUnavailable →
# COLLAB_UNAVAILABLE. The client never retries.

class HocuspocusServerRef(Protocol): ...  # marker: the @hocuspocus/server Server instance (openDirectConnection, documents)

class CollabCommandHandler_ctor:  # apps/collab/src/commands/routes.ts; built by apps/collab/src/wiring/commands.ts
    store: LessonDocStore
    reader: LessonDocReader
    states: LessonStateRepo
    versions: LessonVersionRepo
    issues: IssueRepo                    # resolutions for merge_resolutions (G-14)
    audit: AuditLog
    loader: CheckContextLoader
    rules: Sequence[CheckRule]           # CHECK_RULES
    policy: CheckPolicy
    frozen: FrozenDocs
    acks: AckBroadcaster
    hocuspocus: HocuspocusServerRef
    tx: TxRunner
    clock: Clock
    token: SecretStr                     # COLLAB_INTERNAL_TOKEN; constant-time compare
```

### 3.4 Storage ports (implemented in `packages/db/src/repos/`)

```python
class StoreRequest:
    lesson_id: LessonId
    ydoc_bytes: YDocBytes
    derived: StoredLesson
    content_hash: Sha256
    state_vector: StateVector
    stored_by: UserId | None
    request_id: RequestId | None         # set for HTTP-started edits (DO-6 correlation)
    tag: str | None

class StoredDoc:
    lesson_id: LessonId
    seq: int
    store_id: StoreId
    ydoc_bytes: YDocBytes
    content_hash: Sha256
    state_vector: StateVector
    schema_version: int
    stored_at: datetime

class DerivedRow:
    lesson_id: LessonId
    seq: int
    store_id: StoreId
    lesson: StoredLesson
    content_hash: Sha256
    state_vector: StateVector
    schema_version: int
    stored_at: datetime
    stored_by: UserId | None

class SeedResult:
    lesson_id: LessonId
    seeded: bool                         # False when a doc already existed (idempotent re-store)
    store_id: StoreId | None
    content_hash: Sha256

class LessonDocReader(Protocol):  # ports/lesson-docs.ts; readers never see the write methods (I in SOLID)
    async def latest(self, lesson_id: LessonId) -> StoredDoc | None: ...
    async def latest_derived(self, lesson_id: LessonId) -> DerivedRow | None: ...

class LessonDocStore(Protocol):  # ports/lesson-docs.ts; the only writer of lesson_doc
    async def store(self, req: StoreRequest) -> StoreAck: ...
    # ONE transaction (HP-4): INSERT lesson_doc (seq+1) → CheckQueue.enqueue(lesson_id, content_hash, store_id, tx) (the
    # one coalescing rule lives in PgCheckQueue) → LessonStateRepo.record_last_editor(lesson_id, stored_by, tx) when
    # stored_by is set → AuditLog.append(action "lesson.store", store_id, tx). It calls those ports; it never writes their
    # tables in its own SQL (Metz S2).
    async def seed_initial(self, lesson_id: LessonId, lesson: StoredLesson, actor: Actor, tx: Tx) -> SeedResult: ...
    # joins the caller's transaction (StoreNode, G-25): lesson_to_ydoc → INSERT lesson_doc seq 1 ON CONFLICT
    # (lesson_id, seq) DO NOTHING (seeded = False on the conflict path) → CheckQueue.enqueue in the same tx

class PgLessonDocReader(LessonDocReader): ...  # implements LessonDocReader; packages/db/src/repos/lesson-doc-reads.ts
class PgLessonDocStore(LessonDocStore): ...  # implements LessonDocStore; packages/db/src/repos/lesson-docs.ts

class PgLessonDocStore_ctor:  # packages/db/src/repos/lesson-docs.ts
    db: PgDatabase
    ids: IdGenerator
    clock: Clock
    checks: CheckQueue
    states: LessonStateRepo
    audit: AuditLog

class NewJob:
    run_id: RunId
    kind: JobKind
    lesson_id: LessonId | None
    idempotency_key: str                 # sha256(run_id, lesson_id, prompt_version_id, schema_version)
    priority: int
    reviewer_note: str | None            # kind "candidate" only: the CON-16 regenerate note (lesson_job.reviewer_note); None for
                                         # unit_plan and lesson jobs; reaches DraftPromptInput.reviewer_note, never a log line (§13 R-15)

class ClaimedJob:
    job_id: JobId
    run_id: RunId
    unit_id: UnitId                      # from the run row (G-23): CompileContext.unit_id, NewGeneratedVersion.unit_id
    kind: JobKind
    lesson_id: LessonId | None
    attempt: int                         # claim count: claim() sets attempt + 1, requeue_expired keeps it; for logs and
                                         # lease ownership only, never the checkpoint key (G-19)
    lease_until: datetime
    prompt_version_id: str
    schema_version: int
    outline_version_id: OutlineVersionId
    started_by: UserId
    idempotency_key: str
    reviewer_note: str | None            # copied from NewJob (§13 R-15)

class JobOutcome:
    job_id: JobId
    status: JobStatus
    tile_state: TileState
    failure_reasons: list[FailureReason]
    brakes_fired: list[BrakeName]
    repairs: int
    truncation_retries: int
    retries: int
    calls_lost: int
    cost_usd: Usd
    version_id: VersionId | None

class JobRow:
    job_id: JobId
    run_id: RunId
    kind: JobKind
    lesson_id: LessonId | None
    status: JobStatus
    tile_state: TileState
    attempt: int
    queued_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    failure_reasons: list[FailureReason]
    brakes_fired: list[BrakeName]
    repairs: int
    truncation_retries: int
    retries: int
    calls_lost: int
    cost_usd: Usd

class RequeueReport:
    requeued: int
    job_ids: list[JobId]                 # ClaimLoop.start then calls ModelCallLog.mark_lost and SpendLedger.release_for_jobs

class JobQueue(Protocol):
    async def create_run_jobs(self, jobs: Sequence[NewJob], tx: Tx) -> int: ...
    async def create_candidate_job(self, job: NewJob, tx: Tx) -> JobRow: ...
    async def claim(self, worker_id: str, max_active_runs: int, lease_ms: int) -> ClaimedJob | None: ...
    # fair share: the active run (≤ max_active_runs) with the fewest running jobs, FIFO inside it, FOR UPDATE SKIP LOCKED;
    # lesson jobs are claimable only after run.plan_stored_at is set (R-8)
    async def renew_lease(self, job_id: JobId, lease_ms: int) -> bool: ...
    async def set_tile_state(self, job_id: JobId, tile_state: TileState) -> None: ...
    async def finish(self, outcome: JobOutcome) -> None: ...
    async def requeue_expired(self, now: datetime) -> RequeueReport: ...
    # running jobs whose lease_until < now → queued; touches only lesson_job (model_call and spend_reservation are their
    # owners' to change: ClaimLoop.start does it, G-9)
    async def requeue_failed(self, run_id: RunId, tx: Tx) -> int: ...
    async def cancel_run(self, run_id: RunId, reason: Literal["cancelled", "capped"], tx: Tx) -> int: ...
    # queued jobs of the run → status cancelled, tile failed, failure_reasons [{check: reason}] (CON-6: capped and
    # cancelled tiles of jobs that never started have no lesson row); running jobs stop at their next node
    async def jobs_for_run(self, run_id: RunId) -> list[JobRow]: ...
    async def is_cancelled(self, job_id: JobId) -> bool: ...

class PgJobQueue(JobQueue): ...  # implements JobQueue; packages/db/src/repos/job-queue.ts

class ClaimedCheck:
    lesson_id: LessonId
    content_hash: Sha256
    store_id: StoreId
    lease_until: datetime

class PendingCheckState:
    lesson_id: LessonId
    pending: bool
    newest_queued_hash: Sha256 | None
    latest_stored_hash: Sha256 | None
    latest_stored_at: datetime | None

class CheckQueue(Protocol):
    async def enqueue(self, lesson_id: LessonId, content_hash: Sha256, store_id: StoreId, tx: Tx) -> None: ...
    # coalesced: one queued row per lesson (partial unique index); a newer hash replaces the queued one; NOTIFY check_job
    async def claim(self, lease_ms: int) -> ClaimedCheck | None: ...
    async def finish(self, check: ClaimedCheck) -> None: ...
    async def pending_for(self, lesson_id: LessonId) -> PendingCheckState: ...

class PgCheckQueue(CheckQueue): ...  # implements CheckQueue; packages/db/src/repos/check-queue.ts

class ReservationRequest:
    run_id: RunId | None                 # None for AI assist (no run); then only day and project caps apply
    job_id: JobId | None                 # set for worker calls, so release_for_jobs finds a killed job's open row (G-9)
    user_id: UserId                      # the run's started_by for worker calls; the requester for assist
    purpose: CallPurpose
    amount_usd: Usd                      # max_call_cost(...) for this one call (each call reserves its own worst case)

class SpendSnapshot:
    run_cap_usd: Usd | None
    run_settled_usd: Usd
    run_reserved_usd: Usd
    user_day_cap_usd: Usd                # user_day_cap_for(RUN_CAP_DEFAULT_USD, USER_DAY_CAP_MULTIPLIER) = 26.00 (G-2)
    user_day_settled_usd: Usd            # this user's rows whose day = today (UTC calendar day, CON-5)
    user_day_reserved_usd: Usd
    project_ceiling_usd: Usd             # BUILD_SPEND_CEILING_USD = 75 (PD-29): CON-5's "project ceiling", scope "project"
    project_settled_usd: Usd             # all time: settled_usd of every spend_reservation row + cost_usd of model_call rows
                                         # with reservation_id null (imported spike calls, WF-32) (G-5)
    project_reserved_usd: Usd            # reserved_usd of rows still status "reserved"

class ReservationDecision:
    allowed: bool
    reservation_id: ReservationId | None
    refused_by: CapName | None           # the FIRST failing cap in the order run_cap → day_cap → project_cap (G-6)
    scope: DayCapScope | None            # day_cap → "user", project_cap → "project"; None when allowed or run_cap (G-3)
    remaining_usd: Usd | None            # headroom left on the refusing cap: DAY_CAP_REACHED details.remaining_usd
    snapshot: SpendSnapshot

SpendReservationStatus = Literal["reserved", "settled", "released"]
# moves: reserved → settled | released; released → settled (a lost call that completed after release_for_jobs: real
# spend is always recorded); settled is terminal (G-8)

class SpendReservationRow:
    reservation_id: ReservationId
    run_id: RunId | None
    job_id: JobId | None
    user_id: UserId
    purpose: CallPurpose
    model_call_id: ModelCallId | None
    reserved_usd: Usd
    settled_usd: Usd
    overshoot_usd: Usd
    status: SpendReservationStatus
    day: str                             # UTC calendar date "YYYY-MM-DD", set from Clock at reserve
    created_at: datetime
    closed_at: datetime | None

class SettledReservation:
    reservation_id: ReservationId
    status: SpendReservationStatus
    reserved_usd: Usd
    settled_usd: Usd
    released_usd: Usd                    # max(0, reserved - settled)
    overshoot_usd: Usd                   # max(0, settled - reserved)

class RunSpend:
    run_id: RunId
    cap_usd: Usd
    settled_usd: Usd
    reserved_usd: Usd

class SpendLedger(Protocol):
    async def reserve(self, req: ReservationRequest) -> ReservationDecision: ...
    # one tx under pg_advisory_xact_lock('spend'): read the three sums → decide_reservation (pure) → INSERT
    # spend_reservation (status reserved). A refusal writes nothing (shared guarantee 2).
    async def settle(self, reservation_id: ReservationId, actual_usd: Usd, model_call_id: ModelCallId) -> SettledReservation: ...
    # → settled with settled_usd = actual_usd. actual > reserved (the input estimate ran low) is recorded, never refused:
    # overshoot_usd = actual - reserved and a warn line spend.overshoot (G-7); DO-5 S6 counts overshoot rows as cap overshoot.
    # Idempotent: repeating it with the same model_call_id returns the stored result.
    async def release(self, reservation_id: ReservationId) -> SettledReservation: ...
    # reserved → released (settled 0); on a settled or released row it is a no-op returning the stored result, so
    # PaidCaller can always release in `finally`
    async def release_for_jobs(self, job_ids: Sequence[JobId]) -> int: ...
    # releases every "reserved" row of these jobs; ClaimLoop.start calls it after requeue_expired (G-9)
    async def run_totals(self, run_id: RunId) -> RunSpend: ...
    async def check_day_cap(self, user_id: UserId, amount_usd: Usd) -> ReservationDecision: ...
    # dry run, writes nothing: day_cap then project_cap (no run cap); RunService.start and CandidateService.regenerate
    # turn a refusal into DAY_CAP_REACHED with details.scope and details.remaining_usd

class PgSpendLedger(SpendLedger): ...  # implements SpendLedger; packages/db/src/repos/spend.ts

class PgSpendLedger_ctor:  # packages/db/src/repos/spend.ts (G-1)
    db: PgDatabase
    ids: IdGenerator
    clock: Clock
    settings: SpendSettings              # project ceiling, day-cap multiplier, default run cap

class ModelCallStart:
    run_id: RunId | None
    lesson_id: LessonId | None
    job_id: JobId | None
    attempt: int                         # the call's ordinal for (job_id, purpose), starting at 1; NOT ClaimedJob.attempt.
                                         # job_id survives a requeue, so the checkpoint lookup hits after a kill (G-19)
    purpose: CallPurpose
    alias: ModelAlias
    requested_model: str
    rendered_prompt: str                 # the full rendered context (rule verification §21)
    request_id: RequestId | None
    experiment_id: str | None
    reservation_id: ReservationId | None

class ModelCallCompletion:
    raw_output: str
    stop_reason: str
    usage: TokenUsage
    cost_usd: Usd
    served_model: str
    provider_request_id: str | None
    latency_ms: int

class ProviderErrorRecord:
    kind: ProviderErrorKind
    http_status: int | None
    message: str                         # no key, no prompt text
    retry_after_s: float | None

class RecordedCall:
    model_call_id: ModelCallId
    purpose: CallPurpose
    attempt: int
    raw_output: str
    stop_reason: str
    usage: TokenUsage
    cost_usd: Usd
    served_model: str
    retries: int

class RunCallTotals:
    run_id: RunId
    calls: int
    completed: int
    failed: int
    lost: int
    retries: int
    truncation_retries: int
    repairs: int
    cost_usd: Usd
    input_tokens: int
    output_tokens: int

class ModelCallLog(Protocol):
    async def insert_sent(self, start: ModelCallStart) -> ModelCallId: ...
    async def complete(self, model_call_id: ModelCallId, done: ModelCallCompletion) -> None: ...
    async def fail(self, model_call_id: ModelCallId, error: ProviderErrorRecord) -> None: ...
    async def mark_lost(self, job_id: JobId) -> int: ...
    async def completed_for(self, job_id: JobId, purpose: CallPurpose, attempt: int) -> RecordedCall | None: ...
    # attempt = the call ordinal above; a "completed" row with raw_output is returned, never re-sent
    async def totals_for_run(self, run_id: RunId) -> RunCallTotals: ...

class PgModelCallLog(ModelCallLog): ...  # implements ModelCallLog; packages/db/src/repos/model-calls.ts
```

### 3.5 Repositories

```python
class AppUserRow:
    user_id: UserId
    email: str
    name: str
    role: RoleName
    synthetic: bool

class AppUserCredentials:
    user: AppUserRow
    password_hash: str                   # scrypt; never leaves SessionService

class AppSessionRow:
    token_hash: Sha256
    user_id: UserId
    created_at: datetime
    expires_at: datetime

class SessionContext:
    user: AppUserRow
    session: AppSessionRow

class SessionRepo(Protocol):
    async def find_user_by_email(self, email: str) -> AppUserCredentials | None: ...
    async def create_session(self, user_id: UserId, token_hash: Sha256, expires_at: datetime, tx: Tx) -> AppSessionRow: ...
    async def resolve(self, token_hash: Sha256, now: datetime) -> SessionContext | None: ...
    async def revoke(self, token_hash: Sha256, now: datetime) -> None: ...

class PgSessionRepo(SessionRepo): ...  # implements SessionRepo; packages/db/src/repos/sessions.ts

class UnitRow:
    unit_id: UnitId
    grade: int
    title: str
    latest_outline_version_id: OutlineVersionId | None

class NewOutlineVersion:
    unit_id: UnitId
    sha256: Sha256
    source_kind: Literal["upload_csv", "upload_xlsx", "sheet_link"]
    source_name: str
    uploaded_by: UserId

class OutlineVersionRow:
    outline_version_id: OutlineVersionId
    unit_id: UnitId
    number: int
    sha256: Sha256
    same_as_version: int | None
    source_kind: str
    uploaded_by: UserId
    created_at: datetime
    confirmed_at: datetime | None

class OutlineRowRecord:
    outline_version_id: OutlineVersionId
    row: NormalizedRow
    row_hash: Sha256

class IntakeChoiceRow:
    outline_version_id: OutlineVersionId
    finding_id: str
    choice: str
    status: Literal["default", "confirmed"]
    confirmed_by: UserId | None
    at: datetime

class LessonLinkRecord:
    link_id: str
    from_lesson_id: LessonId
    from_address: str
    to_lesson_id: LessonId
    to_slot_id: str
    kind: Literal["homework_text", "excerpt_slot", "page_continuation"]
    label: str

class RowContext:
    outline_version_id: OutlineVersionId
    row: NormalizedRow
    row_hash: Sha256
    arc_header: str | None
    neighbours: list[NormalizedRow]
    unit_rules: list[UnitRuleRecord]
    links: list[LessonLinkRecord]
    choices: list[IntakeChoiceRow]

class GateInputs:
    outline: NormalizedOutline
    choices: list[IntakeChoiceRow]

class OutlineRepo(Protocol):
    async def list_units(self) -> list[UnitRow]: ...
    async def insert_version(self, v: NewOutlineVersion, outline: NormalizedOutline, links: Sequence[LessonLinkRecord], tx: Tx) -> OutlineVersionRow: ...
    async def version(self, outline_version_id: OutlineVersionId) -> OutlineVersionRow | None: ...
    async def rows(self, outline_version_id: OutlineVersionId) -> list[OutlineRowRecord]: ...
    async def choices(self, outline_version_id: OutlineVersionId) -> list[IntakeChoiceRow]: ...
    async def upsert_choice(self, choice: IntakeChoiceRow, tx: Tx) -> IntakeChoiceRow: ...
    async def mark_confirmed(self, outline_version_id: OutlineVersionId, at: datetime, tx: Tx) -> None: ...
    async def generate_gate_inputs(self, outline_version_id: OutlineVersionId) -> GateInputs: ...
    async def row_context(self, outline_version_id: OutlineVersionId, lesson_id: LessonId, choices: Sequence[IntakeChoiceRow] | None) -> RowContext: ...
    # choices given → they are applied (DraftNode passes RunRepo.pinned_choices: the run's copied set, UXQ-9, G-24);
    # None → the outline version's stored choices (CheckContextLoader, outside a run)
    async def links(self, outline_version_id: OutlineVersionId) -> list[LessonLinkRecord]: ...

class PgOutlineRepo(OutlineRepo): ...  # implements OutlineRepo; packages/db/src/repos/outlines.ts

class StandardRow:
    code: str
    set: Literal["CA_CCSS_ELA_6", "CA_ELD_6", "MSLS_6"]
    text: str
    parent_code: str | None
    is_leaf: bool
    eld_strand: str | None

class StandardRepo(Protocol):
    async def index(self) -> StandardsIndex: ...
    async def texts(self, codes: Sequence[str]) -> list[StandardRow]: ...

class PgStandardRepo(StandardRepo): ...  # implements StandardRepo; packages/db/src/repos/outlines.ts

class NewRun:
    unit_id: UnitId
    outline_version_id: OutlineVersionId
    kind: RunKind
    prompt_version_id: str
    cap_usd: Usd
    scope_rows: list[int] | None
    started_by: UserId
    parent_run_id: RunId | None          # candidate runs reuse the parent's stored plan (R-8 as amended)
    eval_run_id: str | None
    choices: list[IntakeChoiceRow]       # copied at start (UXQ-9)
    choices_hash: Sha256
    lesson_links: list[LessonLinkRecord] # copied into the run's unit_plan row in the same transaction (CON-8)
    idempotency_key: str | None          # Idempotency-Key header (CON-5)

class RunRow:
    run_id: RunId
    unit_id: UnitId
    outline_version_id: OutlineVersionId
    kind: RunKind
    state: RunStateName
    prompt_version_id: str
    cap_usd: Usd
    started_by: UserId
    parent_run_id: RunId | None
    plan_stored_at: datetime | None
    paused_check: str | None
    capped_by: CapName | None
    choices_hash: Sha256
    created_at: datetime
    finished_at: datetime | None

class UnitPlanRow:
    run_id: RunId
    state: Literal["planning", "stored", "failed"]
    plan: UnitPlanDraft | None
    lesson_links: list[LessonLinkRecord]
    model_call_id: ModelCallId | None
    stored_at: datetime | None

class RunSummaryRows:
    run: RunRow
    jobs: list[JobRow]
    calls: RunCallTotals
    placeholders_left: int
    report_path: str | None

class RunRepo(Protocol):
    async def insert_run(self, run: NewRun, tx: Tx) -> RunRow: ...
    async def get(self, run_id: RunId) -> RunRow | None: ...
    async def find_by_idempotency_key(self, user_id: UserId, key: str, within_hours: int) -> RunRow | None: ...
    async def lock_for_update(self, run_id: RunId, tx: Tx) -> RunRow: ...   # CON-7 row lock
    async def set_state(self, run_id: RunId, state: RunStateName, paused_check: str | None, tx: Tx) -> RunRow: ...
    async def mark_capped(self, run_id: RunId, capped_by: CapName, tx: Tx) -> RunRow: ...   # state capped + capped_by (G-10)
    async def pinned_choices(self, run_id: RunId) -> list[IntakeChoiceRow]: ...   # run.choices_json, copied at start (G-24)
    async def mark_plan_failed(self, run_id: RunId, tx: Tx) -> RunRow: ...  # run → paused, paused_check = unit_plan (CON-5)
    async def store_unit_plan(self, run_id: RunId, plan: UnitPlanDraft, model_call_id: ModelCallId) -> UnitPlanRow: ...
    async def unit_plan(self, run_id: RunId) -> UnitPlanRow | None: ...
    async def summary_rows(self, run_id: RunId) -> RunSummaryRows: ...
    async def active_runs(self) -> list[RunRow]: ...

class PgRunRepo(RunRepo): ...  # implements RunRepo; packages/db/src/repos/runs.ts

class LessonRow:
    lesson_id: LessonId
    unit_id: UnitId
    number: int | None
    type: str
    title: str
    state: LessonStateName
    current_version_id: VersionId | None
    reviewer_id: UserId | None
    last_editor_id: UserId | None
    schema_version: int

class LessonVersionRow:
    version_id: VersionId
    lesson_id: LessonId
    number: int
    kind: Literal["generated", "candidate", "submit", "approve", "reopen"]
    adopted: bool
    content_hash: Sha256
    state_vector: StateVector | None
    lesson: StoredLesson
    draft: LessonDraft | None
    teacher_word_count: int
    provenance: ProvenanceRecord
    dependency_record: list[DependencyRecordEntry]
    created_by: UserId | None
    stored_at: datetime

class ProvenanceRecord:
    outline_row_hash: Sha256
    prompt_version_id: str | None        # model fields are null on human-made versions (CON-19)
    model: str | None
    parameters: JsonValue
    schema_version: int
    example_set_id: str | None
    run_id: RunId | None
    model_call_ids: list[ModelCallId]
    cost_usd: Usd
    ai_assisted_spans: int
    derived_from_version_id: VersionId | None

class DependencyRecordEntry:
    lesson_id: LessonId
    approved_hash: Sha256

class NewGeneratedVersion:
    lesson_id: LessonId
    unit_id: UnitId
    kind: Literal["generated", "candidate"]
    lesson: StoredLesson
    draft: LessonDraft
    content_hash: Sha256
    provenance: ProvenanceRecord
    idempotency_key: str                 # UNIQUE: a second store is a no-op (HP-7 mechanic 3)

class NewSnapshot:
    lesson_id: LessonId
    kind: Literal["submit", "approve", "reopen"]
    lesson: StoredLesson
    content_hash: Sha256
    state_vector: StateVector
    dependency_record: list[DependencyRecordEntry]
    created_by: UserId

class NewReviewEvent:
    lesson_id: LessonId
    version_id: VersionId | None
    from_state: LessonStateName
    to_state: LessonStateName
    actor_id: UserId
    reason: str | None
    reason_tag: str | None
    note: str | None
    content_hash: Sha256 | None
    request_id: RequestId

class ReviewEventRow:
    review_event_id: str
    lesson_id: LessonId
    from_state: LessonStateName
    to_state: LessonStateName
    actor_id: UserId
    at: datetime

class DependencyState:
    direction: Literal["waits_on", "depended_on_by"]
    lesson_id: LessonId
    slot_id: str
    source_state: LessonStateName
    slot_filled: bool
    source_approved_hash: Sha256 | None

class BoardRowRecord:
    lesson_id: LessonId
    number: int | None
    type: str
    title: str
    state: LessonStateName
    reviewer_name: str | None
    last_change_at: datetime
    dependency_flag: bool

class LessonStateInfo:
    lesson_id: LessonId
    state: LessonStateName
    editable: bool
    reviewer_id: UserId | None

class GeneratedVersionWrite:
    version: LessonVersionRow            # the stored row: the new one, or the existing one on the conflict path
    created: bool                        # False when idempotency_key already existed (ON CONFLICT DO NOTHING, G-25)

# LessonRepo is split by who asks (Metz S3); one Pg class implements the three at first.
class LessonStateRepo(Protocol):  # ports/lesson-state.ts
    async def get(self, lesson_id: LessonId) -> LessonRow | None: ...
    async def lock_for_update(self, lesson_id: LessonId, tx: Tx) -> LessonRow: ...
    async def state_of(self, lesson_id: LessonId) -> LessonStateInfo: ...
    async def ensure_lessons(self, rows: Sequence[NormalizedRow], unit_id: UnitId, tx: Tx) -> int: ...
    async def set_state(self, lesson_id: LessonId, to_state: LessonStateName, reviewer_id: UserId | None, tx: Tx) -> LessonRow: ...
    async def append_review_event(self, e: NewReviewEvent, tx: Tx) -> ReviewEventRow: ...
    async def record_last_editor(self, lesson_id: LessonId, user_id: UserId, tx: Tx) -> None: ...

class LessonVersionRepo(Protocol):  # ports/lesson-versions.ts
    async def write_generated_version(self, v: NewGeneratedVersion, tx: Tx) -> GeneratedVersionWrite: ...
    async def write_snapshot(self, s: NewSnapshot, tx: Tx) -> LessonVersionRow: ...
    async def version(self, version_id: VersionId) -> LessonVersionRow | None: ...
    async def latest_snapshot(self, lesson_id: LessonId) -> LessonVersionRow | None: ...
    async def candidate(self, lesson_id: LessonId, candidate_id: VersionId) -> LessonVersionRow | None: ...
    async def has_generated_version(self, lesson_id: LessonId) -> bool: ...   # FailNode's candidate branch (G-26)
    async def approved_snapshots(self, unit_id: UnitId) -> list[LessonVersionRow]: ...
    async def mark_adopted(self, version_id: VersionId, tx: Tx) -> LessonVersionRow: ...
    # whole adopt only (CON-16; §13 R-5): UPDATE … SET adopted = true WHERE version_id = $1 AND kind = 'candidate' AND
    # adopted = false RETURNING; zero rows → DomainRefusal(INVALID_TRANSITION) (a concurrent whole adopt won). A section
    # adopt leaves adopted false and is recorded by its audit event only, so a later whole adopt stays possible.

class LessonGraphRepo(Protocol):  # ports/lesson-graph.ts
    async def dependencies(self, lesson_id: LessonId) -> list[DependencyState]: ...
    async def dependants(self, lesson_id: LessonId) -> list[LessonId]: ...
    async def source_outline_version(self, lesson_id: LessonId) -> OutlineVersionId | None: ...
    # the outline version of the run that produced the lesson's newest "generated" version or wholly adopted "candidate"
    # (provenance.run_id → run.outline_version_id); None when it has neither. Only CheckContextLoader calls it (§13 R-14)

class BoardReadRepo(Protocol):  # ports/board-reads.ts; implemented in packages/db/src/repos/metrics.ts (A13a)
    async def board_rows(self, unit_id: UnitId, state: LessonStateName | None) -> list[BoardRowRecord]: ...

class PgBoardReadRepo(BoardReadRepo): ...  # implements BoardReadRepo; packages/db/src/repos/metrics.ts (A13a), beside PgMetricsRepo

class PgLessonRepo(LessonStateRepo): ...  # implements LessonStateRepo; also implements LessonVersionRepo and LessonGraphRepo; packages/db/src/repos/lessons.ts

class IssueRow:
    issue_id: IssueId
    lesson_id: LessonId
    content_hash: Sha256
    level: IssueLevelName
    kind: CheckKind
    message: str
    address: str | None
    span_anchor: str | None
    related_lesson_id: LessonId | None
    code: str | None                     # the standard code a finding is about (part of the resolution key, G-14)
    resolved_by: UserId | None
    resolution_reason: str | None
    resolved_at: datetime | None
    cleared_by: Literal["fix", "resolution"] | None
    created_at: datetime

class IssueSet:
    lesson_id: LessonId
    checked_hash: Sha256 | None
    checked_at: datetime | None
    issues: list[IssueRow]

class NewResolution:
    issue_id: IssueId
    by: UserId
    reason: str
    request_id: RequestId

class LessonIssueCounts:
    lesson_id: LessonId
    blocking: int
    confirmation: int
    advisory: int

class IssueRepo(Protocol):
    async def replace_for_hash(self, lesson_id: LessonId, content_hash: Sha256, findings: Sequence[CheckFinding], tx: Tx) -> IssueSet: ...
    # carries resolutions forward to an identical finding (same kind, address, code) on the new hash; marks the rest cleared_by="fix"
    async def current(self, lesson_id: LessonId) -> IssueSet: ...
    async def get(self, issue_id: IssueId) -> IssueRow | None: ...
    async def resolve(self, r: NewResolution, tx: Tx) -> IssueRow: ...
    async def resolutions_for(self, lesson_id: LessonId) -> list[IssueRow]: ...
    # the latest resolved row per (kind, address, code) on any hash of the lesson; merge_resolutions matches the re-run's
    # findings against it at Submit and Approve (G-14)
    async def counts_by_lesson(self, unit_id: UnitId) -> list[LessonIssueCounts]: ...

class PgIssueRepo(IssueRepo): ...  # implements IssueRepo; packages/db/src/repos/check-queue.ts

class SafetyFlagRow:
    flag_id: str
    lesson_id: LessonId
    source_row: int
    teacher_tip_address: str | None
    status: Literal["open", "cleared"]
    cleared_by: UserId | None
    note: str | None
    cleared_at: datetime | None

class SafetyFlagRepo(Protocol):
    async def create_for_lesson(self, lesson_id: LessonId, source_rows: Sequence[int], tx: Tx) -> list[SafetyFlagRow]: ...
    async def open_for(self, lesson_id: LessonId) -> list[SafetyFlagRow]: ...
    async def clear(self, flag_id: str, by: UserId, note: str, tx: Tx) -> SafetyFlagRow: ...

class PgSafetyFlagRepo(SafetyFlagRepo): ...  # implements SafetyFlagRepo; packages/db/src/repos/review-extras.ts

class AlignmentLinkRow:
    lesson_id: LessonId
    content_hash: Sha256
    code: str
    address: str
    role: Literal["I", "P", "A"]
    origin: Literal["outline", "narrowed", "added"]
    asserted_by: Literal["outline", "generator", "judge", "reviewer"]
    confirmed_by: UserId | None

class CoverageCell:
    code: str
    lesson_id: LessonId
    role: Literal["I", "P", "A"]
    confirmation: Literal["person", "judge_only", "generator_only"]
    source: Literal["approved", "working"]   # CON-22: the latest approved snapshot's links where one exists, else the stored
                                             # derived row's (§13 R-11); the service groups cells by (code, lesson) into roles

class AlignmentRepo(Protocol):
    async def replace_for_hash(self, lesson_id: LessonId, content_hash: Sha256, links: Sequence[AlignmentLinkRow], tx: Tx) -> int: ...
    async def confirm(self, lesson_id: LessonId, code: str, by: UserId, decision: Literal["confirm", "remove", "add"], tx: Tx) -> AlignmentLinkRow: ...
    async def for_lesson(self, lesson_id: LessonId) -> list[AlignmentLinkRow]: ...
    async def coverage_rows(self, unit_id: UnitId) -> list[CoverageCell]: ...
    # ONE query (CON-22): per lesson, the alignment_link rows whose content_hash is its latest approve snapshot's hash
    # (source approved), else its latest lesson_doc derived hash (source working); never a model
    async def restore(self, lesson_id: LessonId, code: str, rows: Sequence[AlignmentLinkRow], tx: Tx) -> int: ...
    # undo (CON-14; §13 R-4): replaces the rows for (lesson_id, code) at the lesson's latest hash with `rows` (the undone
    # decision's before_links), confirmation included; returns the row count

class PgAlignmentRepo(AlignmentRepo): ...  # implements AlignmentRepo; packages/db/src/repos/review-extras.ts

class NewSuggestion:
    lesson_id: LessonId
    anchor_start: str
    anchor_end: str
    selected_text: str
    note: str
    suggested_text: str
    requested_by: UserId
    model_call_id: ModelCallId
    expires_at: datetime                 # set by SuggestionService: now + SUGGESTION_TTL_MIN (the repo reads no settings; §13 R-3)

class SuggestionRow:
    suggestion_id: SuggestionId
    lesson_id: LessonId
    anchor_start: str
    anchor_end: str
    selected_text: str
    suggested_text: str
    status: Literal["pending", "accepted", "rejected", "closed"]
    requested_by: UserId
    decided_by: UserId | None
    decided_at: datetime | None
    expires_at: datetime                 # 30 min after creation (CON-17); past it, reads report closed
    model_call_id: ModelCallId

class SuggestionRepo(Protocol):
    async def insert(self, s: NewSuggestion) -> SuggestionRow: ...
    async def get(self, suggestion_id: SuggestionId) -> SuggestionRow | None: ...
    async def decide(self, suggestion_id: SuggestionId, status: Literal["accepted", "rejected", "closed"], by: UserId, tx: Tx) -> SuggestionRow: ...
    async def pending_for(self, lesson_id: LessonId, now: datetime) -> list[SuggestionRow]: ...   # excludes expired

class PgSuggestionRepo(SuggestionRepo): ...  # implements SuggestionRepo; packages/db/src/repos/review-extras.ts

class NewAuditEvent:
    actor_id: UserId | None
    action: str                          # dotted: "session.sign_in", "outline.upload", "run.cancel", "issue.resolve", …
    target_kind: Literal["session", "unit", "outline_version", "run", "lesson", "issue", "safety_flag", "suggestion", "prompt_version", "export"]
    target_id: str
    version_hash: Sha256 | None
    reason: str | None
    details: JsonValue                   # ids and codes only; never lesson text, keys or raw emails
    request_id: RequestId | None
    store_id: StoreId | None

class HistoryRow:
    at: datetime
    source: Literal["review_event", "audit_event"]
    actor_name: str | None
    action: str
    from_state: LessonStateName | None
    to_state: LessonStateName | None
    version_hash: Sha256 | None
    reason: str | None

class StandardDecisionRow:  # read back from audit_event (actions standard.confirm / .remove / .add / .undo; §13 R-4)
    audit_id: AuditEventId
    lesson_id: LessonId
    code: str
    decision: Literal["confirm", "remove", "add", "undo"]
    by: UserId
    at: datetime
    before_entry: Standard | None        # the front-matter entry before this decision (codes and CDE text only, no lesson text)
    before_links: list[AlignmentLinkRow] # the code's alignment_link rows before this decision

class AuditLog(Protocol):
    async def append(self, e: NewAuditEvent, tx: Tx) -> AuditEventId: ...
    async def history(self, lesson_id: LessonId) -> list[HistoryRow]: ...
    async def standard_decisions(self, lesson_id: LessonId, code: str) -> list[StandardDecisionRow]: ...
    # newest first; parses details {code, decision, undo_of, before_entry, before_links} that IssueService.decide_standard
    # writes on every standard decision (§13 R-4)

class PgAuditLog(AuditLog): ...  # implements AuditLog; packages/db/src/repos/audit.ts

class HeartbeatRecord:
    user_id: UserId
    tab_id: str
    lesson_id: LessonId
    version_id: VersionId
    at: datetime
    active: bool                         # focused and visible and input within 60 s (computed by the server from the body)
    synthetic: bool

class ReviewSessionRow:
    user_id: UserId
    lesson_id: LessonId
    version_id: VersionId
    started_at: datetime
    last_at: datetime
    active_seconds: int
    synthetic: bool

class LessonMetricsRecord:
    lesson_id: LessonId
    version_id: VersionId
    active_minutes: Decimal
    human_sessions: int
    teacher_word_count: int
    g2_threshold_minutes: Decimal        # half this version's read time, stored at write (CON-10)
    draft_rating: DraftRating
    approved_at: datetime

class MetricsRepo(Protocol):
    async def insert_heartbeat(self, hb: HeartbeatRecord) -> None: ...
    async def extend_session(self, hb: HeartbeatRecord, gap_s: int) -> ReviewSessionRow: ...
    async def sessions_for(self, lesson_id: LessonId) -> list[ReviewSessionRow]: ...
    async def first_approval_exists(self, lesson_id: LessonId, tx: Tx) -> bool: ...
    async def write_lesson_metrics(self, row: LessonMetricsRecord, tx: Tx) -> bool: ...  # INSERT … ON CONFLICT DO NOTHING
    async def unit_metrics_rows(self, unit_id: UnitId) -> list[LessonMetricsRecord]: ...

class PgMetricsRepo(MetricsRepo): ...  # implements MetricsRepo; packages/db/src/repos/metrics.ts

class PromptVersionRow:
    prompt_version_id: str
    number: int
    locked_hash: Sha256
    guidance_text: str
    author_id: UserId | None
    reason: str | None
    diff: str | None
    created_at: datetime

class NewGuidanceVersion:
    base_version_id: str
    guidance_text: str
    reason: str
    author_id: UserId

class PromptRepo(Protocol):
    async def current(self) -> PromptVersionRow: ...
    async def get(self, prompt_version_id: str) -> PromptVersionRow | None: ...
    async def all(self) -> list[PromptVersionRow]: ...
    async def insert_guidance(self, v: NewGuidanceVersion, diff: str, tx: Tx) -> PromptVersionRow: ...   # STALE_BASE unless base is current (row lock)
    async def pinned_by_runs(self, prompt_version_id: str) -> list[RunId]: ...

class PgPromptRepo(PromptRepo):  # implements PromptRepo; packages/db/src/repos/prompts.ts
    async def sync_locked_layer(self, locked_hash: Sha256, tx: Tx) -> PromptVersionRow | None: ...
    # repository-level, not on the port (§13 R-6): under pg_advisory_xact_lock('prompt:sync'), an empty table → insert v1
    # (number 1, locked_hash, empty guidance, author None, reason "initial"); current locked_hash differs → insert n+1 with
    # the new hash and the current guidance carried over; equal → nothing (returns None). wire_prompts calls it once per
    # web process at construction (NL-34)

class NewExportBundle:
    unit_id: UnitId
    payload_sha256: Sha256
    lesson_versions: list[VersionId]
    held_back: list[HeldBackRecord]
    payload: ExportBundleFile
    created_by: UserId

class HeldBackRecord:
    lesson_id: LessonId
    reason: str
    waits_on: LessonId

class ExportBundleRow:
    export_id: str
    unit_id: UnitId
    version_number: int
    payload_sha256: Sha256
    lesson_versions: list[VersionId]
    held_back: list[HeldBackRecord]
    created_by: UserId
    created_at: datetime

class ExportRepo(Protocol):
    async def insert(self, b: NewExportBundle, tx: Tx) -> ExportBundleRow: ...
    async def latest(self, unit_id: UnitId) -> ExportBundleRow | None: ...
    async def all_for_unit(self, unit_id: UnitId) -> list[ExportBundleRow]: ...
    async def payload(self, export_id: str) -> ExportBundleFile | None: ...
    # create runs under pg_advisory_xact_lock('export:' || unit_id); an unchanged payload hash returns latest() without writing (CON-23)

class PgExportRepo(ExportRepo): ...  # implements ExportRepo; packages/db/src/repos/exports.ts

class NewJudgeVerdict:
    lesson_id: LessonId
    content_hash: Sha256
    address: str
    code: str
    question: Literal["teaches_standard", "eld_keeps_task"]
    verdict: Literal["yes", "no"]
    model_call_id: ModelCallId
    served_model: str

class JudgeVerdictRow:
    verdict_id: str
    lesson_id: LessonId
    code: str
    verdict: Literal["yes", "no"]
    served_model: str
    created_at: datetime

class JudgeRepo(Protocol):
    async def insert_verdict(self, v: NewJudgeVerdict) -> JudgeVerdictRow: ...

class PgJudgeRepo(JudgeRepo): ...  # implements JudgeRepo; packages/db/src/repos/judge.ts (cut #2)

class NewEvalRun:
    suite: SuiteName
    git_sha: str
    prompt_version_id: str | None
    models: JsonValue
    provider_mode: Literal["real", "stub"]
    case_set: str
    run_id: RunId | None

class EvalRunRow:
    eval_run_id: str
    suite: SuiteName
    passed: int
    total: int
    report_path: str | None
    started_at: datetime
    finished_at: datetime | None

class EvalCaseResultRecord:
    eval_run_id: str
    case_id: str
    provenance: Literal["issued", "hand-written", "synthetic", "promoted-trace"]
    source: str
    guards: str
    passed: bool
    failure_category: str | None
    expected: JsonValue
    actual: JsonValue

class ProbeRunRecord:
    probe_run_id: str
    kind: Literal["http", "yjs"]
    users: int
    duration_s: int
    machine: str
    provider_mode: Literal["real", "stub"]
    p95_ms: JsonValue                    # {"lesson_open": …, "board": …, "poll": …, "remote_edit": …, "stored": …}
    error_rate: float
    lost_updates: int
    event_loop_lag_p95_ms: float
    max_db_connections: int
    n: int

class ExperimentRunRecord:
    experiment_id: str                   # "SP-1", "SP-2", "SP-3" (+ run suffix)
    config: JsonValue
    result: JsonValue
    report_path: str

class OpsEventRecord:
    kind: Literal["process.start", "migration.applied", "seed", "backup", "health.failure", "samples.built"]
    service: str
    build_id: str
    details: JsonValue

class EvidenceRepo(Protocol):
    async def start_eval_run(self, r: NewEvalRun) -> EvalRunRow: ...
    async def add_case_result(self, r: EvalCaseResultRecord) -> None: ...
    async def finish_eval_run(self, eval_run_id: str, passed: int, total: int, report_path: str) -> EvalRunRow: ...
    async def insert_probe_run(self, p: ProbeRunRecord) -> str: ...
    async def insert_experiment_run(self, e: ExperimentRunRecord) -> str: ...
    async def ops_event(self, e: OpsEventRecord) -> str: ...

class PgEvidenceRepo(EvidenceRepo): ...  # implements EvidenceRepo; packages/db/src/repos/evidence.ts
```

### 3.6 Time and ids

```python
class Clock(Protocol):
    def now(self) -> datetime: ...
    async def sleep(self, ms: int) -> None: ...

class SystemClock(Clock): ...  # implements Clock; packages/core/src/ports.ts default
class FakeClock(Clock): ...  # implements Clock; test helper, advanced by tests

class IdGenerator(Protocol):
    def new_id(self, prefix: IdPrefix) -> str: ...

class PrefixedIdGenerator(IdGenerator): ...  # implements IdGenerator; "<prefix>_<ulid>"
```

## 4. Model-call wrapper and prompts (`packages/llm`, `packages/prompts`)

Every model call in the system goes through `ModelCallRecorder.call` (rule `agent-architecture`: one logged, retried
call path), and every paid call through `PaidCaller.call` (Metz S6). The recorder owns
retries on 429 / 529 / 5xx (≤ `PROVIDER_MAX_RETRIES`, honouring `retry-after`, with jitter), the per-call timeout and the
`model_call` rows. It never retries a truncation or a schema failure: those are the caller's decisions (§6).

```python
class ModelCallContext:
    run_id: RunId | None
    lesson_id: LessonId | None
    job_id: JobId | None
    attempt: int
    purpose: CallPurpose
    request_id: RequestId | None
    experiment_id: str | None
    reservation_id: ReservationId | None

class CostMath(Protocol):  # packages/llm/src/paid-call.ts; the wiring passes §8's pure functions (§13 R-6)
    def settle_cost(self, price: ModelPrice, usage: TokenUsage) -> Usd: ...
    def max_call_cost(self, price: ModelPrice, input_tokens_estimate: int, output_cap: int) -> Usd: ...

class ModelCallRecorder:
    def __init__(self, client: ModelClient, log: ModelCallLog, clock: Clock, prices: PriceTable, settings: ModelSettings, cost: CostMath) -> None: ...
    async def call(self, ctx: ModelCallContext, req: StructuredCallRequest, rendered: RenderedPrompt) -> RecordedCall: ...
    # 1 insert_sent (rendered prompt) → 2 client.complete with retries → 3 complete(raw, usage, cost via settle_cost,
    # served model, provider request id) the moment the response arrives; on final failure fail() and raise ProviderError
    async def checkpoint(self, job_id: JobId, purpose: CallPurpose, attempt: int) -> RecordedCall | None: ...
    # = ModelCallLog.completed_for; attempt is the call ordinal for (job, purpose) (G-19)

class PaidCallRequest:
    ctx: ModelCallContext
    req: StructuredCallRequest
    rendered: RenderedPrompt
    run_id: RunId | None
    job_id: JobId | None
    user_id: UserId

class PaidCaller:  # packages/llm/src/paid-call.ts (Metz S6): the one reserve → call → settle | release protocol
    def __init__(self, recorder: ModelCallRecorder, spend: SpendLedger, prices: PriceTable, cost: CostMath) -> None: ...
    async def call(self, p: PaidCallRequest) -> RecordedCall: ...
    # amount = max_call_cost(price_for(alias model), rendered.input_tokens_estimate, req.max_output_tokens) → spend.reserve
    # (refused → raise SpendRefused(refused_by, scope, amount); nothing sent, no model_call row) → recorder.call with
    # ctx.reservation_id → spend.settle(reservation_id, recorded.cost_usd, model_call_id); on any exception
    # spend.release(reservation_id) in `finally` (a no-op once settled). Every call reserves its OWN worst case, so the
    # draft (32000), the truncation retry (48000) and the repair each reserve right before they are sent (G-17, G-18).
    # Callers: DraftNode, RepairNode, UnitPlanJob, SuggestionService. JudgeJob (cut #2) uses the ledger the same way
    # around JudgeClient.

class PriceTable:
    prices: list[ModelPrice]
    confirmed_on: str                    # date the provider docs were read (PD-12)
    def price_for(self, model_id: str) -> ModelPrice: ...

class RenderedPrompt:
    prompt_version_id: str
    locked_hash: Sha256
    system_blocks: list[PromptBlock]
    user_blocks: list[PromptBlock]
    text: str                            # the exact text stored on model_call.rendered_prompt
    input_tokens_estimate: int           # ceil(characters / 3.5 × 1.10): a 10% margin over the tokenizer estimate [A],
                                         # so a reservation is a true worst case (G-6, G-7)

class UnitPlanPromptInput:
    run_id: RunId
    prompt: PromptVersionRow
    rows: list[NormalizedRow]
    unit_rules: list[UnitRuleRecord]
    links: list[LessonLinkRecord]
    repair_of: UnitPlanRepairNote | None # None on the first call; set on the one plan repair (§13 R-13)

class UnitPlanRepairNote:
    draft_raw: str                       # the previous call's raw output, verbatim
    issues: list[str]                    # Zod issue paths and the code checks that failed (missing day, duplicate, out of scope)

class DraftPromptInput:
    prompt: PromptVersionRow
    context: RowContext
    plan_entries: list[UnitPlanEntryDraft]   # own entry and neighbours (DIR-4)
    standards: list[StandardRow]
    template: SectionTemplate
    example_set_id: str | None               # None: SP-1 ran with no few-shot examples (the only ones are in the restricted
                                             # folder, GR-9); ProvenanceRecord.example_set_id is then null (G-28)
    reviewer_note: str | None                # candidate regenerate note (CON-16)

class RepairPromptInput:
    prompt: PromptVersionRow
    draft_raw: str
    failing: list[CheckFinding]              # the draft and the failing checks only (DO-1 §4.2 step 5)
    schema_issues: list[str]                 # Zod issue paths when the draft failed validation (SP-1: 2 of 3 lessons)
    template: SectionTemplate

class AssistPromptInput:
    prompt: PromptVersionRow
    selected_text: str
    note: str
    section_name: str

class JudgePromptInput:
    standard_text: str
    activity_text: str
    question: Literal["teaches_standard", "eld_keeps_task"]
    rubric_version: str

class PromptRenderer:
    def __init__(self, locked_dir: str, schemas: SchemaRegistry) -> None: ...
    def render_unit_plan(self, i: UnitPlanPromptInput) -> RenderedPrompt: ...
    # with i.repair_of set: the same prompt plus one delimited "data" block holding the previous raw plan and its issues
    def render_lesson_draft(self, i: DraftPromptInput) -> RenderedPrompt: ...
    # embeds the LessonDraft JSON Schema as a "schema" system block and asks for JSON only (SP-1 output_mode prompt_embedded)
    def render_repair(self, i: RepairPromptInput) -> RenderedPrompt: ...   # same embedding as the draft
    def render_assist(self, i: AssistPromptInput) -> RenderedPrompt: ...
    def render_judge(self, i: JudgePromptInput) -> RenderedPrompt: ...

class SchemaRegistry:
    def json_schema(self, name: Literal["UnitPlanDraft", "LessonDraft", "AssistRewrite", "JudgeVerdict"]) -> JsonValue: ...
```

## 5. Web services (`apps/web/src/server`)

Every service method takes the resolved `RequestUser` first and checks its role on the server (INTERFACE shared
guarantee 1). Refusals raise `DomainRefusal(code, …)`; `with_route` turns them into the card's envelope and status.
Where a method writes, it writes inside one `TxRunner.with_tx` and writes nothing on refusal, not even an audit row: a
refusal is one application-log line (shared guarantee 2; spec dry run G-15). Services receive `tx: TxRunner`, never the
concrete `PgDatabase` (Metz S1).

```python
class RouteSpec:
    operation_id: str
    roles: list[RoleName] | None         # None = any signed-in role
    request_schema: str | None           # Zod mirror name, e.g. "StartRunRequest"; transitionLesson uses "TransitionRequestInput"
    success_status: int
    public: bool                         # default False; True only for signIn (no session yet): with_route skips the session step
                                         # but keeps the Origin check (§13 R-17)
# TransitionRequestInput (packages/schema/src/api/transition.ts, G-11): the Zod mirror of TransitionRequest with
# Approve.rating, RequestChanges.note and Reopen.reason optional and nullable, every other field strict. A missing or
# empty one then reaches decide_transition, which raises the card's RATING_REQUIRED / NOTE_REQUIRED / REASON_REQUIRED in
# CON-18's precedence (after ROLE_FORBIDDEN, NOT_FOUND, INVALID_TRANSITION) instead of an INVALID_REQUEST from the parse.
# A contract test asserts it accepts every valid TransitionRequest and differs from it only in those three fields.
# CHG-3: RequestChanges and Reopen also carry optional snapshot_hash / snapshot_state_vector (both or neither, enforced
# in TransitionService, not in the parse).

class RouteHandler(Protocol):
    async def __call__(self, request: HttpRequest) -> HttpResponse: ...

class HttpRequest:
    method: str
    path_params: JsonValue
    query: JsonValue
    headers: JsonValue
    body: JsonValue | None
    cookies: JsonValue

class HttpResponse:
    status: int
    headers: JsonValue                   # always carries X-Request-Id
    body: JsonValue | None

class ErrorResponse:
    status: int
    body: Error                          # = OpenAPI Error envelope; details carry request_id

# with_route (apps/web/src/server/http/with-route.ts)
def with_route(handler: ServiceCall, spec: RouteSpec) -> RouteHandler: ...
# order follows INTERFACE shared guarantee 11: request id → session, and the Origin check on mutations (UNAUTHENTICATED;
# open item 2) → Zod parse (INVALID_REQUEST) → role (ROLE_FORBIDDEN) → service (NOT_FOUND, then the card's order) → envelope;
# PoolExhausted (no connection within PG_ACQUIRE_TIMEOUT_MS) → SERVICE_BUSY with Retry-After: BUSY_RETRY_AFTER_S

# hash_password (apps/web/src/server/http/passwords.ts)
def hash_password(password: str) -> str: ...
# verify_password (apps/web/src/server/http/passwords.ts)
def verify_password(stored_hash: str, password: str) -> bool: ...   # constant-time

# to_error_response (apps/web/src/server/http/refusal.ts)
def to_error_response(refusal: DomainRefusal, request_id: RequestId) -> ErrorResponse: ...

class ServiceCall(Protocol):
    async def __call__(self, user: RequestUser, request: HttpRequest) -> JsonValue: ...

class SignInOutcome:
    session: Session                     # OpenAPI Session
    cookie_token: str                    # raw token for Set-Cookie; only its sha256 is stored
    expires_at: datetime

class RequestMeta:
    request_id: RequestId
    ip_hash: Sha256 | None

class SessionService:
    def __init__(self, sessions: SessionRepo, audit: AuditLog, tx: TxRunner, clock: Clock, ids: IdGenerator, settings: WebSettings) -> None: ...
    async def sign_in(self, req: SignInRequest, meta: RequestMeta) -> SignInOutcome: ...
    # unknown email → NOT_ON_ALLOW_LIST; wrong password → INVALID_CREDENTIALS; refusals log a hashed email only
    async def require(self, cookie_token: str | None, request_id: RequestId) -> RequestUser: ...  # UNAUTHENTICATED
    async def get_session(self, user: RequestUser) -> Session: ...
    async def sign_out(self, user: RequestUser, cookie_token: str) -> None: ...

class UploadedFile:
    filename: str
    content_type: str
    data: bytes

class OutlineService:
    def __init__(self, outlines: OutlineRepo, standards: StandardRepo, sheets: SheetFetcher, audit: AuditLog, tx: TxRunner, ids: IdGenerator, clock: Clock, settings: WebSettings) -> None: ...
    async def list_units(self, user: RequestUser) -> UnitList: ...
    async def upload(self, user: RequestUser, file: UploadedFile, unit_id: UnitId | None) -> OutlineVersion: ...
    # over OUTLINE_MAX_BYTES → UNSUPPORTED_FILE per the card; filed under the unit the sheet writes (CON-2)
    async def import_link(self, user: RequestUser, req: ImportLinkRequest) -> OutlineVersion: ...   # SHEET_NOT_PUBLIC, SHEET_UNREACHABLE
    async def report(self, user: RequestUser, outline_version_id: OutlineVersionId) -> ValidationReport: ...
    async def record_choice(self, user: RequestUser, outline_version_id: OutlineVersionId, req: IntakeChoiceRequest) -> IntakeChoiceResult: ...
    # INVALID_CHOICE (kind does not fit the target), INVALID_TRANSITION (late unit change); revert restores the default

class RunService:
    def __init__(self, runs: RunRepo, queue: JobQueue, outlines: OutlineRepo, states: LessonStateRepo, prompts: PromptRepo, spend: SpendLedger, calls: ModelCallLog, audit: AuditLog, tx: TxRunner, ids: IdGenerator, clock: Clock, settings: WebSettings) -> None: ...
    async def start(self, user: RequestUser, req: StartRunRequest, idempotency_key: str | None) -> Run: ...
    # same key within IDEMPOTENCY_WINDOW_H → the first run, nothing new; one tx: generate_gate (VALIDATION_INCOMPLETE)
    # → spend.check_day_cap(user, cap_usd): refused → DAY_CAP_REACHED with details.scope (DayCapScope) and
    # details.remaining_usd → PromptRepo.current pinned → insert_run (choices_json and choices_hash copied; unit_plan row
    # with the lesson links) → states.ensure_lessons → create_run_jobs (one unit_plan job for a full run + one job per
    # lesson in scope; trial = one candidate job) → audit; NOTIFY lesson_job after commit. The dialog's suggested cap is
    # run_cap_for(...) = 13.00 for 47 lessons (SP-1).
    async def progress(self, user: RequestUser, run_id: RunId) -> RunProgress: ...
    # RunRow.capped_by is a CapName, the same three values as CON-6's capped_by (no mapping, G-4)
    async def control(self, user: RequestUser, run_id: RunId, req: RunControlRequest) -> RunControlResult: ...
    # RunRepo.lock_for_update → decide_run_control (INVALID_TRANSITION) → requeue_failed / cancel_run(reason "cancelled")
    # / resume (re-queues a failed plan)
    async def plan(self, user: RequestUser, run_id: RunId) -> UnitPlan: ...
    async def summary(self, user: RequestUser, run_id: RunId) -> RunSummary: ...
    # totals come from ModelCallLog.totals_for_run; a mismatch with run spend sets the "trace incomplete" flag (DO-6 check 1)
    # RunSummary.calls_lost_in_flight = sum(JobRow.calls_lost) over summary_rows.jobs: lesson_job.calls_lost is the stored
    # per-job count (ModelCallLog.mark_lost), the OpenAPI field is its run total; one name per layer, no other mapping (G-20)

class BoardService:
    def __init__(self, board: BoardReadRepo, issues: IssueRepo, metrics: MetricsRepo) -> None: ...
    async def board(self, user: RequestUser, unit_id: UnitId, state: LessonState | None) -> UnitBoard: ...
    async def metrics(self, user: RequestUser, unit_id: UnitId) -> UnitMetrics: ...

class CoverageService:  # apps/web/src/server/services/coverage-service.ts (A18, cut #4): its own file, no edit to BoardService
    def __init__(self, alignment: AlignmentRepo) -> None: ...
    async def coverage(self, user: RequestUser, unit_id: UnitId) -> CoverageMatrix: ...

class LessonReadService:
    def __init__(self, states: LessonStateRepo, versions: LessonVersionRepo, reader: LessonDocReader, outlines: OutlineRepo, alignment: AlignmentRepo, suggestions: SuggestionRepo, audit: AuditLog, issues: IssueRepo, flags: SafetyFlagRepo, graph: LessonGraphRepo) -> None: ...
    # issues / flags / graph feed the approver checklist and the dependency lines of CON-11 (§13 R-6)
    async def get_lesson(self, user: RequestUser, lesson_id: LessonId) -> Lesson: ...
    # derived row for editable states, the latest snapshot for frozen ones; assert_known_nodes → SCHEMA_UNKNOWN; never writes
    async def history(self, user: RequestUser, lesson_id: LessonId) -> LessonHistory: ...

class IssueService:
    def __init__(self, issues: IssueRepo, checks: CheckQueue, flags: SafetyFlagRepo, alignment: AlignmentRepo, states: LessonStateRepo, collab: CollabCommands, audit: AuditLog, tx: TxRunner, clock: Clock, settings: WebSettings) -> None: ...
    async def get_issues(self, user: RequestUser, lesson_id: LessonId) -> IssueList: ...
    async def record_resolution(self, user: RequestUser, lesson_id: LessonId, issue_id: IssueId, req: ResolutionRequest) -> ResolveResult: ...
    # NOT_RESOLVABLE (the kind clears only by a fix), REASON_REQUIRED; written outside the document (issue + audit_event)
    async def clear_safety_flag(self, user: RequestUser, lesson_id: LessonId, flag_id: str, req: SafetyFlagClearRequest) -> ResolveResult: ...
    async def decide_standard(self, user: RequestUser, lesson_id: LessonId, req: StandardDecisionRequest) -> ResolveResult: ...
    # front-matter change → collab.apply_edit(StandardEdit) (counts as an edit for four-eyes); confirmation recorded on
    # alignment_link; audit. undo: within UNDO_WINDOW_S and no later decision on the code, else UNDO_EXPIRED
    # Every decision's audit row carries details {code, decision, undo_of, before_entry, before_links} (§13 R-4). undo:
    # role → NOT_FOUND (lesson; undo_of not in audit.standard_decisions(lesson_id, code) or not the caller's) →
    # LESSON_LOCKED → UNDO_EXPIRED when now − target.at > UNDO_WINDOW_S or target is not the newest row (an undo is itself
    # a decision, so a second undo expires) → collab.apply_edit(StandardEdit{decision "undo", code, restore =
    # target.before_entry}) → one tx: alignment.restore(lesson_id, code, target.before_links) + audit (standard.undo);
    # status "undone". COLLAB_UNAVAILABLE → nothing recorded.

class SlotService:
    def __init__(self, states: LessonStateRepo, collab: CollabCommands, policy: CheckPolicy, graph: LessonGraphRepo) -> None: ...
    # graph: dependants(lesson_id) → FillSlotResult.linked_lessons (§13 R-6)
    async def fill(self, user: RequestUser, lesson_id: LessonId, slot_id: str, req: FillSlotRequest) -> FillSlotResult: ...
    # SOURCE_REQUIRED / QUOTE_TOO_LONG checked here before any edit; LESSON_LOCKED from collab

class CandidateService:
    def __init__(self, states: LessonStateRepo, versions: LessonVersionRepo, runs: RunRepo, queue: JobQueue, spend: SpendLedger, collab: CollabCommands, audit: AuditLog, tx: TxRunner, ids: IdGenerator, settings: WebSettings) -> None: ...
    async def regenerate(self, user: RequestUser, lesson_id: LessonId, req: RegenerateRequest) -> Candidate: ...
    # LESSON_LOCKED on submitted/approved; INVALID_TRANSITION while a candidate job is in flight (partial unique index);
    # DAY_CAP_REACHED (check_day_cap, scope as in RunService.start); one-lesson run of kind candidate with its own cap =
    # one lesson's worst case (draft + truncation retry + repair reservations)
    async def get(self, user: RequestUser, lesson_id: LessonId, candidate_id: VersionId) -> Candidate: ...
    async def adopt(self, user: RequestUser, lesson_id: LessonId, candidate_id: VersionId, req: AdoptRequest) -> AdoptResult: ...

class SuggestionService:
    def __init__(self, paid: PaidCaller, renderer: PromptRenderer, prompts: PromptRepo, suggestions: SuggestionRepo, states: LessonStateRepo, collab: CollabCommands, audit: AuditLog, tx: TxRunner, clock: Clock, settings: WebSettings, reader: LessonDocReader) -> None: ...
    # reader: latest_derived(lesson_id) resolves AssistPromptInput.section_name from the anchor's section (§13 R-6)
    async def list_pending(self, user: RequestUser, lesson_id: LessonId) -> SuggestionList: ...
    async def request(self, user: RequestUser, lesson_id: LessonId, req: SuggestionRequest) -> Suggestion: ...
    # synchronous PaidCaller.call (ASSIST alias, run_id None, ASSIST_CALL_TIMEOUT_MS = 20 s); SpendRefused → DAY_CAP_REACHED
    # is not a CON-17 code, so it surfaces as MODEL_UNAVAILABLE with details.reason "spend_cap"; ProviderError →
    # MODEL_UNAVAILABLE; expires_at = now + SUGGESTION_TTL_MIN
    async def decide(self, user: RequestUser, lesson_id: LessonId, suggestion_id: SuggestionId, req: SuggestionDecisionRequest) -> Suggestion: ...
    # accept → collab.apply_edit(EditCommand{edit: SuggestionAcceptEdit{anchor, expected_text = the STORED selected_text,
    # replacement_text = suggested_text}, tag "ai-assist", actor = the acceptor}): the collaboration server applies it
    # against the live document (CON-17); ANCHOR_CHANGED → decide(closed); COLLAB_UNAVAILABLE → stays pending.
    # reject → decide(rejected) + audit. Not pending → INVALID_TRANSITION.

class MetricsWriteResult:
    written: bool                        # False on a later approval (rework never edits the first row)
    active_minutes: Decimal | None
    human_sessions: int

class MetricsWriter:
    def __init__(self, metrics: MetricsRepo, settings: WebSettings) -> None: ...
    async def write_first_approval(self, lesson_id: LessonId, version: LessonVersionRow, rating: DraftRating, tx: Tx) -> MetricsWriteResult: ...

class TransitionService:
    def __init__(self, states: LessonStateRepo, versions: LessonVersionRepo, collab: CollabCommands, approvals: ApproveService, audit: AuditLog, tx: TxRunner, clock: Clock, settings: WebSettings) -> None: ...
    async def transition(self, user: RequestUser, lesson_id: LessonId, req: TransitionRequest) -> TransitionResult: ...
    # CON-18 precedence: transition_roles(action) (ROLE_FORBIDDEN) → states.get (NOT_FOUND) → decide_transition(action,
    # role, from_state, note, reason, tag, rating) (INVALID_TRANSITION, NOTE_REQUIRED / REASON_REQUIRED / RATING_REQUIRED)
    # → per action (CHG-3: request_changes and reopen take an optional pin, snapshot_hash AND snapshot_state_vector; inside
    #   the locked tx after the locked decide_transition and before any write, one without the other → INVALID_REQUEST, a
    #   pin that differs from versions.latest_snapshot (or no snapshot) → STALE_PIN, absent → unchanged):
    #   start_review: one tx, set_state(in_review, reviewer) + review_event
    #   submit: collab.lock_and_snapshot (freeze first, store, cover check, blocking checks on the stored row, snapshot +
    #           state + review_event); COLLAB_UNAVAILABLE if it cannot be reached; its refusals pass through unchanged
    #   approve: approvals.approve(user, lesson_id, req)
    #   withdraw / request_changes / reopen: one tx with the lesson row locked (reopen writes a new version with
    #           derived_from_version_id) → collab.set_mode(editable) INSIDE the open tx → commit (§13 R-10). CollabUnavailable
    #           → rollback → COLLAB_UNAVAILABLE, nothing changed (CON-18). A commit failure after set_mode succeeded →
    #           best-effort set_mode(read_only, from_state) + an InvariantViolation log line, then the error envelope; a
    #           collab restart re-seeds FrozenDocs from the stored state. The review_event id is the response's audit_id

class ApproveService:  # apps/web/src/server/services/approve-service.ts (Metz C2): Approve only, risk::security
    def __init__(self, states: LessonStateRepo, versions: LessonVersionRepo, graph: LessonGraphRepo, issues: IssueRepo, loader: CheckContextLoader, rules: Sequence[CheckRule], policy: CheckPolicy, metrics_writer: MetricsWriter, tx: TxRunner, clock: Clock, settings: WebSettings) -> None: ...
    async def approve(self, user: RequestUser, lesson_id: LessonId, req: TransitionRequest) -> TransitionResult: ...
    # one tx with the lesson row locked: decide_transition re-checked on the locked row → versions.latest_snapshot (kind
    # submit) and the pin (snapshot_hash AND snapshot_state_vector) else STALE_PIN → loader.load(snapshot.lesson,
    # snapshot.content_hash) + run_checks(CHECK_RULES, policy) on the SNAPSHOT → merge_resolutions(findings,
    # issues.resolutions_for(lesson_id)) → GateState{action approve, issues, pending_check False (the snapshot is frozen and
    # was just checked synchronously), pending_suggestions from the loaded context, open_confirmations, last_editor_id,
    # approver_id, four_eyes_enabled = FOUR_EYES_ENABLED, dependencies = graph.dependencies} → approve_gate (FOUR_EYES →
    # SUGGESTION_PENDING → BLOCKED → CONFIRMATION_OPEN → DEPENDENCY_UNAPPROVED) → write_snapshot(kind approve,
    # dependency_record) + set_state(approved) + append_review_event + MetricsWriter.write_first_approval → commit.
    # No collaboration hop (already frozen). Refused → rollback, one log line, no row of any kind.

class HeartbeatService:
    def __init__(self, metrics: MetricsRepo, clock: Clock, settings: WebSettings) -> None: ...
    async def record(self, user: RequestUser, lesson_id: LessonId, hb: Heartbeat) -> None: ...
    # authors → ROLE_FORBIDDEN; a beat closer than HEARTBEAT_MIN_SPACING_S to the previous one from the same tab is stored but
    # adds no time (CON-20; §13 R-7); active = focused, visible, input within the idle window

class PromptService:
    def __init__(self, prompts: PromptRepo, audit: AuditLog, tx: TxRunner) -> None: ...
    async def list(self, user: RequestUser) -> PromptVersions: ...
    async def save_guidance(self, user: RequestUser, req: SaveGuidanceRequest) -> GuidanceVersion: ...   # REASON_REQUIRED, STALE_BASE

class ExportService:
    def __init__(self, versions: LessonVersionRepo, exports: ExportRepo, audit: AuditLog, tx: TxRunner, ids: IdGenerator, clock: Clock, states: LessonStateRepo) -> None: ...
    # states (§13 R-6): create moves each newly included lesson approved → exported (set_state) and appends one
    # review_event per lesson (actor = the caller) in the same tx as ExportRepo.insert; an unchanged payload writes nothing
    async def list(self, user: RequestUser, unit_id: UnitId) -> ExportList: ...
    async def create(self, user: RequestUser, unit_id: UnitId) -> ExportCreated: ...   # unchanged payload → the previous version, nothing written
    async def download(self, user: RequestUser, export_id: str) -> LessonExportFile: ...

class WebServices:
    sessions: SessionService
    outlines: OutlineService
    runs: RunService
    board: BoardService
    coverage: CoverageService | None     # None while cut #4 is cut
    lesson_reads: LessonReadService
    issues: IssueService
    slots: SlotService
    candidates: CandidateService
    suggestions: SuggestionService | None   # None while its cut item is cut (same for prompts, exports, coverage)
    transitions: TransitionService
    approvals: ApproveService
    heartbeats: HeartbeatService
    prompts: PromptService | None
    exports: ExportService | None
    logger: Logger

# build_web_services (apps/web/src/server/container.ts)
def build_web_services(settings: WebSettings) -> WebServices: ...
# builds WebDeps once (§12), then calls every apps/web/src/server/wiring/<area>.ts function and merges the results;
# A0 writes it in wave 0 with every wiring import, and it never changes after that (Metz B2)
```

## 6. Worker (`apps/worker`): typed state, nodes, pure router

The run and lesson loops follow DO-2 §5.1: code decides *what next* and *done*; the model only fills typed slots.

```python
class LessonJobState:
    job: ClaimedJob                      # carries unit_id (G-23)
    context: RowContext | None           # built with RunRepo.pinned_choices (G-24)
    draft_call: RecordedCall | None
    call_ids: list[ModelCallId]          # every call of the job, in order (provenance model_call_ids)
    draft: LessonDraft | None
    schema_issues: list[str]             # Zod issue paths of the last parse (empty when valid)
    compiled: CompiledLesson | None
    compile_error: str | None            # CompileError message when compile_draft refused the draft
    check_result: CheckResult | None
    repair_rounds: int                   # brake: ≤ 1
    truncation_retries: int              # brake: ≤ 1, separate from repair
    rate_limit_retries: int              # counted from RecordedCall.retries
    brakes_fired: list[BrakeName]
    started_at: datetime                 # brake: JOB_WALL_CLOCK_MS from here
    cost_usd: Usd                        # sum of the job's settled call costs
    outcome: JobOutcome | None
# There is no reserve or settle node: every call goes through PaidCaller, which reserves that call's own worst case
# right before it is sent and settles it on arrival (G-17, G-18). The lesson job's money protocol is therefore the same
# as the unit plan's and AI assist's.

NextStep = Literal["store", "repair", "fail"]

class RouteInput:
    schema_valid: bool                   # the draft parsed as LessonDraft
    compiled: bool                       # compile_draft succeeded (False on CompileError)
    check_passed: bool                   # no blocking finding (meaningful only when compiled)
    repair_rounds: int
    max_repair_rounds: int               # 1 (R-19)

# route_after_checks (packages/core/src/pipeline/route-after-checks.ts)
def route_after_checks(i: RouteInput) -> NextStep: ...
# Decision table (G-22), first matching row wins:
#   schema_valid and compiled and check_passed                 → store
#   repair_rounds < max_repair_rounds (any failure: invalid schema, CompileError or a blocking finding) → repair
#   otherwise                                                  → fail
# The repair gets the draft and only what failed (schema issues, the compile error, the blocking findings).

class FailureInput:
    brakes_fired: list[BrakeName]
    provider_error: ProviderErrorKind | None
    schema_valid: bool
    compile_error: str | None
    first_failing_kind: CheckKind | None

# failure_reasons_for (packages/core/src/pipeline/failure-reasons.ts)
def failure_reasons_for(i: FailureInput) -> list[FailureReasonRecord]: ...
# Pure map to OpenAPI FailureReason.check (G-20), in this order, one reason per row that applies:
#   brake cancelled → cancelled · brake spend_run_cap / spend_day_cap / spend_project_cap → capped · brake job_wall_clock
#   → timeout · brake truncation_retry exhausted (truncated twice) → truncated · provider_error rate_limited or
#   overloaded after the retries (brake rate_limit_retries) → rate_limited · provider_error timeout → timeout · any other
#   provider_error → provider_error · compile_error set → compile_error · schema_valid false → schema_invalid ·
#   first_failing_kind set → check_failed with check_kind = that kind. circuit_breaker pauses the run; it adds no reason
#   to the job that tripped it (that job already has its own).

class FailureReasonRecord:
    check: FailureCheck
    check_kind: CheckKind | None
    message: str

class DraftNode:
    def __init__(self, paid: PaidCaller, renderer: PromptRenderer, outlines: OutlineRepo, runs: RunRepo, standards: StandardRepo, prompts: PromptRepo, settings: WorkerSettings) -> None: ...
    async def run(self, state: LessonJobState) -> LessonJobState: ...
    # RunRepo.pinned_choices → OutlineRepo.row_context(ov, lesson_id, pinned) → render_lesson_draft (schema embedded,
    # example_set_id None) → checkpoint(job, "lesson_draft", 1) first (stored raw output → no call) → PaidCaller.call
    # (GENERATION, output_mode prompt_embedded, max_output_tokens DRAFT_OUTPUT_TOKEN_CAP 32000, effort MODEL_EFFORT) →
    # stop_reason max_tokens → one truncation retry (purpose truncation_retry, TRUNCATION_RETRY_TOKEN_CAP 48000, its own
    # reservation); truncated twice → brake truncation_retry, route to fail. SpendRefused → brake spend_<cap>, fail.

class CompileCheckNode:
    def __init__(self, loader: CheckContextLoader, rules: Sequence[CheckRule], policy: CheckPolicy) -> None: ...
    async def run(self, state: LessonJobState) -> LessonJobState: ...
    # Zod parse (issues → schema_issues) → compile_draft(draft, CompileContext{row, template, unit_id = job.unit_id,
    # schema_version}) (CompileError → compile_error) → loader.load(lesson_id, compiled.lesson, compiled.content_hash) →
    # run_checks(ctx, rules = CHECK_RULES, policy)

class RepairNode:
    def __init__(self, paid: PaidCaller, renderer: PromptRenderer, prompts: PromptRepo, settings: WorkerSettings) -> None: ...
    async def run(self, state: LessonJobState) -> LessonJobState: ...
    # REPAIR alias (MODEL_REPAIR_ID), once: checkpoint(job, "repair", 1) → render_repair(draft_raw, failing findings,
    # schema_issues) → PaidCaller.call (prompt_embedded, DRAFT_OUTPUT_TOKEN_CAP) → repair_rounds + 1

class StoreNode:
    def __init__(self, versions: LessonVersionRepo, states: LessonStateRepo, docs: LessonDocStore, flags: SafetyFlagRepo, tx: TxRunner) -> None: ...
    async def run(self, state: LessonJobState) -> LessonJobState: ...
    # ONE tx (G-25). lesson job: write_generated_version(kind generated, ON CONFLICT (idempotency_key) DO NOTHING) →
    # created False → the earlier run already stored v1: return its version, write nothing else; created True →
    # docs.seed_initial(lesson_id, lesson, system actor, tx) + flags.create_for_lesson(…, tx) + set_state(draft, tx).
    # candidate job: write_generated_version(kind candidate, adopted false); if the lesson is generation_failed and has no
    # generated version, the candidate becomes v1 the same way as a lesson job (CON-16 [I]).

class FailNode:
    def __init__(self, states: LessonStateRepo, versions: LessonVersionRepo, tx: TxRunner) -> None: ...
    async def run(self, state: LessonJobState) -> LessonJobState: ...
    # outcome.failure_reasons = failure_reasons_for(...). lesson job → set_state(generation_failed). candidate job (G-26):
    # if versions.has_generated_version(lesson_id) the lesson's state is NOT touched (an in_review lesson stays in_review;
    # only the candidate job is failed and the tile shows the reasons); with no version yet it becomes generation_failed.
    # A job refused before its first call (capped, cancelled) writes no lesson row at all (CON-6).

class LessonJobRunner:
    def __init__(self, draft: DraftNode, compile_check: CompileCheckNode, repair: RepairNode, store: StoreNode, fail: FailNode, queue: JobQueue, finalizer: RunFinalizer, clock: Clock, settings: WorkerSettings) -> None: ...
    async def run(self, job: ClaimedJob) -> JobOutcome: ...
    # draft → compile_check → route_after_checks → (repair → compile_check → route) → store | fail → queue.finish →
    # finalizer.after_job(run_id, outcome). Checks queue.is_cancelled between nodes; wall clock checked before each node;
    # a ProviderError that survived the recorder's retries or a SpendRefused goes straight to fail (no repair);
    # LeaseLost stops the job and leaves it to requeue_expired.

class UnitPlanOutcome:
    run_id: RunId
    stored: bool
    entries: int
    model_call_id: ModelCallId | None
    failure: FailureReason | None

class UnitPlanJob:
    def __init__(self, paid: PaidCaller, renderer: PromptRenderer, runs: RunRepo, outlines: OutlineRepo, prompts: PromptRepo, settings: WorkerSettings) -> None: ...
    async def run(self, job: ClaimedJob) -> UnitPlanOutcome: ...
    # one PaidCaller.call (output_mode schema_enforced: UnitPlanDraft compiles, SP-1) + at most one repair (purpose "repair",
    # render_unit_plan with repair_of = {draft_raw, issues}, §13 R-13); valid → store
    # entries, run.plan_stored_at, state running; still invalid → RunRepo.mark_plan_failed (run paused, paused_check =
    # unit_plan; Resume re-queues it). SpendRefused → RunRepo.mark_capped.

class RunStateChange:
    run_id: RunId
    from_state: RunStateName
    to_state: RunStateName
    paused_check: str | None

class CompletenessReport:
    run_id: RunId
    terminal_jobs_without_calls: list[JobId]
    summary_matches_calls: bool

class RunFinalizer:
    def __init__(self, runs: RunRepo, queue: JobQueue, calls: ModelCallLog, tx: TxRunner, settings: WorkerSettings) -> None: ...
    async def after_job(self, run_id: RunId, outcome: JobOutcome) -> RunStateChange | None: ...
    # one tx: a spend_* brake in the outcome → runs.mark_capped(run_id, cap) + queue.cancel_run(run_id, "capped") (G-10);
    # else should_pause_run (CIRCUIT_BREAKER_SAME_CHECK) → set_state(paused, check); else derive_run_state
    async def completeness(self, run_id: RunId) -> CompletenessReport: ...  # DO-6 missing-instrumentation check 2

class TickReport:
    claimed: int
    in_flight: int
    requeued_at_start: int
    lost_calls_marked: int               # ModelCallLog.mark_lost over the requeued job ids
    reservations_released: int           # SpendLedger.release_for_jobs over the same ids (G-9)

class LoopExit:
    reason: Literal["sigterm", "fatal"]
    drained_jobs: int
    abandoned_jobs: int

class StopSignal(Protocol):
    def is_set(self) -> bool: ...

class ClaimLoop:
    def __init__(self, queue: JobQueue, calls: ModelCallLog, spend: SpendLedger, runner: LessonJobRunner, unit_plans: UnitPlanJob, clock: Clock, logger: Logger, settings: WorkerSettings, tx: TxRunner) -> None: ...
    # tx (§13 R-6): finishing a unit_plan job and its run-level follow-up (capped plan → queue.cancel_run) in one transaction
    async def start(self) -> TickReport: ...
    # requeue_expired once → for its job_ids: calls.mark_lost + spend.release_for_jobs → then claim
    async def run_until(self, stop: StopSignal) -> LoopExit: ...
    # claim(settings.worker_id, MAX_ACTIVE_RUNS, JOB_LEASE_MS) (G-27); semaphore GENERATION_CONCURRENCY (6, SP-1); lease
    # renewal every 30 s per in-flight job; on SIGTERM stop claiming, let calls finish

class CheckContext:
    lesson_id: LessonId
    content_hash: Sha256
    outline_version_id: OutlineVersionId  # the version compared against: graph.source_outline_version, else the unit's latest (§13 R-14)
    lesson: StoredLesson
    row: NormalizedRow
    arc_header: str | None
    allowed_codes: list[str]
    standards: list[StandardRow]
    text_cards: list[TextCardRecord]
    links: list[LessonLinkRecord]
    linked_lessons: list[DerivedRow]      # cross-lesson checks read the other lesson's stored row (R-28 as amended)
    pending_suggestions: list[SuggestionRow]
    safety_flags: list[SafetyFlagRow]
    confirmations: list[AlignmentLinkRow]
    previous_lesson_flags: list[SafetyFlagRow]  # open flags of the previous lesson row: disclosure_prompt covers "the flagged lesson
                                                # and the next" (R-19 as amended; §13 R-1)
    unit_coverage: list[CoverageCell]            # alignment.coverage_rows(unit): the unpractised-skill case of arc_repeat (R-9; §13 R-2)

class CheckContextLoader:
    def __init__(self, outlines: OutlineRepo, standards: StandardRepo, graph: LessonGraphRepo, reader: LessonDocReader, suggestions: SuggestionRepo, flags: SafetyFlagRepo, alignment: AlignmentRepo, clock: Clock) -> None: ...
    async def load(self, lesson_id: LessonId, lesson: StoredLesson, content_hash: Sha256) -> CheckContext: ...
    # resolves the outline version itself, in one place, so its callers (CheckJobRunner, ApproveService, lock_and_snapshot)
    # cannot disagree: graph.source_outline_version(lesson_id), else the unit's latest_outline_version_id; then
    # outlines.row_context(that version, lesson_id, None); the previous lesson = the kind "lesson" row just before this
    # one in outlines.rows(that version) (None for the first) → flags.open_for(it); and
    # alignment.coverage_rows(unit_id). No argument is added (§13 R-14).

class CheckRunReport:
    lesson_id: LessonId
    content_hash: Sha256
    blocking: int
    confirmation: int
    advisory: int
    dependants_requeued: int
    duration_ms: int

class CheckJobRunner:
    def __init__(self, checks: CheckQueue, reader: LessonDocReader, issues: IssueRepo, alignment: AlignmentRepo, graph: LessonGraphRepo, loader: CheckContextLoader, rules: Sequence[CheckRule], policy: CheckPolicy, tx: TxRunner, clock: Clock, settings: WorkerSettings) -> None: ...
    async def run_once(self) -> CheckRunReport | None: ...
    # claim → latest_derived (skip if a newer hash is queued) → run_checks(CHECK_RULES) → replace issues + alignment for the
    # hash → finish → enqueue dependants (graph.dependants) whose cross_lesson_link result may change

class JudgeRunReport:
    lesson_id: LessonId
    pairs: int
    verdicts_no: int
    cost_usd: Usd

class JudgeJob:
    def __init__(self, judge: JudgeClient, calls: ModelCallLog, verdicts: JudgeRepo, issues: IssueRepo, renderer: PromptRenderer, spend: SpendLedger, prices: PriceTable, tx: TxRunner) -> None: ...
    async def run(self, lesson_id: LessonId, content_hash: Sha256) -> JudgeRunReport: ...   # cut #2; advisory judge_no issues only
    # reserve → JudgeClient.verdict → settle | release, the PaidCaller protocol around a different client

class WorkerRuntime:
    claim_loop: ClaimLoop
    check_runner: CheckJobRunner
    judge: JudgeJob | None
    health: HealthServer
    logger: Logger

class HealthServer:
    port: int
    async def close(self) -> None: ...

# build_worker_runtime (apps/worker/src/main.ts)
def build_worker_runtime(settings: WorkerSettings) -> WorkerRuntime: ...

# serve_health (apps/worker/src/health.ts)
def serve_health(db: PgDatabase, port: int, service: str) -> HealthServer: ...
```

## 7. Collaboration server (`apps/collab`)

```python
class SocketAuthRequest:
    document_name: str                   # "lesson:<lesson_id>"
    cookie_header: str | None
    token_param: str | None

class SocketContext:
    socket_id: str
    user: AppUserRow
    lesson_id: LessonId
    lesson_state: LessonStateName
    read_only: bool                      # WriteGuard.can_write's decision at connect

class CollabAuthenticator:
    def __init__(self, sessions: SessionRepo, states: LessonStateRepo, guard: WriteGuard, frozen: FrozenDocs, clock: Clock, settings: CollabSettings) -> None: ...
    async def authenticate(self, req: SocketAuthRequest) -> SocketContext: ...   # raises DomainRefusal(UNAUTHENTICATED) → connection refused
    # also seeds FrozenDocs from lesson.state on the first connection to a document (frozen states: submitted, approved,
    # exported, and draft before start_review)

class WriteDecision:
    allowed: bool
    refusal: ApiErrorCode | None         # LESSON_LOCKED when the document is frozen, the state is not editable, or the role is not reviewer

class FrozenDocs:  # apps/collab/src/frozen-docs.ts: the per-document frozen flag, in memory, one collaboration process (PD-9)
    def is_frozen(self, lesson_id: LessonId) -> bool: ...
    def freeze(self, lesson_id: LessonId) -> None: ...        # lock_and_snapshot calls it BEFORE it stores (SP-2 option A)
    def unfreeze(self, lesson_id: LessonId) -> None: ...      # a refused Submit, or set_mode(editable) after Withdraw / Request changes / Reopen
    def seed(self, lesson_id: LessonId, state: LessonStateName) -> None: ...   # on load: frozen unless is_editable(state, "reviewer")

class WriteGuard:  # apps/collab/src/permissions.ts
    def __init__(self, frozen: FrozenDocs) -> None: ...
    def can_write(self, role: RoleName, state: LessonStateName, lesson_id: LessonId) -> WriteDecision: ...
    # at connect: allowed only if is_editable(state, role) (the lesson machine decides; WriteGuard keeps no state list,
    # Metz C3) and not frozen.is_frozen(lesson_id); otherwise the connection is read-only
    def on_update(self, ctx: SocketContext, frozen: bool) -> WriteDecision: ...
    # per message, from Hocuspocus beforeHandleMessage (SP-2): frozen = FrozenDocs.is_frozen(ctx.lesson_id); a frozen
    # document or a read-only connection → refuse BEFORE the update is applied; the caller then sends
    # AckBroadcaster.refused(ctx.socket_id, LESSON_LOCKED, message, refused_from = the client's state vector before the
    # refused update) and drops the update

class LoadedDoc:
    lesson_id: LessonId
    ydoc_bytes: YDocBytes
    seq: int
    schema_version: int

class LessonPersistence:
    def __init__(self, store: LessonDocStore, reader: LessonDocReader, frozen: FrozenDocs, acks: AckBroadcaster, logger: Logger, settings: CollabSettings) -> None: ...
    async def load(self, document_name: str) -> LoadedDoc: ...      # unknown schema_version → fail loudly with the lesson id
    async def store(self, document_name: str, ydoc_bytes: YDocBytes, last_editor: UserId | None, request_id: RequestId | None) -> StoreAck: ...
    # ydoc_to_lesson → content_hash → LessonDocStore.store (one tx) → AckBroadcaster.stored

class ModeMessage:
    mode: CollabMode
    state: LessonStateName

class AckBroadcaster:
    def stored(self, lesson_id: LessonId, ack: StoreAck) -> int: ...      # stateless {type:"stored", content_hash, state_vector, stored_at}
    def mode(self, lesson_id: LessonId, msg: ModeMessage) -> int: ...
    def refused(self, socket_id: str, code: ApiErrorCode, message: str, refused_from: StateVector) -> None: ...
    # stateless {type:"refused", code, message, refused_from} exactly as CON-12 / x-collaboration-channel; the editor's
    # refusals.ts undoes local updates after refused_from, turns read-only and tells the typist

class RefusedMessage:
    code: ApiErrorCode
    message: str
    refused_from: StateVector

class RefusalOutcome:
    dropped_updates: int
    refused_text: list[str]              # the text runs that were undone, shown to the typist
    read_only: bool                      # always True after a refusal

class EditorHandle(Protocol): ...  # marker: the ProseMirror view, Y.Doc and HocuspocusProvider of one open lesson (browser)

# apply_refusal (apps/web/src/editor/refusals.ts; owner A14)
def apply_refusal(editor: EditorHandle, msg: RefusedMessage) -> RefusalOutcome: ...
# SP-2's design rule: undoes the local updates made after refused_from (a Yjs UndoManager scoped to the local origin),
# switches the editor to read-only and tells the typist which text was refused; nothing is resent on reconnect

class CollabRuntime:
    port: int
    persistence: LessonPersistence
    commands: CollabCommandHandler
    logger: Logger

# build_collab_runtime (apps/collab/src/main.ts)
def build_collab_runtime(settings: CollabSettings) -> CollabRuntime: ...
```

## 8. Pure core and shared-package functions

All of these are pure (no I/O; deterministic for the same input).

```python
# --- intake (packages/core/src/intake/) ---
class CellGrid:
    rows: list[list[str]]                # raw cell text, NBSP preserved for the normalizer to strip
    sheet_name: str

class NormalizedRow:
    row_number: int
    kind: Literal["lesson", "flex_day", "arc_header", "total"]
    lesson_id: LessonId | None
    number: int | None
    title: str
    lesson_type: str
    arc: str | None
    segments: list[SegmentRecord]
    focus_codes: list[str]
    eld_codes: list[str]
    msls_codes: list[str]
    vocabulary: list[str]
    homework: str | None
    pages: str | None
    text_set: str | None

class SegmentRecord:
    kind: Literal["content", "writer_task", "editor_note", "unit_rule", "safety_note"]
    text: str
    instruction_shaped: bool             # SYN-1: flagged, kept as content
    applies: Literal["apply", "show_only", "ignore"]

class UnitRuleRecord:
    text: str
    scope_lesson_ids: list[LessonId]

class IntakeFinding:
    finding_id: str
    row_number: int | None
    level: Literal["ok", "warning", "error"]
    kind: str
    original_text: str
    proposed_fix: str | None
    default_choice: str | None           # every warning has a stored default (R-5 as amended)

class NormalizedOutline:
    unit_as_written: str
    unit_from_filenames: str | None
    rows: list[NormalizedRow]
    findings: list[IntakeFinding]
    unit_rules: list[UnitRuleRecord]
    counts: OutlineCounts

class OutlineCounts:
    lessons: int
    flex_days: int
    arc_headers: int
    totals: int
    errors: int
    warnings: int

class GateDecision:
    allowed: bool
    refusals: list[ApiErrorCode]         # ordered: the first is the one returned
    details: JsonValue

class StandardsIndex:
    def resolve(self, code: str, sheet_label: str | None = None) -> StandardResolution: ...
    # sheet_label: the label text the outline gives an ELD code; compared with the official text → eld_label_mismatch (§13 R-18)
    def leaves_of(self, code: str) -> list[str]: ...
    def text_of(self, code: str) -> str | None: ...

class StandardResolution:
    input_code: str
    status: Literal["ok", "malformed", "unknown", "parent"]
    resolved: list[str]
    suggestion: str | None
    eld_label_mismatch: bool

# parse_workbook (packages/core/src/intake/parse-grid.ts)
def parse_workbook(data: bytes, kind: SheetKind) -> CellGrid: ...   # UNSUPPORTED_FILE on anything else
# normalize_outline (packages/core/src/intake/normalize.ts)
def normalize_outline(grid: CellGrid, standards: StandardsIndex, max_rows: int) -> NormalizedOutline: ...   # HEADER_NOT_FOUND, TOO_MANY_ROWS
# compute_lesson_links (packages/core/src/intake/lesson-links.ts)
def compute_lesson_links(rows: Sequence[NormalizedRow]) -> list[LessonLinkRecord]: ...
# build_validation_report (packages/core/src/intake/report.ts)
def build_validation_report(version: OutlineVersionRow, outline: NormalizedOutline, choices: Sequence[IntakeChoiceRow]) -> ValidationReport: ...
# generate_gate (packages/core/src/intake/report.ts)
def generate_gate(outline: NormalizedOutline, choices: Sequence[IntakeChoiceRow]) -> GateDecision: ...

# --- model-output schemas (packages/schema) ---
class UnitPlanEntryDraft:
    lesson_id: LessonId
    day: int
    purpose: str
    routines: list[str]
    hands_forward: str
    performance_task_thread: str

class UnitPlanDraft:
    entries: list[UnitPlanEntryDraft]    # exactly one per teaching day in scope

class DraftBlock:
    role: Literal["routine_heading", "teacher_talk", "sample_response", "callout_purpose", "callout_say", "callout_watch", "support_table", "cfu_item", "quick_write", "text_evidence_needed", "excerpt_slot", "teacher_tip", "homework", "paragraph", "list"]
    section: str
    part: str | None
    text: str
    standard_codes: list[str]
    code_origins: list[Literal["outline", "narrowed", "added"]]
    cfu: CfuItemDraft | None
    minutes: int | None

class CfuItemDraft:
    stem: str
    options: list[str]
    key_index: int
    rationales: list[str]
    standard_code: str

class LessonDraft:
    lesson_id: LessonId
    title: str
    blocks: list[DraftBlock]             # no "quote" role exists (HP-2)
    text_cards: list[TextCardRecord]

class TextCardRecord:
    title: str
    author: str | None
    edition: str | None
    chapter: str | None
    pages: str | None
    kind: Literal["off-platform-text", "newsela-article", "public-domain"]
    content_available: bool

class StoredLesson:
    lesson_id: LessonId
    schema_version: int
    title: str
    type: str
    front_matter: FrontMatterRecord
    sections: list[Section]              # OpenAPI Section: address, name, minutes, ProseMirror content
    text_cards: list[TextCardRecord]

class FrontMatterRecord:
    standards: list[Standard]            # OpenAPI Standard entries with origin and confirmation
    minutes_total: int
    vocabulary: list[str]

class ExportBundleFile:
    export_version: int
    unit_id: UnitId
    generated_at: datetime
    lessons: list[ExportedLessonRecord]

class ExportedLessonRecord:
    lesson_id: LessonId
    version_id: VersionId
    content_hash: Sha256
    approved_by: str
    approved_at: datetime
    lesson: StoredLesson

class EmittedSchema:
    name: str
    path: str
    sha256: Sha256

# emit_json_schemas (packages/schema/scripts/emit-json-schemas.ts)
def emit_json_schemas(out_dir: str) -> list[EmittedSchema]: ...
# assert_known_nodes (packages/editor-schema/src/schema.ts)
def assert_known_nodes(doc: ProseMirrorDoc, schema_version: int) -> NodeCheck: ...   # raises SchemaUnknownError, never drops a node

SCHEMA_VERSION: int = 1                  # packages/editor-schema/src/schema.ts; bumped only with a re-compile from stored drafts
EDITOR_SCHEMA = ProseMirrorSchemaRef     # the prosemirror-model Schema instance built from the node list (packages/editor-schema)
SECTION_TEMPLATES = SectionTemplateTable # packages/core/src/compile/templates.ts
PRICE_TABLE = PriceTable                 # packages/llm/src/prices.ts, confirmed at build (PD-12)

class ProseMirrorSchemaRef:
    schema_version: int
    node_names: list[str]                # Newsela's nodes plus three Lesson Studio nodes (§13 R-20): teacher_tip (teacher-only,
                                         # attr safety_note_id, HP-9), quote_placeholder (slot_id, reason) and excerpt_slot (slot_id,
                                         # rights; HP-2: a quote is held by a slot a person fills, never generated)
    mark_names: list[str]

class SectionTemplateTable:
    templates: list[SectionTemplate]     # Reading etc. 5/10/30/5 + Homework; Spark 15/30/5; Flex and assessments 5/40/5 (R-11)

class NodeCheck:
    ok: bool
    node_count: int
    schema_version: int

# --- compile (packages/core/src/compile/) ---
class SectionTemplate:
    lesson_type: str
    sections: list[SectionSlot]

class SectionSlot:
    name: str
    minutes: int
    required_roles: list[str]

class CompileContext:
    row: NormalizedRow
    template: SectionTemplate
    unit_id: UnitId
    schema_version: int

class CompiledLesson:
    lesson: StoredLesson
    content_hash: Sha256
    teacher_word_count: int
    placeholders: int
    safety_tips: list[str]               # addresses of teacher_tip nodes placed by code (HP-9)

# compile_draft (packages/core/src/compile/compile-draft.ts)
def compile_draft(draft: LessonDraft, ctx: CompileContext) -> CompiledLesson: ...
# raises CompileError (§10.2) when a schema-valid draft cannot be placed: a block in a section the template lacks, a
# role the allow-list forbids in that section, or a node assert_known_nodes rejects; CompileCheckNode turns it into
# compile_error (G-21). content_hash is computed by content_hash() from packages/schema (below), the same function
# packages/ydoc uses, so the compiled hash and the stored hash are identical by construction (G-29).
# assign_addresses (packages/core/src/compile/addresses.ts)
def assign_addresses(lesson: StoredLesson, unit_id: UnitId) -> StoredLesson: ...

# --- checks (packages/core/src/checks/) ---
class CheckPolicy:
    quote_span_min_words: int            # 3 [M] (SP-3: every quote plant caught, 0 false flags on SP-1's real drafts)
    reviewer_quote_max_words: int        # 12
    quote_and_page_scans: Literal["blocking_everywhere"]   # SP-3: blocking in every block role
    name_scan_scope: Literal["blocking_in_cfu_items", "blocking_everywhere"]   # "blocking_in_cfu_items" (SP-3, option B):
                                         # a flag inside a cfu_item block is blocking; anywhere else it is advisory
    name_scan_engine: Literal["heuristic_plus_compromise"]  # capitalised-token heuristic + the `compromise` npm library
    minutes_target: int                  # 50
    minutes_tolerance: int               # 5
    vocabulary_cap: int
    safety_run_min_words: int            # 6

class CheckFinding:
    kind: CheckKind
    level: IssueLevelName
    message: str
    address: str | None
    span_anchor: str | None
    related_lesson_id: LessonId | None
    code: str | None

class CheckResult:
    content_hash: Sha256
    findings: list[CheckFinding]
    alignment: list[AlignmentLinkRow]
    blocking: int
    confirmation: int
    advisory: int
    first_failing_kind: CheckKind | None

class CheckRule(Protocol):
    kind: CheckKind
    level: IssueLevelName
    def run(self, ctx: CheckContext, policy: CheckPolicy) -> list[CheckFinding]: ...

class GateState:
    action: Literal["submit", "approve"]
    issues: list[GateIssue]              # from merge_resolutions over the synchronous re-run (stored row or snapshot)
    pending_check: bool                  # always False at Submit and Approve: both re-run the checks synchronously on
                                         # the exact content they freeze or pin, so nothing is pending (G-14)
    pending_suggestions: int
    open_confirmations: int
    last_editor_id: UserId | None
    approver_id: UserId | None
    four_eyes_enabled: bool
    dependencies: list[DependencyState]
# RATING_REQUIRED is decided earlier, by decide_transition (missing-input codes come before the card's own conditions in
# CON-18's precedence), so GateState carries no rating (G-11)

CHECK_POLICY = CheckPolicy             # packages/core/src/checks/policy.ts: the SP-3 values above, plus minutes 50 ± 5
CHECK_RULES = CheckRuleList             # packages/core/src/checks/registry.ts (G-13): one entry per CheckKind, in CheckKind
                                         # order; the first A6a ticket writes all 28 rule files as stubs returning [] (Metz C1),
                                         # later tickets fill bodies only; judge_no's rule reads stored verdicts (cut #2)

class CheckRuleList:
    rules: list[CheckRule]

class GateIssue:
    kind: CheckKind
    level: IssueLevelName
    message: str
    address: str | None
    code: str | None
    related_lesson_id: LessonId | None
    resolved: bool                       # a recorded resolution with the same (kind, address, code) exists

# merge_resolutions (packages/core/src/checks/gates.ts)
def merge_resolutions(findings: Sequence[CheckFinding], recorded: Sequence[IssueRow]) -> list[GateIssue]: ...
# pure (G-14): each re-run finding becomes a GateIssue, resolved when IssueRepo.resolutions_for holds a resolution with
# the same (kind, address, code) and the kind is resolvable; resolutions never carry to a finding of a different key, so
# Submit and Approve block on exactly what the issue list would show unresolved

# run_checks (packages/core/src/checks/registry.ts)
def run_checks(ctx: CheckContext, rules: Sequence[CheckRule], policy: CheckPolicy) -> CheckResult: ...
# submit_gate (packages/core/src/checks/gates.ts)
def submit_gate(state: GateState) -> GateDecision: ...   # SUGGESTION_PENDING → BLOCKED (lists blocking and confirmation) → CONFIRMATION_OPEN
# approve_gate (packages/core/src/checks/gates.ts)
def approve_gate(state: GateState) -> GateDecision: ...  # FOUR_EYES → SUGGESTION_PENDING → BLOCKED → CONFIRMATION_OPEN → DEPENDENCY_UNAPPROVED

# --- spend (packages/core/src/spend/reservation.ts) ---
# Money is Decimal; every result is rounded to 6 dp (numeric(12,6)) as stated per function (G-6).
# max_call_cost (packages/core/src/spend/reservation.ts)
def max_call_cost(price: ModelPrice, input_tokens_estimate: int, output_cap: int) -> Usd: ...
# = (input_tokens_estimate × max(input_per_mtok, cache_write_per_mtok) + output_cap × output_per_mtok) / 1,000,000,
# rounded UP (ceiling) to 6 dp: the worst case, so a reservation never under-reserves for a priced token.
# Example: 5,700 input, cap 32,000 at $2/$10 (cache write $2.50) → 0.014250 + 0.320000 = $0.334250
# decide_reservation (packages/core/src/spend/reservation.ts)
def decide_reservation(snapshot: SpendSnapshot, amount_usd: Usd) -> ReservationDecision: ...
# caps are inclusive (CON-6: spent + reserved ≤ cap); checked in the order run_cap (skipped when run_cap_usd is None) →
# day_cap → project_cap; refused_by is the first that fails, scope and remaining_usd describe it; reservation_id is None
# (the ledger assigns it after an allowed decision)
# settle_cost (packages/core/src/spend/reservation.ts)
def settle_cost(price: ModelPrice, usage: TokenUsage) -> Usd: ...
# = (input_tokens × input + output_tokens × output + cache_read_tokens × cache_read + cache_write_tokens × cache_write)
#   / 1,000,000, rounded half-up to 6 dp
# run_cap_for (packages/core/src/spend/reservation.ts)
def run_cap_for(cost_per_lesson: Usd, lessons: int, multiplier: Decimal, unit_plan_cost: Usd) -> Usd: ...
# PD-14 as SP-1 fixed it: cost_per_lesson × lessons × multiplier + unit_plan_cost, rounded UP to the next whole dollar.
# Example: 0.182 × 47 × 1.5 + 0.16 = 12.991 → $13.00 (RUN_CAP_DEFAULT_USD)
# user_day_cap_for (packages/core/src/spend/reservation.ts)
def user_day_cap_for(run_cap_default: Usd, multiplier: Decimal) -> Usd: ...
# G-2: USER_DAY_CAP_MULTIPLIER × RUN_CAP_DEFAULT_USD = 2 × 13.00 = $26.00 per user per UTC day [C]

# --- lifecycle (packages/core/src/lifecycle/) ---
TransitionAction = Literal["start_review", "submit", "withdraw", "approve", "request_changes", "reopen"]

class TransitionInput:
    action: TransitionAction
    role: RoleName
    from_state: LessonStateName
    note: str | None
    reason: str | None
    tag: str | None
    rating: DraftRating | None           # approve: None → RATING_REQUIRED (G-11)

class TransitionDecision:
    allowed: bool
    to_state: LessonStateName | None
    refusal: ApiErrorCode | None         # ROLE_FORBIDDEN, INVALID_TRANSITION, NOTE_REQUIRED, REASON_REQUIRED, RATING_REQUIRED
    writes_snapshot: Literal["submit", "approve", "reopen"] | None
    collab_mode_after: CollabMode | None

class JobStatusView:
    status: JobStatus
    tile_state: TileState
    kind: JobKind
    failure_check: str | None

class RunStateInput:
    current: RunStateName
    plan_stored: bool
    cancelled: bool
    capped: bool
    paused: bool

class RunControlDecision:
    allowed: bool
    to_state: RunStateName | None
    refusal: ApiErrorCode | None         # INVALID_TRANSITION
    requeue_failed: bool
    cancel_jobs: bool

class TerminalJobView:
    lesson_id: LessonId
    status: JobStatus
    first_failing_kind: CheckKind | None
    finished_at: datetime

class PauseDecision:
    pause: bool
    check: CheckKind | None
    lesson_ids: list[LessonId]

# decide_transition (packages/core/src/lifecycle/lesson-machine.ts)
def decide_transition(i: TransitionInput) -> TransitionDecision: ...   # role → state → missing input, CON-18's order
# transition_roles (packages/core/src/lifecycle/lesson-machine.ts)
def transition_roles(action: TransitionAction) -> list[RoleName]: ...  # checked before the lesson is loaded (ROLE_FORBIDDEN precedes NOT_FOUND)
# is_editable (packages/core/src/lifecycle/lesson-machine.ts)
def is_editable(state: LessonStateName, role: RoleName) -> bool: ...  # reviewer in in_review / changes_requested / reopened (CON-12); WriteGuard and apply_edit ask it
# derive_run_state (packages/core/src/lifecycle/run-machine.ts)
def derive_run_state(jobs: Sequence[JobStatusView], run: RunStateInput) -> RunStateName: ...
# tile_state (packages/core/src/lifecycle/run-machine.ts)
def tile_state(job: JobStatusView) -> TileState: ...
# decide_run_control (packages/core/src/lifecycle/run-machine.ts)
def decide_run_control(current: RunStateName, action: Literal["cancel", "retry_failed", "resume"]) -> RunControlDecision: ...
# should_pause_run (packages/core/src/pipeline/circuit-breaker.ts)
def should_pause_run(recent: Sequence[TerminalJobView], threshold: int) -> PauseDecision: ...

# --- metrics (packages/core/src/metrics/) ---
class ActiveInterval:
    user_id: UserId
    start: datetime
    end: datetime
    synthetic: bool

# merge_heartbeats (packages/core/src/metrics/sessions.ts)
def merge_heartbeats(beats: Sequence[HeartbeatRecord], gap_s: int) -> list[ActiveInterval]: ...
# compute_lesson_metrics (packages/core/src/metrics/frozen-row.ts)
def compute_lesson_metrics(sessions: Sequence[ReviewSessionRow], version: LessonVersionRow, rating: DraftRating, approved_at: datetime) -> LessonMetricsRecord: ...   # human sessions only (HP-8)

# --- ydoc (packages/ydoc/src/) ---
# lesson_to_ydoc (packages/ydoc/src/convert.ts)
def lesson_to_ydoc(lesson: StoredLesson) -> YDocBytes: ...
# ydoc_to_lesson (packages/ydoc/src/convert.ts)
def ydoc_to_lesson(data: YDocBytes, schema_version: int) -> StoredLesson: ...
# content_hash (packages/schema/src/content-hash.ts)
def content_hash(lesson: StoredLesson) -> Sha256: ...   # SHA-256 (@noble/hashes, pure JS) of canonical JSON (sorted keys, no whitespace)
# G-29: it lives in packages/schema (A2, wave 0) because both packages/core (compile_draft, which may not import
# packages/ydoc) and packages/ydoc need it; packages/ydoc/src/hash.ts re-exports it and adds only the Yjs functions
# state_vector_of (packages/ydoc/src/hash.ts)
def state_vector_of(data: YDocBytes) -> StateVector: ...
# covers (packages/ydoc/src/hash.ts)
def covers(stored: StateVector, client: StateVector) -> bool: ...
```

## 9. Settings, database, logging and scripts

```python
class SharedSettings:  # every process, including collab
    database_url: SecretStr
    pg_pool_max: int
    build_id: str
    log_level: Literal["debug", "info", "warn", "error"]

class ModelSettings:  # web and worker only (Metz S4): collab never calls a model and never needs the key
    model_provider_mode: Literal["real", "stub"]
    anthropic_api_key: SecretStr | None  # required when model_provider_mode = real
    model_generation_id: str             # "claude-sonnet-5-5" (SP-1)
    model_repair_id: str                 # "claude-sonnet-5-5" (SP-1 repaired on the same model)
    model_assist_id: str                 # "claude-sonnet-5-5" [A]
    model_effort: Literal["low", "medium", "high"]   # "low" (SP-1)
    model_call_timeout_ms: int           # 240000 (SP-1)
    provider_max_retries: int

class SpendSettings:  # web and worker only; PgSpendLedger's constructor takes it (G-1)
    build_spend_ceiling_usd: Decimal     # 75 (PD-29): the project ceiling
    run_cap_default_usd: Decimal         # 13.00 (SP-1, PD-14)
    user_day_cap_multiplier: Decimal     # 2 → user day cap $26.00 (G-2)
    cost_per_lesson_estimate_usd: Decimal   # 0.182 (SP-1 mean, repairs included)
    unit_plan_cost_estimate_usd: Decimal # 0.16 (SP-1)
    run_cap_multiplier: Decimal          # 1.5 (PD-14)

class WebSettings:
    shared: SharedSettings
    model: ModelSettings
    spend: SpendSettings
    pg_acquire_timeout_ms: int
    busy_retry_after_s: int
    app_origin: str
    session_cookie_name: str
    session_ttl_hours: int
    audit_hash_salt: SecretStr
    four_eyes_enabled: bool
    outline_max_rows: int
    outline_max_bytes: int
    sheets_fetch_timeout_ms: int
    idempotency_window_h: int
    undo_window_s: int
    assist_call_timeout_ms: int
    suggestion_ttl_min: int
    collab_internal_url: str
    collab_internal_token: SecretStr
    heartbeat_merge_gap_s: int
    heartbeat_min_spacing_s: int
    unchecked_after_s: int

class WorkerSettings:
    shared: SharedSettings
    model: ModelSettings
    spend: SpendSettings
    worker_id: str                       # WORKER_ID, default "<hostname>-<pid>" filled at start (G-27)
    openrouter_api_key: SecretStr | None
    model_judge_id: str | None
    generation_concurrency: int          # 6 (SP-1)
    max_active_runs: int
    job_wall_clock_ms: int
    job_lease_ms: int
    job_poll_ms: int
    check_poll_ms: int
    draft_output_token_cap: int          # 32000 (SP-1)
    truncation_retry_token_cap: int      # 48000 (SP-1)
    circuit_breaker_same_check: int
    health_port: int

class CollabSettings:
    shared: SharedSettings
    collab_port: int
    collab_internal_token: SecretStr
    session_cookie_name: str
    store_debounce_ms: int
    store_max_debounce_ms: int

class PgDatabase(TxRunner):  # implements TxRunner; packages/db/src/pool.ts + tx.ts; named only in composition roots, repositories, health and scripts
    def __init__(self, settings: SharedSettings, pool_max: int, acquire_timeout_ms: int) -> None: ...
    async def with_tx(self, fn: TxFunction, advisory_lock: str | None) -> TxResult: ...
    async def ping(self) -> bool: ...
    async def close(self) -> None: ...

class TxFunction(Protocol):
    async def __call__(self, tx: Tx) -> TxResult: ...

TxResult = JsonValue                     # whatever the function returns; typed at each call site

class MigrationReport:
    applied: list[str]
    already_applied: int

# run_migrations (packages/db/src/migrate.ts)
def run_migrations(db: PgDatabase) -> MigrationReport: ...

class Logger(Protocol):
    def info(self, event: str, fields: LogFields) -> None: ...
    def warn(self, event: str, fields: LogFields) -> None: ...
    def error(self, event: str, fields: LogFields) -> None: ...

class LogFields:
    request_id: RequestId | None
    run_id: RunId | None
    lesson_id: LessonId | None
    job_id: JobId | None
    store_id: StoreId | None
    duration_ms: int | None
    extra: JsonValue                     # ids, counts and codes only; no lesson text, prompts, keys or emails

class SeedReport:
    standards: int
    users: int
    ops_event_id: str

# seed_reference_data (ops/seed.ts)
def seed_reference_data(db: PgDatabase) -> SeedReport: ...

SuiteName = Literal["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12", "S13", "S14"]

class EvalOptions:
    repeat: int
    provider_mode: Literal["real", "stub"]
    git_sha: str
    unit: UnitId | None

class EvalCase:
    case_id: str
    provenance: Literal["issued", "hand-written", "synthetic", "promoted-trace"]
    source: str
    guards: str
    input_path: str
    expected: JsonValue

class CaseOutcome:
    case_id: str
    passed: bool
    failure_category: str | None
    actual: JsonValue
    cost_usd: Usd

class EvalSuite(Protocol):
    name: SuiteName
    def cases(self) -> list[EvalCase]: ...
    async def score(self, case: EvalCase, opts: EvalOptions) -> CaseOutcome: ...

class EvalRunSummary:
    eval_run_id: str
    suite: SuiteName
    passed: int
    total: int
    report_path: str
    cost_usd: Usd

class EvalRunner:
    def __init__(self, evidence: EvidenceRepo, suites: Sequence[EvalSuite], clock: Clock) -> None: ...
    async def run(self, suite: SuiteName, opts: EvalOptions) -> EvalRunSummary: ...

class FullRunReport:
    run_id: RunId
    n: int
    first_pass_schema_valid: int
    repairs: int
    failures_by_reason: JsonValue
    placeholders: int
    grounding_flags_by_kind: JsonValue
    confirmations: int
    cost_usd: Usd
    report_path: str

# build_full_run_report (evals/src/full-run-report.ts)
def build_full_run_report(run_id: RunId) -> FullRunReport: ...

class FaultSuiteReport:
    eval_run_id: str
    kill_test_passed: bool
    rate_limit_test_passed: bool
    truncation_test_passed: bool
    cap_test_passed: bool
    duplicates_found: int
    calls_lost_counted: int

# run_fault_suite (ops/faults/run-faults.ts)
def run_fault_suite(opts: EvalOptions) -> FaultSuiteReport: ...

class SpikeOptions:
    users: int
    ramp_s: int
    plateau_s: int
    socket_editors: int
    base_url: str
    collab_url: str

# run_spike (load/spike.ts)
def run_spike(opts: SpikeOptions) -> ProbeRunRecord: ...

class ImportReport:
    experiment_id: str
    model_calls_imported: int

# import_spike_report (ops/import-spike.ts)
def import_spike_report(path: str) -> ImportReport: ...
```

## 10. Errors

### 10.1 `ApiErrorCode` — every code the interface spec names

Members are the 36 codes of the `ErrorCode` enum in `interface.openapi.yaml`, which equals its `x-error-catalog` (the
card list in INTERFACE.md → *Error envelope and the named errors*, including the nine the System review added). The
HTTP status for each code is the catalog's; `apps/web/src/server/http/refusal.ts` is generated from `x-error-catalog` at
build time (a contract test compares them), so no status is restated here. `DISCONNECTED` is a channel state on CON-12, not a code.

```python
class ApiErrorCode(StrEnum):
    INVALID_REQUEST = "INVALID_REQUEST"
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
    INVALID_CHOICE = "INVALID_CHOICE"
    NOT_RESOLVABLE = "NOT_RESOLVABLE"
    UNDO_EXPIRED = "UNDO_EXPIRED"
    STALE_BASE = "STALE_BASE"
    SHEET_UNREACHABLE = "SHEET_UNREACHABLE"
    COLLAB_UNAVAILABLE = "COLLAB_UNAVAILABLE"
    SERVICE_BUSY = "SERVICE_BUSY"
    UNAUTHENTICATED = "UNAUTHENTICATED"
    NOT_ON_ALLOW_LIST = "NOT_ON_ALLOW_LIST"
    ROLE_FORBIDDEN = "ROLE_FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"
    INVALID_TRANSITION = "INVALID_TRANSITION"
    SHEET_NOT_PUBLIC = "SHEET_NOT_PUBLIC"
    UNSUPPORTED_FILE = "UNSUPPORTED_FILE"
    HEADER_NOT_FOUND = "HEADER_NOT_FOUND"
    TOO_MANY_ROWS = "TOO_MANY_ROWS"
    VALIDATION_INCOMPLETE = "VALIDATION_INCOMPLETE"
    DAY_CAP_REACHED = "DAY_CAP_REACHED"
    SCHEMA_UNKNOWN = "SCHEMA_UNKNOWN"
    LESSON_LOCKED = "LESSON_LOCKED"
    REASON_REQUIRED = "REASON_REQUIRED"
    NOTE_REQUIRED = "NOTE_REQUIRED"
    SOURCE_REQUIRED = "SOURCE_REQUIRED"
    QUOTE_TOO_LONG = "QUOTE_TOO_LONG"
    ANCHOR_CHANGED = "ANCHOR_CHANGED"
    MODEL_UNAVAILABLE = "MODEL_UNAVAILABLE"
    BLOCKED = "BLOCKED"
    CONFIRMATION_OPEN = "CONFIRMATION_OPEN"
    SUGGESTION_PENDING = "SUGGESTION_PENDING"
    NOT_STORED = "NOT_STORED"
    STALE_PIN = "STALE_PIN"
    FOUR_EYES = "FOUR_EYES"
    RATING_REQUIRED = "RATING_REQUIRED"
    DEPENDENCY_UNAPPROVED = "DEPENDENCY_UNAPPROVED"
```

**Producer of each code** (where in code it is raised; the card says when):

| Code | Raised by |
|---|---|
| `INVALID_REQUEST` | `with_route` (Zod parse of path, query and body); services for cross-field rules (e.g. a trial without `lesson_id`) |
| `UNAUTHENTICATED` | `SessionService.require`, `with_route` (foreign `Origin` on a mutation), `CollabAuthenticator.authenticate` |
| `INVALID_CREDENTIALS` | `SessionService.sign_in` (`verify_password` false) |
| `NOT_ON_ALLOW_LIST` | `SessionService.sign_in` |
| `ROLE_FORBIDDEN` | `with_route` (`RouteSpec.roles`), `transition_roles` / `decide_transition` (via `TransitionService`), `HeartbeatService.record` (authors) |
| `INVALID_CHOICE` | `OutlineService.record_choice` |
| `NOT_RESOLVABLE` | `IssueService.record_resolution` |
| `UNDO_EXPIRED` | `IssueService.decide_standard` (undo) |
| `STALE_BASE` | `PromptService.save_guidance` (`PromptRepo.insert_guidance`) |
| `SHEET_UNREACHABLE` | `GoogleSheetsExportFetcher.fetch_export` (timeout or network failure) |
| `COLLAB_UNAVAILABLE` | `HttpCollabCommandClient` (raises `CollabUnavailable`), surfaced by `IssueService`, `SlotService`, `CandidateService`, `SuggestionService`, `TransitionService` |
| `SERVICE_BUSY` | `with_route` (on `PoolExhausted`) |
| `NOT_FOUND` | every service read by id; `CollabCommandHandler` |
| `INVALID_TRANSITION` | `decide_transition`, `decide_run_control`, `lock_and_snapshot`, `OutlineService.record_choice` (late unit change), `CandidateService.regenerate` (a candidate already in flight) |
| `SHEET_NOT_PUBLIC` | `GoogleSheetsExportFetcher.fetch_export` |
| `UNSUPPORTED_FILE` | `parse_workbook`; `OutlineService.upload` (over `OUTLINE_MAX_BYTES`, `details.reason = too_large`) |
| `HEADER_NOT_FOUND`, `TOO_MANY_ROWS` | `normalize_outline` |
| `VALIDATION_INCOMPLETE` | `generate_gate` (via `RunService.start`) |
| `DAY_CAP_REACHED` | `RunService.start`, `CandidateService.regenerate`, from a refused `SpendLedger.check_day_cap`: `details.scope` = the decision's `DayCapScope` (`user` for `day_cap`, `project` for `project_cap`), `details.remaining_usd` |
| `SCHEMA_UNKNOWN` | `assert_known_nodes` (via `LessonReadService.get_lesson`) |
| `LESSON_LOCKED` | `WriteGuard.can_write` (connect), `WriteGuard.on_update` (per message, sent as `refused` with `refused_from`), `CollabCommandHandler.apply_edit` / `lock_and_snapshot`, `CandidateService`, `SuggestionService` |
| `REASON_REQUIRED` | `IssueService.record_resolution`, `decide_transition` (reopen; reachable because the route parses `TransitionRequestInput`), `PromptService.save_guidance` |
| `NOTE_REQUIRED` | `IssueService.clear_safety_flag`, `decide_transition` (request changes) |
| `SOURCE_REQUIRED`, `QUOTE_TOO_LONG` | `SlotService.fill` |
| `ANCHOR_CHANGED` | `CollabCommandHandler.apply_edit` (`SuggestionAcceptEdit`) |
| `MODEL_UNAVAILABLE` | `SuggestionService.request` (on `ProviderError`) |
| `BLOCKED`, `CONFIRMATION_OPEN`, `SUGGESTION_PENDING` | `submit_gate` (inside `CollabCommandHandler.lock_and_snapshot`, passed through unchanged by `HttpCollabCommandClient`), `approve_gate` (inside `ApproveService`) |
| `NOT_STORED` | `CollabCommandHandler.lock_and_snapshot` |
| `RATING_REQUIRED` | `decide_transition` only (missing input, before `STALE_PIN` in CON-18's order; reachable because `TransitionRequestInput` lets a missing rating through the parse, G-11) |
| `STALE_PIN` | `ApproveService.approve` (pin compare on the locked row) |
| `FOUR_EYES`, `DEPENDENCY_UNAPPROVED` | `approve_gate` (inside `ApproveService`) |

### 10.2 Internal error types

```python
ProviderErrorKind = Literal["rate_limited", "overloaded", "server_error", "timeout", "connection", "bad_request", "auth", "refusal"]
# A failed job's reasons use FailureCheck (§2), the OpenAPI FailureReason.check enum exactly; failure_reasons_for (§6)
# is the one map from brakes, provider errors, compile errors and findings to it (G-20).

class DomainRefusal(Exception):
    code: ApiErrorCode
    message: str                         # plain words the screen may show
    details: JsonValue                   # ids and codes; request_id is added by with_route

class ProviderError(Exception):
    kind: ProviderErrorKind
    retryable: bool                      # rate_limited, overloaded, server_error, connection; NOT timeout: the provider may have
                                         # run (and billed) the call, so a retry could pay twice (CON-6; NL-33; §13 R-22)
    http_status: int | None
    retry_after_s: float | None
    provider_request_id: str | None

class IntakeError(Exception):  # packages/core/src/intake/errors.ts (NL-16; §13 R-21): the pure intake functions cannot import
    code: Literal["UNSUPPORTED_FILE", "HEADER_NOT_FOUND", "TOO_MANY_ROWS"]   # DomainRefusal's port layer; OutlineService (NL-26)
    details: JsonValue                   # re-raises it as DomainRefusal with the same code and details

class SchemaUnknownError(Exception):
    lesson_id: LessonId
    schema_version: int
    unknown_nodes: list[str]

class ModelOutputInvalid(Exception):
    model_call_id: ModelCallId
    schema_name: str
    issues: list[str]                    # Zod issue paths, never the raw text

class SpendRefused(Exception):
    refused_by: CapName
    scope: DayCapScope | None
    amount_usd: Usd

class LeaseLost(Exception):
    job_id: JobId

class PoolExhausted(Exception):
    pool: Literal["web", "collab", "worker"]
    waited_ms: int

class CollabUnavailable(Exception):
    lesson_id: LessonId
    command: Literal["lock_and_snapshot", "apply_edit", "set_mode"]

class ConfigError(Exception):
    variable: str                        # the name, never the value
    problem: str

class CompileError(Exception):  # packages/core/src/compile/compile-draft.ts (G-21)
    lesson_id: LessonId
    reason: Literal["section_not_in_template", "role_not_allowed", "unknown_node"]
    address: str | None

class InvariantViolation(Exception):
    invariant: str                       # e.g. "lesson_doc written outside LessonDocStore", "summary != sum(model_call)"
    details: JsonValue
```

How internal errors surface: `ProviderError`, `ModelOutputInvalid` and `CompileError` become a job's `FailureReason`
through `failure_reasons_for` or `MODEL_UNAVAILABLE` for AI assist; `SpendRefused` becomes run `capped` (with
`capped_by`, written by `RunFinalizer` through `RunRepo.mark_capped`) in the worker, `DAY_CAP_REACHED` at `startRun` and
`regenerateLesson`, and `MODEL_UNAVAILABLE` with `details.reason = "spend_cap"` for AI assist (CON-17 names no cap code); `SchemaUnknownError` becomes `SCHEMA_UNKNOWN`; `CollabUnavailable`
becomes `COLLAB_UNAVAILABLE` with nothing changed (the web app never falls back to writing content itself, A-1);
`PoolExhausted` becomes `SERVICE_BUSY` with `Retry-After`; `LeaseLost` stops the node and leaves the job to
`requeue_expired`; `InvariantViolation` fails the test or the completeness query that found it.

## 11. Storage of every required record (DO-6 → table → writer)

Each record DO-6's workflow registry requires is a Postgres table owned by A1 (DDL in `packages/db/migrations/`, DO-3 §6)
and written through the repo method shown.

| DO-6 record (table) | Repo and method that writes it | Workflows |
|---|---|---|
| `app_user` table | `seed_reference_data` (ops/seed.ts) | WF-37 |
| `app_session` table | `SessionRepo.create_session` | WF-1 |
| `audit_event` table | `AuditLog.append` | WF-1, 2, 3, 4, 6, 9, 11, 12, 13, 14, 19, 20, 26 |
| `outline_version` table, `outline_row` table | `OutlineRepo.insert_version` | WF-2 |
| `intake_choice` table | `OutlineRepo.upsert_choice` | WF-3 |
| `run` table | `RunRepo.insert_run`, `RunRepo.set_state` | WF-4, 6, 17, 21, 25 |
| `lesson_job` table | `JobQueue.create_run_jobs`, `JobQueue.finish` | WF-4, 5, 6, 13, 20, 22, 28 |
| `unit_plan` table | `RunRepo.store_unit_plan` | WF-5, 21 |
| `lesson` table | `LessonStateRepo.ensure_lessons`, `LessonStateRepo.set_state` | WF-7 |
| `issue` table | `IssueRepo.replace_for_hash`, `IssueRepo.resolve` | WF-7, 10, 11, 22, 23 |
| `lesson_metrics` table | `MetricsRepo.write_lesson_metrics` | WF-7, 15 |
| `lesson_version` table | `LessonVersionRepo.write_generated_version`, `LessonVersionRepo.write_snapshot` | WF-8, 13, 15, 18, 22 |
| `lesson_doc` table | `LessonDocStore.store`, `LessonDocStore.seed_initial` | WF-9, 12 |
| `check_job` table | `CheckQueue.enqueue` (inside the store transaction) | WF-9, 10 |
| `alignment_link` table | `AlignmentRepo.replace_for_hash`, `AlignmentRepo.confirm` | WF-10, 11, 18 |
| `suggestion` table | `SuggestionRepo.insert`, `SuggestionRepo.decide` | WF-14 |
| `model_call` table | `ModelCallLog.insert_sent`, `complete`, `fail`, `mark_lost` | WF-13, 14, 17, 20, 21, 22, 23, 25, 28, 32 |
| `review_event` table | `LessonStateRepo.append_review_event` | WF-15 |
| `heartbeat` table, `review_session` table | `MetricsRepo.insert_heartbeat`, `MetricsRepo.extend_session` | WF-16 |
| `export_bundle` table | `ExportRepo.insert` | WF-19 |
| `prompt_version` table | `PromptRepo.insert_guidance` (locked versions by migration) | WF-20 |
| `spend_reservation` table | `SpendLedger.reserve`, `settle`, `release`, `release_for_jobs` | WF-22, 28 |
| `judge_verdict` table | `JudgeRepo.insert_verdict` | WF-23 |
| `eval_run` table, `eval_case_result` table | `EvidenceRepo.start_eval_run`, `add_case_result`, `finish_eval_run` | WF-24, 25, 26, 27, 28, 31 |
| `probe_run` table (p95s, error rate, connection counts as `max_db_connections`, event-loop lag, lost updates, *n*, machine) | `EvidenceRepo.insert_probe_run` | WF-29, 30 |
| `experiment_run` table | `EvidenceRepo.insert_experiment_run` | WF-32, 33, 34 |
| `ops_event` table | `EvidenceRepo.ops_event` | WF-35, 36, 37, 38, 39, 40 |
| `schema_migrations` table | `run_migrations` | WF-36 |
| `standard` table | `seed_reference_data` | WF-37 |

## 12. Constructors

Summarised in DO-3 §8; the exact parameter lists are the `__init__` signatures above. Rules: every service and adapter
receives its ports through its constructor; only the composition roots (`build_web_services`, `build_worker_runtime`,
`build_collab_runtime`), the **per-area wiring files** below and the scripts' `main` functions name concrete classes;
`MODEL_PROVIDER_MODE` picks `AnthropicMessagesAdapter` or `StubModelClient` in the composition roots only (it arrives
in the wiring files as `deps.model_client`); tests construct services with fakes (`FakeTxRunner`, `FakeJobQueue`,
`FakeSpendLedger`, `FakeCollabCommands`, `StubModelClient`, `FakeClock`).

**Per-area wiring (Metz B2).** A0 creates every wiring file below as a stub in wave 0 (returning its record with the
area's services unset; in wave 0 each record field is typed by the area's **port Protocol** from `packages/core/src/ports/` (DO-4 §3–§4), never by a service class that does not exist yet, so the stubs compile before any service is built — Metz S7) and the composition root that imports them all; after wave 0 each wiring file belongs to the
area named beside it, and the composition root never changes again. A wiring file builds the concrete repositories and
adapters it needs from `deps` (repositories are stateless over the one `PgDatabase`, so two wiring files constructing
`PgLessonRepo` share nothing but the pool).

```python
class AnthropicMessagesAdapter_ctor:  # constructor record for the adapter (packages/llm/src/anthropic.ts)
    api_key: SecretStr                   # from ANTHROPIC_API_KEY via bin/with-provider-env; never logged
    model_ids: JsonValue                 # alias → model id from settings
    http_timeout_ms: int

class HttpCollabCommandClient_ctor:  # apps/web/src/server/adapters/collab-commands.ts
    base_url: str                        # COLLAB_INTERNAL_URL
    token: SecretStr                     # COLLAB_INTERNAL_TOKEN
    timeout_ms: int                      # 5000

class GoogleSheetsExportFetcher_ctor:  # apps/web/src/server/adapters/google-sheets.ts
    timeout_ms: int                      # SHEETS_FETCH_TIMEOUT_MS
    max_bytes: int                       # 5 MB

class OpenRouterJudgeAdapter_ctor:  # packages/llm/src/openrouter-judge.ts (cut #2)
    api_key: SecretStr                   # OPENROUTER_API_KEY
    model_id: str                        # MODEL_JUDGE_ID
    timeout_ms: int

class PgRepo_ctor:  # every Pg* repository, PgLessonDocReader, PgJobQueue, PgModelCallLog (PgSpendLedger and PgLessonDocStore have their own records in §3.4)
    db: PgDatabase
    ids: IdGenerator
    clock: Clock

class WebDeps:  # built once by apps/web/src/server/container.ts (A0)
    settings: WebSettings
    logger: Logger
    db: PgDatabase
    ids: IdGenerator
    clock: Clock
    model_client: ModelClient            # AnthropicMessagesAdapter or StubModelClient, chosen here only

class SessionWiring:
    sessions: SessionService
class OutlineWiring:
    outlines: OutlineService
class RunWiring:
    runs: RunService
class ReviewWiring:
    lesson_reads: LessonReadService
    issues: IssueService
    slots: SlotService
    candidates: CandidateService
    transitions: TransitionService
    approvals: ApproveService
class MetricsWiring:
    board: BoardService
    heartbeats: HeartbeatService
class AssistWiring:
    suggestions: SuggestionService | None
class PromptWiring:
    prompts: PromptService | None
class ExportWiring:
    exports: ExportService | None
class CoverageWiring:
    coverage: CoverageService | None

# wire_sessions (apps/web/src/server/wiring/sessions.ts; owner A3)
def wire_sessions(d: WebDeps) -> SessionWiring: ...
# wire_outlines (apps/web/src/server/wiring/outlines.ts; owner A4)
def wire_outlines(d: WebDeps) -> OutlineWiring: ...
# wire_runs (apps/web/src/server/wiring/runs.ts; owner A10)
def wire_runs(d: WebDeps) -> RunWiring: ...
# wire_review (apps/web/src/server/wiring/review.ts; owner A12)
def wire_review(d: WebDeps) -> ReviewWiring: ...
# wire_metrics (apps/web/src/server/wiring/metrics.ts; owner A13)
def wire_metrics(d: WebDeps) -> MetricsWiring: ...
# wire_assist (apps/web/src/server/wiring/assist.ts; owner A15)
def wire_assist(d: WebDeps) -> AssistWiring: ...
# wire_prompts (apps/web/src/server/wiring/prompts.ts; owner A16)
def wire_prompts(d: WebDeps) -> PromptWiring: ...
# wire_exports (apps/web/src/server/wiring/exports.ts; owner A17)
def wire_exports(d: WebDeps) -> ExportWiring: ...
# wire_coverage (apps/web/src/server/wiring/coverage.ts; owner A18)
def wire_coverage(d: WebDeps) -> CoverageWiring: ...

class WorkerDeps:  # built once by apps/worker/src/main.ts (A0)
    settings: WorkerSettings
    logger: Logger
    db: PgDatabase
    ids: IdGenerator
    clock: Clock
    model_client: ModelClient

class GenerationWiring:
    claim_loop: ClaimLoop
class CheckWiring:
    check_runner: CheckJobRunner
class JudgeWiring:
    judge: JudgeJob | None

# wire_generation (apps/worker/src/wiring/generation.ts; owner A9)
def wire_generation(d: WorkerDeps) -> GenerationWiring: ...
# wire_checks (apps/worker/src/wiring/checks.ts; owner A6)
def wire_checks(d: WorkerDeps) -> CheckWiring: ...
# wire_judge (apps/worker/src/wiring/judge.ts; owner A19)
def wire_judge(d: WorkerDeps) -> JudgeWiring: ...

class CollabDeps:  # built once by apps/collab/src/main.ts (A0)
    settings: CollabSettings
    logger: Logger
    db: PgDatabase
    ids: IdGenerator
    clock: Clock

class CollabServerWiring:  # the socket half (§13 R-12)
    frozen: FrozenDocs
    guard: WriteGuard
    authenticator: CollabAuthenticator
    persistence: LessonPersistence
    acks: AckBroadcaster

class CollabCommandWiring:  # the internal-command half; it reuses the server half's FrozenDocs and AckBroadcaster
    commands: CollabCommandHandler

# wire_collab_server (apps/collab/src/wiring/server.ts; A0 shell NL-07, filled by NL-80, owner A11)
def wire_collab_server(d: CollabDeps, hocuspocus: HocuspocusServerRef) -> CollabServerWiring: ...
# wire_collab_commands (apps/collab/src/wiring/commands.ts; A0 shell NL-07, filled by NL-105, owner A11)
def wire_collab_commands(d: CollabDeps, server: CollabServerWiring, hocuspocus: HocuspocusServerRef) -> CollabCommandWiring: ...
# build_collab_runtime calls wire_collab_server, then wire_collab_commands with its result; there is no wiring/collab.ts
```

## 13. Open items

1. **DO-7 *Source* column** still uses working names (`check_result`, `seeded_error`, `ai_assist_event`, `judge_label`,
   `load_test_run`). DO-3 §6.1 maps each to its canonical table; the DO-7 owner updates the column.
2. **Foreign `Origin` on a mutation** (CON-1 System support) has no named code on the card. This design returns
   `UNAUTHENTICATED`; if the UX side wants a distinct screen response, that is a `CHG-N`.
3. **Closed (spec dry run G-15):** a refused call writes no audit row (application log only), as the agreed cards say;
   DO-4 §1 and §5 follow the cards, and DO-6's *Capture verification* says the same (verified 2026-10-25).
4. **DO-5 command names** use `pnpm`; the build uses npm workspaces (FW record), so they run as `npm run <same name>`.
5. **Spike values are in.** SP-1 (model, effort, token caps, timeout, concurrency, prices, run cap), SP-2 (option A
   freeze) and SP-3 (quote span 3, name scan blocking in `cfu_item`s) replaced the `[A] → SP-N` defaults here and in
   DO-3 §7. None changed a card promise, so no `CHG-N` was needed.
6. **Proposed card clean-ups (raised for the contract owner):** (a) done — CHG-1 (2026-10-25) removed the SP-2 close-all-connections fallback from CON-12 and CON-18 (Metz C6). The rest of this item stands: (a) CON-12 and CON-18 still
   describe the SP-2 close-every-connection fallback, which SP-2 rejected; the promise is unchanged, so removing the text
   is a presentation-only `CHG`. (b) The OpenAPI `Approve` schema lists `rating` as required while CON-18 names
   `RATING_REQUIRED`; this design keeps the card's code reachable with `TransitionRequestInput` (§5) and a contract test,
   and a `CHG` could instead drop `rating` from `required` (likewise `note`, `reason`). (c) AI assist past a spend cap
   answers `MODEL_UNAVAILABLE` with `details.reason = "spend_cap"`, since CON-17 names no cap code.

### §7b resolutions (2026-10-25)

Gaps the ticket writers found while specifying `docs/plans/tickets/`, settled in one pass (to-tickets §4b) under PD-32.
No agreed card changed; no `CHG-N` was needed. Format: gap → decision (basis) → section → tickets updated.

- **R-1** disclosure scope "the flagged lesson and the next" → `CheckContext.previous_lesson_flags` (open flags of the
  previous `lesson` row of the compared outline version) (PRD R-19 as amended) → §6 → NL-39, NL-38.
- **R-2** unpractised performance-task skill → `CheckContext.unit_coverage` (`coverage_rows`); a code with role `A` in
  some lesson and role `P` in none is an `arc_repeat` finding, code `skill_unpractised`, on the lesson holding the `A`
  (PRD R-9) → §6 → NL-41, NL-38.
- **R-3** `NewSuggestion.expires_at` set by the service (CON-17's 30 min) → §3.5 → NL-43, NL-50.
- **R-4** standard-decision undo (CON-14 `undo`, `undo_of`, `UNDO_EXPIRED`, already agreed) → `StandardEdit.decision
  "undo"` + `restore`, `StandardDecisionRow`, `AuditLog.standard_decisions`, `AlignmentRepo.restore`, the undo order in
  `IssueService.decide_standard` → §3.3, §3.5, §5 → NL-45, NL-12, NL-43, NL-105.
- **R-5** marking a candidate adopted → `LessonVersionRepo.mark_adopted` (whole only; section adopts stay audit-only)
  (CON-16 `INVALID_TRANSITION` "already adopted whole") → §3.5 → NL-47, NL-42.
- **R-6** additive constructors: `LessonReadService` + `issues`, `flags`, `graph`; `SlotService` + `graph`;
  `SuggestionService` + `reader`; `ExportService` + `states` (and one `review_event` per newly exported lesson, DO-3 §6);
  `ModelCallRecorder` / `PaidCaller` + `cost: CostMath`; `ClaimLoop` + `tx`; `PgPromptRepo.sync_locked_layer`
  (repository-level, advisory-locked); `PgLessonDocReader` owned by NL-36 → §3.5, §4, §5, §6, DO-3 §2.2 → NL-44, NL-46,
  NL-50, NL-51, NL-33, NL-30, NL-34, NL-36.
- **R-7** heartbeats under 10 s apart are stored but add no time (CON-20 wins over "dropped") → §5 → NL-48.
- **R-8** `vocabulary_word_missing` is **blocking** (PRD R-19 as amended, U2) and moves to NL-20's structural group →
  — → NL-20, NL-41, NL-39.
- **R-9** `PgBoardReadRepo` stays in `repos/metrics.ts` (DO-3 §4 A13a); the file's owner NL-48 writes it, NL-42 does not
  → §3.5 → NL-42, NL-48.
- **R-10** `set_mode` failing after the commit → `set_mode(editable)` is called inside the open transaction, so its
  failure rolls back (CON-18 `COLLAB_UNAVAILABLE`, "unchanged"); a commit failure after it compensates with
  `set_mode(read_only)` → §5 `TransitionService` → NL-53.
- **R-11** coverage `source` per cell (CON-22) → `CoverageCell.source`, chosen by `coverage_rows` in one query → §3.5 →
  NL-91, NL-43.
- **R-12** collab wiring split → `wire_collab_server` (`wiring/server.ts`, NL-80) and `wire_collab_commands`
  (`wiring/commands.ts`, NL-105) → §12, DO-3 §2.5, §8 → NL-07, NL-80, NL-101.
- **R-13** plan repair → one `render_unit_plan` call with `repair_of = {draft_raw, issues}` (the draft and only what
  failed, as G-22 does for lessons), purpose `repair` → §4, §6 → NL-31, NL-14.
- **R-14** outline version for checks → the loader resolves it once (`LessonGraphRepo.source_outline_version`, else the
  unit's latest) and records it in `CheckContext.outline_version_id`; `load` keeps its arguments so callers cannot
  disagree (G-24: a run pins its outline version) → §3.5, §6 → NL-38, NL-42.
- **R-15** `reviewer_note` carrier → `NewJob` / `ClaimedJob.reviewer_note`, column `lesson_job.reviewer_note` → §3.4,
  DO-3 §6 → NL-29, NL-28, NL-47.
- **R-16** `model_call.retries` added to DO-3 §6 → NL-33 (DDL with NL-08's `0005_traces.sql`) → NL-33, NL-08.
- **R-17** `RouteSpec.public` (signIn has no session; the Origin check still runs) → §5 → NL-13.
- **R-18** `StandardsIndex.resolve(code, sheet_label = None)` for the ELD label verdict → §8 → NL-15.
- **R-19** `PromptBlock` has one owner, `ports/model-client.ts` (NL-12); NL-14's local copy is replaced by an import in
  NL-32 → §3.1 → NL-14, NL-32.
- **R-20** editor nodes `teacher_tip`, `quote_placeholder`, `excerpt_slot` confirmed (HP-2, HP-9) → §8, DO-3 §2.1 → NL-10
  (unchanged).
- **R-21** layout facts recorded: 31 port files, `deps-types.ts` re-pointed by NL-12, NL-09's intake records,
  `IntakeError` → `DomainRefusal` in NL-26, wiring names → §10.2, DO-3 *Addenda* → NL-16 (unchanged).
- **R-22** a provider `timeout` is not retried (CON-6: never pay twice) → §10.2 `ProviderError.retryable` → NL-33.
