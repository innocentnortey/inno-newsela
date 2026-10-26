# GEN-4: defects from the NL-127 capacity run (F-2 stub unit_plan failure, F-4 check.failed, M-24 stored split)

Planner: code reading only, main 3e5d55a. Lane: `lane::build-loop`. `risk::security`: no. No agreed CON-N changes.
Readiness: READY. NEEDS-DECISION: no (debounce settings are explicitly out of scope; the earlier F-C question stays with Innocent).
Sources: `evals/reports/load-2026-10-26.md` (F-2, F-4, "M-24"), `docs/devlog/2026-10-26-nl127-followup.md`, `docs/plans/fanout/2026-10-26-w9/NL-127-followup.md`.
Naming note (repeat in the devlog): the report's "M-24 stored" is mislabelled. In `docs/design/metrics-registry.md` M-24 is socket reconnect time (met, 9.95 s); stored is US-36 / M-19.

## 0. Diagnosis already done (so the implementer starts from facts, then verifies them)

**F-4 is already fixed on main.** The 1,310 lines were `InvariantViolation: no_outline_version: G6.U9.L9xx` from `CheckContextLoader.load`: `seed_load_lessons` created no outline version/rows for the load unit `G6.U9`, so every check failed and was re-offered every 30 s (lease). Fixed by `c3a118f` (merged `6875c1c`: `seed_outline_row` in `load/yjs-support.ts`, test `load/yjs-check-fixture.int.test.ts`). The NL-127 run used SHA `1d9e78d`, which does not contain it. This slice only VERIFIES it: after the smoke run, `check.failed` count in the worker log must be 0. Do not change the checker or the fixture again unless the count is not 0; if it is not 0, read the logged `rule`/`invariant` and fix that side with a test.

**F-2 root cause (strong hypothesis, confirm by repro).** `packages/llm/src/stub.ts` line 52 `#next` throws plain `Error("unscripted stub call: GENERATION")` when no script matches; `Recorder.call` (`packages/llm/src/recorder.ts` lines 96-100) catches a non-`ProviderError`, writes the model_call failure with the fixed message `"unexpected client error"` and `error_kind` `unexpected`, and rethrows; the job then fails with a bare `Error`. A Compose stack in `MODEL_PROVIDER_MODE=stub` had no script, so the first `unit_plan` call failed. `edaaab7` (NL-126 G1, merged `cffe933`, after the run SHA `1d9e78d`) added `apps/worker/src/wiring/demo-stub.ts` (`script_demo_stub`) which scripts unit_plan and lesson_draft. So the original F-2 trigger should already be gone on main. The two things still worth doing: (1) prove on the real stack that a stub run over the issued sheet now leaves Planning, with a regression test at the level the defect lived; (2) the failure reason is useless: `error_kind: unexpected` and `message: "unexpected client error"` carry no cause, which is why F-2 needed a day to diagnose. Make that reason useful and non-secret.

If the repro (step A1) shows a DIFFERENT cause than "unscripted stub call" on current main, fix that cause instead and say so in the devlog; the reason-field work in A3 still applies.

## 1. Owned files

Modify:
- `packages/llm/src/stub.ts` (typed error)
- `packages/llm/src/recorder.ts` (non-secret reason)
- `packages/llm/src/stub.test.ts`, `packages/llm/src/recorder.test.ts` (find the existing recorder test file with `ls packages/llm/src/*.test.ts`; add to it)
- `apps/worker/src/queue/claim-loop.ts` (log the safe reason in `claim_loop.job_failed`)
- `apps/worker/src/queue/claim-loop.test.ts` (if present; else the nearest existing claim-loop test)
- `apps/worker/src/wiring/demo-stub.int.test.ts` (regression, see A2)
- `apps/collab/src/persistence.ts`, `apps/collab/src/wiring/server.ts`
- `apps/collab/src/persistence.test.ts`, `apps/collab/src/wiring/server.test.ts`
- `.claude/reference/area-map.md` (append one clause to the llm, collab and A20 `load/**` rows)
Create:
- `load/store-split.ts` and `load/store-split.test.ts` (pure log-line aggregation)
- `docs/devlog/2026-10-26-gen4.md`
Not owned: `docs/source/restricted/`, provider keys, `docker-compose*.yml`, debounce settings (`packages/config/src/settings.ts` lines 234-235 stay untouched), `load/yjs-support.ts`, `packages/core/src/checks/**`.

## 2. Part A: F-2 (stub unit_plan failure)

**A1. Reproduce on the real stack first (no code yet).** Use the existing harness `apps/web/e2e/integration/con-6/worker-harness.ts` / `worker-entry.ts` and `apps/web/e2e/integration/con-6/fixtures/common.ts` (script_good). Cheapest faithful repro: temporarily run the worker wiring without a script (`wire_generation` from `apps/worker/src/wiring/generation.ts` over a `StubModelClient` with NO `script_demo_stub` call) against the issued sheet, as `demo-stub.int.test.ts` does but unscripted; record the failing job's `error_kind`, the model_call row and the `claim_loop.job_failed` log line. Then run the same with `script_demo_stub` and confirm the run reaches `ready`/leaves `planning`. Note both outcomes in the devlog. Real stack means `next build` + `next start` on your own random `E2E_PORT` and the test DB from `scripts/test-db.sh up` (never `down`); never `next dev`, never `npm ci`; delete `.next`, `test-results` and images you create when done.

**A2. Regression test (names the defect at its level).** In `apps/worker/src/wiring/demo-stub.int.test.ts` add `it("a stub-mode run over the issued sheet leaves planning: the unit_plan job completes and no job is stuck running")`: wire with the default stub-mode path (no per-test prices), call `script_demo_stub`, drive the claim loop one pass over the issued-sheet fixture the file already uses, assert the run status is not `planning`, zero jobs `running`, and `w.stub.calls.length > 0`. Add the negative twin `it("an unscripted stub call fails the unit_plan job with a reason that names the cause")` (no `script_demo_stub`): assert the failed model_call row's message contains `unscripted stub call` and `GENERATION`, and that the logged `claim_loop.job_failed` carries the same reason.

**A3. Useful, non-secret reason.**
- `packages/llm/src/stub.ts`: add `export class UnscriptedStubCall extends Error { readonly safe_reason: string; constructor(alias, purpose) { super("unscripted stub call: " + alias); this.name = "UnscriptedStubCall"; this.safe_reason = `unscripted stub call: ${alias}/${purpose}`; } }`; throw it in `#next` (keep the message prefix `unscripted stub call: ` so `stub.test.ts` line 44 `toThrow("unscripted stub call: GENERATION")` still passes). Pass `PURPOSE_OF[req.output_schema_name] ?? "*"` as purpose.
- `packages/llm/src/recorder.ts`: add `export function safe_reason(e: unknown): string` returning `e.safe_reason` when `e` is an object with a string `safe_reason`, else `e instanceof Error ? e.name : "unknown"` (class name only, never `e.message`, because a real SDK error message can echo request text). Use it at the non-`ProviderError` branch: `message: "unexpected client error: " + safe_reason(e)` in `safe_fail`, and add `reason: safe_reason(e)` to the `emit_failed` extra for that case (extend `emit_failed` with an optional `reason` parameter; the `model_call` log line already carries `error_kind`). `error_kind` stays `"unexpected"` (the schema enum must not change).
- `apps/worker/src/queue/claim-loop.ts` `claim_loop.job_failed` (lines 169-173): add `reason: safe_reason(err)` to `extra` beside `name`. Import from `@ls/llm/recorder` only if the worker already depends on it (`grep -n "@ls/llm" apps/worker/src/queue/*.ts`); else inline the same three-line function in the worker and note it in the devlog.
- Unit tests: `recorder` test: a client throwing `new Error("secret sk-ant-abc")` records message `unexpected client error: Error` and the string `sk-ant` appears in neither the stored message nor the log; a client throwing `UnscriptedStubCall("GENERATION","unit_plan")` records `unexpected client error: unscripted stub call: GENERATION/unit_plan`. `stub.test.ts`: the thrown error is `instanceof UnscriptedStubCall` with `safe_reason` set. claim-loop test: a runner that throws `new Error("x")` logs `reason: "Error"`.

## 3. Part B: F-4 (verification only)

**B1.** No production change. Add nothing unless the smoke run (Part C) shows `check.failed` > 0. Run `npx vitest run load/yjs-check-fixture.int.test.ts` (needs `scripts/test-db.sh up`) to prove the fixture test still passes on this base. In the devlog state: cause (`no_outline_version`, fixture), fix commit (`c3a118f`), why the 1,310 count existed (30 s lease re-offer of a permanently failing job), and the still-open gap R-1 (`CheckQueue` cannot end a permanently failing job; needs a new port method, other owners; not in this slice).
**B2.** In Part C, count `check.failed` lines in the collab/worker logs of the smoke run: expected 0. Report the number.

## 4. Part C: M-24 / stored-latency measurement (measurement only, no tuning)

Goal: split the stored wait into (i) time a changed document waits for Hocuspocus' debounce, and (ii) the Postgres write, counts-only, no lesson text.

**C1. Where the numbers come from.** `LessonPersistence.store` (`apps/collab/src/persistence.ts` lines 70-102) already logs `collab.stored` with `duration_ms` measured from before `ydoc_to_lesson`, i.e. convert + hash + the tx (it does NOT include the debounce wait). The debounce wait is invisible today. Add:
- `LessonPersistence.note_change(lesson_id: LessonId, at_ms?: number): void`: records `first_change_at` for a lesson only when none is pending (use `performance.now()` unless `at_ms` given; no clock port needed, matching the existing `started` usage). Keep the map small: one entry per open lesson, deleted in `store` and in `forget`.
- In `store`: `const waited = first_change_at === undefined ? null : started - first_change_at` clear the entry; time the port call separately: `const db_started = performance.now(); const ack = await this.store_port.store(...); const db_write_ms = performance.now() - db_started;`. Log `collab.stored` with `extra: { seq, store_wait_ms: waited === null ? null : Math.round(waited), db_write_ms: Math.round(db_write_ms) }`; `duration_ms` keeps its current meaning. Counts and numbers only: no lesson text, no document name beyond the existing `lesson_id`.
- `apps/collab/src/wiring/server.ts`: in the extension object that already has `onStoreDocument` (line 280), add `async onChange({ documentName }) { persistence.note_change(lesson_id_of(documentName)); }`. Check the `HocuspocusLike`/extension typing used in the file (lines 60-80) and add `onChange` to whatever type lists the hooks. Do NOT touch lines 309-310 (`debounce`, `maxDebounce`).
- Note for the reading: with continuous typing Hocuspocus resets the debounce each change and stores at `maxDebounce`, so `store_wait_ms` measured from the FIRST pending change is expected to approach `STORE_MAX_DEBOUNCE_MS` (4000) under steady typing; the designed ceiling is already above the 3 s target (see `NL-127-followup.md` section 1b). Say so in the devlog; it is the reading, not a tuning request.

**C2. Tests (collab).**
- `persistence.test.ts`: with the existing fakes, `note_change` then `store` logs `store_wait_ms` as a number >= 0 and `db_write_ms` as a number; `store` with no `note_change` logs `store_wait_ms: null`; a second `store` after the first does not reuse the old first-change time (entry cleared); `forget` clears a pending entry; the log extra contains no key named `text`, `content` or `ydoc` (assert on `Object.keys(line.extra)`).
- `server.test.ts`: the extension returned by the wiring exposes `onChange`, and calling it then `onStoreDocument` produces a `collab.stored` line with `store_wait_ms` not null (use `capture_logger` from `nl-80.fixtures.ts`).

**C3. Aggregation script.** `load/store-split.ts`, signature `export function summarise_store_split(lines: Iterable<string>): { n: number; wait_p50: number|null; wait_p95: number|null; db_p50: number|null; db_p95: number|null; total_p95: number|null; wait_null: number }` where each input line is a JSON log line with message `collab.stored`; non-JSON and other messages are skipped; `total` is `store_wait_ms + db_write_ms` when both are numbers. Use `percentile` from `load/stats.ts` (check its signature and empty-input behaviour first; reuse, do not copy). Add a tiny CLI wrapper in the same file guarded by `import.meta.url` (reads one file path argument, prints one JSON line). `load/store-split.test.ts`: fixture lines for 1, 10 and 0 samples, a malformed line, a line with `store_wait_ms: null`. Register nothing in package.json unless `load/package.json` already lists scripts the same way.

**C4. The smoke run (after A and C1-C3 pass their unit tests).** Build once (`next build`), start web and collab on your own random ports (`E2E_PORT` for web; pick a free collab port the same way and a fresh DB name on the shared test Postgres at 127.0.0.1:55440; no Docker image builds), worker and collab with stdout redirected to files under `/tmp/gen4-$$/`. Then:
`npm run load:spike -- --users 20 --socket-editors 20 --plateau-s 60 --collab-url ws://127.0.0.1:<collab_port> --base-url http://localhost:<E2E_PORT>` (add `--unit` as the NL-127 command did if the CLI needs it; use the default ramps). Provider mode stub; no provider key in the environment.
Record: (1) the probe's own stored p95 and n for the Yjs row (read back with `psql` the `probe_run` row of kind yjs); (2) `node load/store-split.ts /tmp/gen4-*/collab.log` output (run it through the repo's TS runner as other `load/*.ts` scripts are run; check `scripts/script-targets.json`); (3) `grep -c check.failed` over the worker and collab logs; (4) the machine load at the time (`uptime`), since NL-127 was contended. Kill only the processes you started; remove `.next`, `/tmp/gen4-*`, any `test-results` or images afterwards; do not run `scripts/test-db.sh down`.
Smoke pass criteria: the run completes (`incomplete: false`), lost updates 0, the split has n > 0, `check.failed` = 0. The stored p95 itself is NOT a pass/fail (the 3 s target is known to be above the designed ceiling).

**C5. Devlog `docs/devlog/2026-10-26-gen4.md`** (~100-150 words per item, the four headings Changed, Why, Checked, Remaining): Part A repro result and fix; Part B verification; Part C the split table (wait p50/p95, db p50/p95, total p95, stored p95 from the probe, n, load average) and the reading in two sentences: whether the stored p95 is dominated by the debounce wait (expected) or by the DB write; state plainly that the 20-editor smoke is not comparable to the 140-editor run and that no tuning was made. Include the naming correction about M-24.

## 5. Gates (cheapest first, affected tests only)

1. `npx eslint` on the changed files; `npm run typecheck`.
2. `npx vitest run packages/llm apps/worker/src/queue apps/collab/src/persistence.test.ts apps/collab/src/wiring/server.test.ts load/store-split.test.ts load/yjs-stats.test.ts`.
3. DB tests (after `scripts/test-db.sh up`): `npx vitest run apps/worker/src/wiring/demo-stub.int.test.ts load/yjs-check-fixture.int.test.ts apps/collab/src/persistence.int.test.ts`.
4. The Part C4 smoke run. No full suite: the only shared-reaching edit is `recorder.ts`, whose callers' tests are under `packages/llm` and `apps/worker` (covered above); if `grep -rn "unexpected client error" --include=*.ts .` finds an assertion elsewhere on the old message, update that test and run it.

## 6. Risks and notes for the implementer

- Changing the stored `message` text ("unexpected client error: <reason>") may break a test or e2e fixture that matches the exact old string: grep before editing and update only those assertions.
- `error_kind` values are an enum in the schema/contract (`docs/contracts/`): do not add one. The reason lives in the existing free-text message and the log.
- `safe_reason` must never include `e.message` for unknown errors; only `UnscriptedStubCall.safe_reason` (built from alias and purpose, both fixed enums) is allowed to carry text.
- Do not spend more than one pass on the A1 repro; if the stack cannot be started within the disk budget, run the unscripted/scripted pair at the `demo-stub.int.test.ts` level and say in the devlog that the full-stack repro was not done.
- Commit on branch `ticket/GEN-4`, message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; no merge, no push.
