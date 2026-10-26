# Observability contract (DO-6) — Newsela Lesson Studio

> Owner: Claude drafts, Innocent reviews · Status: ready (Claude's recommendation adopted under Innocent's standing authorization, PD-32, 2026-10-25) · Sources: SD-1.10, SD-3.7, SD-2.8, SD-4.7, SD-8.7, SD-6.6, SD-7.6; R-48, R-49; PD-19, PD-30

**What this answers:** "what ran, and can we prove it was captured?" for every workflow in the system: user operations,
background jobs, validation runs, experiments and operations scripts. It does not answer "was it right?"; that is the
evaluation plan `docs/design/eval-plan.md` (DO-5). A green trace is never a correct lesson.

**What it looks like in practice.** The author starts a run on Unit 4. The web app mints `run_id = run_8f2c`. Every one
of the 47 `lesson_job` rows carries it; every `model_call` row carries it plus its `lesson_id` and `job_id`; every
`lesson_version` stored from that run carries it in its provenance. A week later Innocent asks "why did Lesson 22 fail?"
and one SQL query over `model_call WHERE run_id = 'run_8f2c' AND lesson_id = 'L22'` returns the rendered prompt, the raw
output, the stop reason (`max_tokens`), the truncation retry and the final `generation_failed: truncated`. The run
summary's totals equal the sums over those rows (R-48), so a missing row shows up as a mismatch, not as silence.

**Where telemetry lives:** our own Postgres (PD-19), plus process stdout as JSON lines. No hosted tracing vendor:
pre-adoption lesson content must not leave our database (AD-17, AQ-16). Table names are DO-3's
canonical tables ([code design](code-design.md) §6, 35 tables, one DDL owner); DO-3 fixes their columns.

## Covered workflows

Every entry point that does work has a stable `WF-n`. Cut items keep their row, marked *cut #n*: their capture check is
written only if the item lands. The Eval column names the evaluation suite (DO-5) and the DO-7 metrics `M-n` the
workflow feeds. Metric ids map from the framing metrics in fixed order: NS→M-1, G-1→M-2, G-2→M-3, G-3→M-4,
V-1…V-6→M-5…M-10, O-1…O-4→M-11…M-14, H-1…H-6→M-15…M-20 (framing §3; 20 metrics, no gap). M-21…M-44 (DO-7's capacity, spend and eval-plan metrics) were added after this
table was first drafted; each is now inherited by at least one row (see *Metric coverage check*).

| Workflow | Entry point | Class | Emitting components | Correlation | Required records | Capture verification | Eval (DO-7 metrics) |
|---|---|---|---|---|---|---|---|
| WF-1 | Sign-in, session read, sign-out and the seeded demo login: `POST /session`, `GET /session`, `DELETE /session` (CON-1) | user-operation | web app | `request_id` minted per HTTP request; `user_id` | `app_session`, `audit_event`. A successful sign-in writes its audit event; refusals (`NOT_ON_ALLOW_LIST`, `INVALID_CREDENTIALS`) write no row and go to the application log with the email hashed (INTERFACE shared guarantee 2) | `test_signin_capture`: signs in as each seeded role and as an unknown email; asserts the session row and the successful sign-in's audit event; that the unknown-email refusal wrote no `app_session` or `audit_event` row and left one application-log line with the email hashed; and no raw unknown email in any row or log line | n/a — no model output or metric; access only |
| WF-2 | Unit list, outline upload or public sheet link: `GET /units`, `POST /outline-versions`, `POST /outline-versions/import` (CON-2) | user-operation | web app | `request_id`; `outline_version_id` minted here | `outline_version`, `outline_row`, `audit_event`. One version per upload with its SHA-256 | `test_upload_capture`: uploads the issued XLSX twice and a private link; asserts two versions with the same hash, zero changed lesson rows, and a `SHEET_NOT_PUBLIC` refusal that wrote no version, row or audit event (one application-log line with its `request_id` instead) | EV: intake golden suite S1 (one case per outline defect), safety-note recall S7; M-39, M-40 |
| WF-3 | Validation report read and intake confirmations (CON-3, CON-4) | user-operation | web app | `outline_version_id` | `intake_choice`, `audit_event`. Each warning stored as `default` or `confirmed by <name>` | `test_intake_confirm_capture`: confirms one error and leaves one warning on default; asserts both `intake_choice` rows and the audit event with the confirmer | EV: intake golden suite S1; M-13 (outline confirmed starts the lead-time clock), M-40 |
| WF-4 | Start a run, `POST /runs` (CON-5) | user-operation | web app | `run_id` minted here, returned to the client | `run`, `lesson_job`, `audit_event`. One job per row in scope, in the same transaction as the run | `test_start_run_capture`: starts a run on the issued sheet with a stub provider; asserts 47 jobs carrying the `run_id`, the pinned prompt version, and a `VALIDATION_INCOMPLETE` refusal that wrote nothing | EV: full-run report; M-17, M-25 (each job's `queued_at` is stamped here) |
| WF-5 | Run progress and unit plan reads, polled every 2 s (CON-6, CON-8) | user-operation | web app | `run_id` | `lesson_job`, `unit_plan`. Reads only; capture is the job rows the poll reads | `test_progress_reflects_jobs`: moves a stub job through each tile state; asserts the poll returns each state within one poll interval | EV: n/a — read-only view of WF-21 and WF-22 records; M-21 (poll latency, timed by WF-29) |
| WF-6 | Run control: cancel, resume, retry failed (CON-7) | user-operation | web app, worker | `run_id`; `job_id` | `run`, `lesson_job`, `audit_event`. A retry creates new attempts on failed jobs only | `test_run_control_capture`: retries a partial stub run; asserts only failed jobs re-queued, ready lessons' hashes unchanged, one audit event per action | EV: fault-injection suite; M-15, M-17 |
| WF-7 | Unit board and unit metrics tiles (CON-9, CON-10) | user-operation | web app | `unit_id`; `request_id` | `lesson`, `issue`, `lesson_metrics`. Reads stored rows only; tiles are never recomputed by a model | `test_board_reads_stored_rows`: seeds lessons and metrics rows; asserts roll-up counts equal the sum of states and the NS tile shows *n* | EV: n/a for correctness; M-1, M-20, M-21 (page load and board poll timed by WF-29) |
| WF-8 | Lesson open, issue list and history: `GET /lessons/{id}`, `GET /lessons/{id}/issues`, `GET /lessons/{id}/history` (CON-11, CON-13, CON-19) | user-operation | web app | `lesson_id`; `version_id`; `request_id` | `lesson_version`, `lesson_doc`, `issue`, `review_event`, `audit_event`. Reads only; open latency logged per request | `test_lesson_open_logs_latency`: opens a seeded lesson; asserts the request log line carries `lesson_id`, `version_id` and a duration | M-18 |
| WF-9 | Collaboration socket edit and durable store (CON-12) | user-operation | collaboration server | `lesson_id` + `store_id` minted per store; the editing `user_id` | `lesson_doc`, `check_job`, `audit_event`. Each store writes Y.Doc bytes, derived JSON, hash and state vector in one transaction | `test_store_capture`: two scripted socket clients edit one lesson; asserts one `lesson_doc` row per store with hash and state vector, a `check_job` for the new hash, and a write after Submit answered with a `refused` message (`LESSON_LOCKED`) that wrote no `lesson_doc` or `audit_event` row (one application-log line instead) | EV: SP-2 assertions, S5 integrity; M-8, M-19, M-24, M-26, M-27, M-36 |
| WF-10 | Checks after every durable store (from `check_job`) | background-job | worker | `lesson_id` + the checked `content_hash` | `check_job`, `issue`, `alignment_link`. Issues keyed to the hash they were computed on | `test_checks_after_store_capture`: stores an edit that deletes a lesson's only checking item; asserts a blocking `issue` for that hash within 5 s and `pending` cleared | EV: check golden suite (one case per blocking rule); M-7, M-26, M-33, M-41 |
| WF-11 | Resolve a block, clear a safety flag and confirm a standard (CON-14) | user-operation | web app, collaboration server | `lesson_id`; `issue_id`; `request_id` | `issue`, `alignment_link`, `safety_flag`, `audit_event`. A resolution or a flag clear records user, reason or note, and time | `test_resolution_capture`: records a resolution, clears a safety flag with a note and confirms an `added` code; asserts the audit events, the flag's `cleared_by` and note, and the alignment link's `asserted_by`; a clear without a note is refused and writes nothing | EV: check golden suite, S7 safety; M-2, M-6, M-38, M-41 |
| WF-12 | Fill a placeholder or excerpt slot (CON-15) | user-operation | web app, collaboration server | `lesson_id`; `store_id` | `lesson_doc`, `audit_event`. The inserted quote's source and rights status are in the stored JSON | `test_fill_slot_capture`: fills an excerpt slot with a source; asserts the store, the audit event, and a `SOURCE_REQUIRED` refusal that wrote nothing | EV: check golden suite; M-7, M-26 |
| WF-13 | Regenerate as a candidate and adopt it (CON-16) | user-operation | web app, worker, collaboration server | `run_id` of a one-lesson run; `lesson_id`; `version_id` of the candidate | `lesson_job`, `model_call`, `lesson_version`, `audit_event`. The current version's hash is unchanged until adoption | `test_candidate_capture`: regenerates an in-review lesson on the stub; asserts candidate v(n+1) "not adopted", the current hash unchanged, and the adopt edit's audit event | EV: full-run report suites apply; M-11, M-28, M-29 |
| WF-14 | AI-assist suggestion and accept or reject (CON-17), *cut #8* | user-operation | web app, collaboration server | `request_id`; `suggestion_id`; `model_call_id` | `suggestion`, `model_call`, `audit_event`. An accepted change is a tagged transaction with the requester's name | `test_ai_assist_capture` (written only if the item lands): accepts one suggestion and rejects one; asserts the `ai-assist` tag in provenance and both audit events | EV: AI-assist cases in the check golden suite; M-10 |
| WF-15 | Lesson transitions: start review, submit, withdraw, request changes, approve, reopen (CON-18) | user-operation | web app, collaboration server | `lesson_id`; `version_id` of the snapshot | `lesson_version`, `review_event`, `lesson_metrics`. Each move is one append-only `review_event` row (the transition log, DO-3 §6); Approve writes the frozen metrics row once, with the rating | `test_transition_capture`: runs submit → approve and a stale-pin approve; asserts the snapshot, one `review_event` per move, one frozen metrics row with the rating, and that the refused call wrote nothing | EV: approval golden cases, S5 integrity, S13 draft quality; M-1, M-3, M-6, M-8, M-9, M-11, M-12, M-13, M-14, M-35, M-37, M-38 |
| WF-16 | Review heartbeats, every 15 s while active (CON-20) | user-operation | web app | `user_id` + `tab_id`; `version_id` | `heartbeat`. Synthetic accounts are stored with a `synthetic` flag and excluded downstream | `test_heartbeat_capture`: a scripted 3-lesson review in two tabs; asserts merged active minutes within ±1 min of the script and no name in any metrics response | EV: S8 measurement; M-1, M-3, M-12, M-43 |
| WF-17 | Run summary read (CON-21) | user-operation | web app | `run_id` | `model_call`, `lesson_job`, `run`. Read only; the summary is a query over stored rows | `test_run_summary_totals`: asserts summary totals equal the sums over stored call rows for a stub run with retries and one lost call | EV: full-run report; M-15, M-16, M-17, M-28, M-29 |
| WF-18 | Coverage matrix (CON-22), *cut #4* | user-operation | web app | `unit_id` | `alignment_link`, `lesson_version`. One query over stored links, never a model | `test_coverage_matrix_reads_links` (written only if the item lands): matches a hand count on 3 lessons | M-14 |
| WF-19 | Export (CON-23), *cut #5* | user-operation | web app | `export_id` minted here | `export_bundle`, `audit_event`. Only approved snapshots, with their hashes | `test_export_capture` (written only if the item lands): exports twice with no change; asserts identical payload hashes and only approved versions | EV: export schema validation; M-36 (export hash = snapshot hash) |
| WF-20 | Prompt guidance save and "try on one lesson" (CON-24), *cut #7* | user-operation | web app, worker | `prompt_version_id`; `run_id` of the trial | `prompt_version`, `lesson_job`, `model_call`, `audit_event`. The locked layer is never written | `test_prompt_version_capture` (written only if the item lands): saves guidance; asserts v(n+1) with diff and reason, and that a running run's pinned version is unchanged | EV: prompt regression rows (roadmap R-40); M-5 |
| WF-21 | Worker: the `UnitPlan` job, one per run | background-job | worker | `run_id`; `model_call_id` | `unit_plan`, `model_call`, `run`. Stored before any lesson job is claimed | `test_unit_plan_capture`: stub run; asserts one plan with 47 entries, its `model_call` with rendered prompt and raw output, stored before the first lesson claim | EV: full-run report; M-15, M-29 |
| WF-22 | Worker: one lesson job (claim, reserve, draft, compile, checks, repair, store, settle) | background-job | worker | `run_id` + `lesson_id` + `job_id`; one `model_call_id` per call | `lesson_job`, `spend_reservation`, `model_call`, `lesson_version`, `lesson_doc`, `issue`, `alignment_link`, `safety_flag`. Raw output saved the moment it arrives; brakes fired and lost calls counted on the job | `test_lesson_job_capture`: one stub lesson through repair; asserts every row, rendered prompt and raw output present, cost from usage fields, and no provider key in any row or log | EV: check golden suite, full-run report; M-5, M-7, M-11, M-15, M-16, M-17, M-25, M-28, M-29, M-31, M-38, M-41 |
| WF-23 | Worker: judge job per (activity, standard), *cut #2* | background-job | worker | `run_id` + `lesson_id`; `model_call_id` | `model_call`, `judge_verdict`, `issue`. Each verdict is a `judge_verdict` row with the served model; a no is also an advisory `judge_no` issue | `test_judge_capture` (written only if the item lands): asserts one verdict row per pair and that none blocks Approve | EV: judge calibration (WF-31); M-6 (advisory input only), M-34 |
| WF-24 | Golden suites S1 intake, S2 checks, S3 drafts, S7 safety notes (R-51 parts 1–2), `npm run eval:golden -- --suite <name>` | validation | eval runner | `eval_run_id` minted per run; each case id | `eval_run`, `eval_case_result`. Each case records its source (DS, SYN, WP id or sheet row) | `test_eval_runner_writes_results`: runs a two-case fixture suite; asserts one result per case with its source and the suite's pass count | EV: S1, S2, S3, S7; M-5, M-7, M-30, M-31, M-38, M-39, M-40 |
| WF-25 | Full-run report on the issued unit (S9; R-51 part 3), `npm run eval:full-run -- --unit G6-U4` | validation | eval runner, worker | `eval_run_id` + the real `run_id` | `eval_run`, `run`, `model_call`. The report file path is stored on the `eval_run` row | `test_full_run_report_shape`: on a stub run, asserts the report has *n* = 47, pass rates, repairs, failures, placeholders and cost, all equal to stored sums | EV: full-run report S9; M-5, M-6, M-7, M-11, M-15, M-16, M-17, M-25, M-28, M-29, M-31, M-33, M-36, M-41 |
| WF-26 | Seeded-error run (S10; R-52), `npm run eval:seed`, *cut #6* | validation | eval runner, web app | `eval_run_id`; each planted error's id | `eval_run`, `eval_case_result`, `audit_event`. Planted by someone other than the reviewer | `test_seeded_error_capture` (written only if the item lands): asserts each planted error has a caught-before-approval result | EV: seeded-error suite; M-4 |
| WF-27 | Held-out structural comparison (S11; R-53), `npm run eval:heldout`, *cut #2* | validation | local script | `eval_run_id` | `eval_run`. Counts only; the report lives outside tracked files | `test_heldout_report_counts_only` (`evals/src/heldout/heldout.test.ts`): asserts the report holds numbers only and is written outside the repo's tracked paths | EV: held-out comparison S11; M-42 |
| WF-28 | HP-7 fault-injection script (S6), `npm run eval:faults`: kill, 429, truncation and cap tests on a stubbed provider | validation | fault script, worker | `eval_run_id` + the stub `run_id` | `eval_run`, `lesson_job`, `model_call`, `spend_reservation`. Each test's assertions stored as case results | `test_fault_script_records`: runs the cap test; asserts settled spend ≤ cap and the `capped` state recorded | EV: fault-injection suite S6; M-15, M-17, M-44 |
| WF-29 | HTTP load probe at the 200-user spike (S14; R-57 as amended), `npm run load:spike`, on the VPS with the provider stubbed | validation | load script, web app | `probe_run_id`; each virtual user id | `probe_run`. p95s, error rate, connection counts and event-loop lag, with *n* and the machine | `test_probe_writes_run`: a 5-user, 10-second probe; asserts a `probe_run` row with p95s and *n* | EV: capacity targets S14 (capacity doc); M-18, M-20, M-21, M-22, M-23 |
| WF-30 | Yjs socket load script (R-56 as amended), *cut #1* | validation | load script, collaboration server | `probe_run_id`; simulated editor ids | `probe_run`. Remote-edit and stored p95s and lost updates | `test_yjs_probe_writes_run` (written only if the item lands): 3 editors on 1 lesson; asserts the row and 0 lost updates; if cut, the docs say Yjs latency was not measured | EV: S14; M-19, M-22, M-24, M-27 |
| WF-31 | Judge calibration (S12): ~30 pairs labelled by Innocent (R-23), `npm run eval:judge-calibrate`, *cut #2* | validation | eval runner | `eval_run_id` | `eval_run`, `eval_case_result`. Agreement and *n* | `test_calibration_record` (written only if the item lands): asserts agreement and *n* are stored | EV: judge calibration S12; M-34 (gates the judge's use) |
| WF-32 | SP-1: one call per lesson on rows 8, 9, 25 | development-experiment | spike harness | `experiment_id` = `SP-1` + each call's id | `experiment_run`, `model_call`. Spike reports written before migrations exist are imported into these tables once they do | `test_experiment_import`: imports a fixture spike report; asserts one `experiment_run` and one `model_call` per recorded call with tokens, cost and stop reason | EV: SP-1 pass line; M-11, M-16, M-28, M-29, M-31 (seed values only) |
| WF-33 | SP-2: Submit freeze and approval pinning under live edits | development-experiment | spike harness, collaboration server | `experiment_id` = `SP-2` + run number | `experiment_run`. 20 runs per assertion, store p95 | `test_experiment_import` (same importer, SP-2 fixture) | EV: SP-2 pass line; M-19, M-24, M-27, M-36, M-37 (seed values only) |
| WF-34 | SP-3: quote, page and name scans on planted inventions | development-experiment | spike harness | `experiment_id` = `SP-3` + plant id | `experiment_run`. Caught plants and false flags per lesson | `test_experiment_import` (same importer, SP-3 fixture) | EV: SP-3 pass line; M-7, M-32, M-33 |
| WF-35 | Sample builder `docs/data/scripts/build_samples.py` | runtime-operation | operator script | `ops_event_id`; the script's input hash | `ops_event`. Inputs, outputs and their hashes | `test_build_samples_logs_event`: runs the builder on its fixture; asserts one `ops_event` with input and output hashes | n/a — builds test inputs; no metric or model output |
| WF-36 | Database migrations, `npm run db:migrate` (also run at each process start) | runtime-operation | migration runner | migration id | `schema_migrations`, `ops_event`. One row per applied migration | `test_migrations_recorded`: migrates an empty database; asserts every migration file has a row | n/a — schema change only; no metric |
| WF-37 | Seeds, `npm run db:seed`: CDE standards table and one demo account per role (R-4, R-54) | runtime-operation | seed script | `ops_event_id` | `standard`, `app_user`, `ops_event`. Counts per standard set | `test_seed_counts`: seeds an empty database; asserts the expected row counts and one account per role | n/a — reference data; no metric |
| WF-38 | Deploy: Docker Compose up, `npm run dev` (recording); `render.yaml` committed, not provisioned | runtime-operation | Compose, each Node process at start | `RENDER_GIT_COMMIT` or the local git SHA as `build_id` | `ops_event`. One start event per process with its `build_id` | `test_start_event`: starts each process entry point against a test database; asserts its start event with a non-empty `build_id` | n/a — deployment only; no metric |
| WF-39 | Health routes `GET /healthz` on `web`, `worker` and `collab` | runtime-operation | each Node process | `request_id` | `ops_event`. Only failures are recorded, as events | `test_healthz`: asserts 200 when Postgres is reachable and a 503 plus one failure event when it is not | n/a — liveness only; no metric |
| WF-40 | Backup, `npm run ops:backup`: one `pg_dump` after the full run, before recording (PD-30) | runtime-operation | operator script | `ops_event_id` | `ops_event`. Dump path, size and SHA-256 | `test_backup_logs_event`: runs the script against a test database; asserts the event and a readable dump | n/a — recovery only; no metric |
| WF-41 | Collaboration internal command routes (`/internal`, bearer `COLLAB_INTERNAL_TOKEN`, Compose network only): lock-and-snapshot (Submit), apply-edit (CON-14 standards, CON-15, CON-16 adopt, CON-17 accept), set-mode (Withdraw, Request changes, Reopen) | user-operation | web app, collaboration server | the originating web `request_id`; `lesson_id`; `store_id` | `lesson_doc`, `lesson_version`, `review_event`, `audit_event`. Each command is one transaction attributed to the named person, carrying the web request's `request_id` | `test_internal_command_capture`: calls apply-edit and lock-and-snapshot with the token and a `request_id`; asserts the store row, the Submit snapshot and the `request_id` on the audit and review rows; a call without the token gets 401 and a write to a frozen lesson gets `LESSON_LOCKED`, each writing no row | EV: S5 integrity invariants; M-36, M-37 |
| WF-42 | Grounding plants suite (S4), `npm run eval:grounding` over the seeded copies | validation | eval runner | `eval_run_id`; each plant id | `eval_run`, `eval_case_result`. One result per plant (caught or missed) and false flags per clean lesson | `test_grounding_suite_records`: runs a two-plant fixture; asserts one result per plant with its source and the clean lesson's false-flag count | EV: S4; M-32, M-33 |
| WF-43 | Integrity invariants suite (S5), `npm run test:e2e -- integrity --trials 20` (Playwright, 3 browser contexts) | validation | Playwright runner, web app, collaboration server | `eval_run_id`; trial number | `eval_run`, `eval_case_result`. One result per assertion per trial, with the store p95 | `test_integrity_suite_records`: runs one trial of one assertion; asserts the case result with its trial number and the report path on the `eval_run` row | EV: S5; M-27, M-36, M-37 |
| WF-44 | Heartbeat measurement suite (S8), `npm run test:e2e -- heartbeat`, plus Innocent's stopwatch sheet | validation | Playwright runner, web app | `eval_run_id`; each scripted review id | `eval_run`, `eval_case_result`, `heartbeat`. Computed against scripted minutes per case; scripted heartbeats carry the `synthetic` flag | `test_heartbeat_suite_records`: runs one scripted review; asserts computed and expected minutes on the case result and every scripted heartbeat flagged synthetic | EV: S8; M-1, M-43 |
| WF-45 | JSON Schema emitter, `npm run schemas:emit` (`packages/schema/scripts/emit-json-schemas.ts`) | runtime-operation | operator script | the git SHA; each emitted file's hash | The emitted files `docs/contracts/schemas/*.schema.json` and `docs/contracts/lesson-export.schema.json`; no database record (a build step that runs without Postgres) | `test_schemas_emit_clean`: runs the emitter; asserts the output is byte-identical to the committed files and the export schema validates a fixture lesson | n/a — build artifact for CON-23 and the contracts; no metric or model output |
| WF-46 | §9 experiment kickoff page generator, `npx tsx evals/src/kickoff/cli.ts` (npm alias `eval:kickoff`): writes `docs/artifacts/<date>-experiment-kickoff.html` from the code | development-experiment | operator script | the git SHA; the output file's SHA-256 | `kickoff.html` (the generated page `docs/artifacts/<date>-experiment-kickoff.html`). Its footer names the git SHA, prompt versions and generator version; there is no database record (a build step that runs without Postgres) | `test_kickoff_page_from_code`: generates the page from fixtures; asserts every prompt layer appears verbatim with its version, every pipeline node name appears, the FC rows of DO-5 appear, the footer names the SHA, the page is standalone HTML, and changing a prompt file changes the page | n/a — a reading aid for the error-analysis round (§9); no metric or model output |

Workflow classes. Every class is present.

| Class | Present | Workflows or reason |
|---|---|---|
| user-operation | yes | WF-1, WF-2, WF-3, WF-4, WF-5, WF-6, WF-7, WF-8, WF-9, WF-11, WF-12, WF-13, WF-14, WF-15, WF-16, WF-17, WF-18, WF-19, WF-20, WF-41 |
| background-job | yes | WF-10, WF-21, WF-22, WF-23 |
| validation | yes | WF-24, WF-25, WF-26, WF-27, WF-28, WF-29, WF-30, WF-31, WF-42, WF-43, WF-44 |
| development-experiment | yes | WF-32, WF-33, WF-34, WF-46 |
| runtime-operation | yes | WF-35, WF-36, WF-37, WF-38, WF-39, WF-40, WF-45 |

**Metric coverage check** (every `M-n` in DO-7, M-1…M-44, has at least one workflow; reconciled 2026-10-25 after
M-21…M-44 were added): M-1 WF-7, 15, 16, 44 · M-2 WF-11 · M-3 WF-15, 16 · M-4 WF-26 · M-5 WF-20, 22, 24, 25 · M-6 WF-11, 15, 23, 25 · M-7 WF-10, 12, 22, 24, 25, 34 · M-8 WF-9, 15 · M-9 WF-15 · M-10 WF-14 · M-11 WF-13, 15, 22, 25, 32 · M-12 WF-15, 16 · M-13 WF-3, 15 · M-14 WF-15, 18 · M-15 WF-6, 17, 21, 22, 25, 28 · M-16 WF-17, 22, 25, 32 · M-17 WF-4, 6, 17, 22, 25, 28 · M-18 WF-8, 29 · M-19 WF-9, 30, 33 · M-20 WF-7, 29 · M-21 WF-5, 7, 29 · M-22 WF-29, 30 · M-23 WF-29 · M-24 WF-9, 30, 33 · M-25 WF-4, 22, 25 · M-26 WF-9, 10, 12 · M-27 WF-9, 30, 33, 43 · M-28 WF-13, 17, 22, 25, 32 · M-29 WF-13, 17, 21, 22, 25, 32 · M-30 WF-24 · M-31 WF-22, 24, 25, 32 · M-32 WF-34, 42 · M-33 WF-10, 25, 34, 42 · M-34 WF-23, 31 · M-35 WF-15 · M-36 WF-9, 19, 25, 33, 41, 43 · M-37 WF-15, 33, 41, 43 · M-38 WF-11, 15, 22, 24 · M-39 WF-2, 24 · M-40 WF-2, 3, 24 · M-41 WF-10, 11, 22, 25 · M-42 WF-27 · M-43 WF-16, 44 · M-44 WF-28.
Four metrics rest only on cut workflows: **M-4** (G-3, WF-26, cut #6), **M-10** (V-6, WF-14, cut #8), **M-34** (judge
agreement, WF-23 and WF-31, cut #2) and **M-42** (held-out agreement, WF-27, cut #2). If those cuts fire, the metric is
reported as "not measured", never as zero. M-14 keeps WF-15 (core) when the matrix is cut.

The SD-3.7 list is covered row for row: upload and link import (WF-2, WF-3); run start, cancel, retry (WF-4, WF-6);
worker jobs (WF-21, WF-22, WF-23, WF-10); progress polling (WF-5); editor socket and persistence (WF-9); checks on save
(WF-10); regenerate (WF-13); AI assist (WF-14); approve, request changes, reopen (WF-15); prompt guidance (WF-20);
export (WF-19); heartbeats and frozen metrics (WF-16, WF-15); golden suite and full-run report (WF-24, WF-25);
seeded-error run (WF-26); held-out comparison (WF-27); HTTP probe and Yjs load script (WF-29, WF-30); spikes (WF-32…34);
migrations and seeds (WF-36, WF-37); sample builder (WF-35); deploy (WF-38). Added beyond SD-3.7: sign-in and the demo
login (WF-1), board and lesson reads (WF-7, WF-8, WF-17), the fault-injection script (WF-28), judge calibration (WF-31),
health routes (WF-39, SD-6.6), the backup (WF-40, PD-30), and from the §6 requirements sweep (2026-10-25): the
collaboration server's internal command routes (WF-41), the S4, S5 and S8 suites that run outside `eval:golden`
(WF-42, WF-43, WF-44) and the JSON Schema emitter (WF-45).

## Correlation across boundaries

One run of generation is linked end to end by **`run_id`**, minted by the web app when the run row is created (WF-4)
and returned to the client.

- **Web app → Postgres → worker:** `run_id` is a column on every `lesson_job`; the worker reads it with the claim. No
  in-memory hand-off exists, so a restart loses nothing.
- **Worker → model provider:** each call gets a `model_call_id` before it is sent; the row carries `run_id`,
  `lesson_id`, `job_id` and the attempt number, and is written *before* the call (rendered prompt) and updated the
  moment the response arrives (raw output, usage, stop reason, served model). The provider's request id from the
  response headers is stored on the row, so a provider-side question can be matched.
- **Worker → stored lesson:** every `lesson_version` carries `run_id` and the `model_call_id`s that produced it in its
  provenance (R-35).
- **Interactive requests:** the web app mints a **`request_id`** per HTTP request (or accepts `X-Request-Id` from the
  client), puts it on every log line and on any `audit_event` the request writes, and returns it in the response
  header. A refusal's error envelope carries it in `details`, so a screenshot of an error can be traced.
- **Collaboration channel:** a socket has no request; each durable store mints a **`store_id`** written on the
  `lesson_doc` row, the `check_job` row and the audit event, and sent in the `stored` acknowledgement as the hash. The
  checks that follow carry the `content_hash` they ran on, so "which store produced this issue?" is one join.
- **HTTP-started content edits** (CON-14, CON-15, CON-16 adopt, CON-17 accept) pass the originating `request_id` to the
  server-side collaboration connection, which writes it on the resulting store's audit event.
- **Review time:** heartbeats carry `user_id`, `tab_id` and `version_id`; approval's frozen `lesson_metrics` row records
  the `version_id` it measured.
- **Experiments and validation:** every eval, probe and spike run mints its own id (`eval_run_id`, `probe_run_id`,
  `experiment_id`), and stores its configuration (prompt version, model id, parameters, case set, machine, stub or
  real provider) on that row. A real generation run started by an eval (WF-25) carries both its `run_id` and the
  `eval_run_id`.

## Storage and access

| Records | Where | Kept for | Who reads | Chosen because |
|---|---|---|---|---|
| Traces (`model_call`), job and run state, issues, versions, audit log | project Postgres | the life of the project database, no automatic deletion (PD-30) | Innocent as operator by SQL; the run summary and tiles in the app | PD-19 / AD-17: pre-adoption content may not go to a tracing vendor; one store, one backup |
| Heartbeats and frozen metrics rows | project Postgres | the life of the project database (PD-30) | the app's tiles, **aggregate only**; Innocent by SQL | GR-15: never per person on any screen or route |
| Eval, probe and experiment results | project Postgres; report files under `docs/` (the held-out report outside tracked files, R-53) | the life of the project | Innocent; the submission docs cite them | evidence for the technical documentation (SD-8.5) |
| Process logs | stdout as JSON lines; Docker's log driver locally; Render keeps 7 days if ever deployed (hosting rule) | local: until the container is removed | Innocent | no extra service; enough to correlate by `request_id` |
| Backup | one `pg_dump` file after the full run (PD-30) | until the submission is graded | Innocent | the only copy if Postgres is lost (DO-1 §6.2) |

Access: the demo has one operator. Postgres is not published outside the Compose network (architecture TB-6). No
route returns raw traces; the trace browser is cut #6 (R-48).

## Content and redaction

- **Raw, by design:** the rendered prompt and the raw model output on every `model_call` (R-48, SD-8.7). This is safe
  because prompt content is bounded (GR-10, AR-29): the schema, 1–2 structure-only examples, official standards text,
  outline rows and supplied public-domain text. No student or teacher data exists in the system (GR-13).
- **Never recorded anywhere:** content from `docs/source/restricted/` (GR-9); provider API keys (loaded by
  `bin/with-provider-env`, never logged; a capture test asserts their absence from rows and logs, WF-22); passwords or
  session tokens; review minutes joined to a name in any response (GR-15).
- **Redacted before logging:** an unknown email at a refused sign-in is written to the application log hashed and
  never to a table (WF-1); log lines carry ids, never lesson text.
- **What leaves the environment:** prompts to Anthropic and, if the judge lands, the judge's narrow input to OpenRouter
  (architecture TB-3, TB-4). Nothing goes to a tracing or analytics vendor.

## Missing instrumentation

Silence must never look like "no traffic". Four checks make a missing record visible:

1. **Sums must match.** The run summary (CON-21) is computed from `model_call` rows and compared with the `run` row's
   settled spend and job counts. A mismatch is shown on the summary as "trace incomplete" and fails WF-17's test.
2. **Every terminal job has its calls.** A `ready` or `generation_failed` job with no `model_call` row (and no raw-output
   checkpoint) is flagged by a completeness query run at the end of every run and by the full-run report (WF-25).
3. **Every store has its check.** A `lesson_doc` hash with no `issue` set and no open `check_job` after 30 s is listed as
   "unchecked" on the operator query and keeps the lesson's `pending` flag true, so Submit stays off (CON-13).
4. **Every process says it started.** WF-38's start events and WF-39's health failures mean a container that never came
   up is visible as a missing start event for the current `build_id`.

The fault-injection script (WF-28) kills the worker mid-call on purpose and asserts that the lost calls are *counted*
(`lesson_job.calls_lost`), not missing. The run summary (CON-21) reports their run total as `calls_lost_in_flight`
(the sum of `lesson_job.calls_lost` over the run's jobs; DO-4 §5 `RunService.summary`).

## Capture verification

Each workflow's capture is proved by the test named in its row. The rules those tests follow:

- **Drive the real entry point**, not the shared adapter: the HTTP route through the Next.js handler, the socket
  through a real Hocuspocus provider client, the job through the worker's claim loop, the script through its command.
  A passing `model_call` adapter test is not capture verification for WF-22.
- **Assert the records exist** with their correlation ids, and **assert forbidden values are absent**: the provider key,
  restricted-folder text (a seeded marker string), and names next to review minutes.
- **Use the stub provider** for everything except SP-1 and the full run (WF-25), so capture tests cost no model spend.
- **Refusals are captured too, in the log, not the tables:** each user-operation test includes one refused call and
  asserts it wrote no row at all (no state, version, approval, audit or spend row) and left one application-log line
  with its `request_id` and error code (INTERFACE shared guarantee 2: a refused attempt goes to the application log,
  never to the audit table).
- Cut workflows keep their row; their test is written in the same ticket that builds the item, never later.

## Registering a new workflow

Before a new entry point, job, script or experiment runs, its author:

1. adds a `WF-n` row above with its class, emitting components, correlation id and required records (tables named in
   backticks, each with a storage location in the architecture's data-authority table);
2. names the evaluation suite and the DO-7 metrics it inherits, or `n/a — <reason>`;
3. adds its capture check, which drives the real entry point and fails if the records are missing;
4. cites the `WF-n` in the ticket's *Entry points added or changed* line;
5. re-runs `python3 .claude/workflow/system-design-readiness/scripts/design_outputs.py check-obs docs/design/observability.md`.
