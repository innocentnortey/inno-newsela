# UX-3b · Screen specs — Newsela Lesson Studio

> **Status:** signed (waves 1–3) · **Date:** 2026-10-25 · **Direction:** D1 · Clear Ledger · **Design doc:**
> [`design.md`](../../design/design.md) (tokens, components, layout primitives) · **IA:** [`IA.md`](IA.md)
> **Built from:** [`SITEMAP.md`](../01-planning/SITEMAP.md), [`USER_FLOWS.md`](../01-planning/USER_FLOWS.md) (copy and
> error codes), [`USER_STORIES.md`](../01-planning/USER_STORIES.md), [`LOOK_SHEET_COPY.md`](../02-concepts/LOOK_SHEET_COPY.md).
> Contract ids are the draft `CON-N` from USER_FLOWS.md; the cards are being written in
> [`docs/contracts/INTERFACE.md`](../../contracts/INTERFACE.md) *(in progress)*. People's names and numbers are synthetic.

**What this is.** One spec per screen in the sitemap (21). Each says what the screen is for, which stories and
contracts it serves, how it is built in Clear Ledger, what it shows in **every** state (loading, empty, each named
error, partial, success, role-forbidden, read-only or frozen), the exact words the flows fix, accessibility notes, and
the open behaviour questions it rests on. The four core screens come first (SCR-4, SCR-8, SCR-9, SCR-14), then the rest
in number order. The five cut-order screens (SCR-13, SCR-18–SCR-21) are shorter.

**How sign-off works** (process revision 2026-10-25, UX-3b). Innocent signs specs **per wave**. A frontend feature
ticket is ready only when every screen it builds says `**Status:** signed` and every contract it uses is `agreed`
(`ticket_readiness.py`). All 21 specs are signed: wave 1 on 2026-10-25 (delegated), waves 2 and 3 on 2026-10-25 under PD-32 (see *Wave sign-off*).

## Wave sign-off

**Waves 2 and 3 signed 2026-10-25** (SCR-2, 3, 6, 7, 12, 16, 17; SCR-13, 18, 19, 20, 21 — the cut-order screens stay planned and are built only if their cut does not fire): Claude recommendation adopted under Innocent's standing authorization (PD-32). Basis: each spec lists every state, names its CONs, and its UXP/UXQ questions are decided (PD-31). He has not read them.

**Wave 1 signed 2026-10-25** under Innocent, 2026-10-25: "take your recommendations to all decisions you need me for". He has not read the specs; anything he raises reopens the screen. Signing a screen does not make its contracts `agreed`: a frontend ticket for it still needs its CONs agreed and the §6 gate (`ticket_readiness.py`).

**Proposal for the first frontend feature wave: the four core screens plus the sign-in page and the dialogs those four
open.** A core screen without its dialogs cannot finish its flow (SCR-9 without SCR-10 cannot clear a quote placeholder),
and the dialogs are small: they reuse the dialog shell from the foundation wave. The frontend builds against mocks of
the agreed contracts, so wave 1 does not wait for upload or runs to exist (SCR-4 reads a mocked report).

| Screen | Name | Proposed wave | Contracts that must be `agreed` first | Status | Signed (Innocent, date) |
|---|---|---|---|---|---|
| SCR-4 | Validation report | **1** | CON-3, CON-4, CON-5 | signed | Innocent ✓ 2026-10-25 (delegated) |
| SCR-8 | Unit board | **1** | CON-9, CON-10 | signed | Innocent ✓ 2026-10-25 (delegated) |
| SCR-9 | Lesson workspace | **1** | CON-11, CON-12, CON-13, CON-14, CON-16, CON-18, CON-20 | signed | Innocent ✓ 2026-10-25 (delegated) |
| SCR-14 | Approval review | **1** | CON-11, CON-13, CON-18, CON-20 | signed | Innocent ✓ 2026-10-25 (delegated) |
| SCR-1 | Sign in | **1** | CON-1 | signed | Innocent ✓ 2026-10-25 (delegated) |
| SCR-5 | Start run (dialog) | **1** | CON-5, CON-24 | signed | Innocent ✓ 2026-10-25 (delegated) |
| SCR-10 | Insert quote or excerpt (dialog) | **1** | CON-15 | signed | Innocent ✓ 2026-10-25 (delegated) |
| SCR-11 | Resolve or clear (dialog) | **1** | CON-14 | signed | Innocent ✓ 2026-10-25 (delegated) |
| SCR-15 | Send back or reopen (dialog) | **1** | CON-18 | signed | Innocent ✓ 2026-10-25 (delegated) |
| SCR-2 | Units home | 2 | CON-2, CON-6 | signed | PD-32 ✓ 2026-10-25 (Claude recommendation adopted) |
| SCR-3 | Upload outline | 2 | CON-2 | signed | PD-32 ✓ 2026-10-25 (Claude recommendation adopted) |
| SCR-6 | Generation progress | 2 | CON-6, CON-7 | signed | PD-32 ✓ 2026-10-25 (Claude recommendation adopted) |
| SCR-7 | Unit plan | 2 | CON-8 | signed | PD-32 ✓ 2026-10-25 (Claude recommendation adopted) |
| SCR-12 | Candidate compare | 2 | CON-16 | signed | PD-32 ✓ 2026-10-25 (Claude recommendation adopted) |
| SCR-16 | History and provenance | 2 | CON-19 | signed | PD-32 ✓ 2026-10-25 (Claude recommendation adopted) |
| SCR-17 | Run summary | 2 | CON-21 | signed | PD-32 ✓ 2026-10-25 (Claude recommendation adopted) |
| SCR-18 | Coverage matrix (cut #4) | 3 | CON-22 | signed | PD-32 ✓ 2026-10-25 (Claude recommendation adopted) |
| SCR-20 | Export (cut #5) | 3 | CON-23 | signed | PD-32 ✓ 2026-10-25 (Claude recommendation adopted) |
| SCR-19 | Unit quality (cut #6) | 3 | CON-10 | signed | PD-32 ✓ 2026-10-25 (Claude recommendation adopted) |
| SCR-21 | Prompt guidance (cut #7) | 3 | CON-24, CON-5 | signed | PD-32 ✓ 2026-10-25 (Claude recommendation adopted) |
| SCR-13 | AI assist panel (cut #8) | 3 | CON-17 | signed | PD-32 ✓ 2026-10-25 (Claude recommendation adopted) |

**One dependency to watch:** SCR-9's live editor needs CON-12 (the collaboration socket), which is the hardest
contract to mock. If CON-12 is not `agreed` when wave 1 starts, SCR-9 can be built first as a read view on CON-11 and
CON-13, with editing joining when CON-12 lands. That would split SCR-9 across two tickets, not two waves.

## Conventions every screen follows

These are stated once here so each spec only lists what is specific to it.

- **Shell:** the app shell from design.md §4 (nav rail, top bar with breadcrumb, `main` on `ground`). Dialogs open over
  their parent and have no address (IA §1).
- **Loading:** nothing for under 0.1 s; a pressed state up to 1 s; a skeleton in the final layout's shape for a region
  that takes 1–10 s; a progress count over 10 s. Any spinner waits `delay-indicator` (250 ms).
- **Can't load:** a page that fails to load shows, in its main area, "Couldn't load <thing>. Check your connection and
  try again." with a **Retry** button. Never an empty state in disguise, never a stack trace.
- **Not found:** "There is no <thing> in Grade 6 · Unit 4" with a link to the board.
- **Signed out mid-session:** any call that returns an expired session sends the person to `/sign-in?next=…`; typed text
  in an open dialog is kept in memory and restored after sign-in when the page is the same (proposal UXQ-1).
- **Role-forbidden:** the server refuses with `ROLE_FORBIDDEN` (every action contract). The screen shows the page
  read-only and the reason in text where the action would be ("Only approvers can approve"). If a forbidden action is
  somehow attempted, a `danger` banner repeats the server's sentence and nothing changes.
- **Stale data on polling screens** (SCR-6, SCR-8): if polls fail for more than 10 s, a `warn` banner says "Live
  updates paused. Showing the board as of 10:42. Retrying…", and the data stays visible with its time (UXQ-4).
- **Disabled actions** always carry their reason in text beside them (design.md, Button).
- **Status** is always glyph + word + colour (design.md §2).

---

## SCR-4 · Validation report
**Status:** signed (wave 1) — Innocent ✓ 2026-10-25, delegated: "take your recommendations to all decisions you need me for"

- **Purpose:** Show the outline author every problem in one outline version before any money is spent, let them
  confirm each error and each default, and keep Generate off until no error is unconfirmed.
- **Main user:** P-2 author (reviewer and approver can read). **Surface:** intake · page.
- **Stories:** US-3, US-4, US-5 (and US-1 for the version header). **Flows:** FLOW-2 (end), FLOW-3.
- **Contracts:** CON-3 (report), CON-4 (intake choices), CON-5 (Generate's refusal `VALIDATION_INCOMPLETE`).
- **Hard problems:** HP-6, HP-9.

**Layout (Clear Ledger, look sheet M1).** Two-pane with `rail-narrow` (288). Breadcrumb *Units › Grade 6 · Unit 4 ›
Validation report*.
- **Page sheet (left):** eyebrow "Outline v1 · validation report"; `h1` "Grade 6 · Unit 4 · *The Lightning Thief*";
  meta line: file chip `g6-u4-outline.xlsx` · "uploaded by A. Chen" · version chip `v1` · short hash.
  - **Errors** section heading with the octagon glyph and "5 errors to confirm" at the right. A table: count badge
    (1, 2, 3…), *where* ("Unit", "Row 8 · Lesson 4 · Focus", "Rows 30, 34, 39"), *what* (the original cell as a code
    chip and one sentence), the proposed fix under it with an arrow ("→ Proposed: `RL.6.1 · RL.6.2 · L.6.4`"), and
    actions **Confirm** (secondary `sm` with a check) and **Edit** (ghost `sm`).
  - **Warnings** section with the advisory glyph and "each shows its default". A dense table: *where*, *what the sheet
    says* (plain text, never markup), *default* as a segmented control or a single action:
    *Apply · Show to reviewer only · Ignore* for notes; "becomes an **excerpt slot**" for writer tasks; "**unit rule**
    for rows 8–23" for the vocabulary cap; *Keep · Re-map to `PII.6.2b`* for ELD labels, with the sheet's label and the
    official strand side by side; **Confirm as a safety flag** for row 39.
  - **OK rows**: collapsed into "Show 35 OK rows"; expanded, each reads like "Row 10 · Lesson 6 · OK · 0 warnings" on
    a `success-tint` line.
- **Rail (right):** a Summary card (stat list: Teaching days 47 · Errors to confirm 5 · ELD labels flagged 7 · Bad
  filenames 2), a `warn` banner "5 errors to confirm / Generate stays off: 5 errors to confirm", and the one primary
  action **Generate 47 lessons** (`lg`, full width).

**Components:** page sheet, table (dense variant for warnings), count badge, code chip, segmented control, buttons,
card with stat list, banner, status pills for row levels.

**States**

| State | What the person sees |
|---|---|
| Loading | Skeleton of the header, the Errors table (3 rows) and the Summary card. If the report takes over 1 s: "Reading 47 rows…" under the heading |
| Empty | Not possible for a stored version (a report always has rows). A version with no problems shows a `success` banner "No errors to confirm. 0 warnings." and Generate on |
| Partial (some confirmed) | Each confirmed row shows a success glyph and "Confirmed by A. Chen · 10:42" in place of its buttons, with **Undo** (ghost). The counts in the heading, the banner and the Summary go down at once; the banner reads "1 error still to confirm" |
| Warning changed from default | The segmented control moves; the row shows "Changed by A. Chen" in `small` `ink2`. Untouched warnings show "Default" in `ink3` |
| Edit a fix | The row opens an inline input prefilled with the proposed value (`RL.6.1 · RL.6.2 · L.6.4`), validated on blur against the standards list; invalid: "`RL.6.9.a` is not a California standard. Use a code from the standards list, e.g. `RL.6.9`." Save / Cancel |
| Instruction-shaped cell (FLOW-3 I1) | An advisory row: "Instruction-shaped text, kept as content" with the cell as plain text. No action needed |
| Markup in a cell | Shown as the literal characters (`<script>`), never rendered (R-58) |
| Error: a choice did not save (CON-4 fails) | The row keeps the person's choice, shows "Couldn't save this choice. Try again." in `danger` under it with **Try again**; counts do not change |
| Error: `VALIDATION_INCOMPLETE` | If Generate's contract is called with an error open (an old tab, or the API), a `danger` banner: "Generate refused: 1 error still to confirm." Focus moves to the first unconfirmed error |
| Success: all errors confirmed | The banner turns `success`: "All 5 errors confirmed. Generate is on." Generate becomes primary; pressing it opens SCR-5 |
| Older version | An `info` banner: "This is version 1. Version 2 was uploaded at 11:05." with a link. Version 2 with the same hash shows "Version 2 is the same as version 1; 0 lessons changed." |
| Role-forbidden / read-only | Reviewer or approver: no Confirm, Edit, Undo or segmented controls (each default shows as text); Generate is absent; an `info` line under the heading: "You're viewing as a reviewer. Only authors confirm the report." |
| Frozen | Once a run has started from this version, choices stay editable for the next run only; an `info` banner says "A run started from these choices at 10:50. Changes apply to the next run." (UXQ-9) |

**Copy fixed by the flows:** "5 errors to confirm" · "The sheet says **G6, U4**; every filename says **U3**. → Confirm
**U4**" · "`RL.6.1, 6.2 L.6.4` — "6.2" has no strand. → Proposed: `RL.6.1 · RL.6.2 · L.6.4`" · "`RL.6.9.a` does not
exist. → Drop it (`RL.6.9` is already listed)" · "Generate stays off: 5 errors to confirm" · "1 error still to confirm"
· "Instruction-shaped text, kept as content" · "Row 10 · Lesson 6 · OK · 0 warnings".

**Accessibility:** one `h1`; Errors and Warnings are `h2`s; each table has a caption. Confirm buttons are named with
their row ("Confirm U4 for the unit", "Confirm fix for row 8"). Count changes announce politely ("4 errors to confirm").
Generate uses `aria-disabled` with `aria-describedby` → the banner text. The segmented controls are radio groups named
by their row. Long cells wrap; the table scrolls in its own box under `lg`.

**Depends on:** UXP-9 (Units home lists versions); UXQ-9 (editing choices after a run started). Story acceptance:
"Exactly 7 of the 12 ELD codes are flagged."

---

## SCR-8 · Unit board
**Status:** signed (wave 1) — Innocent ✓ 2026-10-25, delegated: "take your recommendations to all decisions you need me for"

- **Purpose:** Show where the unit's lessons are and which to review next, sorted by what blocks; carry dependency and
  send-back flags; show the north-star tile honestly.
- **Main users:** P-1 reviewer, P-3 approver (author can read). **Surface:** review · page.
- **Stories:** US-11, US-12, US-30 (and US-26 for send-back tags, US-28 for reopen flags). **Flows:** FLOW-1 (landing),
  FLOW-6, FLOW-12 (entry), FLOW-13, FLOW-16.
- **Contracts:** CON-9 (board rows, roll-up, filter), CON-10 (north-star tile).
- **Hard problems:** HP-3, HP-5, HP-8, HP-10.

**Layout (look sheet M2).** Breadcrumb *Units › Grade 6 › Unit 4*. Page header: eyebrow "Unit board", `h1` "Unit 4 ·
*The Lightning Thief*", a count chip "47 lessons".
- **Top row** (grid: content + `metric-tile` 340):
  - **Roll-up sheet:** label "Where the 47 lessons are"; five cells with glyph, state and a `stat` number (Draft 34 · In
    review 6 · Submitted 2 · Approved 3 · Failed 2), divided by `hair` rules; a thin track bar below with one segment per
    state (an image with the same text as its accessible name). Cells are buttons that apply the filter.
  - **North-star tile:** label "Reviewer minutes per approved lesson"; `display` "24" + "min"; "median · *n* = 3"; two
    guard tiles "fast approvals 0 of 3" and "approved 3 of 47"; caption "No baseline yet (AQ-14). Measured with us as
    reviewers."
- **Board sheet:** a segmented filter *All · Draft · In review · Submitted · Approved · Failed* (plus *Changes
  requested* and *Reopened* when any exist) and "Sorted by blocking issues" at the right. Table columns: **Lesson**
  (title, the link), **Type**, **State** (pill), **Blocking** (octagon + count, `danger`, or a muted 0), **Advisory**
  (count in `warn`, or muted 0), **Reviewer** (avatar + name, or —), **Note** (one line: "Waits on Lesson 5's excerpt",
  "Safety flag open", "Standard proposed: `RL.6.7`", "Truncated · Retry", "Approved · v2", a send-back tag, "a lesson
  this depends on was reopened").
- **Links row** under the header (ghost links): Run summary · Unit plan · and, when built, Coverage · Unit quality ·
  Export.

**Row action by role:** a reviewer's click opens SCR-9. An approver's click on a `submitted` row opens SCR-14; on any
other row it opens SCR-9 read-only. A failed row's "Retry" is a link to SCR-6 (author's control).

**States**

| State | What the person sees |
|---|---|
| Loading | Skeleton: five roll-up cells, the tile frame, 8 table rows in final row height |
| Empty, first use | "No lessons generated for this unit yet." with "Lessons appear here as a run drafts them." and a link: author "Go to the validation report"; others "See the latest run" (FLOW-6 E1). The north-star tile is hidden |
| Empty, filter | "No lessons are In review." with **Show all lessons** |
| Partial: a run is going | An `info` banner: "Run in progress: 12 of 47 lessons ready. Watch progress" (link to SCR-6). Ready lessons are listed and openable; the rest are not rows yet |
| Partial: failed lessons | Failed rows show the Failed pill, — for counts and "Truncated · Retry" or the first failure reason |
| North-star empty | No approved lesson yet: "No approved lessons yet" and **no number** (FLOW-16 E1); the guard tiles read "approved 0 of 47" |
| Dependency flags | "Waits on Lesson 5's excerpt" (slot empty) or "Waits on Lesson 5's approval" (slot filled); after a reopen: "A lesson this depends on was reopened" with the `warn` glyph |
| Send-back | The row's note shows the tag pill (e.g. "Content safety") and "Changes requested by <name>"; the note text is in the lesson, not on the board |
| Judge (if built, cut #2) | A "no" verdict raises the row and adds "Judge: no · provisional, not expert" in the note |
| Stale (polling paused) | The shared stale banner; rows stay with "as of 10:42" |
| Error: can't load | The shared can't-load message with Retry |
| Error: tile can't load | The roll-up and table still show; the tile says "Couldn't load the north-star numbers. Retry." |
| Success | n/a (a read view). Changes from other screens appear on the next poll without moving the person's focus |
| Role-forbidden / read-only | Author: rows open SCR-9 read-only; nothing to act on here. No role is forbidden from the board |

**Copy fixed by the flows:** "Lesson 4 · Reading · draft · 3 blocking · 1 advisory" · "No lessons generated for this
unit yet" · "No baseline yet (AQ-14). Measured with us as reviewers." · "waits on Lesson 5: excerpt" · "a lesson this
depends on was reopened" · "provisional, not expert".

**Accessibility:** the table has `aria-sort` on Blocking; each lesson title is the row's single link. The roll-up
track has a text equivalent ("Draft 34, In review 6, Submitted 2, Approved 3, Failed 2"). Polling never moves focus
and announces only "Lesson 7 is ready" or a run-state change. The filter is a radio group "Filter lessons by state".
No view shows minutes by named person (GR-15).

**Depends on:** UXP-1 (who shows as reviewer), UXP-2 (two-phase dependency flag), UXQ-4 (stale banner), UXQ-5 (sort
order), UXQ-6 (approver's click goes to SCR-14), UXQ-7 (north-star tile shown to every role).

---

## SCR-9 · Lesson workspace
**Status:** signed (wave 1) — Innocent ✓ 2026-10-25, delegated: "take your recommendations to all decisions you need me for"

- **Purpose:** Let a reviewer read and edit one lesson in Newsela's own shape with the evidence beside it, fix or
  resolve every blocking issue, edit with colleagues, and submit when nothing blocks.
- **Main user:** P-1 reviewer (author and approver read; an approver may clear a safety flag). **Surface:** review · page.
- **Stories:** US-13, US-14, US-15, US-16, US-17 and US-18 (entry), US-19, US-20, US-21 (entry), US-22 (entry), US-24,
  US-12. **Flows:** FLOW-6 (end), FLOW-7, FLOW-8, FLOW-9, FLOW-10, FLOW-11, FLOW-13 (rework), FLOW-14 (entry), FLOW-15 (entry).
- **Contracts:** CON-11 (lesson read), CON-12 (collaboration socket), CON-13 (issue list), CON-14 (confirm, remove,
  resolve), CON-16 (regenerate), CON-18 (submit, withdraw), CON-20 (heartbeats).
- **Hard problems:** HP-1, HP-2, HP-3, HP-4, HP-5, HP-8, HP-9.

**Layout (look sheet M3).** Breadcrumb *Units › Grade 6 · Unit 4 › Lesson 4*. The top bar adds presence ("M. Okafor is
editing Part B" with a ringed avatar) and the save state ("Saved · 10:42").
- **Stepper** above the page: Draft → **In review** → Submitted → Approved → Exported.
- **Outline column** (`outline` 160): label "Sections · 50 min"; a list Launch 5 · Literacy Lab 10 · Learning in Action
  30 (Part A 15 · Part B 15) · Look Back 5 · Homework; each item shows its minutes, a blocking glyph where an issue sits,
  and a co-editor's initials. Clicking moves the editor to that section.
- **Page sheet** (the lesson as a document): toolbar strip (Paragraph, B, I, U, list, link, undo, redo); then the
  reading column: `h1` "Lesson 4: The Lightning Thief, Chapter 1"; meta "Reading · 50 min · In review · v3"; a
  collapsed **Lesson details** disclosure holding the form fields that are not editor text (section minutes, front
  matter); a **text card** for the novel (*The Lightning Thief* · Rick Riordan · ISBN 9780786838653 ·
  `off-platform-text`); then the sections, each with its label row ("Literacy Lab · 10 min"), routine heading
  ("Introduce New Words Using Morphemes"), Say / Ask lines, sample-response blocks, the "Integrated ELD Instructions"
  block, checks, and **quote slots** ("Reviewer to insert: one sentence from Ch. 1, pp. 1–8, where Percy's sarcastic
  word choice sets the tone" · rights `short-quote-commentary` · **Insert quote** · marker 1).
- **Evidence rail** (`rail` 360): tabs **Issues 4 · Standards 3 · Outline row**.
  - *Issues:* a count line "3 blocking · 1 advisory"; issue cards in order (Blocking · Quote placeholder open ·
    `G6.U4.L4.LearningInAction.PartA`; Blocking · Homework waits on Lesson 5's excerpt; Confirm · `L.6.4.b` was chosen
    by the tool — confirm or remove; Advisory · `ELD.PII.6.5` label names another strand); a "Resolved (n)" group.
  - *Standards:* the alignment map: code chip, origin ("from the outline", "outline, fixed by A. Chen", "AI-proposed ·
    confirm"), "taught: Part A · checked: Look Back", asserted by; the official text of the selected code in a `well`
    quote ("Official text · `L.6.4.b`"); **Confirm** and **Remove** on `narrowed` / `added` codes; "Also teaches
    `W.6.2.c`? **Add**" where the tool suggests one.
  - *Outline row:* the confirmed outline row, each cell with its kind (content, writer task, editor note, unit rule,
    safety note) and its default, as plain text.
- **Footer action bar** under the page: the disclosure "Active review time on this lesson is recorded and shown only
  as unit totals." at the left; at the right the blocking count ("3 blocking issues") and the primary **Submit for
  approval**; secondary actions in a "More" menu: Regenerate, History, AI assist (when built).

**Interactions.** Clicking an issue card moves the editor selection to its anchored span and scrolls it into view
(focus goes to the editor at that point). Clicking a slot's **Insert quote** opens SCR-10; **Resolve…** on an issue
opens SCR-11 (resolution); **Clear flag…** opens SCR-11 (safety-flag note). **Confirm** / **Remove** on a standard act
in place with an Undo toast for 6 s (UXQ-8). **Regenerate** asks for an optional note in a popover, then starts a
candidate job and shows "Drafting a candidate… The current lesson is unchanged." with a link to SCR-12 when ready.

**States**

| State | What the person sees |
|---|---|
| Loading | Skeleton: stepper, outline items, page title and ~8 text lines, 3 issue cards. After 1 s without the socket: "Connecting to the editor…" in the save-state slot; the text shows read-only from CON-11 until connected |
| Empty / not generated (`generation_failed`) | The page sheet shows a `danger` banner "This lesson has no draft yet. Generation failed: Look Back is 3 minutes (needs 5)." and, for a reviewer, **Regenerate** (primary). Stepper on step 1 with a Failed pill |
| First open of a draft (UXP-1) | The lesson moves to In review; a quiet line under the title: "You're the reviewer for this lesson." Stepper moves to step 2 |
| Editing, saved | Save state "Saving…" then "Saved · 10:42" (polite live region). Checks re-run within 5 s; the rail shows "Checking…" in its header meanwhile |
| Partial: checks re-running (stale issues) | Issue cards stay, dimmed to `ink2`, with "Checking…" until the new list arrives; then the counts update and announce ("Blocking issues: 2") |
| New blocking issue from an edit (FLOW-7 E3) | A new card appears at the top: "Blocking · `RL.6.2` has no checking item"; the footer count goes up; the outline item gets a blocking glyph |
| Co-editor present | Their caret with a name flag in their presence colour; their initials on the section; the top bar sentence names the section |
| Error: `DISCONNECTED` (UXP-7) | A `warn` banner on top of the page: "Reconnecting: your last edits are not saved yet. Submit is off until they are." Save state "Not saved"; typing continues locally; Submit off with reason "Saving" |
| Error: `SCHEMA_UNKNOWN` | No editor. The page shows "Lesson 4 won't open. It uses schema version 3, which this app doesn't know yet. Nothing has been dropped." and a link to the board |
| Error: can't load / not found | The shared messages ("Couldn't load Lesson 4…", "There is no Lesson 48 in Grade 6 · Unit 4") |
| Submit off, with reasons | Under Submit: each reason on its own line: "3 blocking issues" (`BLOCKED`), "1 standard to confirm" (`CONFIRMATION_OPEN`), "Accept or reject the AI suggestion first" (`SUGGESTION_PENDING`), "Saving" (`NOT_STORED`). Clicking Submit moves focus to the first issue |
| Error: server refuses Submit (FLOW-11 E4) | `danger` banner: "Submit refused: `RL.6.2` has no checking item on the stored copy." The issue appears in the rail; nothing is frozen |
| Dependency (UXP-2) | Lesson 4's homework issue reads "Homework waits on Lesson 5's excerpt" (blocks Submit and Approve) until the slot is filled, then "Waiting for Lesson 5's approval" (blocks Approve only; an advisory-styled note in the rail, Submit allowed) |
| Safety flag (Lesson 31) | A Blocking card "Safety flag open · content warning from the outline (row 39, Homework)" linked to the teacher tip; **Clear flag…** opens SCR-11. If the warning text is in a student-facing block: "Blocking · Move the warning out of the student text first" |
| Success: submitted | Toast "Lesson 4 submitted for approval." The page freezes (below); the stepper moves to step 3 |
| Frozen: `submitted` | No toolbar, no caret; `info` banner with a lock: "Submitted: waiting for approval". Reviewer sees **Withdraw** (secondary) in the footer; Regenerate and AI assist are not offered (UXP-3) |
| Frozen: `approved` / `exported` | `success` banner "Approved by D. Park · v3 · pinned `9f3c…a21e`"; read-only for everyone; History link. Reopen lives on SCR-14 (UXP-4) |
| `changes_requested` | Editable again; `warn` banner "Changes requested by D. Park · Content safety: <note>"; the stepper shows step 2 with a "Changes requested" pill |
| `reopened` | Editable; `info` banner "Reopened by D. Park: <reason>. This is version 4."; lessons that link to it are flagged on the board |
| Withdrawn | Toast "Lesson 4 withdrawn. It's back in review."; editable |
| Role-forbidden / read-only | Author or approver: the page reads like the frozen view with an `info` line "You're viewing as an approver. Only reviewers edit lessons." An approver still sees **Clear flag…** on a safety flag. Opening does not move a draft to In review (UXP-1 says a reviewer's open does) |

**Copy fixed by the flows:** "M. Okafor is editing Part B" · "Active review time on this lesson is recorded and shown
only as unit totals." · "Reconnecting: your last edits are not saved yet" · "`RL.6.2` has no checking item" ·
"AI-proposed, confirm" · "Submitted: waiting for approval" · "Reviewer to insert: one sentence from Ch. 1, pp. 1–8, where
Percy's sarcastic word choice sets the tone" · "Read and annotate *The Lightning Thief* Chapter 21 (pp. 344–353)."
(Lesson 31's student homework) · "3 blocking issues".

**Accessibility:** landmarks: the outline is a `nav` "Lesson sections"; the page is `main`'s article; the rail is an
`aside` "Evidence". The editor is a labelled multi-line textbox ("Lesson 4 text"); headings inside it stay in order
(R-58). Issue cards are buttons ("Go to issue 1: quote placeholder open in Learning in Action Part A. Blocking Quote placeholder open G6.U4.L4.LearningInAction.PartA message..."); after the jump,
focus is in the editor at the span. Keyboard order: top bar → stepper → outline → page → rail → footer. Optional
shortcuts `]` / `[` for next and previous issue. Presence carets carry names (not colour alone); the presence sentence
is real text. Save state and blocking-count changes are polite live regions, debounced. Sticky footer never hides the
focused element (`scroll-padding-bottom`). No time limit; the heartbeat is disclosed in text.

**Depends on:** UXP-1, UXP-2, UXP-3, UXP-7, UXP-10; UXQ-8 (Undo for confirm and remove), UXQ-10 (phone editing), UXQ-11
(read-only opens don't start review). CON-12 agreement is the main build risk (see *Wave sign-off*).

---

## SCR-14 · Approval review
**Status:** signed (wave 1) — Innocent ✓ 2026-10-25, delegated: "take your recommendations to all decisions you need me for"

- **Purpose:** Let an approver read one submitted lesson exactly as frozen, check each checklist item against its
  evidence, rate the draft, and approve that pinned version or send it back.
- **Main user:** P-3 approver (author and reviewer can read). **Surface:** approval · page.
- **Stories:** US-25, US-26 (entry), US-27, US-28 (entry), US-31. **Flows:** FLOW-12, FLOW-13.
- **Contracts:** CON-11 (frozen snapshot and checklist), CON-13 (issues re-checked), CON-18 (approve, request
  changes, reopen), CON-20 (heartbeats).
- **Hard problems:** HP-5, HP-8, HP-10.

**Layout (look sheet M4).** Breadcrumb *Unit 4 › Approvals › Lesson 5*. Stepper on step 3 (Submitted). Two-pane with
`rail` (360).
- **Page sheet:** eyebrow "Approval review"; `h1` "Lesson 5: Comparing Percy and Soongoora"; meta "Writing ·
  Submitted · by J. Rivera · snapshot `9f3c…a21e`" with a pin icon. A dependency banner where it applies (`info`:
  "Lesson 4 is waiting on this lesson's excerpt."). **Checklist** (heading, "each with its evidence"): 4–6 items, each
  with a check or blocking glyph, a bold title and its evidence line, and a link that jumps to the span in the frozen text:
  ✓ Quotes and excerpts — "excerpt inserted by J. Rivera from *Zanzibar Tales* (Bateman trans.) · rights:
  `public-domain` · source recorded"; ✓ Standards taught and checked — "`W.6.2.a`, `W.6.2.b`, `W.6.2.f` confirmed by
  J. Rivera"; ✓ ELD supports keep the same text and task; ✓ Social content reviewed; ✓ AI-assisted spans — "1
  accepted by J. Rivera"; where one was cleared: "Safety flag cleared by J. Rivera: <note>". Below a divider: **Lesson
  text (frozen at `9f3c…a21e`)**, the full read-only lesson in the reading column.
- **Decision rail:** a card labelled "Your decision": a four-eyes banner (`success`: "Four eyes · You did not edit this
  lesson, so you can approve it."), the **Draft quality (required)** radio cards (Usable as drafted · Usable with edits
  · Rewritten), **Approve this version** (primary `lg`), **Request changes** (secondary `lg`), small print with a pin:
  "Approving pins snapshot 9f3c…a21e. If it changes before you approve, you'll be asked to reload."

**States**

| State | What the person sees |
|---|---|
| Loading | Skeleton of the checklist (5 rows) and the decision card; Approve not shown until the snapshot hash has loaded |
| Empty / not submitted | A lesson in draft or review: "Lesson 4 isn't submitted yet. It's in review with M. Okafor." with a link to open it read-only. No decision card |
| Error: `DEPENDENCY_UNAPPROVED` | Lesson 4: the checklist item "Homework text — Lesson 5 must be approved first" with the blocking glyph and a link to Lesson 5; Approve off with that reason. The server refuses too |
| Error: `FOUR_EYES` | The banner turns `warn`: "Someone else must approve: you were the last editor of this lesson (including AI accepts and adopted candidates)." Approve off; Request changes stays on |
| Error: `RATING_REQUIRED` | Pressing Approve with no rating: the fieldset shows "Choose a rating to approve." in `danger`, focus moves to the first radio |
| Error: `STALE_PIN` (409) | A `danger` banner with `role="alert"` at the top: "This lesson changed since you opened it. Reload." with **Reload**. Nothing changed; the decision card is off until reload. After reload the new snapshot hash shows |
| Error: `BLOCKED` on re-run | `danger` banner: "Approve refused: `RL.6.2` has no checking item." The checklist item flips to blocking; Request changes is the suggested next step |
| Error: action failed (network) | "Couldn't reach the server. Your rating is kept. Try again." under the buttons |
| Partial | Checklist items load before the frozen text; the text region shows a skeleton until it arrives |
| Success: approved | `success` banner "Approved by D. Park · pinned `9f3c…a21e` · Usable with edits"; the stepper moves to step 4; the page is read-only; toast "Lesson 5 approved." If Lesson 4 waits on it, a line: "Lesson 4 can now be approved." with a link |
| Success: changes requested | After SCR-15: toast "Sent back to J. Rivera." The page shows the lesson as `changes_requested`, read-only here, with the tag and note |
| Frozen: `approved` / `exported` | The decision card is replaced by "Approved by D. Park on 2026-10-25" (and "Included in export v1" when exported) and **Reopen…** (secondary), which opens SCR-15 |
| Role-forbidden / read-only | Reviewer or author: everything readable; the decision card shows "Only approvers can approve" instead of controls. A forbidden call returns `ROLE_FORBIDDEN` and the same sentence in a `danger` banner |

**Copy fixed by the flows:** "This lesson changed since you opened it. Reload." · "Lesson 5 must be approved first" ·
"You did not edit this lesson, so you can approve it." · "Usable as drafted · Usable with edits · Rewritten" ·
"Approving pins snapshot 9f3c…a21e. If it changes before you approve, you'll be asked to reload." · "Lesson 4 is waiting
on this lesson's excerpt." · "safety flag cleared by <name>: <note>".

**Accessibility:** the checklist is a list with each item's state in text; evidence links name their target. The
rating is a `fieldset` with `legend` "Draft quality (required)". Approve uses `aria-disabled` with its reason. The 409
banner is an alert and receives focus. One action approves one lesson; there is no bulk control (US-25).

**Depends on:** UXP-2, UXP-4, UXP-6 (tags on send-back); UXQ-6 (entry from the board).

---

## SCR-1 · Sign in
**Status:** signed (wave 1) — Innocent ✓ 2026-10-25, delegated: "take your recommendations to all decisions you need me for"

- **Purpose:** Let allow-listed staff sign in and land by role.
- **Users:** all. **Stories:** US-37. **Flows:** FLOW-1. **Contracts:** CON-1.
- **Layout:** no app shell. A single centred card (`panel`, `radius-xl`, `e2`, `dialog-sm` width) on the `ground` desk:
  the product mark and name "Lesson Studio", `h1` "Sign in", one email field (label "Staff email"), the primary
  **Sign in** button, and a `small` note "Staff only. Use your Newsela email." In the demo, a `well` box lists the three
  demo accounts by role. How sign-in completes (link, code, password) is the System track's choice; the screen needs
  only the session and role.
- **States:**
  - Loading: the button keeps its width and shows a spinner after 250 ms.
  - Error `NOT_ON_ALLOW_LIST`: under the field, "This email is not on the staff list. Check the spelling or ask your
    content lead to add you." The email stays in the field.
  - Error, network: "Couldn't reach Lesson Studio. Try again."
  - Success: the person lands on SCR-2 (author) or SCR-8 (reviewer, approver), or on the `next` page.
  - Already signed in: `/sign-in` sends them to their landing page.
  - Empty / partial / role-forbidden / frozen: n/a (one field, no role yet).
- **Copy:** "this email is not on the staff list" (FLOW-1 E1).
- **Accessibility:** a real `<label>`, `autocomplete="email"`, paste allowed, no puzzle (SC 3.3.8); the error is
  wired with `aria-describedby` and focus returns to the field.
- **Depends on:** none.

---

## SCR-2 · Units home
**Status:** signed (wave 2) — Claude recommendation adopted under Innocent's standing authorization (PD-32), 2026-10-25 — basis: every state listed, every CON named, UXQ/UXP decided (PD-31); he has not read it; anything he raises reopens the screen

- **Purpose:** The author's start: the unit, its outline versions and the latest run, with the way to upload.
- **Users:** P-2 (all can open). **Stories:** US-1, US-6 (entry), US-10 (entry). **Flows:** FLOW-1, FLOW-2.
  **Contracts:** CON-2 (units and versions), CON-6 (latest run state).
- **Layout:** page header `h1` "Units" with the primary **Upload outline** (author). One unit card (`card`): "Grade 6 ·
  Unit 4 · *The Lightning Thief*", the latest run's state pill and progress ("Running · 12 of 47 ready") with a link to
  SCR-6, and links to the board and the validation report. Below, a table "Outline versions": version, file, uploaded by,
  date, short hash, "same as v1" where it applies, link to its report. A ghost link "Prompt guidance" (author; hidden when
  cut #7 fires).
- **States:**
  - Loading: skeleton card and 3 table rows.
  - Empty, first use: "No outline uploaded yet. Upload the unit's outline sheet to see its validation report before
    any lesson is drafted." with **Upload outline**.
  - Partial: a unit with versions but no run: "No run yet. Confirm the report, then generate." linking to the report.
  - Error: shared can't-load.
  - Success: n/a (read view).
  - Role-forbidden / read-only: reviewer and approver see the card and versions without Upload or Prompt guidance.
- **Copy:** "version 2 is the same as version 1; 0 lessons changed".
- **Accessibility:** the unit card's title is its one link; the versions table has a caption.
- **Depends on:** UXP-9 (this screen exists although the MVP has one unit).

---

## SCR-3 · Upload outline
**Status:** signed (wave 2) — Claude recommendation adopted under Innocent's standing authorization (PD-32), 2026-10-25 — basis: every state listed, every CON named, UXQ/UXP decided (PD-31); he has not read it; anything he raises reopens the screen

- **Purpose:** Bring in the unit outline as a file or a public Google Sheet link and store it as a numbered version.
- **Users:** P-2. **Stories:** US-1, US-2. **Flows:** FLOW-2. **Contracts:** CON-2.
- **Layout:** a page sheet, `dialog-md` wide, centred: `h1` "Upload outline"; a segmented control *File · Sheet link*.
  File: a drop zone with a **Choose file** button (dragging is never the only way), "CSV or XLSX, up to 200 rows".
  Link: a URL field "Google Sheet link" and a helper "The sheet must be shared so anyone with the link can view it." The
  primary **Upload** (or **Import**) at the end.
- **States:**
  - Loading: the button shows progress; over 1 s, "Reading rows…"; over 10 s, a step line ("Reading rows · Checking
    codes").
  - Error `SHEET_NOT_PUBLIC`: "This sheet is private. Share it publicly or upload the file."
  - Error `UNSUPPORTED_FILE`: "This file type isn't supported. Upload a CSV or XLSX file."
  - Error `HEADER_NOT_FOUND`: "Couldn't find the header row. We looked for these columns: <names>." (the list from the
    contract).
  - Error `TOO_MANY_ROWS`: "Too many rows for one unit: this sheet has 214 rows; the limit is 200."
  - In every error nothing is stored, the chosen file or link stays, and focus moves to the message.
  - Success: "Grade 6 · Unit 4 · version 1 · 41 lessons · 6 flex days · 7 arc headers · 1 total row", then SCR-4 opens.
  - Same hash (FLOW-2 I1): "Version 2 is the same as version 1; 0 lessons changed." and a link to the report.
  - Empty / partial / frozen: n/a.
  - Role-forbidden: non-authors get "Only authors can upload an outline" with a link back.
- **Accessibility:** the drop zone is a labelled button, not a `div`; errors use `role="alert"` once after submit.
- **Depends on:** none. Trim (a) cuts the link import first (PRD §6.5): the segmented control then disappears.

---

## SCR-5 · Start run
**Status:** signed (wave 1) — Innocent ✓ 2026-10-25, delegated: "take your recommendations to all decisions you need me for"

- **Purpose:** Set a run's scope, see the prompt version it will pin, and set its spend cap before anything is spent.
- **Users:** P-2. **Stories:** US-6. **Flows:** FLOW-4, FLOW-19. **Contracts:** CON-5, CON-24.
- **Layout:** dialog shell `dialog-md` over SCR-4. Title "Start a run". **Scope** radio group: "All 47 teaching days" ·
  "Chosen rows" with a rows field (prefilled suggestion "8, 9, 25" for the trial). **Prompt version:** read-only line
  "v1 · locked rules + guidance v1 · pinned to this run" with a link to view it. **Spend cap:** a number field in dollars
  with helper "The run stops before any call that would pass this cap." Footer: Cancel · **Start run**.
- **States:**
  - Loading: the pinned prompt version line shows a skeleton until CON-24 answers.
  - Error `ROLE_FORBIDDEN`: "Only authors can start a run."
  - Error `VALIDATION_INCOMPLETE`: "Confirm the report first: 1 error still to confirm." with a link that closes the
    dialog and focuses the error.
  - Error `DAY_CAP_REACHED`: "Daily spend cap reached. No run can start until tomorrow."
  - Field errors: rows not in the outline ("Row 52 isn't a teaching day in this outline"); cap missing or zero ("Set a
    cap above $0").
  - Success: the dialog closes and SCR-6 opens with the run `planning`.
  - Empty / partial / frozen: n/a.
- **Accessibility:** focus starts on Scope; the dialog traps and returns focus; server errors appear at the top of the
  body and take focus.
- **Depends on:** UXP-5 (a capped run is finished by a new run on the rest).

---

## SCR-6 · Generation progress
**Status:** signed (wave 2) — Claude recommendation adopted under Innocent's standing authorization (PD-32), 2026-10-25 — basis: every state listed, every CON named, UXQ/UXP decided (PD-31); he has not read it; anything he raises reopens the screen

- **Purpose:** Show every lesson job moving through its states, the cost against the cap, and the run's controls.
- **Users:** P-2 (all can watch). **Stories:** US-7, US-8. **Flows:** FLOW-4, FLOW-5, FLOW-19. **Contracts:** CON-6
  (poll every 2 s), CON-7 (cancel, retry failed, resume).
- **Layout:** page header: eyebrow "Run", `h1` "Rows 8, 9 and 25 · Grade 6 · Unit 4", the run pill and "Started 10:50 by
  A. Chen". A summary sheet: "3 of 3 ready", a cost meter "$1.84 of $5.00 cap" (bar + text), and the controls (author):
  **Cancel run** (danger-ghost), **Retry failed**, **Resume** (only the ones that apply). Links: Unit plan · Run summary.
  A tile grid (cards, 4 across at `xl`): lesson title, type, the tile pill (Queued, Planning, Drafting, Checking,
  Repairing, Ready, Failed), and on Ready an **Open** link to SCR-9; on Failed the reasons.
- **States:**
  - Loading: skeleton tiles in the final grid.
  - Running: tiles change in place within 3 s of the lesson changing (US-7); announcements only for "Lesson 4 is ready".
  - Partial: "Run partial: 2 of 47 failed. Ready lessons are reviewable." `warn` banner + **Retry failed**.
  - Capped: "Run capped: the next call would pass the $5.00 cap. No new calls start. To finish, start a new run on the
    unfinished rows." with a link to SCR-5 prefilled (UXP-5).
  - Paused: "Run paused: 3 lessons in a row failed the same check (Look Back is 3 minutes (needs 5)). Read the failures,
    then resume." + **Resume**.
  - Cancelled: "Run cancelled by A. Chen. Calls in flight finished and were stored." `well` pill.
  - Failed tile: "Failed after 1 repair: Look Back is 3 minutes (needs 5)" or "Failed: truncated (retried once with a
    bigger limit)".
  - Worker restart: an `info` line "The run resumed after a restart. 1 call lost in flight." (counted in SCR-17).
  - Complete: `success` banner "Run complete: 47 of 47 ready." with **Open the board** (primary) (UXP-8).
  - Stale: the shared polling banner.
  - Error: a control fails: "Couldn't retry. Nothing changed. Try again."
  - Cancel confirm: Cancel is irreversible, so it asks inline: "Cancel the run? Calls in flight will finish; no new calls
    start." **Cancel run** / Keep running.
  - Empty: n/a (a run always has jobs). Role-forbidden: non-authors see no controls and "Only authors can control a
    run" where they would be.
- **Accessibility:** the tile grid is a list; each tile's state is text; the cost meter has a text equivalent. Polling
  announcements are rate-limited (design.md §5 rule 7).
- **Depends on:** UXP-5, UXP-8; UXQ-4. Trim (c): refresh on reload instead of polling.

---

## SCR-7 · Unit plan
**Status:** signed (wave 2) — Claude recommendation adopted under Innocent's standing authorization (PD-32), 2026-10-25 — basis: every state listed, every CON named, UXQ/UXP decided (PD-31); he has not read it; anything he raises reopens the screen

- **Purpose:** Let people read the one-line plan for every teaching day, the hand-forwards and the links between
  lessons, before reading lessons one by one.
- **Users:** P-2, P-1 (read-only for all). **Stories:** US-9. **Flows:** FLOW-4. **Contracts:** CON-8.
- **Layout:** two-pane with `rail-narrow`. Page sheet: `h1` "Unit plan · Grade 6 · Unit 4", an ordered list of 47
  entries (day number, lesson title, type, one-line plan, "hands forward: …"), with the performance-task thread marked by
  a `selected` tag. Rail card "Links between lessons": rows like "Lesson 4 Homework → Lesson 5 excerpt slot", each linking
  to both lessons.
- **States:**
  - Loading: skeleton list. Planning still running: "The plan is being written (one call). It appears here before any
    lesson is drafted."
  - Empty: no run yet: "No plan yet. A run writes the plan first."
  - Error: shared can't-load.
  - Success / partial / role-forbidden / frozen: read-only for everyone; the plan never changes after it is stored.
- **Accessibility:** an ordered list with each entry's day as text; links name both lessons.
- **Depends on:** none.

---

## SCR-10 · Insert quote or excerpt
**Status:** signed (wave 1) — Innocent ✓ 2026-10-25, delegated: "take your recommendations to all decisions you need me for"

- **Purpose:** Let a reviewer fill a quote placeholder or an excerpt slot with real text, its source and its rights
  status, so every quote in an approved lesson is a person's sourced choice.
- **Users:** P-1. **Stories:** US-17, US-18. **Flows:** FLOW-8. **Contracts:** CON-15.
- **Layout:** dialog shell `dialog-lg` over SCR-9. Eyebrow with the address (`G6.U4.L4.LearningInAction.PartA`); title
  "Insert quote" (or "Fill excerpt slot"). A `well` box quoting what the slot asks for ("Reviewer to insert: one sentence
  from Ch. 1, pp. 1–8, where Percy's sarcastic word choice sets the tone"). Fields: **Text** (textarea, with the word
  counter "9 of 12 words" when rights are `short-quote-commentary`); **Source** (book, chapter, page; or URL for an
  excerpt); **Rights status** (select: `short-quote-commentary`, `public-domain`, `licensed`, `to-clear`) with one-line
  help per option. Footer: Cancel · **Insert**.
- **States:**
  - Loading: Insert keeps its width; spinner after 250 ms.
  - Error `SOURCE_REQUIRED`: on the Source field: "A quote needs a source: add the book and page, or the URL."
  - Error `QUOTE_TOO_LONG`: on the Text field: "13 of 12 words: a short-quote-commentary quote is 12 words or fewer.
    Shorten it or choose another rights status."
  - Rights `to-clear` (FLOW-8 E3): inserted, and a toast "Inserted. Still blocking: rights to clear." The issue stays
    blocking until rights are recorded.
  - Success: the dialog closes; toast "Quote inserted. Issue 1 resolved."; the slot shows the quote with "Inserted by
    J. Rivera"; the audit log names her. For Lesson 5's slot, Lesson 4's homework issue changes to "Waiting for Lesson 5's
    approval" (UXP-2).
  - Error, network: "Couldn't insert. Your text is kept. Try again."
  - Frozen: not offered on submitted or approved lessons (the slot shows no button).
  - Role-forbidden: only reviewers see Insert; a forbidden call shows "Only reviewers insert quotes."
  - Empty / partial: n/a.
- **Accessibility:** the counter is announced politely only when it crosses the limit; errors are wired to fields; focus
  starts in Text.
- **Depends on:** UXP-2; UXQ-1.

---

## SCR-11 · Resolve or clear
**Status:** signed (wave 1) — Innocent ✓ 2026-10-25, delegated: "take your recommendations to all decisions you need me for"

- **Purpose:** Record a named resolution for a blocking issue fixed outside the tool, or clear a safety flag with a
  note, so the record says plainly what a person decided.
- **Users:** P-1 (P-3 may clear a safety flag). **Stories:** US-20, US-21. **Flows:** FLOW-8, FLOW-10. **Contracts:** CON-14.
- **Layout:** dialog shell `dialog-sm`. Two modes:
  - *Resolve:* title "Record a resolution"; the issue sentence in a `well` box; **Reason** (textarea) with an example in
    the helper ("e.g. quote inserted from class copy, rights: short-quote-commentary"); a line "Counted as a resolution,
    not a fix." Footer: Cancel · **Record resolution**.
  - *Clear a safety flag:* title "Clear safety flag"; the flag ("content warning from the outline (row 39, Homework)")
    and the teacher tip it links to, quoted; **Note** (textarea, required); a line "Your name, note and the time are
    logged and shown on the approver's checklist." Footer: Cancel · **Clear flag**.
- **States:**
  - Error `REASON_REQUIRED`: "A resolution needs a reason. Say what was done and where."
  - Error `NOTE_REQUIRED`: "Clearing a safety flag needs a note. Say what you checked."
  - Success: toast "Issue resolved by J. Rivera." or "Safety flag cleared."; the issue moves to the Resolved group.
  - Error, network: "Couldn't save. Your text is kept. Try again."
  - Loading / empty / partial: as the dialog shell. Frozen: not offered on submitted or approved lessons.
  - Role-forbidden: an author gets "Only reviewers and approvers can clear a flag."
- **Accessibility:** the required field says "(required)" in its label; focus starts in it.
- **Depends on:** none.

---

## SCR-12 · Candidate compare
**Status:** signed (wave 2) — Claude recommendation adopted under Innocent's standing authorization (PD-32), 2026-10-25 — basis: every state listed, every CON named, UXQ/UXP decided (PD-31); he has not read it; anything he raises reopens the screen

- **Purpose:** Show a regenerated candidate beside the current lesson, section by section, and let the reviewer adopt
  it whole, adopt one section, or leave it unadopted.
- **Users:** P-1 (P-2 for a guidance trial). **Stories:** US-22, US-10 (trial). **Flows:** FLOW-14, FLOW-18.
  **Contracts:** CON-16.
- **Layout:** page with breadcrumb *… › Lesson 4 › Candidate v4*. Header: `h1` "Candidate v4 · not adopted", meta "From
  the run's stored plan and pinned prompt · note: <note>" (the note part only when the candidate has one: CON-16 `note`, CHG-4). Two page sheets side by side (current | candidate), aligned
  by section; each section row has **Adopt this section** (secondary). Header actions: **Adopt whole candidate**
  (primary), **Leave unadopted** (ghost, returns to SCR-9). Under `lg` the two sheets become tabs *Current · Candidate*.
- **States:**
  - Loading / drafting: "Drafting a candidate… The current lesson is unchanged." with the tile pill.
  - Failed (FLOW-14 E2): "Candidate failed: Look Back is 3 minutes (needs 5). The current lesson is unchanged."
  - Error `DAY_CAP_REACHED`: "Daily spend cap reached. No candidate was made."
  - Error `LESSON_LOCKED`: "Lesson 4 is submitted. Withdraw it first to regenerate." (UXP-3)
  - Success: toast "Look Back adopted from candidate v4. Logged as your edit."; returns to SCR-9 with checks re-running.
  - Partial: one section adopted: that row shows "Adopted by J. Rivera"; the rest stay.
  - Empty: n/a. Frozen: the candidate stays in history, read-only. Role-forbidden: non-reviewers read only.
  - A note under the header: "Copying text by hand from the candidate is not tracked as an adoption." (HP-5 limit)
- **Accessibility:** the two columns are labelled regions; section headings repeat in both; adopt buttons name the
  section.
- **Depends on:** UXP-3. Trim (b): failed lessons only.

---

## SCR-15 · Send back or reopen
**Status:** signed (wave 1) — Innocent ✓ 2026-10-25, delegated: "take your recommendations to all decisions you need me for"

- **Purpose:** Send a submitted lesson back with a reason tag and a note, or reopen an approved one with a reason.
- **Users:** P-3. **Stories:** US-26, US-28. **Flows:** FLOW-13. **Contracts:** CON-18.
- **Layout:** dialog shell `dialog-md` over SCR-14.
  - *Request changes:* title "Request changes to Lesson 5"; **Reason** tag as a radio group (Standards · Quotes and
    rights · ELD support · Content safety · AI spans · Teaching quality · Other, UXP-6); **Note** (required). A line
    "J. Rivera will see your tag and note on the board and in the lesson." Footer: Cancel · **Send back**.
  - *Reopen:* title "Reopen Lesson 5"; **Reason** (required); a `warn` banner when lessons depend on it: "Lesson 4 links
    to this lesson. It will be flagged and held back from export until Lesson 5 is approved again." Footer: Cancel ·
    **Reopen** (it makes a new version).
- **States:**
  - Error `NOTE_REQUIRED`: "Add a note: say what needs to change."
  - Error `STALE_PIN`: "This lesson changed since you opened it. Reload." (closes to the SCR-14 banner).
  - Success: toast "Sent back to J. Rivera." / "Lesson 5 reopened as version 3."
  - Error, network: text kept, "Try again."
  - Loading / empty / partial / frozen: as the dialog shell.
  - Role-forbidden: only approvers see these actions.
- **Pin (CHG-3):** the dialog sends the snapshot hash and state vector SCR-14 holds with the request; it also keeps its
  own pre-check against a fresh read. If the server answers `STALE_PIN` the result is the same as the pre-check.
- **Accessibility:** the tag group is a `fieldset` with `legend` "Reason"; focus starts on it.
- **Depends on:** UXP-4, UXP-6.

---

## SCR-16 · History and provenance
**Status:** signed (wave 2) — Claude recommendation adopted under Innocent's standing authorization (PD-32), 2026-10-25 — basis: every state listed, every CON named, UXQ/UXP decided (PD-31); he has not read it; anything he raises reopens the screen

- **Purpose:** Show every version of a lesson with its hash and provenance, and the audit log, so it can be defended to
  a state reviewer.
- **Users:** P-3, P-1 (read-only). **Stories:** US-29. **Flows:** FLOW-16. **Contracts:** CON-19.
- **Layout:** two-pane. Page sheet: `h1` "History · Lesson 4"; a vertical list of versions (generated v1, candidate v2
  not adopted, submit snapshot v3, approval, reopen v4), each with kind, who, when, from-state → to-state, short hash
  (full on hover and in a copy button), reason. Selecting a version fills the rail. Rail: **Provenance** for the selected
  version (outline-row hash, prompt version, model, schema version, example set, run, cost) as a stat list; then
  **Audit log** rows ("Safety flag cleared by J. Rivera: <note> · 10:42").
- **States:** Loading (skeleton list); Empty: n/a (v1 always exists); a provenance field the server lacks shows
  "Missing" in `danger` (US-29 says no blank fields, so this is a defect signal); Error: shared can't-load; read-only for
  everyone.
- **Accessibility:** the version list is an ordered list; hashes have a "Copy hash" button with a polite "Copied".
- **Depends on:** none.

---

## SCR-17 · Run summary
**Status:** signed (wave 2) — Claude recommendation adopted under Innocent's standing authorization (PD-32), 2026-10-25 — basis: every state listed, every CON named, UXQ/UXP decided (PD-31); he has not read it; anything he raises reopens the screen

- **Purpose:** One summary per run: what the batch cost and how clean it was.
- **Users:** P-3, P-2 (read-only). **Stories:** US-32, US-36. **Flows:** FLOW-16, FLOW-19. **Contracts:** CON-21.
- **Layout:** page header `h1` "Run summary · rows 8, 9 and 25". Stat cards (4 across): wall time, cost per lesson,
  p95 minutes per lesson "against the 5-minute target", retries. A table "Failures by reason" and a stat list:
  placeholders left, calls lost in flight, brakes fired, truncation retries. A link "Full-run report (file)".
- **States:** Loading (skeleton cards); run still going: "This run is still going. Numbers so far:" with an `info`
  banner; Empty: no failures: "No failures." in the table; Error: shared can't-load; read-only for everyone.
- **Copy:** every number shows its *n* ("n = 3 lessons").
- **Accessibility:** stat cards are a `dl`; tabular numbers.
- **Depends on:** none.

---

## SCR-13 · AI assist panel (cut #8)
**Status:** signed (wave 3) — Claude recommendation adopted under Innocent's standing authorization (PD-32), 2026-10-25 — basis: every state listed, every CON named, UXQ/UXP decided (PD-31); he has not read it; anything he raises reopens the screen

- **Purpose:** Rewrite a selected passage from the reviewer's note as a suggestion they accept or reject.
- **Stories:** US-23. **Flows:** FLOW-15. **Contracts:** CON-17.
- **Layout:** a panel that replaces the rail's content while open (title "Rewrite selection", a back arrow to the rail).
  The selected text quoted; **My note** field; a `warn` line "Don't paste student work."; **Ask for a suggestion**
  (secondary, never a sparkle). The suggestion card (look-sheet anatomy `d1-05`): the rewrite, **Accept** (primary) and
  **Reject**.
- **States:** pending: Submit and Approve off with "Accept or reject the AI suggestion first"; `ANCHOR_CHANGED`: "Text
  changed, ask again."; `MODEL_UNAVAILABLE`: "Couldn't get a suggestion. Nothing changed."; `LESSON_LOCKED` / frozen:
  not offered; accepted: toast "Applied as your edit (AI-assisted)."; rejected: "Discarded."
- **Depends on:** UXP-3.

---

## SCR-18 · Coverage matrix (cut #4)
**Status:** signed (wave 3) — Claude recommendation adopted under Innocent's standing authorization (PD-32), 2026-10-25 — basis: every state listed, every CON named, UXQ/UXP decided (PD-31); he has not read it; anything he raises reopens the screen

- **Purpose:** A read-only standard × lesson grid with I / P / A and who confirmed each link.
- **Stories:** US-33. **Flows:** FLOW-16. **Contracts:** CON-22.
- **Layout:** a table that scrolls in its own box: standards as rows (code chip + short text), lessons as columns;
  each cell "I", "P" or "A" with a mark for who confirmed (person, judge-only, generator-only, as text in the cell's
  accessible name). Never-assessed standards: the row gets a `warn` glyph and "Never assessed".
- **States:** loading skeleton; empty "No lessons yet"; error can't-load; read-only.
- **Accessibility:** a real `table` with row and column headers; sticky first column.

---

## SCR-19 · Unit quality (cut #6)
**Status:** signed (wave 3) — Claude recommendation adopted under Innocent's standing authorization (PD-32), 2026-10-25 — basis: every state listed, every CON named, UXQ/UXP decided (PD-31); he has not read it; anything he raises reopens the screen

- **Purpose:** Draft-quality, health and seeded-error numbers for the unit, each with its *n*.
- **Stories:** US-34, US-36. **Flows:** FLOW-16, FLOW-19. **Contracts:** CON-10.
- **Layout:** metric tiles in groups V, O and H with *n* on each; rating counts (Usable as drafted · with edits ·
  rewritten, with *n*); the seeded-error report table labelled "our reviewers".
- **States:** a segment with fewer than 3 reviewers is labelled "one reviewer, n = k" (GR-15); empty "No approved lessons
  yet"; error can't-load; read-only; aggregate only, never by person.

---

## SCR-20 · Export (cut #5)
**Status:** signed (wave 3) — Claude recommendation adopted under Innocent's standing authorization (PD-32), 2026-10-25 — basis: every state listed, every CON named, UXQ/UXP decided (PD-31); he has not read it; anything he raises reopens the screen

- **Purpose:** Write a versioned export of approved snapshots, holding back lessons whose linked lesson is not approved.
- **Stories:** US-35, US-28. **Flows:** FLOW-13, FLOW-17. **Contracts:** CON-23.
- **Layout:** `h1` "Export (no live integration)"; a table of approved snapshots; a "Held back" list ("Lesson 4 waits on
  Lesson 5"); **Create export** (primary); earlier export versions with **Download**.
- **States:** no change since the last export: "Same lesson payloads as the last export (v1)."; success "Export v2
  written · 3 lessons"; `ROLE_FORBIDDEN` for non-approvers: "Only approvers can export."; empty "No approved lessons to
  export yet."

---

## SCR-21 · Prompt guidance (cut #7)
**Status:** signed (wave 3) — Claude recommendation adopted under Innocent's standing authorization (PD-32), 2026-10-25 — basis: every state listed, every CON named, UXQ/UXP decided (PD-31); he has not read it; anything he raises reopens the screen

- **Purpose:** Edit the guidance layer of the prompt as numbered versions with a reason, and try it on one lesson.
- **Stories:** US-10. **Flows:** FLOW-18. **Contracts:** CON-24, CON-5.
- **Layout:** two-pane: versions list (author, time, reason) and the selected version's text with a diff; the locked
  layer shown read-only with no edit control and the label "Locked rules (read-only)"; **Save as new version** with a
  Reason field; **Try on one lesson** (select a lesson → a candidate on SCR-12).
- **States:** `REASON_REQUIRED`: "A version needs a reason."; success "Guidance v2 saved. Runs already going keep v1.";
  trial "Candidate made on Lesson 4, not adopted."; read-only for non-authors.

---

## State matrix

✓ = specified above · n/a = cannot happen on that screen (reason in its spec) · R = read-only role view.

| Screen | Loading | Empty | Each named error | Partial | Stale | Success | Disabled with reason | Role-forbidden | Frozen / read-only |
|---|---|---|---|---|---|---|---|---|---|
| SCR-4 | ✓ | ✓ | ✓ | ✓ | n/a | ✓ | ✓ | ✓ | ✓ |
| SCR-8 | ✓ | ✓ | ✓ | ✓ | ✓ | n/a | n/a | R | n/a |
| SCR-9 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| SCR-14 | ✓ | ✓ | ✓ | ✓ | ✓ (409) | ✓ | ✓ | ✓ | ✓ |
| SCR-1 | ✓ | n/a | ✓ | n/a | n/a | ✓ | n/a | n/a | n/a |
| SCR-2 | ✓ | ✓ | ✓ | ✓ | n/a | n/a | n/a | R | n/a |
| SCR-3 | ✓ | n/a | ✓ | n/a | n/a | ✓ | n/a | ✓ | n/a |
| SCR-5 | ✓ | n/a | ✓ | n/a | n/a | ✓ | ✓ | ✓ | n/a |
| SCR-6 | ✓ | n/a | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (cancelled) |
| SCR-7 | ✓ | ✓ | ✓ | n/a | n/a | n/a | n/a | R | ✓ |
| SCR-10 | ✓ | n/a | ✓ | n/a | n/a | ✓ | n/a | ✓ | ✓ |
| SCR-11 | ✓ | n/a | ✓ | n/a | n/a | ✓ | n/a | ✓ | ✓ |
| SCR-12 | ✓ | n/a | ✓ | ✓ | n/a | ✓ | n/a | R | ✓ |
| SCR-15 | ✓ | n/a | ✓ | n/a | ✓ (409) | ✓ | n/a | ✓ | n/a |
| SCR-16 | ✓ | n/a | ✓ | n/a | n/a | n/a | n/a | R | ✓ |
| SCR-17 | ✓ | ✓ | ✓ | ✓ | n/a | n/a | n/a | R | ✓ |
| SCR-13, SCR-18–SCR-21 | ✓ | ✓ | ✓ | short | n/a | ✓ | ✓ | ✓ | ✓ |

## Open behaviour questions

**From UX-1** (proposals in [`USER_FLOWS.md`](../01-planning/USER_FLOWS.md); the specs follow each proposal):
UXP-1 (opening starts review), UXP-2 (two-phase dependency block), UXP-3 (no AI tools on frozen lessons), UXP-4 (reopen is
an approver action), UXP-5 (a capped run is finished by a new run), UXP-6 (send-back tags), UXP-7 (reconnecting message),
UXP-8 (complete run), UXP-9 (Units home), UXP-10 (withdraw needs no reason).

**Raised by UX-3b** (new proposals; route to UX-3a with the contracts, renumber if INTERFACE.md uses these ids):

| ID | Question | Proposal | Screens |
|---|---|---|---|
| UXQ-1 | Do dialogs have addresses, and what happens to typed text on reload or sign-out? | No address; text is kept in memory through a re-sign-in on the same page, lost on reload; nothing is written until confirm | SCR-5, SCR-10, SCR-11, SCR-15 — **decided 2026-10-25 (recommendation)** |
| UXQ-2 | Readable keys in addresses (`g6-u4`, `L4`) or opaque ids? | Readable unit and lesson keys; opaque run and candidate ids | all (IA §4) — **decided 2026-10-25 (recommendation)** |
| UXQ-3 | Is prompt guidance per program or per unit? | Program-wide, pinned per run | SCR-21, SCR-5 — **decided 2026-10-25 (recommendation)** |
| UXQ-4 | What does a polling screen show when polls fail? | After 10 s, "Live updates paused. Showing … as of 10:42. Retrying…"; data stays | SCR-6, SCR-8 — **decided 2026-10-25 (recommendation)** |
| UXQ-5 | Board sort order beyond "most blocking first" | Blocking desc, then advisory desc, then lesson order; failed lessons as their own top group; approved and exported at the bottom. (The look sheet's row order was illustrative) | SCR-8 — **decided 2026-10-25 (recommendation)** |
| UXQ-6 | Where does an approver's click on a submitted row go? | SCR-14; other rows open SCR-9 read-only | SCR-8, SCR-14 — **decided 2026-10-25 (recommendation)** |
| UXQ-7 | Who sees the north-star tile? | Every role; it is aggregate only (GR-15) | SCR-8 — **decided 2026-10-25 (recommendation)** |
| UXQ-8 | Confirm / Remove a standard: undo or a confirmation dialog? | Act at once with an Undo toast for 6 s (reversible, so no dialog, UI-5) | SCR-9 — **decided 2026-10-25 (recommendation)** |
| UXQ-9 | Can intake choices change after a run started from them? | Yes, for the next run only; the running run keeps what it pinned | SCR-4 — **decided 2026-10-25 (recommendation)** |
| UXQ-10 | How much editing must work on a phone? | Every action stays available; long editing is not optimised (settles the SITEMAP's open note) | SCR-9 — **decided 2026-10-25 (recommendation)** |
| UXQ-11 | Does an author or approver opening a draft start its review? | No: only a reviewer's open (UXP-1) | SCR-9 — **decided 2026-10-25 (recommendation)** |
