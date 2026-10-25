# NL-08 security-review fixes (2026-10-25)

**Changed.** BEFORE TRUNCATE statement triggers on review_event, audit_event, lesson_metrics, lesson_version (0006, 0008, 0009); lesson_version_guard is an allow-list (only `adopted` false to true may change); the migration runner fails when an applied id has no file; eslint override for `packages/db/src/testing/**`.
**Checked.** New `append-only-hardening.int.test.ts` (TRUNCATE x4, created_by and model_call_ids updates, missing-file runner).
**Follow-ups (not done).** (1) NL-23/NL-83 deploy config: a separate non-owner runtime DB role with TRUNCATE/UPDATE/DELETE revoked on guarded tables (triggers are bypassable by the table owner or a trigger-disabling superuser). (2) Question: retention for per-person heartbeat / review_session rows.
