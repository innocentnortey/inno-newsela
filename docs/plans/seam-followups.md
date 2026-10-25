# Seam follow-ups (open, from waves 3–4 audits and reviews)

Owner: orchestrator. Each row is work for a `lane::build-loop` fix ticket (cut at the next wave boundary) unless marked done.

| # | Defect | Where | Why it matters | Status |
|---|---|---|---|---|
| S-1 | Front matter lists parent standard codes; `code_not_allowed` accepts leaf codes only | NL-29 / NL-22 | NL-79 filters the finding out of the generation gate; the check lane still raises it | open |
| S-2 | CFU rationale: compiler writes "A. Correct …", rule expects leading "Correct" | NL-18/20 | filtered by regex in `generation_rules()` | open |
| S-3 | `derive_alignment` keyed on role; `alignment_link` primary key is not | NL-22/37 | test world dedupes by hand | open |
| S-4 | Open slots (`quote_placeholder_open`, `excerpt_slot_open`, `cross_lesson_link`) need a generation-gate policy | NL-37 | filter can go once the policy exists | open |
| S-5 | `example_set_id` always null in draft and store nodes | NL-29 | provenance field empty | open |
| S-6 | No unique index on `lesson_job.idempotency_key`; `job_ids_with_calls` missing on model-call port; no `lesson_job (run_id)` index | NL-08 migration owner | AC-4 of NL-78 left as `it.todo` | open |
| S-7 | `CheckQueue` has no release/retry cap; check lease not renewed | NL-37 / NL-81 | failed rule retries only on lease expiry | open |
| S-8 | `main.ts` of worker does not start `claim_loop.run_until` or NL-81's `check_lane` | NL-79 / NL-83 | worker idle until wired (db and model_client still `unbuilt`) | open |
| S-9 | Collab socket not re-checked after connect | NL-105 | revoked session keeps write rights until lock | open |
| S-10 | `RunSummary.trace_incomplete` extra field; SCR-4 ELD number (16 findings vs 7 codes) | CHG requests | contract wording | open |
| S-11 | `trace_check.py` accepts only `TEST-N` ids; SCR rows hold spec paths | TRACEABILITY | UX-5a evidence check fails by format | open |
| S-12 | `apiGlob("/units")` (src/test-utils/sign-in-as.ts) resolves to `**/units` with an empty API prefix and swallows page navigations; NL-55 spec works around it with a port-4010 filter | NL-24 helper | fix the helper to anchor to the API origin, then drop the workaround in NL-55 (and any later spec copying it) | open |
| S-13 | SCR-4 Edit blur cannot validate against a standards list: the report carries none (CHG against CON-3, raised in NL-57) | NL-57 | blur is a shape check only; server INVALID_CHOICE is the real check | open |
| S-13 | SCR-4 blur validation against a standards list needs the list on the report (CON-3) | NL-57 / CHG | spec not fully met | open |
| S-14 | NL-59 gates run controls with a literal `role !== "author"` instead of `can(role, "control_run")` in src/lib/roles.ts; one hook lint warning (use-run-progress.ts:62) | NL-59 | move into the shared permission table | open |
