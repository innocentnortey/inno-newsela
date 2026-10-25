# NL-07 worker and collab entry points (2026-10-25)

**Changed.** Added `main/health/drain/deps/deps-types` for apps/worker and apps/collab, worker wiring shells (NL-79/81/110), collab wiring and `/internal/*` command shells (NL-80/105/106), with tests.
**Why.** Gives later tickets a runnable entry, graceful drain and health endpoints.
**Checked.** Hocuspocus 4.7.1: `requestHandler` awaits the `onRequest` hook then writes "Welcome to Hocuspocus!"; a hook that writes its response and `throw null` stops that (the catch swallows falsy errors). Verified by the `/healthz` exact-body test. Lint, typecheck and `vitest run apps/worker/src apps/collab/src` pass (19 tests); the websocket sync handshake test passed with the sketched frames.
**Remaining.** `build_*_runtime` are async (they bind ports), unlike DO-4's sync signature: flag at the next DO-4 touch. Worker health port is `WORKER_HEALTH_PORT` (default 8081), outside `WorkerSettings`; NL-23/NL-83 should use it or raise a CHG.
