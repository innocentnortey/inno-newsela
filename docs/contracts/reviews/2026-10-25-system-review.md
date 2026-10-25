# UX-3a · System-side review of the shared contracts — 2026-10-25

**Reviewer:** Claude (System track, Opus). **Date:** 2026-10-25. **Scope:** all 24 cards in
[`../INTERFACE.md`](../INTERFACE.md) and their machine form [`../interface.openapi.yaml`](../interface.openapi.yaml).
**Basis:** the chosen hard problems ([`hard-problems.md`](../../design/hard-problems.md), HP-1…HP-10 with addenda), the
capacity decision PD-33 ([`capacity-and-workload.md`](../../design/capacity-and-workload.md): 500 users a day, a spike of
200 concurrent users, ≤ 6 generation jobs in flight), the DO-1 decisions in
[`system-design.md`](../../design/system-design.md) (notably D-6: checks run in the worker from a coalesced `check_job`),
the component map in [`architecture.md`](../../design/architecture.md), PRD §5.4 and §10 (PD-1…PD-35), and the UXQ
decisions in [`SCREEN_SPECS.md`](../../ux/03-structure/SCREEN_SPECS.md).
**Product behaviour:** every UXP and UXQ question was already decided under Innocent's delegation (PD-31) and standing
authorization (PD-32). This review changed no product meaning.

## What the review checked, per card

1. **Feasibility** against the chosen design: Postgres only; one `lesson_job` table claimed with `SKIP LOCKED` and a
   lease; the Y.Doc canonical, with derived JSON, hash and state vector written in one store transaction; the Submit
   freeze; one Hocuspocus process; reserve-then-settle spend against the run, user-day and project caps.
2. **Guarantees** the backend can actually keep, and **how** (the System support line on each card).
3. **Timing** against the PD-33 targets.
4. **Named errors:** each maps to one HTTP status and one `ApiError.code` (`x-error-catalog` in the OpenAPI).
5. **Recovery** for each refusal.
6. **Spike dependencies** stated as `confirmed by SP-N`; the card is agreed now, and a spike result that changes a
   promise becomes a `CHG-N`.

## Verdicts

| Card | Verdict | What changed | Spike dependency |
|---|---|---|---|
| CON-1 Session and role | agreed | Sign-in = email + password on seeded accounts; `INVALID_CREDENTIALS` (401); `expires_at`; opaque session in Postgres shared with the socket; Origin check; `synthetic` seed-only | — |
| CON-2 Outline versions | agreed | Unit-matching rule (filed under the unit the sheet writes); `unit_key` (UXQ-2); 5 MB limit; `SHEET_UNREACHABLE` (502) for a failed fetch | — |
| CON-3 Validation report | agreed | Stored at upload with choices overlaid, so byte-identical; finding-kind enum fixed; `runs_from_this_version` (UXQ-9) | — |
| CON-4 Intake choices | agreed | `revert` kind for Undo; `INVALID_CHOICE`; `INVALID_TRANSITION` for a late unit change; choices copied into each run (UXQ-9) | — |
| CON-5 Start a run | agreed | Day cap on settled + reserved spend, per user and per project; trials count; scope `unfinished_of_run` (UXP-5); `choices_hash`; `Idempotency-Key`; plan failure → `paused` | SP-1 (per-lesson cost, time, cap formula) |
| CON-6 Run progress | agreed | Failure-reason enum; `capped_by`; `queued_ahead`; `lesson_key`; 3 s freshness shown to hold | SP-1 (timing, concurrency cap) |
| CON-7 Run control | agreed | Allowed states per action; Retry on `complete` → `INVALID_TRANSITION`; row lock; lease and SIGTERM behaviour | — |
| CON-8 Unit plan | agreed | Links computed at intake and copied into the run's plan at run start; plan state `failed` | SP-1 (47-entry plan validity) |
| CON-9 Unit board | agreed | UXQ-5 order plus a confirmation-count tie-break; 2 s polling; counts from stored issue rows; `waits_on.status` (UXP-2); `unit_key`, `lesson_key`, `generated_at` | — |
| CON-10 Unit metrics | agreed | G-2 threshold stored per frozen row from that version's word count; `quality: null` when cut #6 fires; every role reads (UXQ-7) | — |
| CON-11 Lesson read | agreed | `content` returned here; an editable editor waits for the socket's first sync; checklist key enum; `SCHEMA_UNKNOWN` → 500; `lesson_key`, `unit_id`, dual-form path (UXQ-2); UXQ-11 | — |
| CON-12 Collaboration channel | agreed | `stored` as a Hocuspocus stateless message; Submit lock as an internal freeze call; close-all-connections fallback (same promise); reviewer-only writes decided from HP-5/R-54; PD-33 timing; stores enqueue `check_job` | SP-2 (freeze, round trip, store p95) |
| CON-13 Issue list | agreed | Checks in the worker from a coalesced `check_job` (DO-1 D-6); `pending` defined from it; kind enum; `stored_hash`, `blocks` (UXP-2), `resolvable` | SP-3 (name-scan blocking scope) |
| CON-14 Resolve and confirm | agreed | Standard decisions count for four-eyes; resolutions and flag clears outside the document; `NOT_RESOLVABLE`; `undo` + `UNDO_EXPIRED` (UXQ-8); approver may clear a flag on a submitted lesson; `COLLAB_UNAVAILABLE` | — |
| CON-15 Fill a slot | agreed | HTTP → internal call → one Yjs transaction, stored before the response; `COLLAB_UNAVAILABLE`; 12-word count rule; re-fill replaces; `content_hash`; text limit | — |
| CON-16 Candidates | agreed | Own per-lesson cap, counted against the day cap (not the run cap); `generation_failed` → v1 directly; one job in flight per lesson; `INVALID_TRANSITION`, `COLLAB_UNAVAILABLE`; `cost_usd` | SP-1 (per-lesson cap) |
| CON-17 AI suggestions | agreed | Accept applied server-side against the live document (HP-5's promise kept, mechanism hardened); new `listSuggestions`; 30-min expiry; 20 s timeout; `COLLAB_UNAVAILABLE`, `INVALID_TRANSITION` | — |
| CON-18 Lesson transitions | agreed | `withdrawn` is a logged move; `NOT_STORED` by a state-vector cover check inside the freeze; HTTP statuses; full error precedence (`BLOCKED` beats `CONFIRMATION_OPEN` and lists both); `exported` can be reopened; `COLLAB_UNAVAILABLE`; timing | SP-2 (freeze mechanics) |
| CON-19 Lesson history | agreed | Provenance rule for human-made versions (`derived_from_version_id`; model fields nullable) | — |
| CON-20 Review heartbeats | agreed | Author heartbeats refused; idle window a 60–90 s parameter; 10 s minimum spacing; spike load fits | — |
| CON-21 Run summary | agreed | Cost per lesson = mean per ready lesson (GP-107); field renamed `cost_per_ready_lesson_usd` | — |
| CON-22 Coverage matrix | agreed | Approved snapshot where one exists, else the stored row; `source` per cell | — |
| CON-23 Export | agreed | A no-change export returns the previous version (200) without writing; per-unit serialization; schema path `lesson-export.schema.json` (planned) | — |
| CON-24 Prompt versions | agreed | `STALE_BASE` (409) for concurrent saves from one base; text limit; UXQ-3 stated | — |

**Count** (*calculation*): 24 agreed, 0 not agreed; 7 carry a spike dependency (CON-5, 6, 8, 12, 13, 16, 18).

**Shared changes:** HTTP status fixed per code; nine codes added (`INVALID_REQUEST`, `INVALID_CREDENTIALS`,
`UNDO_EXPIRED`, `STALE_BASE`, `INVALID_CHOICE`, `NOT_RESOLVABLE`, `SHEET_UNREACHABLE`, `COLLAB_UNAVAILABLE`,
`SERVICE_BUSY`); error precedence; identifiers (UXQ-2); the internal call for HTTP-originated content changes; timing
table at the PD-33 targets. Gaps CG-1 (no code for the capacity doc's retryable 503 → `SERVICE_BUSY` with
`Retry-After`), CG-2 (25-user timing numbers → PD-33 targets) and CG-3 (checks in the worker from `check_job`, DO-1 D-6)
from the DO-1/DO-2/DO-6 drafter are folded in.

## Points for the other sessions

- **UX side (presentation only):** the new codes have screen responses on their cards and in INTERFACE.md's *Screen
  response to the System-review codes*; SCREEN_SPECS may want matching copy. Nothing here changes a screen's states.
- **CON-17 mechanism:** HP-5's "rules that hold whichever option" says an accepted suggestion is "a single client-side
  transaction". The card now applies it on the collaboration server, which checks the anchored text against the live
  document instead of trusting the client. The promise (applied only if unchanged, tagged `ai-assist`, named acceptor)
  is unchanged; DO-3/DO-4 should follow the card.
- **SP-1, SP-2, SP-3 not yet run** (checklist §5). Their numbers sit on the cards as `[A]`/`[T]` with `confirmed by SP-N`.

## Toolchain evidence

| Check | Command | Result |
|---|---|---|
| Lint | `npx -y @redocly/cli@latest lint docs/contracts/interface.openapi.yaml` | `Woohoo! Your API description is valid.` — 0 errors, 0 warnings (after quoting three flow-mapping values that contained commas) |
| Structure | `python3 -I` with PyYAML over the file | 36 operations, every one with `x-con`; `ErrorCode` enum (36) equals `x-error-catalog` (36); every `x-named-errors` entry is in the enum; every operation named on a card exists in the OpenAPI, and vice versa, with matching `CON-N` |
| Prism mock | `npx -y @stoplight/prism-cli@latest mock -p 4010 docs/contracts/interface.openapi.yaml` (background; stopped afterwards, port 4010 free) | `Prism is listening on http://127.0.0.1:4010`; `GET /lessons/g6-u4:L4` → 200 (`G6.U4.L4`, `L4`, `in_review`); `POST /lessons/G6.U4.L5/transitions` approve → 200 (`approved`, `metrics_row_written: true`); same with `Prefer: code=409` → 409 `STALE_PIN`; `GET /lessons/G6.U4.L4/issues` → 200 (`blocks: [submit, approve]`, `resolvable: false` on the link); `GET /units/g6-u4/board` with `Prefer: example=serviceBusy, code=503` → 503 `SERVICE_BUSY` |
| Prism note | — | for a schema-invalid body Prism answers with the operation's own 422 example (its convention), while the real backend answers 400 `INVALID_REQUEST`. A known mock difference, not a contract gap |
| Types | `npx -y openapi-typescript@latest docs/contracts/interface.openapi.yaml -o docs/contracts/generated/api-types.ts` | `openapi-typescript 7.13.0` → `generated/api-types.ts` (2,797 lines); `npx -y -p typescript@5 tsc --noEmit --strict docs/contracts/generated/api-types.ts` → no errors |
| Traceability | `python3 -I .claude/skills/ux-pipeline/scripts/trace_check.py --upto CON` | `trace_check --upto CON: 0 fail(s); 44 requirements in scope; US=37, FLOW=19, SCR=21, CON=24; contracts from docs/contracts` |
| Readiness probe | `python3 .claude/skills/zero-to-hero/scripts/ticket_readiness.py check docs/plans/tickets/probe-backend-CON-3.json --root .` | only the §6 gate line remains (`the §6 Design gate is not ticked`); the CON-3 status line is gone, so the card reads as `agreed` |
