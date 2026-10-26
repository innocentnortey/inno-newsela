# UX-5b · QA report — Newsela Lesson Studio (NL-126)

Walked 2026-10-26 on `main` 1d9e78d. **18 findings filed (4 blocking, 6 major, 8 minor), none fixed here.** GitLab issues #None to #None (label `lane::build-loop`, the project's build-loop label; there is no label named `build-loop`). NL-133 (Innocent's sign-off) is blocked by F-1 to F-4.

## Read this first: what was and was not walked

> **No real-model unit exists.** NL-112 (the paid full run) has not happened. Everything below ran on the committed Compose stack with `MODEL_PROVIDER_MODE=stub`, a freshly seeded database and the three seeded demo accounts (`npm run db:seed` through the image). **The stub stack cannot generate anything** (F-4), so there is no generated unit. The lessons walked are the committed NL-100 synthetic seed (`apps/web/e2e/integration/con-11/seed-lessons.ts`: Lessons 4 to 13 in draft, in review, submitted, approved, reopened, schema 99, unknown node, markup, missing, plus a stored candidate version for Lesson 4), loaded straight into the database. Journeys that need real-model data are marked **NOT WALKED**, not faked: a real generation run (progress, pause, resume), the unit plan (SCR-7), candidate compare and adopt (SCR-12), AI assist (SCR-13), the north-star number with approved lessons, and a full submit to approve to export pass on one lesson.
>
> **Deviations from the stack as committed, all recorded so the walk can be repeated:**
> 1. Three images were built from the committed Dockerfiles (`ls-node`, `ls-web`; project name `nlqa`, web on 3410, collab on 1434, its own Postgres volume, removed afterwards). No source was changed.
> 2. Compose as committed fails every web-to-collab call (F-2). From the quote insert onward the walk used a Compose override that sets `COLLAB_INTERNAL_URL=http://collab:1234/internal` (not committed).
> 3. The browser editor never connects on Compose (F-3). SCR-9, SCR-10, SCR-11 were walked with a Playwright `routeWebSocket` bridge to the collab port, the same device the e2e suite uses.
> 4. Seed adjustments in the throwaway database: the NL-100 seed writes a run with the state `succeeded`, which is not a contract state and made SCR-2 throw, so it was set to `complete`; and its run points at an outline version whose rows the check loader rejects (`InvariantViolation`, every check job failing), so the run was pointed at the uploaded issued outline. Both are seed artefacts, not filed as product defects. Seeded lessons carry about 20 blocking check issues each because they are one lesson body checked against other rows; that is also a seed artefact.
> 5. Driver: the Chrome DevTools MCP was connected and was used for sign-in and **all Lighthouse runs**. The state walk, screenshots and axe passes were scripted with Playwright (the repo's own `@playwright/test` and `@axe-core/playwright`, tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa) because 18 screens in four modes by hand was not practical. Screenshots were taken after each state change.
> 6. The first part of the walk (SCR-2 empty to SCR-6 stuck run, same issued sheet) ran on a first database that was then dropped to load the seed; its screenshots are kept (`scr2-empty`, `scr3-*`, `scr4-unit-confirm-422`, `scr4-partial`, `scr5-*`, `scr6-after-start`, `scr6-state`).

Evidence folder: [`evidence/`](evidence/) (PNG per state; names are `<screen>-<state>-<width>-<theme>.png`). Lighthouse: [`lighthouse/`](lighthouse/). Seed accounts: `author.demo@example.test`, `reviewer.demo@example.test`, `approver.demo@example.test`, password set for this run through `SEED_DEMO_PASSWORD` (not recorded).

## Journeys

| # | Journey | Result |
|---|---|---|
| 1 | Sign in as each role; wrong role refused (SCR-1) | walked, pass; finding-F-16 (#None) |
| 2 | Units list; upload the issued sheet and a bad file; validation report and choices (SCR-2 to SCR-4) | walked; blocked by finding-F-1 (#None); also finding-F-8 (#None), finding-F-12 (#None), finding-F-9 (#None) |
| 3 | Start a run; progress, pause, resume (SCR-5 to SCR-7) | start and cancel walked; run never progresses (finding-F-4 (#None)); **pause, resume and SCR-7 NOT WALKED** |
| 4 | Unit board and the north-star tile (SCR-8) | walked on seed data; the tile's empty state only (no approved lesson with review time); finding-F-15 (#None) |
| 5 | Workspace: edit, quote fill, standard decision, regenerate and adopt, history (SCR-9 to SCR-12, SCR-16) | edit, quote fill, resolve, history walked (finding-F-2 (#None), finding-F-3 (#None)); **standard decision NOT WALKED** (seeded standards are all outline-asserted, none AI-proposed); regenerate attempted (finding-F-14 (#None)); **adopt NOT WALKED** |
| 6 | Submit, approve by the second account on the pinned version, send back, reopen (SCR-14, SCR-15) | submit not reachable (seed lessons carry blocking issues); approve refused path walked (finding-F-5 (#None)); send back walked (finding-F-6 (#None), finding-F-7 (#None)); **approve success and reopen NOT WALKED** (no lesson without blocking issues; reopened and approved states read from seed) |
| 7 | Run summary (SCR-17) | walked on the seed run (n = 0 lessons) |

Cut-order screens: SCR-18, SCR-19, SCR-20, SCR-21 are built (merged, linked from the board) and were opened read-only and axe-scanned; their other states were not walked. SCR-13 (AI assist, NL-116) was **NOT WALKED**: its calls need a scripted stub or a model.

## Screens

Result column: `pass`, `finding-F-n (#issue)`, or `not reachable (why)`. Screenshot paths are under `evidence/`.

### SCR-1 Sign in
| Given | When | Then | Screenshot | Result |
|---|---|---|---|---|
| signed-out visitor | opens `/sign-in` | one card, email and password fields, "Staff only. Use your Newsela email." | `scr1-sign-in-1280-light.png` | pass |
| wrong password | submits | "That email and password don't match.", stays on page | `scr1-bad-password-1280-light.png` | pass |
| email not on the list | submits | "This email is not on the staff list. Check the spelling or ask your content lead to add you."; email kept | `scr1-not-on-list-1280-light.png` | pass |
| each role signs in | submits | author lands on `/units`; reviewer and approver on the board | n/a (URL log) | pass |
| signed in | revisits `/sign-in` | sent to the landing page | n/a | pass |
| signed out | opens a board URL | `/sign-in?next=%2Funits%2Fg6-u4%2Fboard` | n/a | pass |
| reviewer or approver | opens upload | "Only authors can upload an outline", link back | n/a | pass (SCR-3 role-forbidden) |
| spec: demo accounts box | page opens | no box listing the three accounts | `scr1-sign-in-1280-light.png` | finding-F-16 (#None) |
Loading and network-error states: not reachable (instant local login; stack never down during the walk).

### SCR-2 Units home
| Given | When | Then | Screenshot | Result |
|---|---|---|---|---|
| empty database | author opens `/units` | "No outline uploaded yet. Upload the unit's outline sheet to see its validation report before any lesson is drafted." + Upload outline | `scr2-empty-1280-light.png` | pass |
| unit with versions and a run | opens `/units` | unit card (Complete, 0 of 0 ready), outline versions table, links | `scr2-units-seeded-1280-light.png` | pass (seed run has 0 jobs) |
| run state outside the contract (`succeeded`, seed) | opens `/units` | whole page replaced by "This page couldn't load" (`TypeError ... 'label'`) | n/a | not filed: invalid database state; noted for hardening |
| role read-only, loading, error | n/a | not reached | n/a | not reachable (no failing API; skeleton under 1 s) |

### SCR-3 Upload outline
| Given | When | Then | Screenshot | Result |
|---|---|---|---|---|
| author | opens upload | File / Sheet link control, Choose file, "CSV or XLSX, up to 200 rows" | `scr3-initial-1280-light.png` | pass |
| `bad.txt` | Upload | file type error shown together with "Choose a file first." | `scr3-unsupported-file-1280-light.png` | finding-F-12 (#None) |
| `issued.xlsx` | Upload | stored as version 1, SCR-4 opens | `scr4-partial-1280-light.png` (after) | pass |
| same file again | Upload | "Version 3 is the same as version 2; 0 lessons changed." + Open the report | `scr3-same-hash-1280-light.png` | pass (the same-hash version shows 6 unconfirmed errors again; not filed) |
| reviewer | opens upload | "Only authors can upload an outline" | n/a | pass |
| other error codes (private sheet, header not found, too many rows), Sheet link | n/a | not walked (Sheet link needs a public Google Sheet; the issued file is fine) | n/a | not reachable (no network sheet) |
| 390 px | opens upload | page scrolls sideways by 26 px | `scr3-upload-390-light.png` | finding-F-9 (#None) |

### SCR-4 Validation report
| Given | When | Then | Screenshot | Result |
|---|---|---|---|---|
| issued sheet v1 | opens report | 6 errors to confirm, warnings with defaults, OK rows collapsed, Generate off with reason | `scr4-report-1280-light.png` | pass |
| unit-id error | Confirm U4 | 422 "That is not a unit id such as G6.U4."; Generate stays off | `scr4-unit-confirm-422-1280-light.png` | finding-F-1 (#None) |
| rows 30, 34, 39 | reads "What" and proposal | whole Focus cell "does not exist", proposal `RL.6.9` | `scr4-report-1280-light.png` | finding-F-8 (#None) |
| fix row 8 | Confirm | "Confirmed by Demo author", count drops | `scr4-partial-1280-light.png` | pass |
| all confirmed (value replayed as `G6.U4`, workaround) | reload | "All 6 errors confirmed. Generate is on." | n/a | pass after workaround |
| synthetic outline row with `<img src=x onerror=alert(1)>` (SYN1 plus tag) | reads report as author and reviewer | shown literally, no `img`, no dialog | `scr4-xss-literal-1280-light.png` | pass (AC-5) |
| instruction-shaped cell (SYN1) | reads report | "Instruction-shaped text, kept as content" | `scr4-syn1-injection-1280-light.png` | pass |
| reviewer | opens report | "You're viewing as a reviewer. Only authors confirm the report." | n/a | pass |
| newer version | opens v2 | info banner "Version 3 is the same as version 2..." with link | n/a | pass |
| Edit a fix, invalid code message, "choice did not save", `VALIDATION_INCOMPLETE`, frozen | n/a | Edit control opened no input in the scripted probe and was not re-tried by hand; the others need a failing API or a started run | n/a | not walked |
| page size | opens report | document 1350 px wider than the 1280 viewport | `scr4-report-390-light.png` | finding-F-9 (#None) |

### SCR-5 Start run
| Given | When | Then | Screenshot | Result |
|---|---|---|---|---|
| confirmed report | Generate | dialog: scope, "v05710 · locked rules + guidance v1 · pinned to this run", spend cap (default 13.00) | `scr5-dialog-1280-light.png` | pass |
| rows `52`, cap `0` | Start run | "Set a cap above $0" shown; the row error is not (server-side) | `scr5-field-errors-1280-light.png` | pass for cap; row-not-a-teaching-day message not seen |
| rows 8, 9, 25, cap 5 | Start run | `POST /api/runs` 201, SCR-6 opens in Planning | `scr6-after-start-1280-light.png` | pass |
| `ROLE_FORBIDDEN`, `DAY_CAP_REACHED`, `VALIDATION_INCOMPLETE` | n/a | not triggered | n/a | not reachable (needs a non-author session on a stale tab, a spent day cap) |

### SCR-6 Generation progress
| Given | When | Then | Screenshot | Result |
|---|---|---|---|---|
| new run | worker claims the plan job | stays "Planning", tiles Queued, no message, for minutes | `scr6-planning-stuck-1280-light.png` | finding-F-4 (#None) |
| author | Cancel run | inline "Cancel the run? Calls in flight will finish; no new calls start." | `scr6-cancel-confirm-1280-light.png` | pass |
| confirm | Cancel run | "Run cancelled. Calls in flight finished and were stored."; tiles Failed "cancelled before it finished" | `scr6-cancelled-1280-light.png` | pass |
| reviewer | opens run | "Only authors can control a run" | `run-reviewer-1280-light.png` | pass |
| complete run (seed, 0 jobs) | opens | "Run complete: 0 of 0 ready." + Open the board | `run-reviewer-1280-light.png` | pass |
| running, partial, capped, paused, worker restart, stale, retry/resume | n/a | needs a run that progresses | n/a | not reachable (finding-F-4 (#None); NL-112) |

### SCR-7 Unit plan
| Given | When | Then | Screenshot | Result |
|---|---|---|---|---|
| seeded run, no stored plan | opens `/runs/<id>/plan` | "There is no plan in Grade 6 · Unit 4" | `plan-reviewer-1280-light.png` | **NOT WALKED**: plan is written by the first model call, which fails (finding-F-4 (#None)); the seed has none |

### SCR-8 Unit board
| Given | When | Then | Screenshot | Result |
|---|---|---|---|---|
| seeded unit, three roles | opens board | roll-up (Draft 5 · In review 1 · Submitted 2 · Approved 1 · Failed 0), tile, filter, table, links row; same for all roles | `scr8-board-reviewer-1280-light.png`, `-author-`, `-approver-` | pass |
| no approved lesson with review time | reads tile | "No approved lessons yet", "approved 0 of 10", caption "No baseline yet (AQ-14)..." (roll-up says Approved 1; seed has no review-time rows) | same | pass (seed artefact noted) |
| after send back | reads Lesson 10 row | "Changes requested · Content safety · Changes requested by Demo approver" | n/a | pass |
| empty unit (reviewer, first sign-in, no outline) | lands on board | "There is no unit..." + link to itself | n/a (text log) | finding-F-13 (#None) |
| nav rail | on board | two rail items look selected | `scr8-board-reviewer-1280-light.png` | finding-F-15 (#None) |
| filter empty, run going, failed, dependency flags, stale, tile error | n/a | not reached (seed has no failed or running rows; no polling failure induced) | n/a | not reachable (seed has none) |

### SCR-9 Lesson workspace
| Given | When | Then | Screenshot | Result |
|---|---|---|---|---|
| Compose as committed | opens L4 | stays "Connecting to the editor…"; read-only; Submit off "Saving" | `scr9-L4-reviewer-1280-light.png` | finding-F-3 (#None) |
| bridge in place | opens L4 | "Connected", toolbar, five sections, issue rail (20 blocking issues) | `scr9-L4-issues-1280-light.png` | pass |
| reviewer | types in Look Back (L13) | "Saved · 06:37" within 2.3 s; text kept | `scr9-L13-edit-saved-1280-light.png` | pass |
| first open of a draft | opens L13 | "You're the reviewer for this lesson."; draft moves to In review | `scr9-L4-edit-bridged-1280-light.png` | pass |
| blocking issues | reads footer | "20 blocking issues" with Submit off and the reason | `scr9-L4-issues-1280-light.png` | pass |
| author | opens L4 | "You're viewing as an author. Only reviewers edit lessons." | n/a | pass |
| submitted (L5) | opens | "Submitted: waiting for approval" | `scr9-L5-submitted-1280-light.png` | pass |
| approved (L6) | opens | "Approved · v3 · pinned fc75…03f6" (no approver name; seed) | `scr9-L6-approved-1280-light.png` | pass |
| reopened (L7) | opens | "Reopened. This is version 1." | `scr9-L7-reopened-1280-light.png` | pass (version text from seed) |
| changes requested (L10) | opens | "Changes requested by Demo approver / Other:" no note | `scr9-L10-changes-requested-1280-light.png` | finding-F-7 (#None) |
| schema 99 (L8), unknown node (L9) | opens | "Lesson 8 won't open. It uses schema version 99... Nothing has been dropped." and the mystery_block text | `scr9-L8-schema99-1280-light.png`, `scr9-L9-badnode-1280-light.png` | pass |
| missing lesson (L99) | opens | "There is no Lesson 99 in Grade 6 · Unit 4" | `scr9-L99-notfound-1280-light.png` | pass |
| markup in lesson (L10) and in the outline-row tab | reads | `<script>` and `<img onerror>` shown literally, no dialog, `__pwned` undefined | `scr9-outline-row-xss-1280-light.png` | pass (AC-5) |
| standards tab | opens | three codes, "from the outline", taught / checked | `scr9-L13-standards-tab-1280-light.png` | pass |
| 390 px | opens | page scrolls sideways 58 px | `scr9-workspace-390-light.png` | finding-F-9 (#None) |
| issue cards | Lighthouse | 19 buttons: label does not contain visible text | `lighthouse/scr9-desktop/report.html` | finding-F-17 (#None) |
| presence, DISCONNECTED, SCHEMA states, Submit server refusal, dependency (UXP-2) after fill, safety flag (L31), withdrawn | n/a | co-editor and disconnect need a second live editor or a killed collab; safety flag lesson not seeded | n/a | not reachable (no second editor, no L31 seed) |

### SCR-10 Insert quote or excerpt
| Given | When | Then | Screenshot | Result |
|---|---|---|---|---|
| excerpt slot open (L4 Homework) | Insert quote or excerpt… | dialog "Fill excerpt slot" with Text, Book or title, Chapter, Page, URL, rights | `scr10-dialog-1280-light.png` | pass |
| empty fields | Insert | one banner "The request is not valid." | `scr10-source-required-1280-light.png` | finding-F-11 (#None) |
| Compose as committed | Insert with text, book, pages, rights public-domain | 503 `COLLAB_UNAVAILABLE`, dialog stays | n/a (response log) | finding-F-2 (#None) |
| override in place | same | 200, "Quote inserted. Issue 1 resolved.", count 20 to 19 | `scr10-inserted-1280-light.png` | pass |
| `QUOTE_TOO_LONG`, `to-clear` toast, forbidden role, frozen | n/a | not walked | n/a | not walked (time) |

### SCR-11 Resolve or clear
| Given | When | Then | Screenshot | Result |
|---|---|---|---|---|
| quote placeholder issue | Resolve… | "Record a resolution", Reason (required), "Counted as a resolution, not a fix." | `scr11-dialog-1280-light.png` | pass |
| empty reason | Record resolution | "A resolution needs a reason. Say what was done and where." | n/a (text log) | pass |
| reason given | Record | toast "Issue resolved by Demo reviewer.", count 19 to 18 | n/a | pass |
| Clear safety flag mode | n/a | no safety-flag lesson seeded | n/a | not reachable (seed) |

### SCR-12 Candidate compare
| Given | When | Then | Screenshot | Result |
|---|---|---|---|---|
| L4 has a stored candidate version (seed) | opens `/candidates/<version id or number>` | "There is no candidate in Grade 6 · Unit 4" (route expects a generation run id) | `scr12-candidate-1280-light.png` | **not reachable**: the seed has no candidate run; the stub cannot make one (finding-F-4 (#None)) |
| L13 | Regenerate… then Regenerate | 404 `no_generation_run`; dialog "Lesson not found." | `scr12-regenerate-stub-1280-light.png` | finding-F-14 (#None) |
Compare, adopt whole, adopt one section, leave unadopted: **NOT WALKED**.

### SCR-13 AI assist panel (NL-116)
**NOT WALKED**: needs a scripted stub (`ASSIST_STUB_FILE`) or a model key; neither is part of the committed Compose stack.

### SCR-14 Approval review
| Given | When | Then | Screenshot | Result |
|---|---|---|---|---|
| approver, submitted L5 | opens from the board | checklist (5 rows), frozen text, decision card "Four eyes", rating, Approve, Request changes | `scr14-L5-approver-1280-light.png` | pass |
| header | reads | "by usr_01M5VDAFP7YNE3ZJQ44HNEHCES" | same | finding-F-6 (#None) |
| "Standards confirmed" | reads | status Done beside "not all confirmed" | same | finding-F-10 (#None) |
| no rating | Approve | "Choose a rating to approve."; focus on first radio | `scr14-rating-required-1280-light.png` | pass |
| rating chosen, Compose as committed | Approve | 500; "Couldn't reach the server. Your rating is kept. Try again." | `scr14-approve-with-blocking-1280-light.png` | seed check loader (artefact) |
| rating chosen, checks run | Approve | 422 `BLOCKED`, then page replaced by "This page couldn't load" | `scr14-blocked-1280-light.png` | finding-F-5 (#None) |
| author or reviewer | opens `/approve` | not exercised (author and reviewer got the lesson page, no approval view) | n/a | not walked |
| `STALE_PIN`, `FOUR_EYES`, `DEPENDENCY_UNAPPROVED`, success, frozen approved, network error | n/a | need a lesson with no blocking items, a second edit, or a dependency seed | n/a | not reachable (seed; NL-112) |
| CLS 0.148 desktop | Lighthouse | recorded | `lighthouse/scr14-desktop/report.html` | finding-F-18 (#None) |

### SCR-15 Send back or reopen
| Given | When | Then | Screenshot | Result |
|---|---|---|---|---|
| approver on submitted L10 | Request changes | dialog: reason radios (7 tags), required note, "usr_… will see your tag and note..." | `scr15-dialog-1280-light.png` | finding-F-6 (#None) |
| nothing chosen | Send back | "Choose a reason." and "Add a note: say what needs to change." | n/a (text log) | pass |
| Compose as committed | Send back | 503 "The editing service is unavailable. Nothing changed." | n/a | finding-F-2 (#None) |
| override, Content safety + note | Send back | 200 changes_requested, toast "Sent back to usr_…" | `scr15-sent-back-1280-light.png` | finding-F-6 (#None), finding-F-7 (#None) |
| Reopen mode, `STALE_PIN` | n/a | no approved lesson open on SCR-14 in the seed run state | n/a | **NOT WALKED** |

### SCR-16 History and provenance
| Given | When | Then | Screenshot | Result |
|---|---|---|---|---|
| L4 (v1 generated, v2 candidate) | opens History | version list with hash and Copy hash, provenance (outline-row hash, prompt, model, schema, example set, run, cost), audit log | `scr16-history-1280-light.png` | pass |
| audit rows | reads | "No audit rows for this version." (selected version is the candidate) | same | pass |
| a missing field | n/a | none shown "Missing" | n/a | pass |

### SCR-17 Run summary
| Given | When | Then | Screenshot | Result |
|---|---|---|---|---|
| seed run, no ready lessons | opens summary | stat cards each "n = 0 lessons", "No failures.", "Full-run report (file): not written yet" | `scr17-run-summary-1280-light.png` | pass (numbers are from the seed, not a run) |
| running, failures present | n/a | not reachable | n/a | not reachable (finding-F-4 (#None)) |

### SCR-18 Coverage (cut #4, built)
Opened read-only as reviewer: matrix of 10 lessons, codes with I / P / A letters and "Generator only, not confirmed by a person" (`scr18-coverage-1280-light.png`). Other states not walked. Page overflow 367 / 1021 px: finding-F-9 (#None).
### SCR-19 Unit quality (cut #6, built)
Reviewer: "No approved lessons yet" (`scr19-quality-1280-light.png`). Other states not walked.
### SCR-20 Export (cut #5, built)
Reviewer: "Export (no live integration) ... Only approvers can export." (`scr20-export-1280-light.png`). Approver export not walked (no approved lesson without blocking issues).
### SCR-21 Prompt guidance (cut #7, built)
Reviewer: read-only "Only authors edit guidance.", locked rules listed (`scr21-prompt-guidance-1280-light.png`). Author edit and trial not walked.

## axe (AC-2)

Serious or critical violations per mode (0 means clean). Every walked screen is clean in all four modes; the only layout problem is page-level overflow, filed as F-9. SCR-5, SCR-10, SCR-11 and SCR-15 were scanned with the dialog open. SCR-7, SCR-12 and SCR-13 were not reachable.

| Screen | 1280 light | 1280 dark | 390 light | 390 dark | Layout |
|---|---|---|---|---|---|
| SCR-1 Sign in | 0 | 0 | 0 | 0 | none |
| SCR-2 Units home | 0 | 0 | 0 | 0 | none |
| SCR-3 Upload outline | 0 | 0 | 0 | 0 | overflow 0/26 px: finding-F-9 (#None) |
| SCR-4 Validation report | 0 | 0 | 0 | 0 | overflow 1350/1953 px: finding-F-9 (#None) |
| SCR-5 Start run (dialog over SCR-4) | 0 | 0 | 0 | 0 | overflow 1350/1953 px: finding-F-9 (#None) |
| SCR-6 Generation progress (cancelled run) | 0 | 0 | 0 | 0 | none |
| SCR-8 Unit board | 0 | 0 | 0 | 0 | none |
| SCR-9 Lesson workspace (L4) | 0 | 0 | 0 | 0 | overflow 0/58 px: finding-F-9 (#None) |
| SCR-10 Insert quote (dialog) | 0 | 0 | 0 | 0 | overflow 0/58 px: finding-F-9 (#None) |
| SCR-11 Resolve (dialog) | 0 | 0 | 0 | 0 | overflow 0/58 px: finding-F-9 (#None) |
| SCR-14 Approval review (L5) | 0 | 0 | 0 | 0 | none |
| SCR-15 Send back (dialog) | 0 | 0 | 0 | 0 | none |
| SCR-16 History | 0 | 0 | 0 | 0 | none |
| SCR-17 Run summary | 0 | 0 | 0 | 0 | none |
| SCR-18 Coverage | 0 | 0 | 0 | 0 | overflow 367/1021 px: finding-F-9 (#None) |
| SCR-19 Unit quality | 0 | 0 | 0 | 0 | none |
| SCR-20 Export | 0 | 0 | 0 | 0 | none |
| SCR-21 Prompt guidance | 0 | 0 | 0 | 0 | none |

## Lighthouse (AC-3)

Run with the Chrome DevTools MCP (`lighthouse_audit`, navigation mode) signed in as the approver. Targets: accessibility 95 or more, best practices 90 or more. All six reports are linked. **The MCP audit excludes the performance category**, so no performance score was produced; the only performance figure is Cumulative Layout Shift (below). No performance trace was run. Machine load average at the start of each run was **9.6 to 10.7** (another job was running; `uptime` before the first run: 9.61, 9.06, 9.96); it never fell under the 4 the ticket asks for, so the runs were not repeated. Every score was 100, so load could not have lowered a gated score; the CLS values may be inflated by it.

| Screen | Device | Accessibility | Best practices | CLS | Report |
|---|---|---|---|---|---|
| SCR-8 board | desktop | 100 | 100 | 0.04 | [report](lighthouse/scr8-desktop/report.html) |
| SCR-8 board | mobile | 100 | 100 | 0.041 | [report](lighthouse/scr8-mobile/report.html) |
| SCR-9 workspace L4 | desktop | 100 (audit `label-content-name-mismatch` fails: finding-F-17 (#None)) | 100 | 0.114 (finding-F-18 (#None)) | [report](lighthouse/scr9-desktop/report.html) |
| SCR-9 workspace L4 | mobile | 100 (same failed audit) | 100 | not flagged | [report](lighthouse/scr9-mobile/report.html) |
| SCR-14 approval L5 | desktop | 100 | 100 | 0.148 (finding-F-18 (#None)) | [report](lighthouse/scr14-desktop/report.html) |
| SCR-14 approval L5 | mobile | 100 | 100 | not flagged | [report](lighthouse/scr14-mobile/report.html) |

SCR-9 was audited without the editor socket (Compose as committed), so the read view was measured, not the live editor.

## Other acceptance checks

- **AC-5 (negative):** outline text and lesson text are never rendered as HTML: SCR-4 (author and reviewer), SCR-9 outline-row tab and L10 body showed `<img src=x onerror=alert(1)>`, `<script>` and `<img ... onerror=window.__pwned=1>` as literal text; no dialog fired (dialog listener count 0) and `window.__pwned` stayed undefined. `grep -rniE 'replace(s)? (the )?writers' apps/web/app apps/web/src` prints nothing. Copy frames the tool as expert-driven on every screen read (GR-16); no sentence suggests replacing writers.
- **Visual check against D1 Clear Ledger and `docs/design/design.md`:** I opened the board, approval, upload, regenerate-dialog screenshots: tokens, type, status glyph plus word plus colour and the shell look consistent with the system. The other screenshots were captured (all four modes) but not each opened, and no look-sheet page was opened side by side, so a **side-by-side review against the look sheet remains for a human** (NEEDS_HUMAN_REVIEW).

## Findings

| ID | Severity | Finding | Issue |
|---|---|---|---|
| F-1 | blocking | SCR-4: confirming the unit error sends `U4`; server answers 422 so Generate can never turn on | #None |
| F-2 | blocking | Compose sets COLLAB_INTERNAL_URL without /internal: every web-to-collab command returns 503 COLLAB_UNAVAILABLE | #None |
| F-3 | blocking | Compose: the browser editor never connects (no /collab route, NEXT_PUBLIC_COLLAB_URL unset), so SCR-9 cannot edit or submit | #None |
| F-4 | blocking | Compose stub mode cannot generate: every model call throws 'unscripted stub call'; the run sits in Planning forever with no message | #None |
| F-5 | major | SCR-14: Approve refused with BLOCKED (422) crashes the page to 'This page couldn't load' | #None (fixed on fix/nl126-G3) |
| F-6 | major | SCR-14/15: raw user ids shown instead of names (header, send-back dialog, toast) | #None (fixed on fix/nl126-G3) |
| F-7 | major | SCR-14/SCR-9: after Send back the banner shows tag 'Other:' and no note (board shows Content safety) | #None (fixed on fix/nl126-G3) |
| F-8 | major | SCR-4: 'Confirm fix' proposes a single code (`RL.6.9`) for a Focus cell that lists 5 to 16 codes | #None |
| F-9 | major | Pages scroll sideways: SCR-4/SCR-5 overflow by 1350 px at 1280 and 1953 px at 390; SCR-18, SCR-9/10/11 and SCR-3 also overflow at 390 | #None |
| F-10 | major | SCR-14: checklist row 'Standards confirmed' shows status Done while its text says 'not all confirmed' | #None (fixed on fix/nl126-G3) |
| F-11 | minor | SCR-10: empty Insert shows the generic 'The request is not valid.' instead of the field messages | #None |
| F-12 | minor | SCR-3: choosing an unsupported file shows 'Choose a file first.' and 'This file type isn't supported' together | #None |
| F-13 | minor | SCR-8: board for a unit with no outline says 'There is no unit "g6-u4"' with a 'Back to the board' link to itself | #None |
| F-14 | minor | SCR-12: Regenerate on a lesson with no generation run says 'Lesson not found.' | #None |
| F-15 | minor | Nav rail: 'Units' and 'Unit board' both show the selected style on the board and approval pages | #None |
| F-16 | minor | SCR-1: the three demo accounts box from the spec is missing | #None |
| F-17 | minor | SCR-9: 19 issue-card buttons fail Lighthouse 'label-content-name-mismatch' (aria-label does not contain the visible text) | #None |
| F-18 | minor | Cumulative Layout Shift above 0.1 on SCR-14 (0.148) and SCR-9 (0.114) on desktop | #None |

## Rows with no UX-5b evidence

SCR-7 (no stored plan), SCR-12 (no candidate run) and SCR-13 (no assist model) have no walked evidence; each is a consequence of finding-F-4 (#None) and of NL-112 not having run. Their TRACEABILITY cells say NOT WALKED and link to the section above.

## Cleanup

`docker compose -p nlqa down -v` and removal of the `ls-node` / `ls-web` images, after the walk; the shared test Postgres on 55440 was not touched.
