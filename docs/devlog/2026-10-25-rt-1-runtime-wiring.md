# RT-1 runtime wiring (2026-10-25)

**Changed.** `packages/llm/src/provider.ts` (`build_model_client`) feeds both composition roots; worker `deps.ts` builds a real `PgDatabase`; new `loops.ts` starts the claim loop (after the requeue pass) and the check lane under the drain tracker, exit 1 with the error name only on failure, logs `worker.model_mode` once; web real mode builds; `startStack({worker:true})` spawns a stub worker (`workerEnv` strips provider keys). Closes S-8 and S-19.
**Why.** Real generation needs a running worker and a model client; spend ceiling (75, PD-29) stays live through the existing `PaidCaller`.
**Checked.** Frozen and own tests, typecheck, eslint; stub worker smoke (healthz 200, SIGTERM exit 0). Two narrow refreezes recorded in the manifest.
**Remaining.** Judge (NL-110) unwired; stub has no `unit_plan` script; `@ls/llm` missing from `apps/web/package.json` (hoisted, resolves).
