# NL-127 follow-up: stored p95 miss (6,008 ms) and the 1,310 check.failed lines

Planner: Opus-class, code reading only (no load run). Slice lane: `lane::build-loop`. `risk::security`: no.
Readiness: **READY for F-A and F-B; F-C is NEEDS-DECISION (one question, see Risks).**

## 1. Goal and sources

Make the next spike's stored-latency figure trustworthy and explain it, and remove the check-failure noise.
Sources: `evals/reports/load-2026-10-26.md` (M-24 miss, F-4), `docs/devlog/2026-10-26-nl127-load-spike.md`, `docs/devlog/2026-10-26-w9-nl119b.md` ("Remaining": stored has the same drop contamination), `docs/plans/tickets/NL-119.md` (US-36: stored p95 < 3 s), `docs/design/system-design.md` section 4.1 table row 3 (debounce <= 2 s [T], store tx p95 <= 500 ms) and the 3.4 s budget.
Naming note: in `docs/design/metrics-registry.md` M-24 is *socket reconnect time* (<= 10 s). The stored target is US-36 / M-19's "p95 durably stored". The report's label "M-24 stored" is wrong; the devlog for this slice must say so (the report is NL-127's file, not edited here).

### Diagnosis (code only)

**(a) Outage contamination is not what produced 6.0 s.**
- `load/yjs-mix.ts` drops `ceil(0.05 * 140) = 7` sockets (`editors.slice(0, 7)`, once, mid-plateau). With `per = 3` and `typers = max(1, ceil(0.25*3)) = 1`, only editors 0, 3, 6 type, so at most 3 senders are affected.
- A dropped editor keeps typing into its local doc (`type_once` only checks `e.client === null`) until it resyncs; reconnect p95 was 9.95 s, so about 5 tokens per affected typer are sent while down, and they are acked late (up to about 10 to 14 s). That is at most about 15 of 22,533 stored samples (0.07%).
- A p95 only moves if more than 5% of samples are contaminated. The remote-edit side agrees: only 4 samples crossed a drop out of 44,612. So **outage contamination explains about 0 ms of the 6.0 s**. F-A is still correct hygiene (the devlog left it as a follow-up), but it will not by itself make the number pass. Do not tell anyone it will.

**(b) What the 6.0 s is made of (bounded by code, residual unmeasured).**
- The designed ceiling is already above 3 s: `packages/config/src/settings.ts` lines 234-235 default `STORE_DEBOUNCE_MS=2000`, `STORE_MAX_DEBOUNCE_MS=4000`, applied in `apps/collab/src/wiring/server.ts` lines 309-310. The load typers send one update every 2000 ms (`DEFAULT_TUNING.interval_ms`), exactly the debounce, so Hocuspocus keeps resetting its 2 s timer and stores at the 4 s max-debounce. A token's stored latency is then roughly uniform on 0 to 4 s plus the store transaction, so p95 is about 3.8 s + tx before any contention. The 3 s target cannot be met under continuous typing with these defaults, whatever Postgres does. (Design budget row 3 says "debounce <= 2 s"; the max-debounce of 4 s is not in the design.)
- The remaining about 2 s (6.0 minus about 4) is not explained by anything in the code path: `LessonPersistence.store` (`apps/collab/src/persistence.ts`) does `ydoc_to_lesson` + `content_hash` on the collab event loop, then `PgLessonDocStore.store` (`packages/db/src/repos/lesson-docs.ts`) runs one transaction under a per-lesson advisory lock (insert full Y.Doc snapshot, `enqueue`, `record_last_editor`, audit append). The `stored` ack is sent immediately after (`AckBroadcaster.stored`). Nothing there is slow by construction; the likely contributor is machine contention (NL-126 on the same 8 cores, load average about 8, report F-5) plus 47 lessons storing on one single-threaded collab process. The collab log line `collab.stored` already carries `duration_ms` (tx time), but the NL-127 stack was torn down, so it cannot be read back. F-C therefore starts with measurement in the re-run, not a guess.

**(c) The InvariantViolation is a fixture artefact plus a robustness gap; it is not a bug in the check refresh logic.**
- `CheckJobRunner.run_once` logs `check.failed` with `name: "InvariantViolation"` and `rule: null` (it is not a `RuleFailure`) from inside the `try` that wraps `issues.current`, `loader.load`, `run_checks` and the two `replace_for_hash` calls.
- The thrower is `CheckContextLoader.load` (`packages/core/src/checks/context-loader.ts` lines 36-52): the unit id is derived as `lesson_id.slice(0, lastIndexOf("."))` = `G6.U9`; it throws `InvariantViolation("no_outline_version: <lesson>")` when the unit has no outline version, or `lesson_has_outline_row` when the version has no row for the lesson. `seed_load_lessons` (`load/yjs-support.ts` lines 55-80) inserts `lesson` rows and a `lesson_doc` through `seed_initial` but **no `outline_version` and no outline rows** for `G6.U9`. Every Yjs load lesson therefore fails its check on every attempt. This matches the report (all 1,310 lines on Yjs lessons, none on the HTTP unit `G6.U1`).
- The count is explained by the retry design: a failed run does not call `finish`, so `claim()` re-offers the job when the 30 s lease (`CHECK_LEASE_MS`) expires, and every new store enqueues another job. 47 lessons x about 1,150 s of run / 30 s is about 1,800 attempts at most; 1,310 is the right order of magnitude. The same loop would hit any real lesson that loses its outline row, forever. That infinite retry of a permanent failure is a real gap but fixing it needs a new port method (see Risks, request R-1); it is not part of the minimal fix.
- It does not touch the stored latency: the failing job runs in the worker after the ack, and the store path only enqueues. Do not claim F-B fixes M-19 stored.

## 2. Boundary

Owned (create / modify):
- modify `load/yjs-mix.ts` (F-A)
- modify `load/yjs-stats.ts` (F-A: one new pure function)
- modify `load/yjs-stats.test.ts` (F-A test)
- modify `load/yjs-mix.int.test.ts` (F-A assertion)
- modify `load/yjs-support.ts` (F-B: seed outline for the load unit)
- create `load/yjs-check-fixture.int.test.ts` (F-B test)
- create `docs/devlog/2026-10-26-nl127-followup.md`
- modify `.claude/reference/area-map.md` only the existing A20 row text for `load/**` (append one clause, below)

Read only: `apps/collab/**`, `apps/worker/**`, `packages/**` (`@ls/db/testing/insert-row`, repos, `@ls/core/checks/context-loader`), `packages/config/src/settings.ts`, `docs/design/**`, `evals/reports/load-2026-10-26.md`.
Must not touch: `apps/collab/**`, `apps/worker/**`, `packages/**` (so no change to `CheckQueue`, `CheckJobRunner`, settings defaults, or `ops/seed.ts`), `evals/reports/**`, `load/spike.ts`, `load/cli.ts`, `load/report.ts`.

## 3. Requirements table

| ID | Requirement | Implementation | Verification |
|---|---|---|---|
| F-A1 | A stored sample whose sender was down at send, or whose socket dropped between send and ack, is excluded from `stored` and reported apart (nl119b devlog "Remaining") | `Sent` gains `up_at_send`, `epoch_at_send`; `onStateless` "stored" classifies with `is_clean_stored`; clean to `stored_samples`, others to `stored_drop_samples` | `npx vitest run load/yjs-stats.test.ts -t "stored sample"` |
| F-A2 | New `p95_json` keys: `stored_n`, `stored_p50`, `stored_during_drop`, `stored_during_drop_n`; key `stored` keeps its name and meaning (clean p95) | `p95_ms` object in `run_yjs_mix_detailed` | `npx vitest run load/yjs-mix.int.test.ts -t "forced drop"` (extended) |
| F-A3 | Every acknowledged token is in exactly one bucket | assertion `stored_n + stored_during_drop_n === acknowledged` (use `result.n - unacknowledged`) | same int test |
| F-B1 | The Yjs load lessons pass the real `CheckContextLoader.load` without `InvariantViolation` | `seed_load_lessons` also creates the unit's outline version and one outline row per lesson, idempotently | `npx vitest run load/yjs-check-fixture.int.test.ts` |
| F-B2 | After a 3-minute spike, worker log has 0 `check.failed` lines for load lessons | acceptance run (section 7) | `docker compose logs worker | grep -c check.failed` = 0 |
| F-C0 | The re-run reports stored p95 with n, p50 and the drop split, plus collab `duration_ms` p95 | acceptance run | section 7 |
| F-C1 | Any change to the store/debounce defaults | NOT in this plan | NEEDS-DECISION, Risks |

## 4. Shared code to use

From `load/yjs-stats.ts` (existing, keep unchanged):
```ts
export interface LinkView { sender_up: boolean; peer_up: boolean; sender_epoch: number; peer_epoch: number; }
export function is_clean_sample(at_send: LinkView, at_seen: LinkView): boolean
export function percentile(values: readonly number[], p: number): number   // nearest rank, empty = 0
```
Existing `load/yjs-mix.ts` shapes to extend (copy exactly):
```ts
interface Sent { t0: number; clock: number; acked: boolean; }
// Editor has: state: "connecting" | "up" | "down"; epoch: number; drop: {...} | null; sent: Map<string, Sent>
```
`e.sent.set(token, { t0, clock, acked: false });` is in `type_once`; the stored handler is `onStateless` with `m["type"] === "stored"`.
For F-B read how the existing integration test seeds an outline and standards: `apps/worker/src/checks/check-job-runner.int.test.ts` lines 55-150 (`insert_row(tx, "outline_version", { id: OV, unit_id: UNIT, number: 1 })`, the outline row insert next to it, and the fakes for the standard repo). Use the same `insert_row` from `@ls/db/testing/insert-row` that `load/yjs-support.ts` already imports. Real repo classes: `PgOutlineRepo, PgStandardRepo` from `@ls/db/repos/outlines`, `PgLessonRepo` from `@ls/db/repos/lessons`, `PgLessonDocReader` from `@ls/db/repos/lesson-doc-reads`, `PgAlignmentRepo, PgSuggestionRepo, PgSafetyFlagRepo` from `@ls/db/repos/review-extras`; `CheckContextLoader` constructor order is `(outlines, standards, graph, reader, suggestions, flags, alignment, clock)` as in `apps/worker/src/wiring/checks.ts`.

## 5. Steps

1. **F-A pure helper** in `load/yjs-stats.ts`:
   ```ts
   export interface SendView { up: boolean; epoch: number; }
   /** A stored sample is clean only if the sender's socket was up at send and never dropped before the ack. */
   export function is_clean_stored(at_send: SendView, at_ack: SendView): boolean {
     return is_clean_sample(
       { sender_up: at_send.up, peer_up: true, sender_epoch: at_send.epoch, peer_epoch: 0 },
       { sender_up: at_ack.up, peer_up: true, sender_epoch: at_ack.epoch, peer_epoch: 0 },
     );
   }
   ```
   Test `describe("stored sample")` in `load/yjs-stats.test.ts`: clean when up and same epoch; false when `at_send.up` false; false when epoch differs; false when `at_ack.up` false. Invariant: a sample across an outage measures the outage, not the store.
2. **F-A in `load/yjs-mix.ts`**:
   a. `Sent` becomes `{ t0, clock, acked, up_at_send: boolean, epoch_at_send: number }`; in `type_once` set `up_at_send: e.state === "up"` and `epoch_at_send: e.epoch` (read both before any await; there is none).
   b. Add `const stored_drop_samples: number[] = [];` next to `stored_samples`.
   c. In the `"stored"` branch replace `stored_samples.push(t - s.t0);` with: `(is_clean_stored({ up: s.up_at_send, epoch: s.epoch_at_send }, { up: e.state === "up", epoch: e.epoch }) ? stored_samples : stored_drop_samples).push(t - s.t0);` Keep `s.acked = true` first. Import `is_clean_stored`.
   d. In the `p95_ms` object add after `stored: percentile(stored_samples, 95),`: `stored_n: stored_samples.length, stored_p50: percentile(stored_samples, 50), stored_during_drop: percentile(stored_drop_samples, 95), stored_during_drop_n: stored_drop_samples.length,`.
   e. Do not change `remote_edit` logic, tuning defaults, `n`, or the incomplete rules. Keep the file under its current size plus about 15 lines.
3. **F-A int test**: in `load/yjs-mix.int.test.ts` test "a forced drop reconnects with presence restored, no duplicate tokens" add, using the same `p` the other tests read from `result.p95_ms`: `expect(typeof p["stored_n"]).toBe("number")`, `expect(typeof p["stored_during_drop_n"]).toBe("number")`, and `expect(p["stored_n"] + p["stored_during_drop_n"]).toBe(acknowledged_count)` where `acknowledged_count = result.n - p["unacknowledged"]`. Do not edit other assertions.
4. **F-B reproduce first**: create `load/yjs-check-fixture.int.test.ts` using the same test-db and collab helpers as `load/yjs-mix.int.test.ts` (copy its imports/setup; DB only needed, no collab server). Steps in the test: build `support = { db, ids, clock }`, `await seed_load_lessons(support, 2)`, build the real `CheckContextLoader` with the real repos listed in section 4 (`db` is the `PgDatabase`), read `latest_derived(id)` from `PgLessonDocReader`, and `await expect(loader.load(id, derived.lesson, derived.content_hash)).resolves.toBeDefined()`. Run it BEFORE step 5 and confirm it fails with `InvariantViolation` whose message starts `invariant violated: no_outline_version` (record the actual message in the devlog; if it is a different invariant, fix that one instead and say so).
5. **F-B fix** in `load/yjs-support.ts` `seed_load_lessons`: inside the existing per-lesson `with_tx`, before `seed_initial`, ensure (idempotently, guard with a `select 1 from outline_version where unit_id = $1` style check like the existing `have` check) one `outline_version` for `LOAD_UNIT_ID` and one outline row per load lesson with the lesson's id and kind `lesson`, built the way `check-job-runner.int.test.ts` builds its rows (it uses `row-wp1.json` + `NormalizedRow`; the load lessons use `wp1()` content, so reuse the same fixture row with `lesson_id` swapped, as `seed_load_lessons` already does for the lesson body). Also keep every write behind `assert_load_lesson(id)` and the unit constant, so nothing outside `G6.U9` is touched. If the loader then fails on a *different* missing prerequisite (standards, links) that needs data outside the load unit, STOP, record it in the devlog under Remaining, and do not widen the seed beyond the load unit.
6. Re-run the step 4 test: passes. Run the extended step 3 test and the old `yjs-mix.int.test.ts` tests (they use the same seed).
7. Docs: devlog `docs/devlog/2026-10-26-nl127-followup.md` (Changed, Why, Checked, Remaining; 50 to 100 words each; must contain the section 1 diagnosis (a)(b)(c) in three sentences and the M-24 naming note). Area-map: in the A20 row's `load/**` text, append "NL-127 follow-up: stored drop split (`is_clean_stored`), load-unit outline seed in `yjs-support.ts`". Do not edit the NL-127 report.

## 6. Data and fixtures

Synthetic only: the WP-1 fixture lesson (`wp1()` from `@ls/db/repos/lesson-docs.test-support`) and `row-wp1.json`, with ids `G6.U9.L9xx` generated by `load_lesson_id(i)`; no new generator, no real content. The outline rows exist only for `LOAD_UNIT_ID`.

## 7. Checks

While iterating:
- `scripts/test-db.sh up` (127.0.0.1:55440 only)
- `npx vitest run load/yjs-stats.test.ts`
- `npx vitest run load/yjs-check-fixture.int.test.ts`
- `npx vitest run load/yjs-mix.int.test.ts`
Once before the final commit: the three above plus `load/spike-yjs.int.test.ts` (shares the seed), then `npm run typecheck`, `npm run lint`, `npm run format:check` (use the repo's actual script names from root `package.json`; do not invent). No full suite: nothing here is imported across the codebase. `scripts/test-db.sh down` when done.

**Acceptance (run by the orchestrator on a quiet machine, not by the implementer; no Docker builds, reuse images):** a short spike, 3 minutes, 200 users, same stack and out-of-tree override as NL-127 (`docker compose` project `ls-nl127`, Postgres on 127.0.0.1:55127, collab 1327):
```
npm run load:spike -- --users 200 --ramp-s 30 --plateau-s 120 --ramp-down-s 30 --socket-editors 140 --collab-url ws://127.0.0.1:1327 --base-url http://localhost:3127 --unit G6.U1
```
Run it twice: arm 1 with the stack defaults; arm 2 with only `STORE_MAX_DEBOUNCE_MS=2500` set on the collab service (env override, no code change). Pass criteria:
1. `kind=yjs` row has `stored`, `stored_n`, `stored_p50`, `stored_during_drop`, `stored_during_drop_n`, `incomplete: false`, `lost_updates = 0`. `stored_during_drop_n` is expected to be small (tens at most); if it is, the diagnosis in section 1(a) is confirmed.
2. `docker compose logs worker | grep -c check.failed` = 0 (F-B2).
3. `docker compose logs collab | grep collab.stored` `duration_ms` p95 recorded in the devlog (tx time), to split debounce from store time.
4. Report the stored p95 for both arms; the acceptance for the ticket is "numbers recorded and explained"; meeting < 3 s is judged only after the F-C decision. Expected: arm 1 about 4 s plus tx on a quiet machine, arm 2 about 2.5 s plus tx. If arm 1 is still near 6 s on a quiet machine with small `duration_ms`, the residual is collab event-loop load: file that as a new finding, do not tune.

## 8. Risks and requests

- **Do not oversell F-A.** It cannot move p95 by itself (section 1(a)).
- **NEEDS-DECISION (F-C, Innocent).** The 3 s stored target conflicts with the shipped default `STORE_MAX_DEBOUNCE_MS=4000`. Options: A, lower the default max-debounce to about 2500 ms (more `lesson_doc` snapshot rows, about 1.6x per actively typed lesson; the NL-125 e2e stacks already override to 500/1000); B, keep 4000 and relax the stored target to the design's end-to-end 5 s [T] budget; C, keep both and report the miss. Recommended: A, decided after arm 2 shows the effect. This is a change to a [T] number or a default, so it is not mine to make.
- **Request R-1 to the integrator (not built here):** `CheckQueue` has no way to end a permanently failing job (`status` is free text in `0007_checks.sql`, so a `failed` value needs no migration). `CheckJobRunner` retries every 30 s forever and each store re-enqueues. Suggest a `fail(check, reason)` port method plus classifying `InvariantViolation` from `loader.load` as permanent. Touches `packages/core/src/ports/check-queue.ts`, `packages/db/src/repos/check-queue.ts`, `apps/worker/src/checks/check-job-runner.ts`: other owners.
- **Report correction (not ours):** the NL-127 report's "M-24" label for stored p95 should read "US-36 / M-19 stored"; M-24 is reconnect time (met, 9.95 s). Raise to whoever owns the report.
- **Collision:** `load/yjs-mix.ts` and `load/yjs-support.ts` have no other planned owner in w9 per the collision map; if another slice edits them, rebase the small F-A hunks.
- The seed in step 5 may expose a second missing prerequisite; the plan says stop and record rather than widen.

## 9. Readiness

READY for F-A and F-B. F-C is NEEDS-DECISION (A, B or C above); nothing in this slice changes defaults.
