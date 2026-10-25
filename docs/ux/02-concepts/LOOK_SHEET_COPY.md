# Look-sheet copy — the same four screens on every direction (UX-2)

**Owner of:** the words and synthetic data on the four UX-2 look sheets, so the four directions differ only in look.
**Source:** [`USER_FLOWS.md`](../01-planning/USER_FLOWS.md) FLOW-3, FLOW-6, FLOW-7, FLOW-12; the
[worked pairs](../../data/worked-pairs.md) WP-1, WP-2; the [hard-problem register](../../design/hard-problems.md).
People's names and every number marked *(synthetic)* are made up. **No line of the novel is quoted anywhere.**
Each sheet draws all four screens at desktop width (about 1200 × 760) in light mode, plus **M3** again in the other
theme. Use every line below; don't add new claims.

## M1 · SCR-4 Validation report (FLOW-3)

- **Header:** Grade 6 · Unit 4 · *The Lightning Thief* — Outline v1 · `g6-u4-outline.xlsx` · uploaded by A. Chen *(synthetic)*
- **Summary:** 47 teaching days · **5 errors to confirm** · 7 ELD labels flagged · 2 bad filenames
- **Errors (each with Confirm / Edit):**
  1. **Unit** — The sheet says **G6, U4**; every filename says **U3**. → Confirm **U4**
  2. **Row 8 · Lesson 4 · Focus** — `RL.6.1, 6.2 L.6.4` — "6.2" has no strand. → Proposed: `RL.6.1 · RL.6.2 · L.6.4`
  3. **Rows 30, 34, 39** — `RL.6.9.a` does not exist. → Drop it (`RL.6.9` is already listed)
- **Warnings (each shows its default):**
  - Row 8 · Note in *Foundational Skills*: "Instead, think about using morphology…" → **Apply** · Show to reviewer only · Ignore
  - Row 9 · *Text Set Choice*: "WRITER MUST SLECT AND WRITE TO AN EXCERPT OF THE TEXT" → becomes an **excerpt slot**
  - Row 9 · *Vocabulary*: "Cap at 6 words per lesson" → **unit rule** for rows 8–23
  - Row 8 · `ELD.PII.6.5` — sheet says "Use transitions to connect ideas"; official strand is *Modifying to add details* → **Keep** · Re-map to `PII.6.2b`
  - Row 39 · *Homework*: "Warn students about potentially triggering scene in tonight's reading (references to domestic abuse)" → **Confirm as a safety flag**
- **OK example:** Row 10 · Lesson 6 · OK · 0 warnings
- **Footer:** primary button **Generate 47 lessons** (disabled) · "Generate stays off: 5 errors to confirm"

## M2 · SCR-8 Unit board (FLOW-6)

- **Header:** Unit 4 · *The Lightning Thief* · 47 lessons
- **Roll-up** *(synthetic)*: Draft 34 · In review 6 · Submitted 2 · Approved 3 · Failed 2
- **North-star tile** *(synthetic values)*: **Reviewer minutes per approved lesson** — median **24 min** · *n* = 3 ·
  fast approvals **0 of 3** · approved **3 of 47** · caption: "No baseline yet (AQ-14). Measured with us as reviewers."
- **Rows, sorted by blocking issues** (lesson · type · state · blocking · advisory · reviewer · note):
  | Lesson 4: The Lightning Thief, Chapter 1 | Reading | In review | 3 | 1 | M. Okafor | Waits on Lesson 5's excerpt |
  | Lesson 5: Comparing Percy and Soongoora | Writing | Submitted | 0 | 2 | J. Rivera | — |
  | Lesson 31: Comparing the Gods' Home | Writing | Draft | 2 | 2 | — | Safety flag open |
  | Flex Day: Meaning-Making Huddle | Flex Day | Draft | 1 | 1 | — | Standard proposed: `RL.6.7` |
  | Lesson 22 | Reading | Failed | — | — | — | Truncated · Retry |
  | Lesson 6 | Reading | Approved | 0 | 0 | J. Rivera | Approved · v2 |
- **Filter chips:** All · Draft · In review · Submitted · Approved · Failed

## M3 · SCR-9 Lesson workspace, Lesson 4 (FLOW-7, WP-1) — also in the other theme

- **Header:** Lesson 4: The Lightning Thief, Chapter 1 · Reading · 50 min · **In review** · v3
- **State steps:** Draft → **In review** → Submitted → Approved → Exported
- **Presence:** "M. Okafor is editing Part B"
- **Section outline:** Launch 5 · Literacy Lab 10 · Learning in Action 30 (Part A 15 · Part B 15) · Look Back 5 · Homework
- **Lesson text (shown in the editor):**
  - *Literacy Lab · 10 min* — routine heading **Introduce New Words Using Morphemes**
  - **Say:** "Today we'll use word parts to unlock new words. The root *mort-* means death."
  - **Ask:** "If *mort* means death, what does *immortal* mean?" — *Sample response:* "Not able to die. *Im-* means not."
  - *Learning in Action · Part A: Percy's Voice (RL.6.1, RL.6.4) · 15 min*
  - **Placeholder block:** "Reviewer to insert: one sentence from Ch. 1, pp. 1–8, where Percy's sarcastic word choice sets the tone" · rights: *short-quote-commentary* · button **Insert quote**
- **Evidence pane — Issues (3 blocking, 1 advisory):**
  1. **Blocking** · Quote placeholder open · `G6.U4.L4.LearningInAction.PartA`
  2. **Blocking** · Homework waits on Lesson 5's excerpt
  3. **Blocking** · `L.6.4.b` was chosen by the tool — confirm or remove
  4. Advisory · `ELD.PII.6.5` label names another strand
- **Evidence pane — Standards:**
  | `RL.6.1` | from the outline | taught: Part A | checked: Look Back |
  | `RL.6.2` | outline, fixed by A. Chen | taught: Part B | checked: Pulse Check |
  | `L.6.4.b` | **chosen by the tool · confirm** | taught: Literacy Lab | checked: Literacy Lab check |
  - Official text of `L.6.4.b`: "Use common, grade-appropriate Greek or Latin affixes and roots as clues to the meaning of a word (e.g., audience, auditory, audible)."
- **Footer:** **Submit for approval** (disabled) · "3 blocking issues" · "Active review time on this lesson is recorded and shown only as unit totals."

## M4 · SCR-14 Approval review, Lesson 5 (FLOW-12, WP-2)

- **Header:** Lesson 5: Comparing Percy and Soongoora · Writing · **Submitted** by J. Rivera · snapshot `9f3c…a21e` *(synthetic)*
- **Note:** "Lesson 4 is waiting on this lesson's excerpt."
- **Checklist (each with its evidence):**
  - ✓ Quotes and excerpts — excerpt inserted by J. Rivera from *Zanzibar Tales* (Bateman trans.) · rights: public-domain · source recorded
  - ✓ Standards taught and checked — `W.6.2.a`, `W.6.2.b`, `W.6.2.f` confirmed by J. Rivera
  - ✓ ELD supports keep the same text and task
  - ✓ Social content reviewed
  - ✓ AI-assisted spans — 1 accepted by J. Rivera
- **Four eyes:** "You did not edit this lesson, so you can approve it."
- **Draft quality (required):** ○ Usable as drafted · ● **Usable with edits** · ○ Rewritten
- **Buttons:** **Approve this version** (primary) · Request changes
- **Small print:** "Approving pins snapshot 9f3c…a21e. If it changes before you approve, you'll be asked to reload."
