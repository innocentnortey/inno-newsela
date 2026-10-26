# GEN-5 — seam audit: nav "Unit board" link and the real version id in review heartbeats

Plan only (2026-10-26, wave w10). Implementer: Sonnet, one worktree, affected tests only. Do not touch `apps/collab`,
`packages/db` job-queue / issues / lessons repos. Never touch `docs/source/restricted` or provider keys.

## What is wrong, in plain words
1. `apps/web/src/features/frame/nav.ts:18` always links "Unit board" to `/units/g6-u4/board`. Any other unit, or a deploy
   without that seed, gets the wrong board or a 404.
2. `apps/web/src/features/workspace/workspace-screen.tsx:69` sends the heartbeat `version_id` as `lv-${version_number}`.
   `HeartbeatService.record` (apps/web/src/server/services/heartbeat-service.ts) passes it verbatim to
   `MetricsRepo.insert_heartbeat` (packages/db/src/repos/metrics.ts:49-90), which keys `review_session` on
   (user_id, lesson_id, version_id). So review time is stored against an id that is not a lesson version (S-18).

## Facts found (so the implementer need not search)
- The service already knows the real id: `LessonReadService.get_lesson_traced` returns `{ lesson, version_id }`
  (lesson-read-service.ts:80, :183; `Source.version_id` = snapshot id for submitted/approved/exported, else
  `row.current_version_id`, which may be null). The route `lesson-read-routes.ts` logs it and **drops it** from the body.
- The wire `Lesson` (packages/schema/src/api/lessons.ts:86-93, OpenAPI `Lesson` at interface.openapi.yaml:2310) has only
  `version_number` and `snapshot.version_id` (snapshot is null before `submitted`). Reviewers heartbeat during
  `in_review`, so `snapshot` cannot serve. => the field is missing => **this is CHG-3** (CON-11).
- `Heartbeat.version_id` is already `z.string()` required (packages/schema/src/api/review.ts:55); no CON-20 change.
- Units list: `GET /units` -> `Unit{unit_id, unit_key, title, versions[{created_at,...}], latest_run|null}`;
  already read by `features/units-home/use-units-home.ts`.
- `AppFrame` (frame/app-frame.tsx) calls `buildNav(role, pathname)`; `units-home-screen.tsx:24` also calls
  `buildNav(role,"/units")` only to find the prompt-guidance item (unaffected).
- Existing nav tests: apps/web/tests/unit/features/frame/nav.test.ts (asserts labels and `current` ids); e2e
  apps/web/e2e/frame/nav.spec.ts (mock harness, `signInAs`, `apiGlob`).
- Real-stack e2e pattern: apps/web/e2e/integration/con-20/ (`seed.ts`: ensureSeeded/freshUnit/seedLesson; `tabs.ts`:
  userContext/forceFocus/lessonUrl/logBeats; `../support/db.ts`: `db().count(table, where, params)`), config
  playwright.real.config.ts (E2E_PORT, default 3121).

## Part 1 — nav Unit board link (frame only, no contract change)
Decision (made, recorded as an assumption): the link points at the unit in view; if none, the most recent unit; if none
or the list is loading/failed, `/units`.

Files (all in `apps/web/src/features/frame/`):
1. `nav.ts`
   - Remove the hard-coded href. `NAV_ENTRIES` board entry gets `href: "/units"` as a placeholder only if needed by the
     type; better: build the board entry inside `buildNav`.
   - New signature `buildNav(role, pathname, fired = FIRED_CUTS, unitKey: string | null = null)`.
     Board href = `unitKey ? `/units/${encodeURIComponent(unitKey)}/board` : "/units"`.
   - Export pure helpers:
     - `unitKeyFromPath(pathname): string | null` — matches `^/units/([^/]+)(/|$)`, returns the segment (decoded) unless
       it is empty; `/units` alone -> null.
     - `pickRecentUnitKey(units: {unit_key:string; versions:{created_at:string}[]; latest_run:unknown|null}[]): string | null`
       — unit whose newest `versions[].created_at` is max (ties: the one with a `latest_run`, then first); `[]` -> null.
   - "Current" logic: keep the longest-prefix rule. When the board href falls back to `/units`, it equals the Units href;
     tie-break so the Units entry stays the single current one (board must not also be current). Guard: skip the board
     entry as `best` when its href === "/units".
   - The fallback entry still shows (label "Unit board") so the nav shape and e2e `getByRole("link",{name:"Unit board"})`
     stay stable.
2. New `use-nav-unit.ts` (client hook): `useNavUnitKey(pathname): string | null`.
   - `fromPath = unitKeyFromPath(pathname)`; if non-null return it (and remember it in module-level variable so the next
     non-unit page, e.g. /prompt-guidance, still points at the last unit seen).
   - Else, fetch `api.GET("/units")` once per mount of the frame (guard with `alive`, swallow errors -> null), apply
     `pickRecentUnitKey`. Use the remembered key first while the fetch is in flight. No polling.
   - Do not fetch on `/sign-in` or while the session is not ready (the gate renders children only when signed in; place
     the hook call inside `Shell`, which is under `SessionGate`).
3. `app-frame.tsx`: `const unitKey = useNavUnitKey(pathname); buildNav(role, pathname, undefined, unitKey)`.

Tests:
- Unit, extend `apps/web/tests/unit/features/frame/nav.test.ts`: board href with a key; with `null` -> `/units` and
  Units remains the only current; `unitKeyFromPath` cases (`/units/g6-u4/board`, `/units/g6-u4/lessons/L5`, `/units`,
  `/elsewhere`, encoded key); `pickRecentUnitKey` (newest version wins, tie-break, empty list). Keep existing assertions
  green (existing `cur("/units/g6-u4/board")` expects `board`: call `buildNav` with `unitKey = "g6-u4"` there).
- Unit for the hook: new `apps/web/tests/unit/features/frame/use-nav-unit.test.tsx` — mocks `@/lib/api-client`; path with
  key makes no request; `/units` path requests once and returns the most recent key; request failure returns null.
- Playwright (mock project) — add to `apps/web/e2e/frame/nav.spec.ts` (or new `nav-unit-board.spec.ts`): route
  `GET /units` (via `apiGlob("/units")`) to return two units (`g6-u4` older, `g7-u2` newer); sign in, go to `/units`,
  assert the "Unit board" link `href` ends `/units/g7-u2/board`; click it and assert URL. Second test: `/units` returns
  `{units: []}` -> link href is `/units`. Third: visiting `/units/g6-u4/board` keeps the link on g6-u4 even if the list
  says g7-u2 is newer. Remove all own `.next`/`test-results` after.

## Part 2 — real version id in the heartbeat (S-18) — CHG-3
Contract change first, then code, in one change set.

A. `docs/contracts/CHANGES.md`: add row **CHG-3** (date 2026-10-26, CON-11, aspect: field; kind: additive and
   behaviourally neutral for readers — one response field added, no promise removed; decided by: orchestrator under
   Innocent's PD-32 standing authorization; sources updated: INTERFACE.md CON-11 fields, openapi `Lesson`, Zod
   `Lesson`, regenerated `api-types.ts`, lesson-read service + route, workspace heartbeat; waiting to reconcile: none
   beyond mock fixtures changed in this ticket; status `reconciled` once merged). Follow the five-step procedure in that
   file; set CON-11 to `changing` while editing and back to `agreed`.
B. `docs/contracts/INTERFACE.md` CON-11 Response bullet list: add `version_id` — "the id of the version shown: the
   snapshot's id for submitted and later, else the current working version's id; `null` only when the lesson has no
   version yet. The review heartbeat (CON-20) sends this value." Add a line to the CON-20 card that `version_id` is the
   CON-11 `version_id`. Update the changes table row in INTERFACE.md if it lists CON-11 changes.
C. `docs/contracts/interface.openapi.yaml` `Lesson` (line ~2310): add `version_id: { type: [string, 'null'], description: ... }`
   to `required` and `properties`; add `version_id` to any `Lesson` example in the file. Bump OpenAPI patch version
   (1.0.0 -> 1.0.1) if the file's `info.version` convention in CHANGES says so.
D. `packages/schema/src/api/lessons.ts` `Lesson`: add `version_id: z.string().nullable()` next to `version_number`.
   Run `pnpm`/`npm` script for types without installing: in `apps/web` run the existing `api:types` script
   (`openapi-typescript ../../docs/contracts/interface.openapi.yaml -o src/lib/api-types.ts`) and commit the regenerated
   `apps/web/src/lib/api-types.ts`. Do not run `npm ci` (use `scripts/link-node-modules.sh` if links are missing).
   Check `packages/schema/tests/contract/` for the OpenAPI-vs-Zod parity test and update it if it lists fields.
E. `apps/web/src/server/services/lesson-read-service.ts` (owned: `lesson-read*`): in the `lesson` literal (line ~140)
   add `version_id: src.version_id,`. Keep `get_lesson_traced`'s return shape (route still logs it); the route may keep
   `r.lesson` as is since the field is now inside it. Add a unit test in `lesson-read-service.test.ts` (use
   `lesson-read-fixtures.ts`): in_review lesson -> `lesson.version_id === current_version_id`; frozen lesson ->
   `lesson.version_id === snapshot.version_id`; no current version -> `null`. Fixtures may need the field: only add what
   typecheck demands.
F. Fixtures/mocks that build a wire `Lesson`: typecheck will list them (`apps/web/e2e/workspace-read/fixtures.ts`,
   `apps/web/e2e/approval/fixtures.ts`, `apps/web/src/test-utils/fixtures*`, workspace unit fixtures). Add
   `version_id` (use `lv-…` style placeholders there; they are mocks) with the smallest edits. If one belongs to a file
   outside your ownership and trivially needs one line, make that one line and list it in the dev log; do not refactor.
G. `workspace-screen.tsx:66-69`: replace the made-up id.
   ```ts
   const versionId = lesson?.version_id ?? null;
   useReviewHeartbeat({ lessonId: lesson?.lesson_id ?? "", versionId: versionId ?? "", enabled: lesson !== null && versionId !== null });
   ```
   Delete the "carries no version id (S-18)" comment and replace it with one line saying the id comes from CON-11. No
   id is ever invented; a lesson with `version_id: null` sends no heartbeat (it cannot be reviewed yet).
   `use-review-heartbeat.ts` keeps its `versionId: string` argument (no change needed); make sure an `enabled=false`
   path starts no timer (it already returns when `!active`).
   `approval-screen.tsx` also calls `useReviewHeartbeat`: read how it derives `versionId`; if it uses the snapshot id
   that is already real, leave it; if it uses `lv-${...}`, switch to `lesson.version_id` the same way.
H. Tests
   - Unit, new `apps/web/tests/unit/features/workspace/heartbeat-version-id.test.tsx` (or extend an existing workspace
     test): render the hook inputs through the screen or test a small exported helper `heartbeatArgs(lesson)`; assert
     real id passed, and `enabled:false` when `version_id` is null. Prefer extracting the helper into
     `features/workspace/actions/heartbeat-args.ts` for a plain unit test.
   - Mock Playwright (existing `apps/web/e2e/workspace-read` harness): with fake timers or `HEARTBEAT_MS` wait, capture
     the POST `/lessons/{id}/heartbeats` body and assert `version_id` equals the mocked `Lesson.version_id` (not `lv-N`).
     Only if the existing harness makes this cheap; otherwise rely on the real-stack check below.
   - **Real-stack check (required):** new `apps/web/e2e/integration/con-20/review-session-real-version.spec.ts`
     modelled on the second test of `heartbeat-capture.spec.ts`: `ensureSeeded`, `freshUnit`, `createUser("reviewer", {synthetic:false})`,
     `seedLesson({state:"in_review", reviewer_id})`, open `lessonUrl(unit_key, lesson_key)` with `forceFocus(page,{focused:true,visible:true})`,
     move the mouse so a beat fires (first beat at 15 s; allow up to 40 s), then via `db()` query:
     `SELECT version_id FROM review_session WHERE lesson_id=$1` -> exactly one row whose `version_id` equals the
     lesson's real current version id (`SELECT current_version_id FROM lesson_state WHERE lesson_id=$1`, confirm table
     and column names in `packages/db` migrations / `seed.ts`), and assert it does **not** match `/^lv-\d+$/`. Also
     `GET /api/lessons/{id}` returns the same `version_id`. If `db()` has no raw query helper, add the smallest `rows(sql, params)`
     method to `support/db.ts` (test support, not an owned-file conflict; mention it in the log).
   - Update the existing heartbeat specs only if they assert `lv-1` against a real FK-like constraint (they post a
     literal and expect 2xx; leave them unless they fail).

## Order, gates, commands
1. CHG-3 docs + OpenAPI + Zod + regenerated types + service + tests (Part 2 A-F) -> typecheck `apps/web` and
   `packages/schema`.
2. Part 2 G-H.
3. Part 1.
Affected tests only: `vitest` on `tests/unit/features/frame`, `tests/unit/features/workspace`,
`src/server/services/lesson-read-service.test.ts`, packages/schema contract tests; Playwright mock spec `e2e/frame`
(+ workspace-read if touched); real-stack spec only the one new file. Own random `E2E_PORT`; `next build` + `start`
(never `next dev`); test DB only via `scripts/test-db.sh up` (never `down`); delete your `.next` and `test-results`;
kill only your own processes. Single reviewer, contract-focused (CHG-3 consistency across INTERFACE / OpenAPI / Zod /
types / service).

## Ownership and risks
- Files you may edit: `apps/web/src/features/frame/**`, heartbeat code in `apps/web/src/features/workspace/**`,
  `apps/web/src/server/services/lesson-read*`, `packages/schema/src/api/lessons.ts`, the contract docs for CHG-3,
  regenerated `apps/web/src/lib/api-types.ts`, test files named above, minimal fixture lines.
- Risk: making `version_id` required breaks every consumer fixture; mitigated by typecheck-led one-line edits.
- Risk: two other slices may also add CHG rows; take the next free number at merge time (CHG-3 assumed) and rebase the
  table row.
- Risk: `/units` fetch in the frame adds one request per page load; accepted (cached per frame mount, skipped when the
  path already names a unit).

## Acceptance
- Nav "Unit board" opens the unit in view, else the newest unit, else `/units`; no `g6-u4` literal remains in `frame/`.
- `GET /lessons/{id}` returns `version_id`; the heartbeat body carries it; the stored `review_session.version_id` is the
  real version id (real-stack test); no `lv-${` remains in `workspace-screen.tsx`.
- CHG-3 row present and `reconciled`; CON-11 back to `agreed`; OpenAPI, Zod and generated types agree.
