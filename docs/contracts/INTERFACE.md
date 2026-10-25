# UX-3a · Shared contracts — Newsela Lesson Studio

> **Status:** all 24 cards are `agreed` (2026-10-25). UX review 2026-10-25; System review 2026-10-25; every
> product-behaviour question was decided under Innocent's delegation (PD-31, PD-32). From now on, a change to any card
> goes through [`CHANGES.md`](CHANGES.md) as a `CHG-N`. **Date:** 2026-10-25.
> **Owner:** the joint track (UX-3a). The UX session owns the *needs* in each card; the System session owns the
> *support*. Innocent decides every product-behaviour question.
> **Process:** zero-to-hero 2.0.0, revision
> [`2026-10-25-concurrent-frontend.md`](../../../.claude/skills/zero-to-hero/proposals/2026-10-25-concurrent-frontend.md) §2
> (approved by Innocent, 2026-10-25).
> **Machine form:** [`interface.openapi.yaml`](interface.openapi.yaml) (OpenAPI 3.1, version 1.0.0). Generated types
> ([`generated/api-types.ts`](generated/api-types.ts)), Prism mocks and contract checks read that one file. **Change log:**
> [`CHANGES.md`](CHANGES.md). **System review record:** [`reviews/2026-10-25-system-review.md`](reviews/2026-10-25-system-review.md).
> **Sources, highest first:** the issued brief; Innocent's recorded decisions; PRD
> [v1.0](../prd/newsela-prd.md) (§5.3 rows, with **§5.4 amendments winning**; §8 guardrails; §10 decisions PD-1…PD-35); the
> [hard-problem register](../design/hard-problems.md) (HP-1…HP-10, all chosen); the
> [capacity decision](../design/capacity-and-workload.md) (PD-33); UX-1
> ([flows](../ux/01-planning/USER_FLOWS.md), [stories](../ux/01-planning/USER_STORIES.md),
> [sitemap](../ux/01-planning/SITEMAP.md)); UX-3b ([screen specs](../ux/03-structure/SCREEN_SPECS.md), UXQ-1…UXQ-11).
> Example data comes from the [worked pairs](../data/worked-pairs.md). Synthetic accounts only. Nothing here quotes
> `docs/source/restricted/`.

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
| Both | Review every card, each with a named reviewer and a date, recorded separately | UX review 2026-10-25; System review 2026-10-25 |
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

**Spike dependencies.** Some numbers on these cards are still to be measured by a §5 spike. Such a card says
`confirmed by SP-N`. The card is agreed now; if the spike result changes a promise (not just a tuned value inside a
range the card already states), that change is a `CHG-N`. SP-1 sets per-lesson cost, time, output caps and the
concurrency cap (HP-1, HP-7). SP-2 confirms the Submit freeze, the round-trip hash and the store time (HP-4, HP-5). SP-3
sets whether the proper-noun scan blocks everywhere or only in check items (HP-2).

**Choosing a visual direction at UX-2 decided none of the behaviour questions below.** A look sheet sets colour, type
and layout. It says nothing about who may reopen a lesson or what starts a review.

**Labels.** [T] a target · [A] an assumption we chose and would check · [I] our inference · [M] a measurement.

## Card index

| Card | Promise | Status | Product questions (all decided 2026-10-25) | Spike dependency | Backend owner |
|---|---|---|---|---|---|
| [CON-1](#con-1) | Session and role | agreed | — | — | web app |
| [CON-2](#con-2) | Outline versions | agreed | UXP-9 (naming), UXQ-2 | — | web app |
| [CON-3](#con-3) | Validation report | agreed | UXQ-9 | — | web app |
| [CON-4](#con-4) | Intake choices | agreed | UXQ-9 | — | web app |
| [CON-5](#con-5) | Start a run | agreed | UXP-5, UXQ-3, UXQ-9 | SP-1 (caps, cost) | web app (creates jobs for the worker) |
| [CON-6](#con-6) | Run progress | agreed | UXP-5, UXP-8 | SP-1 (timing, concurrency) | web app (reads the worker's `lesson_job` rows) |
| [CON-7](#con-7) | Run control | agreed | UXP-5 | — | web app + worker |
| [CON-8](#con-8) | Unit plan | agreed | — | SP-1 (plan validity) | web app |
| [CON-9](#con-9) | Unit board | agreed | UXP-1, UXP-2, UXP-6, UXQ-2, UXQ-5 | — | web app |
| [CON-10](#con-10) | Unit metrics | agreed | UXQ-7 | — | web app |
| [CON-11](#con-11) | Lesson read | agreed | UXP-1, UXP-6, UXQ-2, UXQ-11 | — | web app |
| [CON-12](#con-12) | Collaboration channel (Yjs socket) | agreed | UXP-7 (follows from HP-4/HP-5) | SP-2 (freeze, store time) | collaboration server |
| [CON-13](#con-13) | Issue list | agreed | UXP-2 | SP-3 (name-scan scope) | worker (runs checks from `check_job`, DO-1 D-6) + web app (reads) |
| [CON-14](#con-14) | Resolve and confirm | agreed | UXQ-8 | — | web app + collaboration server |
| [CON-15](#con-15) | Fill a placeholder or slot | agreed | UXP-2 | — | web app + collaboration server |
| [CON-16](#con-16) | Candidates | agreed | UXP-3 | SP-1 (per-lesson cap) | web app + worker + collaboration server |
| [CON-17](#con-17) | AI suggestions | agreed | UXP-3 | — | web app + collaboration server |
| [CON-18](#con-18) | Lesson transitions | agreed | UXP-1, UXP-2, UXP-4, UXP-6, UXP-10, GAP-2, UXQ-11 | SP-2 (freeze mechanics) | web app + collaboration server |
| [CON-19](#con-19) | Lesson history | agreed | — | — | web app |
| [CON-20](#con-20) | Review heartbeats | agreed | — | — | web app |
| [CON-21](#con-21) | Run summary | agreed | UXP-8 (naming) | — | web app |
| [CON-22](#con-22) | Coverage matrix | agreed | — | — | web app |
| [CON-23](#con-23) | Export | agreed | — | — | web app |
| [CON-24](#con-24) | Prompt versions | agreed | UXQ-3 | — | web app |

**Count** (*calculation*): 24 cards, all `agreed`; 7 carry a spike dependency (CON-5, 6, 8, 12, 13, 16, 18). "Backend owner" names the process from PRD §9 (a Next.js web app, one Node service running the worker and the
Hocuspocus collaboration server as separate entry points). The System review placed CON-13's checks in the worker,
run from a coalesced `check_job` row written in the store transaction (DO-1 D-6, adopted under PD-32), and made
CON-17's accept a server-side apply through the collaboration server (see those cards).

## Shared definitions (every card uses these)

### Roles (R-54)

| Role | Persona | Does |
|---|---|---|
| `author` | P-2, outline author | uploads outlines, confirms the report, starts and controls runs, edits prompt guidance |
| `reviewer` | P-1, LXD reviewer | edits lessons, fills slots, confirms standards, records resolutions, clears safety flags, submits, withdraws |
| `approver` | P-3, approver / content lead | approves, requests changes, reopens (UXP-4), clears safety flags (U9), exports |

One role per account. A person who does two jobs uses two accounts (PD-25). The server enforces the role on every HTTP
operation **and** on the socket (R-54). Hiding a button is never the guard.

### Identifiers (UXQ-2, System review)

- **Units:** `unit_id` is the canonical id (`G6.U4`); `unit_key` is the readable URL key (`g6-u4`). Every `{unitId}` path
  parameter accepts either.
- **Lessons:** `lesson_id` is the canonical id (`G6.U4.L4`, `G6.U4.FLEX-1a`; section addresses build on it, R-21);
  `lesson_key` is the readable key unique within its unit (`L4`, `F1`…`F6` for flex days in outline order). Every
  `{lessonId}` path parameter accepts the canonical id or `<unit_key>:<lesson_key>` (`g6-u4:L4`), so a deep link to
  `/units/g6-u4/lessons/L4` needs no extra lookup. Responses always carry both, and later calls use `lesson_id`.
- **Runs, candidates, suggestions, exports, audit rows:** opaque server ids. Examples in this file and the OpenAPI
  (`run-0001`, `cand-4-2`) are illustrative; a client never parses an id.

### Lesson states and the moves between them (R-33 as amended in PRD §5.4, HP-5)

| From | Move | To | Who | Card |
|---|---|---|---|---|
| — | v1 stored after generation | `draft` | worker | CON-6 |
| — | still failing after one repair | `generation_failed` | worker | CON-6 |
| `generation_failed` | a retry succeeds | `draft` | author (CON-7) or reviewer (CON-16) | CON-7, CON-16 |
| `draft` | a reviewer starts the review (UXP-1, UXQ-11) | `in_review` | reviewer | CON-18 |
| `in_review`, `changes_requested`, `reopened` | Submit: zero blocking issues; the lesson freezes | `submitted` | reviewer | CON-18 |
| `submitted` | Withdraw (audit event `withdrawn`) | `in_review` | reviewer | CON-18 |
| `submitted` | Request changes, with a tag and a note | `changes_requested` | approver | CON-18 |
| `submitted` | Approve the pinned snapshot, with a rating | `approved` | approver | CON-18 |
| `approved`, `exported` | Reopen, with a reason (UXP-4) | `reopened` (a new version) | approver | CON-18 |
| `approved` | included in an export | `exported` | approver | CON-23 |

- **Editable** (the socket accepts writes): `in_review`, `changes_requested`, `reopened`.
- **Frozen** (read-only for everyone): `submitted`, `approved`, `exported`.
- `draft` is read-only until the review starts (UXP-1). `generation_failed` has no v1, so there is nothing to edit.
- `withdrawn` is an audit event on the move `submitted → in_review`, never a resting state (System review; PRD §5.4 lists
  it among R-33's moves).

### Run states (R-16 as amended, HP-7) and tile states (R-17)

- **Run:** `planning` (the one UnitPlan call) → `running` → `complete` (every lesson ready; name per UXP-8) · `partial`
  (some failed, the rest ready) · `capped` (the next call's reservation would pass the run cap or the day cap) · `paused`
  (3 lessons in a row failed the same check, or the UnitPlan call failed after its one repair) · `cancelled`. `paused` →
  `running` by Resume. `partial` → `running` by Retry failed. `capped` and `cancelled` do not restart (UXP-5 for
  `capped`).
- **Tile (one per lesson):** `queued`, `planning`, `drafting`, `checking`, `repairing`, `ready`, `failed`.

### Issue levels (HP-3)

- `blocking`: stops Submit and Approve (the issue's `blocks` field says which; see CON-13).
- `confirmation`: a `narrowed` or `added` standard. Blocks Submit and Approve like a blocking issue. Counts in neither V-1
  nor G-1.
- `advisory`: shown, never blocks.

### Error envelope and the named errors

Every refusal returns `{ "error": { "code": "<CODE>", "message": "<plain words>", "details": { … } } }`. The `code` is
one of the names below; the HTTP status is fixed per code (System review, 2026-10-25). The `message` is what the screen
may show. Codes marked *(System review)* were added on 2026-10-25; each has a screen response on its card.

| Code | HTTP | When | Cards |
|---|---|---|---|
| `INVALID_REQUEST` *(System review)* | 400 | the body or a parameter breaks the schema (missing field, unknown enum value, text over its length limit); `details.fields` names each | all |
| `UNAUTHENTICATED` | 401 | no valid session, or it expired | all |
| `INVALID_CREDENTIALS` *(System review)* | 401 | a listed email with the wrong password | CON-1 |
| `NOT_ON_ALLOW_LIST` | 403 | the email is not on the staff list | CON-1 |
| `ROLE_FORBIDDEN` | 403 | the caller's role may not do this | every action card |
| `NOT_FOUND` | 404 | the unit, version, run, lesson or item does not exist | all |
| `INVALID_TRANSITION` | 409 | the move is not allowed from the current state, e.g. Resume on a run that is not paused | CON-4, CON-7, CON-16, CON-18 |
| `LESSON_LOCKED` | 409 | the lesson is not in an editable state (frozen, approved, exported, or a `draft` whose review has not started), so this write or AI tool is refused; `details.state` gives the state | CON-12, CON-14, CON-15, CON-16, CON-17 |
| `ANCHOR_CHANGED` | 409 | the text under a suggestion changed | CON-17 |
| `NOT_STORED` | 409 | the submitter's edits are not stored yet | CON-18 |
| `STALE_PIN` | 409 | the pinned hash or state vector no longer matches the snapshot | CON-18 |
| `UNDO_EXPIRED` *(System review)* | 409 | an undo arrived after its window, or after a later decision on the same code | CON-14 |
| `STALE_BASE` *(System review)* | 409 | guidance was saved from a version that is no longer the latest | CON-24 |
| `SHEET_NOT_PUBLIC` | 422 | the sheet link is private | CON-2 |
| `UNSUPPORTED_FILE` | 422 | not CSV or XLSX, or over 5 MB [A] (`details.reason`) | CON-2 |
| `HEADER_NOT_FOUND` | 422 | no header row matched the column names | CON-2 |
| `TOO_MANY_ROWS` | 422 | over 200 rows [T] | CON-2 |
| `INVALID_CHOICE` *(System review)* | 422 | an intake choice's value does not fit its kind (e.g. an edited fix that is not a code in the standards list) | CON-4 |
| `VALIDATION_INCOMPLETE` | 422 | an intake error is still unconfirmed | CON-5 |
| `DAY_CAP_REACHED` | 422 | the per-user or project day spend cap would be passed (`details.scope`) | CON-5, CON-16 |
| `REASON_REQUIRED` | 422 | a resolution, a reopen or a guidance save has no reason | CON-14, CON-18, CON-24 |
| `NOTE_REQUIRED` | 422 | a safety-flag clear or a request for changes has no note | CON-14, CON-18 |
| `NOT_RESOLVABLE` *(System review)* | 422 | this issue kind cannot be cleared by a recorded resolution (it has its own action, or a guardrail forbids it) | CON-14 |
| `SOURCE_REQUIRED` | 422 | a quote or excerpt has no source | CON-15 |
| `QUOTE_TOO_LONG` | 422 | a `short-quote-commentary` quote is over 12 words | CON-15 |
| `BLOCKED` | 422 | a blocking issue stands (on the stored copy or on the re-run) | CON-18 |
| `CONFIRMATION_OPEN` | 422 | a `narrowed` or `added` standard is unconfirmed | CON-18 |
| `SUGGESTION_PENDING` | 422 | an AI suggestion is neither accepted nor rejected | CON-18 |
| `FOUR_EYES` | 422 | the approver was the last stored editor | CON-18 |
| `RATING_REQUIRED` | 422 | Approve has no draft-quality rating | CON-18 |
| `DEPENDENCY_UNAPPROVED` | 422 | a lesson this one links to is not approved | CON-18 |
| `SCHEMA_UNKNOWN` | 500 | the stored lesson's `schema_version` is unknown (a server-side data fault, named so it is never a blank 500) | CON-11 |
| `SHEET_UNREACHABLE` *(System review)* | 502 | Google Sheets did not answer within 10 s [A] | CON-2 |
| `MODEL_UNAVAILABLE` | 503 | the model call failed or timed out | CON-17 |
| `COLLAB_UNAVAILABLE` *(System review)* | 503 | the collaboration server could not apply the change (it is restarting); retry is safe | CON-14, CON-15, CON-16, CON-17, CON-18 |
| `SERVICE_BUSY` *(System review)* | 503 | no database connection was free within 2 s at a load spike (capacity doc); carries `Retry-After`; the client retries with backoff | all |

`DISCONNECTED` is a **channel state** on CON-12, not an HTTP error.

**Screen response to the System-review codes** (the UX side's copy may change; that is presentation): `INVALID_REQUEST`
→ keep the form, mark the named fields; `INVALID_CREDENTIALS` → "That email and password don't match"; `SERVICE_BUSY`
and `COLLAB_UNAVAILABLE` → keep what the person typed, "Busy for a moment; trying again…", retry up to 3 times, then
offer Retry; `SHEET_UNREACHABLE` → "Couldn't reach Google Sheets. Try again, or upload the file."; the card-specific
codes are on their cards.

### Guarantees every card shares

1. **Wrong role → `ROLE_FORBIDDEN`, on the server**, for every action (R-54; UX-1 note).
2. **A refused call changes nothing**: no state, version, approval, audit or spend row. *System support:* every mutating
   operation validates first and writes in one Postgres transaction; any refusal rolls it back. A refused attempt goes to
   the application log, never to the audit table.
3. **Lesson content is written only through the collaboration server** (CON-12). HTTP operations that change content
   (CON-14 standards, CON-15, CON-16 adopt, CON-17 accept) hand the change to it over a private internal call; it applies
   the change through a server-side connection (`openDirectConnection`) as one Yjs transaction attributed to the named
   person, then stores at once. If the collaboration server cannot be reached, the call returns `COLLAB_UNAVAILABLE` and
   nothing changes. Every other reader uses the stored derived row or an immutable snapshot (HP-4, R-26, R-29).
4. **Every person's action is in the append-only audit log**: who, when, from, to, version hash, reason (R-35).
5. **Reads never change state.** That is why UXP-1's "opening starts the review" is an explicit CON-18 call the
   workspace makes, not a side effect of CON-11.
6. **Text from the outline or the model is returned as text, never as HTML** (R-58).
7. **One lesson per call** on every transition. No bulk approve (GR-6, R-33).
8. **No route returns review minutes with a person's name** (GR-15, HP-8).
9. **Progress is polled, never streamed** (PD-18).
10. **Interactive requests never wait behind generation** (capacity doc, DO-1 D-3): generation runs in the worker's
    `lesson_job` lane; after-store checks run in its separate `check_job` lane, which never waits for a generation slot;
    reads and transitions run in the web app. Load never causes a refusal except `SERVICE_BUSY` after a 2 s wait.
11. **Error precedence** (System review): when several refusals apply, the server returns the first in this order:
    `UNAUTHENTICATED` → `INVALID_REQUEST` → `ROLE_FORBIDDEN` → `NOT_FOUND` → `INVALID_TRANSITION` / `LESSON_LOCKED` → the
    missing-input codes (`REASON_REQUIRED`, `NOTE_REQUIRED`, `RATING_REQUIRED`, `SOURCE_REQUIRED`, `QUOTE_TOO_LONG`) →
    the card's own conditions in the order its card lists them. CON-18 gives its full order.

### Timing in one place

Targets hold at the **200-concurrent-user spike** with ≤ 6 generation jobs in flight (PD-33,
[capacity doc](../design/capacity-and-workload.md)), which supersedes the 25-user figures in R-56 and R-57.

| What | Number | Source |
|---|---|---|
| Progress and board polling | every 2 s; a tile shows a state change within 3 s [T]; poll p95 < 300 ms [T] | PD-18, R-17, capacity doc |
| Ordinary reads and writes (no model, no socket hop) | p95 < 500 ms [T] | System review [A, checked by the §8–§10 load script] |
| Writes through the collaboration server (CON-14 standards, CON-15, CON-16 adopt, CON-17 accept) | p95 < 1 s [T] | System review |
| Editor store debounce | ≤ 2 s [T] | R-26 |
| Store transaction | p95 ≤ 500 ms [T], confirmed by SP-2 | HP-4 |
| Remote edit visible to a co-editor | p95 < 500 ms [T] at the spike | R-56 as amended (PD-33; cut #1 measures it) |
| Edit durably stored | p95 < 3 s [T] | R-56 (cut #1) |
| Checks re-run after a store | ≤ 5 s [T]; worst case ≈ 3.4 s [C on A]: debounce 2 s + store 0.5 s + `check_job` claim ≤ 0.5 s + checks ~50 ms + issue read 0.3 s | R-28, DO-1 §4.1 |
| Lesson open (editor ready with content) | p95 < 1.5 s [T] | R-57 as amended (PD-33) |
| Unit board (~47 rows) | p95 < 1 s [T] first load; polls p95 < 300 ms [T] | R-57, capacity doc |
| Submit (lock, flush, snapshot) | p95 < 2 s [T] for the call, of which the store transaction p95 ≤ 500 ms (SP-2) | HP-4, HP-5, System review |
| Approve (pin check, checks re-run on the snapshot, write) | ≤ 2 s [A] | DO-1 per-operation table |
| AI suggestion | p95 ≤ 10 s [A], timeout 20 s [A] → `MODEL_UNAVAILABLE` | System review |
| Socket reconnect after a drop | within 10 s [T] | capacity doc |
| Heartbeats | every 15 s while focused, visible and touched in the last 60 s [A] | R-49, HP-8 |
| Generation | p95 ≤ 5 min per lesson, not counting queue wait [T]; 47 days within 2 h [T]; ≤ $1 per lesson [T]; confirmed by SP-1 | R-55 |
| Concurrency | ≤ 6 lesson jobs in flight [A], starting at 4, across ≤ 3 active runs; set from SP-1's rate-limit headers | PD-13, HP-7, capacity doc |

---

<a id="con-1"></a>

## CON-1 · Session and role

**Status:** agreed · **Product questions:** none · **Backend owner:** web app

- **Needed by:** SCR-1 and every screen's header · US-37 · FLOW-1.
- **Operation(s):**
  - `signIn` — sign in with an allow-listed staff email and its password → a session with one role.
  - `getSession` — who am I, and with which role.
  - `signOut` — end the session.
- **Fields:**
  - Request (`signIn`): `email` (text, an email address), `password` (text). *System choice:* a password per seeded staff
    account, stored as a slow salted hash; no email service is needed for the local Compose demo (PD-15 option D).
  - Response: `user` with `user_id` (text), `name` (text), `email` (text), `role` (one of `author`, `reviewer`,
    `approver`), `synthetic` (yes/no: an account Claude or a load script drives, HP-8); `expires_at` (date-time).
- **States:** signed out → signed in with a role. Sign-out, or 12 h without a request [A], returns to signed out.
- **Permissions:** `signIn` is open to anyone. `getSession` and `signOut` need a session.
- **Named errors:**
  - `NOT_ON_ALLOW_LIST` (403) — the email is not on the staff list. Changes nothing; still signed out.
  - `INVALID_CREDENTIALS` (401) — a listed email with the wrong password. Changes nothing. Each failure waits ~1 s before
    answering, which slows guessing.
  - `UNAUTHENTICATED` (401) — `getSession` or `signOut` without a valid session. Changes nothing.
  - `ROLE_FORBIDDEN` (403) — returned by every *other* card when the role lacks the action. Defined here, used everywhere.
- **Recovery:** an unknown email sees "This email is not on the staff list" and stays on SCR-1; a wrong password sees
  "That email and password don't match". A refused action keeps the person on their screen with the server's message
  ("Only approvers can approve"). An expired session sends the person to SCR-1 with `next=` set; typed dialog text stays
  in memory through a re-sign-in on the same page (UXQ-1).
- **Guarantees:**
  - Roles are enforced on the API and on the socket (R-54). *System support:* the session is an opaque random token in an
    HttpOnly, SameSite=Strict cookie (`ls_session`; Secure outside localhost), held server-side in Postgres, so the web
    app and the collaboration server check the same session row. Mutating requests are also refused unless their
    `Origin` is the app's own.
  - Staff accounts only; no student or teacher-of-record data (GR-13).
  - The demo seeds one account per role (R-54), plus the `synthetic` flag for Claude-driven accounts (HP-8, PD-25).
    `synthetic` is set only by the seed script; no API route changes it.
  - Sign-out ends the session row; the collaboration server closes that session's sockets [A].
- **Timing:** p95 < 500 ms [T] apart from the deliberate ~1 s delay on a failed sign-in.
- **Presentation notes:** an author lands on SCR-2; a reviewer or approver lands on SCR-8 (FLOW-1). The landing choice is
  the frontend's, from the role.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: Claude (System track, Opus), 2026-10-25 — agreed: feasible as specified; fixed the sign-in method
    (email + password on seeded accounts), added `INVALID_CREDENTIALS`, `expires_at` and the session mechanism shared with
    the socket; `synthetic` is seed-only.
- **Open behaviour questions:** none.

<a id="con-2"></a>

## CON-2 · Outline versions

**Status:** agreed · **Product questions:** UXP-9 (naming only), UXQ-2 (identifiers), decided 2026-10-25 · **Backend owner:** web app

- **Needed by:** SCR-2, SCR-3 · US-1, US-2 · FLOW-2.
- **Operation(s):**
  - `listUnits` — units with their outline versions and latest run.
  - `uploadOutline` — upload a CSV or XLSX file → a new outline version.
  - `importOutlineLink` — import a public Google Sheet link → a new outline version.
- **Fields:**
  - Request (`uploadOutline`): the file (bytes; CSV or XLSX; ≤ 5 MB [A]). (`importOutlineLink`): `sheet_url` (text, a URL).
  - Response (both): `outline_version_id` (text), `unit_id` (text, e.g. `G6.U4`), `unit_key` (text, e.g. `g6-u4`),
    `version_number` (whole number), `sha256` (text, 64 hex characters), `same_as_version` (whole number or empty),
    `changed_lessons` (whole number), `row_counts` (`lessons`, `flex_days`, `arc_headers`, `total_rows`: whole numbers),
    `created_at` (date-time), `created_by` (user name).
  - Response (`listUnits`): a list of units, each with `unit_id`, `unit_key`, `title` (text, "Grade 6 · Unit 4"),
    `versions` (the fields above, newest first) and `latest_run` (`run_id`, `state`, or empty).
- **States:** a successful upload stores outline version N, immutable. A failed upload stores nothing.
- **Permissions:** `listUnits`: every role. `uploadOutline`, `importOutlineLink`: `author`. Wrong role → `ROLE_FORBIDDEN`.
- **Named errors:**
  - `SHEET_NOT_PUBLIC` (422) — the link is private (the export URL answers with a sign-in page or 401/403). Nothing stored.
  - `SHEET_UNREACHABLE` (502) — Google Sheets did not answer within 10 s [A]. Nothing stored.
  - `UNSUPPORTED_FILE` (422) — not CSV or XLSX, or over 5 MB (`details.reason` = `type` or `too_large`). Nothing stored.
  - `HEADER_NOT_FOUND` (422) — no header row found; `details.columns_looked_for` lists the names searched. Nothing stored.
  - `TOO_MANY_ROWS` (422) — over 200 rows [T]. Nothing stored.
- **Recovery:** the author shares the sheet publicly or uploads the file, retries or uploads the file when Sheets is
  unreachable, fixes the file, or splits it. On success the screen opens the report (CON-3).
- **Guarantees:**
  - Each upload is a new immutable version with its SHA-256; re-uploading touches no lesson (R-1).
  - The same bytes twice give version 2 with `same_as_version: 1` and `changed_lessons: 0` (R-1's acceptance criterion).
    Two near-simultaneous uploads give two versions; neither changes the other.
  - The normalizer is deterministic and makes no model call (PD-27, HP-6). The link's bytes are fetched once and stored;
    the sheet is never re-fetched for that version.
  - A private sheet gets a plain message, never a stack trace (R-2).
  - *Unit matching (System review):* a version is filed under the unit the sheet writes (`U4` with the grade → `G6.U4`).
    The filename conflict ("U3") is a report error the author confirms in CON-4; it never moves the version silently.
- **Timing:** parsing ≤ 200 rows is synchronous: upload p95 < 2 s [A]; a link import adds the fetch (≤ 10 s timeout).
- **Presentation notes:** the one-unit Units home (UXP-9) is presentation; this card is needed for R-1's version list
  either way.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: Claude (System track, Opus), 2026-10-25 — agreed: synchronous parse kept; added the unit-matching rule,
    `unit_key` (UXQ-2), the 5 MB limit and `SHEET_UNREACHABLE` for a failed fetch.
- **Open behaviour questions:** none.

<a id="con-3"></a>

## CON-3 · Validation report

**Status:** agreed · **Product questions:** UXQ-9, decided 2026-10-25 · **Backend owner:** web app

- **Needed by:** SCR-4 · US-3, US-4, US-5 · FLOW-2, FLOW-3.
- **Operation(s):** `getValidationReport` — an outline version → its report.
- **Fields:**
  - Response:
    - `outline_version_id`, `version_number`, `sha256`, `same_as_version`.
    - `unit`: `as_written` (text, "U4"), `filenames_say` (text, "U3"), `confirmed` (yes/no), `confirmed_by` (name or empty),
      `finding` (the unit-conflict finding, or empty when the sheet and filenames agree; confirm it with CON-4 `confirm_unit`).
    - `counts` (whole numbers): `teaching_days`, `lessons`, `flex_days`, `arc_headers`, `total_rows`, `errors`,
      `errors_unconfirmed`, `warnings`, `unit_conflicts`, `malformed_codes`, `rows_with_nonexistent_code`,
      `bad_filenames`, `eld_mismatches`.
    - `rows`: each with `row_number`, `kind` (`lesson`, `flex_day`, `arc_header`, `total`), `lesson_id` (text or empty),
      `level` (`ok`, `info`, `warning`, `error`) and:
      - `findings`: `finding_id`, `level`, `kind`, `column`, `original_text`, `proposed_fix`, `choice` (`value`,
        `source` = `default` or `confirmed`, `by`, `at`). **Finding kinds (System owns the list):** errors —
        `malformed_code`, `nonexistent_code`, `unit_conflict`, `duplicate_id`, `missing_required_column`; warnings and
        info — `parent_code`, `bad_filename`, `eld_mismatch`, `eld_not_checked`, `vocabulary_over_cap`,
        `vocabulary_word_missing`, `homework_links_later_row`, `non_breaking_space`, `duplicate_text`,
        `instruction_shaped`, `safety_note_proposed`, `writer_task`. A new kind is a `CHG-N`.
      - `segments`: the cell split. `segment_id`, `column`, `kind` (`content`, `writer_task`, `editor_note`,
        `unit_rule`, `safety_note`), `text`, `action` for notes (`apply`, `show_only`, `ignore`), `source`, `by`.
      - `eld`: `code`, `sheet_label`, `official_strand`, `verdict` (`fits`, `mismatch`, `not_checked`),
        `suggested_remap`, `choice` (`keep` or `remap`). `sheet_label` is the label on the sheet (empty when the
        sheet line fitted); `official_strand` is the seeded CDE strand; `suggested_remap` is the stored proposal.
      - `flags`: e.g. `instruction_shaped` (kept as content).
    - `unit_rules`: `text`, `scope_rows` (list of whole numbers), `source`.
    - `runs_from_this_version` (System review, UXQ-9): `run_id`, `started_at`, `choices_hash` for each run started from
      this version, newest first; empty before the first run. SCR-4's "A run started from these choices at 10:50" banner
      reads it.
    - `generate_allowed` (yes/no).
- **States:** reading the report changes nothing. `generate_allowed` turns true when `errors_unconfirmed` is 0.
- **Permissions:** every role may read.
- **Named errors:** `NOT_FOUND` — no such version.
- **Recovery:** the author works through the errors with CON-4, then presses Generate (CON-5).
- **Guarantees:**
  - The issued sheet reproduces R-5's counts exactly: 47 teaching days, 1 unit conflict, 1 malformed code, 3 rows with a
    non-existent code, 2 bad filenames, 7 ELD mismatches (R-5, HP-6). WP-5 shows OK with 0 warnings.
  - Only **errors** block Generate; every warning carries a stored default (R-5 as amended, HP-6).
  - *System support for determinism:* the normalized rows and findings are computed once at upload and stored; a read
    overlays the stored choices. With no choice recorded in between, two reads give byte-identical responses (fixed field
    order, rows by `row_number`, findings by `finding_id`). No model call happens before a run (HP-6).
  - Cell text is returned as text, never markup (R-58). Instruction-shaped text is flagged and kept as `content` (R-6).
- **Timing:** p95 < 500 ms [T] (a stored read of ≤ 200 rows).
- **Presentation notes:** grouping (errors first, then warnings) and the counts strip are presentation.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: Claude (System track, Opus), 2026-10-25 — agreed: report stored at upload, choices overlaid, so it stays
    byte-identical; fixed the finding-kind list; added `runs_from_this_version` for UXQ-9.
- **Open behaviour questions:** none.

<a id="con-4"></a>

## CON-4 · Intake choices

**Status:** agreed · **Product questions:** UXQ-9, decided 2026-10-25 · **Backend owner:** web app

- **Needed by:** SCR-4 · US-3, US-4, US-5 · FLOW-3.
- **Operation(s):** `recordIntakeChoice` — one choice on one finding, segment or ELD code → the updated row and counts.
- **Fields:**
  - Request: `target_id` (text: a finding, segment or ELD entry), `kind` (one of `confirm_unit`, `confirm_fix`,
    `edit_fix`, `set_note_action`, `change_split`, `set_unit_rule_scope`, `eld_keep`, `eld_remap`,
    `confirm_safety_note`, `reject_safety_note`, `revert`), `value` (text or list, depending on the kind; empty for
    `revert`). `revert` (System review) puts the target back to its stored default; SCR-4's **Undo** uses it.
  - Response: the updated `row` (as in CON-3), the new `counts`, `generate_allowed`.
- **States:** a finding moves from `default` to `confirmed by <name>` (or back, with `revert`). When the last error is
  confirmed, `generate_allowed` becomes true. A confirmed `safety_note` becomes a safety flag at generation (HP-9).
- **Permissions:** `author`. Wrong role → `ROLE_FORBIDDEN`.
- **Named errors:**
  - `NOT_FOUND` — no such target. Changes nothing.
  - `INVALID_CHOICE` (422) — the value does not fit the kind (e.g. `edit_fix` with a code that is not in the standards
    list, a unit-rule scope naming a row outside the sheet); `details.reason` says which. Changes nothing.
  - `INVALID_TRANSITION` (409) — `confirm_unit` with a *different* unit after a run has started from this version (the
    runs are filed under the unit). Changes nothing.
- **Recovery:** the author makes another choice. On `INVALID_CHOICE` the inline editor stays open with the message.
- **Guarantees:**
  - Each choice is stored as `default` or `confirmed by <name>` and shown later in the lesson's evidence pane (R-5, HP-6).
  - A re-map of an ELD code is logged with the author's name; the code stays the record unless re-mapped (R-4, DIR-5).
  - Notes default to *apply* (HP-6, U1). Writer tasks default to excerpt slots (HP-6).
  - Safety notes: pattern rules propose, the author confirms (PD-26, HP-9).
  - **UXQ-9 (decided):** choices stay editable after a run started; they apply to the next run only. *System support:*
    `startRun` copies the current choice set into the run and records its hash (`choices_hash`, CON-3/CON-5), so a
    running run never sees a later change.
  - Two authors changing the same target: the later write wins; both are in the audit log.
- **Timing:** p95 < 500 ms [T].
- **Presentation notes:** inline controls versus a side panel are presentation; Undo's toast is presentation over `revert`.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: Claude (System track, Opus), 2026-10-25 — agreed: UXQ-9 supported by copying choices into each run;
    added `revert` (for Undo), `INVALID_CHOICE`, and `INVALID_TRANSITION` for a late unit change.
- **Open behaviour questions:** none.

<a id="con-5"></a>

## CON-5 · Start a run

**Status:** agreed · **Product questions:** UXP-5, UXQ-3, UXQ-9, decided 2026-10-25 · **Backend owner:** web app (creates the jobs the worker claims)

- **Needed by:** SCR-4, SCR-5, SCR-21 · US-6, US-10, US-36 · FLOW-3, FLOW-4, FLOW-18, FLOW-19.
- **Operation(s):** `startRun` — scope, prompt version and cap → a run. A **one-lesson trial** uses the same call and
  writes a candidate (CON-16) instead of a lesson.
- **Fields:**
  - Request: `outline_version_id` (text), `mode` (`run` or `trial`), `scope` (`all`; `rows` with a list of row numbers
    such as 8, 9, 25; or `unfinished_of_run` with a `run_id`, for UXP-5), `lesson_id` (text, trial only),
    `prompt_version_id` (text: one locked layer + one guidance version), `cap_usd` (money amount). Optional header
    `Idempotency-Key`: the same key within 24 h returns the first call's run and starts nothing new.
  - Response: `run_id`, `state` (`planning`), `mode`, `scope`, `outline_version_id`, `prompt_version_id`,
    `choices_hash` (UXQ-9), `cap_usd`, `spent_usd` (0), `created_by`, `created_at`.
- **States:** creates a run in `planning` and one queued job per lesson in scope, in one transaction. In a full run, no
  lesson job starts before the UnitPlan is stored (R-8). If the UnitPlan call still fails after its one repair, the run
  becomes `paused` with `paused_reason.check = unit_plan`, and Resume (CON-7) retries it.
- **Permissions:** `author`. Wrong role → `ROLE_FORBIDDEN` ("Only authors can start a run").
- **Named errors:**
  - `VALIDATION_INCOMPLETE` (422) — an intake error is unconfirmed; `details.errors_unconfirmed` gives the count. No run.
  - `DAY_CAP_REACHED` (422) — today's committed spend (settled + reserved) plus this run's cap would pass the author's day
    cap or the project ceiling (PD-29); `details.scope` = `user` or `project`, `details.remaining_usd`. No run.
  - `INVALID_REQUEST` (400) — e.g. a trial without `lesson_id`, or `unfinished_of_run` naming a run of another version.
  - `ROLE_FORBIDDEN` — not an author. No run.
- **Recovery:** confirm the report (CON-4), lower the scope or cap, or wait for the next day (the day is the UTC calendar
  day [A]).
- **Guarantees:**
  - Refused **before any spend**; the Generate control and the API both refuse (R-5).
  - The run pins one prompt version (program-wide guidance, UXQ-3) and one intake choice set (UXQ-9); changing either
    later leaves the run unchanged (R-38).
  - The run never exceeds its cap: reserve-then-settle before every call, checked atomically against the run cap, the
    author's day cap and the project ceiling (R-16 as amended, HP-7, PD-14, PD-29; DO-1 D-8).
  - Jobs are idempotent per (run, lesson, prompt version, schema version) (R-16).
  - A trial writes a candidate, never an overwrite (R-39); it counts against the day cap and its own cap.
  - Never refused for load: jobs beyond the concurrency cap wait `queued`, fair-share across runs (capacity doc).
  - **UXP-5 (decided):** a cap is never raised in place; to finish a capped run, the author starts a new run with scope
    `unfinished_of_run` and a new cap.
- **Timing:** the call p95 < 500 ms [T] (the plan call runs afterwards in the worker). Generation p95 ≤ 5 min per lesson
  [T]; the 47-day unit within 2 h [T] at the concurrency cap (R-55); confirmed by SP-1. The per-run cap's suggested value
  is PD-14's formula, set from SP-1's measured cost.
- **Presentation notes:** the dialog may suggest a cap; the number comes from PD-14 after SP-1.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: Claude (System track, Opus), 2026-10-25 — agreed: day cap checked on settled + reserved spend per user
    and per project; trials count; added scope `unfinished_of_run` (UXP-5), `choices_hash` (UXQ-9), `Idempotency-Key`,
    the plan-failure path; cost and timing numbers confirmed by SP-1.
- **Behaviour questions:** [UXP-5](#uxp-5), UXQ-3, UXQ-9 — decided 2026-10-25 (recommendation adopted under PD-31).

<a id="con-6"></a>

## CON-6 · Run progress

**Status:** agreed · **Product questions:** UXP-5, UXP-8, decided 2026-10-25 · **Backend owner:** web app (reads the worker's `lesson_job` rows)

- **Needed by:** SCR-6, SCR-2 · US-7, US-8, US-36 · FLOW-4, FLOW-5, FLOW-19.
- **Operation(s):** `getRunProgress` — a run → its state and one tile per lesson. Polled.
- **Fields:**
  - Response: `run_id`, `state` (run state), `paused_reason` (`check`, `lesson_ids`, or empty), `capped_by` (`run_cap`,
    `day_cap`, `project_cap`, or empty), `spent_usd`, `reserved_usd`, `cap_usd`, `concurrency_cap` (whole number),
    `queued_ahead` (whole number: jobs from other runs ahead of this run's next queued job), `counts_by_tile_state`,
    `updated_at`, and `tiles`: `lesson_id`, `lesson_key`, `number`, `title`, `tile_state`, `attempts`, `repair_used`
    (yes/no), `truncation_retry_used` (yes/no), `failure_reasons` (list of `check` + `message`), `cost_usd`, `openable`
    (yes/no).
  - `failure_reasons[].check` (System review) is one of `schema_invalid`, `truncated`, `rate_limited`, `provider_error`,
    `timeout`, `compile_error`, `check_failed` (with `check_kind`, a CON-13 issue kind), `cancelled`, `capped`.
- **States:** reports states the worker sets. A `ready` tile means the lesson is stored as `draft` v1 with provenance. A
  `failed` tile means `generation_failed` with reasons, except `cancelled` and `capped` tiles of jobs that never started:
  those have no lesson row. The run ends `complete`, `partial`, `capped`, `paused` or `cancelled`.
- **Permissions:** every role may read.
- **Named errors:** `NOT_FOUND`. The run states `capped`, `paused`, `partial` are **states**, not errors.
- **Recovery:** `partial` → Retry failed (CON-7). `paused` → read the repeated failure, then Resume (CON-7). `capped` →
  start a new run on the rest (UXP-5). A `ready` lesson opens in SCR-9 while others draft. Failed polls: the screen keeps
  the last data and shows the paused-updates line after 10 s (UXQ-4).
- **Guarantees:**
  - A lesson still failing after one repair is `generation_failed` with its reasons (R-19).
  - A cut-off draft gets one retry at a raised output limit, not counted as the repair (HP-7).
  - After a worker restart the run carries on at the next unfinished lesson; no lesson is stored twice; no completed
    call is paid for again (raw output checkpointed); calls lost in flight are at most the concurrency cap and counted
    (R-16 as amended, HP-7). *System support:* jobs are claimed with `SKIP LOCKED` and a lease renewed by heartbeat; a
    lapsed lease returns the job to `queued`.
  - Spend never passes the cap (HP-7): `spent_usd + reserved_usd ≤ cap_usd` at every read.
  - The queue wait is always visible ("queued, n ahead", capacity doc).
- **Timing:** polled every 2 s; each tile reflects a change within 3 s [T] (R-17, PD-18): the worker writes the job row
  on each step, and the poll reads ≤ 47 rows of one run by index, p95 < 300 ms [T] at the spike. Per-lesson timing
  confirmed by SP-1.
- **Presentation notes:** tile layout and the cost meter are presentation. The label `complete` is UXP-8 (naming only).
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: Claude (System track, Opus), 2026-10-25 — agreed: 3 s freshness holds (indexed read of one run's job
    rows, 2 s poll); `reserved_usd` is shown; fixed the failure-reason vocabulary; added `capped_by`, `queued_ahead`,
    `lesson_key`.
- **Behaviour questions:** [UXP-5](#uxp-5), [UXP-8](#uxp-8) (naming only) — decided 2026-10-25 (recommendation adopted under PD-31).

<a id="con-7"></a>

## CON-7 · Run control

**Status:** agreed · **Product questions:** UXP-5, decided 2026-10-25 · **Backend owner:** web app + worker

- **Needed by:** SCR-6 · US-8 · FLOW-5.
- **Operation(s):** `controlRun` — `cancel`, `retry_failed` or `resume` → the new run state.
- **Fields:**
  - Request: `action` (one of `cancel`, `retry_failed`, `resume`).
  - Response: `run_id`, `state`, `requeued_lessons` (list of lesson IDs).
- **States:** `retry_failed`: failed lessons → `queued`, run `partial` → `running`. `resume`: `paused` → `running` (a
  paused plan call is retried). `cancel`: `planning`, `running` or `paused` → `cancelled`.
- **Permissions:** `author`. Wrong role → `ROLE_FORBIDDEN`.
- **Named errors:**
  - `INVALID_TRANSITION` (409) — the action does not fit the state: Resume on a run that is not paused; Retry failed on a
    run that is not `partial` (a `complete` run has nothing to retry); any action on a `cancelled` or `capped` run.
    `details.state` gives the current state. Changes nothing.
  - `ROLE_FORBIDDEN`, `NOT_FOUND`.
- **Recovery:** the screen reloads the progress (CON-6) and shows the real state.
- **Guarantees:**
  - Cancel: calls in flight finish and are stored; no new calls start (HP-7). Jobs that never started show `failed` with
    reason `cancelled` and create no lesson.
  - Retry failed re-runs only the failed lessons; the ready lessons' hashes do not change (HP-7 truncation test).
  - Retries stay under the run's cap (reserve-then-settle, HP-7); a retry that would pass it ends the run `capped`.
  - **UXP-5 (decided):** there is no "raise the cap" action.
  - *System support:* the action takes a row lock on the run, so two clicks or two authors cannot both apply; the second
    sees the new state or `INVALID_TRANSITION`. A deploy's SIGTERM stops the worker claiming new jobs and lets in-flight
    calls finish; a killed worker's lapsed leases return jobs to `queued` (HP-7 mechanics 3).
- **Timing:** the call p95 < 500 ms [T]; the new state shows on the next poll (≤ 2 s).
- **Presentation notes:** which buttons show for which state is presentation; the server still refuses the rest.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: Claude (System track, Opus), 2026-10-25 — agreed: lease and SIGTERM behaviour stated; Retry on
    `complete` is `INVALID_TRANSITION`; row lock against double actions; Resume also retries a failed plan call.
- **Behaviour questions:** [UXP-5](#uxp-5) — decided 2026-10-25 (recommendation adopted under PD-31).

<a id="con-8"></a>

## CON-8 · Unit plan

**Status:** agreed · **Product questions:** none · **Backend owner:** web app

- **Needed by:** SCR-7 · US-9 · FLOW-4.
- **Operation(s):** `getUnitPlan` — a run → its stored UnitPlan and `lesson_link` rows. Read-only.
- **Fields:**
  - Response: `run_id`, `state` (`planning` while the plan call runs; `stored` after; `failed` if the plan call failed
    and the run is paused), `stored_at`, `entries` (one per teaching day: `lesson_id`, `day`, `purpose`, `routines`
    (list), `hands_forward`, `performance_task_thread`) and `lesson_links` (`link_id`, `from_lesson_id`, `from_address`,
    `to_lesson_id`, `to_slot_id`, `label`, e.g. "Lesson 4 Homework → Lesson 5 excerpt slot").
- **States:** none caused.
- **Permissions:** every role may read.
- **Named errors:** `NOT_FOUND`.
- **Recovery:** while `state` is `planning`, the screen shows "Planning the unit" and polls. On `failed`, it links to the
  run's progress (CON-6), where Resume retries.
- **Guarantees:**
  - One UnitPlan per run, stored before any lesson job starts; 47 entries on the issued unit (R-8).
  - `lesson_link` rows are computed by code at intake, never by the model; a hand-forward the model suggests stays
    advisory text (HP-1). *System support:* intake computes the links per outline version; `startRun` copies them into
    the run's plan in the same transaction that creates the run, so the plan carries them (R-8 as amended) and a later
    upload cannot change a running run's links.
  - Regeneration reuses the run's stored plan (R-8 as amended, HP-1).
- **Timing:** polled every 2 s while planning (PD-18); read p95 < 500 ms [T]. Plan validity (47 entries) confirmed by SP-1.
- **Presentation notes:** the arc grouping is presentation.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: Claude (System track, Opus), 2026-10-25 — agreed: links computed at intake and copied into the run's
    plan at run start (both HP-1 statements hold); added the `failed` plan state.
- **Open behaviour questions:** none.

<a id="con-9"></a>

## CON-9 · Unit board

**Status:** agreed · **Product questions:** UXP-1, UXP-2, UXP-6, UXQ-2, UXQ-5, decided 2026-10-25 · **Backend owner:** web app

- **Needed by:** SCR-8 · US-11, US-12, US-26, US-28 · FLOW-6, FLOW-13.
- **Operation(s):** `getUnitBoard` — a unit (optional state filter) → lesson rows and the roll-up.
- **Fields:**
  - Request: `state` (optional filter, a lesson state).
  - Response: `unit_id`, `unit_key`, `generated_at`, `rollup` (count per lesson state, over the whole unit even when
    filtered), `rows`: `lesson_id`, `lesson_key`, `number`, `title`, `type`, `state`, `blocking_count`,
    `confirmation_count`, `advisory_count`, `reviewer` (name or empty), `last_change_at`, `dependency_flags` (`kind` =
    `waits_on` or `source_reopened`, `status` = `slot_empty` or `waiting_for_source_approval` for `waits_on`,
    `lesson_id`, `label`), `send_back` (`tag`, `note`, or empty), `judge_flag` (only if the judge is built; labelled
    "provisional, not expert").
- **States:** none caused.
- **Permissions:** every role may read.
- **Named errors:** `NOT_FOUND`. "No lessons yet" is an empty list, not an error.
- **Recovery:** an empty board links to the latest run (CON-6).
- **Guarantees:**
  - **Sort order (UXQ-5, decided):** `generation_failed` lessons first as their own group; then the active lessons by
    `blocking_count` descending, then `advisory_count` descending, then lesson order; `approved` and `exported` lessons
    last, in lesson order. *System tie-break:* inside equal blocking and advisory counts, `confirmation_count`
    descending comes before lesson order. Roll-up counts equal the sum of lesson states (R-25).
  - Counts read the stored issue rows of each lesson's latest checked hash, never a live re-check.
  - Dependency flags come from `lesson_link` rows (HP-1); "a lesson this depends on was reopened" appears and nothing
    reopens on its own (HP-5 addendum).
  - A judge "no" raises a lesson but never blocks (HP-3, R-23).
  - **UXP-1 (decided):** `reviewer` is the reviewer who started the review.
  - **UXP-2 (decided):** a `waits_on` flag reads `slot_empty` while the slot is empty (blocks Submit and Approve) and
    `waiting_for_source_approval` once it is filled but the source is unapproved (blocks Approve only).
  - **UXP-6 (decided):** `send_back.tag` comes from the tag list.
- **Timing:** first load p95 < 1 s for ~47 rows [T] (R-57); polled every 2 s while open, poll p95 < 300 ms [T] at the
  spike (capacity doc).
- **Presentation notes:** whether confirmations show inside the blocking count or beside it is presentation; both counts
  are returned.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: Claude (System track, Opus), 2026-10-25 — agreed: UXQ-5 order implemented with a confirmation-count
    tie-break; 2 s polling; counts from stored issue rows; added `status` on `waits_on` (UXP-2), `unit_key`/`lesson_key`
    (UXQ-2), `generated_at`.
- **Behaviour questions:** [UXP-1](#uxp-1), [UXP-2](#uxp-2), [UXP-6](#uxp-6), UXQ-2, UXQ-5 — decided 2026-10-25 (recommendation adopted under PD-31).

<a id="con-10"></a>

## CON-10 · Unit metrics

**Status:** agreed · **Product questions:** UXQ-7, decided 2026-10-25 · **Backend owner:** web app

- **Needed by:** SCR-8 (north-star tile), SCR-19 (cut #6) · US-30, US-31, US-34, US-36 · FLOW-6, FLOW-16, FLOW-19.
- **Operation(s):** `getUnitMetrics` — a unit → the north-star tile and, if built, the quality page.
- **Fields:**
  - Response:
    - `north_star`: `median_minutes` (number or empty), `n` (whole number), `fast_approvals` (`count`, `of`),
      `approved` (`k`, `total`), `caption` (text, "No baseline yet (AQ-14). Measured with us as reviewers."),
      `segment_label` (text such as "one reviewer, n = 3", or empty).
    - `quality` (only if R-50 is built): `tiles` (`id` such as `V-1`, `O-2`, `H-4`; `value`; `n`; `label`),
      `rating_counts` (`usable_as_drafted`, `usable_with_edits`, `rewritten`, `n`), `seeded_errors` (`planted`,
      `caught`, `label` "our reviewers"). **When cut #6 fires, `quality` is `null`** (the key is present, the value is
      null), never an empty object.
- **States:** none caused.
- **Permissions:** every role may read (**UXQ-7, decided**: the tile is aggregate only, GR-15).
- **Named errors:** `NOT_FOUND`. No approved lesson yet → `median_minutes` empty and `n` 0.
- **Recovery:** with `n` 0 the tile says "No approved lessons yet" and shows no number.
- **Guarantees:**
  - Aggregate only; no minutes by named person (GR-15, R-49).
  - NS counts human sessions only, to the **first** approval; later approvals are rework (PD-1 amended, HP-8).
  - The median never comes without *n*, G-2, "approved k of N" and the caption (HP-8).
  - Fewer than 3 distinct reviewers in a segment → labelled (GR-15 as amended).
  - Every tile reads stored rows; a reopened lesson never changes its frozen row (R-50).
  - Ratings shown in aggregate with *n* (R-60).
  - *System support for G-2:* each frozen metrics row stores the approved version's word count and its G-2 threshold
    (half that version's read time, PRD G-2) when it is written at the first approval; `fast_approvals` counts rows whose
    active minutes fall under their own threshold.
- **Timing:** p95 < 300 ms [T] (aggregate over ≤ 47 frozen rows).
- **Presentation notes:** the tile's wording layout is presentation; its parts are not optional.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: Claude (System track, Opus), 2026-10-25 — agreed: G-2 threshold stored per frozen row from that
    version's word count; `quality` is `null` when cut; every role reads (UXQ-7).
- **Open behaviour questions:** none (UXQ-7 decided).

<a id="con-11"></a>

## CON-11 · Lesson read

**Status:** agreed · **Product questions:** UXP-1, UXP-6, UXQ-2, UXQ-11, decided 2026-10-25 · **Backend owner:** web app

- **Needed by:** SCR-9, SCR-14 · US-13, US-14, US-19, US-20, US-25, US-26 · FLOW-4, FLOW-6, FLOW-7, FLOW-8, FLOW-9,
  FLOW-10, FLOW-12, FLOW-13.
- **Operation(s):** `getLesson` — a lesson → everything the workspace and the approval review show, except live edits
  (those come from CON-12). The path accepts `G6.U4.L4` or `g6-u4:L4` (UXQ-2).
- **Fields:**
  - Response:
    - `lesson_id` (e.g. `G6.U4.L4`), `lesson_key` (`L4`), `unit_id`, `number`, `title`, `type`, `state`,
      `version_number`, `content_hash`, `state_vector` (text, base64), `schema_version`, `last_editor` (name or empty).
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
    - `reviewer` (name or empty), `send_back` (`tag`, `note`, `by`, `at`, or empty), `checklist` (when submitted or
      later: one item per key `standards`, `quotes_and_rights`, `eld_support`, `content_safety`, `ai_spans`,
      `dependencies` — those that apply, 4–6 — each `key`, `label`, `status`, `evidence_refs`), `dependencies`
      (`direction` = `waits_on` or `depended_on_by`, `lesson_id`, `slot_id`, `status`), `allowed_actions` (a hint for
      the screen; the server still decides).
- **States:** none caused (shared guarantee 5). **UXQ-11 (decided):** opening a lesson never starts its review; only a
  reviewer's explicit `start_review` (CON-18) does, so `allowed_actions` includes `start_review` only for a reviewer on a
  `draft`.
- **Permissions:** every role may read.
- **Named errors:**
  - `SCHEMA_UNKNOWN` (500) — the stored `schema_version` is unknown. `details` names the lesson and the version. The
    lesson is not opened; nothing is dropped.
  - `NOT_FOUND`.
- **Recovery:** on `SCHEMA_UNKNOWN` the screen says which lesson and version, and the operator re-compiles from the stored
  `LessonDraft` with no model call (HP-4 addendum).
- **Guarantees:**
  - Reads the stored derived row (or the snapshot for frozen states), never the live document (HP-4).
  - An unknown node or schema fails loudly; it is never silently dropped (R-11 as amended, HP-4 addendum).
  - Never a bare "aligned" badge: every link says who asserted it (R-20, GR-4). Official CDE text only (GR-5).
  - Texts appear as citation cards; no novel text is reproduced (R-12, GR-2).
  - **UXP-1 (decided):** `reviewer` is set when the review starts. **UXP-6 (decided):** `send_back.tag` vocabulary.
  - *System support for the open path:* `content` comes in this response, so a frozen lesson (or the first paint)
    needs no socket. An editable editor binds to the Y.Doc through CON-12 and accepts input only after `synced`, so the
    response copy and the live document never diverge in the editor. The checklist is computed from the snapshot.
- **Timing:** lesson open (editor ready with content) p95 < 1.5 s [T] at the spike (R-57, PD-33): this read p95 < 500 ms
  [A] for a ~3,300-word lesson (response ≈ 60–150 KB before compression [A]) plus the socket's first sync < 1 s [A];
  measured by the §8–§10 probe.
- **Presentation notes:** the evidence pane's order and the checklist's place on SCR-14 are presentation.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: Claude (System track, Opus), 2026-10-25 — agreed: `content` returned here, editor waits for socket sync;
    fixed the checklist keys; set `SCHEMA_UNKNOWN` to 500; added `lesson_key`/`unit_id` and the dual-form path (UXQ-2);
    UXQ-11 stated.
- **Behaviour questions:** [UXP-1](#uxp-1), [UXP-6](#uxp-6), UXQ-2, UXQ-11 — decided 2026-10-25 (recommendation adopted under PD-31).

<a id="con-12"></a>

## CON-12 · Collaboration channel (Yjs socket)

**Status:** agreed · **Product questions:** none open ([UXP-7](#uxp-7) follows from HP-4 and HP-5) · **Backend owner:**
collaboration server (one Hocuspocus process)

- **Needed by:** SCR-9 (also SCR-12 adopt, SCR-10 insert, through the server) · US-15, US-22 · FLOW-7, FLOW-13, FLOW-14.
- **Operation(s):** not HTTP. One authenticated websocket per lesson document (`lesson:<lesson_id>`). Described in the
  OpenAPI file under `x-collaboration-channel`.
  - **Sync:** Yjs updates both ways for the sections (one fragment per section) and the front matter (a Y.Map).
  - **Awareness:** each co-editor's name and cursor.
  - **Store acknowledgement:** after each durable store the server tells every client `stored` with `content_hash`,
    `state_vector` and `stored_at`. *System support:* a Hocuspocus stateless message (JSON `{ "type": "stored", … }`).
  - **Refusal message:** a write that is refused is reported to the person who typed it (`LESSON_LOCKED`).
  - **Mode change:** at Submit or Approve every connection switches to read-only; at Withdraw, Request changes or Reopen
    back to editable.
- **Fields:** the connection carries the app session (CON-1: the same `ls_session` cookie on the upgrade request).
  Messages: `stored` (`content_hash`, `state_vector`, `stored_at`), `refused` (`code`, `message`, `refused_from` — the
  client's state vector before the refused updates), `mode` (`editable` or `read_only`, with the lesson `state`).
- **States:** client states `connecting`, `synced`, `saving` (edits not yet stored), `stored`, `DISCONNECTED`,
  `read_only`. It never moves a lesson state by itself.
- **Permissions:** any signed-in role may connect and read. Writes are accepted only from `reviewer` connections, and only
  in an editable lesson state. *System decision:* this follows from HP-5 (the approver "never edits") and R-54; authors
  read only. An unauthenticated connection is refused (R-26, R-54).
- **Named errors:**
  - `UNAUTHENTICATED` — no valid session or an unknown email. The connection is refused.
  - `LESSON_LOCKED` — a write to a lesson that is not editable, or from a non-reviewer connection. Nothing persists; the
    typist is told.
  - `DISCONNECTED` (channel state) — the socket dropped. Local edits are held; Submit is off.
- **Recovery:** on `DISCONNECTED` the editor shows "Reconnecting: your last edits are not saved yet" and keeps Submit off
  until a `stored` acknowledgement covers the local edits (UXP-7, from HP-4/HP-5). On reconnect, Yjs resends the held
  edits; if the lesson froze meanwhile they come back as `refused`. On `LESSON_LOCKED` the editor turns read-only and
  shows which keystrokes were refused.
- **Guarantees:**
  - Only the collaboration server writes lesson content (R-26 as amended, HP-4). HTTP-originated content changes reach it
    over a private internal call (shared guarantee 3).
  - Each durable store writes, in one transaction, the Y.Doc bytes, the derived `Lesson` JSON, its SHA-256 and the state
    vector, plus one coalesced `check_job` row for the worker (R-26, HP-4, DO-1 D-6).
  - Round trip JSON → Y.Doc → JSON keeps the hash (HP-4; confirmed by SP-2).
  - "Last editor" is the user on the connection whose update was last stored, including AI accepts and candidate adoption
    (R-33 as amended, HP-5).
  - After a lock: 0 edits persisted; every keystroke is either in the snapshot or reported as refused to its typist (HP-5).
  - *How the Submit lock reaches this process (System review; confirmed by SP-2):* the web app checks role and state, then
    calls the collaboration server's internal freeze call; it sets the document's lock (every later update is refused
    before it is applied), stores at once, compares the submitter's state vector, writes the snapshot and the state
    change in one transaction, and broadcasts `mode: read_only`. SP-2 passed with refusing in place (option A: a per-update guard refuses every
    update after the lock; the editor drops refused local edits and tells the typist via `refused` with `refused_from`),
    so the close-every-connection fallback is not used ([CHG-1](CHANGES.md)).
  - No hosted Yjs vendor; persisted to our Postgres (PD-9).
- **Timing:** store debounce ≤ 2 s [T] (R-26); store transaction p95 ≤ 500 ms [T] (HP-4; SP-2); remote edit visible
  p95 < 500 ms [T] and durably stored p95 < 3 s [T] at the 200-user spike (R-56 as amended by PD-33; cut #1: if cut, the
  docs say it was not measured); reconnect within 10 s [T] (capacity doc).
- **Presentation notes:** cursor colours and the "saving" indicator are presentation.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: Claude (System track, Opus), 2026-10-25 — agreed: `stored` is a stateless message; the Submit lock is an
    internal freeze call into this process (SP-2 confirmed option A, refusing in place; fallback dropped by CHG-1, same promise);
    reviewer-only writes decided from HP-5/R-54; timing moved to PD-33 targets; stores enqueue the `check_job`.
- **Open behaviour questions:** none open. [UXP-7](#uxp-7) is recorded as following from HP-4 and HP-5.

<a id="con-13"></a>

## CON-13 · Issue list

**Status:** agreed · **Product questions:** UXP-2, decided 2026-10-25 · **Backend owner:** worker (runs the checks from `check_job`) + web app (serves the list)

- **Needed by:** SCR-9, SCR-14 · US-14, US-16, US-17, US-18, US-20, US-24, US-25 · FLOW-7, FLOW-8, FLOW-10, FLOW-11,
  FLOW-12.
- **Operation(s):** `getLessonIssues` — a lesson → its issues, as of a stored hash.
- **Fields:**
  - Response: `lesson_id`, `stored_hash` (the lesson's latest stored content hash), `checked_hash` (the stored content
    hash the checks ran on), `checked_at`, `pending` (yes/no: a newer store is still being checked), `counts`
    (`blocking`, `confirmation`, `advisory`), and `issues`: `issue_id`, `level`, `blocks` (list of `submit`, `approve`;
    empty for advisory), `resolvable` (yes/no: whether `recordResolution` may clear it), `kind`, `message`, `address`,
    `span_anchor` (Yjs relative position, base64, or empty), `related_lesson_id`, `resolution` (`by`, `reason`, `at`, or
    empty).
  - **Issue kinds (System owns the list; a new kind is a `CHG-N`):** `quote_placeholder_open`, `excerpt_slot_open`,
    `cross_lesson_link`, `standard_not_taught`, `standard_not_checked`, `code_not_allowed`, `minutes_out_of_range`,
    `section_missing`, `schema_invalid`, `quote_unmatched`, `page_out_of_range`, `proper_noun_unsourced`, `quote_without_source`,
    `quote_too_long`, `rights_to_clear`, `suggestion_pending`, `safety_flag_open`, `safety_note_without_tip`,
    `safety_text_in_student_block`, `disclosure_prompt`, `standard_confirmation`, `standard_add_suggestion`,
    `eld_label_mismatch`, `arc_repeat`, `vocabulary_over_cap`, `vocabulary_word_missing`, `linked_text_changed`,
    `judge_no`.
- **States:** none caused. The list changes after each store.
- **Permissions:** every role may read.
- **Named errors:** `NOT_FOUND`.
- **Recovery:** a click on an issue moves the selection to its `span_anchor` or `address` (R-27). While `pending` is true
  the screen shows "checking" and keeps Submit off; it re-reads the list on each `stored` acknowledgement and while
  `pending` is true.
- **Guarantees:**
  - Checks re-run on every durable store and read the stored derived row; cross-lesson checks read the other lesson's
    stored row (R-28 as amended, HP-4). *System support (DO-1 D-6, adopted under PD-32):* each store writes one coalesced
    `check_job` row in the same transaction; the worker claims it from its check lane (never behind generation), runs the
    deterministic suite and writes the `issue` rows keyed to the checked hash. A store on a lesson that others link to
    also enqueues a check for each linked lesson.
  - `pending` is true while a `check_job` exists for a stored hash newer than `checked_hash` (DO-1 D-6).
  - The blocking set is R-19 as amended in PRD §5.4 (HP-1, HP-2, HP-3, HP-5, HP-6, HP-9). Whether
    `proper_noun_unsourced` blocks everywhere or only in check items is set by SP-3; until then it blocks in check items
    and is advisory elsewhere [A].
  - `narrowed` and `added` codes are `confirmation` items: they block Submit and Approve, but count in neither V-1 nor
    G-1 (HP-3). WP-1 §C's old "advisory" `L.6.4.b` is superseded (GAP-1).
  - The judge's verdicts are advisory and labelled provisional (R-23).
  - A safety flag's issue links to its `teacher_tip`; warning text in a student-facing block is blocking (HP-9).
  - **UXP-2 (decided):** `cross_lesson_link` has `blocks: [submit, approve]` while the slot is empty, then
    `blocks: [approve]` until the source lesson is approved with its slot filled.
  - **Resolvable kinds (System review):** every blocking kind is `resolvable` except those with their own action or a
    guardrail: `suggestion_pending` (CON-17), `standard_confirmation` (CON-14 `decideStandard`), `safety_flag_open`
    (CON-14 `clearSafetyFlag`), `safety_note_without_tip` and `safety_text_in_student_block` (fix the content, GR-12),
    `rights_to_clear` (record a rights status by re-filling the slot, GR-3) and `cross_lesson_link` (approval order,
    HP-5 and R-34 as amended).
- **Timing:** a new blocking issue appears within 5 s of the store [T] (R-28); worst case ≈ 3.4 s [C on A] (DO-1 §4.1);
  the read p95 < 300 ms [T].
- **Presentation notes:** grouping by level and the jump animation are presentation.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: Claude (System track, Opus), 2026-10-25 — agreed: checks run in the worker from a coalesced `check_job`
    (DO-1 D-6), `pending` defined from it; fixed the kind list; added `stored_hash`, `blocks` (UXP-2) and `resolvable`;
    name-scan scope confirmed by SP-3.
- **Behaviour questions:** [UXP-2](#uxp-2) — decided 2026-10-25 (recommendation adopted under PD-31).

<a id="con-14"></a>

## CON-14 · Resolve and confirm

**Status:** agreed · **Product questions:** UXQ-8, decided 2026-10-25 · **Backend owner:** web app (+ collaboration server for
standards, which live in the front matter)

- **Needed by:** SCR-9, SCR-11 · US-19, US-20, US-21 · FLOW-8, FLOW-9, FLOW-10.
- **Operation(s):**
  - `recordResolution` — clear a blocking issue with a named resolution and a reason.
  - `clearSafetyFlag` — clear a safety flag with a note.
  - `decideStandard` — `confirm` or `remove` a `narrowed` / `added` code, `add` a code from an "add?" advisory, or `undo`
    the caller's last decision on that code (UXQ-8).
- **Fields:**
  - Request: `recordResolution`: `reason` (text). `clearSafetyFlag`: `note` (text). `decideStandard`: `code` (text),
    `decision` (`confirm`, `remove`, `add`, `undo`), `undo_of` (text: the `audit_id` being undone; `undo` only).
  - Response: `item_id`, `status` (`resolved`, `cleared`, `confirmed`, `removed`, `added`, `undone`), `by`, `at`,
    `audit_id`, and the lesson's new `counts`.
- **States:** an issue becomes resolved; a flag becomes cleared; a confirmation closes; a removed code takes its teach and
  check links with it and the checks re-run; an added code becomes `added` and opens its own confirmation (FLOW-9); an
  undo restores the code, its links and its confirmation exactly as before the undone decision.
- **Permissions:** `recordResolution` and `decideStandard`: `reviewer`. `clearSafetyFlag`: `reviewer` or `approver`
  (U9, PD-26). Wrong role → `ROLE_FORBIDDEN`.
- **Named errors:**
  - `REASON_REQUIRED` (422) — a resolution with an empty reason. Unchanged.
  - `NOTE_REQUIRED` (422) — a flag clear with an empty note. The flag stays open.
  - `NOT_RESOLVABLE` (422) — `recordResolution` on a kind that cannot be resolved this way (CON-13 `resolvable`);
    `details.use` names the right action. Unchanged.
  - `UNDO_EXPIRED` (409) — the undo came more than 60 s [A] after the decision, or another decision on the same code came
    after it. Unchanged.
  - `LESSON_LOCKED` (409) — the lesson is not editable. `clearSafetyFlag` is also allowed on a `submitted` lesson (the flag
    lives outside the document, so the approver can clear it while reviewing); it is refused only on `approved`,
    `exported`, and a `draft` whose review has not started.
  - `COLLAB_UNAVAILABLE` (503) — `decideStandard` could not reach the collaboration server. Unchanged; retry is safe.
  - `ROLE_FORBIDDEN`, `NOT_FOUND`.
- **Recovery:** the dialog keeps the text and asks for the missing reason or note. On `NOT_RESOLVABLE` the screen points to
  the action named in `details.use`. On `UNDO_EXPIRED` the toast closes and the screen re-reads the lesson; the person
  can make the opposite decision instead.
- **Guarantees:**
  - A block clears only by fixing the content or by a named person recording a resolution; the audit log shows user,
    reason and time (R-34). Resolutions count in G-1 (US-21).
  - Only a named person clears a safety flag, with a note; the generator may add flags but never clear them (PD-26,
    HP-9). The approver's checklist shows "safety flag cleared by <name>: <note>".
  - Confirming makes the link asserted by a named reviewer (HP-3, R-20). A standard decision (including an undo) is a
    front-matter change, so it goes through the collaboration server as a logged edit (HP-4) and **counts toward "last
    editor"** for four-eyes (System review confirms the [I]).
  - Resolutions and flag clears are issue and audit rows outside the document: they change neither the content hash nor
    the last editor (System review).
  - **UXQ-8 (decided):** confirm and remove act at once with a 6 s Undo toast; the server keeps the undo open for 60 s
    [A] so a slow network does not lose it.
- **Timing:** `recordResolution` and `clearSafetyFlag` p95 < 500 ms [T]; `decideStandard` p95 < 1 s [T] (collaboration
  hop); checks re-run within 5 s of the resulting store [T] (R-28).
- **Presentation notes:** dialog wording and the toast are presentation.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: Claude (System track, Opus), 2026-10-25 — agreed: a standard decision counts as an edit for four-eyes;
    resolutions and flag clears live outside the document; resolvable kinds listed (`NOT_RESOLVABLE`); added `undo` with
    `UNDO_EXPIRED` (UXQ-8), approver flag-clear on a submitted lesson, `COLLAB_UNAVAILABLE`.
- **Open behaviour questions:** none (UXQ-8 decided).

<a id="con-15"></a>

## CON-15 · Fill a placeholder or slot

**Status:** agreed · **Product questions:** UXP-2, decided 2026-10-25 · **Backend owner:** web app (validates) + collaboration server (inserts)

- **Needed by:** SCR-10 · US-17, US-18 · FLOW-8.
- **Operation(s):** `fillSlot` — a placeholder or excerpt slot → a `quote` node inserted by a named person. Filling a slot
  that already holds a quote replaces it (the way a reviewer records a cleared rights status later).
- **Fields:**
  - Request: `text` (text, ≤ 10,000 characters [A]), `source_ref` (`book` or `title`, `chapter`, `pages`, or `url`),
    `rights_status` (one of `public-domain`, `Newsela-owned`, `licensed`, `to-clear`, `short-quote-commentary`).
  - Response: `slot_id`, `inserted_by`, `inserted_at`, `content_hash` (the stored hash after the insert),
    `still_blocking` (yes/no), `blocking_reason` (e.g. "rights to clear"), `linked_lessons` (lessons whose link this slot
    feeds, with their new status).
- **States:** the slot's issue clears, or stays blocking if rights are `to-clear`. A linked lesson's item changes (UXP-2).
- **Permissions:** `reviewer`. Wrong role → `ROLE_FORBIDDEN`.
- **Named errors:**
  - `SOURCE_REQUIRED` (422) — no source. Nothing inserted.
  - `QUOTE_TOO_LONG` (422) — over 12 words with `short-quote-commentary`. Nothing inserted.
  - `LESSON_LOCKED` (409) — the lesson is not editable. Nothing inserted.
  - `COLLAB_UNAVAILABLE` (503) — the collaboration server could not apply the insert. Nothing inserted; retry is safe.
  - `NOT_FOUND` — no such slot (for example a co-editor deleted it). `ROLE_FORBIDDEN`.
- **Recovery:** the dialog keeps the text and asks for the source or a shorter quote, or retries. A `to-clear` insert asks
  the reviewer to record the rights later by filling the slot again.
- **Guarantees:**
  - Only a person inserts a quote; the generator has no `quote` type (R-12 as amended, HP-2, GR-2).
  - Every excerpt has a rights status; `to-clear` blocks approval (GR-3, R-19).
  - The insert is applied through the collaboration server as a logged edit by the named person (HP-4). *System support:*
    the web app validates, then the internal call applies the insert in one Yjs transaction and stores at once; the
    response returns after that store, so `content_hash` is stored. The text is stored as plain text (R-58).
  - *Word count (System review):* the 12-word rule counts whitespace-separated tokens that contain at least one letter
    or digit; punctuation-only tokens do not count.
  - **UXP-2 (decided):** filling Lesson 5's slot turns Lesson 4's homework item into "waiting for Lesson 5's approval",
    which blocks Approve only.
- **Timing:** the call p95 < 1 s [T]; the slot's issue clears within 5 s [T] (R-28; HP-4 freshness test).
- **Presentation notes:** showing what the slot asks for at the top of the dialog is presentation.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: Claude (System track, Opus), 2026-10-25 — agreed: HTTP → internal call → one Yjs transaction, stored
    before the response; failure is `COLLAB_UNAVAILABLE` with nothing inserted; word-count rule fixed; re-fill replaces;
    added `content_hash` and a text limit.
- **Behaviour questions:** [UXP-2](#uxp-2) — decided 2026-10-25 (recommendation adopted under PD-31).

<a id="con-16"></a>

## CON-16 · Candidates

**Status:** agreed · **Product questions:** UXP-3, decided 2026-10-25 · **Backend owner:** web app + worker (generates) + collaboration server
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
    adopted), `failure_reasons` (CON-6 vocabulary), `cost_usd`, `current_content_hash` (unchanged), `sections` (when
    ready), `note` (text or null: the optional note given to `regenerateLesson` for this candidate, trimmed; null if none;
    CHG-4; `getCandidate` and `regenerateLesson` both return it). `adoptCandidate` returns `candidate_id`, `audit_id`, the lesson's `last_editor` and its new `content_hash`.
- **States:** writes a candidate `lesson_version` marked "not adopted". Adopting is an edit; the current lesson state does
  not change. **`generation_failed` case (System review):** a lesson with no v1 has nothing to protect, so a successful
  regenerate stores its v1 directly and the lesson moves `generation_failed → draft` (the shared state table).
- **Permissions:** `regenerateLesson`, `adoptCandidate`: `reviewer`. `getCandidate`: every role (an author reads the
  candidate of a guidance trial started through CON-5). Wrong role → `ROLE_FORBIDDEN`.
- **Named errors:**
  - `LESSON_LOCKED` (409) — the lesson is submitted, approved or exported, or a `draft` whose review has not started;
    withdraw or reopen first (UXP-3). Unchanged.
  - `DAY_CAP_REACHED` (422) — the reviewer's day cap or the project ceiling would be passed. Unchanged.
  - `INVALID_TRANSITION` (409) — adopting a candidate that is not `ready`, or already adopted whole. Unchanged.
  - `COLLAB_UNAVAILABLE` (503) — adopting could not reach the collaboration server. Unchanged; retry is safe.
  - `ROLE_FORBIDDEN`, `NOT_FOUND`.
  - A failed candidate is a **status**, not an error; the current lesson is untouched.
- **Recovery:** read the candidate's failure reasons; try again later or edit by hand.
- **Guarantees:**
  - Regenerate never overwrites; the current version's hash is unchanged (R-29).
  - The job uses the run's stored plan and pinned prompt (R-8 as amended).
  - *Spend (System review):* each regenerate is a one-lesson job with its own cap (PD-14's per-lesson figure, set from
    SP-1), reserved and settled like any call, and counted against the requesting reviewer's day cap and the project
    ceiling (PD-29). It never draws on the original run's cap.
  - At most one candidate job per lesson is in flight: a second `regenerateLesson` while one is queued or drafting returns
    that candidate (202) and spends nothing; that candidate carries its own stored `note`, not the new one.
  - Adopting (whole or a section) is a logged `candidate-adopt` edit by a named person, applied through the collaboration
    server; the adopter becomes the last editor (R-29 as amended, HP-4, HP-5).
  - Copying text by hand from the candidate pane is not tracked: a known provenance gap, stated in the limits (HP-5).
- **Timing:** generation p95 ≤ 5 min [T] (R-55; confirmed by SP-1); candidate status polled every 2 s (PD-18); adopt
  p95 < 1 s [T].
- **Presentation notes:** side-by-side versus stacked compare is presentation.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: Claude (System track, Opus), 2026-10-25 — agreed: regenerate has its own per-lesson cap and counts
    against the day cap, not the run cap; `generation_failed` → v1 stored directly; one job in flight per lesson; added
    `INVALID_TRANSITION`, `COLLAB_UNAVAILABLE`, `cost_usd`.
  - Change CHG-4, 2026-10-25 (orchestrator under PD-32): `note` added to the response so SCR-12 can show "note: <note>";
    additive, no promise removed. See [`CHANGES.md`](CHANGES.md).
- **Behaviour questions:** [UXP-3](#uxp-3) — decided 2026-10-25 (recommendation adopted under PD-31).

<a id="con-17"></a>

## CON-17 · AI suggestions

**Status:** agreed · **Product questions:** UXP-3, decided 2026-10-25 · **Backend owner:** web app (the model call) + collaboration server (applies an accept)

- **Needed by:** SCR-13 (cut #8) · US-23 · FLOW-15.
- **Operation(s):**
  - `requestSuggestion` — a selection anchor and a note → a pending suggestion.
  - `listSuggestions` (System review) — a lesson → its pending suggestions, so the panel can show them again after a
    reload (a pending suggestion blocks Submit, so it must never be invisible).
  - `decideSuggestion` — `accept` or `reject`.
- **Fields:**
  - Request (`requestSuggestion`): `anchor` (`start` and `end`, Yjs relative positions, base64), `selected_text` (text,
    ≤ 2,000 characters [A]), `note` (text). (`decideSuggestion`): `decision` (`accept` or `reject`), `anchored_text_now`
    (text, optional: what the client sees under the anchor; a hint only).
  - Response: `suggestion_id`, `status` (`pending`, `accepted`, `rejected`, `closed`), `anchor`, `selected_text`,
    `suggested_text`, `requested_by`, `expires_at`; after an accept, `decided_by` and the lesson's new `content_hash`.
- **States:** creates a `pending` suggestion held outside the document. Accept → one transaction tagged `ai-assist` with
  the acceptor's name, then the checks re-run. Reject → discarded and logged. A pending suggestion closes on its own after
  30 min [A] (`closed`, no longer blocking).
- **Permissions:** `reviewer`. Wrong role → `ROLE_FORBIDDEN`.
- **Named errors:**
  - `LESSON_LOCKED` (409) — not editable (submitted, approved, exported; UXP-3). Unchanged.
  - `MODEL_UNAVAILABLE` (503) — the model call failed or passed its 20 s timeout [A]. Nothing changed.
  - `ANCHOR_CHANGED` (409) — the text under the anchor changed. The suggestion closes; ask again.
  - `COLLAB_UNAVAILABLE` (503) — an accept could not reach the collaboration server. The suggestion stays pending; retry.
  - `INVALID_TRANSITION` (409) — deciding a suggestion that is no longer pending. Unchanged.
  - `ROLE_FORBIDDEN`, `NOT_FOUND`.
- **Recovery:** ask again; or edit by hand.
- **Guarantees:**
  - Nothing AI-written enters a lesson silently; a person accepts (GR-7, R-31).
  - Applied only if the anchored text is unchanged (R-31 as amended, HP-5). *System support (a refinement of HP-5's
    mechanism; same promise):* the accept is applied by the collaboration server, not by the client. It resolves the
    anchor against the live document, compares the text there with the stored `selected_text`, and on a match replaces
    it in one transaction tagged `ai-assist` and attributed to the acceptor, then stores. The client's text is never
    trusted for this check.
  - A pending suggestion blocks Submit and Approve (R-31, HP-5).
  - Provenance shows "1 AI-assisted span, accepted by <name>" (R-31).
  - Not offered on approved lessons (GR-7); the panel warns against pasting student work (R-31). Only the selected text,
    the note and the lesson's own context go to the model.
- **Timing:** the request is synchronous: p95 ≤ 10 s [A], timeout 20 s [A]; accept p95 < 1 s [T].
- **Presentation notes:** the side panel and its warning placement are presentation.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: Claude (System track, Opus), 2026-10-25 — agreed: synchronous call with a timeout; the anchor check and
    the apply happen server-side against the live document (HP-5's promise kept, mechanism hardened); suggestions expire
    after 30 min; added `listSuggestions`, `COLLAB_UNAVAILABLE`, `INVALID_TRANSITION`.
- **Behaviour questions:** [UXP-3](#uxp-3) — decided 2026-10-25 (recommendation adopted under PD-31).

<a id="con-18"></a>

## CON-18 · Lesson transitions

**Status:** agreed · **Product questions:** UXP-1, UXP-2, UXP-4, UXP-6, UXP-10, GAP-2, UXQ-11, decided 2026-10-25 ·
**Backend owner:** web app + collaboration server (the lock, flush and snapshot)

- **Needed by:** SCR-9, SCR-14, SCR-15 · US-24, US-25, US-26, US-27, US-28, US-31 · FLOW-9, FLOW-11, FLOW-12, FLOW-13,
  FLOW-15.
- **Operation(s):** `transitionLesson` — one lesson, one move. Actions:
  - `start_review` (UXP-1, UXQ-11): `draft` → `in_review`; sets the reviewer. Only a reviewer's call starts it.
  - `submit`: → `submitted`; freezes the lesson and writes a snapshot.
  - `withdraw` (UXP-10): `submitted` → `in_review`.
  - `approve`: → `approved`, pinned to the snapshot.
  - `request_changes` (UXP-6): → `changes_requested`.
  - `reopen` (UXP-4): `approved` or `exported` → `reopened`, a new version.
- **Fields:**
  - Request: `action`, and by action:
    - `submit`: `client_state_vector` (base64: what the submitter's editor holds, so the server can refuse `NOT_STORED`).
    - `withdraw`: `note` (text, optional, UXP-10).
    - `approve`: `snapshot_hash` (text), `snapshot_state_vector` (base64), `rating` (`usable_as_drafted`,
      `usable_with_edits`, `rewritten`).
    - `request_changes`: `tag` (one of the UXP-6 tags), `note` (text), and optionally `snapshot_hash`,
      `snapshot_state_vector` (CHG-3: the pin the person was reading; both or neither, one alone is `INVALID_REQUEST`).
    - `reopen`: `reason` (text), and optionally the same pair (CHG-3).
  - Response: `lesson_id`, `from_state`, `to_state`, `version` (`version_id`, `version_number`, `content_hash`,
    `state_vector`), `audit_id`, and for `approve`: `dependency_record` (`lesson_id`, `approved_hash` of each lesson it
    links to) and `metrics_row_written` (yes/no).
- **States:** the moves in the shared table above. Submit, Approve and Reopen each write an immutable `lesson_version`
  snapshot (R-35 as amended). `withdrawn` is the audit name of the Withdraw move, not a state.
- **Permissions:** `start_review`, `submit`, `withdraw`: `reviewer`. `approve`, `request_changes`: `approver`. `reopen`:
  `approver` (UXP-4). Wrong role → `ROLE_FORBIDDEN` ("Only approvers can approve"; "Only reviewers start a review").
- **Named errors** (HTTP status in brackets):
  - `BLOCKED` [422] — a blocking issue stands; `details.issues` lists every open blocking **and** confirmation issue (also
    returned when the server's re-check fails on the stored copy or snapshot). Unchanged.
  - `CONFIRMATION_OPEN` [422] — a `narrowed` or `added` code is unconfirmed and no other blocking issue stands. Unchanged.
  - `SUGGESTION_PENDING` [422] — an AI suggestion is pending. Unchanged.
  - `NOT_STORED` [409] — the submitter's editor holds edits the server never received. Unchanged.
  - `STALE_PIN` [409] — the pinned hash or state vector does not match the current snapshot (Approve always; Request
    changes and Reopen when they carry a pin, CHG-3). Reload shows the new snapshot.
  - `FOUR_EYES` [422] — the approver was the last stored editor. Unchanged.
  - `RATING_REQUIRED` [422] — Approve without a rating. Unchanged.
  - `DEPENDENCY_UNAPPROVED` [422] — a lesson this one links to is not approved; `details` names it ("Lesson 5 must be
    approved first"). Unchanged.
  - `NOTE_REQUIRED` [422] — Request changes with an empty note. Unchanged.
  - `REASON_REQUIRED` [422] — Reopen with an empty reason. Unchanged.
  - `INVALID_TRANSITION` [409] — the move is not allowed from the current state (including `start_review` on a lesson
    another reviewer already started, and a second approver approving an already-approved lesson). Unchanged.
  - `COLLAB_UNAVAILABLE` [503] — a move that freezes or unfreezes the document (`submit`, `withdraw`, `request_changes`,
    `reopen`) could not reach the collaboration server. Unchanged; retry is safe.
  - `ROLE_FORBIDDEN` [403], `NOT_FOUND` [404].
- **Error precedence (System review):** `ROLE_FORBIDDEN` → `NOT_FOUND` → `INVALID_TRANSITION` → `NOTE_REQUIRED` /
  `REASON_REQUIRED` / `RATING_REQUIRED` → `NOT_STORED` (submit) → `STALE_PIN` (approve; request_changes and reopen when a pin is supplied) → `FOUR_EYES` (approve) →
  `SUGGESTION_PENDING` → `BLOCKED` → `CONFIRMATION_OPEN` → `DEPENDENCY_UNAPPROVED` (approve). `BLOCKED` wins over
  `CONFIRMATION_OPEN` and lists both kinds.
- **Recovery:** each refusal names what to fix. On `STALE_PIN` the approver (or the sender of a send-back) reloads SCR-14 and reads the new snapshot. On
  `FOUR_EYES` another approver approves. On `DEPENDENCY_UNAPPROVED` the source lesson is approved first. On
  `INVALID_TRANSITION` the screen reloads the lesson (CON-11) and shows its real state.
- **Guarantees:**
  - Submit needs zero blocking issues, freezes the document and writes a snapshot (R-33 as amended, HP-5, PD-7).
    *System support (confirmed by SP-2):* the web app checks role and state, then the collaboration server's internal
    freeze call locks the document, stores at once, checks that `client_state_vector` is covered by the stored state
    vector (else `NOT_STORED`), re-runs the blocking checks on the stored row, and writes the snapshot, the state change
    and the audit row in one transaction before broadcasting `mode: read_only` (CON-12; SP-2 option A, CHG-1).
  - Approve pins the snapshot's content hash and state vector, re-runs the blocking checks on it, and returns 409 on any
    mismatch with no change (R-33, HP-5). Read-only after. *System support:* the web app locks the lesson row, compares
    the pin, re-runs the checks on the snapshot, and writes the approval, the approval snapshot, the audit row and (at the
    first approval) the frozen metrics row in one transaction. The document is already frozen, so Approve needs no
    collaboration hop.
  - Request changes and Reopen may carry the pin the person was reading (CHG-3). If supplied it is compared to the
    latest snapshot inside the same locked transaction as Approve's, after `INVALID_TRANSITION`, `NOTE_REQUIRED` and
    `REASON_REQUIRED`, so a send-back can never act on text the person did not see. Absent pin: unchanged. Approve is
    unchanged.
  - Withdraw, Request changes and Reopen unfreeze through the same internal call; Reopen writes a new version from the
    approved snapshot. `exported` lessons can be reopened (FLOW-13).
  - Four-eyes on by default: "last editor" includes AI accepts, candidate adoption and standard decisions (PD-10, HP-5,
    CON-14).
  - No endpoint takes more than one lesson; no bulk approve (GR-6, R-33).
  - Approve without a rating is refused; the rating goes on the frozen metrics row, written once at the first approval
    (R-60, R-49, HP-8, HP-10).
  - Cross-lesson links are approved in order; the dependent approval records the source's approved hash (R-34, HP-5).
    **UXP-2 (decided):** while the source slot is empty the link is a blocking issue (Submit and Approve refused); once
    filled, only Approve is refused, with `DEPENDENCY_UNAPPROVED`.
  - Reopening a lesson another depends on flags the dependant on the board; nothing reopens on its own (HP-5 addendum).
  - Every move is in the audit log with who, when, from, to, hash and reason (R-35). Withdraw is logged as `withdrawn`.
  - **UXP-1, UXP-4, UXP-6, UXP-10, GAP-2 (decided):** as in each action above; R-33 says so in PRD §5.4.
- **Timing:** Submit p95 < 2 s [T] for the call, of which the store transaction is p95 ≤ 500 ms [T] after the last edit
  is received (HP-4, HP-5; confirmed by SP-2). Approve ≤ 2 s including the check re-run [A] (DO-1). Other moves
  p95 < 1 s [T].
- **Presentation notes:** where the checklist, the rating and the 409 message sit on SCR-14 are presentation. The reload
  wording "This lesson changed since you opened it. Reload." is copy.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: Claude (System track, Opus), 2026-10-25 — agreed: `withdrawn` is a logged move, not a state;
    `NOT_STORED` via state-vector cover check inside the freeze; statuses fixed; full error precedence (`BLOCKED` beats
    `CONFIRMATION_OPEN`); `exported` can be reopened; added `COLLAB_UNAVAILABLE`; freeze mechanics confirmed by SP-2.
  - Change CHG-3, 2026-10-25 (orchestrator under PD-32): optional pin on `request_changes` and `reopen`, checked as
    Approve's is; absent pin unchanged. See [`CHANGES.md`](CHANGES.md).
- **Behaviour questions:** [UXP-1](#uxp-1), [UXP-2](#uxp-2), [UXP-4](#uxp-4), [UXP-6](#uxp-6),
  [UXP-10](#uxp-10), [GAP-2](#gap-2), UXQ-11; [UXP-7](#uxp-7) follows from HP-4 and HP-5 — decided 2026-10-25
  (recommendation adopted under PD-31).

<a id="con-19"></a>

## CON-19 · Lesson history

**Status:** agreed · **Product questions:** none · **Backend owner:** web app

- **Needed by:** SCR-16 · US-29 · FLOW-16.
- **Operation(s):** `getLessonHistory` — a lesson → versions, provenance and audit rows. Read-only.
- **Fields:**
  - Response: `versions` (`version_id`, `version_number`, `kind` = `generated`, `candidate`, `submit`, `approval`,
    `reopen`; `content_hash`; `created_at`; `created_by`; `adopted` for candidates; `provenance` = `outline_row_hash`,
    `prompt_version_id`, `model`, `parameters`, `schema_version`, `example_set_id`, `run_id`, `cost_usd`,
    `derived_from_version_id`), `audit` (`at`, `user`, `action`, `from_state`, `to_state`, `version_hash`, `reason`),
    `ai_spans` (`accepted_by`, `at`).
- **States:** none caused.
- **Permissions:** every role may read.
- **Named errors:** `NOT_FOUND`.
- **Recovery:** none needed.
- **Guarantees:**
  - The audit log is append-only; the database rejects UPDATE and DELETE (R-35).
  - Every version has a non-null provenance object (R-35, GR-8). *System rule for human-made versions:* `submit`,
    `approval` and `reopen` versions inherit `outline_row_hash`, `prompt_version_id`, `schema_version` and `run_id` from
    the generated version they descend from, name it in `derived_from_version_id`, and carry `model`, `parameters` and
    `example_set_id` as empty and `cost_usd` as 0. Candidates carry their own model, parameters, run (or regenerate job)
    and cost.
  - A snapshot exists at generation, each candidate, Submit, Approve and Reopen (R-35 as amended, HP-4).
  - No minutes by named person appear here (GR-15).
- **Timing:** p95 < 500 ms [T].
- **Presentation notes:** timeline versus table is presentation.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: Claude (System track, Opus), 2026-10-25 — agreed: provenance rule for candidates and human-made
    versions fixed (inherit, `derived_from_version_id`, model fields empty); model fields made nullable.
- **Open behaviour questions:** none.

<a id="con-20"></a>

## CON-20 · Review heartbeats

**Status:** agreed · **Product questions:** none · **Backend owner:** web app

- **Needed by:** SCR-9, SCR-14 · US-15, US-30 · FLOW-7, FLOW-12.
- **Operation(s):** `sendHeartbeat` — one heartbeat → stored. Nothing comes back to show.
- **Fields:**
  - Request: `tab_id` (text), `focused` (yes/no), `visible` (yes/no), `last_input_at` (date-time), `sent_at`
    (date-time), `version_id` (text).
  - Response: none (204).
- **States:** none on the lesson. The server merges intervals per user across tabs. At the first approval CON-18 writes the
  frozen metrics row once.
- **Permissions:** `reviewer`, `approver`. *System decision:* author sessions do not count (authors do not review); an
  author's heartbeat gets `ROLE_FORBIDDEN` and the client does not send them. Synthetic accounts are stored but excluded
  (HP-8).
- **Named errors:** `UNAUTHENTICATED`; `ROLE_FORBIDDEN`; `NOT_FOUND`. A heartbeat that fails is dropped silently by the
  client.
- **Recovery:** none; the next heartbeat carries on.
- **Guarantees:**
  - Active means a focused, visible tab with input in the last 60 s [A] (R-49 as amended, HP-8). The idle window is a
    server parameter; widening it to 90 s after the stopwatch check (HP-8) is pre-agreed and is not a `CHG`.
  - One user in two tabs for 10 min counts 10 min, not 20; an idle tab adds ≤ 1 min (HP-8). Heartbeats closer than 10 s
    apart from one tab are stored but add no time.
  - Minutes are never returned with a name (GR-15). The editor shows "Active review time on this lesson is recorded and
    shown only as unit totals." (AQ-22, HP-8).
  - Reopening writes a new metrics row and never edits the old one (R-49).
- **Timing:** every 15 s while active (R-49); p95 < 200 ms [T] at ~9 heartbeats/s at the spike (capacity doc).
- **Presentation notes:** the disclosure line's position is presentation; the line itself is required.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: Claude (System track, Opus), 2026-10-25 — agreed: author sessions excluded (`ROLE_FORBIDDEN`); idle
    window a 60–90 s server parameter; 10 s minimum spacing; spike load fits.
- **Open behaviour questions:** none.

<a id="con-21"></a>

## CON-21 · Run summary

**Status:** agreed · **Product questions:** none ([UXP-8](#uxp-8) naming only) · **Backend owner:** web app

- **Needed by:** SCR-17 · US-32, US-36 · FLOW-16, FLOW-19.
- **Operation(s):** `getRunSummary` — a run → its totals. Read-only.
- **Fields:**
  - Response: `run_id`, `state`, `n` (lessons in scope), `wall_time_seconds`, `cost_usd`, `cost_per_ready_lesson_usd`
    (total cost ÷ ready lessons, a mean; empty when none is ready), `lessons` (`ready`, `failed`), `retries`,
    `failures_by_reason` (`reason`, `count`), `placeholders_left`, `calls_lost_in_flight`, `brakes_fired` (`brake`,
    `count`), `truncation_retries`, `p95_minutes_per_lesson`, `target_minutes_per_lesson` (5), `report_path` (text, or
    empty).
- **States:** none caused.
- **Permissions:** every role may read.
- **Named errors:** `NOT_FOUND`.
- **Recovery:** none needed.
- **Guarantees:**
  - Totals equal the sums over stored call rows; cost comes from provider usage fields (R-48).
  - Cost per lesson is per **successful** lesson (GP-107): failed attempts' cost is in the numerator, only ready lessons
    in the denominator.
  - Adds calls lost in flight, brakes fired and truncation retries (R-48 as amended, HP-7).
  - Every number carries its *n* (GR-14).
- **Timing:** p95 < 500 ms [T].
- **Presentation notes:** chart choice is presentation.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: Claude (System track, Opus), 2026-10-25 — agreed: cost per lesson is the mean per ready lesson (GP-107);
    field renamed `cost_per_ready_lesson_usd`.
- **Open behaviour questions:** none ([UXP-8](#uxp-8) naming only).

<a id="con-22"></a>

## CON-22 · Coverage matrix

**Status:** agreed · **Product questions:** none · **Backend owner:** web app

- **Needed by:** SCR-18 (cut #4) · US-33 · FLOW-16.
- **Operation(s):** `getCoverageMatrix` — a unit → standard × lesson cells. Read-only.
- **Fields:**
  - Response: `standards` (`code`, `official_text`, `never_assessed` yes/no), `lessons` (`lesson_id`, `number`), `cells`
    (`code`, `lesson_id`, `roles` = any of I / P / A, `confirmed_by` = `person`, `judge_only` or `generator_only`,
    `source` = `approved` or `working`).
- **States:** none caused.
- **Permissions:** every role may read.
- **Named errors:** `NOT_FOUND`.
- **Recovery:** none needed.
- **Guarantees:**
  - Computed by one query from stored alignment links, never by a model (R-41, DIR-8).
  - *Which version (System review):* a lesson's cells read its latest approved snapshot where one exists (`source:
    approved`), else its stored derived row (`source: working`).
  - Matches a hand count on three lessons; never-assessed standards are highlighted (R-41).
- **Timing:** p95 < 1 s [T].
- **Presentation notes:** the grid's colours are presentation; the I / P / A letters and the confirmed-by mark are not
  optional.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: Claude (System track, Opus), 2026-10-25 — agreed: approved snapshot where one exists, else the stored
    row, marked per cell with `source`.
- **Open behaviour questions:** none.

<a id="con-23"></a>

## CON-23 · Export

**Status:** agreed · **Product questions:** none · **Backend owner:** web app

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
- **States:** included lessons move to `exported`, in the same transaction that writes the export version.
- **Permissions:** `approver`. Wrong role → `ROLE_FORBIDDEN`.
- **Named errors:** `ROLE_FORBIDDEN`, `NOT_FOUND`.
- **Recovery:** a held-back lesson shows what it waits on ("Lesson 4 waits on Lesson 5").
- **Guarantees:**
  - Reads approved snapshots only (R-42 as amended, HP-4). `exported` lessons stay in later exports while their approved
    snapshot stands.
  - Includes a dependent lesson only while every lesson it links to is approved (R-42 as amended, HP-5 addendum).
  - Exporting twice with no change gives identical lesson payloads; the file validates against the published JSON
    Schema (R-42). Labelled "Export (no live integration)" (PD-22).
  - *No-change export (System review):* when the included set and its approved hashes equal the latest export's,
    `createExport` writes nothing and returns that export (200, `same_as_previous: true`); otherwise it writes a new
    version (201). Two simultaneous calls are serialized per unit, so the second sees the first's result.
  - The export JSON Schema will live at `docs/contracts/lesson-export.schema.json` (planned; written with the export
    ticket, generated from the Zod `Lesson` schema).
- **Timing:** `listExports` p95 < 500 ms [T]; `createExport` p95 < 2 s [A] for 47 lessons.
- **Presentation notes:** the label is required copy; the layout is presentation.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: Claude (System track, Opus), 2026-10-25 — agreed: a no-change export returns the previous version (200)
    without writing; per-unit serialization; schema path named (planned).
- **Open behaviour questions:** none.

<a id="con-24"></a>

## CON-24 · Prompt versions

**Status:** agreed · **Product questions:** UXQ-3, decided 2026-10-25 · **Backend owner:** web app

- **Needed by:** SCR-21 (cut #7), SCR-5 · US-6, US-10 · FLOW-4, FLOW-18.
- **Operation(s):**
  - `listPromptVersions` — the locked layer (read-only) and every guidance version.
  - `saveGuidance` — save new guidance text with a reason → a new guidance version.
- **Fields:**
  - Response (`listPromptVersions`): `current_prompt_version_id`, `locked_layer` (`version_id`, `text`, read-only),
    `guidance_versions` (`version_id`, `number`, `author`, `created_at`, `reason`, `diff` (text), `pinned_by_runs`).
  - Request (`saveGuidance`): `base_version_id` (text), `guidance_text` (text, ≤ 8,000 characters [A]), `reason` (text).
  - Response (`saveGuidance`): the new guidance version.
- **States:** a new immutable guidance version. Running runs keep their pin.
- **Permissions:** `listPromptVersions`: every role. `saveGuidance`: `author`. Wrong role → `ROLE_FORBIDDEN`.
- **Named errors:**
  - `REASON_REQUIRED` (422) — empty reason. Unchanged.
  - `STALE_BASE` (409) — `base_version_id` is no longer the latest guidance version (another author saved first);
    `details.latest_version_id` names it. Unchanged.
  - `ROLE_FORBIDDEN`.
- **Recovery:** the screen asks for a reason. On `STALE_BASE` it shows the newer version and its diff, keeps the typed
  text, and lets the author save again on top of it.
- **Guarantees:**
  - No API route writes the locked layer (R-38, GR-18).
  - Every prompt version is immutable; a run pins one; each lesson records it (R-38).
  - Guidance is program-wide and pinned per run (**UXQ-3, decided**).
  - "Try on one lesson" makes a candidate, not an overwrite (R-39; through CON-5 and CON-16).
  - *Two authors from the same base (System review):* optimistic concurrency; the second save gets `STALE_BASE`, so no
    save is silently lost.
- **Timing:** p95 < 500 ms [T].
- **Presentation notes:** the diff view is presentation.
- **Reviews:**
  - UX review: Claude (UX session), 2026-10-25, done.
  - System review: Claude (System track, Opus), 2026-10-25 — agreed: concurrent saves from one base refused with
    `STALE_BASE`; text limit; UXQ-3 stated.
- **Open behaviour questions:** none (UXQ-3 decided).

---

## Behaviour questions routed from UX-1

UX-1 listed ten planning proposals (UXP-1…UXP-10) and two gaps. Each is sorted below into one of three kinds. **Picking a
visual direction at UX-2 decided none of them**: a look sheet sets colour, type and layout, not who may act or what a
state means.

### A. Product behaviour: Innocent decides

Each changes who may act, what a state means, or what the record says. The recommendation is the UX-1 proposal. **All decided 2026-10-25** (the recommendation in each case), under
Innocent, 2026-10-25: "take your recommendations to all decisions you need me for". The cards they touch are no longer blocked by them; with the System review recorded on 2026-10-25 every card is `agreed`.

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
- 2026-10-25: System review (Claude, System track, Opus) recorded on all 24 cards; UXQ-2, 5, 7, 8, 9 and 11 folded in;
  all 24 `agreed`; OpenAPI 1.0.0. What changed per card: [`CHANGES.md`](CHANGES.md) → *UX-3a System review* and
  [`reviews/2026-10-25-system-review.md`](reviews/2026-10-25-system-review.md). Later changes are `CHG-N`.

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

**Folded in at the System review (2026-10-25):** UXQ-2 → CON-2, CON-6, CON-9, CON-11 and the shared *Identifiers*
rules (`unit_key`, `lesson_key`, dual-form paths); UXQ-5 → CON-9 sort order; UXQ-7 → CON-10 permission; UXQ-8 →
CON-14 `undo` with `UNDO_EXPIRED`; UXQ-9 → CON-3 `runs_from_this_version`, CON-4, CON-5 `choices_hash`; UXQ-11 →
CON-11 and CON-18 `start_review`; UXQ-3 → CON-5, CON-24. The OpenAPI file carries each.
