# CHG-3 + CHG-4: contract change slice (CON-18 optional pin on request_changes/reopen; CON-16 `Candidate.note`)

Not a numbered ticket. Lane `lane::build-loop`. **risk::security: YES** (CHG-3 is server-side transition/approval-integrity logic). The `test-writer-agent` must freeze the STALE_PIN tests (list in section 7) BEFORE the implementer starts; manifest `docs/plans/frozen-tests/CHG-3.manifest.json` (same shape as `NL-25.manifest.json`: `ticket`, `risk`, `frozen{path:sha256}`, `criteria{AC:[paths]}`). Security agent reviews the CHG-3 diff at the wave merge. CHG-4 is not security (but see Risks 4).

Procedure: `docs/contracts/CHANGES.md` five steps. Step 2 (reviews) is recorded in the rows below; both changes are additive and optional-on-request, so no product meaning changes and no Innocent decision is needed (decided by the orchestrator under Innocent's standing PD-32 authorization, 2026-10-25).

**DB migration: NONE needed.** CHG-4 reads `lesson_job.reviewer_note` (column exists since `packages/db/migrations/0004_runs.sql` line 54; `CandidateService.regenerate` already writes it via `create_candidate_job({... reviewer_note: note})`). CHG-3 stores nothing new.

## 1. Goal and sources

- **CHG-3 (CON-18, behavioural, additive):** `RequestChanges` and `Reopen` accept OPTIONAL `snapshot_hash` + `snapshot_state_vector`. When supplied, the server compares them to the lesson's current snapshot inside the locked transaction and refuses `STALE_PIN` (409) exactly as Approve does, at the same precedence position (after INVALID_TRANSITION and NOTE_REQUIRED/REASON_REQUIRED, before anything else). When absent, behaviour is unchanged. The send-back dialog (SCR-15, NL-69) sends the pin it already holds and keeps its client-side pre-check. Approve is not touched.
- **CHG-4 (CON-16, presentation-plus-field, additive):** `Candidate.note` (string or null) = the `RegenerateRequest.note` given for that candidate (trimmed; empty = null). SCR-12 (NL-67) header shows `note: <note>` only when present.
- Sources: `docs/contracts/INTERFACE.md` CON-18 (line ~1088) and CON-16 (line ~985); `docs/contracts/CHANGES.md`; `docs/contracts/interface.openapi.yaml` (`transitionLesson` ~1342, `regenerateLesson` ~1107, schemas `RegenerateRequest`/`Candidate` ~2443, `Approve`/`RequestChanges`/`Reopen` ~2547); `docs/ux/03-structure/SCREEN_SPECS.md` SCR-12 (line 585: "…pinned prompt · note: <note>") and SCR-15; NL-47/NL-53/NL-67/NL-69 plans in this folder.

## 2. Boundary

**Owned (create/modify) by this slice:**
- Contracts/docs: `docs/contracts/INTERFACE.md` (CON-16, CON-18 cards only + card index status), `docs/contracts/CHANGES.md` (rows CHG-3, CHG-4), `docs/contracts/interface.openapi.yaml`, `docs/contracts/generated/api-types.ts` (regenerate), `docs/ux/03-structure/SCREEN_SPECS.md` (SCR-15 pin line, SCR-12 header only if wording needs it), `docs/devlog/2026-10-25-chg-3-4.md` (new), `.claude/reference/area-map.md` (append to the A12/A14 rows), `PROJECT-CHECKLIST.md` only if a line cites `reconcile: CHG-3/4` (grep first).
- Schema: `packages/schema/src/api/transition.ts`, `packages/schema/src/api/lessons.ts`, `packages/schema/tests/contract/transition-input.test.ts`, `packages/schema/tests/contract/mutations.test.ts`, `packages/schema/tests/contract/examples.test.ts` only if it breaks.
- Server: `apps/web/src/server/services/transition-service.ts`, `apps/web/src/server/services/transition-service.fixtures.ts`, `apps/web/src/server/services/transition-service.test.ts`, `apps/web/src/server/services/transition-service.security.test.ts`, `apps/web/app/api/lessons/[lessonId]/transitions/route.test.ts`, `.../route.security.test.ts`, `apps/web/src/server/services/candidate-service.ts`, `candidate-service.test.ts`, `candidate-fixtures.ts`.
- Port + repo (one-line additive): `packages/core/src/ports/job-queue.ts` (`JobRow`), `packages/db/src/repos/job-queue.ts` (`JOB_COLUMNS`, `to_job_row`), `packages/db/src/repos/job-queue.int.test.ts` (one assertion), `packages/core/src/testing/fake-job-queue.ts` (return the note).
- Web: `apps/web/src/lib/api-types.ts` (generated), `apps/web/src/features/send-back/{copy.ts,send-back-form.tsx}`, `apps/web/tests/unit/features/send-back/send-back-dialog.test.tsx`, `apps/web/e2e/send-back/send-back.spec.ts`, `apps/web/src/features/candidate/{candidate-header.tsx,candidate-screen.tsx,copy.ts}`, `apps/web/tests/unit/features/candidate/candidate-screen.test.tsx`, `apps/web/e2e/candidate/{fixtures.ts,candidate.spec.ts}`, `apps/web/e2e/approval/approval.spec.ts` + `approval/stubs.ts` (new tests, section 5 step 11).

**Read only:** `apps/web/src/server/services/approve-service.ts` (do NOT edit; it is the reference and must stay as is), `packages/core/src/lifecycle/lesson-machine.ts`, `packages/core/src/ports/lesson-versions.ts`, `apps/web/src/features/approval/**` (read; pin source), `apps/web/src/lib/api-client.ts`.

**Must not touch:** `ApproveService`/Approve schema, `packages/db/migrations/**`, the collab server, the worker, other screens, any `package.json`/lockfile.

## 3. Requirements table

| # | Requirement | Implementation | Verification |
|---|---|---|---|
| R1 | CON-18 card: `request_changes` and `reopen` list optional `snapshot_hash`, `snapshot_state_vector`; STALE_PIN text and precedence note cover them | Step 1 | read card; `tests/contract` suite |
| R2 | Pin fields optional; absent = today's behaviour | zod: `.optional()`; service skips check when both undefined | `transition-input.test.ts`, `transition-service.test.ts` "no pin: unchanged" |
| R3 | Supplied pin mismatch -> 409 `STALE_PIN`, no write, same precedence slot as Approve | Step 4 (inside `move()` after the locked `decide`) | frozen tests F1-F8 (section 7) |
| R4 | Only one of the two fields supplied -> 400 `INVALID_REQUEST` (decision made here; avoids a half pin silently passing) | Step 4 | F9 |
| R5 | Approve unchanged and not weakened | no edit to `approve-service.ts`; existing approve tests (`route.security.test.ts`, `transition-service.security.test.ts`) stay green | existing suites green |
| R6 | SCR-15 sends the pin AND keeps its `readFreshLesson` pre-check | Step 7 | unit + e2e (step 11) |
| R7 | CON-16 `Candidate.note` string or null = trimmed regenerate note | Steps 1,2,5 | `candidate-service.test.ts` |
| R8 | SCR-12 header shows `note: <note>` only when present | Step 8 | unit + `candidate.spec.ts` |
| R9 | INTERFACE.md cards `changing` then `agreed`, markers cleared; OpenAPI/zod/api-types/Prism consistent | Steps 1-3, 12 | `npm run api:types` diff clean; contract tests; Prism e2e |
| R10 | Approver path SCR-14 -> SCR-15 has browser coverage incl. STALE_PIN | Step 11 | `e2e/approval` specs |

## 4. Shared code to use (copied from main)

```ts
// packages/schema/src/api/common.ts
export const NullableText = z.string().nullable();           // line 13
// Sha256, StateVector are exported from the same file
// packages/schema/src/api/transition.ts (current)
export const RequestChanges = z.object({ action: z.literal("request_changes"), tag: SendBackTag, note: z.string() }).strict();
export const Reopen = z.object({ action: z.literal("reopen"), reason: z.string() }).strict();
const RequestChangesInput = RequestChanges.extend({ note: RequestChanges.shape.note.nullish() }).strict();
const ReopenInput = Reopen.extend({ reason: Reopen.shape.reason.nullish() }).strict();
// apps/web/src/server/services/transition-service.ts
type Moving = Exclude<TransitionRequestInput, { action: "submit" } | { action: "approve" }>;
private async move(user: RequestUser, lesson_id: LessonId, req: Moving): Promise<TransitionResult>
//   inside: const locked = await this.states.lock_for_update(lesson_id, tx); ... const d = this.decide(user, locked.state, req, lesson_id);
// this.versions.latest_snapshot(lesson_id): Promise<LessonVersionRow | null>   (fields content_hash, state_vector: string | null, kind)
// Approve's refusal (copy the code and message):
//   throw new DomainRefusal("STALE_PIN", "The lesson changed since you opened it. Reload and read it again.", { request_id: user.request_id });
// apps/web/src/server/services/candidate-service.ts: view(): `const job = (await this.queue.jobs_for_run(run_id)).find(...)`; regenerate(): `const note = trimmed === "" ? null : trimmed;`
// packages/core/src/ports/job-queue.ts: JobRow (line 44) has no reviewer_note today; CreateCandidateJob has `reviewer_note: string | null`.
// packages/db/src/repos/job-queue.ts: to_job_row(r) line 22; JOB_COLUMNS line 32 (jobs_for_run uses JOB_COLUMNS).
// apps/web/src/features/send-back/copy.ts: buildRequestChanges(tag: SendBackTag, note: string); buildReopen(reason: string)
// send-back-form.tsx: props.pin = { snapshotHash, snapshotStateVector }; client check at "fresh.snapshot?.content_hash !== pin.snapshotHash".
```
Error `INVALID_REQUEST` (400) already exists with `details.fields` (see `candidate-service.ts` adopt: `{ fields: ["body.section_address"] }`).

## 5. Steps (build order)

1. **Contract sources (CHANGES step 3).** In `INTERFACE.md`: set CON-16 and CON-18 `Status: changing` first; edit, then back to `agreed` in the same change (also the card index rows ~80, 82).
   - CON-18 Request fields: `request_changes`: `tag`, `note`, and OPTIONAL `snapshot_hash`, `snapshot_state_vector` (both or neither; one alone -> `INVALID_REQUEST`); `reopen`: `reason` + same optional pair. Update the `STALE_PIN` bullet ("the pinned hash or state vector, when supplied, does not match the current snapshot"), precedence line (`STALE_PIN` (approve; request_changes and reopen when a pin is supplied)), and the Recovery sentence (the sender reloads). Add one Guarantees bullet: "Request changes and Reopen may carry the pin the person was reading; if supplied it is checked inside the same locked transaction as Approve's, so a send-back can never act on text the person did not see. Absent pin: unchanged. Approve is unchanged."
   - CON-16 Response: add `note` (text or null: the optional note given to `regenerateLesson` for this candidate, trimmed; null if none). `getCandidate` and `regenerateLesson` both return it.
   - Add a Reviews bullet naming CHG-3/CHG-4. Do not use a `reconcile:` marker left behind; add `reconcile: CHG-3` / `CHG-4` to every spot listed in step 12 FIRST, remove as each is reconciled.
2. **OpenAPI** (`interface.openapi.yaml`): in `RequestChanges` and `Reopen` add
   `snapshot_hash: { $ref: '#/components/schemas/Sha256' }` and `snapshot_state_vector: { $ref: '#/components/schemas/StateVector' }` (not in `required`) plus `dependentRequired: { snapshot_hash: [snapshot_state_vector], snapshot_state_vector: [snapshot_hash] }` (if Prism or `openapi-typescript` rejects it, drop it and keep the description sentence). In `Candidate` add `note: { type: [string, 'null'], description: ... }` NOT in `required` (so existing typed fixtures keep compiling; the server always sends it). Update `transitionLesson` description (one sentence) and add request examples `requestChangesPinned`, `reopenPinned` beside `approveLesson5`; add `note: Make the Look Back Quick Write more open-ended.` to the `queued` example of `regenerateLesson` and a `note` on the `getCandidate` example (`cand-4-2`). Keep `x-con` unchanged. Add `x-named-errors: INVALID_REQUEST` is already a common 400; no change.
3. **Zod** (`packages/schema/src/api/transition.ts`): add to `RequestChanges` and `Reopen` the two fields `snapshot_hash: Sha256.optional()`, `snapshot_state_vector: StateVector.optional()` (do not add a `.refine`; the pairing rule is enforced in the service so `z.discriminatedUnion` keeps working). `RequestChangesInput`/`ReopenInput` inherit via `.extend`. In `lessons.ts` `Candidate` add `note: z.string().nullable().optional()` (update the parity type test `packages/schema/tests/contract/api-types-parity.test-d.ts` only if it fails). Regenerate types: `cd apps/web && npm run api:types`; and refresh `docs/contracts/generated/api-types.ts` the same way (see `packages/schema/tests/contract/emitted-current.test.ts` for how it is compared; run it).
4. **Server pin check** (`transition-service.ts`, `move()`), right after `const d = this.decide(...)` and before the version/`reopen` branch:
   1. `const has_hash = "snapshot_hash" in req && req.snapshot_hash !== undefined;` same for vector. Narrow `req` via `req.action === "request_changes" || req.action === "reopen"`.
   2. If exactly one is present: throw `new DomainRefusal("INVALID_REQUEST", "The request is not valid.", { fields: [has_hash ? "body.snapshot_state_vector" : "body.snapshot_hash"] })` (invariant: no half pin passes as "no pin").
   3. If both present: `const snap = await this.versions.latest_snapshot(lesson_id);` if `snap === null || snap.content_hash !== req.snapshot_hash || snap.state_vector !== req.snapshot_state_vector` throw the SAME `STALE_PIN` DomainRefusal as `approve-service.ts` (identical message and `{ request_id: user.request_id }`). Compare to the latest snapshot of ANY kind (a submitted lesson's is `submit`; an approved/exported lesson's is `approve`, carrying the same hash and vector; this is exactly what `lesson-read-service.ts` line ~260 returns as `Lesson.snapshot`, which is where the UI pin comes from). Invariant protected: the pin check sees the same row the screen showed.
   4. Order inside `move()` therefore: ROLE_FORBIDDEN, NOT_FOUND (both in `transition()`), INVALID_TRANSITION / NOTE_REQUIRED / REASON_REQUIRED (the locked `decide`), then pin. The throw happens before any write and before `set_mode`, so the transaction rolls back with nothing changed and no collab call. The `catch` block's `mode_set` path is not reached.
   5. Do not call the pin check from `submit`, `withdraw`, `start_review`, `approve`. Withdraw has no pin fields (strict schema rejects them).
   6. `route.ts` needs no change (it validates with `TransitionRequestInput`); confirm by test F1.
5. **CHG-4 server.** (a) `packages/core/src/ports/job-queue.ts` `JobRow`: add `reviewer_note?: string | null;` (optional on purpose so the existing fakes/literals compile; comment: kind "candidate" only, never logged). (b) `packages/db/src/repos/job-queue.ts`: append `, reviewer_note` to `JOB_COLUMNS`; in `to_job_row` add `reviewer_note: r["reviewer_note"] ?? null`. Check no other query reuses `JOB_COLUMNS` in a way that breaks (`grep -n JOB_COLUMNS`). (c) `packages/core/src/testing/fake-job-queue.ts` and `apps/web/src/server/services/candidate-fixtures.ts` (line ~243 already stores `reviewer_note`): make `jobs_for_run` return it. (d) `candidate-service.ts`: in `view()` set `note: job.reviewer_note ?? null` on `candidate`; in `regenerate()`'s fresh return add `note,` (the trimmed value, `string | null`). The in-flight branch returns `view()` so it carries the stored note. Keep the existing rule "note text never goes into the audit row".
6. **Web client types**: nothing else; `api-client.ts` is generic over the regenerated `api-types.ts`.
7. **SCR-15** (`send-back/copy.ts`, `send-back-form.tsx`): change `buildRequestChanges(tag, note, pin)` and `buildReopen(reason, pin)` where `pin: { snapshotHash: string; snapshotStateVector: string }` and the body adds `snapshot_hash: pin.snapshotHash, snapshot_state_vector: pin.snapshotStateVector`. Update the comment above them (it says "no pin fields; see plan Risks 1"). In `submit()` KEEP the `readFreshLesson` pre-check unchanged and pass `pin` to the builders. `STALE_PIN` handling (`handleStale`) already exists. Do not weaken or reorder the pre-check.
8. **SCR-12** (`candidate/candidate-header.tsx`, `candidate-screen.tsx`, `copy.ts`): add prop `note?: string | null` to `CandidateHeaderProps`; in `meta`, render after `{META}`: `{p.note ? <> · note: {p.note}</> : null}` using a copy helper `export const NOTE = (n: string): string => \`note: ${n}\`;` in `copy.ts` (replace the stale comment on `META` that says CON-16 has no note). Pass `note={candidate.note ?? null}` in `candidate-screen.tsx`. Render as text (React escapes); no `dangerouslySetInnerHTML`. Empty or null renders nothing (no "note:" label).
9. **Unit tests (written with the code, except frozen F1-F9 which the test-writer provides):**
   - `packages/schema/tests/contract/transition-input.test.ts`: RequestChanges and Reopen parse with and without the pair; a body with unknown extra key still fails (`.strict()`).
   - `packages/schema/tests/contract/mutations.test.ts`: add a pinned RequestChanges and Reopen row to the oracle list near line 65.
   - `apps/web/src/server/services/candidate-service.test.ts`: `regenerate_returns_trimmed_note`, `regenerate_without_note_returns_null`, `get_returns_stored_note`, `in_flight_returns_existing_note`.
   - `packages/db/src/repos/job-queue.int.test.ts`: one assertion that `jobs_for_run` returns the candidate job's `reviewer_note` (integration; needs `scripts/test-db.sh up`, stop with `down`).
   - `apps/web/tests/unit/features/send-back/send-back-dialog.test.tsx`: POST body for request_changes and reopen includes both pin fields; pre-check mismatch still closes via `onStale` WITHOUT calling POST (existing test, keep); server `STALE_PIN` still handled.
   - `apps/web/tests/unit/features/candidate/candidate-screen.test.tsx`: header shows `note: Make the Look Back Quick Write more open-ended.` when present and no "note:" text when null/absent.
10. **Playwright (candidate + send-back):** `e2e/candidate/fixtures.ts` give `CAND_READY` a `note`; `candidate.spec.ts` asserts the header text with note, and a case with `note: null` shows no "note:". `e2e/send-back/send-back.spec.ts`: extend the existing sent-back and reopen tests to assert `ctl.posted` equals `{ action, tag, note, snapshot_hash: HASH_A, snapshot_state_vector: SV_A }` (and `{ action: "reopen", reason, ...pin }`); keep the existing STALE_PIN test.
11. **Playwright (approver path, coordinator addition)** in `apps/web/e2e/approval/approval.spec.ts` (append; reuse `open(page, init, {url})`, `stubApproval`, fixtures, `errorReply`; Prism mock for the unstubbed routes; the file is ~227 lines, add at most ~80 and split to `approval-send-back.spec.ts` if over 300). Use `E2E_PORT=3150` (range 3150-3159). Three tests:
    - `approver requests changes from the decision card`: `open(page)` on `URL5` (lesson5Submitted); click button "Request changes…" (the decision card button; check the real label in `decision-card.tsx`/`copy.ts`, send-back spec uses "Request changes…" in the harness); dialog "Request changes to Lesson 5" opens; choose tag "Standards", type a note; click "Send back"; assert `ctl.posted` is exactly `[{ action: "request_changes", tag: "standards", note: "<note>", snapshot_hash: HASH_A, snapshot_state_vector: SV_A }]` (confirm the tag value string from `SendBackTag` in `packages/schema/src/api/board.ts`); set `ctl.transition` to return `{ lesson_id:"G6.U4.L5", from_state:"submitted", to_state:"changes_requested", version:{version_id:"lv-5-2",version_number:2,content_hash:HASH_A,state_vector:SV_A}, audit_id:"aud-0151" }` AND flip `ctl.lesson` to `{...lesson5Submitted(), state:"changes_requested"}` so the post-send reload shows the new state; assert the screen shows the "Changes requested" step/state text (see `STATE_LABEL` in `approval-screen.tsx` line ~32) and the toast "Sent back to J. Rivera.".
    - `approver reopens an approved lesson`: `open(page, { lesson: lesson5Approved() })`; click "Reopen…"; fill reason; click "Reopen"; assert posted `{ action:"reopen", reason, snapshot_hash: HASH_A, snapshot_state_vector: SV_A }`; stub returns `to_state:"reopened"`, version_number 3; lesson flips to `state:"reopened"`; assert the toast "Lesson 5 reopened as version 3." and the reopened state.
    - `stale pin on send back is refused`: `ctl.transition = () => errorReply("STALE_PIN")`; send; assert the stale text from `STALE_TEXT` (`send-back/copy.ts`) is visible, the dialog is closed and the lesson state on screen is unchanged. A second variant: `ctl.lesson = lesson5Changed()` after open (client pre-check path) -> stale text shown and `ctl.posted` stays empty.
    Run: `cd apps/web && E2E_PORT=3150 npx playwright test e2e/approval e2e/send-back e2e/candidate`.
12. **Reconcile markers (CHANGES step 4) and log.** Grep for citations of the changed cards: `grep -rn "CON-18\|CON-16" docs/plans/tickets docs/ux docs/design apps packages --include=*.md --include=*.ts --include=*.tsx -l` and mark `reconcile: CHG-3` / `reconcile: CHG-4` in a note on each item that this slice does NOT itself reconcile (expected: `docs/design/component-contracts.md` DO-4 §5 TransitionRequest block, `docs/plans/tickets/NL-53.md`, `NL-68.md`, `NL-69.md`, `NL-47.md`, `NL-67.md`, `docs/devlog/2026-10-25-w4-nl69.md`, `docs/ux/.../SCREEN_SPECS.md` SCR-12/SCR-15); then in this same change reconcile them (edit the DO-4 block, the two screen specs and add a one-line "Reconciled by CHG-3/4" in the tickets), and remove each marker. Add to `CHANGES.md`:
    - `CHG-3 | 2026-10-25 | CON-18 | field + error (STALE_PIN scope) | behavioural, additive: optional pin on request_changes and reopen; absent = unchanged | …` Sources updated: INTERFACE.md CON-18, openapi (RequestChanges, Reopen, transitionLesson), zod, both api-types, DO-4 §5, SCR-15, NL-69 code; Waiting: none after this change; Status reconciled.
    - `CHG-4 | 2026-10-25 | CON-16 | field (Candidate.note) | additive, presentation-visible on SCR-12 | …` same shape.
    Decided by "orchestrator under Innocent's PD-32 standing authorization (2026-10-25)". Devlog `docs/devlog/2026-10-25-chg-3-4.md` (Changed, Why, Checked, Remaining) and area-map append (A12 candidate/transition rows: "CHG-3/4: pin on send-back, Candidate.note").

## 6. Data and fixtures

Synthetic only: reuse `HASH_A`, `HASH_B`, `SV_A`, `SV_B`, `lesson5Submitted/Approved/Changed` from `apps/web/e2e/approval/fixtures.ts`; service tests reuse `transition-service.fixtures.ts` (`HASH`, `VEC`, `HASH2`, `VEC2`, `approve_body`, `build({state})`, `t.w.add_version`); add `request_changes_body(over)` and `reopen_body(over)` helpers beside `approve_body` (line ~325). Candidate note text: "Make the Look Back Quick Write more open-ended." (the OpenAPI example).

## 7. Checks

Frozen tests (test-writer writes first, red for the right reason; paths are the owned test files above; function names are the `it(...)` ids):
- F1 `route.security.test.ts` `request_changes_stale_hash_refused` and `request_changes_stale_vector_refused`: 409 `STALE_PIN`, `details.request_id` equals `X-Request-Id`, `t.w.counts()` unchanged, state still `submitted`.
- F2 `reopen_stale_pin_refused` on an approved lesson (and an `exported` one): 409 STALE_PIN, state unchanged, no new `reopen` snapshot version, no `set_mode` call.
- F3 `pin_matches_request_changes_succeeds` and `pin_matches_reopen_succeeds` (200, to_state `changes_requested` / `reopened`).
- F4 `no_pin_unchanged`: both actions succeed with no pin fields exactly as before (regression of existing behaviour).
- F5 precedence: `NOTE_REQUIRED`/`REASON_REQUIRED` and `INVALID_TRANSITION` win over a stale pin; a stale pin with an empty note answers `NOTE_REQUIRED`; wrong state answers `INVALID_TRANSITION`; `ROLE_FORBIDDEN` (reviewer sending `request_changes`) wins over everything and is not turned into STALE_PIN.
- F6 newer snapshot supersedes: `t.w.add_version("submit", "clean", HASH2, VEC2)` makes the old pin stale (mirrors the Approve test at line ~116).
- F7 `null_snapshot_is_stale`: a pin supplied when the lesson has no snapshot -> STALE_PIN, not a 500.
- F8 `approve_still_strict`: the existing Approve STALE_PIN/precedence tests stay byte-for-byte green (do not edit them).
- F9 `half_pin_rejected`: only hash or only vector -> 400 `INVALID_REQUEST`, nothing written; unknown extra field still 400.

Commands (iterate, repo root):
```
npx vitest run packages/schema/tests/contract
npx vitest run apps/web/src/server/services/transition-service apps/web/src/server/services/candidate-service
npx vitest run "apps/web/app/api/lessons/[lessonId]/transitions"
npx vitest run apps/web/tests/unit/features/send-back apps/web/tests/unit/features/candidate
cd apps/web && npm run api:types && git diff --stat src/lib/api-types.ts
scripts/test-db.sh up && npx vitest run packages/db/src/repos/job-queue.int.test.ts; scripts/test-db.sh down
cd apps/web && E2E_PORT=3150 npx playwright test e2e/approval e2e/send-back e2e/candidate
```
Must stay green: `approve-service` tests, `transition-service.security.test.ts`, `route.security.test.ts` (existing), `apps/web/tests/unit/features/approval/*`, `packages/core` job-queue fakes tests, `ports-surface.test-d.ts`, `tests/contract/emitted-current.test.ts`, `examples.test.ts`.
Once before the final commit: `npm run lint`, `npm run typecheck` (root), plus the affected tests above. Full suite NOT required (no dependency/config change); `JobRow` is a widely used port type but the change is optional-field additive, and the typecheck proves it.

## 8. Risks and requests

1. **Collisions:** `candidate-service.ts`, `transition-service.ts`, `job-queue.ts` (core port + db repo), `send-back/*`, `candidate/*`, `e2e/approval/*` were built by NL-47/53/67/68/69 (all merged); no unmerged ticket should own them. If a parallel slice edits `docs/contracts/interface.openapi.yaml` or `INTERFACE.md`, only the CON-16/CON-18 hunks here are ours; rebase, do not rewrite others' hunks. `packages/core/src/ports/job-queue.ts` is shared: change is one optional field.
2. **Decision made (not Innocent's):** optional on both request and response; half-pin = 400; compare to latest snapshot of any kind (so exported/approved reopen works); `Candidate.note` not in OpenAPI `required` so existing fixtures stay typed.
3. **NL-53 plan said "must not edit `TransitionRequestInput`"** (ticket text, tickets.md line 3881); this change supersedes it as a CHG; the planner's note belongs in the CHG row.
4. **Privacy:** `getCandidate` is readable by every role (CON-16), so an author viewing a guidance trial now sees the reviewer's note. The note is the reviewer's instruction to the model about that lesson, not a person's data; flagged for the security reviewer, no code gate added.
5. **dependentRequired:** if `openapi-typescript` 7.13.0 or Prism 5 chokes on it, fall back to the description-only sentence (zero behavioural effect, service enforces it).
6. **Playwright button labels** in step 11 (decision card "Request changes…" vs harness) must be read from `decision-card.tsx`/`copy.ts` before writing selectors; Prism is not used for stubbed routes (`stubApproval`).

## 9. Readiness

`READY`, with the gate that `test-writer-agent` freezes F1-F9 first (risk::security), and the security agent reviews the CHG-3 diff at the wave merge. No migration. No NEEDS-DECISION or BLOCKED-ON.
