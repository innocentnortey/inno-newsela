# RT-1: runtime wiring (worker loops, real model client, harness worker)

Slice type: runtime-wiring fix, not a numbered ticket. `risk::security` = YES (provider key handling, spend ceiling). Planner: Opus. Implementer: Sonnet. Planned 2026-10-25 against main as read today.

## 1. Goal and sources

Make real generation possible on the real stack. Three seams close:

1. Worker (`apps/worker/src/main.ts`, `deps.ts`): build `PgDatabase` and the model client; start `ClaimLoop.run_until` and `CheckLane.run_until` after startup; stop both on SIGTERM/SIGINT through the existing drain. Closes S-8.
2. Web (`apps/web/src/server/container.ts`): `MODEL_PROVIDER_MODE=real` no longer throws "NOT BUILT: NL-32"; `model_client` is the same factory's output. Closes S-19.
3. Harness (`apps/web/e2e/integration/support/real-stack.ts`): `startStack({worker:true})` spawns the worker in stub mode.

Sources: `docs/plans/seam-followups.md` S-8, S-19; planners' Open items in `docs/plans/fanout/2026-10-25-w6/NL-95.md` (section 8, items 1-2), `NL-96.md` (section 8, items 1-3), `NL-97.md` (section 8, items 1, 4); `docs/design/system-design.md` l.46 and l.220-228 (PD-29: model spend at most $75 for the whole build); `.claude/rules` `shared-provider-credentials.md` at workspace root (`/home/linuxuser/workspaces/.claude/rules/`); `.claude/reference/area-map.md` rows A0, A6, A7, A9.

Decision (ticket > DO-4 > DO-3, no product call needed): one factory in `packages/llm` builds the `ModelClient` for both apps. Apps may not import each other (eslint boundaries), and `@ls/llm/anthropic` may be imported only from `packages/llm/src`, `apps/*/src/wiring/**`, `apps/web/src/server/container.ts`, `apps/*/src/main.ts` (eslint.config.js l.97-106). A new file `packages/llm/src/provider.ts` is inside that allowance, so no eslint change and `deps.ts` imports only `@ls/llm/provider`.

## 2. Boundary

Create:
- `/home/linuxuser/workspaces/inno-newsela/packages/llm/src/provider.ts`
- `/home/linuxuser/workspaces/inno-newsela/packages/llm/src/provider.test.ts`
- `/home/linuxuser/workspaces/inno-newsela/apps/worker/src/loops.ts` (start/stop of the two loops; keeps main.ts small)
- `/home/linuxuser/workspaces/inno-newsela/apps/worker/src/loops.test.ts`
- `/home/linuxuser/workspaces/inno-newsela/apps/worker/src/deps.test.ts`
- `/home/linuxuser/workspaces/inno-newsela/apps/worker/src/wiring/real-mode.int.test.ts` (spend ceiling live; uses test Postgres)
- `/home/linuxuser/workspaces/inno-newsela/apps/web/e2e/integration/support/real-stack-worker.test.ts` ONLY if vitest collects it; it does not (vitest collects `packages/*/src`, `packages/*/tests`, apps' `src`, `tests/platform`). So put the harness check in `/home/linuxuser/workspaces/inno-newsela/tests/platform/rt-1-harness.test.ts` instead.
- `/home/linuxuser/workspaces/inno-newsela/docs/devlog/2026-10-25-rt-1-runtime-wiring.md`
- `/home/linuxuser/workspaces/inno-newsela/docs/plans/frozen-tests/RT-1.manifest.json` (written by the test-writer, see section 7)

Modify (exact touch per file; ticket owner in brackets):
- `apps/worker/src/deps.ts` [NL-07 shell; NL-79 left `unbuilt("NL-83")` / `unbuilt("NL-32")`]: delete `unbuilt` and the two stubs; add db and model_client construction (section 5 step 2). Nothing else.
- `apps/worker/src/main.ts` [NL-07; NL-79 did not touch]: in `build_worker_runtime` add db close to the drain `close`; add exported `start_worker_loops`; call it from the `import.meta.url` entry block. Do not change existing exports' shapes (`WorkerRuntimeOptions`, `WorkerRuntime`), only add an optional `db?` nothing; see step 3.
- `apps/worker/src/main.test.ts` [NL-07]: add nothing unless it fails; it must stay green unchanged (it passes `health_db` fake and default stub mode; `PgDatabase` pool is lazy, no connect).
- `apps/web/src/server/container.ts` [NL-06; NL-12 note in comment]: replace the real-mode `throw ConfigError("MODEL_PROVIDER_MODE","NOT BUILT: NL-32")` block and the `unbuilt<ModelClient>("NL-12",...)` line. Keep the `anthropic_api_key === null` ConfigError. Remove the now-unused `ModelClient` type import only if lint flags it.
- `apps/web/src/server/container.test.ts` [NL-06]: the second half of `real_mode_requires_key` (keyed, expects "NOT BUILT: NL-32") is now wrong; rewrite it (AC-6 below). Only that test changes.
- `apps/web/e2e/integration/support/real-stack.ts` [NL-90]: only the `if (opts.worker) throw ...` line and a new worker block after the web block, plus return nothing new (Stack interface unchanged). NL-95/96/97 plans say they do not edit `support/**`; RT-1 is the only editor of this file, so no collision. NL-96/97 keep their own stand-ins (`con-6/worker-harness.ts`, `con-21/drive-worker.ts`); RT-1 does not touch them.
- `.claude/reference/area-map.md`: rows A0 (main.ts / container.ts), A6 (row 3, "lane not started by main.ts yet" -> started), A9 (row 3, "not yet started by main.ts" -> started), A7 (add `provider.ts`).
- `docs/plans/seam-followups.md`: mark S-8 and S-19 done with the devlog name; leave S-16 open.
- `.env.example` is NOT edited (no new variable; see section 4).

Read only (never edit): `packages/llm/src/{anthropic,stub,paid-call,recorder,prices}.ts`, `packages/db/src/{pool,repos/spend}.ts`, `packages/config/src/settings.ts`, `apps/worker/src/{drain,health,queue/claim-loop,checks/check-lane}.ts`, `apps/worker/src/wiring/{generation,checks,judge}.ts`, `apps/web/src/server/deps.ts`, `eslint.config.js`. Other slices own `apps/web/e2e/integration/con-5|con-6|con-21/**`, `apps/web/app/**`, `apps/web/src/features/**`: do not touch.

NL-79 files (`wiring/generation.ts`, `generation/**`, `queue/**`): no edit. NL-32/33 files (`anthropic.ts`, `stub.ts`, `paid-call.ts`, `recorder.ts`): no edit; RT-1 only imports them.

## 3. Requirements table

| ID | Requirement | Implementation | Verification |
|---|---|---|---|
| AC-1 | Worker entry starts the generation claim loop and the check lane | `start_worker_loops` (step 3) calls `claim_loop.start()` then `claim_loop.run_until(stop)` and `check_lane.run_until(stop)`, each under `tracker.track` | `loops.test.ts` `starts_both_loops_after_requeue_pass`; `npx vitest run apps/worker/src/loops.test.ts -t starts_both_loops` |
| AC-2 | Graceful drain: on SIGTERM neither loop claims new work, in-flight job finishes, process exits 0 | `stop = { is_set: () => tracker.draining }`; existing `install_drain` already awaits `tracker.begin_drain()` | `loops.test.ts` `drain_waits_for_in_flight_then_exits_zero`; `main.test.ts` `starts_serves_drains` stays green |
| AC-3 | A loop that dies with a thrown error or `reason:"fatal"` exits the process non-zero, logging the error NAME only | `.catch`/exit-reason handling in `start_worker_loops` calls `exit(1)` | `loops.test.ts` `loop_failure_exits_one_without_message` (error message containing a canary string must not appear in log lines) |
| AC-4 | Worker `db` is a real `PgDatabase`; closed in the drain `close` | `deps.ts` step 2; `close` in main.ts | `deps.test.ts` `db_is_pg_database`; `loops.test.ts` `drain_closes_db` (spy on `close`) |
| AC-5 | `MODEL_PROVIDER_MODE=stub` builds `StubModelClient`; `real` builds `AnthropicMessagesAdapter`; `real` without key throws `ConfigError("ANTHROPIC_API_KEY", ...)` | `build_model_client` (step 1) | `provider.test.ts` `stub_mode_gives_stub`, `real_mode_gives_adapter`, `real_without_key_throws_config_error` |
| AC-6 | Web real mode builds and does not throw; key never appears in error text, log lines, or `JSON.stringify(deps)` | `container.ts` step 5 | `container.test.ts` `real_mode_requires_key` (rewritten), `real_mode_builds_without_leaking_key` |
| AC-7 | Provider keys come only from process env (via `bin/with-provider-env`), never read from a file, never written to a file or log | `build_model_client` receives `ModelSettings` (already parsed from `process.env` by `load_*_settings`); no `readFileSync`, no `.env` parsing added anywhere | `provider.test.ts` `no_key_in_error_or_inspect` (marker key inside `SecretStr`; `String(client)`, `util.inspect(client)`, `JSON.stringify(client)` and a thrown `map_error` message do not contain it); grep check in section 7 |
| AC-8 | Spend ledger and cap are live in real mode: the project ceiling (`BUILD_SPEND_CEILING_USD`, default 75 = PD-29) refuses a reservation before any provider call | worker uses `PaidCaller` + `PgSpendLedger` already built by `wire_generation`; RT-1 only supplies a real db and `settings.spend` unchanged | `real-mode.int.test.ts` `ceiling_refuses_before_provider_call`: seed `spend_reservation` rows summing 74.99 settled, real-mode settings with a counting fake `ModelClient` injected through `build_model_client`'s `client_override`... NOT allowed: see step 1 (no override in production code). Instead the test builds `wire_generation` with a counting `StubModelClient` and `settings.model.model_provider_mode="real"`; asserts `SpendRefused`, zero stub calls, zero new `model_call` rows |
| AC-9 | The default ceiling cannot be raised silently: `build_spend_ceiling_usd` defaults to `75` and real mode logs it once at start | one `logger.info("worker.model_mode", {extra:{mode, spend_ceiling_usd: <string>}})` line at startup (no key, no key length) | `loops.test.ts` `start_logs_mode_and_ceiling` |
| AC-10 | Harness: `startStack({worker:true})` spawns the worker in stub mode against the stack DB, waits for its `/healthz` 200, kills it before the DB drop; never passes provider keys | step 6 | `tests/platform/rt-1-harness.test.ts` `worker_env_has_no_provider_keys` (unit-level on an exported pure `workerEnv(base)` helper) plus the manual run in section 7 |
| AC-11 | Existing tests stay green | no behaviour change outside the above | section 7 commands |
| AC-12 | Context upkeep | area-map rows, S-8/S-19 closed, devlog | `python3 ~/.claude/skills/icm-project/scripts/check_context.py .` no FAIL |

## 4. Shared code to use (copied from main)

```ts
// packages/config/src/settings.ts
interface ModelSettings { model_provider_mode: "real" | "stub"; anthropic_api_key: SecretStr | null;
  model_generation_id: string; model_repair_id: string; model_assist_id: string;
  model_effort: "low"|"medium"|"high"; model_call_timeout_ms: number; provider_max_retries: number; }
// load_model_settings already throws ConfigError("ANTHROPIC_API_KEY","required when MODEL_PROVIDER_MODE=real") on a null key.
// spend: SpendSettings { build_spend_ceiling_usd: Decimal (env BUILD_SPEND_CEILING_USD, default "75"), run_cap_default_usd ... }

// packages/llm/src/anthropic.ts
export interface AnthropicMessagesAdapterInit {
  api_key: SecretStr;
  model_ids: Readonly<Record<"GENERATION" | "REPAIR" | "ASSIST", string>>;
  http_timeout_ms: number;
  base_url?: string; // tests only
}
export class AnthropicMessagesAdapter implements ModelClient { constructor(init: AnthropicMessagesAdapterInit); }

// packages/llm/src/stub.ts
export class StubModelClient implements ModelClient { constructor(init: { clock?: Clock; on_enter?: ... } = {}); }

// packages/db/src/pool.ts
export class PgDatabase { constructor(settings: SharedSettings, pool_max: number, acquire_timeout_ms: number, pool_name: PoolName = "web"); close(): Promise<void>; ping(): Promise<boolean>; }
// PoolName = "web" | "collab" | "worker"

// apps/worker/src/drain.ts
export interface InflightTracker { track<T>(work: () => Promise<T>): Promise<T>; readonly draining: boolean; begin_drain(): Promise<void>; readonly in_flight: number; }

// apps/worker/src/queue/claim-loop.ts
class ClaimLoop { start(): Promise<TickReport>; run_until(stop: { is_set(): boolean }): Promise<LoopExit>; }
interface LoopExit { reason: "sigterm" | "fatal"; drained_jobs: number; abandoned_jobs: number }
// apps/worker/src/checks/check-lane.ts
class CheckLane { run_until(stop: { is_set(): boolean }): Promise<{ checked: number }>; }

// apps/worker/src/wiring/generation.ts -> wire_generation(d: WorkerDeps, opts?) : { claim_loop, paid }
// apps/worker/src/wiring/checks.ts     -> wire_checks(d) : { check_runner, check_lane }
```

Credentials (rule `shared-provider-credentials.md`): run any real-mode process as
`/home/linuxuser/workspaces/bin/with-provider-env --project-env .env -- <cmd>`. It exports `ANTHROPIC_API_KEY` (and `OPENROUTER_API_KEY`) into that command's environment only. No new env variable is introduced; `.env.example` is unchanged (it must not gain a key value).

## 5. Steps

1. `packages/llm/src/provider.ts`. Exactly:
```ts
import type { ModelSettings } from "@ls/config/settings";
import type { Clock } from "@ls/core/ports/clock";
import type { ModelClient } from "@ls/core/ports/model-client";
import { ConfigError } from "@ls/config/errors";
import { AnthropicMessagesAdapter } from "./anthropic.ts";
import { StubModelClient } from "./stub.ts";
export function build_model_client(model: ModelSettings, clock: Clock): ModelClient
```
   - `stub`: `new StubModelClient({ clock })`.
   - `real`: if `model.anthropic_api_key === null` throw `new ConfigError("ANTHROPIC_API_KEY", "required when MODEL_PROVIDER_MODE=real")`; else `new AnthropicMessagesAdapter({ api_key: model.anthropic_api_key, model_ids: { GENERATION: model.model_generation_id, REPAIR: model.model_repair_id, ASSIST: model.model_assist_id }, http_timeout_ms: model.model_call_timeout_ms })`. Never pass `base_url` (invariant: real mode always talks to api.anthropic.com).
   - No env reads, no file reads, no logging in this file. JUDGE is out of scope (NL-110).
   - Check the `ConfigError` import path first with `grep -n "export class ConfigError" packages/config/src/errors.ts`; copy its constructor argument order from `settings.ts` l.121.
2. `apps/worker/src/deps.ts`: replace body of `build_worker_deps`:
```ts
const clock = new SystemClock();
return {
  settings, logger,
  db: new PgDatabase(settings.shared, settings.shared.pg_pool_max, 2000, "worker"),
  ids: new PrefixedIdGenerator(), clock,
  model_client: build_model_client(settings.model, clock),
};
```
   Imports: `import { PgDatabase } from "@ls/db/pool"; import { build_model_client } from "@ls/llm/provider";`. `2000` mirrors `open_health_db` in health.ts (worker settings have no acquire-timeout field; do not add one). Remove `unbuilt`. Update the stale comments in `wiring/checks.ts` only if you must; do NOT edit that file (NL-81's): leave them.
3. `apps/worker/src/loops.ts`: export
```ts
export interface LoopHost { tracker: InflightTracker; generation: GenerationWiring; checks: CheckWiring; logger: Logger; exit: (code:number)=>void; }
export function start_worker_loops(h: LoopHost): { done: Promise<void> }
```
   Steps inside, each with its invariant:
   a. `const stop = { is_set: () => h.tracker.draining };` (invariant: the only stop condition is drain, so the loops end exactly when `install_drain` begins).
   b. Log `worker.model_mode` with `{mode, spend_ceiling_usd}` taken from settings passed in via `LoopHost.settings: WorkerSettings` (add that field). `spend_ceiling_usd` is `settings.spend.build_spend_ceiling_usd.toString()`. Do not log the key, its presence flag is fine as boolean `key_present`.
   c. Generation: `h.tracker.track(async () => { await h.generation.claim_loop.start(); const r = await h.generation.claim_loop.run_until(stop); if (r.reason === "fatal") throw new Error("claim_loop fatal"); })` (invariant: orphan cleanup G-9 runs before any claim; the tracker counts the loop as in-flight so the drain waits for the claimed job to finish).
   d. Check lane: `h.tracker.track(() => h.checks.check_lane.run_until(stop))`.
   e. For each promise, `.catch((e) => { h.logger.error("worker.loop_failed", { extra: { name: e instanceof Error ? e.name : "unknown" } }); h.exit(1); })`. Never log `e.message` (may carry secrets).
   f. If `track` itself throws `DrainingError` (drain began before start) swallow it: not an error.
   In `main.ts`: build `rt`, then in the entry `.then((rt) => { start_worker_loops({ tracker: rt.tracker, generation: rt.generation, checks: rt.checks, logger: rt.logger, exit: ..., settings: rt.settings }); void write_start_event(...) })`. `exit` must be the same `exit` closure `build_worker_runtime` hands to `install_drain`; to get it, add `exit` to the `WorkerRuntime` object as a new field `exit(code:number):void` (additive; `main.test.ts` does not destructure it). Do NOT start the loops inside `build_worker_runtime` (invariant: `main.test.ts` and other tests build a runtime without a database).
   Also extend the drain `close` in `build_worker_runtime`: after the health db, `await (deps.db as unknown as { close(): Promise<void> }).close().catch(() => undefined)`.
4. `apps/web/src/server/container.ts`: delete the `if (settings.model.model_provider_mode === "real") { ... }` block except keep a null-key guard (the loader already enforces it; keep the existing `ConfigError("ANTHROPIC_API_KEY", ...)` throw so the test and defence in depth stay). Build `const clock = new SystemClock();` once and set `clock` and `model_client: build_model_client(settings.model, clock)` in `deps`. Import `build_model_client` from `@ls/llm/provider`. Check `apps/web/package.json` has `@ls/llm` in dependencies (`grep -n '"@ls/llm"' apps/web/package.json`); if missing, report under Risks (the root `package.json`/lockfile is the integrator's), do not add. Do not wrap in `PaidCaller` here: web makes no paid call until NL-116 (it will build `PaidCaller` from `deps.model_client`).
5. `apps/web/e2e/integration/support/real-stack.ts`: remove the `throw` on `opts.worker`. Add exported pure helper
```ts
export function workerEnv(base: NodeJS.ProcessEnv, port: string): NodeJS.ProcessEnv
```
   returning `{ ...base, MODEL_PROVIDER_MODE: "stub", WORKER_HEALTH_PORT: port, JOB_POLL_MS: "200", CHECK_POLL_MS: "200", WORKER_ID: "e2e-worker" }` and deleting `ANTHROPIC_API_KEY` and `OPENROUTER_API_KEY` from the result (invariant: the e2e worker never holds a provider key, even if the caller's shell does). `env` in `startStack` already holds only PATH/HOME plus fixed values, so the keys are absent; the delete is defence in depth. After the web/collab blocks add: `if (opts.worker) { const wp = String(await freePort()); const worker = spawn("npx", ["tsx", "apps/worker/src/main.ts"], { cwd: ROOT, env: workerEnv(env, wp), detached: true }); children.push(worker); pipeLines(worker, (l) => sink(`[worker] ${l}`)); await waitFor200(`http://127.0.0.1:${wp}/healthz`, 60_000); }`. The collab block uses the same `detached` + `children.push` pattern, so `kill()`/`stop()` already terminate it (SIGTERM goes through the drain; SIGKILL after 5 s). Order: worker starts after web so migrations/DB exist (the DB is created before either by `db-admin.ts create`). `getStack()`/`stack.json` unchanged.
6. Tests (written by the test-writer first, section 7; the implementer makes them pass). Do not weaken a frozen test.
7. Devlog `docs/devlog/2026-10-25-rt-1-runtime-wiring.md`, area-map rows, `seam-followups.md` S-8/S-19 -> `done 2026-10-25 (devlog 2026-10-25-rt-1-runtime-wiring)`. Note in devlog: judge (NL-110) still unwired; `unit_plan` stub script not provided (see Open items).

Must NOT:
- add any file that reads `.env` or provider keys from disk; print, log or throw a key, a key prefix or key length;
- add a `base_url` path, a `client_override`, or any env switch that reroutes the real adapter;
- change `wire_generation`, `PaidCaller`, `PgSpendLedger`, `decide_reservation`, the price table, or the 75 default;
- start loops inside `build_worker_runtime`;
- edit another slice's files (con-5/6/21 dirs, features, app routes);
- run the full suite, build Docker images, or call the real Anthropic API from any test.

## 6. Data and fixtures

Synthetic only. Marker key for leak tests: `"sk-ant-TESTMARKER-9f3"` (same as `container.test.ts` l.48). `real-mode.int.test.ts` uses `packages/db/src/testing` helpers already used by `apps/worker/src/wiring/generation.int.test.ts` (copy its setup block: test DB, migrations, seeded user/run/job via the same world helper; read that file once to copy the helper names) and inserts `spend_reservation` rows (columns `id, run_id, job_id, user_id, purpose, reserved_usd, status, day, created_at`) totalling 74.99 `settled`... use whatever status value `0004_runs.sql` allows for settled (check once). No restricted-folder content.

## 7. Checks

Frozen tests (`risk::security`): the test-writer writes these BEFORE the implementer, records them in `docs/plans/frozen-tests/RT-1.manifest.json` (copy the shape of `NL-90.manifest.json`), and the implementer may not edit them. ACs to freeze: AC-5, AC-6, AC-7, AC-8, AC-9, and the leak-canary part of AC-3. Non-frozen (implementer writes with the code): AC-1, AC-2, AC-4, AC-10, plus unchanged `main.test.ts`.

Iterating:
```
cd /home/linuxuser/workspaces/inno-newsela
npx vitest run packages/llm/src/provider.test.ts
npx vitest run apps/worker/src/loops.test.ts apps/worker/src/deps.test.ts apps/worker/src/main.test.ts apps/worker/src/drain.test.ts
npx vitest run apps/web/src/server/container.test.ts apps/web/src/server/wiring-stubs.test.ts
scripts/test-db.sh up && npx vitest run apps/worker/src/wiring/real-mode.int.test.ts apps/worker/src/wiring/generation.int.test.ts   # then scripts/test-db.sh down when finished
npx vitest run tests/platform/rt-1-harness.test.ts
```
Must stay green: `main.test.ts`, `drain.test.ts`, `health.test.ts`, `start-event.test.ts`, `claim-loop.test.ts`, `check-lane.test.ts`, `wiring/*.test.ts`, `container.test.ts` (all other cases), `packages/llm/src/*.test.ts`, `anthropic-record.test.ts`. `generation.int.test.ts` concurrency test is timing-sensitive (S-16): rerun alone before blaming RT-1.

Once before commit (fast gates): `npm run lint`, `npm run typecheck` (use the root script names in `package.json`; `grep -n '"lint"\|"typecheck"\|"format' package.json`), format check as defined there. Lint must show no new `no-restricted-imports` hit (the factory lives in `packages/llm/src`, which is exempt).
Secret grep (must print nothing): `grep -rnE "sk-ant-|readFileSync\([^)]*\.env|dotenv" packages/llm/src/provider.ts apps/worker/src/deps.ts apps/worker/src/loops.ts apps/web/src/server/container.ts apps/web/e2e/integration/support/real-stack.ts`.
Harness smoke (manual, once, test DB up): `E2E_SKIP_BUILD=1 npx tsx -e` is not available; instead run an existing integration spec with a one-off `startStack({worker:true})` global-setup variant is NOT to be committed. Minimum: `npx tsx apps/worker/src/main.ts` with env `DATABASE_URL` (test DB), `AUDIT_HASH_SALT`, `COLLAB_INTERNAL_TOKEN`, `MODEL_PROVIDER_MODE=stub`, `WORKER_HEALTH_PORT=0`, send SIGTERM, expect exit 0 and a `process.drain` log line. Real mode is NOT exercised in this slice's tests; a human-run smoke is `with-provider-env -- env MODEL_PROVIDER_MODE=real ... main.ts` for startup only (no job), expected `worker.model_mode` log and healthz 200. Do not enqueue a real job (spend).
Full suite: not required.

## 8. Risks and requests

- Collision: `apps/web/e2e/integration/support/real-stack.ts` is NL-90's (merged). NL-95/96/97 plans forbid editing it; they use their own stand-ins and call `startStack` without `worker`. RT-1 is the only editor in this wave. After RT-1 merges, a follow-up may drop the stand-ins; not this slice.
- `apps/worker/src/main.ts` and `container.ts` are A0 composition roots (area-map row 0): the integrator should merge RT-1 before any ticket touching them. NL-105 (collab) does not touch them.
- Possible missing dependency: `@ls/llm` in `apps/web/package.json` and `apps/worker/package.json`. Check both with grep; if absent, REQUEST to the integrator (root lockfile is single); implementer does not edit lockfile.
- Stub mode has no scripts: any `unit_plan` or `lesson_draft` call from a harness-started worker throws "unscripted stub call". That is intentional for now (no fixture owner decision); specs needing generated output keep NL-96/97 stand-ins or start no jobs. If Innocent wants a canned-output stub worker, that is a separate ticket.
- Judge (`wire_judge`) remains an empty shell (NL-110); S-26 stays open. The OpenRouter key is not read by RT-1.
- Web has no `PaidCaller`; spend is enforced in the worker only until NL-116. Web real mode reaches no paid call today.
- Lease/poll values: harness sets 200 ms polls; production defaults unchanged (1000/500).
- Real-mode spend smoke against the live API is deliberately not part of this slice; the ceiling is proven against the ledger with a counting stub.

## 9. Readiness

READY. (No NEEDS-DECISION or BLOCKED-ON; package.json dependency check in Risks is a request, not a blocker.)
