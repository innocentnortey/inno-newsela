# NL-48 metrics write side (2026-10-25)

**Changed.** Added `merge_heartbeats` and `compute_lesson_metrics` (core), `PgMetricsRepo` and `PgBoardReadRepo` (db), `HeartbeatService`, `MetricsWriter`, and the `sendHeartbeat` route (204, empty body) with a local Request bridge (NL-25's adapter is not on main yet).

**Why / decisions.** `HeartbeatService` takes a 4th `lessons` lookup (NOT_FOUND without a new port method); `MetricsWriter` an optional clock. One frozen row per lesson per the ticket and schema, not CON-20's "reopen writes a new row" (integrator: correct via a CHG). Spacing guard is in memory per process; no purge job or read path.

**Checked.** Core, service, route and DB integration tests; eslint; typecheck.

**Remaining.** Retention of per-person `heartbeat` and `review_session` rows is open for Innocent (with NL-08's runtime DB-role follow-up). NL-54 wires `heartbeats` in `wiring/metrics.ts`.
