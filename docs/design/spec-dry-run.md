# Spec Dry Run — Newsela Lesson Studio

Template: `zero-to-hero` v1.14.1 `templates/SPEC-DRY-RUN.md`. Filed at `docs/design/spec-dry-run.md`.
Stage: §6 Design, before the gate (`ARTIFACT-MAP.md` §6).

**What this is.** Before §6 closes, one agent tries to write the acceptance criteria for three
representative tickets **from the design alone**, the way a §7 spec writer will. Every criterion it
cannot write testably is a design gap: a missing signature, an untyped result, a service nobody says
how to build, an error the UI expects that no backend type produces. Each gap is closed in DO-3 or
DO-4 now, while it is cheap, and marked closed here. Why: on AEA (2026-10-21) the §6 gate passed and
the 7b spec writers then raised ~170 needs-decision items, mostly exactly these gaps.

Run it after `signature_check.py` exits 0; the script finds the mechanical gaps, this finds the rest
(constructors, settings fields, behaviour nobody wrote down).

---

## Part 1 — The brief given to the agent

> You are writing the acceptance criteria for three tickets, as a §7 spec writer would, using only
> the project's design documents. You may not invent a type, a field, an error, a constructor or a
> setting the design does not state. When you cannot write a criterion testably, do not guess: put it
> on the *Could not write* list with the exact missing fact.
>
> **The three tickets** (one of each kind; the project has no graph, so the third is its nearest
> equivalent, a worker job step):
> 1. **Service:** the spend reservation service, `SpendLedger` / `PgSpendLedger` with the pure
>    `packages/core/src/spend/reservation.ts` (reserve-then-settle; per-run cap PD-14; the $75 build
>    total PD-29; HP-7) — DO-3 §2.1, §2.2, §3; DO-4 §3.4, §8 *spend*
> 2. **Route:** `POST /lessons/{lessonId}/transitions` (`transitionLesson`), action `approve` with the
>    pinned hash and state vector (409 `STALE_PIN`), plus the Submit freeze — its CON card: CON-18
> 3. **Graph node (nearest equivalent):** the lesson-draft job step in the generation worker — claim a
>    `lesson_job` with `SKIP LOCKED` and a lease, one structured `LessonDraft` call, compile, checks,
>    one repair, store or `generation_failed` — DO-4 §6 `LessonJobRunner` and its nodes; HP-1, HP-7
>
> **Read these sources, and nothing else:**
> - DO-3 code design — `docs/design/code-design.md`
> - DO-4 component contracts — `docs/design/component-contracts.md`
> - DO-6 observability contract — `docs/design/observability.md`
> - DO-5 evaluation plan — `docs/design/eval-plan.md`; DO-7 metrics registry — `docs/design/metrics-registry.md`
> - Shared interface spec — `docs/contracts/INTERFACE.md` and `docs/contracts/interface.openapi.yaml`
> - (Worked pairs, user stories and the hard-problem register were **not** in this run's permitted set; the
>   worked-pair facts used below are the ones DO-5 quotes.)
>
> **Output, for each ticket:** sources, story, example pair, acceptance criteria (given / when / then
> with the exact type, field and value, the verification method and the evidence), and the *Could not
> write* list with the missing fact and where it should live.

---

## Part 2 — The filed result

| Field | Value |
|---|---|
| Run date | 2026-10-25 |
| Agent / model | `general-purpose` agent, Opus 5.5 (`claude-opus-5-5`) |
| `signature_check.py` result before the run | `Result: signatures complete (name-based; a reviewer still judges fields)`, 2026-10-25 |
| Design versions read | DO-3 and DO-4 at commit `952ec72` (2026-10-25); DO-6 working copy (modified, uncommitted) on 2026-10-25; OpenAPI 1.0.0 at `f680273`; INTERFACE.md at `f680273` |

Each criterion's format: **Given / when / then** · *Verify:* the named test or command · *Evidence:* what the
reviewer sees. Test names are proposed by the spec writer; paths follow DO-3 §2.

### T1 — Service: spend reservation (`SpendLedger` / `PgSpendLedger`, `core/spend/reservation.ts`)

Sources used: DO-3 §2.1 (`reservation.ts`), §2.2 (`repos/spend.ts`), §3 (`SpendLedger` row), §5 (*Spend math pure,
ledger in SQL*), §6 (`spend_reservation`), §7 (`BUILD_SPEND_CEILING_USD`, `COST_PER_LESSON_ESTIMATE_USD`,
`RUN_CAP_MULTIPLIER`, `USER_DAY_CAP_MULTIPLIER`); DO-4 §2 (`Usd`, `ModelPrice`, `TokenUsage`), §3.4 (`ReservationRequest`,
`SpendSnapshot`, `ReservationDecision`, `SettledReservation`, `RunSpend`, `SpendLedger`), §8 *spend*, §10.2
(`SpendRefused`), §11 (`spend_reservation` row); INTERFACE CON-5 *Guarantees* and *Recovery* (UTC day), CON-6
(`spent_usd + reserved_usd ≤ cap_usd`); DO-5 S6; DO-7 M-17, M-28, M-29; DO-6 WF-22, WF-28.
Story: US-6, US-10, US-36 (from CON-5's *Needed by*; story text not read)    Example pair: none applies (no model output); DO-5 S6 cap test

Acceptance criteria:
- AC-1 Given `SpendSnapshot{run_cap_usd: 10.00, run_settled_usd: 6.00, run_reserved_usd: 3.00, user_day_*` and `build_*` far
  below their caps`}`, when `decide_reservation(snapshot, Decimal("1.00"))`, then `ReservationDecision.allowed == true` and
  `refused_by == null` (the cap is inclusive: CON-6 `spent + reserved ≤ cap`). · *Verify:* `packages/core/src/spend/reservation.test.ts::allows_at_exact_run_cap` · *Evidence:* passing Vitest case.
- AC-2 Same snapshot, when `decide_reservation(snapshot, Decimal("1.000001"))`, then `allowed == false`,
  `refused_by == "run_cap"`, `reservation_id == null`, and `snapshot` is returned unchanged. · *Verify:* `reservation.test.ts::refuses_one_micro_dollar_over_run_cap` · *Evidence:* passing case.
- AC-3 Given `run_cap_usd == null` (AI assist, `ReservationRequest.run_id == null`) and day and build headroom, when
  `decide_reservation` is called with an amount larger than any run cap, then `allowed == true` (only day and build caps
  apply, DO-4 §3.4). · *Verify:* `reservation.test.ts::assist_ignores_run_cap` · *Evidence:* passing case.
- AC-4 Given `build_ceiling_usd: 75.00, build_settled_usd: 74.50, build_reserved_usd: 0` and run and day headroom, when
  `decide_reservation(snapshot, Decimal("0.60"))`, then `allowed == false`, `refused_by == "build_cap"`. ·
  *Verify:* `reservation.test.ts::refuses_past_build_ceiling` · *Evidence:* passing case.
- AC-5 When `run_cap_for(Decimal("0.50"), 47, Decimal("1.5"))`, then the result `== Decimal("35.25")` (PD-14:
  measured cost × 47 × 1.5; defaults from DO-3 §7). · *Verify:* `reservation.test.ts::run_cap_formula` · *Evidence:* passing case.
- AC-6 Given `ModelPrice{input_per_mtok: 3, output_per_mtok: 15, cache_read_per_mtok: 0.30}` and `TokenUsage{input_tokens:
  1000, output_tokens: 2000, cache_read_tokens: 0, cache_write_tokens: 0}`, when `settle_cost(price, usage)`, then the
  result `== Decimal("0.033")` and its type is `Decimal`, never a float (DO-4 §2 `Usd`). · *Verify:* `reservation.test.ts::settle_cost_no_cache` · *Evidence:* passing case.
- AC-7 Given an empty ledger and a run with `cap_usd 10.00`, when `PgSpendLedger.reserve(ReservationRequest{run_id, user_id,
  purpose: "lesson_draft", amount_usd: 1.00})`, then `allowed == true`, `reservation_id` matches `^sr_`, and exactly one
  `spend_reservation` row exists with that `id`, `run_id`, `user_id`, `reserved_usd = 1.000000`. · *Verify:* `packages/db/src/repos/spend.int.test.ts::reserve_inserts_one_row` (Postgres 16 test container) · *Evidence:* row read back by SQL.
- AC-8 Given a run whose cap is already reached, when `reserve` is refused, then `spend_reservation` row count is unchanged
  and the decision carries the snapshot (INTERFACE shared guarantee 2). · *Verify:* `spend.int.test.ts::refusal_writes_nothing` · *Evidence:* count before == count after.
- AC-9 Given a run with `cap_usd 10.00` and no spend, when 20 `reserve` calls of `1.00` each run concurrently
  (`Promise.all`), then exactly 10 return `allowed == true`, and `sum(reserved_usd) == 10.00` (advisory lock `spend`, DO-4
  §3.4). · *Verify:* `spend.int.test.ts::concurrent_reserves_never_pass_cap` · *Evidence:* 10 allowed, 10 refused with `refused_by "run_cap"`.
- AC-10 Given an allowed reservation of `1.00`, when `settle(reservation_id, Decimal("0.42"), model_call_id)`, then
  `SettledReservation{reserved_usd: 1.00, settled_usd: 0.42, released_usd: 0.58}` and `run_totals(run_id)` shows
  `settled_usd` up by 0.42 and `reserved_usd` down by 1.00. · *Verify:* `spend.int.test.ts::settle_releases_remainder` · *Evidence:* returned record and `RunSpend` before/after.
- AC-11 Given an allowed reservation of `1.00`, when `release(reservation_id)`, then `settled_usd == 0`,
  `released_usd == 1.00`, and `run_totals.reserved_usd` drops by 1.00. · *Verify:* `spend.int.test.ts::release_returns_full_amount` · *Evidence:* returned record.
- AC-12 When `check_day_cap(user_id, amount)` is called (allowed or refused), then no `spend_reservation` row is written
  and `reservation_id == null` (DO-4: "dry run, writes nothing"). · *Verify:* `spend.int.test.ts::check_day_cap_is_dry_run` · *Evidence:* row count unchanged.
- AC-13 Given `FakeClock` at `2026-10-25T23:59:59Z` then `2026-10-26T00:00:01Z`, when one reservation is made at each time,
  then their `day` columns are `2026-10-25` and `2026-10-26` (UTC calendar day, CON-5 *Recovery* [A]). · *Verify:* `spend.int.test.ts::day_is_utc_calendar_day` · *Evidence:* two rows, two days.
- AC-14 Given the stubbed cap test of the fault script, when `npm run eval:faults` runs, then for the capped run
  `sum(settled_usd) + sum(reserved_usd) ≤ run.cap_usd`, `run.state == "capped"`, and the report shows "0 cap overshoot"
  (DO-5 S6, DO-7 M-44, DO-6 WF-28 `test_fault_script_records`). · *Verify:* `npm run eval:faults` · *Evidence:* `evals/reports/faults-<git-sha>.md` and the `eval_case_result` row.

Could not write:
- "PgSpendLedger refuses past `BUILD_SPEND_CEILING_USD` and the user day cap read from settings" — missing fact:
  `PgSpendLedger` is built by `PgRepo_ctor{db, ids, clock}` (DO-4 §12), which carries no settings, yet DO-3 §7 names it the
  consumer of `BUILD_SPEND_CEILING_USD` and `USER_DAY_CAP_MULTIPLIER` — where it should live: DO-4 §12 (a `PgSpendLedger`
  constructor record) and DO-3 §8.
- "The user day cap equals N" — missing fact: `USER_DAY_CAP_MULTIPLIER = 2 [A]` multiplies an unnamed base; no function or
  formula yields `SpendSnapshot.user_day_cap_usd` — where it should live: DO-4 §8 *spend* (a `user_day_cap_for` or the
  formula) and DO-3 §7.
- "A project day cap refuses with `DAY_CAP_REACHED`, `details.scope = <value>`" — missing fact: CON-5's System review and
  the error catalog promise a per-user **and per-project** day cap; `check_day_cap(user_id, amount)` has no project scope,
  `SpendSnapshot` has no project-day fields, no setting holds the value, and the `details.scope` values are not typed —
  where it should live: DO-4 §3.4 (`SpendSnapshot`, `check_day_cap`, a `DayCapScope` literal) and DO-3 §7.
- "A build-cap refusal shows `capped_by: project_cap` on CON-6" — missing fact: DO-4 uses `"build_cap"`
  (`ReservationDecision.refused_by`, `RunRow.capped_by`, `SpendRefused`), the OpenAPI/CON-6 uses `"project_cap"`; no mapping
  is stated — where it should live: DO-4 §3.4 and §3.5 (one name, or the mapping in `RunService.progress`).
- "The build total includes every model call since the project began" — missing fact: DO-7 M-29 sums `model_call.cost_usd`
  including imported spike calls (WF-32), but `SpendSnapshot.build_settled_usd` is not said to come from `model_call` or from
  `spend_reservation` (spike imports and the judge never write the latter) — where it should live: DO-4 §3.4 (`reserve`'s
  comment: which rows the build sums read).
- "`settle_cost` prices cache writes; `max_call_cost` returns an exact value rounded to 6 dp" — missing fact: `ModelPrice`
  has no `cache_write_per_mtok` although `TokenUsage.cache_write_tokens` exists and prompts set `cache_control` (GP-33);
  neither formula nor the rounding mode to `numeric(12,6)` is written; nor which cap `refused_by` names when two caps
  refuse at once — where it should live: DO-4 §2 (`ModelPrice`) and §8 *spend*.
- "Settling more than was reserved is <refused | clamped | recorded as overshoot>" — missing fact: `settle` behaviour
  when `actual_usd > reserved_usd` (an input-token estimate that ran low) and the meaning of `released_usd` then; DO-5 S6
  demands "0 cap overshoot" — where it should live: DO-4 §3.4 (`settle`).
- "A second `settle` or a `release` after `settle` is <no-op | error>; the row's status moves reserved → settled |
  released" — missing fact: `spend_reservation.status` values and transitions are untyped (no row type, no `Literal`), and
  idempotency of `settle`/`release` is unstated — where it should live: DO-4 §3.4 (a `SpendReservationRow` and status literal).
- "After a worker kill, the lost job's reservation is released (or settled) by <component>" — missing fact: no method
  releases `reserved` rows whose job lease expired (`JobQueue.requeue_expired` returns `RequeueReport` with no release
  count; `SpendLedger` has no `release_for_job`); left alone they hold the cap forever — where it should live: DO-4 §3.4
  (`JobQueue.requeue_expired` / `SpendLedger`).
- "A refused reservation sets `run.state = capped` and `run.capped_by = <cap>`" — missing fact: DO-4 §6 says
  `ReserveNode` "refused → run capped", but `ReserveNode`'s constructor has no `RunRepo`, and `RunRepo.set_state` takes no
  `capped_by` — where it should live: DO-4 §6 (`ReserveNode.__init__`) and §3.5 (`RunRepo.set_state` or a `mark_capped`).

### T2 — Route: `POST /lessons/{lessonId}/transitions` (`transitionLesson`), approve and the Submit freeze

Sources used: INTERFACE CON-18 (fields, named errors, precedence, guarantees, timing), shared definitions (lesson states,
error envelope, shared guarantees 2, 3, 11); OpenAPI `transitionLesson`, `TransitionRequest`/`Approve`/`Submit`,
`TransitionResult`, `VersionRef`; DO-3 §2.3 (`transition-service.ts`, `with-route.ts`, `collab-commands.ts`), §2.5
(`lock-and-snapshot.ts`), §6 (`review_event`, `lesson_version`, `lesson_metrics`, `audit_log_v`), §7 (`FOUR_EYES_ENABLED`,
`APP_ORIGIN`); DO-4 §1 (CON-18 row), §3.3 (`CollabCommands`, `SubmitCommand`, `SnapshotResult`), §3.5 (`LessonRepo`,
`LessonVersionRow`, `DependencyState`, `IssueRow`), §5 (`with_route`, `TransitionService`, `MetricsWriter`), §8 *checks*
(`GateState`, `approve_gate`, `GateDecision`) and *lifecycle* (`decide_transition`), §10; DO-6 WF-15, WF-9, *Capture
verification*; DO-5 approval-integrity row (HP-5).
Story: US-24…US-28, US-31 (from CON-18's *Needed by*; story text not read)    Example pair: OpenAPI example `approveLesson5` / `lesson5Approved` (Lesson 5)

Acceptance criteria:
- AC-1 Given a `submitted` lesson and a signed-in **reviewer**, when `POST /lessons/G6.U4.L5/transitions` with a valid
  `Approve` body, then 403 `{error.code: "ROLE_FORBIDDEN"}` and `lesson_version`, `review_event`, `lesson_metrics` row counts
  are unchanged. · *Verify:* `apps/web/app/api/lessons/[lessonId]/transitions/route.test.ts::approve_by_reviewer_forbidden` · *Evidence:* response body and row counts.
- AC-2 Given an approver, when the lesson id does not exist, then 404 `NOT_FOUND`. · *Verify:* `route.test.ts::approve_unknown_lesson` · *Evidence:* response body.
- AC-3 Given an approver and a lesson in `in_review`, when approve is posted, then 409 `INVALID_TRANSITION`; and given a lesson
  already `approved`, a second approver's approve also returns 409 `INVALID_TRANSITION` (CON-18). · *Verify:* `route.test.ts::approve_wrong_state` · *Evidence:* two responses.
- AC-4 Given a `submitted` lesson whose latest snapshot (`LessonRepo.latest_snapshot`, `kind "submit"`) has `content_hash H`,
  when approve is posted with `snapshot_hash ≠ H`, then 409 `STALE_PIN`, `details.request_id` present, and no row written
  (`lesson.state` still `submitted`). · *Verify:* `route.test.ts::stale_hash_refused` · *Evidence:* response and unchanged rows.
- AC-5 Same, with `snapshot_hash == H` but `snapshot_state_vector` ≠ the snapshot's `state_vector`, then 409 `STALE_PIN`. · *Verify:* `route.test.ts::stale_state_vector_refused` · *Evidence:* response.
- AC-6 Given `FOUR_EYES_ENABLED = true` and `lesson.last_editor_id == approver.user_id`, when approve is posted with a
  matching pin, then 422 `FOUR_EYES`; with `FOUR_EYES_ENABLED = false` the same call is not refused for this reason. · *Verify:* `route.test.ts::four_eyes_toggle` · *Evidence:* two responses.
- AC-7 Given both a stale pin and a four-eyes breach, when approve is posted, then the code is `STALE_PIN` (CON-18 precedence). · *Verify:* `route.test.ts::precedence_stale_pin_before_four_eyes` · *Evidence:* response.
- AC-8 Given a pending suggestion on the lesson (`SuggestionRepo.pending_for` non-empty), when approve is posted with a
  matching pin, then 422 `SUGGESTION_PENDING`. · *Verify:* `route.test.ts::pending_suggestion_blocks_approve` · *Evidence:* response.
- AC-9 Given one open blocking finding and one open confirmation on the snapshot, when approve is posted, then 422 `BLOCKED`
  and `details.issues` lists both (kinds `blocking` and `confirmation`). · *Verify:* `route.test.ts::blocked_lists_confirmations` · *Evidence:* response body.
- AC-10 Given a linked source lesson whose slot is filled but which is not `approved`, when approve is posted, then 422
  `DEPENDENCY_UNAPPROVED` with `details` naming the source lesson id. · *Verify:* `route.test.ts::dependency_unapproved` · *Evidence:* response body.
- AC-11 Given a clean `submitted` lesson, a matching pin, `rating: "usable_with_edits"` and a different approver than the
  last editor, when approve is posted, then 200 `TransitionResult{from_state: "submitted", to_state: "approved",
  metrics_row_written: true}`, `version.content_hash == snapshot_hash`, one new `lesson_version` with `kind "approve"`, one
  new `review_event` (`from_state submitted`, `to_state approved`, `content_hash H`), `lesson.state == "approved"`, and one
  `lesson_metrics` row with `draft_rating = "usable_with_edits"` and `version_id = version.version_id`. · *Verify:* DO-6 WF-15 `test_transition_capture` (drives the Next.js handler) · *Evidence:* response and the four rows.
- AC-12 In AC-11, `audit_id` equals the new `review_event.id` and no `audit_event` row is written for the move (DO-3 §6:
  "lesson moves go to `review_event` only"). · *Verify:* `test_transition_capture` · *Evidence:* id equality; `audit_event` count unchanged.
- AC-13 In AC-11, with a linked source lesson approved at hash `S`, `dependency_record == [{lesson_id: <source>,
  approved_hash: S}]` in the response and on the stored version. · *Verify:* `route.test.ts::dependency_record_written` · *Evidence:* response and `lesson_version.dependency_record_json`.
- AC-14 Given a lesson approved once, reopened, re-submitted and approved again, when the second approve succeeds, then
  `metrics_row_written == false` and the one `lesson_metrics` row is byte-identical to the first. · *Verify:* `route.test.ts::second_approval_keeps_frozen_row` · *Evidence:* row before/after.
- AC-15 When approve succeeds, `FakeCollabCommands` records zero calls; when submit succeeds, it records exactly one
  `lock_and_snapshot(SubmitCommand{lesson_id, actor, client_state_vector: <request value>, request_id})`. · *Verify:* `transition-service.test.ts::approve_has_no_collab_hop` · *Evidence:* fake's call log.
- AC-16 Given submit on an `in_review` lesson and `FakeCollabCommands` raising `CollabUnavailable`, when posted, then 503
  `COLLAB_UNAVAILABLE`, `lesson.state` unchanged, no `lesson_version`. · *Verify:* `transition-service.test.ts::submit_collab_down` · *Evidence:* response and rows.
- AC-17 Given a real collaboration server and an editor whose last edit is not yet stored, when submit is posted with that
  editor's `client_state_vector`, then 409 `NOT_STORED` and the lesson stays editable; given every edit stored, submit
  returns 200 with `to_state "submitted"` and a `kind "submit"` version. · *Verify:* `apps/collab` integration test `lock_and_snapshot.int.test.ts` (SP-2 assertion) · *Evidence:* both responses.
- AC-18 After a successful submit, a socket write to the lesson is refused `LESSON_LOCKED` and `lesson_doc` gains no row. · *Verify:* DO-6 WF-9 `test_store_capture` · *Evidence:* refusal message; `lesson_doc` count.
- AC-19 Given a mutation with a foreign `Origin` header, when posted, then 401 `UNAUTHENTICATED` (DO-4 §13 item 2) and no row written. · *Verify:* `route.test.ts::foreign_origin_refused` · *Evidence:* response.

Could not write:
- "Approve without `rating` returns 422 `RATING_REQUIRED`, ranked before `STALE_PIN`" — missing fact: the OpenAPI
  `Approve` schema lists `rating` in `required`, and `with_route` runs the Zod parse first, so a missing rating returns 400
  `INVALID_REQUEST` and `RATING_REQUIRED` is unreachable; DO-4 §10.1 also names both `TransitionService` and `approve_gate`
  as its producer, while `approve_gate` runs after the pin compare — where it should live: DO-4 §5 (`with_route` /
  `TransitionService`: which schema the route parses and who raises `RATING_REQUIRED`) and §10.1; a `CHG-N` if the card or
  the schema changes.
- "Approve re-runs the blocking checks on the snapshot through `CheckContextLoader`" — missing fact:
  `TransitionService.__init__` (DO-4 §5) has no `CheckContextLoader`, `CheckPolicy` or rule list, and none of the
  `StandardRepo` / `SafetyFlagRepo` the loader needs, although DO-3 §2.3 says it depends on `CheckContextLoader` and DO-3 §8
  builds one — where it should live: DO-4 §5 (`TransitionService.__init__`) and DO-3 §8.
- "`run_checks` is called with the registered rule set" — missing fact: `run_checks(ctx, rules, policy)` needs a
  `Sequence[CheckRule]`, but no constant or factory names the registered list — where it should live: DO-4 §8 *checks*
  (e.g. a `CHECK_RULES` constant in `registry.ts`).
- "A blocking finding the reviewer already resolved does not block Approve" — missing fact: the re-run yields
  `CheckFinding`s, while `GateState.issues` is `list[IssueRow]` with resolution state; how a resolution recorded on the
  submit hash carries to the re-run's findings without a write (`IssueRepo.replace_for_hash` writes), and what
  `GateState.pending_check` means for a frozen snapshot and which code it returns — where it should live: DO-4 §8 *checks*
  (`GateState` assembly for approve) and §5.
- "The refused stale-pin approve in `test_transition_capture` writes <nothing | only its audit event>" — missing fact:
  DO-6 *Capture verification* says each refused call "wrote only its audit event"; INTERFACE shared guarantee 2 and DO-4
  say a refusal writes no audit row (DO-4 §13 item 3, still open) — where it should live: DO-6 *Capture verification*.
- "A collaboration refusal (`NOT_STORED`, `BLOCKED` with `details.issues`) reaches the browser with the same code, status
  and details" — missing fact: how `HttpCollabCommandClient` turns the collab `Error` envelope into a web refusal (re-raised
  as `DomainRefusal` with the same `code` and `details`? the web `request_id` kept?) — where it should live: DO-4 §3.3.

### T3 — Graph node (nearest equivalent): the lesson-draft job step (`ClaimLoop` → `LessonJobRunner` and its nodes)

The project has no orchestration graph; the generation worker's fixed node sequence (DO-4 §6) is its nearest equivalent.

Sources used: DO-3 §2.4 (worker modules), §3 (`JobQueue`, `SpendLedger`, `ModelClient`, `LessonDocStore`), §6
(`lesson_job`, `model_call`, `lesson_version`, `lesson_doc`), §7 (`JOB_LEASE_MS`, `JOB_WALL_CLOCK_MS`,
`DRAFT_OUTPUT_TOKEN_CAP`, `TRUNCATION_RETRY_TOKEN_CAP`, `MAX_ACTIVE_RUNS`, `CIRCUIT_BREAKER_SAME_CHECK`), §8; DO-4 §3.1
(`StructuredCallRequest`, `ModelResponse`), §3.4 (`ClaimedJob`, `JobOutcome`, `JobQueue`, `ModelCallLog`,
`LessonDocStore`), §3.5 (`LessonRepo`, `NewGeneratedVersion`, `ProvenanceRecord`, `SafetyFlagRepo`, `OutlineRepo.row_context`),
§4 (`ModelCallRecorder`, `DraftPromptInput`, `RepairPromptInput`), §6 (all), §8 *compile*, *checks*, *lifecycle*
(`should_pause_run`), §10.2; OpenAPI `FailureReason`, `TileState`; INTERFACE CON-6 guarantees; DO-6 WF-22, WF-28,
*Missing instrumentation*; DO-5 S3, S6, FC-2; DO-7 M-15, M-44.
Story: US-7, US-8 (CON-6's *Needed by*; story text not read)    Example pair: WP-1 as DO-5 quotes it — outline row 8,
Lesson 4 (Core Reading), 2 placeholders, a 3-minute Look Back repaired once

Acceptance criteria:
- AC-1 Given one `queued` lesson job in a run with `plan_stored_at` set, when two workers call
  `PgJobQueue.claim(worker_id, 3, 120000)` concurrently, then exactly one returns a `ClaimedJob` and the other `null`; the
  row is `status "running"` with `lease_until == now + 120000 ms` (`FakeClock`). · *Verify:* `packages/db/src/repos/job-queue.int.test.ts::skip_locked_single_claim` · *Evidence:* two results; row read back.
- AC-2 Given a lesson job whose run has `plan_stored_at == null`, when `claim` is called, then `null`; after
  `RunRepo.store_unit_plan`, the same call returns the job (R-8). · *Verify:* `job-queue.int.test.ts::lesson_jobs_wait_for_plan` · *Evidence:* two results.
- AC-3 Given active run A with 2 running jobs and run B with 0, when `claim` is called, then the job comes from run B; given
  four active runs and `max_active_runs = 3`, the fourth run's jobs are never claimed. · *Verify:* `job-queue.int.test.ts::fair_share_and_active_run_cap` · *Evidence:* claimed `run_id`s.
- AC-4 Given a running job with `lease_until` in the past and one `model_call` of `status "sent"`, when
  `requeue_expired(now)`, then the job is `queued`, `RequeueReport{requeued: 1, lost_calls_marked: 1}`, and that call is
  `status "lost"`. · *Verify:* `job-queue.int.test.ts::expired_lease_requeues_and_marks_lost` · *Evidence:* report and rows.
- AC-5 Given a job whose lease was taken over, when `renew_lease` returns `false`, then the runner stops with `LeaseLost`
  and writes no `lesson_version`. · *Verify:* `apps/worker/src/generation/lesson-job-runner.test.ts::lease_lost_stops_node` · *Evidence:* no version row.
- AC-6 Given `StubModelClient` scripted with a valid `LessonDraft` for WP-1, when the claim loop runs the job, then exactly
  one `model_call` row has `purpose "lesson_draft"`, `alias "GENERATION"`, `status "completed"`, non-empty
  `rendered_prompt`, `raw_output` equal to the stub text, `served_model` equal to the stub response's `served_model`; and
  the row existed with `status "sent"` when the stub's `complete` was entered. · *Verify:* DO-6 WF-22 `test_lesson_job_capture` (drives the worker claim loop) · *Evidence:* row; stub's in-call assertion.
- AC-7 Given the stub returns `stop_reason "max_tokens"` on the first call, when the job runs, then a second call has
  `purpose "truncation_retry"` and `max_output_tokens == 24000` (`TRUNCATION_RETRY_TOKEN_CAP`), and the job ends with
  `truncation_retries == 1`, `repairs == 0` (CON-6: not counted as the repair). · *Verify:* `lesson-job-runner.test.ts::truncation_retry_raises_cap` · *Evidence:* two call rows; job counters.
- AC-8 Given the stub truncates twice, then the lesson is `generation_failed` and the job's `failure_reasons` contain
  `{check: "truncated"}`; no third draft call is made. · *Verify:* `lesson-job-runner.test.ts::truncated_twice_fails` · *Evidence:* job row and call count.
- AC-9 Given WP-1 with a stub draft whose Look Back section is 3 minutes, when the job runs, then exactly one call has
  `purpose "repair"` and `alias "REPAIR"`; with a repaired draft that passes, the job ends `status "ready"`,
  `tile_state "ready"`, `repairs == 1`, one `lesson_version` of `kind "generated"`, `lesson.state == "draft"`, and one
  `lesson_doc` row with `seq 1`. · *Verify:* DO-5 S3 (`npm run eval:golden -- --suite drafts`) on the stub, and `lesson-job-runner.test.ts::one_repair_then_store` · *Evidence:* rows; S3 case result.
- AC-10 Given the repaired draft still fails `minutes_out_of_range`, then no second repair call exists,
  `lesson.state == "generation_failed"`, and `failure_reasons` contains `{check: "check_failed", check_kind:
  "minutes_out_of_range"}` (OpenAPI `FailureReason`). · *Verify:* `lesson-job-runner.test.ts::still_failing_after_one_repair` · *Evidence:* job row; repair-call count 1.
- AC-11 Given the worker is killed after the draft's raw output is stored and the job is re-queued and re-claimed, then no
  new `lesson_draft` call is sent (the checkpoint is used), and the job still ends terminal. · *Verify:* DO-5 S6 kill test (`npm run eval:faults`) · *Evidence:* faults report "0 re-paid calls"; one `lesson_draft` call row for the lesson.
- AC-12 Given `StoreNode` runs twice for the same job (same `idempotency_key`), then one `lesson_version` and one
  `lesson_doc` row exist for the lesson. · *Verify:* `apps/worker/src/generation/nodes/store-node.int.test.ts::store_is_idempotent` · *Evidence:* counts; DO-5 S6 "0 duplicate `lesson_version` rows".
- AC-13 Given the stored v1, then `lesson_version.provenance_json.run_id == job.run_id`, `model_call_ids` holds the draft
  and repair call ids, and `cost_usd == sum(model_call.cost_usd)` for the job. · *Verify:* `test_lesson_job_capture` · *Evidence:* provenance JSON vs call rows.
- AC-14 Given `FakeClock` advanced past `JOB_WALL_CLOCK_MS` (600000) before the compile-and-check node, then
  `brakes_fired` contains `"job_wall_clock"` and no further model call is made. · *Verify:* `lesson-job-runner.test.ts::wall_clock_brake` · *Evidence:* job row; call count.
- AC-15 Given `queue.is_cancelled(job_id)` turns true after the draft node, then the job ends `status "cancelled"` with no
  further call and no `lesson_version`. · *Verify:* `lesson-job-runner.test.ts::cancel_between_nodes` · *Evidence:* job row.
- AC-16 Given `FakeSpendLedger` refuses with `refused_by "run_cap"`, then no `model_call` row is written for the job,
  `brakes_fired` contains `"spend_run_cap"`, and the tile shows `failure_reasons` `{check: "capped"}`. · *Verify:* `lesson-job-runner.test.ts::reservation_refused_makes_no_call` · *Evidence:* zero call rows; job row.
- AC-17 Given three consecutive terminal jobs in a run failing the same check kind, when `RunFinalizer.after_job` runs,
  then `run.state == "paused"` and `paused_check` equals that kind (`CIRCUIT_BREAKER_SAME_CHECK = 3`). · *Verify:* `apps/worker/src/generation/run-finalizer.test.ts::circuit_breaker_pauses` · *Evidence:* run row.
- AC-18 Given a seeded provider-key marker in the environment, when WF-22's capture test runs, then the marker appears in no
  table row and no log line. · *Verify:* `test_lesson_job_capture` · *Evidence:* the scan's zero-match output.

Could not write:
- "The truncation retry and the repair each reserve before their call, and settlement covers every call" — missing fact:
  `LessonJobState` holds one `reservation_id`; `DraftNode`'s constructor has no `SpendLedger` or `PriceTable`, so the retry at
  24000 output tokens (above the 16000 reserved) has no reservation; `SettleNode` → `settle(reservation_id, actual_usd,
  model_call_id)` takes one call id though a job may make three calls — where it should live: DO-4 §6 (`LessonJobState`,
  `DraftNode.__init__`, `SettleNode`).
- "`ReserveNode` reserves `max_call_cost(price, input_tokens_estimate, DRAFT_OUTPUT_TOKEN_CAP)`" — missing fact: the
  input-token estimate comes from `RenderedPrompt`, but `ReserveNode` runs before `DraftNode` renders and has no
  `PromptRenderer` — where it should live: DO-4 §6 (`ReserveNode`, or the node order).
- "After a kill, the checkpoint lookup finds the stored output" — missing fact: `checkpoint(job_id, purpose, attempt)`
  keys on `attempt`, but whether that is `ClaimedJob.attempt` (and whether `requeue_expired` increments it) or the call's
  own ordinal is unstated; if the job attempt increments, the lookup misses and the call is paid again — where it should
  live: DO-4 §3.4 (`ClaimedJob.attempt`, `ModelCallLog.completed_for`) and §4.
- "Each failure ends with the right `FailureReason.check`" — missing fact: DO-4 §10.2 `GenerationFailureCheck`
  (`provider_unavailable`, `checks_failed`, `spend_capped`, no `compile_error`) disagrees with the OpenAPI
  `FailureReason.check` (`provider_error`, `check_failed`, `capped`, `compile_error`), and no table maps a `BrakeName`
  (e.g. `job_wall_clock`) to a check; DO-6 also names the lost-call counter `calls_lost_in_flight` where DO-3/DO-4 say
  `calls_lost` — where it should live: DO-4 §10.2 (and DO-6 *Missing instrumentation* for the counter name).
- "A draft that will not compile fails with `compile_error`" — missing fact: `compile_draft` declares no error type and
  nothing says what raises `compile_error` — where it should live: DO-4 §8 *compile* and §10.2.
- "`route_after_checks` returns <store | repair | fail> for each input" — missing fact: the decision table is not
  written (e.g. `schema_valid false` with `repair_rounds 0` → repair or fail; what `check_passed true, schema_valid false`
  means) — where it should live: DO-4 §6 (`route_after_checks`).
- "Compile and store use the lesson's unit id" — missing fact: `CompileContext.unit_id` and `NewGeneratedVersion.unit_id`
  need it, but `ClaimedJob` and `LessonJobState` carry none and `CompileCheckNode` / `StoreNode` have no `RunRepo` — where
  it should live: DO-4 §3.4 (`ClaimedJob`).
- "The draft prompt uses the run's pinned intake choices, not later edits" — missing fact: `DraftNode` reads
  `RowContext.choices` from `OutlineRepo.row_context` (live `intake_choice` rows), while CON-5 / UXQ-9 pin the choice set on
  the run (`run.choices_json`); no `RunRepo` method returns the pinned choices (`RunRow` has only `choices_hash`) — where it
  should live: DO-4 §3.5 (`RunRepo`) and §6 (`DraftNode`).
- "v1, its `lesson_doc` seq 1, its safety flags and `lesson.state = draft` commit together or not at all" — missing fact:
  `write_generated_version` and `SafetyFlagRepo.create_for_lesson` take a `Tx`, but `LessonDocStore.seed_initial(lesson_id,
  lesson, actor)` does not; and what `write_generated_version` returns on its `ON CONFLICT DO NOTHING` path — where it
  should live: DO-4 §3.4 (`seed_initial`) and §6 (`StoreNode`).
- "A failed candidate leaves an `in_review` lesson's state unchanged" — missing fact: `FailNode` writes
  `generation_failed` with no branch for `kind "candidate"` jobs on a lesson that already has v1 — where it should live:
  DO-4 §6 (`FailNode`).
- "The claim uses worker id W" — missing fact: `JobQueue.claim(worker_id, …)` needs a worker id, but no setting,
  constructor field or generator supplies one (`WorkerSettings`, `ClaimLoop.__init__`) — where it should live: DO-4 §9
  (`WorkerSettings`) or §6 (`ClaimLoop`).
- "The draft call is sent with temperature T and example set E" — missing fact: `StructuredCallRequest.temperature` and
  `DraftPromptInput.example_set_id` have no settings field, constant or source — where it should live: DO-3 §7 and DO-4 §9.
- "`CompiledLesson.content_hash` equals `ydoc.content_hash` of the same lesson (HP-4)" — missing fact: `compile_draft` in
  `packages/core` returns a hash, but `packages/core` may not import `packages/ydoc` (DO-3 §1 dependency arrows), so which
  function computes it, and whether it is guaranteed identical, is unstated — where it should live: DO-3 §1/§2.1 and DO-4
  §8 *compile*.

---

## Part 3 — Gaps and how each was closed

Every *Could not write* item from Part 2 gets a row. The §6 gate needs every row `closed`.

| # | Ticket | Missing fact (as the agent named it) | Closed in (file#anchor) | Status | Date |
|---|---|---|---|---|---|
| G-1 | T1 | `PgSpendLedger` constructor has no settings, yet consumes `BUILD_SPEND_CEILING_USD` and `USER_DAY_CAP_MULTIPLIER` (fix in DO-4 §12, DO-3 §8) | component-contracts.md#3.4 `PgSpendLedger_ctor` (settings: `SpendSettings`); component-contracts.md#9 `SpendSettings`; code-design.md#7 `BUILD_SPEND_CEILING_USD`, `USER_DAY_CAP_MULTIPLIER`; code-design.md#8 `review.ts` wiring | closed | 2026-10-25 |
| G-2 | T1 | User day cap formula: `USER_DAY_CAP_MULTIPLIER` multiplies an unnamed base (fix in DO-4 §8 *spend*, DO-3 §7) | component-contracts.md#8 *spend* `user_day_cap_for` (2 × `RUN_CAP_DEFAULT_USD` = $26.00); component-contracts.md#3.4 `SpendSnapshot.user_day_cap_usd`; code-design.md#7 `USER_DAY_CAP_MULTIPLIER` | closed | 2026-10-25 |
| G-3 | T1 | Project day cap promised by CON-5 has no fields, method, setting, or typed `details.scope` (fix in DO-4 §3.4, DO-3 §7) | component-contracts.md#3.4 `SpendSnapshot.project_ceiling_usd` / `project_settled_usd` / `project_reserved_usd`, `ReservationDecision.scope`, `SpendLedger.check_day_cap`; code-design.md#7 `BUILD_SPEND_CEILING_USD` | closed | 2026-10-25 |
| G-4 | T1 | `build_cap` (DO-4) vs `project_cap` (CON-6, OpenAPI) with no mapping (fix in DO-4 §3.4, §3.5) | component-contracts.md#2 `CapName` (`run_cap`, `day_cap`, `project_cap`: the CON-6 names, no mapping); component-contracts.md#5 `RunService` (`RunRow.capped_by`) | closed | 2026-10-25 |
| G-5 | T1 | Build-total source: `spend_reservation` or `model_call` incl. spike imports (M-29) (fix in DO-4 §3.4) | component-contracts.md#3.4 `SpendSnapshot.project_settled_usd` (settled reservations + `model_call` rows with null `reservation_id`, M-29 / WF-32) | closed | 2026-10-25 |
| G-6 | T1 | `ModelPrice` lacks `cache_write_per_mtok`; `max_call_cost`/`settle_cost` formulas, rounding and multi-cap `refused_by` precedence unwritten (fix in DO-4 §2, §8 *spend*) | component-contracts.md#2 `ModelPrice.cache_write_per_mtok`; component-contracts.md#8 *spend* `max_call_cost` (ceiling), `settle_cost` (half-up), `decide_reservation` (order run → day → project); component-contracts.md#3.4 `ReservationDecision.refused_by` | closed | 2026-10-25 |
| G-7 | T1 | `settle` when `actual_usd > reserved_usd` (fix in DO-4 §3.4) | component-contracts.md#3.4 `SpendLedger.settle` (overshoot recorded as `overshoot_usd`, warn `spend.overshoot`, never refused) | closed | 2026-10-25 |
| G-8 | T1 | `spend_reservation.status` values and transitions untyped; `settle`/`release` idempotency (fix in DO-4 §3.4) | component-contracts.md#3.4 `SpendReservationStatus` and its moves; `SpendLedger.settle` / `release` idempotency | closed | 2026-10-25 |
| G-9 | T1 | Nobody releases a killed job's orphaned reservation (fix in DO-4 §3.4 `requeue_expired` / `SpendLedger`) | component-contracts.md#3.4 `ReservationRequest.job_id`, `SpendLedger.release_for_jobs`; component-contracts.md#6 `ClaimLoop.start` (after `requeue_expired`) | closed | 2026-10-25 |
| G-10 | T1, T3 | Who writes `run.state = capped` and `capped_by`: `ReserveNode` has no `RunRepo`, `set_state` has no `capped_by` (fix in DO-4 §6, §3.5) | component-contracts.md#3.5 `RunRepo.mark_capped(run_id, capped_by, tx)`; component-contracts.md#6 `RunFinalizer` (spend brake → `mark_capped` + `cancel_run`) | closed | 2026-10-25 |
| G-11 | T2 | `RATING_REQUIRED` unreachable: OpenAPI requires `rating`, Zod parse returns `INVALID_REQUEST` first; producer split between service and `approve_gate` (fix in DO-4 §5, §10.1; CHG-N if the card or schema changes) | component-contracts.md#5 `TransitionRequestInput` (rating/note/reason optional in the Zod mirror); component-contracts.md#8 `GateState`; component-contracts.md#10.1 `RATING_REQUIRED` (`decide_transition` only); card unchanged, schema clean-up proposed in component-contracts.md#13 item 6b | closed | 2026-10-25 |
| G-12 | T2 | `TransitionService.__init__` lacks `CheckContextLoader`, `CheckPolicy`, rule list and the loader's repos (fix in DO-4 §5, DO-3 §8) | component-contracts.md#5 `ApproveService.__init__` (loader, rules, policy, issues, graph; `TransitionService` delegates Approve); code-design.md#8 `review.ts` wiring | closed | 2026-10-25 |
| G-13 | T2, T3 | No named registered rule list for `run_checks(ctx, rules, policy)` (fix in DO-4 §8 *checks*) | component-contracts.md#8 *checks* `CHECK_RULES` (one entry per `CheckKind`, `registry.ts`), `CHECK_POLICY` | closed | 2026-10-25 |
| G-14 | T2 | Approve `GateState` assembly: re-run `CheckFinding` vs `IssueRow` resolutions; `pending_check` on a frozen snapshot (fix in DO-4 §8 *checks*, §5) | component-contracts.md#8 *checks* `merge_resolutions` (resolution key kind + address + code), `GateState.pending_check`; component-contracts.md#5 `ApproveService.approve` (`pending_check` False on the frozen snapshot) | closed | 2026-10-25 |
| G-15 | T2 | Refused-call capture: DO-6 "only its audit event" vs guarantee 2 "no audit row" (DO-4 §13 item 3) (fix in DO-6 *Capture verification*) | component-contracts.md#1 and #5 (refusal = one application-log line, no audit row), component-contracts.md#13 item 3; observability.md#capture-verification (verified) | closed | 2026-10-25 |
| G-16 | T2 | How `HttpCollabCommandClient` maps a collab `Error` envelope to a web refusal (fix in DO-4 §3.3) | component-contracts.md#3.3 `HttpCollabCommandClient` mapping (Error envelope → `DomainRefusal` same code; transport/401 → `COLLAB_UNAVAILABLE`) | closed | 2026-10-25 |
| G-17 | T3 | One `reservation_id` per job; `DraftNode` cannot reserve the truncation retry; `settle` takes one call id (fix in DO-4 §6) | component-contracts.md#4 `PaidCaller` (each call reserves and settles its own worst case); component-contracts.md#6 intro (no reserve/settle node); code-design.md#5 `PaidCaller` seam | closed | 2026-10-25 |
| G-18 | T3 | `ReserveNode` needs the input-token estimate before the prompt is rendered (fix in DO-4 §6) | component-contracts.md#4 `PaidCaller.call` (`max_call_cost` from `rendered.input_tokens_estimate`, after rendering) | closed | 2026-10-25 |
| G-19 | T3 | Checkpoint `attempt` key: job attempt vs call ordinal; re-pay risk after requeue (fix in DO-4 §3.4, §4) | component-contracts.md#3.4 `ModelCallStart.attempt` (call ordinal per job + purpose, not `ClaimedJob.attempt`); component-contracts.md#4 `ModelCallRecorder` (`completed_for` checkpoint) | closed | 2026-10-25 |
| G-20 | T3 | `GenerationFailureCheck` vs OpenAPI `FailureReason.check` mismatch; no brake → check map; `calls_lost` vs `calls_lost_in_flight` (fix in DO-4 §10.2; DO-6 *Missing instrumentation*) | component-contracts.md#2 `FailureCheck` (= OpenAPI `FailureReason.check`); component-contracts.md#6 `failure_reasons_for` (brake → check map); component-contracts.md#10.2; component-contracts.md#5 `RunService.summary` (`calls_lost_in_flight` = sum of `lesson_job.calls_lost`); observability.md#missing-instrumentation | closed | 2026-10-25 |
| G-21 | T3 | `compile_draft` has no error type; nothing raises `compile_error` (fix in DO-4 §8 *compile*, §10.2) | component-contracts.md#8 *compile* `compile_draft` raises `CompileError`; component-contracts.md#10.2 `CompileError`; `CompileCheckNode` sets `compile_error` | closed | 2026-10-25 |
| G-22 | T3 | `route_after_checks` decision table unwritten (fix in DO-4 §6) | component-contracts.md#6 `route_after_checks` decision table | closed | 2026-10-25 |
| G-23 | T3 | `unit_id` missing from `ClaimedJob` / `LessonJobState` (fix in DO-4 §3.4) | component-contracts.md#3.4 `ClaimedJob.unit_id`; component-contracts.md#6 `LessonJobState.job` | closed | 2026-10-25 |
| G-24 | T3 | `DraftNode` reads live intake choices; no method returns the run's pinned choice set (fix in DO-4 §3.5, §6) | component-contracts.md#3.5 `RunRepo.pinned_choices`; component-contracts.md#6 `LessonJobState.context` / `DraftNode` | closed | 2026-10-25 |
| G-25 | T3 | `seed_initial` takes no `Tx`, so v1 store is not one transaction; `write_generated_version` conflict return (fix in DO-4 §3.4, §6) | component-contracts.md#3.4 `LessonDocStore.seed_initial(..., tx)`; component-contracts.md#3.5 `write_generated_version` result `created`; component-contracts.md#6 `StoreNode` (one tx) | closed | 2026-10-25 |
| G-26 | T3 | `FailNode` has no branch for a failed candidate on a lesson with v1 (fix in DO-4 §6) | component-contracts.md#6 `FailNode` candidate branch; component-contracts.md#3.5 `LessonVersionRepo.has_generated_version` | closed | 2026-10-25 |
| G-27 | T3 | No source for `claim`'s `worker_id` (fix in DO-4 §9 `WorkerSettings` or §6 `ClaimLoop`) | component-contracts.md#9 `WorkerSettings.worker_id`; component-contracts.md#6 `ClaimLoop` (`claim(settings.worker_id, …)`); code-design.md#7 `WORKER_ID` | closed | 2026-10-25 |
| G-28 | T3 | No setting or source for `temperature` and `example_set_id` (fix in DO-3 §7, DO-4 §9) | component-contracts.md#3.1 `temperature` (None = provider default, no setting); component-contracts.md#4 `DraftPromptInput` (`example_set_id` null); code-design.md#7 (no setting row) | closed | 2026-10-25 |
| G-29 | T3 | Which function computes `CompiledLesson.content_hash` given `core` cannot import `ydoc`, and its equality with `ydoc.content_hash` (fix in DO-3 §1/§2.1, DO-4 §8 *compile*) | component-contracts.md#8 `content_hash` (packages/schema, re-exported by packages/ydoc) and `compile_draft`; code-design.md#2.1 `packages/schema/src/content-hash.ts` | closed | 2026-10-25 |

**Result:** 29 gaps found, 29 closed, 0 open (2026-10-25). 28 were already answered by the revised DO-3/DO-4 (and DO-6
for G-15); G-20's `calls_lost` → `calls_lost_in_flight` mapping was added to DO-4 §5 `RunService.summary` and DO-6
*Missing instrumentation*. `signature_check.py` re-run after the fixes: `result: signatures complete`, exit 0.
