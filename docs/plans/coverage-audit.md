# Coverage audit — Newsela Lesson Studio, §6 requirements sweep

<!-- Traceability record for the §7 ticket set: every mandatory requirement, across every workflow it
applies to, traced to the ticket that builds the component, the ticket that integrates it into that
workflow, the acceptance criterion that proves the integration, and the evidence. It holds no
ticket status (GitLab owns status). Format and rules: .claude/workflow/to-tickets/references/coverage-audit.md.
Check before publishing:
  python3 .claude/workflow/to-tickets/scripts/coverage_audit.py check docs/plans/coverage-audit.md --tickets <drafts.md> --workflows docs/design/observability.md
At implementation verification, re-run with --stage verify after filling Evidence with "verified: …". -->

- **Ticket set:** not cut yet (zero-to-hero §7); this file holds the §6 requirements sweep only.
- **Workflow registry:** [`docs/design/observability.md`](../design/observability.md) (DO-6), WF-1…WF-45.
- **Design outputs register:** [`docs/prd/interview.md`](../prd/interview.md) — ticket-ready gate check passes (structure), 2026-10-25.
- **Requirement sources swept:** PRD [`newsela-prd.md`](../prd/newsela-prd.md) §5.3 (MVP rows; Stretch and Roadmap rows are not mandatory and are left out: R-7, R-10, R-13, R-18, R-24, R-30, R-32, R-36, R-43, R-59; R-37, R-40, R-44–R-47), §5.4 amendments (folded into the rows they change), §6.4 cut order, §8 guardrails; the 24 agreed cards and shared guarantees in [`INTERFACE.md`](../contracts/INTERFACE.md); the 21 signed screens in [`SCREEN_SPECS.md`](../ux/03-structure/SCREEN_SPECS.md); the evaluation plan's acceptance conditions ([`eval-plan.md`](../design/eval-plan.md), DO-5); the observability contract (DO-6); the key-metrics registry ([`metrics-registry.md`](../design/metrics-registry.md), DO-7).
- **Status:** proposed — drafted at §6 (2026-10-25) under PD-32; the matrix is filled at §7c.

**How to read it.** One row per obligation. *Cuttable* rows keep their place with their cut number: if the cut fires,
the row is closed by the "what we say instead" line of PRD §6.4, not by silence. *Applies to* names the registered
workflows; `WF-n only — <reason>` excludes every other workflow for that reason, and `all; excludes … (reason)` names
the exceptions. Example: R-1 applies to `WF-2 only`, because no other workflow stores an outline version.

## Mandatory requirements

| Req | Requirement | Source | Applies to |
|---|---|---|---|
| R-1 | Upload a unit outline as CSV or XLSX; each upload is an immutable outline version with its SHA-256; re-uploading makes a new version and touches no lesson | PRD §5.3 A | WF-2 only — the only workflow that stores an outline version |
| R-2 | Accept a public Google Sheet link; a private sheet gets the "share it publicly or upload the file" message, not a stack trace | PRD §5.3 A | WF-2 only — the only workflow that imports a sheet link |
| R-3 | Deterministic normalizer (header by column names, row kinds, arc context, ranges, IDs from `Lesson #`, flex IDs, ≤ 200 rows), with §5.4's unit-rule scope from arc names and flex titles | PRD §5.3 A; §5.4 R-3 | WF-2, WF-24 only — normalization runs at upload; S1 is its golden suite |
| R-4 | Resolve every code against the seeded official CDE tables (CCSS ELA 6, ELD 6, MSLS 6) and propose fixes; §5.4: a parent resolves to the row's listed leaves, unlisted leaves are an advisory "add?", ELD verdicts from the hand-made table | PRD §5.3 A; §5.4 R-4 | WF-2, WF-3, WF-24, WF-37 only — seeding loads the tables, upload and the report resolve against them, S1 proves it |
| R-5 | Validation report with OK / warning / error per row and the original cell text; Generate stays off until every error is confirmed; each warning carries a default stored as `default` or `confirmed by <name>` | PRD §5.3 A; §5.4 R-5 | WF-3, WF-4, WF-24 only — the report and choices (WF-3), the start-run refusal `VALIDATION_INCOMPLETE` (WF-4), S1 |
| R-6 | Split cell text into `content`, `writer_task`, `editor_note`, `unit_rule`, `safety_note`, each note apply / show only / ignore (default apply); instruction-shaped text flagged and kept as content; content enters prompts only as delimited, labelled data | PRD §5.3 A; §5.4 R-6 | WF-2, WF-3, WF-13, WF-21, WF-22, WF-24 only — classification at upload and confirmation; the prompt renderers of the plan, lesson and candidate jobs; S1 |
| R-8 | One model call writes a typed `UnitPlan` before any lesson, shown read-only; it carries the run's `lesson_link` rows and regeneration reuses the stored plan | PRD §5.3 B; §5.4 R-8 | WF-5, WF-13, WF-21 only — the plan job writes it, CON-8 reads it, candidates reuse it |
| R-9 | Arc continuity checks, advisory (3-lesson repeats, homework pages, unpractised task skill, vocabulary over cap) *(cuttable: cut #3)* | PRD §5.3 B; §6.4 | WF-10, WF-22, WF-24 only — the check suite runs in the lesson job and after stores; S2 holds its fixtures |
| R-11 | Typed, versioned `Lesson` record matching Newsela's structure; one ProseMirror node-schema module shared by compiler, editor and collaboration server; every stored lesson carries its schema version | PRD §5.3 C; §5.4 R-11 | WF-8, WF-9, WF-13, WF-19, WF-22, WF-41, WF-45 only — the workflows that compile, store, read, export or emit the lesson schema |
| R-12 | Grounding by construction: citation cards, off-platform novel, Newsela articles as references; `LessonDraft` has no `quote` type; a `quote` is inserted only by a person with `source_ref` and a rights status | PRD §5.3 C; §5.4 R-12 | WF-10, WF-12, WF-13, WF-22, WF-42 only — drafting, candidate drafting, the human slot fill, the checks and S4 |
| R-14 | Integrated ELD and student supports keep the task (ELD collapsible, purpose → say → watch, support table) | PRD §5.3 C | WF-10, WF-22, WF-24 only — generated by the lesson job, checked by the suite, asserted by S3 |
| R-15 | Checks for understanding as typed `cfu_item`s (one key, rationale per option, focus-standard tag); at least one in Learning in Action and a Quick Write in Look Back | PRD §5.3 C | WF-10, WF-22, WF-24 only — generated by the lesson job, checked by the suite, asserted by S3 |
| R-16 | Durable, idempotent generation jobs in a separate worker with retries; §5.4 AC: a killed worker resumes at the next unfinished lesson, no lesson stored twice, no completed call paid twice, lost calls ≤ the cap and counted, a capped run stops `capped` | PRD §5.3 C; §5.4 R-16 | WF-4, WF-6, WF-13, WF-21, WF-22, WF-28 only — the workflows that create, control, run or fault-test jobs |
| R-17 | Live progress board: one tile per lesson through its states, polled every 2 s, running cost against the cap; finished lessons open while others generate | PRD §5.3 C | WF-5, WF-22 only — the poll reads tile states the lesson job writes |
| R-19 | Deterministic check suite on every draft and every save, blocking and advisory rules, one repair then `generation_failed` with reasons; §5.4 codes rule (`narrowed` / `added` block until confirmed) | PRD §5.3 D; §5.4 R-19 | WF-10, WF-13, WF-15, WF-22, WF-24, WF-41 only — drafts (WF-22, WF-13), saves (WF-10 after every store), the Submit and Approve re-runs (WF-15, WF-41), S2 |
| R-20 | Alignment map per lesson with role (I / P / A) and who asserted each link; an open `narrowed` or `added` confirmation blocks Approve, server-refused; confirmations count in neither V-1 nor G-1 | PRD §5.3 D; §5.4 R-20 | WF-8, WF-10, WF-11, WF-15, WF-22 only — written by checks, confirmed by a person, enforced at Approve, shown in the pane |
| R-21 | Lesson-part addresses (`G6.U4.L5.LearningInAction.PartA`) shown in the editor and stored on each alignment link | PRD §5.3 D | WF-8, WF-10, WF-22 only — links are written by checks and read with the lesson |
| R-22 | Locked content rules; warnings carried to the teacher-facing tip with an open safety flag; the warning text appears in no student-facing block; only a named person with a note clears the flag | PRD §5.3 D; §5.4 R-22 | WF-10, WF-11, WF-15, WF-22, WF-24 only — generation, checks, the clear action, the Approve gate and S7 |
| R-23 | Binary per-(activity, standard) judge on a different provider, advisory, labelled provisional, with a ~30-pair calibration record *(cuttable: cut #2)* | PRD §5.3 D; §6.4 | WF-23, WF-31 only — the judge job and its calibration |
| R-25 | Unit board and triage queue, one row per lesson, blocking issues first, filterable, with the unit roll-up | PRD §5.3 E | WF-7 only — the board read (CON-9) |
| R-26 | Collaborative ProseMirror + Yjs editor through one Hocuspocus server, session-authenticated, persisted ≤ 2 s; each durable store writes Y.Doc, derived JSON, hash and state vector in one transaction; only the collaboration server writes lesson content | PRD §5.3 E; §5.4 R-26 | WF-9, WF-11, WF-12, WF-13, WF-14, WF-22, WF-41 only — the socket plus every path that writes content, each of which must go through the collaboration server |
| R-27 | Minimal evidence pane: confirmed outline row, official standard text, alignment map with "asserted by", issue list with jump-to-span | PRD §5.3 E | WF-8 only — the lesson read and issue list (CON-11, CON-13) |
| R-28 | Checks re-run on every durable save, reading the stored derived row (and the other lesson's stored row for cross-lesson checks) | PRD §5.3 E; §5.4 R-28 | WF-9, WF-10, WF-11, WF-12, WF-13, WF-14, WF-41 only — every store path enqueues a check job that WF-10 runs |
| R-29 | Regenerate never overwrites an edited, in-review or approved lesson: it makes a candidate; adopting is a logged edit by a named person through the collaboration server | PRD §5.3 E; §5.4 R-29 | WF-13, WF-41 only — candidates and their adopt command |
| R-31 | One AI-assist tool as a tracked suggestion held outside the document; accepted change tagged `ai-assist` with the requester; a pending suggestion blocks Submit and Approve; unavailable on approved lessons *(cuttable: cut #8)* | PRD §5.3 E; §5.4 R-31; §6.4 | WF-14, WF-15, WF-41 only — the suggestion route, its accept command and the transition gate |
| R-33 | Server-enforced lesson state machine by role (§5.4 states incl. `submitted`, `withdrawn`, `reopened`); Submit freezes and snapshots; Approve pins the snapshot hash and state vector; four-eyes; no bulk approve; a reviewer's explicit `start_review`, never an open | PRD §5.3 F; §5.4 R-33, R-33 (UX-1) | WF-8, WF-9, WF-15, WF-41 only — transitions, the freeze command, the socket's read-only mode, and lesson reads (which never start a review) |
| R-34 | Approval checklist linked to evidence; Approve disabled and server-refused while a block stands; a block clears only by a fix or a named resolution; cross-lesson links block the dependent lesson | PRD §5.3 F; §5.4 R-34 | WF-10, WF-11, WF-15 only — the Approve gate, resolutions and the checks that raise blocks |
| R-35 | Append-only audit log of every transition and provenance on every lesson version; an immutable `lesson_version` snapshot at generation, each candidate, Submit, Approve and reopen | PRD §5.3 F; §5.4 R-35 | WF-13, WF-15, WF-22, WF-36, WF-41 only — the transition and freeze paths, the version writers, and the DDL triggers that reject UPDATE and DELETE |
| R-60 | Draft-quality rating at Approve (usable as drafted / with edits / rewritten), stored on the frozen metrics row, shown only in aggregate with *n* | PRD §5.3 F | WF-7, WF-15 only — written at Approve, read by the unit metrics |
| R-38 | Two prompt layers; the locked layer has no UI edit path; every prompt version immutable; a run pins one version; each lesson records it | PRD §5.3 G | WF-4, WF-13, WF-20, WF-21, WF-22 only — run start pins, the jobs render, guidance saves version |
| R-39 | Editable guidance layer: each save a version with author, time, diff and reason; "try on one lesson" *(cuttable: cut #7)* | PRD §5.3 G; §6.4 | WF-20 only — the guidance route (CON-24) |
| R-41 | Read-only unit coverage matrix from stored alignment links by one query *(cuttable: cut #4)* | PRD §5.3 H; §6.4 | WF-18 only — the coverage route (CON-22) |
| R-42 | Versioned, idempotent JSON export of approved snapshots only in the `Lesson` schema, schema published; a dependent lesson only while its links are approved *(cuttable: cut #5)* | PRD §5.3 H; §5.4 R-42; §6.4 | WF-19, WF-45 only — the export route and the schema emitter |
| R-48 | Traces in our Postgres per run, lesson and model call under one correlation id; run summary with wall time, cost, retries, failures by reason, placeholders, calls lost, brakes fired, truncation retries (trace browser cut #6) | PRD §5.3 I; §5.4 R-48 | WF-13, WF-14, WF-17, WF-20, WF-21, WF-22, WF-23, WF-25, WF-28, WF-32 only — every model-calling workflow plus the summary that reads them |
| R-49 | Heartbeats every 15 s while active, merged across tabs, human sessions only, to the first approval; frozen per-lesson metrics row once at approval; north-star tile with *n*, G-2 and caption; aggregate only | PRD §5.3 I; §5.4 R-49 | WF-7, WF-15, WF-16, WF-44 only — heartbeats, the Approve write, the tile and S8 |
| R-50 | Full *Unit quality* page (V-1…V-6, O-1…O-4, H-1…H-6 with *n* and label) *(cuttable: cut #6)* | PRD §5.3 I; §6.4 | WF-7 only — it reads the unit metrics (CON-10) |
| R-51 | Evals: one golden test per outline defect; golden cases for every check incl. placeholder and refusal answers; a full run of the issued unit with its report before recording | PRD §5.3 I | WF-24, WF-25 only — the golden suites and the full-run report |
| R-52 | Seeded-error run, ~5 planted errors by someone other than the reviewer, hidden from them, catch rate reported *(cuttable: cut #6)* | PRD §5.3 I; §5.4 R-52; §6.4 | WF-26 only — the seeded-error run |
| R-53 | Local-only structural comparison with the held-out Unit 4, numbers only *(cuttable: cut #2)* | PRD §5.3 I; §6.4 | WF-27 only — the held-out script |
| R-54 | Allow-list sign-in; author / reviewer / approver roles enforced on the API and the websocket; per-user generation limits; per-run and per-day spend caps; one demo account per role (core if deployed) | PRD §5.3 J | all; excludes WF-10, WF-24, WF-25, WF-26, WF-27, WF-28, WF-31, WF-32, WF-33, WF-34, WF-35, WF-36, WF-38, WF-39, WF-40, WF-42, WF-45 (worker check jobs, eval and spike harnesses, migrations, deploy, health, backup and the emitter run without a user session) and WF-29, WF-30, WF-43, WF-44 (load and e2e harnesses that only drive the routes through seeded accounts; enforcement is proved at those routes) |
| R-55 | Generation time and cost: p95 ≤ 5 min per lesson, the 47-lesson unit ≤ 2 h at the cap, model spend ≤ $1 per lesson, a run never exceeds its cap | PRD §5.3 K | WF-4, WF-6, WF-21, WF-22, WF-25, WF-28, WF-32 only — the workflows that set, spend against or measure the cap and timing |
| R-56 | Collaboration under load at the 200-user spike: remote edit p95 < 500 ms, stored p95 < 3 s, 0 lost updates *(cuttable: cut #1)* | PRD §5.3 K; §5.4 R-56; §6.4 | WF-30 only — the Yjs load script |
| R-57 | Page speed at the 200-user spike: lesson open p95 < 1.5 s, unit board p95 < 1 s | PRD §5.3 K; §5.4 R-57 | WF-7, WF-8, WF-29 only — the HTTP probe timing the board and lesson reads |
| R-58 | Outline cells and model output never reach the page as raw HTML; compiled documents use only allow-listed nodes; headings in order; tables with header rows | PRD §5.3 K | WF-3, WF-7, WF-8, WF-9, WF-12, WF-13, WF-14, WF-17, WF-19, WF-22 only — the workflows that compile or display outline or model text |
| GR-1 | No invented quotes, page numbers, facts about real people or article content | PRD §8 | WF-10, WF-13, WF-14, WF-22, WF-24, WF-25, WF-42 only — the workflows that produce or check model-written lesson text |
| GR-2 | Never write a passage of a text we were not given; the novel appears only by citation and short quotes a person inserts | PRD §8 | WF-12, WF-13, WF-14, WF-22 only — the workflows that put text into a lesson |
| GR-3 | Every excerpt has a rights status; `to-clear` blocks approval | PRD §8 | WF-10, WF-12, WF-15 only — excerpts enter by slot fill, are checked, and gate Approve |
| GR-4 | Never a bare "standards-aligned" badge; every alignment link says who asserted it | PRD §8 | WF-7, WF-8, WF-10, WF-11, WF-18, WF-22, WF-23 only — the workflows that write or display alignment |
| GR-5 | Cite only official SBE standards text from the CDE, never the sheet's labels | PRD §8 | WF-2, WF-3, WF-8, WF-21, WF-22, WF-37 only — seeding, resolution, display and prompt rendering of standards text |
| GR-6 | No bulk or automatic approval: one lesson, one pinned version, one named person | PRD §8 | WF-15, WF-41 only — the transition and freeze paths |
| GR-7 | AI edits are suggestions a person accepts; nothing AI-written enters a lesson silently; no AI tools on approved lessons | PRD §8 | WF-13, WF-14, WF-41 only — the only paths by which model text enters an existing lesson |
| GR-8 | Provenance and the authorship record exist on every version, always | PRD §8 | WF-13, WF-14, WF-15, WF-22, WF-41 only — the workflows that write lesson versions or tagged edits |
| GR-9 | Crawled Newsela content stays in git-ignored `docs/source/restricted/`; never committed, mirrored, deployed or recorded (a check fails if any `restricted/` path is tracked) | PRD §8 | all |
| GR-10 | In-context examples only; no fine-tuning, no vendor file or vector stores; prompts hold only our schema, 1–2 structure examples, official standards text, outline rows and supplied public-domain text | PRD §8 | WF-13, WF-14, WF-20, WF-21, WF-22, WF-23, WF-32 only — the workflows that render prompts |
| GR-11 | Grade 6 Unit 4's published lessons are held out, never used as examples; the example-set ID is in provenance | PRD §8 | WF-13, WF-14, WF-21, WF-22, WF-23, WF-24, WF-27, WF-32 only — prompt-rendering workflows, the golden fixtures and the held-out script |
| GR-12 | Locked content rules: respectful sacred narratives, no trauma-disclosure prompts, warnings carried to the teacher, ELD supports keep text and task | PRD §8 | WF-10, WF-13, WF-14, WF-21, WF-22, WF-24 only — the workflows that generate or check lesson content |
| GR-13 | No student or teacher-of-record data; staff authentication only | PRD §8 | all |
| GR-14 | Demo honesty: the full unit runs before recording; the lesson shown is random; one caught error shown; numbers carry *n*; a limits section | PRD §8 | WF-7, WF-17, WF-25, WF-38 only — the full run, the recording deploy and the number surfaces |
| GR-15 | Review time in aggregate only, never ranked by person; ≥ 3 distinct reviewers before a segment is shown unlabelled | PRD §8; §5.4 GR-15 | WF-7, WF-15, WF-16, WF-44 only — the only workflows that write or read review minutes; every other route returns none (INTERFACE guarantee 8) |
| GR-16 | Copy frames the tool as expert-driven; never "AI replaces writers" | PRD §8 | WF-1, WF-2, WF-3, WF-4, WF-5, WF-6, WF-7, WF-8, WF-9, WF-10, WF-11, WF-12, WF-13, WF-14, WF-15, WF-16, WF-17, WF-18, WF-19, WF-20, WF-41 only — the user-facing screens and routes; copy review before recording |
| GR-17 | An explicit `LICENSE` (all rights reserved; evaluation use permitted); no Newsela content in the repo | PRD §8 | WF-38 only — a repository-root artefact shipped with the deploy; no workflow writes it |
| GR-18 | The locked prompt layer cannot be edited from the UI; output checks run whatever the prompt says | PRD §8 | WF-10, WF-13, WF-20, WF-22 only — guidance saves, the generation paths and the checks |
| CON-1 | Session and role: the agreed card's operations, named errors and guarantees, implemented to the OpenAPI 1.0.0 shapes | INTERFACE.md CON-1 (agreed) | WF-1 only — the workflows that serve this card |
| CON-2 | Outline versions: the agreed card's operations, named errors and guarantees, implemented to the OpenAPI 1.0.0 shapes | INTERFACE.md CON-2 (agreed) | WF-2 only — the workflows that serve this card |
| CON-3 | Validation report: the agreed card's operations, named errors and guarantees, implemented to the OpenAPI 1.0.0 shapes | INTERFACE.md CON-3 (agreed) | WF-3 only — the workflows that serve this card |
| CON-4 | Intake choices: the agreed card's operations, named errors and guarantees, implemented to the OpenAPI 1.0.0 shapes | INTERFACE.md CON-4 (agreed) | WF-3 only — the workflows that serve this card |
| CON-5 | Start a run: the agreed card's operations, named errors and guarantees, implemented to the OpenAPI 1.0.0 shapes | INTERFACE.md CON-5 (agreed) | WF-4 only — the workflows that serve this card |
| CON-6 | Run progress: the agreed card's operations, named errors and guarantees, implemented to the OpenAPI 1.0.0 shapes | INTERFACE.md CON-6 (agreed) | WF-5 only — the workflows that serve this card |
| CON-7 | Run control: the agreed card's operations, named errors and guarantees, implemented to the OpenAPI 1.0.0 shapes | INTERFACE.md CON-7 (agreed) | WF-6 only — the workflows that serve this card |
| CON-8 | Unit plan: the agreed card's operations, named errors and guarantees, implemented to the OpenAPI 1.0.0 shapes | INTERFACE.md CON-8 (agreed) | WF-5 only — the workflows that serve this card |
| CON-9 | Unit board: the agreed card's operations, named errors and guarantees, implemented to the OpenAPI 1.0.0 shapes | INTERFACE.md CON-9 (agreed) | WF-7 only — the workflows that serve this card |
| CON-10 | Unit metrics: the agreed card's operations, named errors and guarantees, implemented to the OpenAPI 1.0.0 shapes | INTERFACE.md CON-10 (agreed) | WF-7 only — the workflows that serve this card |
| CON-11 | Lesson read: the agreed card's operations, named errors and guarantees, implemented to the OpenAPI 1.0.0 shapes | INTERFACE.md CON-11 (agreed) | WF-8 only — the workflows that serve this card |
| CON-12 | Collaboration channel (Yjs socket): the agreed card's operations, named errors and guarantees, implemented to the OpenAPI 1.0.0 shapes | INTERFACE.md CON-12 (agreed) | WF-9 only — the workflows that serve this card |
| CON-13 | Issue list: the agreed card's operations, named errors and guarantees, implemented to the OpenAPI 1.0.0 shapes | INTERFACE.md CON-13 (agreed) | WF-8, WF-10 only — the workflows that serve this card |
| CON-14 | Resolve and confirm: the agreed card's operations, named errors and guarantees, implemented to the OpenAPI 1.0.0 shapes | INTERFACE.md CON-14 (agreed) | WF-11, WF-41 only — the workflows that serve this card |
| CON-15 | Fill a placeholder or slot: the agreed card's operations, named errors and guarantees, implemented to the OpenAPI 1.0.0 shapes | INTERFACE.md CON-15 (agreed) | WF-12, WF-41 only — the workflows that serve this card |
| CON-16 | Candidates: the agreed card's operations, named errors and guarantees, implemented to the OpenAPI 1.0.0 shapes | INTERFACE.md CON-16 (agreed) | WF-13, WF-41 only — the workflows that serve this card |
| CON-17 | AI suggestions: the agreed card's operations, named errors and guarantees, implemented to the OpenAPI 1.0.0 shapes *(cuttable: cut #8)* | INTERFACE.md CON-17 (agreed) | WF-14, WF-41 only — the workflows that serve this card |
| CON-18 | Lesson transitions: the agreed card's operations, named errors and guarantees, implemented to the OpenAPI 1.0.0 shapes | INTERFACE.md CON-18 (agreed) | WF-15, WF-41 only — the workflows that serve this card |
| CON-19 | Lesson history: the agreed card's operations, named errors and guarantees, implemented to the OpenAPI 1.0.0 shapes | INTERFACE.md CON-19 (agreed) | WF-8 only — the workflows that serve this card |
| CON-20 | Review heartbeats: the agreed card's operations, named errors and guarantees, implemented to the OpenAPI 1.0.0 shapes | INTERFACE.md CON-20 (agreed) | WF-16 only — the workflows that serve this card |
| CON-21 | Run summary: the agreed card's operations, named errors and guarantees, implemented to the OpenAPI 1.0.0 shapes | INTERFACE.md CON-21 (agreed) | WF-17 only — the workflows that serve this card |
| CON-22 | Coverage matrix: the agreed card's operations, named errors and guarantees, implemented to the OpenAPI 1.0.0 shapes *(cuttable: cut #4)* | INTERFACE.md CON-22 (agreed) | WF-18 only — the workflows that serve this card |
| CON-23 | Export: the agreed card's operations, named errors and guarantees, implemented to the OpenAPI 1.0.0 shapes *(cuttable: cut #5)* | INTERFACE.md CON-23 (agreed) | WF-19 only — the workflows that serve this card |
| CON-24 | Prompt versions: the agreed card's operations, named errors and guarantees, implemented to the OpenAPI 1.0.0 shapes *(the save is cuttable: cut #7)* | INTERFACE.md CON-24 (agreed) | WF-4, WF-20 only — the workflows that serve this card |
| CON-G1 | Wrong role → `ROLE_FORBIDDEN`, on the server, for every action | INTERFACE.md shared guarantees | WF-1, WF-2, WF-3, WF-4, WF-5, WF-6, WF-7, WF-8, WF-9, WF-10, WF-11, WF-12, WF-13, WF-14, WF-15, WF-16, WF-17, WF-18, WF-19, WF-20, WF-41 only — every contract operation; worker jobs and scripts take no role |
| CON-G2 | A refused call changes nothing (no state, version, approval, audit or spend row); the refused attempt goes to the application log, never the audit table | INTERFACE.md shared guarantees | WF-1, WF-2, WF-3, WF-4, WF-6, WF-9, WF-11, WF-12, WF-13, WF-14, WF-15, WF-16, WF-19, WF-20, WF-41 only — every mutating operation; reads change nothing by guarantee 5 |
| CON-G3 | Lesson content is written only through the collaboration server; HTTP content edits go through it as one attributed Yjs transaction, else `COLLAB_UNAVAILABLE` and no change | INTERFACE.md shared guarantees | WF-9, WF-11, WF-12, WF-13, WF-14, WF-22, WF-41 only — every path that writes lesson content |
| CON-G4 | Every person's action is in the append-only audit log (who, when, from, to, version hash, reason) | INTERFACE.md shared guarantees | WF-1, WF-2, WF-3, WF-4, WF-6, WF-9, WF-11, WF-12, WF-13, WF-14, WF-15, WF-19, WF-20, WF-41 only — every workflow where a person changes state |
| CON-G5 | Reads never change state (opening is not starting a review) | INTERFACE.md shared guarantees | WF-5, WF-7, WF-8, WF-17, WF-18 only — the read-only contract operations |
| CON-G6 | Text from the outline or the model is returned as text, never as HTML | INTERFACE.md shared guarantees | WF-3, WF-5, WF-7, WF-8, WF-13, WF-14, WF-17, WF-18, WF-19 only — the operations that return outline or model text |
| CON-G7 | One lesson per call on every transition; no bulk approve | INTERFACE.md shared guarantees | WF-15, WF-41 only — the transition and freeze paths |
| CON-G8 | No route returns review minutes with a person's name | INTERFACE.md shared guarantees | WF-1, WF-2, WF-3, WF-4, WF-5, WF-6, WF-7, WF-8, WF-9, WF-10, WF-11, WF-12, WF-13, WF-14, WF-15, WF-16, WF-17, WF-18, WF-19, WF-20, WF-41 only — every HTTP route |
| SCR-1 | Sign in screen built to its signed spec, with every listed state reachable, against its agreed contracts | SCREEN_SPECS.md SCR-1 (signed) | WF-1 only — the workflows its contracts serve |
| SCR-2 | Units home screen built to its signed spec, with every listed state reachable, against its agreed contracts | SCREEN_SPECS.md SCR-2 (signed) | WF-2, WF-5 only — the workflows its contracts serve |
| SCR-3 | Upload outline screen built to its signed spec, with every listed state reachable, against its agreed contracts | SCREEN_SPECS.md SCR-3 (signed) | WF-2 only — the workflows its contracts serve |
| SCR-4 | Validation report screen built to its signed spec, with every listed state reachable, against its agreed contracts | SCREEN_SPECS.md SCR-4 (signed) | WF-3, WF-4 only — the workflows its contracts serve |
| SCR-5 | Start run (dialog) screen built to its signed spec, with every listed state reachable, against its agreed contracts | SCREEN_SPECS.md SCR-5 (signed) | WF-4, WF-20 only — the workflows its contracts serve |
| SCR-6 | Generation progress screen built to its signed spec, with every listed state reachable, against its agreed contracts | SCREEN_SPECS.md SCR-6 (signed) | WF-5, WF-6 only — the workflows its contracts serve |
| SCR-7 | Unit plan screen built to its signed spec, with every listed state reachable, against its agreed contracts | SCREEN_SPECS.md SCR-7 (signed) | WF-5 only — the workflows its contracts serve |
| SCR-8 | Unit board screen built to its signed spec, with every listed state reachable, against its agreed contracts | SCREEN_SPECS.md SCR-8 (signed) | WF-7 only — the workflows its contracts serve |
| SCR-9 | Lesson workspace screen built to its signed spec, with every listed state reachable, against its agreed contracts | SCREEN_SPECS.md SCR-9 (signed) | WF-8, WF-9, WF-11, WF-13, WF-15, WF-16 only — the workflows its contracts serve |
| SCR-10 | Insert quote or excerpt (dialog) screen built to its signed spec, with every listed state reachable, against its agreed contracts | SCREEN_SPECS.md SCR-10 (signed) | WF-12 only — the workflows its contracts serve |
| SCR-11 | Resolve or clear (dialog) screen built to its signed spec, with every listed state reachable, against its agreed contracts | SCREEN_SPECS.md SCR-11 (signed) | WF-11 only — the workflows its contracts serve |
| SCR-12 | Candidate compare screen built to its signed spec, with every listed state reachable, against its agreed contracts | SCREEN_SPECS.md SCR-12 (signed) | WF-13 only — the workflows its contracts serve |
| SCR-13 | AI assist panel screen built to its signed spec, with every listed state reachable, against its agreed contracts *(cuttable: cut #8)* | SCREEN_SPECS.md SCR-13 (signed) | WF-14 only — the workflows its contracts serve |
| SCR-14 | Approval review screen built to its signed spec, with every listed state reachable, against its agreed contracts | SCREEN_SPECS.md SCR-14 (signed) | WF-8, WF-15, WF-16 only — the workflows its contracts serve |
| SCR-15 | Send back or reopen (dialog) screen built to its signed spec, with every listed state reachable, against its agreed contracts | SCREEN_SPECS.md SCR-15 (signed) | WF-15 only — the workflows its contracts serve |
| SCR-16 | History and provenance screen built to its signed spec, with every listed state reachable, against its agreed contracts | SCREEN_SPECS.md SCR-16 (signed) | WF-8 only — the workflows its contracts serve |
| SCR-17 | Run summary screen built to its signed spec, with every listed state reachable, against its agreed contracts | SCREEN_SPECS.md SCR-17 (signed) | WF-17 only — the workflows its contracts serve |
| SCR-18 | Coverage matrix screen built to its signed spec, with every listed state reachable, against its agreed contracts *(cuttable: cut #4)* | SCREEN_SPECS.md SCR-18 (signed) | WF-18 only — the workflows its contracts serve |
| SCR-19 | Unit quality screen built to its signed spec, with every listed state reachable, against its agreed contracts *(cuttable: cut #6)* | SCREEN_SPECS.md SCR-19 (signed) | WF-7 only — the workflows its contracts serve |
| SCR-20 | Export screen built to its signed spec, with every listed state reachable, against its agreed contracts *(cuttable: cut #5)* | SCREEN_SPECS.md SCR-20 (signed) | WF-19 only — the workflows its contracts serve |
| SCR-21 | Prompt guidance screen built to its signed spec, with every listed state reachable, against its agreed contracts *(cuttable: cut #7)* | SCREEN_SPECS.md SCR-21 (signed) | WF-4, WF-20 only — the workflows its contracts serve |
| EV-S1 | S1 intake golden: 100% of expected fields on the issued sheet, SYN-2 and WP-5; byte-identical reruns; zero model calls before a run | eval-plan.md acceptance conditions | WF-2, WF-24 only — the suite's runner and the entry points it drives |
| EV-S2 | S2 check golden: every blocking rule fires on its fixture and the clean case passes (floor 1.00) | eval-plan.md acceptance conditions | WF-10, WF-24 only — the suite's runner and the entry points it drives |
| EV-S3 | S3 draft golden: required blocks and section timing on WP-1…WP-3 in 3 of 3 repeats; WP-1 L4 → L5 link blocking; exact placeholder counts | eval-plan.md acceptance conditions | WF-21, WF-22, WF-24 only — the suite's runner and the entry points it drives |
| EV-S4 | S4 grounding plants: 11 of 11 code-detectable plants (floor 1.00), ≤ 1 false flag per clean lesson, WP-3 zero flags | eval-plan.md acceptance conditions | WF-10, WF-42 only — the suite's runner and the entry points it drives |
| EV-S5 | S5 integrity invariants: 20 of 20 trials per assertion (stale approve 409, zero edits after lock, four-eyes, pending suggestion blocks, round-trip hash; floor 1.00); store p95 ≤ 500 ms [A] → SP-2 | eval-plan.md acceptance conditions | WF-9, WF-15, WF-41, WF-43 only — the suite's runner and the entry points it drives |
| EV-S6 | S6 long-job faults: 47/47 terminal, zero duplicate versions, zero re-paid calls, zero lessons lost to 429, one truncation retry, zero cap overshoot (floor 1.00) | eval-plan.md acceptance conditions | WF-6, WF-22, WF-28 only — the suite's runner and the entry points it drives |
| EV-S7 | S7 safety notes: WP-4 4 of 4 (floor 1.00); ≤ 1 false proposal on the issued sheet, zero on WP-5; 100% of cleared flags carry user, note, time | eval-plan.md acceptance conditions | WF-2, WF-11, WF-15, WF-22, WF-24 only — the suite's runner and the entry points it drives |
| EV-S8 | S8 measurement: scripted ±1 min, stopwatch ±15%, idle tab ≤ 1 min, two tabs once, synthetic sessions add zero, minutes never returned by named person (floor 1.00) | eval-plan.md acceptance conditions | WF-16, WF-44 only — the suite's runner and the entry points it drives |
| EV-S9 | S9 full run: report with *n* = 47 before the video; first-pass schema-valid ≥ 90%; 100% terminal with reasons; V-2 100%; zero unsourced quotes at approval; totals equal stored call sums; cost, time and cap targets | eval-plan.md acceptance conditions | WF-17, WF-21, WF-22, WF-25 only — the suite's runner and the entry points it drives |
| EV-S10 | S10 seeded-error run: ≥ 90% caught before approval, the wrong-code plant caught (floor) *(cuttable: cut #6)* | eval-plan.md acceptance conditions | WF-26 only — the suite's runner and the entry points it drives |
| EV-S11 | S11 held-out comparison: counts only, stored outside tracked files *(cuttable: cut #2)* | eval-plan.md acceptance conditions | WF-27 only — the suite's runner and the entry points it drives |
| EV-S12 | S12 judge calibration: agreement ≥ 0.8 on ≥ 20 labels, confirmed on the 10 held back, before any verdict is reported; it never gates Approve *(cuttable: cut #2)* | eval-plan.md acceptance conditions | WF-23, WF-31 only — the suite's runner and the entry points it drives |
| EV-S13 | S13 draft quality: 100% of approved lessons rated; ≥ 2 of 3 demo lessons usable with edits or better | eval-plan.md acceptance conditions | WF-15 only — the suite's runner and the entry points it drives |
| EV-S14 | S14 capacity spike at 200 users: open p95 < 1.5 s, poll p95 < 300 ms, edit p95 < 500 ms, zero lost updates (floor), error rate < 0.5%, recovery ≤ 2 min | eval-plan.md acceptance conditions | WF-29, WF-30 only — the suite's runner and the entry points it drives |
| EV-R1 | Every eval, probe and suite report names the git SHA, prompt version, model IDs and *n* | eval-plan.md Verification and evidence | WF-24, WF-25, WF-26, WF-27, WF-28, WF-29, WF-30, WF-31, WF-42, WF-43, WF-44 only — the validation workflows that write reports |
| EV-R2 | A change to a prompt, model, schema or check attaches the S2/S3 report and cost from before and after | eval-plan.md Verification and evidence | WF-10, WF-13, WF-20, WF-21, WF-22 only — the workflows whose prompts, models or checks such a change touches |
| EV-R3 | The golden tier runs in the merge gate whenever generation, checks or intake change; the full suite runs before any deploy | eval-plan.md Verification and evidence | WF-24, WF-38 only — the golden runner and the deploy |
| OBS-1 | Each workflow's capture-verification test drives its real entry point, asserts its required records with correlation ids, and asserts forbidden values absent (cut rows: written in the ticket that builds the item) | observability.md Covered workflows; Capture verification | all |
| OBS-2 | `run_id` is minted at run creation and carried on every job, model call and stored version of that run | observability.md Correlation | WF-4, WF-5, WF-6, WF-13, WF-17, WF-20, WF-21, WF-22, WF-23, WF-25, WF-28 only — the workflows that create or act on a generation run |
| OBS-3 | A `request_id` per HTTP request on every log line and audit event, returned in the response header and in a refusal's details | observability.md Correlation | WF-1, WF-2, WF-3, WF-4, WF-5, WF-6, WF-7, WF-8, WF-11, WF-12, WF-13, WF-14, WF-15, WF-16, WF-17, WF-18, WF-19, WF-20, WF-39, WF-41 only — the HTTP entry points; the socket uses OBS-4 |
| OBS-4 | Every durable store mints a `store_id` on `lesson_doc`, `check_job` and the audit event; checks carry the `content_hash` they ran on | observability.md Correlation | WF-9, WF-10, WF-11, WF-12, WF-13, WF-14, WF-22, WF-41 only — the store paths and the checks that follow them |
| OBS-5 | Every model call's row is written before the call (rendered prompt) and updated on response (raw output, usage, stop reason, served model, provider request id) | observability.md Correlation | WF-13, WF-14, WF-20, WF-21, WF-22, WF-23, WF-25, WF-32 only — the workflows that call a model or import recorded calls |
| OBS-6 | Every eval, probe and spike run mints its own id and stores its configuration (prompt version, model, parameters, case set, machine, stub or real) | observability.md Correlation | WF-24, WF-25, WF-26, WF-27, WF-28, WF-29, WF-30, WF-31, WF-32, WF-33, WF-34, WF-42, WF-43, WF-44 only — the validation and experiment workflows |
| OBS-7 | Never recorded anywhere: restricted-folder content, provider keys, passwords or session tokens, review minutes joined to a name | observability.md Content and redaction | all |
| OBS-8 | The four completeness checks make silence visible: summary sums match, each terminal job has its calls, each store has its check, each process records its start | observability.md Missing instrumentation | WF-9, WF-10, WF-17, WF-22, WF-25, WF-38, WF-39 only — the workflows those four checks attach to |
| OBS-9 | Operations scripts and process lifecycle write `ops_event` rows (inputs and outputs hashed, `build_id`) | observability.md Covered workflows | WF-35, WF-36, WF-37, WF-38, WF-39, WF-40 only — the runtime-operation workflows that touch Postgres; WF-45 is a build step without a database |
| OBS-10 | Postgres is not published outside the Compose network; the run summary is the only route over traces and returns aggregates (trace browser cut #6) | observability.md Storage and access | WF-17, WF-38 only — the deploy config and the one trace-reading route |
| OBS-11 | A new entry point, job, script or experiment registers its `WF-n` row, inherited suites and metrics, and capture check before it runs | observability.md Registering a new workflow | all |
| M-1 | Reviewer minutes per approved lesson (NS): computable from its source (`lesson_metrics.active_minutes` (from `heartbeat` → `review_session`, written at the first `approved` row in `review_event`)), which its inheriting workflows emit | metrics-registry.md M-1 | WF-7, WF-15, WF-16, WF-44 only — the workflows that emit its source records (DO-6 Eval column) |
| M-2 | Blocks cleared by resolution (G-1): computable from its source (`issue.cleared_by` in (fix, resolution)), which its inheriting workflows emit | metrics-registry.md M-2 | WF-11 only — the workflows that emit its source records (DO-6 Eval column) |
| M-3 | Fast-approval rate (G-2): computable from its source (`lesson_metrics.active_minutes` against `lesson_version.teacher_word_count`), which its inheriting workflows emit | metrics-registry.md M-3 | WF-15, WF-16 only — the workflows that emit its source records (DO-6 Eval column) |
| M-4 | Seeded-error catch rate (G-3): computable from its source (`eval_case_result` rows of suite S10 (the hidden key in `expected_json`) matched to `issue` and `review_event`), which its inheriting workflows emit *(cuttable: cut #6 — reported as "not measured", never zero)* | metrics-registry.md M-4 | WF-26 only — the workflows that emit its source records (DO-6 Eval column) |
| M-5 | First-pass clean rate (V-1): computable from its source (`issue` rows on the first `lesson_version`'s `content_hash`), which its inheriting workflows emit | metrics-registry.md M-5 | WF-20, WF-22, WF-24, WF-25 only — the workflows that emit its source records (DO-6 Eval column) |
| M-6 | Standards claims verified (V-2): computable from its source (`alignment_link.asserted_by` (outline, generator, judge, reviewer id)), which its inheriting workflows emit | metrics-registry.md M-6 | WF-11, WF-15, WF-23, WF-25 only — the workflows that emit its source records (DO-6 Eval column) |
| M-7 | Quotes sourced or placeholder (V-3): computable from its source (`issue` of kind quote_match; placeholder nodes in `lesson_version.lesson_json`), which its inheriting workflows emit | metrics-registry.md M-7 | WF-10, WF-12, WF-22, WF-24, WF-25, WF-34 only — the workflows that emit its source records (DO-6 Eval column) |
| M-8 | Edit distance, draft to approved (V-4): computable from its source (`lesson_version` snapshots at generation and at approval), which its inheriting workflows emit | metrics-registry.md M-8 | WF-9, WF-15 only — the workflows that emit its source records (DO-6 Eval column) |
| M-9 | Changes-requested rate, with reasons (V-5): computable from its source (`review_event` rows in_review → changes_requested with reason_tag), which its inheriting workflows emit | metrics-registry.md M-9 | WF-15 only — the workflows that emit its source records (DO-6 Eval column) |
| M-10 | AI-assist accept rate, with accepted-then-rewritten rate (V-6): computable from its source (`suggestion` (`status` offered / accepted / rejected, `requested_by`, `decided_by`, `decided_at`) plus span diffs between `lesson_version` rows), which its inheriting workflows emit *(cuttable: cut #8 — reported as "not measured", never zero)* | metrics-registry.md M-10 | WF-14 only — the workflows that emit its source records (DO-6 Eval column) |
| M-11 | Cost per approved lesson (O-1): computable from its source (`model_call.cost_usd` (provider usage fields) plus `lesson_metrics.active_minutes`), which its inheriting workflows emit | metrics-registry.md M-11 | WF-13, WF-15, WF-22, WF-25, WF-32 only — the workflows that emit its source records (DO-6 Eval column) |
| M-12 | Approved lessons per reviewer-hour (O-2): computable from its source (`lesson_metrics`), which its inheriting workflows emit | metrics-registry.md M-12 | WF-15, WF-16 only — the workflows that emit its source records (DO-6 Eval column) |
| M-13 | Unit lead time and share approved (O-3): computable from its source (`outline_version.confirmed_at`, `review_event`), which its inheriting workflows emit | metrics-registry.md M-13 | WF-3, WF-15 only — the workflows that emit its source records (DO-6 Eval column) |
| M-14 | Standards coverage completeness (O-4): computable from its source (`alignment_link` rows on approved `lesson_version` snapshots (role, address)), which its inheriting workflows emit | metrics-registry.md M-14 | WF-15, WF-18 only — the workflows that emit its source records (DO-6 Eval column) |
| M-15 | Generation success rate (H-1): computable from its source (`lesson_job.status`, `model_call`), which its inheriting workflows emit | metrics-registry.md M-15 | WF-6, WF-17, WF-21, WF-22, WF-25, WF-28 only — the workflows that emit its source records (DO-6 Eval column) |
| M-16 | Generation time per lesson and unit wall time (H-2): computable from its source (`lesson_job.started_at`, `lesson_job.finished_at`, `run`), which its inheriting workflows emit | metrics-registry.md M-16 | WF-17, WF-22, WF-25, WF-32 only — the workflows that emit its source records (DO-6 Eval column) |
| M-17 | Model spend per run against its cap (H-3): computable from its source (`model_call.cost_usd` summed by `run.id`; `run.cap_usd`), which its inheriting workflows emit | metrics-registry.md M-17 | WF-4, WF-6, WF-17, WF-22, WF-25, WF-28 only — the workflows that emit its source records (DO-6 Eval column) |
| M-18 | p95 lesson open (H-4): computable from its source (`probe_run`, client timing events), which its inheriting workflows emit | metrics-registry.md M-18 | WF-8, WF-29 only — the workflows that emit its source records (DO-6 Eval column) |
| M-19 | Collaboration latency and durability (H-5): computable from its source (`probe_run`), which its inheriting workflows emit | metrics-registry.md M-19 | WF-9, WF-30, WF-33 only — the workflows that emit its source records (DO-6 Eval column) |
| M-20 | p95 unit page load (H-6): computable from its source (`probe_run`, server timing), which its inheriting workflows emit | metrics-registry.md M-20 | WF-7, WF-29 only — the workflows that emit its source records (DO-6 Eval column) |
| M-21 | Board and progress poll latency: computable from its source (`probe_run`), which its inheriting workflows emit | metrics-registry.md M-21 | WF-5, WF-7, WF-29 only — the workflows that emit its source records (DO-6 Eval column) |
| M-22 | Error rate during the spike: computable from its source (`probe_run`), which its inheriting workflows emit | metrics-registry.md M-22 | WF-29, WF-30 only — the workflows that emit its source records (DO-6 Eval column) |
| M-23 | Recovery time after the spike: computable from its source (`probe_run`), which its inheriting workflows emit | metrics-registry.md M-23 | WF-29 only — the workflows that emit its source records (DO-6 Eval column) |
| M-24 | Socket reconnect time: computable from its source (`probe_run`), which its inheriting workflows emit | metrics-registry.md M-24 | WF-9, WF-30, WF-33 only — the workflows that emit its source records (DO-6 Eval column) |
| M-25 | Generation queue wait: computable from its source (`lesson_job.queued_at`, `lesson_job.started_at`), which its inheriting workflows emit | metrics-registry.md M-25 | WF-4, WF-22, WF-25 only — the workflows that emit its source records (DO-6 Eval column) |
| M-26 | Store to checks refreshed: computable from its source (`lesson_doc.stored_at` (each durable store) paired with `issue.created_at` for the same `content_hash`), which its inheriting workflows emit | metrics-registry.md M-26 | WF-9, WF-10, WF-12 only — the workflows that emit its source records (DO-6 Eval column) |
| M-27 | Store transaction time: computable from its source (`experiment_run` (SP-2); `probe_run`), which its inheriting workflows emit | metrics-registry.md M-27 | WF-9, WF-30, WF-33, WF-43 only — the workflows that emit its source records (DO-6 Eval column) |
| M-28 | Model spend per generated lesson: computable from its source (`model_call.cost_usd` grouped by `lesson_job.id`), which its inheriting workflows emit | metrics-registry.md M-28 | WF-13, WF-17, WF-22, WF-25, WF-32 only — the workflows that emit its source records (DO-6 Eval column) |
| M-29 | Build model spend against the ceiling: computable from its source (`model_call.cost_usd` summed; `experiment_run` (SP-1)), which its inheriting workflows emit | metrics-registry.md M-29 | WF-13, WF-17, WF-21, WF-22, WF-25, WF-32 only — the workflows that emit its source records (DO-6 Eval column) |
| M-30 | Golden suite pass rate: computable from its source (`eval_run`, `eval_case_result` (suites S1–S3, S7); `evals/reports/golden-<sha>.md`), which its inheriting workflows emit | metrics-registry.md M-30 | WF-24 only — the workflows that emit its source records (DO-6 Eval column) |
| M-31 | Schema-valid first-pass rate: computable from its source (`model_call` and `issue` on the first `lesson_version`; eval report), which its inheriting workflows emit | metrics-registry.md M-31 | WF-22, WF-24, WF-25, WF-32 only — the workflows that emit its source records (DO-6 Eval column) |
| M-32 | Grounding plant catch rate: computable from its source (`eval_case_result` rows of suite S4; `evals/reports/grounding-<sha>.md`), which its inheriting workflows emit | metrics-registry.md M-32 | WF-34, WF-42 only — the workflows that emit its source records (DO-6 Eval column) |
| M-33 | Grounding false flags per clean lesson: computable from its source (`issue` of grounding kinds; eval report), which its inheriting workflows emit | metrics-registry.md M-33 | WF-10, WF-25, WF-34, WF-42 only — the workflows that emit its source records (DO-6 Eval column) |
| M-34 | Judge agreement with human labels: computable from its source (`eval_case_result` rows of suite S12 (the label in `expected_json`), `judge_verdict`; `evals/reports/judge-calibration.md`), which its inheriting workflows emit *(cuttable: cut #2 — reported as "not measured", never zero)* | metrics-registry.md M-34 | WF-23, WF-31 only — the workflows that emit its source records (DO-6 Eval column) |
| M-35 | Draft-quality rating split: computable from its source (`lesson_metrics.draft_rating` (R-60)), which its inheriting workflows emit | metrics-registry.md M-35 | WF-15 only — the workflows that emit its source records (DO-6 Eval column) |
| M-36 | Round-trip hash identity: computable from its source (`lesson_version.content_hash`; audit query; eval report), which its inheriting workflows emit | metrics-registry.md M-36 | WF-9, WF-19, WF-25, WF-33, WF-41, WF-43 only — the workflows that emit its source records (DO-6 Eval column) |
| M-37 | Approval-integrity refusal rate: computable from its source (`eval_case_result` rows of suite S5; `evals/reports/integrity-<sha>.md`; `review_event`), which its inheriting workflows emit | metrics-registry.md M-37 | WF-15, WF-33, WF-41, WF-43 only — the workflows that emit its source records (DO-6 Eval column) |
| M-38 | Safety-flag gate: computable from its source (`safety_flag`, `issue`; eval report), which its inheriting workflows emit | metrics-registry.md M-38 | WF-11, WF-15, WF-22, WF-24 only — the workflows that emit its source records (DO-6 Eval column) |
| M-39 | Safety pattern recall and false proposals: computable from its source (`eval_case_result` rows of suite S7; eval report), which its inheriting workflows emit | metrics-registry.md M-39 | WF-2, WF-24 only — the workflows that emit its source records (DO-6 Eval column) |
| M-40 | Intake report exact match: computable from its source (`eval_case_result` rows of suite S1; `evals/reports/golden-<sha>.md`), which its inheriting workflows emit | metrics-registry.md M-40 | WF-2, WF-3, WF-24 only — the workflows that emit its source records (DO-6 Eval column) |
| M-41 | Standards confirmations per lesson: computable from its source (`alignment_link` rows with origin narrowed or added), which its inheriting workflows emit | metrics-registry.md M-41 | WF-10, WF-11, WF-22, WF-25 only — the workflows that emit its source records (DO-6 Eval column) |
| M-42 | Held-out structural agreement: computable from its source (`evals/local/held-out/` (git-ignored, counts only)), which its inheriting workflows emit *(cuttable: cut #2 — reported as "not measured", never zero)* | metrics-registry.md M-42 | WF-27 only — the workflows that emit its source records (DO-6 Eval column) |
| M-43 | Heartbeat accuracy: computable from its source (`eval_case_result` rows of suite S8; `review_session`), which its inheriting workflows emit | metrics-registry.md M-43 | WF-16, WF-44 only — the workflows that emit its source records (DO-6 Eval column) |
| M-44 | Long-job fault invariants: computable from its source (`eval_case_result` rows of suite S6; `evals/reports/faults-<sha>.md`; `lesson_job`, `model_call`), which its inheriting workflows emit | metrics-registry.md M-44 | WF-28 only — the workflows that emit its source records (DO-6 Eval column) |

## Coverage matrix

*Filled at 7c*, once the tickets exist: one row per requirement × workflow above, naming the implementing ticket, the
integration owner, the acceptance criterion on the integration owner and its evidence.

| Req | Workflow | Component / contract | Implementing ticket | Integration owner | Acceptance criterion | Evidence |
|---|---|---|---|---|---|---|
| R-1 | WF-2 | Upload a unit outline as CSV or XLSX; each upload is an immutable outl… | NL-16 | NL-26 | NL-26 AC-1 | planned: NL-26 AC-1 (filled `verified:` at §8) |
| R-2 | WF-2 | Accept a public Google Sheet link; a private sheet gets the "share it … | NL-26 | NL-26 | NL-26 AC-3 | planned: NL-26 AC-3 (filled `verified:` at §8) |
| R-3 | WF-2 | Deterministic normalizer (header by column names, row kinds, arc conte… | NL-09 | NL-16 | NL-16 AC-3 | planned: NL-16 AC-3 (filled `verified:` at §8) |
| R-3 | WF-24 | Deterministic normalizer (header by column names, row kinds, arc conte… | NL-16 | NL-84 | NL-84 AC-2 | planned: NL-84 AC-2 (filled `verified:` at §8) |
| R-4 | WF-2 | Resolve every code against the seeded official CDE tables (CCSS ELA 6,… | NL-16 | NL-84 | NL-84 AC-2 | planned: NL-84 AC-2 (filled `verified:` at §8) |
| R-4 | WF-3 | Resolve every code against the seeded official CDE tables (CCSS ELA 6,… | NL-77 | NL-77 | NL-77 AC-1 | planned: NL-77 AC-1 (filled `verified:` at §8) |
| R-4 | WF-37 | Resolve every code against the seeded official CDE tables (CCSS ELA 6,… | NL-82 | NL-82 | NL-82 AC-1 | planned: NL-82 AC-1 (filled `verified:` at §8) |
| R-5 | WF-3 | Validation report with OK / warning / error per row and the original c… | NL-17 | NL-77 | NL-77 AC-1 | planned: NL-77 AC-1 (filled `verified:` at §8) |
| R-5 | WF-4 | Validation report with OK / warning / error per row and the original c… | NL-27 | NL-27 | NL-27 AC-1 | planned: NL-27 AC-1 (filled `verified:` at §8) |
| R-5 | WF-24 | Validation report with OK / warning / error per row and the original c… | NL-17 | NL-84 | NL-84 AC-2 | planned: NL-84 AC-2 (filled `verified:` at §8) |
| R-6 | WF-2 | Split cell text into `content`, `writer_task`, `editor_note`, `unit_ru… | NL-16 | NL-16 | NL-16 AC-7 | planned: NL-16 AC-7 (filled `verified:` at §8) |
| R-6 | WF-3 | Split cell text into `content`, `writer_task`, `editor_note`, `unit_ru… | NL-57 | NL-94 | NL-94 AC-5 | planned: NL-94 AC-5 (filled `verified:` at §8) |
| R-6 | WF-21 | Split cell text into `content`, `writer_task`, `editor_note`, `unit_ru… | NL-14 | NL-79 | NL-79 AC-3 | planned: NL-79 AC-3 (filled `verified:` at §8) |
| R-8 | WF-5 | One model call writes a typed `UnitPlan` before any lesson, shown read… | NL-27 | NL-78 | NL-78 AC-6 | planned: NL-78 AC-6 (filled `verified:` at §8) |
| R-8 | WF-13 | One model call writes a typed `UnitPlan` before any lesson, shown read… | NL-79 | NL-114 | NL-114 AC-2 | planned: NL-114 AC-2 (filled `verified:` at §8) |
| R-8 | WF-21 | One model call writes a typed `UnitPlan` before any lesson, shown read… | NL-31 | NL-31 | NL-31 AC-1 | planned: NL-31 AC-1 (filled `verified:` at §8) |
| R-9 | WF-10 | Arc continuity checks, advisory (3-lesson repeats, homework pages, unp… | NL-41 | NL-41 | NL-41 AC-1 | planned: NL-41 AC-1 (filled `verified:` at §8) |
| R-11 | WF-8 | Typed, versioned `Lesson` record matching Newsela's structure; one Pro… | NL-10 | NL-44 | NL-44 AC-1 | planned: NL-44 AC-1 (filled `verified:` at §8) |
| R-11 | WF-9 | Typed, versioned `Lesson` record matching Newsela's structure; one Pro… | NL-80 | NL-101 | NL-101 AC-3 | planned: NL-101 AC-3 (filled `verified:` at §8) |
| R-11 | WF-19 | Typed, versioned `Lesson` record matching Newsela's structure; one Pro… | NL-102 | NL-102 | NL-102 AC-5 | planned: NL-102 AC-5 (filled `verified:` at §8) |
| R-12 | WF-10 | Grounding by construction: citation cards, off-platform novel, Newsela… | NL-40 | NL-40 | NL-40 AC-1 | planned: NL-40 AC-1 (filled `verified:` at §8) |
| R-12 | WF-12 | Grounding by construction: citation cards, off-platform novel, Newsela… | NL-46 | NL-46 | NL-46 AC-1 | planned: NL-46 AC-1 (filled `verified:` at §8) |
| R-12 | WF-42 | Grounding by construction: citation cards, off-platform novel, Newsela… | NL-40 | NL-85 | NL-85 AC-4 | planned: NL-85 AC-4 (filled `verified:` at §8) |
| R-14 | WF-22 | Integrated ELD and student supports keep the task (ELD collapsible, pu… | NL-18 | NL-18 | NL-18 AC-6 | planned: NL-18 AC-6 (filled `verified:` at §8) |
| R-14 | WF-24 | Integrated ELD and student supports keep the task (ELD collapsible, pu… | NL-79 | NL-109 | NL-109 AC-1 | planned: NL-109 AC-1 (filled `verified:` at §8) |
| R-15 | WF-22 | Checks for understanding as typed `cfu_item`s (one key, rationale per … | NL-09 | NL-09 | NL-09 AC-4 | planned: NL-09 AC-4 (filled `verified:` at §8) |
| R-15 | WF-24 | Checks for understanding as typed `cfu_item`s (one key, rationale per … | NL-79 | NL-109 | NL-109 AC-1 | planned: NL-109 AC-1 (filled `verified:` at §8) |
| R-16 | WF-4 | Durable, idempotent generation jobs in a separate worker with retries;… | NL-27 | NL-27 | NL-27 AC-1 | planned: NL-27 AC-1 (filled `verified:` at §8) |
| R-16 | WF-6 | Durable, idempotent generation jobs in a separate worker with retries;… | NL-28 | NL-28 | NL-28 AC-7 | planned: NL-28 AC-7 (filled `verified:` at §8) |
| R-16 | WF-13 | Durable, idempotent generation jobs in a separate worker with retries;… | NL-47 | NL-114 | NL-114 AC-3 | planned: NL-114 AC-3 (filled `verified:` at §8) |
| R-16 | WF-21 | Durable, idempotent generation jobs in a separate worker with retries;… | NL-22 | NL-31 | NL-31 AC-7 | planned: NL-31 AC-7 (filled `verified:` at §8) |
| R-16 | WF-22 | Durable, idempotent generation jobs in a separate worker with retries;… | NL-22 | NL-29 | NL-29 AC-1 | planned: NL-29 AC-1 (filled `verified:` at §8) |
| R-16 | WF-28 | Durable, idempotent generation jobs in a separate worker with retries;… | NL-22 | NL-30 | NL-30 AC-8 | planned: NL-30 AC-8 (filled `verified:` at §8) |
| R-17 | WF-5 | Live progress board: one tile per lesson through its states, polled ev… | NL-27 | NL-78 | NL-78 AC-1 | planned: NL-78 AC-1 (filled `verified:` at §8) |
| R-19 | WF-10 | Deterministic check suite on every draft and every save, blocking and … | NL-37 | NL-37 | NL-37 AC-5 | planned: NL-37 AC-5 (filled `verified:` at §8) |
| R-19 | WF-15 | Deterministic check suite on every draft and every save, blocking and … | NL-20 | NL-38 | NL-38 AC-5 | planned: NL-38 AC-5 (filled `verified:` at §8) |
| R-19 | WF-22 | Deterministic check suite on every draft and every save, blocking and … | NL-18 | NL-29 | NL-29 AC-2 | planned: NL-29 AC-2 (filled `verified:` at §8) |
| R-19 | WF-24 | Deterministic check suite on every draft and every save, blocking and … | NL-20 | NL-85 | NL-85 AC-1 | planned: NL-85 AC-1 (filled `verified:` at §8) |
| R-19 | WF-41 | Deterministic check suite on every draft and every save, blocking and … | NL-20 | NL-106 | NL-106 AC-5 | planned: NL-106 AC-5 (filled `verified:` at §8) |
| R-20 | WF-8 | Alignment map per lesson with role (I / P / A) and who asserted each l… | NL-53 | NL-100 | NL-100 AC-2 | planned: NL-100 AC-2 (filled `verified:` at §8) |
| R-20 | WF-10 | Alignment map per lesson with role (I / P / A) and who asserted each l… | NL-38 | NL-38 | NL-38 AC-2 | planned: NL-38 AC-2 (filled `verified:` at §8) |
| R-20 | WF-11 | Alignment map per lesson with role (I / P / A) and who asserted each l… | NL-45 | NL-45 | NL-45 AC-8 | planned: NL-45 AC-8 (filled `verified:` at §8) |
| R-20 | WF-15 | Alignment map per lesson with role (I / P / A) and who asserted each l… | NL-38 | NL-53 | NL-53 AC-6 | planned: NL-53 AC-6 (filled `verified:` at §8) |
| R-21 | WF-8 | Lesson-part addresses (`G6.U4.L5.LearningInAction.PartA`) shown in the… | NL-62 | NL-100 | NL-100 AC-2 | planned: NL-100 AC-2 (filled `verified:` at §8) |
| R-21 | WF-10 | Lesson-part addresses (`G6.U4.L5.LearningInAction.PartA`) shown in the… | NL-39 | NL-39 | NL-39 AC-4 | planned: NL-39 AC-4 (filled `verified:` at §8) |
| R-22 | WF-10 | Locked content rules; warnings carried to the teacher-facing tip with … | NL-39 | NL-39 | NL-39 AC-6 | planned: NL-39 AC-6 (filled `verified:` at §8) |
| R-22 | WF-11 | Locked content rules; warnings carried to the teacher-facing tip with … | NL-45 | NL-45 | NL-45 AC-6 | planned: NL-45 AC-6 (filled `verified:` at §8) |
| R-22 | WF-15 | Locked content rules; warnings carried to the teacher-facing tip with … | NL-43 | NL-53 | NL-53 AC-7 | planned: NL-53 AC-7 (filled `verified:` at §8) |
| R-22 | WF-22 | Locked content rules; warnings carried to the teacher-facing tip with … | NL-18 | NL-18 | NL-18 AC-4 | planned: NL-18 AC-4 (filled `verified:` at §8) |
| R-22 | WF-24 | Locked content rules; warnings carried to the teacher-facing tip with … | NL-16 | NL-84 | NL-84 AC-4 | planned: NL-84 AC-4 (filled `verified:` at §8) |
| R-23 | WF-23 | Binary per-(activity, standard) judge on a different provider, advisor… | NL-89 | NL-89 | NL-89 AC-1 | planned: NL-89 AC-1 (filled `verified:` at §8) |
| R-23 | WF-31 | Binary per-(activity, standard) judge on a different provider, advisor… | NL-89 | NL-111 | NL-111 AC-1 | planned: NL-111 AC-1 (filled `verified:` at §8) |
| R-25 | WF-7 | Unit board and triage queue, one row per lesson, blocking issues first… | NL-37 | NL-54 | NL-54 AC-1 | planned: NL-54 AC-1 (filled `verified:` at §8) |
| R-26 | WF-9 | Collaborative ProseMirror + Yjs editor through one Hocuspocus server, … | NL-36 | NL-36 | NL-36 AC-1 | planned: NL-36 AC-1 (filled `verified:` at §8) |
| R-26 | WF-13 | Collaborative ProseMirror + Yjs editor through one Hocuspocus server, … | NL-105 | NL-114 | NL-114 AC-6 | planned: NL-114 AC-6 (filled `verified:` at §8) |
| R-26 | WF-14 | Collaborative ProseMirror + Yjs editor through one Hocuspocus server, … | NL-105 | NL-116 | NL-116 AC-2 | planned: NL-116 AC-2 (filled `verified:` at §8) |
| R-26 | WF-22 | Collaborative ProseMirror + Yjs editor through one Hocuspocus server, … | NL-29 | NL-29 | NL-29 AC-1 | planned: NL-29 AC-1 (filled `verified:` at §8) |
| R-26 | WF-41 | Collaborative ProseMirror + Yjs editor through one Hocuspocus server, … | NL-80 | NL-105 | NL-105 AC-1 | planned: NL-105 AC-1 (filled `verified:` at §8) |
| R-27 | WF-8 | Minimal evidence pane: confirmed outline row, official standard text, … | NL-44 | NL-44 | NL-44 AC-1 | planned: NL-44 AC-1 (filled `verified:` at §8) |
| R-28 | WF-9 | Checks re-run on every durable save, reading the stored derived row (a… | NL-80 | NL-80 | NL-80 AC-5 | planned: NL-80 AC-5 (filled `verified:` at §8) |
| R-28 | WF-10 | Checks re-run on every durable save, reading the stored derived row (a… | NL-37 | NL-37 | NL-37 AC-1 | planned: NL-37 AC-1 (filled `verified:` at §8) |
| R-28 | WF-41 | Checks re-run on every durable save, reading the stored derived row (a… | NL-38 | NL-105 | NL-105 AC-4 | planned: NL-105 AC-4 (filled `verified:` at §8) |
| R-29 | WF-13 | Regenerate never overwrites an edited, in-review or approved lesson: i… | NL-47 | NL-47 | NL-47 AC-1 | planned: NL-47 AC-1 (filled `verified:` at §8) |
| R-29 | WF-41 | Regenerate never overwrites an edited, in-review or approved lesson: i… | NL-105 | NL-105 | NL-105 AC-5 | planned: NL-105 AC-5 (filled `verified:` at §8) |
| R-31 | WF-14 | One AI-assist tool as a tracked suggestion held outside the document; … | NL-50 | NL-50 | NL-50 AC-1 | planned: NL-50 AC-1 (filled `verified:` at §8) |
| R-31 | WF-15 | One AI-assist tool as a tracked suggestion held outside the document; … | NL-38 | NL-53 | NL-53 AC-6 | planned: NL-53 AC-6 (filled `verified:` at §8) |
| R-31 | WF-41 | One AI-assist tool as a tracked suggestion held outside the document; … | NL-38 | NL-105 | NL-105 AC-7 | planned: NL-105 AC-7 (filled `verified:` at §8) |
| R-33 | WF-8 | Server-enforced lesson state machine by role (§5.4 states incl. `submi… | NL-53 | NL-100 | NL-100 AC-3 | planned: NL-100 AC-3 (filled `verified:` at §8) |
| R-33 | WF-9 | Server-enforced lesson state machine by role (§5.4 states incl. `submi… | NL-21 | NL-80 | NL-80 AC-2 | planned: NL-80 AC-2 (filled `verified:` at §8) |
| R-33 | WF-15 | Server-enforced lesson state machine by role (§5.4 states incl. `submi… | NL-20 | NL-53 | NL-53 AC-1 | planned: NL-53 AC-1 (filled `verified:` at §8) |
| R-33 | WF-41 | Server-enforced lesson state machine by role (§5.4 states incl. `submi… | NL-80 | NL-105 | NL-105 AC-6 | planned: NL-105 AC-6 (filled `verified:` at §8) |
| R-34 | WF-10 | Approval checklist linked to evidence; Approve disabled and server-ref… | NL-20 | NL-38 | NL-38 AC-5 | planned: NL-38 AC-5 (filled `verified:` at §8) |
| R-34 | WF-11 | Approval checklist linked to evidence; Approve disabled and server-ref… | NL-45 | NL-45 | NL-45 AC-4 | planned: NL-45 AC-4 (filled `verified:` at §8) |
| R-34 | WF-15 | Approval checklist linked to evidence; Approve disabled and server-ref… | NL-20 | NL-53 | NL-53 AC-6 | planned: NL-53 AC-6 (filled `verified:` at §8) |
| R-35 | WF-13 | Append-only audit log of every transition and provenance on every less… | NL-53 | NL-114 | NL-114 AC-7 | planned: NL-114 AC-7 (filled `verified:` at §8) |
| R-35 | WF-15 | Append-only audit log of every transition and provenance on every less… | NL-37 | NL-53 | NL-53 AC-9 | planned: NL-53 AC-9 (filled `verified:` at §8) |
| R-35 | WF-22 | Append-only audit log of every transition and provenance on every less… | NL-29 | NL-29 | NL-29 AC-10 | planned: NL-29 AC-10 (filled `verified:` at §8) |
| R-35 | WF-36 | Append-only audit log of every transition and provenance on every less… | NL-08 | NL-08 | NL-08 AC-4 | planned: NL-08 AC-4 (filled `verified:` at §8) |
| R-35 | WF-41 | Append-only audit log of every transition and provenance on every less… | NL-42 | NL-106 | NL-106 AC-1 | planned: NL-106 AC-1 (filled `verified:` at §8) |
| R-60 | WF-7 | Draft-quality rating at Approve (usable as drafted / with edits / rewr… | NL-98 | NL-98 | NL-98 AC-4 | planned: NL-98 AC-4 (filled `verified:` at §8) |
| R-60 | WF-15 | Draft-quality rating at Approve (usable as drafted / with edits / rewr… | NL-48 | NL-53 | NL-53 AC-3 | planned: NL-53 AC-3 (filled `verified:` at §8) |
| R-38 | WF-4 | Two prompt layers; the locked layer has no UI edit path; every prompt … | NL-27 | NL-27 | NL-27 AC-8 | planned: NL-27 AC-8 (filled `verified:` at §8) |
| R-38 | WF-20 | Two prompt layers; the locked layer has no UI edit path; every prompt … | NL-14 | NL-34 | NL-34 AC-5 | planned: NL-34 AC-5 (filled `verified:` at §8) |
| R-38 | WF-21 | Two prompt layers; the locked layer has no UI edit path; every prompt … | NL-14 | NL-79 | NL-79 AC-4 | planned: NL-79 AC-4 (filled `verified:` at §8) |
| R-38 | WF-22 | Two prompt layers; the locked layer has no UI edit path; every prompt … | NL-14 | NL-14 | NL-14 AC-5 | planned: NL-14 AC-5 (filled `verified:` at §8) |
| R-39 | WF-20 | Editable guidance layer: each save a version with author, time, diff a… | NL-34 | NL-88 | NL-88 AC-1 | planned: NL-88 AC-1 (filled `verified:` at §8) |
| R-41 | WF-18 | Read-only unit coverage matrix from stored alignment links by one quer… | NL-43 | NL-91 | NL-91 AC-1 | planned: NL-91 AC-1 (filled `verified:` at §8) |
| R-42 | WF-19 | Versioned, idempotent JSON export of approved snapshots only in the `L… | NL-09 | NL-51 | NL-51 AC-1 | planned: NL-51 AC-1 (filled `verified:` at §8) |
| R-48 | WF-17 | Traces in our Postgres per run, lesson and model call under one correl… | NL-33 | NL-33 | NL-33 AC-8 | planned: NL-33 AC-8 (filled `verified:` at §8) |
| R-48 | WF-20 | Traces in our Postgres per run, lesson and model call under one correl… | NL-88 | NL-88 | NL-88 AC-10 | planned: NL-88 AC-10 (filled `verified:` at §8) |
| R-48 | WF-21 | Traces in our Postgres per run, lesson and model call under one correl… | NL-32 | NL-79 | NL-79 AC-1 | planned: NL-79 AC-1 (filled `verified:` at §8) |
| R-48 | WF-22 | Traces in our Postgres per run, lesson and model call under one correl… | NL-32 | NL-32 | NL-32 AC-3 | planned: NL-32 AC-3 (filled `verified:` at §8) |
| R-48 | WF-23 | Traces in our Postgres per run, lesson and model call under one correl… | NL-33 | NL-89 | NL-89 AC-3 | planned: NL-89 AC-3 (filled `verified:` at §8) |
| R-48 | WF-25 | Traces in our Postgres per run, lesson and model call under one correl… | NL-86 | NL-86 | NL-86 AC-6 | planned: NL-86 AC-6 (filled `verified:` at §8) |
| R-48 | WF-32 | Traces in our Postgres per run, lesson and model call under one correl… | NL-87 | NL-87 | NL-87 AC-1 | planned: NL-87 AC-1 (filled `verified:` at §8) |
| R-49 | WF-7 | Heartbeats every 15 s while active, merged across tabs, human sessions… | NL-48 | NL-54 | NL-54 AC-7 | planned: NL-54 AC-7 (filled `verified:` at §8) |
| R-49 | WF-15 | Heartbeats every 15 s while active, merged across tabs, human sessions… | NL-48 | NL-53 | NL-53 AC-11 | planned: NL-53 AC-11 (filled `verified:` at §8) |
| R-49 | WF-16 | Heartbeats every 15 s while active, merged across tabs, human sessions… | NL-48 | NL-48 | NL-48 AC-2 | planned: NL-48 AC-2 (filled `verified:` at §8) |
| R-50 | WF-7 | Full *Unit quality* page (V-1…V-6, O-1…O-4, H-1…H-6 with *n* and label… | NL-54 | NL-54 | NL-54 AC-8 | planned: NL-54 AC-8 (filled `verified:` at §8) |
| R-51 | WF-24 | Evals: one golden test per outline defect; golden cases for every chec… | NL-49 | NL-84 | NL-84 AC-1 | planned: NL-84 AC-1 (filled `verified:` at §8) |
| R-51 | WF-25 | Evals: one golden test per outline defect; golden cases for every chec… | NL-49 | NL-86 | NL-86 AC-1 | planned: NL-86 AC-1 (filled `verified:` at §8) |
| R-52 | WF-26 | Seeded-error run, ~5 planted errors by someone other than the reviewer… | NL-92 | NL-92 | NL-92 AC-1 | planned: NL-92 AC-1 (filled `verified:` at §8) |
| R-53 | WF-27 | Local-only structural comparison with the held-out Unit 4, numbers onl… | NL-121 | NL-121 | NL-121 AC-2 | planned: NL-121 AC-2 (filled `verified:` at §8) |
| R-54 | WF-1 | Allow-list sign-in; author / reviewer / approver roles enforced on the… | NL-13 | NL-25 | NL-25 AC-1 | planned: NL-25 AC-1 (filled `verified:` at §8) |
| R-54 | WF-2 | Allow-list sign-in; author / reviewer / approver roles enforced on the… | NL-110 | NL-110 | NL-110 AC-4 | planned: NL-110 AC-4 (filled `verified:` at §8) |
| R-54 | WF-3 | Allow-list sign-in; author / reviewer / approver roles enforced on the… | NL-25 | NL-82 | NL-82 AC-1 | planned: NL-82 AC-1 (filled `verified:` at §8) |
| R-54 | WF-4 | Allow-list sign-in; author / reviewer / approver roles enforced on the… | NL-26 | NL-105 | NL-105 AC-1 | planned: NL-105 AC-1 (filled `verified:` at §8) |
| R-54 | WF-9 | Allow-list sign-in; author / reviewer / approver roles enforced on the… | NL-21 | NL-80 | NL-80 AC-1 | planned: NL-80 AC-1 (filled `verified:` at §8) |
| R-54 | WF-11 | Allow-list sign-in; author / reviewer / approver roles enforced on the… | NL-53 | NL-113 | NL-113 AC-10 | planned: NL-113 AC-10 (filled `verified:` at §8) |
| R-54 | WF-13 | Allow-list sign-in; author / reviewer / approver roles enforced on the… | NL-53 | NL-114 | NL-114 AC-5 | planned: NL-114 AC-5 (filled `verified:` at §8) |
| R-54 | WF-15 | Allow-list sign-in; author / reviewer / approver roles enforced on the… | NL-21 | NL-53 | NL-53 AC-1 | planned: NL-53 AC-1 (filled `verified:` at §8) |
| R-54 | WF-37 | Allow-list sign-in; author / reviewer / approver roles enforced on the… | NL-25 | NL-82 | NL-82 AC-3 | planned: NL-82 AC-3 (filled `verified:` at §8) |
| R-55 | WF-4 | Generation time and cost: p95 ≤ 5 min per lesson, the 47-lesson unit ≤… | NL-78 | NL-95 | NL-95 AC-4 | planned: NL-95 AC-4 (filled `verified:` at §8) |
| R-55 | WF-6 | Generation time and cost: p95 ≤ 5 min per lesson, the 47-lesson unit ≤… | NL-78 | NL-96 | NL-96 AC-8 | planned: NL-96 AC-8 (filled `verified:` at §8) |
| R-55 | WF-21 | Generation time and cost: p95 ≤ 5 min per lesson, the 47-lesson unit ≤… | NL-30 | NL-79 | NL-79 AC-7 | planned: NL-79 AC-7 (filled `verified:` at §8) |
| R-55 | WF-22 | Generation time and cost: p95 ≤ 5 min per lesson, the 47-lesson unit ≤… | NL-30 | NL-30 | NL-30 AC-8 | planned: NL-30 AC-8 (filled `verified:` at §8) |
| R-55 | WF-25 | Generation time and cost: p95 ≤ 5 min per lesson, the 47-lesson unit ≤… | NL-78 | NL-112 | NL-112 AC-4 | planned: NL-112 AC-4 (filled `verified:` at §8) |
| R-55 | WF-28 | Generation time and cost: p95 ≤ 5 min per lesson, the 47-lesson unit ≤… | NL-79 | NL-107 | NL-107 AC-3 | planned: NL-107 AC-3 (filled `verified:` at §8) |
| R-56 | WF-30 | Collaboration under load at the 200-user spike: remote edit p95 < 500 … | NL-119 | NL-119 | NL-119 AC-1 | planned: NL-119 AC-1 (filled `verified:` at §8) |
| R-57 | WF-29 | Page speed at the 200-user spike: lesson open p95 < 1.5 s, unit board … | NL-118 | NL-118 | NL-118 AC-1 | planned: NL-118 AC-1 (filled `verified:` at §8) |
| R-58 | WF-3 | Outline cells and model output never reach the page as raw HTML; compi… | NL-17 | NL-77 | NL-77 AC-6 | planned: NL-77 AC-6 (filled `verified:` at §8) |
| R-58 | WF-7 | Outline cells and model output never reach the page as raw HTML; compi… | NL-98 | NL-98 | NL-98 AC-7 | planned: NL-98 AC-7 (filled `verified:` at §8) |
| R-58 | WF-8 | Outline cells and model output never reach the page as raw HTML; compi… | NL-62 | NL-100 | NL-100 AC-6 | planned: NL-100 AC-6 (filled `verified:` at §8) |
| R-58 | WF-9 | Outline cells and model output never reach the page as raw HTML; compi… | NL-63 | NL-101 | NL-101 AC-8 | planned: NL-101 AC-8 (filled `verified:` at §8) |
| R-58 | WF-12 | Outline cells and model output never reach the page as raw HTML; compi… | NL-46 | NL-113 | NL-113 AC-9 | planned: NL-113 AC-9 (filled `verified:` at §8) |
| R-58 | WF-13 | Outline cells and model output never reach the page as raw HTML; compi… | NL-114 | NL-114 | NL-114 AC-9 | planned: NL-114 AC-9 (filled `verified:` at §8) |
| R-58 | WF-14 | Outline cells and model output never reach the page as raw HTML; compi… | NL-50 | NL-116 | NL-116 AC-6 | planned: NL-116 AC-6 (filled `verified:` at §8) |
| R-58 | WF-17 | Outline cells and model output never reach the page as raw HTML; compi… | NL-97 | NL-97 | NL-97 AC-6 | planned: NL-97 AC-6 (filled `verified:` at §8) |
| R-58 | WF-19 | Outline cells and model output never reach the page as raw HTML; compi… | NL-102 | NL-102 | NL-102 AC-7 | planned: NL-102 AC-7 (filled `verified:` at §8) |
| GR-1 | WF-10 | No invented quotes, page numbers, facts about real people or article c… | NL-40 | NL-40 | NL-40 AC-1 | planned: NL-40 AC-1 (filled `verified:` at §8) |
| GR-1 | WF-14 | No invented quotes, page numbers, facts about real people or article c… | NL-32 | NL-116 | NL-116 AC-6 | planned: NL-116 AC-6 (filled `verified:` at §8) |
| GR-1 | WF-24 | No invented quotes, page numbers, facts about real people or article c… | NL-40 | NL-85 | NL-85 AC-4 | planned: NL-85 AC-4 (filled `verified:` at §8) |
| GR-1 | WF-42 | No invented quotes, page numbers, facts about real people or article c… | NL-40 | NL-85 | NL-85 AC-5 | planned: NL-85 AC-5 (filled `verified:` at §8) |
| GR-2 | WF-12 | Never write a passage of a text we were not given; the novel appears o… | NL-105 | NL-113 | NL-113 AC-7 | planned: NL-113 AC-7 (filled `verified:` at §8) |
| GR-2 | WF-14 | Never write a passage of a text we were not given; the novel appears o… | NL-105 | NL-116 | NL-116 AC-6 | planned: NL-116 AC-6 (filled `verified:` at §8) |
| GR-2 | WF-22 | Never write a passage of a text we were not given; the novel appears o… | NL-09 | NL-09 | NL-09 AC-3 | planned: NL-09 AC-3 (filled `verified:` at §8) |
| GR-3 | WF-10 | Every excerpt has a rights status; `to-clear` blocks approval | NL-40 | NL-40 | NL-40 AC-5 | planned: NL-40 AC-5 (filled `verified:` at §8) |
| GR-3 | WF-12 | Every excerpt has a rights status; `to-clear` blocks approval | NL-46 | NL-113 | NL-113 AC-8 | planned: NL-113 AC-8 (filled `verified:` at §8) |
| GR-3 | WF-15 | Every excerpt has a rights status; `to-clear` blocks approval | NL-46 | NL-53 | NL-53 AC-7 | planned: NL-53 AC-7 (filled `verified:` at §8) |
| GR-4 | WF-7 | Never a bare "standards-aligned" badge; every alignment link says who … | NL-98 | NL-98 | NL-98 AC-3 | planned: NL-98 AC-3 (filled `verified:` at §8) |
| GR-4 | WF-8 | Never a bare "standards-aligned" badge; every alignment link says who … | NL-44 | NL-44 | NL-44 AC-1 | planned: NL-44 AC-1 (filled `verified:` at §8) |
| GR-4 | WF-10 | Never a bare "standards-aligned" badge; every alignment link says who … | NL-39 | NL-39 | NL-39 AC-3 | planned: NL-39 AC-3 (filled `verified:` at §8) |
| GR-4 | WF-18 | Never a bare "standards-aligned" badge; every alignment link says who … | NL-43 | NL-91 | NL-91 AC-1 | planned: NL-91 AC-1 (filled `verified:` at §8) |
| GR-4 | WF-23 | Never a bare "standards-aligned" badge; every alignment link says who … | NL-89 | NL-89 | NL-89 AC-1 | planned: NL-89 AC-1 (filled `verified:` at §8) |
| GR-5 | WF-3 | Cite only official SBE standards text from the CDE, never the sheet's … | NL-15 | NL-82 | NL-82 AC-1 | planned: NL-82 AC-1 (filled `verified:` at §8) |
| GR-5 | WF-8 | Cite only official SBE standards text from the CDE, never the sheet's … | NL-44 | NL-44 | NL-44 AC-1 | planned: NL-44 AC-1 (filled `verified:` at §8) |
| GR-6 | WF-15 | No bulk or automatic approval: one lesson, one pinned version, one nam… | NL-21 | NL-53 | NL-53 AC-4 | planned: NL-53 AC-4 (filled `verified:` at §8) |
| GR-6 | WF-41 | No bulk or automatic approval: one lesson, one pinned version, one nam… | NL-21 | NL-106 | NL-106 AC-7 | planned: NL-106 AC-7 (filled `verified:` at §8) |
| GR-7 | WF-13 | AI edits are suggestions a person accepts; nothing AI-written enters a… | NL-47 | NL-47 | NL-47 AC-1 | planned: NL-47 AC-1 (filled `verified:` at §8) |
| GR-7 | WF-14 | AI edits are suggestions a person accepts; nothing AI-written enters a… | NL-50 | NL-50 | NL-50 AC-1 | planned: NL-50 AC-1 (filled `verified:` at §8) |
| GR-7 | WF-41 | AI edits are suggestions a person accepts; nothing AI-written enters a… | NL-105 | NL-105 | NL-105 AC-7 | planned: NL-105 AC-7 (filled `verified:` at §8) |
| GR-8 | WF-13 | Provenance and the authorship record exist on every version, always | NL-47 | NL-47 | NL-47 AC-8 | planned: NL-47 AC-8 (filled `verified:` at §8) |
| GR-8 | WF-14 | Provenance and the authorship record exist on every version, always | NL-50 | NL-50 | NL-50 AC-8 | planned: NL-50 AC-8 (filled `verified:` at §8) |
| GR-8 | WF-15 | Provenance and the authorship record exist on every version, always | NL-42 | NL-53 | NL-53 AC-9 | planned: NL-53 AC-9 (filled `verified:` at §8) |
| GR-8 | WF-22 | Provenance and the authorship record exist on every version, always | NL-29 | NL-29 | NL-29 AC-10 | planned: NL-29 AC-10 (filled `verified:` at §8) |
| GR-8 | WF-41 | Provenance and the authorship record exist on every version, always | NL-105 | NL-105 | NL-105 AC-8 | planned: NL-105 AC-8 (filled `verified:` at §8) |
| GR-9 | WF-1 | Crawled Newsela content stays in git-ignored `docs/source/restricted/`… | NL-53 | NL-53 | NL-53 AC-16 | planned: NL-53 AC-16 (filled `verified:` at §8) |
| GR-9 | WF-2 | Crawled Newsela content stays in git-ignored `docs/source/restricted/`… | NL-33 | NL-33 | NL-33 AC-9 | planned: NL-33 AC-9 (filled `verified:` at §8) |
| GR-9 | WF-3 | Crawled Newsela content stays in git-ignored `docs/source/restricted/`… | NL-112 | NL-122 | NL-122 AC-3 | planned: NL-122 AC-3 (filled `verified:` at §8) |
| GR-9 | WF-4 | Crawled Newsela content stays in git-ignored `docs/source/restricted/`… | NL-80 | NL-106 | NL-106 AC-10 | planned: NL-106 AC-10 (filled `verified:` at §8) |
| GR-9 | WF-9 | Crawled Newsela content stays in git-ignored `docs/source/restricted/`… | NL-80 | NL-80 | NL-80 AC-10 | planned: NL-80 AC-10 (filled `verified:` at §8) |
| GR-9 | WF-10 | Crawled Newsela content stays in git-ignored `docs/source/restricted/`… | NL-81 | NL-81 | NL-81 AC-10 | planned: NL-81 AC-10 (filled `verified:` at §8) |
| GR-9 | WF-14 | Crawled Newsela content stays in git-ignored `docs/source/restricted/`… | NL-33 | NL-116 | NL-116 AC-8 | planned: NL-116 AC-8 (filled `verified:` at §8) |
| GR-9 | WF-23 | Crawled Newsela content stays in git-ignored `docs/source/restricted/`… | NL-14 | NL-89 | NL-89 AC-2 | planned: NL-89 AC-2 (filled `verified:` at §8) |
| GR-9 | WF-26 | Crawled Newsela content stays in git-ignored `docs/source/restricted/`… | NL-49 | NL-92 | NL-92 AC-7 | planned: NL-92 AC-7 (filled `verified:` at §8) |
| GR-9 | WF-27 | Crawled Newsela content stays in git-ignored `docs/source/restricted/`… | NL-49 | NL-121 | NL-121 AC-1 | planned: NL-121 AC-1 (filled `verified:` at §8) |
| GR-10 | WF-20 | In-context examples only; no fine-tuning, no vendor file or vector sto… | NL-79 | NL-103 | NL-103 AC-3 | planned: NL-103 AC-3 (filled `verified:` at §8) |
| GR-10 | WF-21 | In-context examples only; no fine-tuning, no vendor file or vector sto… | NL-14 | NL-79 | NL-79 AC-4 | planned: NL-79 AC-4 (filled `verified:` at §8) |
| GR-10 | WF-23 | In-context examples only; no fine-tuning, no vendor file or vector sto… | NL-79 | NL-110 | NL-110 AC-5 | planned: NL-110 AC-5 (filled `verified:` at §8) |
| GR-11 | WF-21 | Grade 6 Unit 4's published lessons are held out, never used as example… | NL-79 | NL-79 | NL-79 AC-4 | planned: NL-79 AC-4 (filled `verified:` at §8) |
| GR-11 | WF-27 | Grade 6 Unit 4's published lessons are held out, never used as example… | NL-121 | NL-121 | NL-121 AC-1 | planned: NL-121 AC-1 (filled `verified:` at §8) |
| GR-12 | WF-10 | Locked content rules: respectful sacred narratives, no trauma-disclosu… | NL-39 | NL-39 | NL-39 AC-6 | planned: NL-39 AC-6 (filled `verified:` at §8) |
| GR-12 | WF-22 | Locked content rules: respectful sacred narratives, no trauma-disclosu… | NL-18 | NL-18 | NL-18 AC-4 | planned: NL-18 AC-4 (filled `verified:` at §8) |
| GR-12 | WF-24 | Locked content rules: respectful sacred narratives, no trauma-disclosu… | NL-84 | NL-84 | NL-84 AC-4 | planned: NL-84 AC-4 (filled `verified:` at §8) |
| GR-13 | WF-2 | No student or teacher-of-record data; staff authentication only | NL-89 | NL-89 | NL-89 AC-2 | planned: NL-89 AC-2 (filled `verified:` at §8) |
| GR-13 | WF-3 | No student or teacher-of-record data; staff authentication only | NL-82 | NL-82 | NL-82 AC-4 | planned: NL-82 AC-4 (filled `verified:` at §8) |
| GR-14 | WF-7 | Demo honesty: the full unit runs before recording; the lesson shown is… | NL-104 | NL-104 | NL-104 AC-1 | planned: NL-104 AC-1 (filled `verified:` at §8) |
| GR-14 | WF-17 | Demo honesty: the full unit runs before recording; the lesson shown is… | NL-97 | NL-97 | NL-97 AC-3 | planned: NL-97 AC-3 (filled `verified:` at §8) |
| GR-14 | WF-25 | Demo honesty: the full unit runs before recording; the lesson shown is… | NL-86 | NL-86 | NL-86 AC-4 | planned: NL-86 AC-4 (filled `verified:` at §8) |
| GR-14 | WF-38 | Demo honesty: the full unit runs before recording; the lesson shown is… | NL-83 | NL-83 | NL-83 AC-4 | planned: NL-83 AC-4 (filled `verified:` at §8) |
| GR-15 | WF-7 | Review time in aggregate only, never ranked by person; ≥ 3 distinct re… | NL-42 | NL-54 | NL-54 AC-8 | planned: NL-54 AC-8 (filled `verified:` at §8) |
| GR-15 | WF-15 | Review time in aggregate only, never ranked by person; ≥ 3 distinct re… | NL-08 | NL-08 | NL-08 AC-7 | planned: NL-08 AC-7 (filled `verified:` at §8) |
| GR-15 | WF-16 | Review time in aggregate only, never ranked by person; ≥ 3 distinct re… | NL-48 | NL-48 | NL-48 AC-4 | planned: NL-48 AC-4 (filled `verified:` at §8) |
| GR-16 | WF-1 | Copy frames the tool as expert-driven; never "AI replaces writers" | NL-90 | NL-90 | NL-90 AC-7 | planned: NL-90 AC-7 (filled `verified:` at §8) |
| GR-16 | WF-2 | Copy frames the tool as expert-driven; never "AI replaces writers" | NL-90 | NL-93 | NL-93 AC-9 | planned: NL-93 AC-9 (filled `verified:` at §8) |
| GR-16 | WF-3 | Copy frames the tool as expert-driven; never "AI replaces writers" | NL-90 | NL-94 | NL-94 AC-9 | planned: NL-94 AC-9 (filled `verified:` at §8) |
| GR-16 | WF-4 | Copy frames the tool as expert-driven; never "AI replaces writers" | NL-90 | NL-95 | NL-95 AC-8 | planned: NL-95 AC-8 (filled `verified:` at §8) |
| GR-16 | WF-5 | Copy frames the tool as expert-driven; never "AI replaces writers" | NL-90 | NL-96 | NL-96 AC-9 | planned: NL-96 AC-9 (filled `verified:` at §8) |
| GR-16 | WF-7 | Copy frames the tool as expert-driven; never "AI replaces writers" | NL-90 | NL-98 | NL-98 AC-7 | planned: NL-98 AC-7 (filled `verified:` at §8) |
| GR-16 | WF-8 | Copy frames the tool as expert-driven; never "AI replaces writers" | NL-90 | NL-100 | NL-100 AC-8 | planned: NL-100 AC-8 (filled `verified:` at §8) |
| GR-16 | WF-17 | Copy frames the tool as expert-driven; never "AI replaces writers" | NL-90 | NL-97 | NL-97 AC-6 | planned: NL-97 AC-6 (filled `verified:` at §8) |
| GR-16 | WF-19 | Copy frames the tool as expert-driven; never "AI replaces writers" | NL-90 | NL-102 | NL-102 AC-7 | planned: NL-102 AC-7 (filled `verified:` at §8) |
| GR-16 | WF-20 | Copy frames the tool as expert-driven; never "AI replaces writers" | NL-90 | NL-103 | NL-103 AC-7 | planned: NL-103 AC-7 (filled `verified:` at §8) |
| GR-18 | WF-20 | The locked prompt layer cannot be edited from the UI; output checks ru… | NL-14 | NL-34 | NL-34 AC-5 | planned: NL-34 AC-5 (filled `verified:` at §8) |
| GR-18 | WF-22 | The locked prompt layer cannot be edited from the UI; output checks ru… | NL-14 | NL-79 | NL-79 AC-4 | planned: NL-79 AC-4 (filled `verified:` at §8) |
| CON-1 | WF-1 | Session and role: the agreed card's operations, named errors and guara… | NL-25 | NL-25 | NL-25 AC-1 | planned: NL-25 AC-1 (filled `verified:` at §8) |
| CON-2 | WF-2 | Outline versions: the agreed card's operations, named errors and guara… | NL-26 | NL-26 | NL-26 AC-1 | planned: NL-26 AC-1 (filled `verified:` at §8) |
| CON-3 | WF-3 | Validation report: the agreed card's operations, named errors and guar… | NL-77 | NL-77 | NL-77 AC-1 | planned: NL-77 AC-1 (filled `verified:` at §8) |
| CON-4 | WF-3 | Intake choices: the agreed card's operations, named errors and guarant… | NL-77 | NL-77 | NL-77 AC-7 | planned: NL-77 AC-7 (filled `verified:` at §8) |
| CON-5 | WF-4 | Start a run: the agreed card's operations, named errors and guarantees… | NL-27 | NL-27 | NL-27 AC-1 | planned: NL-27 AC-1 (filled `verified:` at §8) |
| CON-6 | WF-5 | Run progress: the agreed card's operations, named errors and guarantee… | NL-27 | NL-78 | NL-78 AC-1 | planned: NL-78 AC-1 (filled `verified:` at §8) |
| CON-7 | WF-6 | Run control: the agreed card's operations, named errors and guarantees… | NL-28 | NL-28 | NL-28 AC-7 | planned: NL-28 AC-7 (filled `verified:` at §8) |
| CON-8 | WF-5 | Unit plan: the agreed card's operations, named errors and guarantees, … | NL-78 | NL-78 | NL-78 AC-6 | planned: NL-78 AC-6 (filled `verified:` at §8) |
| CON-9 | WF-7 | Unit board: the agreed card's operations, named errors and guarantees,… | NL-54 | NL-54 | NL-54 AC-1 | planned: NL-54 AC-1 (filled `verified:` at §8) |
| CON-10 | WF-7 | Unit metrics: the agreed card's operations, named errors and guarantee… | NL-54 | NL-54 | NL-54 AC-7 | planned: NL-54 AC-7 (filled `verified:` at §8) |
| CON-11 | WF-8 | Lesson read: the agreed card's operations, named errors and guarantees… | NL-62 | NL-100 | NL-100 AC-1 | planned: NL-100 AC-1 (filled `verified:` at §8) |
| CON-12 | WF-9 | Collaboration channel (Yjs socket): the agreed card's operations, name… | NL-07 | NL-80 | NL-80 AC-1 | planned: NL-80 AC-1 (filled `verified:` at §8) |
| CON-13 | WF-8 | Issue list: the agreed card's operations, named errors and guarantees,… | NL-45 | NL-45 | NL-45 AC-1 | planned: NL-45 AC-1 (filled `verified:` at §8) |
| CON-13 | WF-10 | Issue list: the agreed card's operations, named errors and guarantees,… | NL-38 | NL-38 | NL-38 AC-2 | planned: NL-38 AC-2 (filled `verified:` at §8) |
| CON-14 | WF-11 | Resolve and confirm: the agreed card's operations, named errors and gu… | NL-45 | NL-45 | NL-45 AC-4 | planned: NL-45 AC-4 (filled `verified:` at §8) |
| CON-15 | WF-12 | Fill a placeholder or slot: the agreed card's operations, named errors… | NL-46 | NL-113 | NL-113 AC-7 | planned: NL-113 AC-7 (filled `verified:` at §8) |
| CON-16 | WF-13 | Candidates: the agreed card's operations, named errors and guarantees,… | NL-47 | NL-114 | NL-114 AC-1 | planned: NL-114 AC-1 (filled `verified:` at §8) |
| CON-17 | WF-14 | AI suggestions: the agreed card's operations, named errors and guarant… | NL-50 | NL-116 | NL-116 AC-1 | planned: NL-116 AC-1 (filled `verified:` at §8) |
| CON-17 | WF-41 | AI suggestions: the agreed card's operations, named errors and guarant… | NL-43 | NL-105 | NL-105 AC-7 | planned: NL-105 AC-7 (filled `verified:` at §8) |
| CON-18 | WF-15 | Lesson transitions: the agreed card's operations, named errors and gua… | NL-36 | NL-53 | NL-53 AC-1 | planned: NL-53 AC-1 (filled `verified:` at §8) |
| CON-18 | WF-41 | Lesson transitions: the agreed card's operations, named errors and gua… | NL-38 | NL-105 | NL-105 AC-11 | planned: NL-105 AC-11 (filled `verified:` at §8) |
| CON-19 | WF-8 | Lesson history: the agreed card's operations, named errors and guarant… | NL-70 | NL-100 | NL-100 AC-7 | planned: NL-100 AC-7 (filled `verified:` at §8) |
| CON-20 | WF-16 | Review heartbeats: the agreed card's operations, named errors and guar… | NL-64 | NL-99 | NL-99 AC-1 | planned: NL-99 AC-1 (filled `verified:` at §8) |
| CON-21 | WF-17 | Run summary: the agreed card's operations, named errors and guarantees… | NL-33 | NL-33 | NL-33 AC-8 | planned: NL-33 AC-8 (filled `verified:` at §8) |
| CON-22 | WF-18 | Coverage matrix: the agreed card's operations, named errors and guaran… | NL-91 | NL-91 | NL-91 AC-1 | planned: NL-91 AC-1 (filled `verified:` at §8) |
| CON-23 | WF-19 | Export: the agreed card's operations, named errors and guarantees, imp… | NL-51 | NL-51 | NL-51 AC-1 | planned: NL-51 AC-1 (filled `verified:` at §8) |
| CON-24 | WF-4 | Prompt versions: the agreed card's operations, named errors and guaran… | NL-34 | NL-34 | NL-34 AC-1 | planned: NL-34 AC-1 (filled `verified:` at §8) |
| CON-24 | WF-20 | Prompt versions: the agreed card's operations, named errors and guaran… | NL-34 | NL-88 | NL-88 AC-1 | planned: NL-88 AC-1 (filled `verified:` at §8) |
| CON-G1 | WF-1 | Wrong role → `ROLE_FORBIDDEN`, on the server, for every action | NL-13 | NL-45 | NL-45 AC-4 | planned: NL-45 AC-4 (filled `verified:` at §8) |
| CON-G1 | WF-2 | Wrong role → `ROLE_FORBIDDEN`, on the server, for every action | NL-26 | NL-93 | NL-93 AC-6 | planned: NL-93 AC-6 (filled `verified:` at §8) |
| CON-G1 | WF-3 | Wrong role → `ROLE_FORBIDDEN`, on the server, for every action | NL-34 | NL-82 | NL-82 AC-3 | planned: NL-82 AC-3 (filled `verified:` at §8) |
| CON-G1 | WF-4 | Wrong role → `ROLE_FORBIDDEN`, on the server, for every action | NL-34 | NL-95 | NL-95 AC-6 | planned: NL-95 AC-6 (filled `verified:` at §8) |
| CON-G1 | WF-6 | Wrong role → `ROLE_FORBIDDEN`, on the server, for every action | NL-26 | NL-78 | NL-78 AC-9 | planned: NL-78 AC-9 (filled `verified:` at §8) |
| CON-G1 | WF-7 | Wrong role → `ROLE_FORBIDDEN`, on the server, for every action | NL-54 | NL-98 | NL-98 AC-6 | planned: NL-98 AC-6 (filled `verified:` at §8) |
| CON-G1 | WF-9 | Wrong role → `ROLE_FORBIDDEN`, on the server, for every action | NL-21 | NL-80 | NL-80 AC-1 | planned: NL-80 AC-1 (filled `verified:` at §8) |
| CON-G1 | WF-11 | Wrong role → `ROLE_FORBIDDEN`, on the server, for every action | NL-45 | NL-113 | NL-113 AC-10 | planned: NL-113 AC-10 (filled `verified:` at §8) |
| CON-G1 | WF-13 | Wrong role → `ROLE_FORBIDDEN`, on the server, for every action | NL-47 | NL-114 | NL-114 AC-5 | planned: NL-114 AC-5 (filled `verified:` at §8) |
| CON-G1 | WF-14 | Wrong role → `ROLE_FORBIDDEN`, on the server, for every action | NL-50 | NL-116 | NL-116 AC-7 | planned: NL-116 AC-7 (filled `verified:` at §8) |
| CON-G1 | WF-15 | Wrong role → `ROLE_FORBIDDEN`, on the server, for every action | NL-21 | NL-53 | NL-53 AC-1 | planned: NL-53 AC-1 (filled `verified:` at §8) |
| CON-G1 | WF-16 | Wrong role → `ROLE_FORBIDDEN`, on the server, for every action | NL-53 | NL-99 | NL-99 AC-3 | planned: NL-99 AC-3 (filled `verified:` at §8) |
| CON-G1 | WF-18 | Wrong role → `ROLE_FORBIDDEN`, on the server, for every action | NL-54 | NL-91 | NL-91 AC-6 | planned: NL-91 AC-6 (filled `verified:` at §8) |
| CON-G1 | WF-19 | Wrong role → `ROLE_FORBIDDEN`, on the server, for every action | NL-51 | NL-102 | NL-102 AC-7 | planned: NL-102 AC-7 (filled `verified:` at §8) |
| CON-G1 | WF-20 | Wrong role → `ROLE_FORBIDDEN`, on the server, for every action | NL-88 | NL-103 | NL-103 AC-6 | planned: NL-103 AC-6 (filled `verified:` at §8) |
| CON-G2 | WF-1 | A refused call changes nothing (no state, version, approval, audit or … | NL-12 | NL-25 | NL-25 AC-12 | planned: NL-25 AC-12 (filled `verified:` at §8) |
| CON-G2 | WF-2 | A refused call changes nothing (no state, version, approval, audit or … | NL-12 | NL-26 | NL-26 AC-3 | planned: NL-26 AC-3 (filled `verified:` at §8) |
| CON-G2 | WF-3 | A refused call changes nothing (no state, version, approval, audit or … | NL-77 | NL-94 | NL-94 AC-3 | planned: NL-94 AC-3 (filled `verified:` at §8) |
| CON-G2 | WF-4 | A refused call changes nothing (no state, version, approval, audit or … | NL-12 | NL-27 | NL-27 AC-4 | planned: NL-27 AC-4 (filled `verified:` at §8) |
| CON-G2 | WF-6 | A refused call changes nothing (no state, version, approval, audit or … | NL-26 | NL-78 | NL-78 AC-9 | planned: NL-78 AC-9 (filled `verified:` at §8) |
| CON-G2 | WF-9 | A refused call changes nothing (no state, version, approval, audit or … | NL-07 | NL-80 | NL-80 AC-3 | planned: NL-80 AC-3 (filled `verified:` at §8) |
| CON-G2 | WF-11 | A refused call changes nothing (no state, version, approval, audit or … | NL-12 | NL-45 | NL-45 AC-4 | planned: NL-45 AC-4 (filled `verified:` at §8) |
| CON-G2 | WF-12 | A refused call changes nothing (no state, version, approval, audit or … | NL-45 | NL-113 | NL-113 AC-8 | planned: NL-113 AC-8 (filled `verified:` at §8) |
| CON-G2 | WF-13 | A refused call changes nothing (no state, version, approval, audit or … | NL-12 | NL-47 | NL-47 AC-3 | planned: NL-47 AC-3 (filled `verified:` at §8) |
| CON-G2 | WF-14 | A refused call changes nothing (no state, version, approval, audit or … | NL-35 | NL-116 | NL-116 AC-3 | planned: NL-116 AC-3 (filled `verified:` at §8) |
| CON-G2 | WF-15 | A refused call changes nothing (no state, version, approval, audit or … | NL-27 | NL-53 | NL-53 AC-1 | planned: NL-53 AC-1 (filled `verified:` at §8) |
| CON-G2 | WF-16 | A refused call changes nothing (no state, version, approval, audit or … | NL-53 | NL-99 | NL-99 AC-3 | planned: NL-99 AC-3 (filled `verified:` at §8) |
| CON-G2 | WF-19 | A refused call changes nothing (no state, version, approval, audit or … | NL-42 | NL-102 | NL-102 AC-6 | planned: NL-102 AC-6 (filled `verified:` at §8) |
| CON-G2 | WF-20 | A refused call changes nothing (no state, version, approval, audit or … | NL-27 | NL-88 | NL-88 AC-4 | planned: NL-88 AC-4 (filled `verified:` at §8) |
| CON-G2 | WF-41 | A refused call changes nothing (no state, version, approval, audit or … | NL-26 | NL-105 | NL-105 AC-1 | planned: NL-105 AC-1 (filled `verified:` at §8) |
| CON-G3 | WF-9 | Lesson content is written only through the collaboration server; HTTP … | NL-101 | NL-101 | NL-101 AC-2 | planned: NL-101 AC-2 (filled `verified:` at §8) |
| CON-G3 | WF-11 | Lesson content is written only through the collaboration server; HTTP … | NL-45 | NL-45 | NL-45 AC-8 | planned: NL-45 AC-8 (filled `verified:` at §8) |
| CON-G3 | WF-12 | Lesson content is written only through the collaboration server; HTTP … | NL-46 | NL-46 | NL-46 AC-1 | planned: NL-46 AC-1 (filled `verified:` at §8) |
| CON-G3 | WF-13 | Lesson content is written only through the collaboration server; HTTP … | NL-47 | NL-114 | NL-114 AC-4 | planned: NL-114 AC-4 (filled `verified:` at §8) |
| CON-G3 | WF-14 | Lesson content is written only through the collaboration server; HTTP … | NL-50 | NL-116 | NL-116 AC-2 | planned: NL-116 AC-2 (filled `verified:` at §8) |
| CON-G3 | WF-41 | Lesson content is written only through the collaboration server; HTTP … | NL-105 | NL-105 | NL-105 AC-1 | planned: NL-105 AC-1 (filled `verified:` at §8) |
| CON-G4 | WF-1 | Every person's action is in the append-only audit log (who, when, from… | NL-12 | NL-25 | NL-25 AC-1 | planned: NL-25 AC-1 (filled `verified:` at §8) |
| CON-G4 | WF-2 | Every person's action is in the append-only audit log (who, when, from… | NL-12 | NL-26 | NL-26 AC-12 | planned: NL-26 AC-12 (filled `verified:` at §8) |
| CON-G4 | WF-3 | Every person's action is in the append-only audit log (who, when, from… | NL-26 | NL-77 | NL-77 AC-14 | planned: NL-77 AC-14 (filled `verified:` at §8) |
| CON-G4 | WF-4 | Every person's action is in the append-only audit log (who, when, from… | NL-26 | NL-105 | NL-105 AC-4 | planned: NL-105 AC-4 (filled `verified:` at §8) |
| CON-G4 | WF-6 | Every person's action is in the append-only audit log (who, when, from… | NL-26 | NL-78 | NL-78 AC-7 | planned: NL-78 AC-7 (filled `verified:` at §8) |
| CON-G4 | WF-11 | Every person's action is in the append-only audit log (who, when, from… | NL-12 | NL-45 | NL-45 AC-5 | planned: NL-45 AC-5 (filled `verified:` at §8) |
| CON-G4 | WF-15 | Every person's action is in the append-only audit log (who, when, from… | NL-42 | NL-53 | NL-53 AC-10 | planned: NL-53 AC-10 (filled `verified:` at §8) |
| CON-G4 | WF-19 | Every person's action is in the append-only audit log (who, when, from… | NL-12 | NL-51 | NL-51 AC-8 | planned: NL-51 AC-8 (filled `verified:` at §8) |
| CON-G4 | WF-20 | Every person's action is in the append-only audit log (who, when, from… | NL-88 | NL-88 | NL-88 AC-8 | planned: NL-88 AC-8 (filled `verified:` at §8) |
| CON-G5 | WF-5 | Reads never change state (opening is not starting a review) | NL-78 | NL-93 | NL-93 AC-7 | planned: NL-93 AC-7 (filled `verified:` at §8) |
| CON-G5 | WF-7 | Reads never change state (opening is not starting a review) | NL-54 | NL-54 | NL-54 AC-3 | planned: NL-54 AC-3 (filled `verified:` at §8) |
| CON-G5 | WF-8 | Reads never change state (opening is not starting a review) | NL-100 | NL-100 | NL-100 AC-3 | planned: NL-100 AC-3 (filled `verified:` at §8) |
| CON-G5 | WF-17 | Reads never change state (opening is not starting a review) | NL-78 | NL-97 | NL-97 AC-5 | planned: NL-97 AC-5 (filled `verified:` at §8) |
| CON-G5 | WF-18 | Reads never change state (opening is not starting a review) | NL-54 | NL-91 | NL-91 AC-4 | planned: NL-91 AC-4 (filled `verified:` at §8) |
| CON-G6 | WF-3 | Text from the outline or the model is returned as text, never as HTML | NL-17 | NL-77 | NL-77 AC-6 | planned: NL-77 AC-6 (filled `verified:` at §8) |
| CON-G6 | WF-5 | Text from the outline or the model is returned as text, never as HTML | NL-78 | NL-96 | NL-96 AC-9 | planned: NL-96 AC-9 (filled `verified:` at §8) |
| CON-G6 | WF-7 | Text from the outline or the model is returned as text, never as HTML | NL-98 | NL-98 | NL-98 AC-7 | planned: NL-98 AC-7 (filled `verified:` at §8) |
| CON-G6 | WF-8 | Text from the outline or the model is returned as text, never as HTML | NL-100 | NL-100 | NL-100 AC-6 | planned: NL-100 AC-6 (filled `verified:` at §8) |
| CON-G6 | WF-13 | Text from the outline or the model is returned as text, never as HTML | NL-114 | NL-114 | NL-114 AC-9 | planned: NL-114 AC-9 (filled `verified:` at §8) |
| CON-G6 | WF-14 | Text from the outline or the model is returned as text, never as HTML | NL-50 | NL-116 | NL-116 AC-6 | planned: NL-116 AC-6 (filled `verified:` at §8) |
| CON-G6 | WF-17 | Text from the outline or the model is returned as text, never as HTML | NL-78 | NL-97 | NL-97 AC-5 | planned: NL-97 AC-5 (filled `verified:` at §8) |
| CON-G6 | WF-18 | Text from the outline or the model is returned as text, never as HTML | NL-117 | NL-117 | NL-117 AC-5 | planned: NL-117 AC-5 (filled `verified:` at §8) |
| CON-G6 | WF-19 | Text from the outline or the model is returned as text, never as HTML | NL-102 | NL-102 | NL-102 AC-3 | planned: NL-102 AC-3 (filled `verified:` at §8) |
| CON-G7 | WF-15 | One lesson per call on every transition; no bulk approve | NL-115 | NL-115 | NL-115 AC-9 | planned: NL-115 AC-9 (filled `verified:` at §8) |
| CON-G8 | WF-1 | No route returns review minutes with a person's name | NL-48 | NL-48 | NL-48 AC-6 | planned: NL-48 AC-6 (filled `verified:` at §8) |
| CON-G8 | WF-2 | No route returns review minutes with a person's name | NL-93 | NL-93 | NL-93 AC-9 | planned: NL-93 AC-9 (filled `verified:` at §8) |
| CON-G8 | WF-3 | No route returns review minutes with a person's name | NL-94 | NL-94 | NL-94 AC-6 | planned: NL-94 AC-6 (filled `verified:` at §8) |
| CON-G8 | WF-7 | No route returns review minutes with a person's name | NL-42 | NL-54 | NL-54 AC-9 | planned: NL-54 AC-9 (filled `verified:` at §8) |
| CON-G8 | WF-8 | No route returns review minutes with a person's name | NL-100 | NL-100 | NL-100 AC-6 | planned: NL-100 AC-6 (filled `verified:` at §8) |
| CON-G8 | WF-15 | No route returns review minutes with a person's name | NL-99 | NL-115 | NL-115 AC-11 | planned: NL-115 AC-11 (filled `verified:` at §8) |
| CON-G8 | WF-16 | No route returns review minutes with a person's name | NL-54 | NL-99 | NL-99 AC-4 | planned: NL-99 AC-4 (filled `verified:` at §8) |
| CON-G8 | WF-17 | No route returns review minutes with a person's name | NL-97 | NL-97 | NL-97 AC-6 | planned: NL-97 AC-6 (filled `verified:` at §8) |
| CON-G8 | WF-18 | No route returns review minutes with a person's name | NL-54 | NL-91 | NL-91 AC-7 | planned: NL-91 AC-7 (filled `verified:` at §8) |
| SCR-1 | WF-1 | Sign in screen built to its signed spec, with every listed state reach… | NL-24 | NL-90 | NL-90 AC-1 | planned: NL-90 AC-1 (filled `verified:` at §8) |
| SCR-2 | WF-2 | Units home screen built to its signed spec, with every listed state re… | NL-55 | NL-93 | NL-93 AC-1 | planned: NL-93 AC-1 (filled `verified:` at §8) |
| SCR-2 | WF-5 | Units home screen built to its signed spec, with every listed state re… | NL-55 | NL-93 | NL-93 AC-7 | planned: NL-93 AC-7 (filled `verified:` at §8) |
| SCR-3 | WF-2 | Upload outline screen built to its signed spec, with every listed stat… | NL-56 | NL-93 | NL-93 AC-1 | planned: NL-93 AC-1 (filled `verified:` at §8) |
| SCR-4 | WF-3 | Validation report screen built to its signed spec, with every listed s… | NL-57 | NL-94 | NL-94 AC-1 | planned: NL-94 AC-1 (filled `verified:` at §8) |
| SCR-4 | WF-4 | Validation report screen built to its signed spec, with every listed s… | NL-95 | NL-95 | NL-95 AC-3 | planned: NL-95 AC-3 (filled `verified:` at §8) |
| SCR-5 | WF-4 | Start run (dialog) screen built to its signed spec, with every listed … | NL-58 | NL-95 | NL-95 AC-1 | planned: NL-95 AC-1 (filled `verified:` at §8) |
| SCR-6 | WF-5 | Generation progress screen built to its signed spec, with every listed… | NL-59 | NL-96 | NL-96 AC-1 | planned: NL-96 AC-1 (filled `verified:` at §8) |
| SCR-6 | WF-6 | Generation progress screen built to its signed spec, with every listed… | NL-59 | NL-96 | NL-96 AC-5 | planned: NL-96 AC-5 (filled `verified:` at §8) |
| SCR-7 | WF-5 | Unit plan screen built to its signed spec, with every listed state rea… | NL-60 | NL-96 | NL-96 AC-10 | planned: NL-96 AC-10 (filled `verified:` at §8) |
| SCR-8 | WF-7 | Unit board screen built to its signed spec, with every listed state re… | NL-61 | NL-98 | NL-98 AC-1 | planned: NL-98 AC-1 (filled `verified:` at §8) |
| SCR-9 | WF-8 | Lesson workspace screen built to its signed spec, with every listed st… | NL-62 | NL-100 | NL-100 AC-2 | planned: NL-100 AC-2 (filled `verified:` at §8) |
| SCR-9 | WF-9 | Lesson workspace screen built to its signed spec, with every listed st… | NL-63 | NL-101 | NL-101 AC-1 | planned: NL-101 AC-1 (filled `verified:` at §8) |
| SCR-9 | WF-16 | Lesson workspace screen built to its signed spec, with every listed st… | NL-64 | NL-99 | NL-99 AC-2 | planned: NL-99 AC-2 (filled `verified:` at §8) |
| SCR-11 | WF-11 | Resolve or clear (dialog) screen built to its signed spec, with every … | NL-66 | NL-113 | NL-113 AC-4 | planned: NL-113 AC-4 (filled `verified:` at §8) |
| SCR-14 | WF-16 | Approval review screen built to its signed spec, with every listed sta… | NL-68 | NL-99 | NL-99 AC-2 | planned: NL-99 AC-2 (filled `verified:` at §8) |
| SCR-16 | WF-8 | History and provenance screen built to its signed spec, with every lis… | NL-70 | NL-100 | NL-100 AC-7 | planned: NL-100 AC-7 (filled `verified:` at §8) |
| SCR-17 | WF-17 | Run summary screen built to its signed spec, with every listed state r… | NL-71 | NL-97 | NL-97 AC-1 | planned: NL-97 AC-1 (filled `verified:` at §8) |
| SCR-18 | WF-18 | Coverage matrix screen built to its signed spec, with every listed sta… | NL-73 | NL-117 | NL-117 AC-2 | planned: NL-117 AC-2 (filled `verified:` at §8) |
| SCR-19 | WF-7 | Unit quality screen built to its signed spec, with every listed state … | NL-74 | NL-104 | NL-104 AC-1 | planned: NL-104 AC-1 (filled `verified:` at §8) |
| SCR-20 | WF-19 | Export screen built to its signed spec, with every listed state reacha… | NL-75 | NL-102 | NL-102 AC-1 | planned: NL-102 AC-1 (filled `verified:` at §8) |
| SCR-21 | WF-20 | Prompt guidance screen built to its signed spec, with every listed sta… | NL-76 | NL-103 | NL-103 AC-1 | planned: NL-103 AC-1 (filled `verified:` at §8) |
| EV-S1 | WF-2 | S1 intake golden: 100% of expected fields on the issued sheet, SYN-2 a… | NL-16 | NL-16 | NL-16 AC-3 | planned: NL-16 AC-3 (filled `verified:` at §8) |
| EV-S1 | WF-24 | S1 intake golden: 100% of expected fields on the issued sheet, SYN-2 a… | NL-16 | NL-84 | NL-84 AC-1 | planned: NL-84 AC-1 (filled `verified:` at §8) |
| EV-S2 | WF-10 | S2 check golden: every blocking rule fires on its fixture and the clea… | NL-39 | NL-39 | NL-39 AC-1 | planned: NL-39 AC-1 (filled `verified:` at §8) |
| EV-S2 | WF-24 | S2 check golden: every blocking rule fires on its fixture and the clea… | NL-39 | NL-85 | NL-85 AC-1 | planned: NL-85 AC-1 (filled `verified:` at §8) |
| EV-S3 | WF-21 | S3 draft golden: required blocks and section timing on WP-1…WP-3 in 3 … | NL-29 | NL-79 | NL-79 AC-1 | planned: NL-79 AC-1 (filled `verified:` at §8) |
| EV-S3 | WF-22 | S3 draft golden: required blocks and section timing on WP-1…WP-3 in 3 … | NL-29 | NL-29 | NL-29 AC-2 | planned: NL-29 AC-2 (filled `verified:` at §8) |
| EV-S3 | WF-24 | S3 draft golden: required blocks and section timing on WP-1…WP-3 in 3 … | NL-79 | NL-109 | NL-109 AC-1 | planned: NL-109 AC-1 (filled `verified:` at §8) |
| EV-S4 | WF-10 | S4 grounding plants: 11 of 11 code-detectable plants (floor 1.00), ≤ 1… | NL-40 | NL-40 | NL-40 AC-1 | planned: NL-40 AC-1 (filled `verified:` at §8) |
| EV-S4 | WF-42 | S4 grounding plants: 11 of 11 code-detectable plants (floor 1.00), ≤ 1… | NL-40 | NL-85 | NL-85 AC-4 | planned: NL-85 AC-4 (filled `verified:` at §8) |
| EV-S5 | WF-9 | S5 integrity invariants: 20 of 20 trials per assertion (stale approve … | NL-101 | NL-101 | NL-101 AC-6 | planned: NL-101 AC-6 (filled `verified:` at §8) |
| EV-S5 | WF-15 | S5 integrity invariants: 20 of 20 trials per assertion (stale approve … | NL-115 | NL-115 | NL-115 AC-3 | planned: NL-115 AC-3 (filled `verified:` at §8) |
| EV-S5 | WF-43 | S5 integrity invariants: 20 of 20 trials per assertion (stale approve … | NL-101 | NL-125 | NL-125 AC-1 | planned: NL-125 AC-1 (filled `verified:` at §8) |
| EV-S6 | WF-22 | S6 long-job faults: 47/47 terminal, zero duplicate versions, zero re-p… | NL-30 | NL-30 | NL-30 AC-2 | planned: NL-30 AC-2 (filled `verified:` at §8) |
| EV-S6 | WF-28 | S6 long-job faults: 47/47 terminal, zero duplicate versions, zero re-p… | NL-30 | NL-30 | NL-30 AC-8 | planned: NL-30 AC-8 (filled `verified:` at §8) |
| EV-S7 | WF-2 | S7 safety notes: WP-4 4 of 4 (floor 1.00); ≤ 1 false proposal on the i… | NL-16 | NL-16 | NL-16 AC-8 | planned: NL-16 AC-8 (filled `verified:` at §8) |
| EV-S7 | WF-11 | S7 safety notes: WP-4 4 of 4 (floor 1.00); ≤ 1 false proposal on the i… | NL-45 | NL-45 | NL-45 AC-6 | planned: NL-45 AC-6 (filled `verified:` at §8) |
| EV-S7 | WF-24 | S7 safety notes: WP-4 4 of 4 (floor 1.00); ≤ 1 false proposal on the i… | NL-16 | NL-84 | NL-84 AC-4 | planned: NL-84 AC-4 (filled `verified:` at §8) |
| EV-S8 | WF-16 | S8 measurement: scripted ±1 min, stopwatch ±15%, idle tab ≤ 1 min, two… | NL-48 | NL-48 | NL-48 AC-2 | planned: NL-48 AC-2 (filled `verified:` at §8) |
| EV-S9 | WF-17 | S9 full run: report with *n* = 47 before the video; first-pass schema-… | NL-97 | NL-97 | NL-97 AC-7 | planned: NL-97 AC-7 (filled `verified:` at §8) |
| EV-S9 | WF-25 | S9 full run: report with *n* = 47 before the video; first-pass schema-… | NL-86 | NL-86 | NL-86 AC-4 | planned: NL-86 AC-4 (filled `verified:` at §8) |
| EV-S10 | WF-26 | S10 seeded-error run: ≥ 90% caught before approval, the wrong-code pla… | NL-92 | NL-92 | NL-92 AC-1 | planned: NL-92 AC-1 (filled `verified:` at §8) |
| EV-S11 | WF-27 | S11 held-out comparison: counts only, stored outside tracked files *(c… | NL-121 | NL-121 | NL-121 AC-1 | planned: NL-121 AC-1 (filled `verified:` at §8) |
| EV-S12 | WF-23 | S12 judge calibration: agreement ≥ 0.8 on ≥ 20 labels, confirmed on th… | NL-110 | NL-110 | NL-110 AC-3 | planned: NL-110 AC-3 (filled `verified:` at §8) |
| EV-S12 | WF-31 | S12 judge calibration: agreement ≥ 0.8 on ≥ 20 labels, confirmed on th… | NL-111 | NL-111 | NL-111 AC-1 | planned: NL-111 AC-1 (filled `verified:` at §8) |
| EV-S13 | WF-15 | S13 draft quality: 100% of approved lessons rated; ≥ 2 of 3 demo lesso… | NL-123 | NL-123 | NL-123 AC-4 | planned: NL-123 AC-4 (filled `verified:` at §8) |
| EV-S14 | WF-29 | S14 capacity spike at 200 users: open p95 < 1.5 s, poll p95 < 300 ms, … | NL-118 | NL-118 | NL-118 AC-1 | planned: NL-118 AC-1 (filled `verified:` at §8) |
| EV-S14 | WF-30 | S14 capacity spike at 200 users: open p95 < 1.5 s, poll p95 < 300 ms, … | NL-119 | NL-119 | NL-119 AC-1 | planned: NL-119 AC-1 (filled `verified:` at §8) |
| EV-R1 | WF-24 | Every eval, probe and suite report names the git SHA, prompt version, … | NL-49 | NL-49 | NL-49 AC-1 | planned: NL-49 AC-1 (filled `verified:` at §8) |
| EV-R1 | WF-25 | Every eval, probe and suite report names the git SHA, prompt version, … | NL-49 | NL-86 | NL-86 AC-6 | planned: NL-86 AC-6 (filled `verified:` at §8) |
| EV-R1 | WF-26 | Every eval, probe and suite report names the git SHA, prompt version, … | NL-49 | NL-92 | NL-92 AC-5 | planned: NL-92 AC-5 (filled `verified:` at §8) |
| EV-R1 | WF-27 | Every eval, probe and suite report names the git SHA, prompt version, … | NL-49 | NL-121 | NL-121 AC-7 | planned: NL-121 AC-7 (filled `verified:` at §8) |
| EV-R1 | WF-28 | Every eval, probe and suite report names the git SHA, prompt version, … | NL-49 | NL-107 | NL-107 AC-7 | planned: NL-107 AC-7 (filled `verified:` at §8) |
| EV-R1 | WF-29 | Every eval, probe and suite report names the git SHA, prompt version, … | NL-49 | NL-118 | NL-118 AC-3 | planned: NL-118 AC-3 (filled `verified:` at §8) |
| EV-R1 | WF-31 | Every eval, probe and suite report names the git SHA, prompt version, … | NL-49 | NL-111 | NL-111 AC-6 | planned: NL-111 AC-6 (filled `verified:` at §8) |
| EV-R1 | WF-42 | Every eval, probe and suite report names the git SHA, prompt version, … | NL-49 | NL-85 | NL-85 AC-7 | planned: NL-85 AC-7 (filled `verified:` at §8) |
| EV-R1 | WF-43 | Every eval, probe and suite report names the git SHA, prompt version, … | NL-49 | NL-125 | NL-125 AC-8 | planned: NL-125 AC-8 (filled `verified:` at §8) |
| EV-R2 | WF-20 | A change to a prompt, model, schema or check attaches the S2/S3 report… | NL-103 | NL-103 | NL-103 AC-7 | planned: NL-103 AC-7 (filled `verified:` at §8) |
| EV-R3 | WF-24 | The golden tier runs in the merge gate whenever generation, checks or … | NL-49 | NL-49 | NL-49 AC-2 | planned: NL-49 AC-2 (filled `verified:` at §8) |
| OBS-1 | WF-1 | Each workflow's capture-verification test drives its real entry point,… | NL-25 | NL-25 | NL-25 AC-12 | planned: NL-25 AC-12 (filled `verified:` at §8) |
| OBS-1 | WF-2 | Each workflow's capture-verification test drives its real entry point,… | NL-26 | NL-26 | NL-26 AC-12 | planned: NL-26 AC-12 (filled `verified:` at §8) |
| OBS-1 | WF-3 | Each workflow's capture-verification test drives its real entry point,… | NL-08 | NL-08 | NL-08 AC-2 | planned: NL-08 AC-2 (filled `verified:` at §8) |
| OBS-1 | WF-4 | Each workflow's capture-verification test drives its real entry point,… | NL-27 | NL-27 | NL-27 AC-12 | planned: NL-27 AC-12 (filled `verified:` at §8) |
| OBS-1 | WF-5 | Each workflow's capture-verification test drives its real entry point,… | NL-26 | NL-78 | NL-78 AC-14 | planned: NL-78 AC-14 (filled `verified:` at §8) |
| OBS-1 | WF-7 | Each workflow's capture-verification test drives its real entry point,… | NL-37 | NL-54 | NL-54 AC-12 | planned: NL-54 AC-12 (filled `verified:` at §8) |
| OBS-1 | WF-8 | Each workflow's capture-verification test drives its real entry point,… | NL-44 | NL-44 | NL-44 AC-9 | planned: NL-44 AC-9 (filled `verified:` at §8) |
| OBS-1 | WF-9 | Each workflow's capture-verification test drives its real entry point,… | NL-36 | NL-36 | NL-36 AC-12 | planned: NL-36 AC-12 (filled `verified:` at §8) |
| OBS-1 | WF-10 | Each workflow's capture-verification test drives its real entry point,… | NL-37 | NL-37 | NL-37 AC-11 | planned: NL-37 AC-11 (filled `verified:` at §8) |
| OBS-1 | WF-11 | Each workflow's capture-verification test drives its real entry point,… | NL-45 | NL-45 | NL-45 AC-11 | planned: NL-45 AC-11 (filled `verified:` at §8) |
| OBS-1 | WF-12 | Each workflow's capture-verification test drives its real entry point,… | NL-46 | NL-46 | NL-46 AC-7 | planned: NL-46 AC-7 (filled `verified:` at §8) |
| OBS-1 | WF-13 | Each workflow's capture-verification test drives its real entry point,… | NL-47 | NL-47 | NL-47 AC-8 | planned: NL-47 AC-8 (filled `verified:` at §8) |
| OBS-1 | WF-14 | Each workflow's capture-verification test drives its real entry point,… | NL-50 | NL-50 | NL-50 AC-8 | planned: NL-50 AC-8 (filled `verified:` at §8) |
| OBS-1 | WF-15 | Each workflow's capture-verification test drives its real entry point,… | NL-27 | NL-53 | NL-53 AC-17 | planned: NL-53 AC-17 (filled `verified:` at §8) |
| OBS-1 | WF-16 | Each workflow's capture-verification test drives its real entry point,… | NL-48 | NL-48 | NL-48 AC-7 | planned: NL-48 AC-7 (filled `verified:` at §8) |
| OBS-1 | WF-18 | Each workflow's capture-verification test drives its real entry point,… | NL-54 | NL-91 | NL-91 AC-9 | planned: NL-91 AC-9 (filled `verified:` at §8) |
| OBS-1 | WF-19 | Each workflow's capture-verification test drives its real entry point,… | NL-51 | NL-51 | NL-51 AC-8 | planned: NL-51 AC-8 (filled `verified:` at §8) |
| OBS-1 | WF-20 | Each workflow's capture-verification test drives its real entry point,… | NL-27 | NL-88 | NL-88 AC-10 | planned: NL-88 AC-10 (filled `verified:` at §8) |
| OBS-1 | WF-21 | Each workflow's capture-verification test drives its real entry point,… | NL-31 | NL-31 | NL-31 AC-9 | planned: NL-31 AC-9 (filled `verified:` at §8) |
| OBS-1 | WF-22 | Each workflow's capture-verification test drives its real entry point,… | NL-29 | NL-29 | NL-29 AC-13 | planned: NL-29 AC-13 (filled `verified:` at §8) |
| OBS-1 | WF-23 | Each workflow's capture-verification test drives its real entry point,… | NL-33 | NL-89 | NL-89 AC-9 | planned: NL-89 AC-9 (filled `verified:` at §8) |
| OBS-1 | WF-24 | Each workflow's capture-verification test drives its real entry point,… | NL-49 | NL-49 | NL-49 AC-8 | planned: NL-49 AC-8 (filled `verified:` at §8) |
| OBS-1 | WF-25 | Each workflow's capture-verification test drives its real entry point,… | NL-49 | NL-86 | NL-86 AC-9 | planned: NL-86 AC-9 (filled `verified:` at §8) |
| OBS-1 | WF-26 | Each workflow's capture-verification test drives its real entry point,… | NL-49 | NL-92 | NL-92 AC-8 | planned: NL-92 AC-8 (filled `verified:` at §8) |
| OBS-1 | WF-27 | Each workflow's capture-verification test drives its real entry point,… | NL-49 | NL-121 | NL-121 AC-7 | planned: NL-121 AC-7 (filled `verified:` at §8) |
| OBS-1 | WF-28 | Each workflow's capture-verification test drives its real entry point,… | NL-49 | NL-107 | NL-107 AC-7 | planned: NL-107 AC-7 (filled `verified:` at §8) |
| OBS-1 | WF-29 | Each workflow's capture-verification test drives its real entry point,… | NL-49 | NL-118 | NL-118 AC-7 | planned: NL-118 AC-7 (filled `verified:` at §8) |
| OBS-1 | WF-30 | Each workflow's capture-verification test drives its real entry point,… | NL-49 | NL-119 | NL-119 AC-6 | planned: NL-119 AC-6 (filled `verified:` at §8) |
| OBS-1 | WF-31 | Each workflow's capture-verification test drives its real entry point,… | NL-49 | NL-111 | NL-111 AC-9 | planned: NL-111 AC-9 (filled `verified:` at §8) |
| OBS-1 | WF-32 | Each workflow's capture-verification test drives its real entry point,… | NL-49 | NL-87 | NL-87 AC-8 | planned: NL-87 AC-8 (filled `verified:` at §8) |
| OBS-1 | WF-35 | Each workflow's capture-verification test drives its real entry point,… | NL-08 | NL-83 | NL-83 AC-10 | planned: NL-83 AC-10 (filled `verified:` at §8) |
| OBS-1 | WF-36 | Each workflow's capture-verification test drives its real entry point,… | NL-08 | NL-23 | NL-23 AC-6 | planned: NL-23 AC-6 (filled `verified:` at §8) |
| OBS-1 | WF-37 | Each workflow's capture-verification test drives its real entry point,… | NL-08 | NL-82 | NL-82 AC-9 | planned: NL-82 AC-9 (filled `verified:` at §8) |
| OBS-1 | WF-41 | Each workflow's capture-verification test drives its real entry point,… | NL-26 | NL-105 | NL-105 AC-13 | planned: NL-105 AC-13 (filled `verified:` at §8) |
| OBS-1 | WF-42 | Each workflow's capture-verification test drives its real entry point,… | NL-49 | NL-85 | NL-85 AC-6 | planned: NL-85 AC-6 (filled `verified:` at §8) |
| OBS-1 | WF-43 | Each workflow's capture-verification test drives its real entry point,… | NL-49 | NL-125 | NL-125 AC-8 | planned: NL-125 AC-8 (filled `verified:` at §8) |
| OBS-1 | WF-46 | Each workflow's capture-verification test drives its real entry point,… | NL-108 | NL-108 | NL-108 AC-1 | planned: NL-108 AC-1 (filled `verified:` at §8) |
| OBS-2 | WF-4 | `run_id` is minted at run creation and carried on every job, model cal… | NL-27 | NL-27 | NL-27 AC-12 | planned: NL-27 AC-12 (filled `verified:` at §8) |
| OBS-2 | WF-5 | `run_id` is minted at run creation and carried on every job, model cal… | NL-27 | NL-78 | NL-78 AC-14 | planned: NL-78 AC-14 (filled `verified:` at §8) |
| OBS-2 | WF-6 | `run_id` is minted at run creation and carried on every job, model cal… | NL-28 | NL-28 | NL-28 AC-12 | planned: NL-28 AC-12 (filled `verified:` at §8) |
| OBS-2 | WF-13 | `run_id` is minted at run creation and carried on every job, model cal… | NL-47 | NL-47 | NL-47 AC-8 | planned: NL-47 AC-8 (filled `verified:` at §8) |
| OBS-2 | WF-20 | `run_id` is minted at run creation and carried on every job, model cal… | NL-27 | NL-88 | NL-88 AC-10 | planned: NL-88 AC-10 (filled `verified:` at §8) |
| OBS-2 | WF-21 | `run_id` is minted at run creation and carried on every job, model cal… | NL-31 | NL-31 | NL-31 AC-9 | planned: NL-31 AC-9 (filled `verified:` at §8) |
| OBS-2 | WF-22 | `run_id` is minted at run creation and carried on every job, model cal… | NL-29 | NL-29 | NL-29 AC-13 | planned: NL-29 AC-13 (filled `verified:` at §8) |
| OBS-2 | WF-23 | `run_id` is minted at run creation and carried on every job, model cal… | NL-79 | NL-110 | NL-110 AC-7 | planned: NL-110 AC-7 (filled `verified:` at §8) |
| OBS-2 | WF-25 | `run_id` is minted at run creation and carried on every job, model cal… | NL-86 | NL-86 | NL-86 AC-9 | planned: NL-86 AC-9 (filled `verified:` at §8) |
| OBS-2 | WF-28 | `run_id` is minted at run creation and carried on every job, model cal… | NL-35 | NL-35 | NL-35 AC-15 | planned: NL-35 AC-15 (filled `verified:` at §8) |
| OBS-3 | WF-1 | A `request_id` per HTTP request on every log line and audit event, ret… | NL-13 | NL-25 | NL-25 AC-12 | planned: NL-25 AC-12 (filled `verified:` at §8) |
| OBS-3 | WF-2 | A `request_id` per HTTP request on every log line and audit event, ret… | NL-13 | NL-26 | NL-26 AC-12 | planned: NL-26 AC-12 (filled `verified:` at §8) |
| OBS-3 | WF-3 | A `request_id` per HTTP request on every log line and audit event, ret… | NL-26 | NL-77 | NL-77 AC-14 | planned: NL-77 AC-14 (filled `verified:` at §8) |
| OBS-3 | WF-4 | A `request_id` per HTTP request on every log line and audit event, ret… | NL-13 | NL-27 | NL-27 AC-12 | planned: NL-27 AC-12 (filled `verified:` at §8) |
| OBS-3 | WF-5 | A `request_id` per HTTP request on every log line and audit event, ret… | NL-26 | NL-78 | NL-78 AC-14 | planned: NL-78 AC-14 (filled `verified:` at §8) |
| OBS-3 | WF-7 | A `request_id` per HTTP request on every log line and audit event, ret… | NL-54 | NL-54 | NL-54 AC-12 | planned: NL-54 AC-12 (filled `verified:` at §8) |
| OBS-3 | WF-8 | A `request_id` per HTTP request on every log line and audit event, ret… | NL-13 | NL-44 | NL-44 AC-9 | planned: NL-44 AC-9 (filled `verified:` at §8) |
| OBS-3 | WF-11 | A `request_id` per HTTP request on every log line and audit event, ret… | NL-13 | NL-45 | NL-45 AC-11 | planned: NL-45 AC-11 (filled `verified:` at §8) |
| OBS-3 | WF-12 | A `request_id` per HTTP request on every log line and audit event, ret… | NL-45 | NL-113 | NL-113 AC-11 | planned: NL-113 AC-11 (filled `verified:` at §8) |
| OBS-3 | WF-13 | A `request_id` per HTTP request on every log line and audit event, ret… | NL-53 | NL-114 | NL-114 AC-8 | planned: NL-114 AC-8 (filled `verified:` at §8) |
| OBS-3 | WF-14 | A `request_id` per HTTP request on every log line and audit event, ret… | NL-33 | NL-116 | NL-116 AC-9 | planned: NL-116 AC-9 (filled `verified:` at §8) |
| OBS-3 | WF-15 | A `request_id` per HTTP request on every log line and audit event, ret… | NL-27 | NL-53 | NL-53 AC-17 | planned: NL-53 AC-17 (filled `verified:` at §8) |
| OBS-3 | WF-16 | A `request_id` per HTTP request on every log line and audit event, ret… | NL-115 | NL-123 | NL-123 AC-7 | planned: NL-123 AC-7 (filled `verified:` at §8) |
| OBS-3 | WF-17 | A `request_id` per HTTP request on every log line and audit event, ret… | NL-78 | NL-97 | NL-97 AC-7 | planned: NL-97 AC-7 (filled `verified:` at §8) |
| OBS-3 | WF-18 | A `request_id` per HTTP request on every log line and audit event, ret… | NL-54 | NL-91 | NL-91 AC-9 | planned: NL-91 AC-9 (filled `verified:` at §8) |
| OBS-3 | WF-20 | A `request_id` per HTTP request on every log line and audit event, ret… | NL-27 | NL-88 | NL-88 AC-10 | planned: NL-88 AC-10 (filled `verified:` at §8) |
| OBS-3 | WF-41 | A `request_id` per HTTP request on every log line and audit event, ret… | NL-26 | NL-105 | NL-105 AC-13 | planned: NL-105 AC-13 (filled `verified:` at §8) |
| OBS-4 | WF-9 | Every durable store mints a `store_id` on `lesson_doc`, `check_job` an… | NL-36 | NL-36 | NL-36 AC-1 | planned: NL-36 AC-1 (filled `verified:` at §8) |
| OBS-4 | WF-10 | Every durable store mints a `store_id` on `lesson_doc`, `check_job` an… | NL-37 | NL-37 | NL-37 AC-1 | planned: NL-37 AC-1 (filled `verified:` at §8) |
| OBS-4 | WF-11 | Every durable store mints a `store_id` on `lesson_doc`, `check_job` an… | NL-46 | NL-113 | NL-113 AC-11 | planned: NL-113 AC-11 (filled `verified:` at §8) |
| OBS-4 | WF-12 | Every durable store mints a `store_id` on `lesson_doc`, `check_job` an… | NL-46 | NL-46 | NL-46 AC-7 | planned: NL-46 AC-7 (filled `verified:` at §8) |
| OBS-4 | WF-41 | Every durable store mints a `store_id` on `lesson_doc`, `check_job` an… | NL-43 | NL-105 | NL-105 AC-13 | planned: NL-105 AC-13 (filled `verified:` at §8) |
| OBS-5 | WF-13 | Every model call's row is written before the call (rendered prompt) an… | NL-79 | NL-114 | NL-114 AC-8 | planned: NL-114 AC-8 (filled `verified:` at §8) |
| OBS-5 | WF-14 | Every model call's row is written before the call (rendered prompt) an… | NL-14 | NL-50 | NL-50 AC-8 | planned: NL-50 AC-8 (filled `verified:` at §8) |
| OBS-5 | WF-20 | Every model call's row is written before the call (rendered prompt) an… | NL-79 | NL-103 | NL-103 AC-1 | planned: NL-103 AC-1 (filled `verified:` at §8) |
| OBS-5 | WF-21 | Every model call's row is written before the call (rendered prompt) an… | NL-14 | NL-31 | NL-31 AC-1 | planned: NL-31 AC-1 (filled `verified:` at §8) |
| OBS-5 | WF-22 | Every model call's row is written before the call (rendered prompt) an… | NL-14 | NL-14 | NL-14 AC-6 | planned: NL-14 AC-6 (filled `verified:` at §8) |
| OBS-5 | WF-23 | Every model call's row is written before the call (rendered prompt) an… | NL-14 | NL-89 | NL-89 AC-3 | planned: NL-89 AC-3 (filled `verified:` at §8) |
| OBS-5 | WF-25 | Every model call's row is written before the call (rendered prompt) an… | NL-79 | NL-112 | NL-112 AC-6 | planned: NL-112 AC-6 (filled `verified:` at §8) |
| OBS-5 | WF-32 | Every model call's row is written before the call (rendered prompt) an… | NL-87 | NL-87 | NL-87 AC-1 | planned: NL-87 AC-1 (filled `verified:` at §8) |
| OBS-6 | WF-24 | Every eval, probe and spike run mints its own id and stores its config… | NL-49 | NL-49 | NL-49 AC-1 | planned: NL-49 AC-1 (filled `verified:` at §8) |
| OBS-6 | WF-25 | Every eval, probe and spike run mints its own id and stores its config… | NL-49 | NL-86 | NL-86 AC-6 | planned: NL-86 AC-6 (filled `verified:` at §8) |
| OBS-6 | WF-26 | Every eval, probe and spike run mints its own id and stores its config… | NL-49 | NL-92 | NL-92 AC-5 | planned: NL-92 AC-5 (filled `verified:` at §8) |
| OBS-6 | WF-27 | Every eval, probe and spike run mints its own id and stores its config… | NL-49 | NL-121 | NL-121 AC-7 | planned: NL-121 AC-7 (filled `verified:` at §8) |
| OBS-6 | WF-28 | Every eval, probe and spike run mints its own id and stores its config… | NL-49 | NL-107 | NL-107 AC-7 | planned: NL-107 AC-7 (filled `verified:` at §8) |
| OBS-6 | WF-29 | Every eval, probe and spike run mints its own id and stores its config… | NL-49 | NL-118 | NL-118 AC-3 | planned: NL-118 AC-3 (filled `verified:` at §8) |
| OBS-6 | WF-30 | Every eval, probe and spike run mints its own id and stores its config… | NL-49 | NL-119 | NL-119 AC-6 | planned: NL-119 AC-6 (filled `verified:` at §8) |
| OBS-6 | WF-31 | Every eval, probe and spike run mints its own id and stores its config… | NL-49 | NL-111 | NL-111 AC-6 | planned: NL-111 AC-6 (filled `verified:` at §8) |
| OBS-6 | WF-32 | Every eval, probe and spike run mints its own id and stores its config… | NL-49 | NL-87 | NL-87 AC-1 | planned: NL-87 AC-1 (filled `verified:` at §8) |
| OBS-6 | WF-33 | Every eval, probe and spike run mints its own id and stores its config… | NL-49 | NL-87 | NL-87 AC-2 | planned: NL-87 AC-2 (filled `verified:` at §8) |
| OBS-6 | WF-34 | Every eval, probe and spike run mints its own id and stores its config… | NL-49 | NL-87 | NL-87 AC-3 | planned: NL-87 AC-3 (filled `verified:` at §8) |
| OBS-6 | WF-42 | Every eval, probe and spike run mints its own id and stores its config… | NL-49 | NL-85 | NL-85 AC-7 | planned: NL-85 AC-7 (filled `verified:` at §8) |
| OBS-6 | WF-43 | Every eval, probe and spike run mints its own id and stores its config… | NL-49 | NL-125 | NL-125 AC-8 | planned: NL-125 AC-8 (filled `verified:` at §8) |
| OBS-7 | WF-1 | Never recorded anywhere: restricted-folder content, provider keys, pas… | NL-01 | NL-08 | NL-08 AC-7 | planned: NL-08 AC-7 (filled `verified:` at §8) |
| OBS-7 | WF-2 | Never recorded anywhere: restricted-folder content, provider keys, pas… | NL-12 | NL-29 | NL-29 AC-13 | planned: NL-29 AC-13 (filled `verified:` at §8) |
| OBS-7 | WF-3 | Never recorded anywhere: restricted-folder content, provider keys, pas… | NL-26 | NL-77 | NL-77 AC-6 | planned: NL-77 AC-6 (filled `verified:` at §8) |
| OBS-7 | WF-4 | Never recorded anywhere: restricted-folder content, provider keys, pas… | NL-06 | NL-83 | NL-83 AC-6 | planned: NL-83 AC-6 (filled `verified:` at §8) |
| OBS-7 | WF-7 | Never recorded anywhere: restricted-folder content, provider keys, pas… | NL-48 | NL-54 | NL-54 AC-9 | planned: NL-54 AC-9 (filled `verified:` at §8) |
| OBS-7 | WF-9 | Never recorded anywhere: restricted-folder content, provider keys, pas… | NL-25 | NL-80 | NL-80 AC-10 | planned: NL-80 AC-10 (filled `verified:` at §8) |
| OBS-7 | WF-10 | Never recorded anywhere: restricted-folder content, provider keys, pas… | NL-26 | NL-81 | NL-81 AC-10 | planned: NL-81 AC-10 (filled `verified:` at §8) |
| OBS-7 | WF-11 | Never recorded anywhere: restricted-folder content, provider keys, pas… | NL-53 | NL-113 | NL-113 AC-11 | planned: NL-113 AC-11 (filled `verified:` at §8) |
| OBS-7 | WF-14 | Never recorded anywhere: restricted-folder content, provider keys, pas… | NL-32 | NL-116 | NL-116 AC-8 | planned: NL-116 AC-8 (filled `verified:` at §8) |
| OBS-7 | WF-15 | Never recorded anywhere: restricted-folder content, provider keys, pas… | NL-36 | NL-53 | NL-53 AC-16 | planned: NL-53 AC-16 (filled `verified:` at §8) |
| OBS-7 | WF-16 | Never recorded anywhere: restricted-folder content, provider keys, pas… | NL-12 | NL-48 | NL-48 AC-6 | planned: NL-48 AC-6 (filled `verified:` at §8) |
| OBS-7 | WF-18 | Never recorded anywhere: restricted-folder content, provider keys, pas… | NL-54 | NL-91 | NL-91 AC-7 | planned: NL-91 AC-7 (filled `verified:` at §8) |
| OBS-7 | WF-22 | Never recorded anywhere: restricted-folder content, provider keys, pas… | NL-12 | NL-33 | NL-33 AC-9 | planned: NL-33 AC-9 (filled `verified:` at §8) |
| OBS-7 | WF-23 | Never recorded anywhere: restricted-folder content, provider keys, pas… | NL-12 | NL-89 | NL-89 AC-2 | planned: NL-89 AC-2 (filled `verified:` at §8) |
| OBS-7 | WF-26 | Never recorded anywhere: restricted-folder content, provider keys, pas… | NL-49 | NL-92 | NL-92 AC-2 | planned: NL-92 AC-2 (filled `verified:` at §8) |
| OBS-7 | WF-27 | Never recorded anywhere: restricted-folder content, provider keys, pas… | NL-49 | NL-121 | NL-121 AC-1 | planned: NL-121 AC-1 (filled `verified:` at §8) |
| OBS-7 | WF-29 | Never recorded anywhere: restricted-folder content, provider keys, pas… | NL-49 | NL-118 | NL-118 AC-4 | planned: NL-118 AC-4 (filled `verified:` at §8) |
| OBS-7 | WF-30 | Never recorded anywhere: restricted-folder content, provider keys, pas… | NL-49 | NL-119 | NL-119 AC-4 | planned: NL-119 AC-4 (filled `verified:` at §8) |
| OBS-7 | WF-31 | Never recorded anywhere: restricted-folder content, provider keys, pas… | NL-112 | NL-122 | NL-122 AC-3 | planned: NL-122 AC-3 (filled `verified:` at §8) |
| OBS-7 | WF-37 | Never recorded anywhere: restricted-folder content, provider keys, pas… | NL-08 | NL-82 | NL-82 AC-4 | planned: NL-82 AC-4 (filled `verified:` at §8) |
| OBS-7 | WF-38 | Never recorded anywhere: restricted-folder content, provider keys, pas… | NL-06 | NL-83 | NL-83 AC-3 | planned: NL-83 AC-3 (filled `verified:` at §8) |
| OBS-7 | WF-41 | Never recorded anywhere: restricted-folder content, provider keys, pas… | NL-26 | NL-105 | NL-105 AC-12 | planned: NL-105 AC-12 (filled `verified:` at §8) |
| OBS-8 | WF-9 | The four completeness checks make silence visible: summary sums match,… | NL-101 | NL-101 | NL-101 AC-2 | planned: NL-101 AC-2 (filled `verified:` at §8) |
| OBS-8 | WF-10 | The four completeness checks make silence visible: summary sums match,… | NL-37 | NL-81 | NL-81 AC-4 | planned: NL-81 AC-4 (filled `verified:` at §8) |
| OBS-8 | WF-17 | The four completeness checks make silence visible: summary sums match,… | NL-78 | NL-78 | NL-78 AC-12 | planned: NL-78 AC-12 (filled `verified:` at §8) |
| OBS-8 | WF-22 | The four completeness checks make silence visible: summary sums match,… | NL-30 | NL-30 | NL-30 AC-10 | planned: NL-30 AC-10 (filled `verified:` at §8) |
| OBS-8 | WF-25 | The four completeness checks make silence visible: summary sums match,… | NL-86 | NL-86 | NL-86 AC-5 | planned: NL-86 AC-5 (filled `verified:` at §8) |
| OBS-8 | WF-38 | The four completeness checks make silence visible: summary sums match,… | NL-134 | NL-137 | NL-137 AC-3 | planned: NL-137 AC-3 (filled `verified:` at §8) |
| OBS-8 | WF-39 | The four completeness checks make silence visible: summary sums match,… | NL-83 | NL-83 | NL-83 AC-1 | planned: NL-83 AC-1 (filled `verified:` at §8) |
| OBS-9 | WF-35 | Operations scripts and process lifecycle write `ops_event` rows (input… | NL-08 | NL-83 | NL-83 AC-8 | planned: NL-83 AC-8 (filled `verified:` at §8) |
| OBS-9 | WF-36 | Operations scripts and process lifecycle write `ops_event` rows (input… | NL-08 | NL-08 | NL-08 AC-2 | planned: NL-08 AC-2 (filled `verified:` at §8) |
| OBS-9 | WF-37 | Operations scripts and process lifecycle write `ops_event` rows (input… | NL-08 | NL-82 | NL-82 AC-1 | planned: NL-82 AC-1 (filled `verified:` at §8) |
| OBS-9 | WF-38 | Operations scripts and process lifecycle write `ops_event` rows (input… | NL-08 | NL-23 | NL-23 AC-6 | planned: NL-23 AC-6 (filled `verified:` at §8) |
| OBS-9 | WF-39 | Operations scripts and process lifecycle write `ops_event` rows (input… | NL-08 | NL-83 | NL-83 AC-1 | planned: NL-83 AC-1 (filled `verified:` at §8) |
| OBS-9 | WF-40 | Operations scripts and process lifecycle write `ops_event` rows (input… | NL-08 | NL-83 | NL-83 AC-5 | planned: NL-83 AC-5 (filled `verified:` at §8) |
| OBS-10 | WF-17 | Postgres is not published outside the Compose network; the run summary… | NL-78 | NL-97 | NL-97 AC-5 | planned: NL-97 AC-5 (filled `verified:` at §8) |
| OBS-10 | WF-38 | Postgres is not published outside the Compose network; the run summary… | NL-137 | NL-137 | NL-137 AC-4 | planned: NL-137 AC-4 (filled `verified:` at §8) |
| OBS-11 | WF-4 | A new entry point, job, script or experiment registers its `WF-n` row,… | NL-108 | NL-108 | NL-108 AC-1 | planned: NL-108 AC-1 (filled `verified:` at §8) |
| OBS-11 | WF-46 | A new entry point, job, script or experiment registers its `WF-n` row,… | NL-108 | NL-108 | NL-108 AC-5 | planned: NL-108 AC-5 (filled `verified:` at §8) |
| M-1 | WF-7 | Reviewer minutes per approved lesson (NS): computable from its source … | NL-48 | NL-54 | NL-54 AC-7 | planned: NL-54 AC-7 (filled `verified:` at §8) |
| M-1 | WF-15 | Reviewer minutes per approved lesson (NS): computable from its source … | NL-48 | NL-53 | NL-53 AC-11 | planned: NL-53 AC-11 (filled `verified:` at §8) |
| M-1 | WF-16 | Reviewer minutes per approved lesson (NS): computable from its source … | NL-48 | NL-48 | NL-48 AC-2 | planned: NL-48 AC-2 (filled `verified:` at §8) |
| M-2 | WF-11 | Blocks cleared by resolution (G-1): computable from its source (`issue… | NL-45 | NL-45 | NL-45 AC-5 | planned: NL-45 AC-5 (filled `verified:` at §8) |
| M-3 | WF-15 | Fast-approval rate (G-2): computable from its source (`lesson_metrics.… | NL-48 | NL-53 | NL-53 AC-11 | planned: NL-53 AC-11 (filled `verified:` at §8) |
| M-3 | WF-16 | Fast-approval rate (G-2): computable from its source (`lesson_metrics.… | NL-48 | NL-48 | NL-48 AC-5 | planned: NL-48 AC-5 (filled `verified:` at §8) |
| M-4 | WF-26 | Seeded-error catch rate (G-3): computable from its source (`eval_case_… | NL-92 | NL-92 | NL-92 AC-1 | planned: NL-92 AC-1 (filled `verified:` at §8) |
| M-5 | WF-20 | First-pass clean rate (V-1): computable from its source (`issue` rows … | NL-34 | NL-88 | NL-88 AC-1 | planned: NL-88 AC-1 (filled `verified:` at §8) |
| M-5 | WF-22 | First-pass clean rate (V-1): computable from its source (`issue` rows … | NL-20 | NL-29 | NL-29 AC-13 | planned: NL-29 AC-13 (filled `verified:` at §8) |
| M-5 | WF-24 | First-pass clean rate (V-1): computable from its source (`issue` rows … | NL-79 | NL-109 | NL-109 AC-4 | planned: NL-109 AC-4 (filled `verified:` at §8) |
| M-5 | WF-25 | First-pass clean rate (V-1): computable from its source (`issue` rows … | NL-86 | NL-86 | NL-86 AC-4 | planned: NL-86 AC-4 (filled `verified:` at §8) |
| M-6 | WF-11 | Standards claims verified (V-2): computable from its source (`alignmen… | NL-45 | NL-45 | NL-45 AC-11 | planned: NL-45 AC-11 (filled `verified:` at §8) |
| M-6 | WF-15 | Standards claims verified (V-2): computable from its source (`alignmen… | NL-43 | NL-53 | NL-53 AC-17 | planned: NL-53 AC-17 (filled `verified:` at §8) |
| M-6 | WF-23 | Standards claims verified (V-2): computable from its source (`alignmen… | NL-89 | NL-89 | NL-89 AC-4 | planned: NL-89 AC-4 (filled `verified:` at §8) |
| M-6 | WF-25 | Standards claims verified (V-2): computable from its source (`alignmen… | NL-86 | NL-86 | NL-86 AC-4 | planned: NL-86 AC-4 (filled `verified:` at §8) |
| M-7 | WF-10 | Quotes sourced or placeholder (V-3): computable from its source (`issu… | NL-37 | NL-37 | NL-37 AC-11 | planned: NL-37 AC-11 (filled `verified:` at §8) |
| M-7 | WF-12 | Quotes sourced or placeholder (V-3): computable from its source (`issu… | NL-46 | NL-46 | NL-46 AC-1 | planned: NL-46 AC-1 (filled `verified:` at §8) |
| M-7 | WF-22 | Quotes sourced or placeholder (V-3): computable from its source (`issu… | NL-14 | NL-79 | NL-79 AC-9 | planned: NL-79 AC-9 (filled `verified:` at §8) |
| M-7 | WF-24 | Quotes sourced or placeholder (V-3): computable from its source (`issu… | NL-40 | NL-85 | NL-85 AC-3 | planned: NL-85 AC-3 (filled `verified:` at §8) |
| M-7 | WF-25 | Quotes sourced or placeholder (V-3): computable from its source (`issu… | NL-86 | NL-86 | NL-86 AC-4 | planned: NL-86 AC-4 (filled `verified:` at §8) |
| M-7 | WF-34 | Quotes sourced or placeholder (V-3): computable from its source (`issu… | NL-87 | NL-87 | NL-87 AC-3 | planned: NL-87 AC-3 (filled `verified:` at §8) |
| M-8 | WF-9 | Edit distance, draft to approved (V-4): computable from its source (`l… | NL-80 | NL-80 | NL-80 AC-6 | planned: NL-80 AC-6 (filled `verified:` at §8) |
| M-8 | WF-15 | Edit distance, draft to approved (V-4): computable from its source (`l… | NL-53 | NL-53 | NL-53 AC-17 | planned: NL-53 AC-17 (filled `verified:` at §8) |
| M-9 | WF-15 | Changes-requested rate, with reasons (V-5): computable from its source… | NL-53 | NL-53 | NL-53 AC-17 | planned: NL-53 AC-17 (filled `verified:` at §8) |
| M-10 | WF-14 | AI-assist accept rate, with accepted-then-rewritten rate (V-6): comput… | NL-50 | NL-50 | NL-50 AC-1 | planned: NL-50 AC-1 (filled `verified:` at §8) |
| M-11 | WF-13 | Cost per approved lesson (O-1): computable from its source (`model_cal… | NL-47 | NL-47 | NL-47 AC-1 | planned: NL-47 AC-1 (filled `verified:` at §8) |
| M-11 | WF-15 | Cost per approved lesson (O-1): computable from its source (`model_cal… | NL-47 | NL-53 | NL-53 AC-17 | planned: NL-53 AC-17 (filled `verified:` at §8) |
| M-11 | WF-22 | Cost per approved lesson (O-1): computable from its source (`model_cal… | NL-32 | NL-32 | NL-32 AC-3 | planned: NL-32 AC-3 (filled `verified:` at §8) |
| M-11 | WF-25 | Cost per approved lesson (O-1): computable from its source (`model_cal… | NL-86 | NL-86 | NL-86 AC-4 | planned: NL-86 AC-4 (filled `verified:` at §8) |
| M-11 | WF-32 | Cost per approved lesson (O-1): computable from its source (`model_cal… | NL-87 | NL-87 | NL-87 AC-1 | planned: NL-87 AC-1 (filled `verified:` at §8) |
| M-12 | WF-15 | Approved lessons per reviewer-hour (O-2): computable from its source (… | NL-48 | NL-53 | NL-53 AC-11 | planned: NL-53 AC-11 (filled `verified:` at §8) |
| M-12 | WF-16 | Approved lessons per reviewer-hour (O-2): computable from its source (… | NL-48 | NL-48 | NL-48 AC-2 | planned: NL-48 AC-2 (filled `verified:` at §8) |
| M-13 | WF-3 | Unit lead time and share approved (O-3): computable from its source (`… | NL-77 | NL-77 | NL-77 AC-7 | planned: NL-77 AC-7 (filled `verified:` at §8) |
| M-13 | WF-15 | Unit lead time and share approved (O-3): computable from its source (`… | NL-53 | NL-53 | NL-53 AC-17 | planned: NL-53 AC-17 (filled `verified:` at §8) |
| M-14 | WF-15 | Standards coverage completeness (O-4): computable from its source (`al… | NL-53 | NL-53 | NL-53 AC-10 | planned: NL-53 AC-10 (filled `verified:` at §8) |
| M-14 | WF-18 | Standards coverage completeness (O-4): computable from its source (`al… | NL-91 | NL-91 | NL-91 AC-1 | planned: NL-91 AC-1 (filled `verified:` at §8) |
| M-15 | WF-6 | Generation success rate (H-1): computable from its source (`lesson_job… | NL-28 | NL-28 | NL-28 AC-12 | planned: NL-28 AC-12 (filled `verified:` at §8) |
| M-15 | WF-17 | Generation success rate (H-1): computable from its source (`lesson_job… | NL-33 | NL-33 | NL-33 AC-8 | planned: NL-33 AC-8 (filled `verified:` at §8) |
| M-15 | WF-21 | Generation success rate (H-1): computable from its source (`lesson_job… | NL-22 | NL-31 | NL-31 AC-9 | planned: NL-31 AC-9 (filled `verified:` at §8) |
| M-15 | WF-22 | Generation success rate (H-1): computable from its source (`lesson_job… | NL-22 | NL-30 | NL-30 AC-10 | planned: NL-30 AC-10 (filled `verified:` at §8) |
| M-15 | WF-25 | Generation success rate (H-1): computable from its source (`lesson_job… | NL-86 | NL-86 | NL-86 AC-5 | planned: NL-86 AC-5 (filled `verified:` at §8) |
| M-15 | WF-28 | Generation success rate (H-1): computable from its source (`lesson_job… | NL-79 | NL-107 | NL-107 AC-2 | planned: NL-107 AC-2 (filled `verified:` at §8) |
| M-16 | WF-17 | Generation time per lesson and unit wall time (H-2): computable from i… | NL-33 | NL-78 | NL-78 AC-11 | planned: NL-78 AC-11 (filled `verified:` at §8) |
| M-16 | WF-22 | Generation time per lesson and unit wall time (H-2): computable from i… | NL-29 | NL-29 | NL-29 AC-13 | planned: NL-29 AC-13 (filled `verified:` at §8) |
| M-16 | WF-25 | Generation time per lesson and unit wall time (H-2): computable from i… | NL-86 | NL-86 | NL-86 AC-5 | planned: NL-86 AC-5 (filled `verified:` at §8) |
| M-17 | WF-4 | Model spend per run against its cap (H-3): computable from its source … | NL-27 | NL-27 | NL-27 AC-12 | planned: NL-27 AC-12 (filled `verified:` at §8) |
| M-17 | WF-6 | Model spend per run against its cap (H-3): computable from its source … | NL-30 | NL-30 | NL-30 AC-11 | planned: NL-30 AC-11 (filled `verified:` at §8) |
| M-17 | WF-17 | Model spend per run against its cap (H-3): computable from its source … | NL-27 | NL-78 | NL-78 AC-11 | planned: NL-78 AC-11 (filled `verified:` at §8) |
| M-17 | WF-22 | Model spend per run against its cap (H-3): computable from its source … | NL-30 | NL-30 | NL-30 AC-8 | planned: NL-30 AC-8 (filled `verified:` at §8) |
| M-17 | WF-25 | Model spend per run against its cap (H-3): computable from its source … | NL-86 | NL-86 | NL-86 AC-5 | planned: NL-86 AC-5 (filled `verified:` at §8) |
| M-17 | WF-28 | Model spend per run against its cap (H-3): computable from its source … | NL-35 | NL-35 | NL-35 AC-15 | planned: NL-35 AC-15 (filled `verified:` at §8) |
| M-18 | WF-8 | p95 lesson open (H-4): computable from its source (`probe_run`, client… | NL-44 | NL-44 | NL-44 AC-9 | planned: NL-44 AC-9 (filled `verified:` at §8) |
| M-18 | WF-29 | p95 lesson open (H-4): computable from its source (`probe_run`, client… | NL-100 | NL-118 | NL-118 AC-2 | planned: NL-118 AC-2 (filled `verified:` at §8) |
| M-19 | WF-9 | Collaboration latency and durability (H-5): computable from its source… | NL-80 | NL-80 | NL-80 AC-12 | planned: NL-80 AC-12 (filled `verified:` at §8) |
| M-19 | WF-30 | Collaboration latency and durability (H-5): computable from its source… | NL-101 | NL-119 | NL-119 AC-1 | planned: NL-119 AC-1 (filled `verified:` at §8) |
| M-19 | WF-33 | Collaboration latency and durability (H-5): computable from its source… | NL-87 | NL-87 | NL-87 AC-2 | planned: NL-87 AC-2 (filled `verified:` at §8) |
| M-20 | WF-7 | p95 unit page load (H-6): computable from its source (`probe_run`, ser… | NL-54 | NL-54 | NL-54 AC-12 | planned: NL-54 AC-12 (filled `verified:` at §8) |
| M-20 | WF-29 | p95 unit page load (H-6): computable from its source (`probe_run`, ser… | NL-98 | NL-118 | NL-118 AC-6 | planned: NL-118 AC-6 (filled `verified:` at §8) |
| M-21 | WF-5 | Board and progress poll latency: computable from its source (`probe_ru… | NL-78 | NL-78 | NL-78 AC-1 | planned: NL-78 AC-1 (filled `verified:` at §8) |
| M-21 | WF-7 | Board and progress poll latency: computable from its source (`probe_ru… | NL-54 | NL-98 | NL-98 AC-1 | planned: NL-98 AC-1 (filled `verified:` at §8) |
| M-21 | WF-29 | Board and progress poll latency: computable from its source (`probe_ru… | NL-98 | NL-118 | NL-118 AC-1 | planned: NL-118 AC-1 (filled `verified:` at §8) |
| M-22 | WF-29 | Error rate during the spike: computable from its source (`probe_run`),… | NL-118 | NL-118 | NL-118 AC-2 | planned: NL-118 AC-2 (filled `verified:` at §8) |
| M-22 | WF-30 | Error rate during the spike: computable from its source (`probe_run`),… | NL-119 | NL-119 | NL-119 AC-5 | planned: NL-119 AC-5 (filled `verified:` at §8) |
| M-23 | WF-29 | Recovery time after the spike: computable from its source (`probe_run`… | NL-118 | NL-118 | NL-118 AC-2 | planned: NL-118 AC-2 (filled `verified:` at §8) |
| M-24 | WF-9 | Socket reconnect time: computable from its source (`probe_run`), which… | NL-80 | NL-80 | NL-80 AC-12 | planned: NL-80 AC-12 (filled `verified:` at §8) |
| M-24 | WF-30 | Socket reconnect time: computable from its source (`probe_run`), which… | NL-101 | NL-119 | NL-119 AC-3 | planned: NL-119 AC-3 (filled `verified:` at §8) |
| M-24 | WF-33 | Socket reconnect time: computable from its source (`probe_run`), which… | NL-87 | NL-87 | NL-87 AC-2 | planned: NL-87 AC-2 (filled `verified:` at §8) |
| M-25 | WF-4 | Generation queue wait: computable from its source (`lesson_job.queued_… | NL-27 | NL-27 | NL-27 AC-12 | planned: NL-27 AC-12 (filled `verified:` at §8) |
| M-25 | WF-22 | Generation queue wait: computable from its source (`lesson_job.queued_… | NL-28 | NL-28 | NL-28 AC-12 | planned: NL-28 AC-12 (filled `verified:` at §8) |
| M-25 | WF-25 | Generation queue wait: computable from its source (`lesson_job.queued_… | NL-86 | NL-86 | NL-86 AC-5 | planned: NL-86 AC-5 (filled `verified:` at §8) |
| M-26 | WF-9 | Store to checks refreshed: computable from its source (`lesson_doc.sto… | NL-36 | NL-36 | NL-36 AC-1 | planned: NL-36 AC-1 (filled `verified:` at §8) |
| M-26 | WF-10 | Store to checks refreshed: computable from its source (`lesson_doc.sto… | NL-37 | NL-37 | NL-37 AC-1 | planned: NL-37 AC-1 (filled `verified:` at §8) |
| M-26 | WF-12 | Store to checks refreshed: computable from its source (`lesson_doc.sto… | NL-46 | NL-46 | NL-46 AC-7 | planned: NL-46 AC-7 (filled `verified:` at §8) |
| M-27 | WF-9 | Store transaction time: computable from its source (`experiment_run` (… | NL-36 | NL-36 | NL-36 AC-1 | planned: NL-36 AC-1 (filled `verified:` at §8) |
| M-27 | WF-30 | Store transaction time: computable from its source (`experiment_run` (… | NL-101 | NL-119 | NL-119 AC-1 | planned: NL-119 AC-1 (filled `verified:` at §8) |
| M-27 | WF-33 | Store transaction time: computable from its source (`experiment_run` (… | NL-87 | NL-87 | NL-87 AC-2 | planned: NL-87 AC-2 (filled `verified:` at §8) |
| M-27 | WF-43 | Store transaction time: computable from its source (`experiment_run` (… | NL-101 | NL-125 | NL-125 AC-6 | planned: NL-125 AC-6 (filled `verified:` at §8) |
| M-28 | WF-13 | Model spend per generated lesson: computable from its source (`model_c… | NL-47 | NL-47 | NL-47 AC-8 | planned: NL-47 AC-8 (filled `verified:` at §8) |
| M-28 | WF-17 | Model spend per generated lesson: computable from its source (`model_c… | NL-33 | NL-78 | NL-78 AC-11 | planned: NL-78 AC-11 (filled `verified:` at §8) |
| M-28 | WF-22 | Model spend per generated lesson: computable from its source (`model_c… | NL-32 | NL-32 | NL-32 AC-11 | planned: NL-32 AC-11 (filled `verified:` at §8) |
| M-28 | WF-25 | Model spend per generated lesson: computable from its source (`model_c… | NL-86 | NL-86 | NL-86 AC-4 | planned: NL-86 AC-4 (filled `verified:` at §8) |
| M-28 | WF-32 | Model spend per generated lesson: computable from its source (`model_c… | NL-87 | NL-87 | NL-87 AC-1 | planned: NL-87 AC-1 (filled `verified:` at §8) |
| M-29 | WF-13 | Build model spend against the ceiling: computable from its source (`mo… | NL-47 | NL-47 | NL-47 AC-3 | planned: NL-47 AC-3 (filled `verified:` at §8) |
| M-29 | WF-17 | Build model spend against the ceiling: computable from its source (`mo… | NL-35 | NL-78 | NL-78 AC-11 | planned: NL-78 AC-11 (filled `verified:` at §8) |
| M-29 | WF-21 | Build model spend against the ceiling: computable from its source (`mo… | NL-31 | NL-31 | NL-31 AC-7 | planned: NL-31 AC-7 (filled `verified:` at §8) |
| M-29 | WF-22 | Build model spend against the ceiling: computable from its source (`mo… | NL-35 | NL-35 | NL-35 AC-15 | planned: NL-35 AC-15 (filled `verified:` at §8) |
| M-29 | WF-25 | Build model spend against the ceiling: computable from its source (`mo… | NL-86 | NL-86 | NL-86 AC-5 | planned: NL-86 AC-5 (filled `verified:` at §8) |
| M-30 | WF-24 | Golden suite pass rate: computable from its source (`eval_run`, `eval_… | NL-49 | NL-49 | NL-49 AC-1 | planned: NL-49 AC-1 (filled `verified:` at §8) |
| M-31 | WF-22 | Schema-valid first-pass rate: computable from its source (`model_call`… | NL-18 | NL-29 | NL-29 AC-13 | planned: NL-29 AC-13 (filled `verified:` at §8) |
| M-31 | WF-24 | Schema-valid first-pass rate: computable from its source (`model_call`… | NL-79 | NL-109 | NL-109 AC-3 | planned: NL-109 AC-3 (filled `verified:` at §8) |
| M-31 | WF-25 | Schema-valid first-pass rate: computable from its source (`model_call`… | NL-86 | NL-86 | NL-86 AC-4 | planned: NL-86 AC-4 (filled `verified:` at §8) |
| M-31 | WF-32 | Schema-valid first-pass rate: computable from its source (`model_call`… | NL-87 | NL-87 | NL-87 AC-1 | planned: NL-87 AC-1 (filled `verified:` at §8) |
| M-32 | WF-34 | Grounding plant catch rate: computable from its source (`eval_case_res… | NL-87 | NL-87 | NL-87 AC-3 | planned: NL-87 AC-3 (filled `verified:` at §8) |
| M-32 | WF-42 | Grounding plant catch rate: computable from its source (`eval_case_res… | NL-40 | NL-85 | NL-85 AC-4 | planned: NL-85 AC-4 (filled `verified:` at §8) |
| M-33 | WF-10 | Grounding false flags per clean lesson: computable from its source (`i… | NL-39 | NL-39 | NL-39 AC-11 | planned: NL-39 AC-11 (filled `verified:` at §8) |
| M-33 | WF-25 | Grounding false flags per clean lesson: computable from its source (`i… | NL-86 | NL-86 | NL-86 AC-4 | planned: NL-86 AC-4 (filled `verified:` at §8) |
| M-33 | WF-34 | Grounding false flags per clean lesson: computable from its source (`i… | NL-87 | NL-87 | NL-87 AC-3 | planned: NL-87 AC-3 (filled `verified:` at §8) |
| M-33 | WF-42 | Grounding false flags per clean lesson: computable from its source (`i… | NL-39 | NL-85 | NL-85 AC-5 | planned: NL-85 AC-5 (filled `verified:` at §8) |
| M-34 | WF-23 | Judge agreement with human labels: computable from its source (`eval_c… | NL-89 | NL-89 | NL-89 AC-9 | planned: NL-89 AC-9 (filled `verified:` at §8) |
| M-34 | WF-31 | Judge agreement with human labels: computable from its source (`eval_c… | NL-89 | NL-111 | NL-111 AC-1 | planned: NL-111 AC-1 (filled `verified:` at §8) |
| M-35 | WF-15 | Draft-quality rating split: computable from its source (`lesson_metric… | NL-53 | NL-53 | NL-53 AC-9 | planned: NL-53 AC-9 (filled `verified:` at §8) |
| M-36 | WF-9 | Round-trip hash identity: computable from its source (`lesson_version.… | NL-10 | NL-10 | NL-10 AC-2 | planned: NL-10 AC-2 (filled `verified:` at §8) |
| M-36 | WF-19 | Round-trip hash identity: computable from its source (`lesson_version.… | NL-51 | NL-51 | NL-51 AC-3 | planned: NL-51 AC-3 (filled `verified:` at §8) |
| M-36 | WF-25 | Round-trip hash identity: computable from its source (`lesson_version.… | NL-86 | NL-86 | NL-86 AC-5 | planned: NL-86 AC-5 (filled `verified:` at §8) |
| M-36 | WF-33 | Round-trip hash identity: computable from its source (`lesson_version.… | NL-87 | NL-87 | NL-87 AC-2 | planned: NL-87 AC-2 (filled `verified:` at §8) |
| M-36 | WF-41 | Round-trip hash identity: computable from its source (`lesson_version.… | NL-80 | NL-105 | NL-105 AC-13 | planned: NL-105 AC-13 (filled `verified:` at §8) |
| M-36 | WF-43 | Round-trip hash identity: computable from its source (`lesson_version.… | NL-101 | NL-125 | NL-125 AC-2 | planned: NL-125 AC-2 (filled `verified:` at §8) |
| M-37 | WF-15 | Approval-integrity refusal rate: computable from its source (`eval_cas… | NL-21 | NL-53 | NL-53 AC-5 | planned: NL-53 AC-5 (filled `verified:` at §8) |
| M-37 | WF-33 | Approval-integrity refusal rate: computable from its source (`eval_cas… | NL-87 | NL-87 | NL-87 AC-2 | planned: NL-87 AC-2 (filled `verified:` at §8) |
| M-37 | WF-41 | Approval-integrity refusal rate: computable from its source (`eval_cas… | NL-105 | NL-105 | NL-105 AC-4 | planned: NL-105 AC-4 (filled `verified:` at §8) |
| M-37 | WF-43 | Approval-integrity refusal rate: computable from its source (`eval_cas… | NL-115 | NL-125 | NL-125 AC-1 | planned: NL-125 AC-1 (filled `verified:` at §8) |
| M-38 | WF-11 | Safety-flag gate: computable from its source (`safety_flag`, `issue`; … | NL-45 | NL-45 | NL-45 AC-6 | planned: NL-45 AC-6 (filled `verified:` at §8) |
| M-38 | WF-15 | Safety-flag gate: computable from its source (`safety_flag`, `issue`; … | NL-38 | NL-53 | NL-53 AC-7 | planned: NL-53 AC-7 (filled `verified:` at §8) |
| M-38 | WF-22 | Safety-flag gate: computable from its source (`safety_flag`, `issue`; … | NL-29 | NL-29 | NL-29 AC-10 | planned: NL-29 AC-10 (filled `verified:` at §8) |
| M-38 | WF-24 | Safety-flag gate: computable from its source (`safety_flag`, `issue`; … | NL-84 | NL-84 | NL-84 AC-4 | planned: NL-84 AC-4 (filled `verified:` at §8) |
| M-39 | WF-2 | Safety pattern recall and false proposals: computable from its source … | NL-16 | NL-16 | NL-16 AC-8 | planned: NL-16 AC-8 (filled `verified:` at §8) |
| M-39 | WF-24 | Safety pattern recall and false proposals: computable from its source … | NL-16 | NL-84 | NL-84 AC-5 | planned: NL-84 AC-5 (filled `verified:` at §8) |
| M-40 | WF-2 | Intake report exact match: computable from its source (`eval_case_resu… | NL-16 | NL-16 | NL-16 AC-3 | planned: NL-16 AC-3 (filled `verified:` at §8) |
| M-40 | WF-3 | Intake report exact match: computable from its source (`eval_case_resu… | NL-94 | NL-94 | NL-94 AC-1 | planned: NL-94 AC-1 (filled `verified:` at §8) |
| M-40 | WF-24 | Intake report exact match: computable from its source (`eval_case_resu… | NL-15 | NL-84 | NL-84 AC-1 | planned: NL-84 AC-1 (filled `verified:` at §8) |
| M-41 | WF-10 | Standards confirmations per lesson: computable from its source (`align… | NL-39 | NL-39 | NL-39 AC-3 | planned: NL-39 AC-3 (filled `verified:` at §8) |
| M-41 | WF-11 | Standards confirmations per lesson: computable from its source (`align… | NL-45 | NL-45 | NL-45 AC-8 | planned: NL-45 AC-8 (filled `verified:` at §8) |
| M-41 | WF-22 | Standards confirmations per lesson: computable from its source (`align… | NL-43 | NL-79 | NL-79 AC-9 | planned: NL-79 AC-9 (filled `verified:` at §8) |
| M-41 | WF-25 | Standards confirmations per lesson: computable from its source (`align… | NL-86 | NL-86 | NL-86 AC-4 | planned: NL-86 AC-4 (filled `verified:` at §8) |
| M-42 | WF-27 | Held-out structural agreement: computable from its source (`evals/loca… | NL-121 | NL-121 | NL-121 AC-2 | planned: NL-121 AC-2 (filled `verified:` at §8) |
| M-43 | WF-16 | Heartbeat accuracy: computable from its source (`eval_case_result` row… | NL-48 | NL-48 | NL-48 AC-4 | planned: NL-48 AC-4 (filled `verified:` at §8) |
| M-44 | WF-28 | Long-job fault invariants: computable from its source (`eval_case_resu… | NL-22 | NL-30 | NL-30 AC-9 | planned: NL-30 AC-9 (filled `verified:` at §8) |

## Findings and repairs

From the §6 requirements sweep (2026-10-25). Every repair is in DO-6, DO-7 or DO-5 as of this date.

| Finding | Repair | Ticket(s) changed |
|---|---|---|
| Five entry points had no `WF-n`: the collaboration server's internal command routes (lock-and-snapshot, apply-edit, set-mode), the S4 grounding suite (`npm run eval:grounding`), the S5 integrity suite and the S8 heartbeat suite (`npm run test:e2e -- …`), and the JSON Schema emitter (`npm run schemas:emit`) | Registered as WF-41…WF-45 in DO-6 with capture checks and inherited metrics | none yet (§7) |
| Five routes were missing from their workflow's entry point: `GET /units`, `GET` and `DELETE /session`, `GET /lessons/{id}/issues` (CON-13) and the safety-flag clear (CON-14) | Named in WF-1, WF-2, WF-8 and WF-11; WF-11 now requires `safety_flag` | none yet |
| M-21…M-44 (24 metrics) were inherited by no workflow, and M-34 and M-42 sat on rows marked "feeds none" | Each added to the workflows that emit its source records; DO-6's metric coverage check now lists all 44; **0 uninherited** | none yet |
| WF-1, WF-2 and WF-9 capture checks, and the capture rule for refusals, expected an audit row for a refused call; INTERFACE shared guarantee 2 says a refusal writes no row and goes to the application log | Capture checks rewritten to assert no row and one log line | none yet |
| DO-7 *Source* column used working names (`check_result`, `seeded_error`, `ai_assist_event`, `judge_label`, `load_test_run`, SP records) | Replaced with DO-3 §6 canonical tables per the §6.1 map | none yet |
| DO-5 commands used `pnpm`; the build uses npm workspaces | Rewritten as `npm run <script> -- <args>`, each tagged with its `WF-n` | none yet |
| WF-23's evaluation pointed at WF-32 (an SP-1 spike) for judge calibration | Pointed at WF-31 | none yet |
| The fault script's assertion named `calls_lost_in_flight`; DO-3's column is `lesson_job.calls_lost` | Renamed in DO-6 | none yet |
| The GR-9 guard ("a check fails if any `restricted/` path is tracked") is a merge-gate test that writes no records, not a runtime entry point | Left without a `WF-n`; GR-9 applies to `all`, so every workflow's capture test asserts the restricted marker is absent | none yet |
