# Contract changes — Newsela Lesson Studio

> **What this is:** the log of every change to a contract card in [`INTERFACE.md`](INTERFACE.md) once it is `agreed`,
> and the procedure that every change follows. **Date started:** 2026-10-25. **Process:** zero-to-hero 2.0.0, revision
> [`2026-10-25-concurrent-frontend.md`](../../../.claude/skills/zero-to-hero/proposals/2026-10-25-concurrent-frontend.md) §2.

## When a change needs a `CHG-N`

Any change to an `agreed` card gets a `CHG-N` row, **including a change that leaves the OpenAPI file the same**.

Example: CON-18 says Approve returns 409 `STALE_PIN` when the pinned hash differs. Suppose we decide Approve should also
refuse when the snapshot is older than 24 hours. The request and response shapes do not change, so schema validation
passes. But what "approved" means has changed. That is a behavioural change, and it is logged here. Schema checks alone
never catch it.

Cards still `draft` or `proposed` are edited in place without a `CHG-N`; their reviews simply start again.

## The procedure (five steps)

1. **Identify the changed promise.** Name the `CON-N` and the aspect: operation, field, state, permission, error,
   recovery, guarantee or timing. Say whether it is **presentation-only** (how something looks or where it sits, e.g.
   moving the checklist into a sidebar) or **behavioural** (what the product does or means, e.g. adding a reservation or
   changing who may reopen).
2. **Review the consequences.** Both sides review: the UX side (does every screen that needs this still get what it
   needs?) and the System side (can the backend keep the new promise, and what breaks?). A change to product meaning goes
   to Innocent, told as a story with options and an explicit decision line (rule `decision-requests-story-driven`).
3. **Update the sources.** In one change: the card in `INTERFACE.md` (status `changing` until step 4 is done, then back to
   `agreed`), `interface.openapi.yaml` (with `x-con` still pointing at the card), the §6 DO-4 links, and the screen specs
   that cite the card.
4. **Mark what must be reconciled.** Every design section, ticket, piece of code and piece of evidence that cites the
   changed `CON-N` gets the marker `reconcile: CHG-N`. The marker is removed when that item is reconciled. The row below
   lists them.
5. **Unrelated work continues.** Only work that cites the changed `CON-N` waits. Everything else carries on.

## Log

| CHG | Date | CON | Aspect | Kind | What changed | Decided by | Sources updated | Waiting to reconcile (`reconcile: CHG-N`) | Status |
|---|---|---|---|---|---|---|---|---|---|
| CHG-1 | 2026-10-25 | CON-12, CON-18 | guarantee (System-support note) | presentation-only: no promise changes — "0 edits persisted after a lock; every keystroke in the snapshot or reported as refused" stands | SP-2 passed with option A (refuse in place via a per-update guard), so the cards' description of the close-every-connection fallback is removed and the guard path named | Claude (UX + System reviews, 2026-10-25) under PD-32; SP-2 record | `INTERFACE.md` CON-12, CON-18; OpenAPI unchanged; DO-4 already follows (§13 item 6a); no screen spec cites the fallback | none — no ticket was published citing the fallback; reconciled in the same change | reconciled |
| CHG-2 | 2026-10-25 | CON-13 (also CON-14, CON-15 where `Issue.kind`, `first_failing_kind`, `check_kind` use CheckKind) | field (issue kind list) | additive and behaviourally neutral: one enum value added, no promise removed | `schema_invalid` (NL-20's structural check: heading levels, table header rows, CFU correct options/rationales) added to the issue kinds, so the issues list can return it; DO-4 `CheckKind` already had 28 kinds, the OpenAPI and Zod mirror had 27. `FailureReason.check` already had it and is unchanged | orchestrator under Innocent's PD-32 standing authorization (2026-10-25) | `INTERFACE.md` CON-13 kind list; `interface.openapi.yaml` `Issue.kind` enum; regenerated `generated/api-types.ts`; `packages/schema/src/api/lessons.ts`; new `tests/contract/check-kinds.test.ts`; DO-4 already follows. NL-22 (`ticket/NL-22`, unmerged) derives CheckKind from `Issue["kind"]` and picks it up automatically | none — no ticket text states 27 | reconciled |
| CHG-3 | 2026-10-25 | CON-18 | field + error scope (`STALE_PIN`) | behavioural, additive: `request_changes` and `reopen` accept an optional pin (`snapshot_hash` + `snapshot_state_vector`); supplied, it is checked as Approve's is (409 `STALE_PIN`); one without the other is `INVALID_REQUEST`; absent = unchanged; Approve untouched | SCR-15 already holds the pin the approver read, and a send-back could otherwise act on text the person never saw; NL-53's "must not edit `TransitionRequestInput`" is superseded by this change | orchestrator under Innocent's PD-32 standing authorization (2026-10-25) | `INTERFACE.md` CON-18; `interface.openapi.yaml` (`RequestChanges`, `Reopen`, `transitionLesson`); zod `transition.ts`; both `api-types.ts`; `TransitionService`; DO-4 transition comments; SCR-15; send-back dialog; frozen tests F1-F9 | none after this change (NL-53, NL-68, NL-69 notes added) | reconciled |
| CHG-4 | 2026-10-25 | CON-16 | field (`Candidate.note`) | additive, presentation-visible on SCR-12: the regenerate note (trimmed, else null) is returned by `getCandidate` and `regenerateLesson`; not in OpenAPI `required` | SCR-12's header text "note: <note>" had no field to fill; the note was already stored on `lesson_job.reviewer_note`, so no migration | orchestrator under Innocent's PD-32 standing authorization (2026-10-25) | `INTERFACE.md` CON-16; `interface.openapi.yaml` (`Candidate`, examples); zod `lessons.ts`; both `api-types.ts`; `JobRow`/`job-queue` repo; `CandidateService`; SCR-12 header | none after this change (NL-47, NL-67 notes added) | reconciled |
| CHG-5 | 2026-10-25 | CON-3 | field (`unit.finding`; `eld[].sheet_label`, `official_strand`, `suggested_remap` filled) | additive, presentation-visible on SCR-4: the unit-conflict finding is listed on `unit` (null when none; not in OpenAPI `required`); the three ELD fields, already in the card, are filled from stored data instead of always empty; no promise removed | SCR-4 needs the finding id to send `confirm_unit` ("Confirm U4 for the unit") and the ELD label beside the official strand; the data was already stored in `outline_json` | orchestrator under Innocent's PD-32 standing authorization (2026-10-25) | `INTERFACE.md` CON-3; `interface.openapi.yaml` (`ValidationReport.unit`, example); zod `outlines.ts`; both `api-types.ts`; `report.ts`; `OutlineService`; SCR-4 `report-model.ts`, `errors-section.tsx` | NL-94 (unmerged): unskip its two test.fixme; NL-57, NL-77 notes | reconciled |
| CHG-6 | 2026-10-25 | CON-23 | field (`downloadExport` response) | presentation-neutral for the screen: the file already is the `ExportBundleFile` that `docs/contracts/lesson-export.schema.json` validates; the OpenAPI `LessonExportFile` (`export_id`, `version_number`, `label`, `payload_hash`, per-lesson `content_hash`) was never emitted | The service builds the strict bundle (`export_version`, `unit_id`, `generated_at`, lessons with `version_id`, `content_hash`, `approved_by`, `approved_at`, `lesson`); a file with extra top-level keys would fail the published schema (CON-23 Guarantees) | orchestrator under Innocent's PD-32 standing authorization | `interface.openapi.yaml` `LessonExportFile` + example, `packages/schema/src/api/exports.ts` `LessonExportFile`, both `api-types.ts`, INTERFACE.md CON-23 file description; NL-75 downloads a blob and is unaffected | none | reconciled 2026-10-26 (GEN-7): `interface.openapi.yaml` `LessonExportFile` removed, `ExportBundleFile` + `ExportedLessonRecord` + `StoredLesson` (and `StoredSection`, `StoredProseMirrorDoc`, `StoredProseMirrorNode`, `StoredFrontMatter`, `StoredTextCard`) components added; Zod `api/exports.ts` re-exports `ExportBundleFile`; both `api-types.ts` regenerated and identical; INTERFACE.md CON-23 rewritten; drift guard `packages/schema/tests/contract/export-file-contract.test.ts` (Zod + published JSON Schema + OpenAPI example); real-stack `con-23 --grep schema-and-hashes` passing, bytes and hashes unchanged (`hashes: download=e935532a... list=e935532a... row=e935532a...`). NL-75 unaffected |
| CHG-7 | 2026-10-26 | CON-11 (read by CON-20) | field (`Lesson.version_id`) | additive and behaviourally neutral for readers: one required-nullable response field added, no promise removed | the workspace review heartbeat sent `lv-${version_number}`, an id that is not a lesson version, so `review_session` was keyed on a made-up value (S-18); the read service already knew the real id (`get_lesson_traced`) and dropped it from the body | orchestrator under Innocent's PD-32 standing authorization (2026-10-26) | `INTERFACE.md` CON-11 fields and CON-20 `version_id`; `interface.openapi.yaml` `Lesson` (+ example); zod `lessons.ts` `Lesson`; both `api-types.ts`; `LessonReadService`; workspace heartbeat; mock fixtures that build a `Lesson` | none beyond the mock fixtures changed in this ticket (GEN-5) | reconciled |

*All 24 cards became `agreed` on 2026-10-25 (System review below); every change from then on is a `CHG-N`.*

## UX-3a System review, 2026-10-25 (not `CHG` entries)

The System review (Claude, System track, Opus) edited the cards while they were still `proposed`, so these edits are
in-place review changes, not `CHG` rows. They were checked against the chosen hard problems (HP-1…HP-10), the capacity
decision (PD-33), the DO-1 design decisions (D-6: checks in the worker from `check_job`) and the UXQ decisions; no product
meaning changed. Each card then moved to `agreed`. Per-card verdicts and the toolchain evidence:
[`reviews/2026-10-25-system-review.md`](reviews/2026-10-25-system-review.md).

**Shared (every card):** HTTP status fixed per code; nine codes added (`INVALID_REQUEST` 400, `INVALID_CREDENTIALS` 401,
`UNDO_EXPIRED` 409, `STALE_BASE` 409, `INVALID_CHOICE` 422, `NOT_RESOLVABLE` 422, `SHEET_UNREACHABLE` 502,
`COLLAB_UNAVAILABLE` 503, `SERVICE_BUSY` 503 with `Retry-After`, the capacity doc's retryable 503); `SCHEMA_UNKNOWN`
moved 422 → 500; error precedence; identifiers (`unit_key`, `lesson_key`, dual-form paths; UXQ-2); the internal call
for HTTP-originated content changes; the timing table moved to the 200-user targets (PD-33).

| Card | What changed at the System review |
|---|---|
| CON-1 | Sign-in = email + password on seeded accounts; `INVALID_CREDENTIALS`; `expires_at`; Postgres session shared with the socket; `synthetic` seed-only |
| CON-2 | Unit-matching rule; `unit_key`; 5 MB limit; `SHEET_UNREACHABLE`; synchronous parse kept |
| CON-3 | Stored report with choices overlaid (byte-identical); finding-kind enum; `runs_from_this_version` (UXQ-9) |
| CON-4 | `revert` kind (Undo); `INVALID_CHOICE`; `INVALID_TRANSITION` for a late unit change; choices copied into each run (UXQ-9) |
| CON-5 | Day cap on settled + reserved, per user and project; trials count; scope `unfinished_of_run` (UXP-5); `choices_hash`; `Idempotency-Key`; plan failure → `paused` |
| CON-6 | Failure-reason enum; `capped_by`; `queued_ahead`; `lesson_key`; freshness reasoning |
| CON-7 | `INVALID_TRANSITION` states listed (Retry on `complete` refused); row lock; lease and SIGTERM stated |
| CON-8 | Links copied into the run's plan at run start; plan state `failed` |
| CON-9 | UXQ-5 sort order with a confirmation tie-break; 2 s polling; `waits_on.status` (UXP-2); `unit_key`, `lesson_key`, `generated_at` |
| CON-10 | G-2 threshold stored per frozen row; `quality: null` when cut; every role reads (UXQ-7) |
| CON-11 | Content returned here, editor waits for socket sync; checklist key enum; `SCHEMA_UNKNOWN` 500; `lesson_key`, `unit_id`; UXQ-11 |
| CON-12 | `stored` as a stateless message; internal freeze call with the SP-2 fallback; reviewer-only writes decided; PD-33 timing; stores enqueue `check_job` |
| CON-13 | Checks in the worker from `check_job` (DO-1 D-6); `pending` defined; kind enum; `stored_hash`, `blocks` (UXP-2), `resolvable`; SP-3 scope noted |
| CON-14 | Standard decisions count for four-eyes; resolutions outside the document; `NOT_RESOLVABLE`; `undo` + `UNDO_EXPIRED` (UXQ-8); approver flag clear on submitted; `COLLAB_UNAVAILABLE` |
| CON-15 | Internal call, stored before the response; `COLLAB_UNAVAILABLE`; word-count rule; re-fill replaces; `content_hash`; text limit |
| CON-16 | Own per-lesson cap, counted against the day cap; `generation_failed` → v1 directly; one job in flight; `INVALID_TRANSITION`, `COLLAB_UNAVAILABLE`; `cost_usd` |
| CON-17 | Accept applied server-side against the live document (HP-5 promise kept); new `listSuggestions`; 30-min expiry; timeout; `COLLAB_UNAVAILABLE`, `INVALID_TRANSITION` |
| CON-18 | `withdrawn` is a move; `NOT_STORED` by state-vector cover check; statuses; full precedence (`BLOCKED` over `CONFIRMATION_OPEN`); `exported` reopenable; `COLLAB_UNAVAILABLE`; timing |
| CON-19 | Provenance rule for human-made versions (`derived_from_version_id`, model fields nullable) |
| CON-20 | Author heartbeats refused; idle window 60–90 s parameter; 10 s spacing |
| CON-21 | `cost_per_lesson_usd` → `cost_per_ready_lesson_usd` (mean per ready lesson, GP-107) |
| CON-22 | Cells read the approved snapshot where one exists, else the stored row; `source` per cell |
| CON-23 | No-change export returns the previous version (200) without writing; per-unit serialization; schema path named (planned) |
| CON-24 | `STALE_BASE` for concurrent saves from one base; text limit; UXQ-3 stated |

**OpenAPI:** 0.1.0 → 1.0.0; 35 → 36 operations (`listSuggestions` added); every operation keeps its `x-con`;
`x-error-catalog` and `x-common-errors` added; common 400 and 503 responses on every operation.

## History

- 2026-10-25: the contracts were first drafted at UX-1 as one-line rows (CON-1…CON-24, all `draft`) in
  [`USER_FLOWS.md`](../ux/01-planning/USER_FLOWS.md), section "Draft contracts (UX-1)".
- 2026-10-25: moved here as full cards in `INTERFACE.md` (all `proposed`), with the OpenAPI draft
  `interface.openapi.yaml` 0.1.0, under the approved revision. This log starts empty; the move itself is not a `CHG`,
  because no card was `agreed` before it.
- 2026-10-25: System review recorded on all 24 cards; all `agreed`; OpenAPI 1.0.0. Summary above (not `CHG` rows).
