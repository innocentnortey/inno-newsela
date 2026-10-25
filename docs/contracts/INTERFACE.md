# UX-3a · Shared contracts — Newsela Lesson Studio

> **Status:** every card is `proposed`. None is `agreed`. **Date:** 2026-10-25.
> **Owner:** the joint track (UX-3a). The UX session owns the *needs* in each card; the System session owns the
> *support*. Innocent decides every product-behaviour question.
> **Process:** zero-to-hero 2.0.0, revision
> [`2026-10-25-concurrent-frontend.md`](../../../.claude/skills/zero-to-hero/proposals/2026-10-25-concurrent-frontend.md) §2
> (approved by Innocent, 2026-10-25).
> **Machine form:** [`interface.openapi.yaml`](interface.openapi.yaml) (OpenAPI 3.1, draft 0.1.0). Generated types, Prism
> mocks and contract checks read that one file. **Change log:** [`CHANGES.md`](CHANGES.md).
> **Sources, highest first:** the issued brief; Innocent's recorded decisions; PRD
> [v1.0](../prd/newsela-prd.md) (§5.3 rows, with **§5.4 amendments winning**; §8 guardrails; §10 decisions); the
> [hard-problem register](../design/hard-problems.md) (HP-1…HP-10, all chosen); UX-1
> ([flows](../ux/01-planning/USER_FLOWS.md), [stories](../ux/01-planning/USER_STORIES.md),
> [sitemap](../ux/01-planning/SITEMAP.md)). Example data comes from the
> [worked pairs](../data/worked-pairs.md). Synthetic accounts only. Nothing here quotes `docs/source/restricted/`.

## How this file works

**What a card is.** A card is one promise the backend makes to one or more screens. For example, CON-18 promises: "an
approve call that carries an old snapshot hash returns 409 `STALE_PIN` and changes nothing." The screen relies on that
promise. The backend must keep it. The card says what the screen sends, what it gets back, which states it can cause,
who may call it, which errors it can return, what happens next, what is guaranteed, and how fast.

**Who owns what.**

| Side | Owns | Example |
|---|---|---|
| UX (the screens) | The **need**: which operations, fields, states and errors a screen must be able to show | SCR-14 needs the snapshot hash so it can send it back on Approve |
| System (the backend) | The **support**: whether it is feasible, what is guaranteed, how fast, which errors it can promise | The collaboration server can lock, flush and snapshot the lesson at Submit within the store budget |
| Both | Review every card, each with a named reviewer and a date, recorded separately | UX review done 2026-10-25; System review pending |
| Innocent | Every **product-behaviour** question in a card | Who may reopen an approved lesson (UXP-4) |

**Behaviour versus presentation.** A *behaviour* change alters what the product does or means: adding a state, changing
who may act, changing what "approved" means, adding a reservation. It needs both reviews, and Innocent's decision when
it changes product meaning. A *presentation* change alters only how something looks or where it sits: moving the
checklist into a sidebar, renaming a button label. Presentation notes are kept in their own field on each card and are
not part of the promise.

**Status words.** `draft` (UX-1 one-liner) → `proposed` (full card, waiting for reviews) → `agreed` (both sides reviewed,
every product question decided). `changing` marks an agreed card under a logged `CHG-N` (see [`CHANGES.md`](CHANGES.md)).
**A card becomes `agreed` only when** the System review is recorded and every open question linked in it has
Innocent's decision. No frontend or backend feature ticket may rely on a card before then (revision §3).

**Choosing a visual direction at UX-2 decided none of the behaviour questions below.** A look sheet sets colour, type
and layout. It says nothing about who may reopen a lesson or what starts a review.

**Labels.** [T] a target · [A] an assumption we chose and would check · [I] our inference · [M] a measurement.

## Card index

| Card | Promise | Status | Blocked by an open product question | Backend owner |
|---|---|---|---|---|
| [CON-1](#con-1) | Session and role | proposed | — | web app |
| [CON-2](#con-2) | Outline versions | proposed | — | web app |
| [CON-3](#con-3) | Validation report | proposed | — | web app |
| [CON-4](#con-4) | Intake choices | proposed | — | web app |
| [CON-5](#con-5) | Start a run | proposed | UXP-5 | web app (creates jobs for the worker) |
| [CON-6](#con-6) | Run progress | proposed | UXP-5 | web app (reads the worker's job rows) |
| [CON-7](#con-7) | Run control | proposed | UXP-5 | web app + worker |
| [CON-8](#con-8) | Unit plan | proposed | — | web app |
| [CON-9](#con-9) | Unit board | proposed | UXP-1, UXP-2, UXP-6 | web app |
| [CON-10](#con-10) | Unit metrics | proposed | — | web app |
| [CON-11](#con-11) | Lesson read | proposed | UXP-1, UXP-6 | web app |
| [CON-12](#con-12) | Collaboration channel (Yjs socket) | proposed | — | collaboration server |
| [CON-13](#con-13) | Issue list | proposed | UXP-2 | web app (checks run in the worker or collaboration server) |
| [CON-14](#con-14) | Resolve and confirm | proposed | — | web app + collaboration server |
| [CON-15](#con-15) | Fill a placeholder or slot | proposed | UXP-2 | web app + collaboration server |
| [CON-16](#con-16) | Candidates | proposed | UXP-3 | web app + worker + collaboration server |
| [CON-17](#con-17) | AI suggestions | proposed | UXP-3 | web app |
| [CON-18](#con-18) | Lesson transitions | proposed | UXP-1, UXP-2, UXP-4, UXP-6, UXP-10 (GAP-2 rides with UXP-1 and UXP-4) | web app + collaboration server |
| [CON-19](#con-19) | Lesson history | proposed | — | web app |
| [CON-20](#con-20) | Review heartbeats | proposed | — | web app |
| [CON-21](#con-21) | Run summary | proposed | — | web app |
| [CON-22](#con-22) | Coverage matrix | proposed | — | web app |
| [CON-23](#con-23) | Export | proposed | — | web app |
| [CON-24](#con-24) | Prompt versions | proposed | — | web app |

**Count** (*calculation*): 24 cards, all `proposed`; 10 are also blocked by an open product question (CON-5, 6, 7, 9, 11,
13, 15, 16, 17, 18). "Backend owner" names the process from PRD §9 (a Next.js web app, one Node service running the worker
and the Hocuspocus collaboration server). The System review may move an owner.

## Shared definitions (every card uses these)

### Roles (R-54)

| Role | Persona | Does |
|---|---|---|
| `author` | P-2, outline author | uploads outlines, confirms the report, starts and controls runs, edits prompt guidance |
| `reviewer` | P-1, LXD reviewer | edits lessons, fills slots, confirms standards, records resolutions, clears safety flags, submits, withdraws |
| `approver` | P-3, approver / content lead | approves, requests changes, reopens (UXP-4), clears safety flags (U9), exports |

One role per account. A person who does two jobs uses two accounts (PD-25). The server enforces the role on every HTTP
operation **and** on the socket (R-54). Hiding a button is never the guard.

### Lesson states and the moves between them (R-33 as amended in PRD §5.4, HP-5)

| From | Move | To | Who | Card |
|---|---|---|---|---|
| — | v1 stored after generation | `draft` | worker | CON-6 |
| — | still failing after one repair | `generation_failed` | worker | CON-6 |
| `generation_failed` | a retry succeeds | `draft` | author (CON-7) or reviewer (CON-16) | CON-7, CON-16 |
| `draft` | a reviewer starts the review (UXP-1) | `in_review` | reviewer | CON-18 |
| `in_review`, `changes_requested`, `reopened` | Submit: zero blocking issues; the lesson freezes | `submitted` | reviewer | CON-18 |
| `submitted` | Withdraw (audit event `withdrawn`) | `in_review` | reviewer | CON-18 |
| `submitted` | Request changes, with a tag and a note | `changes_requested` | approver | CON-18 |
| `submitted` | Approve the pinned snapshot, with a rating | `approved` | approver | CON-18 |
| `approved`, `exported` | Reopen, with a reason (UXP-4) | `reopened` (a new version) | approver | CON-18 |
| `approved` | included in an export | `exported` | approver | CON-23 |

- **Editable** (the socket accepts writes): `in_review`, `changes_requested`, `reopened`.
- **Frozen** (read-only for everyone): `submitted`, `approved`, `exported`.
- `draft` is read-only until the review starts (UXP-1). `generation_failed` has no v1, so there is nothing to edit.

### Run states (R-16 as amended, HP-7) and tile states (R-17)

- **Run:** `planning` (the one UnitPlan call) → `running` → `complete` (every lesson ready; name per UXP-8) · `partial`
  (some failed, the rest ready) · `capped` (the next call would pass the cap) · `paused` (3 lessons in a row failed the
  same check) · `cancelled`. `paused` → `running` by Resume. `partial` → `running` by Retry failed. `capped` and
  `cancelled` do not restart (UXP-5 for `capped`).
- **Tile (one per lesson):** `queued`, `planning`, `drafting`, `checking`, `repairing`, `ready`, `failed`.

### Issue levels (HP-3)

- `blocking`: stops Submit and Approve.
- `confirmation`: a `narrowed` or `added` standard. Blocks like a blocking issue. Counts in neither V-1 nor G-1.
- `advisory`: shown, never blocks.

### Error envelope and the named errors

Every refusal returns `{ "error": { "code": "<CODE>", "message": "<plain words>", "details": { … } } }`. The `code` is
one of the names below. The `message` is what the screen may show. HTTP statuses are **proposed** except where a
source fixes them (403 for the wrong role, R-54; 409 for a stale pin, R-33).

| Code | HTTP | When | Cards |
|---|---|---|---|
| `UNAUTHENTICATED` | 401 | no valid session (added at UX-3a; every operation needs a session) | all |
| `NOT_ON_ALLOW_LIST` | 403 | the email is not on the staff list | CON-1 |
| `ROLE_FORBIDDEN` | 403 | the caller's role may not do this | every action card |
| `NOT_FOUND` | 404 | the unit, version, run, lesson or item does not exist (added at UX-3a) | all |
| `INVALID_TRANSITION` | 409 | the move is not allowed from the current state, e.g. Resume on a run that is not paused (added at UX-3a) | CON-7, CON-18 |
| `SHEET_NOT_PUBLIC` | 422 | the sheet link is private | CON-2 |
| `UNSUPPORTED_FILE` | 422 | not CSV or XLSX | CON-2 |
| `HEADER_NOT_FOUND` | 422 | no header row matched the column names | CON-2 |
| `TOO_MANY_ROWS` | 422 | over 200 rows [T] | CON-2 |
| `VALIDATION_INCOMPLETE` | 422 | an intake error is still unconfirmed | CON-5 |
| `DAY_CAP_REACHED` | 422 | the per-day spend cap would be passed | CON-5, CON-16 |
| `SCHEMA_UNKNOWN` | 422 | the stored lesson's `schema_version` is unknown | CON-11 |
| `LESSON_LOCKED` | 409 | the lesson is frozen or approved, so this write or AI tool is refused | CON-12, CON-14, CON-15, CON-16, CON-17 |
| `REASON_REQUIRED` | 422 | a resolution, a reopen or a guidance save has no reason | CON-14, CON-18, CON-24 |
| `NOTE_REQUIRED` | 422 | a safety-flag clear or a request for changes has no note | CON-14, CON-18 |
| `SOURCE_REQUIRED` | 422 | a quote or excerpt has no source | CON-15 |
| `QUOTE_TOO_LONG` | 422 | a `short-quote-commentary` quote is over 12 words | CON-15 |
| `ANCHOR_CHANGED` | 409 | the text under a suggestion changed | CON-17 |
| `MODEL_UNAVAILABLE` | 503 | the model call failed | CON-17 |
| `BLOCKED` | 422 | a blocking issue stands (on the stored copy or on the re-run) | CON-18 |
| `CONFIRMATION_OPEN` | 422 | a `narrowed` or `added` standard is unconfirmed | CON-18 |
| `SUGGESTION_PENDING` | 422 | an AI suggestion is neither accepted nor rejected | CON-18 |
| `NOT_STORED` | 409 | the submitter's edits are not stored yet | CON-18 |
| `STALE_PIN` | 409 | the pinned hash or state vector no longer matches the snapshot | CON-18 |
| `FOUR_EYES` | 422 | the approver was the last stored editor | CON-18 |
| `RATING_REQUIRED` | 422 | Approve has no draft-quality rating | CON-18 |
| `DEPENDENCY_UNAPPROVED` | 422 | a lesson this one links to is not approved | CON-18 |

`DISCONNECTED` is a **channel state** on CON-12, not an HTTP error.

### Guarantees every card shares

1. **Wrong role → `ROLE_FORBIDDEN`, on the server**, for every action (R-54; UX-1 note).
2. **A refused call changes nothing**: no state, version, approval, audit or spend row (R-33's acceptance criterion for a
   stale pin, applied to every refusal [I]; System review to confirm).
3. **Lesson content is written only through the collaboration server** (CON-12). HTTP operations that change content
   (CON-14 standards, CON-15, CON-16 adopt) hand the change to it as a logged edit by a named person, through a
   server-side connection. Every other reader uses the stored derived row or an immutable snapshot (HP-4, R-26, R-29).
4. **Every person's action is in the append-only audit log**: who, when, from, to, version hash, reason (R-35).
5. **Reads never change state** [I, proposed at UX-3a]. That is why UXP-1's "opening starts the review" is an explicit
   CON-18 call the workspace makes, not a side effect of CON-11.
6. **Text from the outline or the model is returned as text, never as HTML** (R-58).
7. **One lesson per call** on every transition. No bulk approve (GR-6, R-33).
8. **No route returns review minutes with a person's name** (GR-15, HP-8).
9. **Progress is polled, never streamed** (PD-18).

### Timing in one place

| What | Number | Source |
|---|---|---|
| Progress and board polling | every 2 s; a tile shows a state change within 3 s [T] | PD-18, R-17 |
| Editor store debounce | ≤ 2 s [T] | R-26 |
| Store transaction | p95 ≤ 500 ms [T] | HP-4 |
| Remote edit visible to a co-editor | p95 < 300 ms [T] | R-56 (cut #1) |
| Edit durably stored | p95 < 3 s [T] | R-56 (cut #1) |
| Checks re-run after a store | ≤ 5 s [T] | R-28 |
| Lesson open (editor ready with content) | p95 < 1.5 s [T] | R-57 |
| Unit board (~47 rows) | p95 < 1 s [T] | R-57 |
| Heartbeats | every 15 s while focused, visible and touched in the last 60 s [A] | R-49, HP-8 |
| Generation | p95 ≤ 5 min per lesson [T]; 47 days within 2 h [T]; ≤ $1 per lesson [T] | R-55 |
| Concurrency | cap 4–6 [A], starting at 4 | PD-13, HP-7 |

---

<a id="con-1"></a>

## CON-1 · Session and role

**Status:** proposed · **Blocked by:** no open product question · **Backend owner:** web app

- **Needed by:** SCR-1 and every screen's header · US-37 · FLOW-1.
- **Operation(s):**
  - `signIn` — sign in with an allow-listed staff email → a session with one role.
  - `getSession` — who am I, and with which role.
  - `signOut` — end the session.
- **Fields:**
  - Request (`signIn`): `email` (text, an email address). The sign-in method (link, password or code) is a System choice;
    it may add one proof field. The screens need only the session and the role.
  - Response: `user` with `user_id` (text), `name` (text), `email` (text), `role` (one of `author`, `reviewer`,
    `approver`), `synthetic` (yes/no: an account Claude or a load script drives, HP-8).
- **States:** signed out → signed in with a role. Sign-out returns to signed out.
- **Permissions:** `signIn` is open to anyone. `getSession` and `signOut` need a session.
- **Named errors:**
  - `NOT_ON_ALLOW_LIST` — the email is not on the staff list. Changes nothing; still signed out.
  - `UNAUTHENTICATED` — `getSession` without a session. Changes nothing.
  - `ROLE_FORBIDDEN` — returned by every *other* card when the role lacks the action. Defined here, used everywhere.
- **Recovery:** an unknown email sees "This email is not on the staff list" and stays on SCR-1. A refused action keeps the
  person on their screen with the server's message ("Only approvers can approve").
- **Guarantees:**
  - Roles are enforced on the API and on the socket (R-54).
  - Staff accounts only; no student or teacher-of-record data (GR-13).
  - The demo seeds one account per role (R-54), plus the `synthetic` flag for Claude-driven accounts (HP-8, PD-25).
- **Timing:** none set.
- **Presentation notes:** an author lands on SCR-2; a reviewer or approver lands on SCR-8 (FLOW-1). The landing choice is
  the frontend's, from the role.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: pending — the System track has not started. Must confirm: the sign-in method and any extra field; the
    session mechanism the socket accepts (CON-12); how `synthetic` is set and by whom.
- **Open behaviour questions:** none.

<a id="con-2"></a>

## CON-2 · Outline versions

**Status:** proposed · **Blocked by:** no open product question · **Backend owner:** web app

- **Needed by:** SCR-2, SCR-3 · US-1, US-2 · FLOW-2.
- **Operation(s):**
  - `listUnits` — units with their outline versions and latest run.
  - `uploadOutline` — upload a CSV or XLSX file → a new outline version.
  - `importOutlineLink` — import a public Google Sheet link → a new outline version.
- **Fields:**
  - Request (`uploadOutline`): the file (bytes; CSV or XLSX). (`importOutlineLink`): `sheet_url` (text, a URL).
  - Response (both): `outline_version_id` (text), `unit_id` (text, e.g. `G6.U4`), `version_number` (whole number),
    `sha256` (text, 64 hex characters), `same_as_version` (whole number or empty), `changed_lessons` (whole number),
    `row_counts` (`lessons`, `flex_days`, `arc_headers`, `total_rows`: whole numbers), `created_at` (date-time),
    `created_by` (user name).
  - Response (`listUnits`): a list of units, each with `unit_id`, `title` (text, "Grade 6 · Unit 4"), `versions` (the
    fields above, newest first) and `latest_run` (`run_id`, `state`, or empty).
- **States:** a successful upload stores outline version N, immutable. A failed upload stores nothing.
- **Permissions:** `listUnits`: every role. `uploadOutline`, `importOutlineLink`: `author`. Wrong role → `ROLE_FORBIDDEN`.
- **Named errors:**
  - `SHEET_NOT_PUBLIC` — the link is private. Nothing stored.
  - `UNSUPPORTED_FILE` — not CSV or XLSX. Nothing stored.
  - `HEADER_NOT_FOUND` — no header row found; `details.columns_looked_for` lists the names searched. Nothing stored.
  - `TOO_MANY_ROWS` — over 200 rows [T]. Nothing stored.
- **Recovery:** the author shares the sheet publicly or uploads the file, fixes the file, or splits it. On success the
  screen opens the report (CON-3).
- **Guarantees:**
  - Each upload is a new immutable version with its SHA-256; re-uploading touches no lesson (R-1).
  - The same bytes twice give version 2 with `same_as_version: 1` and `changed_lessons: 0` (R-1's acceptance criterion).
  - The normalizer is deterministic and makes no model call (PD-27, HP-6).
  - A private sheet gets a plain message, never a stack trace (R-2).
- **Timing:** none set. Parsing ≤ 200 rows is synchronous [A].
- **Presentation notes:** the one-unit Units home (UXP-9) is presentation; this card is needed for R-1's version list
  either way.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: pending — the System track has not started. Must confirm: how an upload is matched to an existing unit
    (the sheet says U4, the filenames say U3; the unit is confirmed in CON-4); whether parsing stays synchronous; the
    sheet-export fetch for links.
- **Open behaviour questions:** none.

<a id="con-3"></a>

## CON-3 · Validation report

**Status:** proposed · **Blocked by:** no open product question · **Backend owner:** web app

- **Needed by:** SCR-4 · US-3, US-4, US-5 · FLOW-2, FLOW-3.
- **Operation(s):** `getValidationReport` — an outline version → its report.
- **Fields:**
  - Response:
    - `outline_version_id`, `version_number`, `sha256`, `same_as_version`.
    - `unit`: `as_written` (text, "U4"), `filenames_say` (text, "U3"), `confirmed` (yes/no), `confirmed_by` (name or empty).
    - `counts` (whole numbers): `teaching_days`, `lessons`, `flex_days`, `arc_headers`, `total_rows`, `errors`,
      `errors_unconfirmed`, `warnings`, `unit_conflicts`, `malformed_codes`, `rows_with_nonexistent_code`,
      `bad_filenames`, `eld_mismatches`.
    - `rows`: each with `row_number`, `kind` (`lesson`, `flex_day`, `arc_header`, `total`), `lesson_id` (text or empty),
      `level` (`ok`, `info`, `warning`, `error`) and:
      - `findings`: `finding_id`, `level`, `kind` (e.g. `malformed_code`, `nonexistent_code`, `parent_code`,
        `unit_conflict`, `vocabulary_over_cap`, `homework_links_later_row`), `column`, `original_text`,
        `proposed_fix`, `choice` (`value`, `source` = `default` or `confirmed`, `by`, `at`).
      - `segments`: the cell split. `segment_id`, `column`, `kind` (`content`, `writer_task`, `editor_note`,
        `unit_rule`, `safety_note`), `text`, `action` for notes (`apply`, `show_only`, `ignore`), `source`, `by`.
      - `eld`: `code`, `sheet_label`, `official_strand`, `verdict` (`fits`, `mismatch`, `not_checked`),
        `suggested_remap`, `choice` (`keep` or `remap`).
      - `flags`: e.g. `instruction_shaped` (kept as content).
    - `unit_rules`: `text`, `scope_rows` (list of whole numbers), `source`.
    - `generate_allowed` (yes/no).
- **States:** reading the report changes nothing. `generate_allowed` turns true when `errors_unconfirmed` is 0.
- **Permissions:** every role may read.
- **Named errors:** `NOT_FOUND` — no such version.
- **Recovery:** the author works through the errors with CON-4, then presses Generate (CON-5).
- **Guarantees:**
  - The issued sheet reproduces R-5's counts exactly: 47 teaching days, 1 unit conflict, 1 malformed code, 3 rows with a
    non-existent code, 2 bad filenames, 7 ELD mismatches (R-5, HP-6). WP-5 shows OK with 0 warnings.
  - Only **errors** block Generate; every warning carries a stored default (R-5 as amended, HP-6).
  - Two reads of the same version give byte-identical reports; no model call happens before a run (HP-6).
  - Cell text is returned as text, never markup (R-58). Instruction-shaped text is flagged and kept as `content` (R-6).
- **Timing:** none set.
- **Presentation notes:** grouping (errors first, then warnings) and the counts strip are presentation.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: pending — the System track has not started. Must confirm: the finding-kind list (System owns it);
    whether the report is stored or recomputed (it must stay byte-identical either way).
- **Open behaviour questions:** none.

<a id="con-4"></a>

## CON-4 · Intake choices

**Status:** proposed · **Blocked by:** no open product question · **Backend owner:** web app

- **Needed by:** SCR-4 · US-3, US-4, US-5 · FLOW-3.
- **Operation(s):** `recordIntakeChoice` — one choice on one finding, segment or ELD code → the updated row and counts.
- **Fields:**
  - Request: `target_id` (text: a finding, segment or ELD entry), `kind` (one of `confirm_unit`, `confirm_fix`,
    `edit_fix`, `set_note_action`, `change_split`, `set_unit_rule_scope`, `eld_keep`, `eld_remap`,
    `confirm_safety_note`, `reject_safety_note`), `value` (text or list, depending on the kind).
  - Response: the updated `row` (as in CON-3), the new `counts`, `generate_allowed`.
- **States:** a finding moves from `default` to `confirmed by <name>`. When the last error is confirmed,
  `generate_allowed` becomes true. A confirmed `safety_note` becomes a safety flag at generation (HP-9).
- **Permissions:** `author`. Wrong role → `ROLE_FORBIDDEN`.
- **Named errors:** `NOT_FOUND` — no such target. Changes nothing.
- **Recovery:** the author makes another choice; every choice can be changed until a run starts (see System review).
- **Guarantees:**
  - Each choice is stored as `default` or `confirmed by <name>` and shown later in the lesson's evidence pane (R-5, HP-6).
  - A re-map of an ELD code is logged with the author's name; the code stays the record unless re-mapped (R-4, DIR-5).
  - Notes default to *apply* (HP-6, U1). Writer tasks default to excerpt slots (HP-6).
  - Safety notes: pattern rules propose, the author confirms (PD-26, HP-9).
- **Timing:** none set.
- **Presentation notes:** inline controls versus a side panel are presentation.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: pending — the System track has not started. Must confirm: whether choices freeze once a run starts
    from this version (a version is immutable, R-1; its choices must not change under a running run [I]), and what
    error a late change returns.
- **Open behaviour questions:** none.

<a id="con-5"></a>

## CON-5 · Start a run

**Status:** proposed · **Blocked by:** UXP-5 · **Backend owner:** web app (creates the jobs the worker claims)

- **Needed by:** SCR-4, SCR-5, SCR-21 · US-6, US-10, US-36 · FLOW-3, FLOW-4, FLOW-18, FLOW-19.
- **Operation(s):** `startRun` — scope, prompt version and cap → a run. A **one-lesson trial** uses the same call and
  writes a candidate (CON-16) instead of a lesson.
- **Fields:**
  - Request: `outline_version_id` (text), `mode` (`run` or `trial`), `scope` (`all`, or a list of row numbers such as
    8, 9, 25), `lesson_id` (text, trial only), `prompt_version_id` (text: one locked layer + one guidance version),
    `cap_usd` (money amount).
  - Response: `run_id`, `state` (`planning`), `mode`, `scope`, `prompt_version_id`, `cap_usd`, `spent_usd` (0),
    `created_by`, `created_at`.
- **States:** creates a run in `planning`. In a full run, no lesson job starts before the UnitPlan is stored (R-8).
- **Permissions:** `author`. Wrong role → `ROLE_FORBIDDEN` ("Only authors can start a run").
- **Named errors:**
  - `VALIDATION_INCOMPLETE` — an intake error is unconfirmed; `details.errors_unconfirmed` gives the count. No run.
  - `DAY_CAP_REACHED` — the day's spend cap would be passed. No run.
  - `ROLE_FORBIDDEN` — not an author. No run.
- **Recovery:** confirm the report (CON-4), lower the scope or cap, or wait for the next day.
- **Guarantees:**
  - Refused **before any spend**; the Generate control and the API both refuse (R-5).
  - The run pins one prompt version; changing guidance later leaves it unchanged (R-38).
  - The run never exceeds its cap: reserve-then-settle before every call (R-16 as amended, HP-7, PD-14).
  - Jobs are idempotent per (run, lesson, prompt version, schema version) (R-16).
  - A trial writes a candidate, never an overwrite (R-39).
  - **Pending UXP-5:** to finish a capped run, the author starts a new run on the unfinished rows with a new cap; a cap is
    never raised in place.
- **Timing:** p95 ≤ 5 min per lesson [T]; the 47-day unit within 2 h [T] at the concurrency cap (R-55).
- **Presentation notes:** the dialog may suggest a cap; the number comes from PD-14 after SP-1.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: pending — the System track has not started. Must confirm: the day-cap check (run cap plus today's
    spend, or reservations); whether a trial counts against the day cap; the scope form for "unfinished rows of run X"
    if UXP-5 is kept.
- **Behaviour questions:** [UXP-5](#uxp-5) — decided 2026-10-25 (recommendation adopted; see below). Still `proposed` only because the System review is pending.

<a id="con-6"></a>

## CON-6 · Run progress

**Status:** proposed · **Blocked by:** UXP-5 · **Backend owner:** web app (reads the worker's `lesson_job` rows)

- **Needed by:** SCR-6, SCR-2 · US-7, US-8, US-36 · FLOW-4, FLOW-5, FLOW-19.
- **Operation(s):** `getRunProgress` — a run → its state and one tile per lesson. Polled.
- **Fields:**
  - Response: `run_id`, `state` (run state), `paused_reason` (`check`, `lesson_ids`, or empty), `spent_usd`,
    `reserved_usd`, `cap_usd`, `concurrency_cap` (whole number), `counts_by_tile_state`, `updated_at`, and `tiles`:
    `lesson_id`, `number`, `title`, `tile_state`, `attempts`, `repair_used` (yes/no), `truncation_retry_used` (yes/no),
    `failure_reasons` (list of `check` + `message`), `cost_usd`, `openable` (yes/no).
- **States:** reports states the worker sets. A `ready` tile means the lesson is stored as `draft` v1 with provenance. A
  `failed` tile means `generation_failed` with reasons. The run ends `complete`, `partial`, `capped`, `paused` or
  `cancelled`.
- **Permissions:** every role may read.
- **Named errors:** `NOT_FOUND`. The run states `capped`, `paused`, `partial` are **states**, not errors.
- **Recovery:** `partial` → Retry failed (CON-7). `paused` → read the repeated failure, then Resume (CON-7). `capped` →
  start a new run on the rest (UXP-5). A `ready` lesson opens in SCR-9 while others draft.
- **Guarantees:**
  - A lesson still failing after one repair is `generation_failed` with its reasons (R-19).
  - A cut-off draft gets one retry at a raised output limit, not counted as the repair (HP-7).
  - After a worker restart the run carries on at the next unfinished lesson; no lesson is stored twice; no completed
    call is paid for again; calls lost in flight are at most the concurrency cap and counted (R-16 as amended, HP-7).
  - Spend never passes the cap (HP-7).
- **Timing:** polled every 2 s; each tile reflects a change within 3 s [T] (R-17, PD-18).
- **Presentation notes:** tile layout and the cost meter are presentation. The label `complete` is UXP-8 (naming only).
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: pending — the System track has not started. Must confirm: the 3 s freshness under 25 polling clients;
    whether `reserved_usd` is shown; the failure-reason vocabulary.
- **Behaviour questions:** [UXP-5](#uxp-5) (is `capped` final?); [UXP-8](#uxp-8) is naming only — decided 2026-10-25 (recommendation adopted; see below). Still `proposed` only because the System review is pending.

<a id="con-7"></a>

## CON-7 · Run control

**Status:** proposed · **Blocked by:** UXP-5 · **Backend owner:** web app + worker

- **Needed by:** SCR-6 · US-8 · FLOW-5.
- **Operation(s):** `controlRun` — `cancel`, `retry_failed` or `resume` → the new run state.
- **Fields:**
  - Request: `action` (one of `cancel`, `retry_failed`, `resume`).
  - Response: `run_id`, `state`, `requeued_lessons` (list of lesson IDs).
- **States:** `retry_failed`: failed lessons → `queued`, run `partial` → `running`. `resume`: `paused` → `running`.
  `cancel`: any active state → `cancelled`.
- **Permissions:** `author`. Wrong role → `ROLE_FORBIDDEN`.
- **Named errors:**
  - `INVALID_TRANSITION` — e.g. Resume on a run that is not paused, or any action on a `cancelled` or `capped` run.
    Changes nothing.
  - `ROLE_FORBIDDEN`.
- **Recovery:** the screen reloads the progress (CON-6) and shows the real state.
- **Guarantees:**
  - Cancel: calls in flight finish and are stored; no new calls start (HP-7).
  - Retry failed re-runs only the failed lessons; the ready lessons' hashes do not change (HP-7 truncation test).
  - Retries stay under the run's cap (reserve-then-settle, HP-7).
  - **Pending UXP-5:** there is no "raise the cap" action.
- **Timing:** the new state shows on the next poll (≤ 2 s).
- **Presentation notes:** which buttons show for which state is presentation; the server still refuses the rest.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: pending — the System track has not started. Must confirm: the lease and SIGTERM behaviour behind
    cancel; whether retry is allowed on `complete` (no failures, so a no-op).
- **Behaviour questions:** [UXP-5](#uxp-5) — decided 2026-10-25 (recommendation adopted; see below). Still `proposed` only because the System review is pending.

<a id="con-8"></a>

## CON-8 · Unit plan

**Status:** proposed · **Blocked by:** no open product question · **Backend owner:** web app

- **Needed by:** SCR-7 · US-9 · FLOW-4.
- **Operation(s):** `getUnitPlan` — a run → its stored UnitPlan and `lesson_link` rows. Read-only.
- **Fields:**
  - Response: `run_id`, `state` (`planning` while the plan call runs; `stored` after), `stored_at`, `entries` (one per
    teaching day: `lesson_id`, `day`, `purpose`, `routines` (list), `hands_forward`, `performance_task_thread`) and
    `lesson_links` (`link_id`, `from_lesson_id`, `from_address`, `to_lesson_id`, `to_slot_id`, `label`, e.g. "Lesson 4
    Homework → Lesson 5 excerpt slot").
- **States:** none caused.
- **Permissions:** every role may read.
- **Named errors:** `NOT_FOUND`.
- **Recovery:** while `state` is `planning`, the screen shows "Planning the unit" and polls.
- **Guarantees:**
  - One UnitPlan per run, stored before any lesson job starts; 47 entries on the issued unit (R-8).
  - `lesson_link` rows are computed by code at intake, never by the model; a hand-forward the model suggests stays
    advisory text (HP-1).
  - Regeneration reuses the run's stored plan (R-8 as amended, HP-1).
- **Timing:** polled every 2 s while planning (PD-18).
- **Presentation notes:** the arc grouping is presentation.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: pending — the System track has not started. Must confirm: that links are attached to the run's plan
    although they come from intake (HP-1 says both).
- **Open behaviour questions:** none.

<a id="con-9"></a>

## CON-9 · Unit board

**Status:** proposed · **Blocked by:** UXP-1, UXP-2, UXP-6 · **Backend owner:** web app

- **Needed by:** SCR-8 · US-11, US-12, US-26, US-28 · FLOW-6, FLOW-13.
- **Operation(s):** `getUnitBoard` — a unit (optional state filter) → lesson rows and the roll-up.
- **Fields:**
  - Request: `state` (optional filter, a lesson state).
  - Response: `unit_id`, `rollup` (count per lesson state), `rows`: `lesson_id`, `number`, `title`, `type`, `state`,
    `blocking_count`, `confirmation_count`, `advisory_count`, `reviewer` (name or empty), `last_change_at`,
    `dependency_flags` (`kind` = `waits_on` or `source_reopened`, `lesson_id`, `label`), `send_back` (`tag`, `note`,
    or empty), `judge_flag` (only if the judge is built; labelled "provisional, not expert").
- **States:** none caused.
- **Permissions:** every role may read.
- **Named errors:** `NOT_FOUND`. "No lessons yet" is an empty list, not an error.
- **Recovery:** an empty board links to the latest run (CON-6).
- **Guarantees:**
  - Sorted by blocking issues, most first; roll-up counts equal the sum of lesson states (R-25).
  - Dependency flags come from `lesson_link` rows (HP-1); "a lesson this depends on was reopened" appears and nothing
    reopens on its own (HP-5 addendum).
  - A judge "no" raises a lesson but never blocks (HP-3, R-23).
  - **Pending UXP-1:** `reviewer` is the reviewer who started the review.
  - **Pending UXP-2:** a `waits_on` flag while the slot is empty versus once it is filled but unapproved.
  - **Pending UXP-6:** `send_back.tag` comes from the tag list.
- **Timing:** p95 < 1 s for ~47 rows [T] (R-57). Polled while open.
- **Presentation notes:** whether confirmations show inside the blocking count or beside it is presentation; both counts
  are returned.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: pending — the System track has not started. Must confirm: the tie-break order after blocking count
    (lesson number [I]); the board's polling interval; that counts read the stored issue rows.
- **Behaviour questions:** [UXP-1](#uxp-1), [UXP-2](#uxp-2), [UXP-6](#uxp-6) — decided 2026-10-25 (recommendation adopted; see below). Still `proposed` only because the System review is pending.

<a id="con-10"></a>

## CON-10 · Unit metrics

**Status:** proposed · **Blocked by:** no open product question · **Backend owner:** web app

- **Needed by:** SCR-8 (north-star tile), SCR-19 (cut #6) · US-30, US-31, US-34, US-36 · FLOW-6, FLOW-16, FLOW-19.
- **Operation(s):** `getUnitMetrics` — a unit → the north-star tile and, if built, the quality page.
- **Fields:**
  - Response:
    - `north_star`: `median_minutes` (number or empty), `n` (whole number), `fast_approvals` (`count`, `of`),
      `approved` (`k`, `total`), `caption` (text, "No baseline yet (AQ-14). Measured with us as reviewers."),
      `segment_label` (text such as "one reviewer, n = 3", or empty).
    - `quality` (only if R-50 is built): `tiles` (`id` such as `V-1`, `O-2`, `H-4`; `value`; `n`; `label`),
      `rating_counts` (`usable_as_drafted`, `usable_with_edits`, `rewritten`, `n`), `seeded_errors` (`planted`,
      `caught`, `label` "our reviewers").
- **States:** none caused.
- **Permissions:** every role may read.
- **Named errors:** `NOT_FOUND`. No approved lesson yet → `median_minutes` empty and `n` 0.
- **Recovery:** with `n` 0 the tile says "No approved lessons yet" and shows no number.
- **Guarantees:**
  - Aggregate only; no minutes by named person (GR-15, R-49).
  - NS counts human sessions only, to the **first** approval; later approvals are rework (PD-1 amended, HP-8).
  - The median never comes without *n*, G-2, "approved k of N" and the caption (HP-8).
  - Fewer than 3 distinct reviewers in a segment → labelled (GR-15 as amended).
  - Every tile reads stored rows; a reopened lesson never changes its frozen row (R-50).
  - Ratings shown in aggregate with *n* (R-60).
- **Timing:** none set.
- **Presentation notes:** the tile's wording layout is presentation; its parts are not optional.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: pending — the System track has not started. Must confirm: how G-2 is computed per version's word count
    (HP-8); that the quality block is absent, not empty, when cut #6 fires.
- **Open behaviour questions:** none.

<a id="con-11"></a>

## CON-11 · Lesson read

**Status:** proposed · **Blocked by:** UXP-1, UXP-6 · **Backend owner:** web app

- **Needed by:** SCR-9, SCR-14 · US-13, US-14, US-19, US-20, US-25, US-26 · FLOW-4, FLOW-6, FLOW-7, FLOW-8, FLOW-9,
  FLOW-10, FLOW-12, FLOW-13.
- **Operation(s):** `getLesson` — a lesson → everything the workspace and the approval review show, except live edits
  (those come from CON-12).
- **Fields:**
  - Response:
    - `lesson_id` (e.g. `G6.U4.L4`), `number`, `title`, `type`, `state`, `version_number`, `content_hash`,
      `state_vector` (text, base64), `schema_version`, `last_editor` (name or empty).
    - For `submitted` and later: `snapshot` (`version_id`, `content_hash`, `state_vector`) — the values Approve must
      send back (CON-18).
    - `front_matter`: objectives, `standards` (each `code`, `role` = focus / supporting / ELD, `origin` = `outline`,
      `outline-fixed`, `narrowed` or `added`, `official_text`, `asserted_by`, `confirmation` = `open`, `confirmed`,
      `removed`, or none), vocabulary, routines, materials, essential question.
    - `sections`: `address` (e.g. `G6.U4.L4.LearningInAction.PartA`), `name`, `minutes`, `content` (ProseMirror JSON in
      the shared node schema).
    - `text_cards`: `title`, `author`, `edition_or_isbn`, `chapter`, `pages`, `kind` (`off-platform-text`,
      `newsela-reference` with `content_available: false`, or `excerpt`), `rights_status`.
    - `outline_row`: `row_number`, `segments` with `kind`, `text`, `action`, `source` (as confirmed in CON-4).
    - `alignment_map`: `code`, `teach_links` and `check_links` (addresses), `link_role` (I / P / A), `asserted_by`.
    - `reviewer` (name or empty), `send_back` (`tag`, `note`, `by`, `at`, or empty), `checklist` (when submitted: 4–6
      items, each `key`, `label`, `status`, `evidence_refs`), `dependencies` (`direction` = `waits_on` or
      `depended_on_by`, `lesson_id`, `slot_id`, `status`), `allowed_actions` (a hint for the screen; the server still
      decides).
- **States:** none caused (shared guarantee 5).
- **Permissions:** every role may read.
- **Named errors:**
  - `SCHEMA_UNKNOWN` — the stored `schema_version` is unknown. `details` names the lesson and the version. The lesson is
    not opened; nothing is dropped.
  - `NOT_FOUND`.
- **Recovery:** on `SCHEMA_UNKNOWN` the screen says which lesson and version, and the operator re-compiles from the stored
  `LessonDraft` with no model call (HP-4 addendum).
- **Guarantees:**
  - Reads the stored derived row (or the snapshot for frozen states), never the live document (HP-4).
  - An unknown node or schema fails loudly; it is never silently dropped (R-11 as amended, HP-4 addendum).
  - Never a bare "aligned" badge: every link says who asserted it (R-20, GR-4). Official CDE text only (GR-5).
  - Texts appear as citation cards; no novel text is reproduced (R-12, GR-2).
  - **Pending UXP-1:** `reviewer` is set when the review starts. **Pending UXP-6:** `send_back.tag` vocabulary.
- **Timing:** lesson open (editor ready with content) p95 < 1.5 s [T] (R-57).
- **Presentation notes:** the evidence pane's order and the checklist's place on SCR-14 are presentation.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: pending — the System track has not started. Must confirm: whether `content` comes in this response or
    only from the socket's first sync (both meet the 1.5 s target only if measured); the checklist's item keys; the size
    of the response for a ~3,300-word lesson.
- **Behaviour questions:** [UXP-1](#uxp-1), [UXP-6](#uxp-6) — decided 2026-10-25 (recommendation adopted; see below). Still `proposed` only because the System review is pending.

<a id="con-12"></a>

## CON-12 · Collaboration channel (Yjs socket)

**Status:** proposed · **Blocked by:** no open product question (UXP-7 follows from HP-4 and HP-5) · **Backend owner:**
collaboration server (one Hocuspocus process)

- **Needed by:** SCR-9 (also SCR-12 adopt, SCR-10 insert, through the server) · US-15, US-22 · FLOW-7, FLOW-13, FLOW-14.
- **Operation(s):** not HTTP. One authenticated websocket per lesson document (`lesson:<lesson_id>`). Described in the
  OpenAPI file under `x-collaboration-channel`.
  - **Sync:** Yjs updates both ways for the sections (one fragment per section) and the front matter (a Y.Map).
  - **Awareness:** each co-editor's name and cursor.
  - **Store acknowledgement:** after each durable store the server tells every client `stored` with `content_hash`,
    `state_vector` and `stored_at`.
  - **Refusal message:** a write that is refused is reported to the person who typed it (`LESSON_LOCKED`).
  - **Mode change:** at Submit or Approve every connection switches to read-only.
- **Fields:** the connection carries the app session (CON-1). Messages: `stored` (`content_hash`, `state_vector`,
  `stored_at`), `refused` (`code`, `message`), `mode` (`editable` or `read_only`, with the lesson `state`).
- **States:** client states `connecting`, `synced`, `saving` (edits not yet stored), `stored`, `DISCONNECTED`,
  `read_only`. It never moves a lesson state by itself.
- **Permissions:** any signed-in role may connect and read. Writes are accepted only from `reviewer` connections, and only
  in an editable lesson state [A: reviewers edit; HP-5 says the approver "never edits"; authors read]. An unauthenticated
  connection is refused (R-26, R-54).
- **Named errors:**
  - `UNAUTHENTICATED` — no valid session or an unknown email. The connection is refused.
  - `LESSON_LOCKED` — a write to a frozen or approved lesson. Nothing persists; the typist is told.
  - `DISCONNECTED` (channel state) — the socket dropped. Local edits are held; Submit is off.
- **Recovery:** on `DISCONNECTED` the editor shows "Reconnecting: your last edits are not saved yet" and keeps Submit off
  until a `stored` acknowledgement covers the local edits (UXP-7, from HP-4/HP-5). On `LESSON_LOCKED` the editor turns
  read-only and shows which keystrokes were refused.
- **Guarantees:**
  - Only the collaboration server writes lesson content (R-26 as amended, HP-4).
  - Each durable store writes, in one transaction, the Y.Doc bytes, the derived `Lesson` JSON, its SHA-256 and the state
    vector (R-26, HP-4).
  - Round trip JSON → Y.Doc → JSON keeps the hash (HP-4; SP-2 confirms).
  - "Last editor" is the user on the connection whose update was last stored, including AI accepts and candidate adoption
    (R-33 as amended, HP-5).
  - After a lock: 0 edits persisted; every keystroke is either in the snapshot or reported as refused to its typist (HP-5).
  - No hosted Yjs vendor; persisted to our Postgres (PD-9).
- **Timing:** store debounce ≤ 2 s [T] (R-26); store transaction p95 ≤ 500 ms [T] (HP-4); remote edit visible p95 <
  300 ms [T] and durably stored p95 < 3 s [T] with 25 editors (R-56, cut #1: if cut, the docs say it was not measured).
- **Presentation notes:** cursor colours and the "saving" indicator are presentation.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: pending — the System track has not started. Must confirm: the store acknowledgement as a custom
    stateless message; how the lock at Submit reaches the collaboration process (HP-5 reason 3); the SP-2 fallback (close
    all connections at Submit) and what the client sees then; write roles (the [A] above).
- **Open behaviour questions:** none open. [UXP-7](#uxp-7) is recorded as following from HP-4 and HP-5.

<a id="con-13"></a>

## CON-13 · Issue list

**Status:** proposed · **Blocked by:** UXP-2 · **Backend owner:** web app (the checks run on each store)

- **Needed by:** SCR-9, SCR-14 · US-14, US-16, US-17, US-18, US-20, US-24, US-25 · FLOW-7, FLOW-8, FLOW-10, FLOW-11,
  FLOW-12.
- **Operation(s):** `getLessonIssues` — a lesson → its issues, as of a stored hash.
- **Fields:**
  - Response: `lesson_id`, `checked_hash` (the stored content hash the checks ran on), `checked_at`, `pending` (yes/no:
    a newer store is still being checked), `counts` (`blocking`, `confirmation`, `advisory`), and `issues`: `issue_id`,
    `level`, `kind` (e.g. `quote_placeholder_open`, `excerpt_slot_open`, `cross_lesson_link`, `standard_not_taught`,
    `standard_not_checked`, `code_not_allowed`, `minutes_out_of_range`, `quote_unmatched`, `page_out_of_range`,
    `proper_noun_unsourced`, `quote_without_source`, `rights_to_clear`, `suggestion_pending`, `safety_flag_open`,
    `safety_text_in_student_block`, `disclosure_prompt`, `standard_confirmation`, `standard_add_suggestion`,
    `eld_label_mismatch`, `arc_repeat`, `vocabulary_over_cap`, `linked_text_changed`, `judge_no`), `message`, `address`,
    `span_anchor` (Yjs relative position, base64, or empty), `related_lesson_id`, `resolution` (`by`, `reason`, `at`, or
    empty).
- **States:** none caused. The list changes after each store.
- **Permissions:** every role may read.
- **Named errors:** `NOT_FOUND`.
- **Recovery:** a click on an issue moves the selection to its `span_anchor` or `address` (R-27). While `pending` is true
  the screen shows "checking" and keeps Submit off.
- **Guarantees:**
  - Checks re-run on every durable store and read the stored derived row; cross-lesson checks read the other lesson's
    stored row (R-28 as amended, HP-4).
  - The blocking set is R-19 as amended in PRD §5.4 (HP-1, HP-2, HP-3, HP-5, HP-6, HP-9).
  - `narrowed` and `added` codes are `confirmation` items: block, but count in neither V-1 nor G-1 (HP-3). WP-1 §C's old
    "advisory" `L.6.4.b` is superseded (GAP-1).
  - The judge's verdicts are advisory and labelled provisional (R-23).
  - A safety flag's issue links to its `teacher_tip`; warning text in a student-facing block is blocking (HP-9).
  - **Pending UXP-2:** `cross_lesson_link` blocks Submit and Approve while the slot is empty, then Approve only.
- **Timing:** a new blocking issue appears within 5 s of the store [T] (R-28).
- **Presentation notes:** grouping by level and the jump animation are presentation.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: pending — the System track has not started. Must confirm: the `kind` list (System owns the checks);
    whether checks run in the worker or the collaboration server; the `pending` flag's source.
- **Behaviour questions:** [UXP-2](#uxp-2) — decided 2026-10-25 (recommendation adopted; see below). Still `proposed` only because the System review is pending.

<a id="con-14"></a>

## CON-14 · Resolve and confirm

**Status:** proposed · **Blocked by:** no open product question · **Backend owner:** web app (+ collaboration server for
standards, which live in the front matter)

- **Needed by:** SCR-9, SCR-11 · US-19, US-20, US-21 · FLOW-8, FLOW-9, FLOW-10.
- **Operation(s):**
  - `recordResolution` — clear a blocking issue with a named resolution and a reason.
  - `clearSafetyFlag` — clear a safety flag with a note.
  - `decideStandard` — `confirm` or `remove` a `narrowed` / `added` code, or `add` a code from an "add?" advisory.
- **Fields:**
  - Request: `recordResolution`: `reason` (text). `clearSafetyFlag`: `note` (text). `decideStandard`: `code` (text),
    `decision` (`confirm`, `remove`, `add`).
  - Response: the updated `issue` (or standard entry), `audit_id`, and the lesson's new `counts`.
- **States:** an issue becomes resolved; a flag becomes cleared; a confirmation closes; a removed code takes its teach and
  check links with it and the checks re-run; an added code becomes `added` and opens its own confirmation (FLOW-9).
- **Permissions:** `recordResolution` and `decideStandard`: `reviewer`. `clearSafetyFlag`: `reviewer` or `approver`
  (U9, PD-26). Wrong role → `ROLE_FORBIDDEN`.
- **Named errors:**
  - `REASON_REQUIRED` — a resolution with an empty reason. Unchanged.
  - `NOTE_REQUIRED` — a flag clear with an empty note. The flag stays open.
  - `LESSON_LOCKED` — the lesson is frozen or approved. Unchanged.
  - `ROLE_FORBIDDEN`, `NOT_FOUND`.
- **Recovery:** the dialog keeps the text and asks for the missing reason or note.
- **Guarantees:**
  - A block clears only by fixing the content or by a named person recording a resolution; the audit log shows user,
    reason and time (R-34). Resolutions count in G-1 (US-21).
  - Only a named person clears a safety flag, with a note; the generator may add flags but never clear them (PD-26,
    HP-9). The approver's checklist shows "safety flag cleared by <name>: <note>".
  - Confirming makes the link asserted by a named reviewer (HP-3, R-20). A standard decision is a front-matter change,
    so it goes through the collaboration server as a logged edit (HP-4) and counts toward "last editor" [I].
- **Timing:** checks re-run within 5 s of the resulting store [T] (R-28).
- **Presentation notes:** dialog wording is presentation.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: pending — the System track has not started. Must confirm: that a standard decision counts as an edit
    for four-eyes [I]; that resolutions and flag clears are outside the document (issue and audit rows); whether a
    resolution is allowed on every blocking kind or only some.
- **Open behaviour questions:** none.

<a id="con-15"></a>

## CON-15 · Fill a placeholder or slot

**Status:** proposed · **Blocked by:** UXP-2 · **Backend owner:** web app (validates) + collaboration server (inserts)

- **Needed by:** SCR-10 · US-17, US-18 · FLOW-8.
- **Operation(s):** `fillSlot` — a placeholder or excerpt slot → a `quote` node inserted by a named person.
- **Fields:**
  - Request: `text` (text), `source_ref` (`book` or `title`, `chapter`, `pages`, or `url`), `rights_status` (one of
    `public-domain`, `Newsela-owned`, `licensed`, `to-clear`, `short-quote-commentary`).
  - Response: `slot_id`, `inserted_by`, `inserted_at`, `still_blocking` (yes/no), `blocking_reason` (e.g. "rights to
    clear"), `linked_lessons` (lessons whose link this slot feeds, with their new status).
- **States:** the slot's issue clears, or stays blocking if rights are `to-clear`. A linked lesson's item changes (UXP-2).
- **Permissions:** `reviewer`. Wrong role → `ROLE_FORBIDDEN`.
- **Named errors:**
  - `SOURCE_REQUIRED` — no source. Nothing inserted.
  - `QUOTE_TOO_LONG` — over 12 words with `short-quote-commentary`. Nothing inserted.
  - `LESSON_LOCKED` — the lesson is frozen or approved. Nothing inserted.
  - `ROLE_FORBIDDEN`, `NOT_FOUND`.
- **Recovery:** the dialog keeps the text and asks for the source or a shorter quote. A `to-clear` insert asks the
  reviewer to record the rights later.
- **Guarantees:**
  - Only a person inserts a quote; the generator has no `quote` type (R-12 as amended, HP-2, GR-2).
  - Every excerpt has a rights status; `to-clear` blocks approval (GR-3, R-19).
  - The insert is applied through the collaboration server as a logged edit by the named person (HP-4).
  - **Pending UXP-2:** filling Lesson 5's slot turns Lesson 4's homework item into "waiting for Lesson 5's approval",
    which blocks Approve only.
- **Timing:** the slot's issue clears within 5 s [T] (R-28; HP-4 freshness test).
- **Presentation notes:** showing what the slot asks for at the top of the dialog is presentation.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: pending — the System track has not started. Must confirm: the HTTP → collaboration server hop and its
    failure mode; the 12-word count rule (words split how).
- **Behaviour questions:** [UXP-2](#uxp-2) — decided 2026-10-25 (recommendation adopted; see below). Still `proposed` only because the System review is pending.

<a id="con-16"></a>

## CON-16 · Candidates

**Status:** proposed · **Blocked by:** UXP-3 · **Backend owner:** web app + worker (generates) + collaboration server
(adopts)

- **Needed by:** SCR-9, SCR-12 · US-22, US-10 · FLOW-14, FLOW-18.
- **Operation(s):**
  - `regenerateLesson` — a lesson and an optional note → a candidate job.
  - `getCandidate` — a candidate → its content beside the current version.
  - `adoptCandidate` — adopt the whole candidate or one section.
- **Fields:**
  - Request (`regenerateLesson`): `note` (text, optional). (`adoptCandidate`): `scope` (`whole` or `section`),
    `section_address` (text, for a section).
  - Response: `candidate_id`, `version_number`, `status` (`queued`, `drafting`, `ready`, `failed`), `adopted` (no until
    adopted), `failure_reasons`, `current_content_hash` (unchanged), `sections` (when ready). `adoptCandidate` returns
    `audit_id` and the lesson's `last_editor`.
- **States:** writes a candidate `lesson_version` marked "not adopted". Adopting is an edit; the current lesson state does
  not change. A candidate for a `generation_failed` lesson becomes its v1 [I].
- **Permissions:** `reviewer`. (An author's guidance trial reaches candidates through CON-5.) Wrong role →
  `ROLE_FORBIDDEN`.
- **Named errors:**
  - `LESSON_LOCKED` — the lesson is submitted or approved; withdraw or reopen first (UXP-3). Unchanged.
  - `DAY_CAP_REACHED` — the day's cap would be passed. Unchanged.
  - A failed candidate is a **status**, not an error; the current lesson is untouched.
- **Recovery:** read the candidate's failure reasons; try again later or edit by hand.
- **Guarantees:**
  - Regenerate never overwrites; the current version's hash is unchanged (R-29).
  - The job uses the run's stored plan and pinned prompt (R-8 as amended).
  - Adopting (whole or a section) is a logged `candidate-adopt` edit by a named person, applied through the collaboration
    server; the adopter becomes the last editor (R-29 as amended, HP-4, HP-5).
  - Copying text by hand from the candidate pane is not tracked: a known provenance gap, stated in the limits (HP-5).
- **Timing:** generation p95 ≤ 5 min [T] (R-55). Candidate status is polled every 2 s (PD-18).
- **Presentation notes:** side-by-side versus stacked compare is presentation.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: pending — the System track has not started. Must confirm: which run's cap a regenerate counts
    against; the `generation_failed` case [I].
- **Behaviour questions:** [UXP-3](#uxp-3) — decided 2026-10-25 (recommendation adopted; see below). Still `proposed` only because the System review is pending.

<a id="con-17"></a>

## CON-17 · AI suggestions

**Status:** proposed · **Blocked by:** UXP-3 · **Backend owner:** web app (the model call; the accept is a client-side
transaction through CON-12)

- **Needed by:** SCR-13 (cut #8) · US-23 · FLOW-15.
- **Operation(s):**
  - `requestSuggestion` — a selection anchor and a note → a pending suggestion.
  - `decideSuggestion` — `accept` or `reject`.
- **Fields:**
  - Request (`requestSuggestion`): `anchor` (`start` and `end`, Yjs relative positions, base64), `selected_text` (text),
    `note` (text). (`decideSuggestion`): `decision` (`accept` or `reject`), `anchored_text_now` (text, what the client
    sees under the anchor).
  - Response: `suggestion_id`, `status` (`pending`, `accepted`, `rejected`, `closed`), `suggested_text`, `requested_by`.
- **States:** creates a `pending` suggestion held outside the document. Accept → one transaction tagged `ai-assist` with
  the acceptor's name, then the checks re-run. Reject → discarded and logged.
- **Permissions:** `reviewer`. Wrong role → `ROLE_FORBIDDEN`.
- **Named errors:**
  - `LESSON_LOCKED` — submitted or approved (UXP-3). Unchanged.
  - `MODEL_UNAVAILABLE` — the model call failed. Nothing changed.
  - `ANCHOR_CHANGED` — the text under the anchor changed. The suggestion closes; ask again.
  - `ROLE_FORBIDDEN`, `NOT_FOUND`.
- **Recovery:** ask again; or edit by hand.
- **Guarantees:**
  - Nothing AI-written enters a lesson silently; a person accepts (GR-7, R-31).
  - Applied only if the anchored text is unchanged (R-31 as amended, HP-5).
  - A pending suggestion blocks Submit and Approve (R-31, HP-5).
  - Provenance shows "1 AI-assisted span, accepted by <name>" (R-31).
  - Not offered on approved lessons (GR-7); the panel warns against pasting student work (R-31).
- **Timing:** none set for the model call [A: seconds; System to set].
- **Presentation notes:** the side panel and its warning placement are presentation.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: pending — the System track has not started. Must confirm: synchronous call or poll; how the server
    checks "anchored text unchanged" (client-sent text versus the stored doc); the suggestion's lifetime.
- **Behaviour questions:** [UXP-3](#uxp-3) — decided 2026-10-25 (recommendation adopted; see below). Still `proposed` only because the System review is pending.

<a id="con-18"></a>

## CON-18 · Lesson transitions

**Status:** proposed · **Blocked by:** UXP-1, UXP-2, UXP-4, UXP-6, UXP-10 (GAP-2 rides with UXP-1 and UXP-4) ·
**Backend owner:** web app + collaboration server (the lock, flush and snapshot)

- **Needed by:** SCR-9, SCR-14, SCR-15 · US-24, US-25, US-26, US-27, US-28, US-31 · FLOW-9, FLOW-11, FLOW-12, FLOW-13,
  FLOW-15.
- **Operation(s):** `transitionLesson` — one lesson, one move. Actions:
  - `start_review` (UXP-1): `draft` → `in_review`; sets the reviewer.
  - `submit`: → `submitted`; freezes the lesson and writes a snapshot.
  - `withdraw` (UXP-10): `submitted` → `in_review`.
  - `approve`: → `approved`, pinned to the snapshot.
  - `request_changes` (UXP-6): → `changes_requested`.
  - `reopen` (UXP-4): → `reopened`, a new version.
- **Fields:**
  - Request: `action`, and by action:
    - `submit`: `client_state_vector` (base64: what the submitter's editor holds, so the server can refuse `NOT_STORED`).
    - `withdraw`: `note` (text, optional, UXP-10).
    - `approve`: `snapshot_hash` (text), `snapshot_state_vector` (base64), `rating` (`usable_as_drafted`,
      `usable_with_edits`, `rewritten`).
    - `request_changes`: `tag` (one of the UXP-6 tags), `note` (text).
    - `reopen`: `reason` (text).
  - Response: `lesson_id`, `from_state`, `to_state`, `version` (`version_id`, `version_number`, `content_hash`,
    `state_vector`), `audit_id`, and for `approve`: `dependency_record` (`lesson_id`, `approved_hash` of each lesson it
    links to) and `metrics_row_written` (yes/no).
- **States:** the moves in the shared table above. Submit, Approve and Reopen each write an immutable `lesson_version`
  snapshot (R-35 as amended).
- **Permissions:** `start_review`, `submit`, `withdraw`: `reviewer`. `approve`, `request_changes`: `approver`. `reopen`:
  `approver` (UXP-4). Wrong role → `ROLE_FORBIDDEN` ("Only approvers can approve").
- **Named errors:**
  - `BLOCKED` — a blocking issue stands; `details.issues` lists each one (also returned when the server's re-check fails on
    the stored copy or snapshot). Unchanged.
  - `CONFIRMATION_OPEN` — a `narrowed` or `added` code is unconfirmed. Unchanged.
  - `SUGGESTION_PENDING` — an AI suggestion is pending. Unchanged.
  - `NOT_STORED` — the submitter's edits are not stored yet. Unchanged.
  - `STALE_PIN` (409) — the pinned hash or state vector does not match the current snapshot. Unchanged; reload shows the
    new snapshot.
  - `FOUR_EYES` — the approver was the last stored editor. Unchanged.
  - `RATING_REQUIRED` — Approve without a rating. Unchanged.
  - `DEPENDENCY_UNAPPROVED` — a lesson this one links to is not approved; `details` names it ("Lesson 5 must be approved
    first"). Unchanged.
  - `NOTE_REQUIRED` — Request changes with an empty note. Unchanged.
  - `REASON_REQUIRED` — Reopen with an empty reason. Unchanged.
  - `INVALID_TRANSITION` — the move is not allowed from the current state. Unchanged.
  - `ROLE_FORBIDDEN`.
- **Recovery:** each refusal names what to fix. On `STALE_PIN` the approver reloads SCR-14 and reads the new snapshot. On
  `FOUR_EYES` another approver approves. On `DEPENDENCY_UNAPPROVED` the source lesson is approved first.
- **Guarantees:**
  - Submit needs zero blocking issues, freezes the document and writes a snapshot (R-33 as amended, HP-5, PD-7).
  - Approve pins the snapshot's content hash and state vector, re-runs the blocking checks on it, and returns 409 on any
    mismatch with no change (R-33, HP-5). Read-only after.
  - Four-eyes on by default: "last editor" includes AI accepts and candidate adoption (PD-10, HP-5).
  - No endpoint takes more than one lesson; no bulk approve (GR-6, R-33).
  - Approve without a rating is refused; the rating goes on the frozen metrics row, written once at the first approval
    (R-60, R-49, HP-8, HP-10).
  - Cross-lesson links are approved in order; the dependent approval records the source's approved hash (R-34, HP-5).
  - Reopening a lesson another depends on flags the dependant on the board; nothing reopens on its own (HP-5 addendum).
  - Every move is in the audit log with who, when, from, to, hash and reason (R-35). Withdraw is logged as `withdrawn`.
  - **Pending UXP-1, UXP-2, UXP-4, UXP-6, UXP-10** (see each action above).
- **Timing:** Submit includes the lock and flush: within one store transaction, p95 ≤ 500 ms [T] after the last edit is
  received (HP-4, HP-5; SP-2 measures it).
- **Presentation notes:** where the checklist, the rating and the 409 message sit on SCR-14 are presentation. The reload
  wording "This lesson changed since you opened it. Reload." is copy.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: pending — the System track has not started. Must confirm: `withdrawn` is a logged move to `in_review`,
    not a resting state (PRD §5.4 lists `withdrawn` among the states; HP-5's wording "submitted → in_review" reads as a
    move); the `NOT_STORED` check via `client_state_vector`; HTTP statuses; which of `BLOCKED` and `CONFIRMATION_OPEN`
    wins when both apply; that `exported` lessons can be reopened (the state table assumes yes, FLOW-13).
- **Behaviour questions:** [UXP-1](#uxp-1), [UXP-2](#uxp-2), [UXP-4](#uxp-4), [UXP-6](#uxp-6),
  [UXP-10](#uxp-10), [GAP-2](#gap-2); [UXP-7](#uxp-7) follows from HP-4 and HP-5 — decided 2026-10-25 (recommendation adopted; see below). Still `proposed` only because the System review is pending.

<a id="con-19"></a>

## CON-19 · Lesson history

**Status:** proposed · **Blocked by:** no open product question · **Backend owner:** web app

- **Needed by:** SCR-16 · US-29 · FLOW-16.
- **Operation(s):** `getLessonHistory` — a lesson → versions, provenance and audit rows. Read-only.
- **Fields:**
  - Response: `versions` (`version_id`, `version_number`, `kind` = `generated`, `candidate`, `submit`, `approval`,
    `reopen`; `content_hash`; `created_at`; `created_by`; `adopted` for candidates; `provenance` = `outline_row_hash`,
    `prompt_version_id`, `model`, `parameters`, `schema_version`, `example_set_id`, `run_id`, `cost_usd`),
    `audit` (`at`, `user`, `action`, `from_state`, `to_state`, `version_hash`, `reason`), `ai_spans` (`accepted_by`, `at`).
- **States:** none caused.
- **Permissions:** every role may read.
- **Named errors:** `NOT_FOUND`.
- **Recovery:** none needed.
- **Guarantees:**
  - The audit log is append-only; the database rejects UPDATE and DELETE (R-35).
  - Every version has non-null provenance (R-35, GR-8).
  - A snapshot exists at generation, each candidate, Submit, Approve and Reopen (R-35 as amended, HP-4).
  - No minutes by named person appear here (GR-15).
- **Timing:** none set.
- **Presentation notes:** timeline versus table is presentation.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: pending — the System track has not started. Must confirm: provenance for candidates and for
    human-made versions (submit, reopen), where "model" has no value.
- **Open behaviour questions:** none.

<a id="con-20"></a>

## CON-20 · Review heartbeats

**Status:** proposed · **Blocked by:** no open product question · **Backend owner:** web app

- **Needed by:** SCR-9, SCR-14 · US-15, US-30 · FLOW-7, FLOW-12.
- **Operation(s):** `sendHeartbeat` — one heartbeat → stored. Nothing comes back to show.
- **Fields:**
  - Request: `tab_id` (text), `focused` (yes/no), `visible` (yes/no), `last_input_at` (date-time), `sent_at`
    (date-time), `version_id` (text).
  - Response: none (204).
- **States:** none on the lesson. The server merges intervals per user across tabs. At the first approval CON-18 writes the
  frozen metrics row once.
- **Permissions:** `reviewer`, `approver` [A: any human session on SCR-9 or SCR-14]. Synthetic accounts are stored but
  excluded (HP-8).
- **Named errors:** `UNAUTHENTICATED`; `NOT_FOUND`. A heartbeat that fails is dropped silently by the client [A].
- **Recovery:** none; the next heartbeat carries on.
- **Guarantees:**
  - Active means a focused, visible tab with input in the last 60 s [A] (R-49 as amended, HP-8).
  - One user in two tabs for 10 min counts 10 min, not 20; an idle tab adds ≤ 1 min (HP-8).
  - Minutes are never returned with a name (GR-15). The editor shows "Active review time on this lesson is recorded and
    shown only as unit totals." (AQ-22, HP-8).
  - Reopening writes a new metrics row and never edits the old one (R-49).
- **Timing:** every 15 s while active (R-49).
- **Presentation notes:** the disclosure line's position is presentation; the line itself is required.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: pending — the System track has not started. Must confirm: whether author sessions count (the [A]); the
    idle window if the stopwatch check widens it to 90 s (HP-8).
- **Open behaviour questions:** none.

<a id="con-21"></a>

## CON-21 · Run summary

**Status:** proposed · **Blocked by:** no open product question · **Backend owner:** web app

- **Needed by:** SCR-17 · US-32, US-36 · FLOW-16, FLOW-19.
- **Operation(s):** `getRunSummary` — a run → its totals. Read-only.
- **Fields:**
  - Response: `run_id`, `state`, `n` (lessons in scope), `wall_time_seconds`, `cost_usd`, `cost_per_lesson_usd`,
    `lessons` (`ready`, `failed`), `retries`, `failures_by_reason` (`reason`, `count`), `placeholders_left`,
    `calls_lost_in_flight`, `brakes_fired` (`brake`, `count`), `truncation_retries`, `p95_minutes_per_lesson`,
    `target_minutes_per_lesson` (5), `report_path` (text, or empty).
- **States:** none caused.
- **Permissions:** every role may read.
- **Named errors:** `NOT_FOUND`.
- **Recovery:** none needed.
- **Guarantees:**
  - Totals equal the sums over stored call rows; cost comes from provider usage fields (R-48).
  - Adds calls lost in flight, brakes fired and truncation retries (R-48 as amended, HP-7).
  - Every number carries its *n* (GR-14).
- **Timing:** none set.
- **Presentation notes:** chart choice is presentation.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: pending — the System track has not started. Must confirm: "cost per lesson" as mean or median, and per
    ready lesson or per lesson attempted (GP-107 says per successful lesson).
- **Open behaviour questions:** none ([UXP-8](#uxp-8) naming only).

<a id="con-22"></a>

## CON-22 · Coverage matrix

**Status:** proposed · **Blocked by:** no open product question · **Backend owner:** web app

- **Needed by:** SCR-18 (cut #4) · US-33 · FLOW-16.
- **Operation(s):** `getCoverageMatrix` — a unit → standard × lesson cells. Read-only.
- **Fields:**
  - Response: `standards` (`code`, `official_text`, `never_assessed` yes/no), `lessons` (`lesson_id`, `number`), `cells`
    (`code`, `lesson_id`, `roles` = any of I / P / A, `confirmed_by` = `person`, `judge_only` or `generator_only`).
- **States:** none caused.
- **Permissions:** every role may read.
- **Named errors:** `NOT_FOUND`.
- **Recovery:** none needed.
- **Guarantees:**
  - Computed by one query from stored alignment links, never by a model (R-41, DIR-8).
  - Matches a hand count on three lessons; never-assessed standards are highlighted (R-41).
- **Timing:** none set.
- **Presentation notes:** the grid's colours are presentation; the I / P / A letters and the confirmed-by mark are not
  optional.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: pending — the System track has not started. Must confirm: which lesson version the matrix reads (stored
    row, or approved snapshot where one exists).
- **Open behaviour questions:** none.

<a id="con-23"></a>

## CON-23 · Export

**Status:** proposed · **Blocked by:** no open product question · **Backend owner:** web app

- **Needed by:** SCR-20 (cut #5) · US-35, US-28 · FLOW-13, FLOW-17.
- **Operation(s):**
  - `listExports` — what an export would include now, what is held back, and past export versions.
  - `createExport` — write an export version (idempotent).
  - `downloadExport` — the JSON file.
- **Fields:**
  - Response (`listExports`): `included` (`lesson_id`, `approved_hash`), `held_back` (`lesson_id`, `reason`,
    `waits_on`), `exports` (`export_id`, `version_number`, `created_at`, `created_by`, `lesson_count`, `payload_hash`).
  - Response (`createExport`): `export_id`, `version_number`, `same_as_previous` (yes/no), `included`, `held_back`,
    `download_path`.
  - `downloadExport`: a JSON document in the `Lesson` export schema.
- **States:** included lessons move to `exported`.
- **Permissions:** `approver`. Wrong role → `ROLE_FORBIDDEN`.
- **Named errors:** `ROLE_FORBIDDEN`, `NOT_FOUND`.
- **Recovery:** a held-back lesson shows what it waits on ("Lesson 4 waits on Lesson 5").
- **Guarantees:**
  - Reads approved snapshots only (R-42 as amended, HP-4).
  - Includes a dependent lesson only while every lesson it links to is approved (R-42 as amended, HP-5 addendum).
  - Exporting twice with no change gives identical lesson payloads; the file validates against the published JSON
    Schema (R-42). Labelled "Export (no live integration)" (PD-22).
- **Timing:** none set.
- **Presentation notes:** the label is required copy; the layout is presentation.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: pending — the System track has not started. Must confirm: whether a no-change export returns the
    previous version or writes a new version with identical payloads (both meet R-42); where the export JSON Schema file
    lives in `docs/contracts/` (planned).
- **Open behaviour questions:** none.

<a id="con-24"></a>

## CON-24 · Prompt versions

**Status:** proposed · **Blocked by:** no open product question · **Backend owner:** web app

- **Needed by:** SCR-21 (cut #7), SCR-5 · US-6, US-10 · FLOW-4, FLOW-18.
- **Operation(s):**
  - `listPromptVersions` — the locked layer (read-only) and every guidance version.
  - `saveGuidance` — save new guidance text with a reason → a new guidance version.
- **Fields:**
  - Response (`listPromptVersions`): `current_prompt_version_id`, `locked_layer` (`version_id`, `text`, read-only),
    `guidance_versions` (`version_id`, `number`, `author`, `created_at`, `reason`, `diff` (text), `pinned_by_runs`).
  - Request (`saveGuidance`): `base_version_id` (text), `guidance_text` (text), `reason` (text).
  - Response (`saveGuidance`): the new guidance version.
- **States:** a new immutable guidance version. Running runs keep their pin.
- **Permissions:** `listPromptVersions`: every role. `saveGuidance`: `author`. Wrong role → `ROLE_FORBIDDEN`.
- **Named errors:** `REASON_REQUIRED` — empty reason. Unchanged. `ROLE_FORBIDDEN`.
- **Recovery:** the screen asks for a reason.
- **Guarantees:**
  - No API route writes the locked layer (R-38, GR-18).
  - Every prompt version is immutable; a run pins one; each lesson records it (R-38).
  - "Try on one lesson" makes a candidate, not an overwrite (R-39; through CON-5 and CON-16).
- **Timing:** none set.
- **Presentation notes:** the diff view is presentation.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: pending — the System track has not started. Must confirm: what happens when two authors save from the
    same base version.
- **Open behaviour questions:** none.

---

## Behaviour questions routed from UX-1

UX-1 listed ten planning proposals (UXP-1…UXP-10) and two gaps. Each is sorted below into one of three kinds. **Picking a
visual direction at UX-2 decided none of them**: a look sheet sets colour, type and layout, not who may act or what a
state means.

### A. Product behaviour: Innocent decides

Each changes who may act, what a state means, or what the record says. The recommendation is the UX-1 proposal. **All decided 2026-10-25** (the recommendation in each case), under
Innocent, 2026-10-25: "take your recommendations to all decisions you need me for". The cards they touch are no longer blocked by them; they stay `proposed` until the System review.

<a id="uxp-1"></a>

**UXP-1 · What starts a review.** *Affects:* CON-9, CON-11, CON-18.
- **Recommendation:** a `draft` lesson becomes `in_review` when a reviewer first opens it, and that reviewer is shown as its
  reviewer. The workspace makes an explicit `start_review` call (CON-18), so reads stay free of side effects.
- **Why it is product behaviour:** it decides when a lesson changes state and who is named as its reviewer on the board.
  R-33 names the move but no trigger. (NS counts from draft-ready, so the metric does not depend on it, HP-8.)
- **Decision needed:** Does a reviewer opening a draft lesson start its review and name them its reviewer?
- **Decided 2026-10-25:** the recommendation, adopted under Innocent, 2026-10-25: "take your recommendations to all decisions you need me for".

<a id="uxp-2"></a>

**UXP-2 · How a cross-lesson link blocks.** *Affects:* CON-9, CON-13, CON-15, CON-18.
- **Recommendation:** two phases. While Lesson 5's slot is empty, Lesson 4's link blocks Submit **and** Approve. Once the slot
  is filled but Lesson 5 is not approved, it blocks **Approve only** ("Lesson 5 must be approved first").
- **Why it is product behaviour:** it decides when a reviewer may send a lesson for approval. HP-5 fixes approval in order
  but says nothing about submission order. WP-1 §C says the item clears when the excerpt is inserted; HP-5 says the link
  clears only when the source is approved. The proposal reconciles the two.
- **Decision needed:** Should a filled-but-unapproved link block only Approve (two phases), or both Submit and Approve?
- **Decided 2026-10-25:** the recommendation, adopted under Innocent, 2026-10-25: "take your recommendations to all decisions you need me for".

<a id="uxp-3"></a>

**UXP-3 · AI tools on frozen lessons.** *Affects:* CON-16, CON-17.
- **Recommendation:** Regenerate and AI assist are not offered on `submitted` or `approved` lessons; the server returns
  `LESSON_LOCKED`. Withdraw or reopen first.
- **Why it is product behaviour:** GR-7 bars AI tools on approved lessons only. Extending the bar to submitted lessons
  decides what a reviewer may do while waiting for approval.
- **Decision needed:** Should Regenerate and AI assist also be refused on submitted lessons?
- **Decided 2026-10-25:** the recommendation, adopted under Innocent, 2026-10-25: "take your recommendations to all decisions you need me for".

<a id="uxp-4"></a>

**UXP-4 · Who reopens an approved lesson.** *Affects:* CON-18.
- **Recommendation:** reopen is an approver action, with a reason.
- **Why it is product behaviour:** it decides who may undo an approval. R-33 does not name the role.
- **Decision needed:** Is reopening an approved lesson the approver's action only?
- **Decided 2026-10-25:** the recommendation, adopted under Innocent, 2026-10-25: "take your recommendations to all decisions you need me for".

<a id="uxp-5"></a>

**UXP-5 · What a capped run allows.** *Affects:* CON-5, CON-6, CON-7.
- **Recommendation:** a capped run is never raised in place. To finish, the author starts a new run on the unfinished rows
  with a new cap.
- **Why it is product behaviour:** it decides how spend is controlled after a cap fires. R-16 says the run "never exceeds
  its cap" but not whether the cap may move.
- **Decision needed:** Should a capped run stay final, with a new run for the rest?
- **Decided 2026-10-25:** the recommendation, adopted under Innocent, 2026-10-25: "take your recommendations to all decisions you need me for".

<a id="uxp-6"></a>

**UXP-6 · The send-back reason tags.** *Affects:* CON-9, CON-11, CON-18.
- **Recommendation:** the tags follow the checklist items: `standards`, `quotes_and_rights`, `eld_support`,
  `content_safety`, `ai_spans`, `teaching_quality`, `other`.
- **Why it is product behaviour:** the tag is part of the audit record and of what reviewers are told to fix. R-33 asks for
  "a reason tag" with no list.
- **Decision needed:** Should the send-back tags be the checklist items plus "teaching quality" and "other"?
- **Decided 2026-10-25:** the recommendation, adopted under Innocent, 2026-10-25: "take your recommendations to all decisions you need me for".

<a id="uxp-10"></a>

**UXP-10 · Does withdraw need a reason.** *Affects:* CON-18.
- **Recommendation:** no reason needed; an optional note.
- **Why it is product behaviour:** it decides what the audit log must hold for a withdraw. The PRD is silent. Withdrawing
  changes no content.
- **Decision needed:** Can a reviewer withdraw a submitted lesson without giving a reason?
- **Decided 2026-10-25:** the recommendation, adopted under Innocent, 2026-10-25: "take your recommendations to all decisions you need me for".

<a id="gap-2"></a>

**GAP-2 · The PRD row.** R-33 does not say who reopens (UXP-4) or what starts `in_review` (UXP-1). It is decided together
with those two: whichever answer Innocent gives, R-33 is updated to say it. It blocks nothing on its own.

### B. Follows from a decision already made

<a id="uxp-7"></a>

**UXP-7 · A dropped editor connection.** *Affects:* CON-12, CON-18. **Recorded as decided by HP-4 and HP-5**, not a new
question. HP-4 (chosen) makes the stored row the only copy that checks, Submit and approval read. HP-5 (chosen) makes
Submit freeze what is stored, and promises that every keystroke is in the snapshot or reported refused to its typist.
Offline editing is out of scope (PRD §7). So while the socket is down, local edits are not stored, and Submit must stay
off: "Reconnecting: your last edits are not saved yet." No product choice is left.

### C. Presentation or naming only

<a id="uxp-8"></a>

**UXP-8 · The name `complete`.** *Affects:* CON-6, CON-21 (the label only). R-16 and R-17 already define the condition (every
lesson ready). Only its name is chosen. **Decided by default; no product meaning.**

<a id="uxp-9"></a>

**UXP-9 · A Units home with one unit.** *Affects:* CON-2 (the list operation exists either way for R-1's versions).
Whether SCR-2 exists is navigation. **Decided by default; no product meaning.**

**GAP-1** (worked pairs WP-2 §C and WP-4 §C still call the `W.6.2` leaves advisory) is not a contract question. HP-3 is
chosen and the cards follow it (CON-13).

## History

- 2026-10-25: drafted at UX-1 as one-line rows in `USER_FLOWS.md` ("Draft contracts (UX-1)"), all `draft`.
- 2026-10-25: moved here as full cards, all `proposed`, under the approved revision `2026-10-25-concurrent-frontend.md`.
  UX review done; System review pending.

### D. Behaviour questions raised at UX-3b (UXQ-1…UXQ-11), decided 2026-10-25

Raised while writing the screen specs ([`SCREEN_SPECS.md`](../ux/03-structure/SCREEN_SPECS.md)). Each was decided as
recommended, under Innocent, 2026-10-25: "take your recommendations to all decisions you need me for". Presentation-only items change no card.

| ID | Question | Decision (the recommendation) | Kind | Cards |
|---|---|---|---|---|
| UXQ-1 | Dialog addresses; typed text on reload or sign-out | No address; text kept in memory through a re-sign-in on the same page, lost on reload; nothing written until confirm | presentation | — |
| UXQ-2 | Readable keys or opaque ids in addresses | Readable unit and lesson keys (`g6-u4`, `L4`); opaque run and candidate ids | behaviour (identifiers in URLs and responses) | CON-9, CON-11 |
| UXQ-3 | Prompt guidance per program or per unit | Program-wide, pinned per run | behaviour | CON-24, CON-5 |
| UXQ-4 | What a polling screen shows when polls fail | After 10 s: "Live updates paused. Showing … as of 10:42. Retrying…"; data stays | presentation | — |
| UXQ-5 | Board sort order | Blocking desc, then advisory desc, then lesson order; failed lessons as their own top group; approved and exported at the bottom | behaviour (the order CON-9 returns) | CON-9 |
| UXQ-6 | Where an approver's click on a submitted row goes | SCR-14; other rows open SCR-9 read-only | presentation | — |
| UXQ-7 | Who sees the north-star tile | Every role; aggregate only (GR-15) | behaviour (permission) | CON-10 |
| UXQ-8 | Confirm / remove a standard: undo or a dialog | Act at once with an Undo toast for 6 s | behaviour (needs an undo operation) | CON-14 |
| UXQ-9 | Can intake choices change after a run started from them | Yes, for the next run only; the running run keeps what it pinned | behaviour | CON-4, CON-5 |
| UXQ-10 | How much editing must work on a phone | Every action available; long editing not optimised | presentation | — |
| UXQ-11 | Does an author or approver opening a draft start its review | No: only a reviewer's open (UXP-1) | behaviour | CON-11, CON-18 |

**Follow-up for the System review:** UXQ-2, UXQ-5, UXQ-7, UXQ-8, UXQ-9 and UXQ-11 add or sharpen promises on the cards
listed; the System reviewer confirms each when reviewing those cards, and the OpenAPI file is updated in the same pass.
