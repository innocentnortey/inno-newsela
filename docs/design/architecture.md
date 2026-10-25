# Architecture (DO-2) — Newsela Lesson Studio

**Owner of:** which components exist, what each is responsible for, who owns each record, the trust boundaries, every
place a model decides (with its rung and its verification rungs), and the loop brakes. **Written:** 2026-10-25 by
Claude (System track, §6). **Status:** ready — Claude's recommendation adopted under Innocent's standing authorization
(PD-32). **Feeds:** the planned submission `docs/ARCHITECTURE.md` (SUBMISSION.md) and the code design
`docs/design/code-design.md` (DO-3), which owns exact module names, types and table columns.
**External behaviour is never restated here:** each boundary links its card in
[`docs/contracts/INTERFACE.md`](../contracts/INTERFACE.md) (CON-1…CON-24). Sizing and the decision sentences are in the
[system design](system-design.md) (DO-1); telemetry is in [observability](observability.md) (DO-6).

## What it looks like in practice

Three people work on Unit 4 at once. The **author** uploads the outline in the browser; the **web app** normalizes it
in plain code (no model, PD-27) and stores an immutable outline version. She presses Generate; the web app writes a run
and 47 job rows to **Postgres** and returns. The **worker** picks the jobs up, calls **Anthropic** once per lesson,
checks each draft in code and stores it. A **reviewer** opens Lesson 4; his edits travel over a websocket to the
**collaboration server** (Hocuspocus), which is the only thing allowed to write lesson content. An **approver** approves
the frozen snapshot through the web app. Nothing a model writes reaches a lesson without passing code checks, and
nothing reaches "approved" without a named person.

## 1. Components

| Component | Runs as | Responsible for | Must not |
|---|---|---|---|
| **Web app** (Next.js, TypeScript) | one container, `web` | every page; the HTTP API for CON-1…CON-11 and CON-13…CON-24; sign-in and role checks (R-54); the intake normalizer and validation (HP-6); run creation; transitions and approval (HP-5); heartbeats; export; the AI-assist call (CON-17) | write lesson content directly (it hands content changes to the collaboration server, INTERFACE shared guarantee 3); call the generation model |
| **Worker** (Node, TypeScript) | one container, `worker` | the generation pipeline (HP-1): `UnitPlan`, per-lesson draft, compile, checks, one repair, store; the judge (cut #2); checks after every store from `check_job` (DO-1 D-6); spend reservation and settlement (HP-7) | serve user requests; write an edited lesson (it seeds v1 only, and candidates beside the current version, R-29) |
| **Collaboration server** (one Hocuspocus process, Node) | one container, `collab` | the Yjs channel CON-12: authenticated sockets, sync, awareness, durable stores (Y.Doc + derived JSON + hash + state vector in one transaction, HP-4), lock at Submit, read-only mode | accept a write in a frozen state or from a non-reviewer connection (CON-12 permissions) |
| **Postgres** | one container, `postgres` | records, the `lesson_job` and `check_job` queues, Yjs persistence, traces, heartbeats, the audit log | be reachable from outside the Compose network |
| **Anthropic Messages API** | external | `UnitPlan`, `LessonDraft`, repair, AI-assist rewrite (PD-12: a strong mid-tier model for plan and drafts, a cheaper one for repair) | see restricted content, student data or full copyrighted text (GR-9, GR-10, GR-13) |
| **Judge provider via OpenRouter** (cut #2) | external | the advisory per-(activity, standard) verdict on a different provider from the generator (PD-12, R-23); an OpenAI model reached through OpenRouter (Proposal, adopted under PD-32: one key, the workspace's shared launcher) | block Approve (R-23); see anything beyond the candidate text, the standard's text and the rubric |
| **Google Sheets export URL** | external, read once per upload | the public `…/export?format=csv` or `format=xlsx` fetch (R-2) | be re-fetched after the snapshot is stored (SD-6.4) |

The three Node processes share one code base and one Zod schema module (PD-11, R-11 as amended); `web` builds from one
image, `worker` and `collab` from a second image with two entry points (AD-15).

## 2. Trust boundaries

| # | Boundary | What crosses it | Guard |
|---|---|---|---|
| TB-1 | Browser → web app | HTTP requests with the session cookie | session check and role check on the server for every operation (CON-1; INTERFACE shared guarantee 1); outline cells and model text returned as text, never HTML (R-58) |
| TB-2 | Browser → collaboration server | one websocket per lesson, `lesson:<lesson_id>` | the app session authenticates the socket; writes only from `reviewer` connections in an editable state (CON-12) |
| TB-3 | Web app / worker → Anthropic | rendered prompts out, structured output in | provider key loaded only by `bin/with-provider-env` (workspace rule shared-provider-credentials), never in a project file or image; outline text enters prompts only as delimited, labelled data (R-6); the locked prompt layer has no edit path (R-38); output parsed by Zod before any code uses it |
| TB-4 | Worker → judge provider (cut #2) | the candidate activity, the standard's official text, the rubric | same key handling; advisory output only |
| TB-5 | Web app → Google Sheets | one GET of a public export URL | private sheets refused with `SHEET_NOT_PUBLIC` (CON-2); the fetched bytes are hashed and stored once |
| TB-6 | Any process → Postgres | SQL over the Compose network | parameterized queries; the audit log rejects UPDATE and DELETE (R-35); Postgres is not published on a host port in the demo Compose file |
| TB-7 | Repo → anything | — | `docs/source/restricted/` is git-ignored and never mounted into a container (GR-9, PD-20) |

**Untrusted input** is anything from the outline sheet (cells can hold instruction-shaped text, SYN-1) and anything a
model returns. Both are treated as data: the outline is normalized and validated in code (HP-6), and model output is
schema-checked, compiled by code into allow-listed nodes only (R-11, R-58) and checked before storage (R-19).

## 3. Data authority (who owns each record)

Table names are the architecture's names; DO-3 fixes the columns and types.

| Record | Table | Written only by | Read by | Notes |
|---|---|---|---|---|
| Staff accounts and sessions | `app_user`, `app_session` | web app (seed, sign-in) | all three processes | one role per account (CON-1) |
| Outline versions and rows | `outline_version`, `outline_row` | web app | worker, web app | immutable, SHA-256 per version (R-1) |
| Intake choices and warning defaults | `intake_choice` | web app | worker | `default` or `confirmed by <name>` (R-5 as amended) |
| Official standards text | `standard` | seed script | all | CDE text, static (GR-5) |
| Unit plan and cross-lesson links | `unit_plan`, `lesson_link` | worker (plan); web app at intake (links) | worker, web app | links are computed by code, never by the model (HP-1) |
| Runs, jobs and spend | `run`, `lesson_job`, `spend_reservation` | web app (create, control); worker (claim, progress, settle) | web app (board, summary) | one table is both queue and progress (HP-7) |
| Model calls (traces) | `model_call` | worker; web app for AI assist | web app (run summary), operator SQL | rendered prompt, raw output, tokens, cost, stop reason (R-48) |
| Live lesson document | `lesson_doc` | **collaboration server only** (worker seeds v1 through the same store function) | web app (reads the derived row), worker (checks) | Y.Doc bytes + derived `Lesson` JSON + hash + state vector, one transaction (HP-4) |
| Lesson versions and snapshots | `lesson`, `lesson_version` | worker (v1, candidates), collaboration server (Submit snapshot), web app (Approve, reopen) | everyone | immutable snapshots with provenance (R-35) |
| Checks and their results | `check_job`, `issue`, `alignment_link` | collaboration server (enqueue in the store transaction); worker (run, write) | web app | issues keyed to the checked hash (CON-13) |
| AI suggestions | `suggestion` | web app | web app, collaboration server (on accept) | held outside the document, anchored by relative positions (R-31 as amended) |
| Audit log | `audit_event` | web app, collaboration server | web app (history), operator | append-only; UPDATE and DELETE rejected (R-35) |
| Review activity and frozen metrics | `heartbeat`, `lesson_metrics` | web app | web app (tiles, aggregate only) | never returned with a name (GR-15) |
| Prompt versions | `prompt_version` | web app (guidance layer only) | worker | locked layer has no write path (R-38) |
| Exports | `export_bundle` | web app | operator | approved snapshots only (R-42) |
| Validation, probe and experiment results | `eval_run`, `eval_case_result`, `probe_run`, `experiment_run` | the scripts that run them | operator | see DO-6 workflows |
| Operations events and applied migrations | `ops_event`, `schema_migrations` | migration runner, seed, backup and health scripts; each process at start | operator | see DO-6 |

**Canonical copy (HP-4).** During editing the Y.Doc is authoritative. Checks, approval and export read the derived JSON
written in the same transaction, or an immutable snapshot. Two copies written separately would drift (GP-117), so no
code path writes one without the other.

## 4. Data flows

**F-1 · Intake to a run.** Upload or link (CON-2) → normalize and validate in code (HP-6) → validation report (CON-3) →
author confirms errors and warning defaults (CON-4) → Generate (CON-5): `run` + one `lesson_job` per row in one
transaction, refused with `VALIDATION_INCOMPLETE` while an error is unconfirmed → worker: `UnitPlan` call, stored before
any lesson job is claimed (R-8) → lesson jobs (DO-1 §4.2) → board polls progress every 2 s (CON-6, PD-18).

**F-2 · Edit, store, check.** Socket update (CON-12) → broadcast → debounced store (one transaction: `lesson_doc` +
`check_job`) → `stored` acknowledgement → worker runs checks → `issue` rows → the workspace re-reads the issue list
(CON-13). Content changes that start as HTTP calls (CON-14 standards, CON-15 fills, CON-16 adopt, CON-17 accept) are
applied through a server-side collaboration connection as logged edits by a named person.

**F-3 · Submit, approve, export.** Submit (CON-18): zero blocking issues and all edits stored → the collaboration server
locks the document, flushes, writes a snapshot `lesson_version`, switches every socket to read-only. Approve: the
approver sends the snapshot hash and state vector; the web app re-runs the blocking checks on the snapshot, compares the
pin, refuses with `STALE_PIN` on any mismatch, requires a rating (R-60) and four-eyes, then writes the transition,
`audit_event` and the frozen `lesson_metrics` row. Export (CON-23) reads approved snapshots only.

## 5. Every place a model decides, and its rung

The system is a **fixed pipeline, not an agent** (PD-3). Rung, per agent-architecture rule 2: *single structured call*
everywhere; no tools, no loop, no planner, no multi-agent. Code owns every routing decision and every "done".

| Decision point | Model | Rung | Why one rung lower would not work | What code does instead of a model |
|---|---|---|---|---|
| `UnitPlan`: per day a purpose, routines, hand-forward, task thread (R-8) | generation model | single structured call | no rung lower: writing a pedagogical arc is language work no rule can do | the `lesson_link` rows (computed at intake), the day list and the types |
| `LessonDraft`: role-tagged blocks for one lesson (R-11) | generation model | single structured call | same; the teaching text is the product | compile to ProseMirror, section templates and minutes, every blocking check |
| Repair: one rewrite given the failing checks (R-19) | cheaper model | single structured call, once | dropping it sends every fixable miss (a 3-minute Look Back) to a reviewer | deciding *whether* to repair: a pure function over check results |
| Judge verdict per (activity, standard), cut #2 (R-23) | another provider via OpenRouter | single structured call, binary | a code check cannot tell whether an activity teaches a standard; it can only check the link exists (which it does, blocking) | the blocking "taught and checked" link check (R-19) |
| AI-assist rewrite of a selection (R-31), cut #8 | generation model | single structured call | the request is free-text rewriting by definition | anchoring, accept/reject, re-check, the audit tag |
| AI-proposed leaf codes for empty lists (R-20, U7) | generation model, inside the draft | part of the `LessonDraft` call | — | marking them `added`, blocking until a named reviewer confirms (HP-3) |

Deterministic code was chosen instead of a model for: the outline normalizer and every intake proposal (PD-27), the
check suite (R-19), alignment coverage and the coverage matrix (R-41), the safety-note classifier (pattern rules, HP-9),
cross-lesson links (HP-1), and all routing (HP-1 loop-owner table).

### 5.1 Who decides "what next" and "am I done" (from HP-1)

| Loop | What next | Am I done |
|---|---|---|
| Run | code: the fixed order and the queue | code: every job terminal (`ready`, `generation_failed`, `cancelled`) or a brake fired (`capped`, `paused`) |
| Lesson job | a pure function over check results: store, repair or fail | code: blocking checks pass, or a brake stops it |
| Release | a reviewer picks from the triage queue (CON-9) | the named approver, per lesson, on a pinned snapshot (CON-18) |

The model never routes and never declares done; a job returns a typed result, not a transcript.

### 5.2 Loop brakes (explicit, logged when fired; HP-1, HP-7)

| Brake | Value | Fires as |
|---|---|---|
| Repair rounds per lesson | 1 | `generation_failed` with reasons |
| Retries on 429 / 5xx | ≤ 3, honouring `retry-after`, with jitter | `generation_failed: rate_limited` (expected ≈ 0.8% of calls at a 20% 429 rate [C], HP-7) |
| Truncation retry | 1 with a raised output cap, separate from the repair | `generation_failed: truncated` |
| Job wall clock | 10 min [T] | `generation_failed: timeout` |
| Spend | reservation against run, user-day and build caps (DO-1 §7.1) | run `capped`; `DAY_CAP_REACHED` |
| Concurrency | ≤ 6 jobs in flight [A] → SP-1 | jobs wait in `queued` |
| Circuit breaker | 3 lessons in a row failing the same check | run `paused` |

Each fired brake is counted in the run summary (`brakes_fired`, CON-21) and recorded on the job row (DO-6).

## 6. Verification rungs per model path

Rungs in rising strength (verification rule §1): automated flags and authoritative-source checks → narrow judge →
hard business rules in code → human approval.

| Output path | Rungs used | What each catches | What it does not catch |
|---|---|---|---|
| `LessonDraft` → stored lesson | (1) Zod schema and allow-listed nodes; (2) hard rules in code: sections and minutes, standards taught *and* checked, codes in the row's lists, quote/page/name scans (HP-2, SP-3 sets the name scan's scope), rights status, safety tip placement; (3) advisory judge if built; (4) **human approval** of a pinned snapshot with an evidence pane and checklist | malformed output; missing sections; unmapped standards; invented quotes, pages and unsourced names; missing teacher tips | whether the teaching is *good* (only the approver's rating, R-60, and the judge's advisory verdict touch it); scenes the outline did not flag (HP-9 limit) |
| `UnitPlan` | Zod schema; 47 entries; links come from code, not the plan | malformed or short plans | a weak arc; arc checks are advisory and cut #3 |
| Repair output | the same rungs as the draft; never more than once | a repair that still fails stays failed | — |
| Judge verdict (cut #2) | calibration against ~30 of Innocent's labels with agreement and *n* (R-23); never enters a gate | a judge that disagrees with the human labels | expert-level judgment (the labeller is not an expert, PRD §12) |
| AI-assist suggestion | a person accepts or rejects; the accepted change is tagged, logged and re-checked; a pending suggestion blocks Submit and Approve | AI text entering silently (GR-7) | a reviewer accepting a weak rewrite (V-6's accepted-then-rewritten rate watches it) |
| AI-proposed leaf codes | `added` confirmation blocks Approve until a named reviewer confirms (HP-3) | an unconfirmed claim of alignment | a reviewer confirming carelessly (G-1 watches resolutions) |

**Evals are part of the architecture.** The golden suites (one case per outline defect and per blocking rule, including
cases whose right answer is a placeholder), the full-run report, the seeded-error run and the held-out structural
comparison are specified in the evaluation plan `docs/design/eval-plan.md` (DO-5). A prompt or model change reports
eval score and cost before and after (verification rule §8).

## 7. Deployment

- **Recording:** Docker Compose on the Mac: `web`, `worker`, `collab`, `postgres` (PD-15 option D, DO-1 D-9). Provider
  keys enter only through `bin/with-provider-env`; Postgres is on the internal network only.
- **Committed, not provisioned:** two `Dockerfile`s and `render.yaml` with AD-15's shape (the Next.js service; one Node
  service with the worker and Hocuspocus entry points; Render Postgres Basic), ~$20/month [C]. Deploy flow GitLab →
  GitHub mirror → Render when Innocent approves the spend (hosting rule).
- **Load testing:** the same images on the VPS with the model provider stubbed (capacity doc).
- **Health:** each Node process exposes a liveness route for Compose and Render health checks (DO-6 WF-39). It is an
  operations route outside the interface spec, because no screen uses it.

## 8. Decisions this architecture rests on

The decision sentences are in DO-1 (*Decisions*, D-1…D-10). The architecture-specific ones, in short form:

**A-1 · Content has one writer (HP-4, R-26 as amended).** Because two writers of lesson content would let the derived
JSON drift from the live document, we chose the collaboration server as the only writer, with HTTP-started content
changes applied through a server-side connection, at the cost of routing four HTTP cards (CON-14, CON-15, CON-16,
CON-17) through the socket server. It should give zero drift between the Y.Doc and its derived row. We will verify it
with SP-2's round-trip runs and a test that no web-app code path writes `lesson_doc`, and revisit it when a second
collaboration process is added (scale step 3).

**A-2 · Two images, three processes (AD-15).** Because a worker restart must not drop editors' sockets and a socket
crash must not stop a run, we chose separate `worker` and `collab` containers from one image with two entry points, at
the cost of one more container to watch. It should give independent restarts. We will verify it by killing each
container during the load script, and revisit it when Render forces one service to run both (then a process manager
inside one service keeps them as separate processes).

**A-3 · The judge on another provider through OpenRouter (PD-12; route a Proposal, adopted under PD-32).** Because a
judge on the generator's model shares its blind spots, we chose an OpenAI model reached through OpenRouter, at the cost
of a second vendor in the trust boundary and its own calibration. It should give an advisory verdict whose agreement
with ~30 human labels is reported with *n*. We will verify it with the calibration record (R-23), and revisit it when
the judge stays cut (#2) or OpenRouter's routing changes the served model (the served model is recorded per call, DO-6).
*If Innocent prefers OpenAI's API directly, only the adapter and the key change.*
