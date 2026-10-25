# 02 — Sample Unit Outline (the input a generator receives)

| Field | Value |
|---|---|
| Source | Google Sheet `1OfigF5jtwagY8jJMk5g536tAgykkIR6xHGa0Bic_QnE`, linked in the issued brief ("Sample Unit Outline sheet for lessons to be generated from") |
| Rank | **ISSUED** (partner-provided data). Newsela's own instructional design; the coordinator cleared rendering it here. |
| Captured | 2026-10-24, anonymous `curl` of `/export?format=xlsx`, `/export?format=csv`, `/htmlview` and `gviz/tq?tqx=out:csv` (no sign-in needed) |
| Raw files (git-ignored) | `restricted/originals/sheet-export.xlsx` (both tabs), `sheet-export.csv`, `tab-lesson-outline.gviz.csv`, `sheet-htmlview.html`, `tab-hidden-cg-working-tab-6.3-deld-scope.from-xlsx.csv`, `tab-lesson-outline.cell-dump.txt` |
| Structured copy (tracked) | [`../data/samples/g6-u4-lesson-outline.json`](../data/samples/g6-u4-lesson-outline.json): every non-empty row, verbatim, with our `row_kind` label |

## 1. What the sheet is, in one paragraph

It is the plan for **one unit: Grade 6, Unit 4, built on Rick Riordan's novel *The Lightning
Thief*** (cell A1: "G6, U4: The Lightning Thief by Rick Riordan / ISBN 9780786838653"). Each row is
one day of teaching. An instructional designer has already decided, for every day, what kind of
lesson it is, which pages of the novel are read, which short myth is paired with it, the question
students answer, the standards it teaches, the vocabulary words (with page numbers), the
foundational-skills mini-lesson and the English Language Development (ELD) targets. The generator's
job is to turn each row into a full ~50-minute lesson in Newsela's lesson format (see
[`04-lesson-structure-analysis.md`](04-lesson-structure-analysis.md)).

**Concrete example, input → output.** Row 9 (Lesson 5, "Core Writing") says: read *The Lightning
Thief* Ch. 1 pp. 9–15 with "The Hare and the Lion" from *Zanzibar Tales*; question "What similar
fears and values do both stories reveal?"; focus standard `W.6.2`; students "write a brief
explanatory paragraph comparing how Percy and Soongoora respond when more powerful figures try to
control or punish them". The published lesson Newsela built for that day (G6 Unit 4 Lesson 5,
"Comparision Writing, Part 1" on the review site) has a Launch, a 10-minute Literacy Lab on writing
explanatory paragraphs, a 30-minute Learning in Action with the paired reading and the paragraph,
and a Look Back, plus objectives, essential questions, standards and ELD supports. The sheet supplies
the *what*; the generator must supply the *how* (the teacher script, sample answers, checks for
understanding, supports).

## 2. Tabs

| Tab | Visible? | Size | What it holds |
|---|---|---|---|
| `Lesson Outline` | visible (the only tab `htmlview` lists; gid `1723306320`) | A1:P57 used (the sheet's grid is A1:V1000; Q–V are empty) | The unit outline above. 41 numbered lessons, 6 flex days, 7 arc/section header rows, 1 total row. |
| `CG Working Tab 6.3 DELD Scope &` | **hidden** (found only in the xlsx export; the name is cut off, as stored) | 45 data rows × 15 columns, nearly empty | A blank working template for a **Grade 8 Unit 4 Designated ELD** unit (filenames `L1_DELD_TE_G8_U4_CA_Core` … `L45_DELD_TE_G8_U4_CA_Core`). Only the filename, arc (Spark ×3, Investigation 1 ×16, Investigation 2 ×19, Showcase ×7) and a few lesson types (`Spark 1–3`, `Flex`) are filled. Its headers are a useful hint at Newsela's lesson anatomy: *Filename, Arc, Lesson Type, Anchor Text, Additional Text, ELD Standards, Grade Level, High-Level Lesson Description, Language Objective, Content Objective, Ideas for Launch, Ideas for Literacy Lab, Ideas for Learning in Action, Ideas for Look Back, Suggested Routines & Rationales*. |

`gviz/tq?...&sheet=<name>` cannot reach the hidden tab: asking for it by its (truncated) name
returned the first tab instead, byte for byte. The xlsx export is the only way to see it.

## 3. What each column means

Row 2 holds the headers. Column B's header says "Lesson" but the column holds the **arc** (unit
phase) name. The "Meaning" column is our reading; confirm with Newsela before relying on it.

| Col | Header (verbatim) | Meaning | Filled on lesson rows | Typical form |
|---|---|---|---|---|
| A | Filename | Newsela's file id for the teacher edition: `L<n>_ELA_TE_G6_U3_CA_Core` (lesson n, ELA, Teacher Edition, Grade 6, Unit 3, California Core) | 41/41 | code |
| B | Lesson | Arc: `Spark`, `Investigation 1`, `Investigation 2`, `Showcase`, `Flex`, plus header rows like `End of Investigation 1 (Flex Days)` | all | label |
| C | Lesson # | `Lesson 1` … `Lesson 41` | 41/41 | label |
| D | Type of Lesson | `Spark 1/2/3`, `Core Reading`, `Core Writing`, `Core Writing (Double Lesson)`, `Academic Discussion`, `Writing`, `End-of-Arc Flex Day` | all | label |
| E | Days | Days the row takes; always `1` (a SUM formula in E57 totals **47**) | all | number |
| F | Text Dependent Question tied to the EQ | The day's question, tied to the unit's Essential Questions (EQ). `N/A` on Spark, flex and discussion days; in Showcase it holds "Learning Goals / EQ" bullet lists instead | 41/41 (9 start with `N/A`) | sentence or bullets |
| G | Lesson Description | The core instruction: a title line ("Chapter 4", "Academic Discussion", "Craft Focus"), page focus ("Focus: pp. 44–50"), and bullets of what teacher and students do | all | multi-line prose with `•` / `◦` / `o` bullets |
| H | Text Set Choice | The paired short text(s) besides the novel; sometimes an instruction to the writer ("WRITER MUST SELECT…") | 13/41 | bullets |
| I | Homework | Next reading: chapter and page ranges, sometimes "Read summary of…" | 38/41 | bullets with page ranges |
| J | Focus Standards (assessed) | The standards the lesson teaches and assesses | 41/41 | comma list of CA CCSS codes |
| K | Additional Supported CA ELA Standards | Standards practised but not assessed | 41/41 | comma list, ranges like `W.6.2.a–f` |
| L | CA Media Literacy Standards | Codes like `2.1.a`. These match the **CA Model School Library Standards, Grade Six** (see `05`), not a separate "media literacy" set | 4/41 (Showcase only) | bare numbers |
| M | Skill or content that will be needed for Performance Task | How the day builds toward the unit's culminating essay | 41/41 (+ the Investigation 1 header) | short phrase |
| N | Foundational Skills Focus | The word-study / grammar / fluency mini-lesson (becomes the Literacy Lab) | 37/41 | prose, often with reviewer notes mixed in |
| O | Vocabulary | Words to teach, usually with the novel's page number: `• frayed (2)` | 24/41 | bullets or a comma list |
| P | Designated ELD Standards | Three ELD targets per lesson, each `• ELD.PI.6.7 – <short description>` | 39/41 (missing on rows 35, 37) | bullets |

## 4. Grade, anchor texts and the learning arc

- **Grade level:** 6 (cell A1, every filename, every standard code is `.6.`).
- **Anchor text (novel):** *The Lightning Thief* by Rick Riordan, ISBN 9780786838653. Read Ch. 1–22 across the unit, by page range.
- **Paired texts (column H and homework), in order:** "What Are Myths?" (Newsela article); three passages from Coolidge's Prometheus/Pandora myths; *A Short History of Greek and Roman Myth*, *Ancient Greece: The First Greeks*, *Ancient Greek Thinkers, Truth Seekers* (Newsela); Rick Riordan interview, *The Guardian*; "The Hare and the Lion" (*Zanzibar Tales*, trans. George W. Bateman); a Raven story from *Myths and Legends of Alaska* (Katharine B. Judson); the Hero Twins' ballgame from the *Popol Vuh* (trans. Lewis Spence); an article on Delphi and the Oracle of Apollo (e.g. Britannica Kids); "The Quest of Medusa's Head" (*Old Greek Stories*, James Baldwin); Homer, *Odyssey* Book 8 "The Song of Ares and Aphrodite"; Virgil, *Aeneid* Book 6, lines 295–336; Homer, *Iliad* Book 1 lines 488–611; Homer, *Odyssey* Book 13 (homecoming); clips from the 2010 film; an Independent Reading List.
- **Essential Questions (named in rows 6, 23, 43):** "How do myths reflect cultural values?" and "How do retellings change across cultures and generations?"
- **Performance task (Showcase, rows 48–53):** "Shared Stories, Shared Lessons": an explanatory essay that compares two myths or classifies several, with a visual (chart, concept map or digital collage), presented at a seminar or podcast.

**The arc, as the sheet lays it out (47 teaching days):**

| Arc | Sheet rows | Lessons | What happens |
|---|---|---|---|
| Spark | 3–6 | L1–L3 (3 days) | What myths are, ancient Greek context, Riordan as a myth adapter. No novel reading in class yet. |
| Investigation 1 | 7–23 | L4–L19 (16 days) | Novel Ch. 1–12, a Core Reading day per chapter section, a Core Writing day every 3–4 lessons pairing the novel with a world myth (Hare and Lion, Raven, Popol Vuh, Medusa), ending in an Academic Discussion on EQ 1. |
| End of Inv. 1 flex | 24–26 | 2 flex days | Meaning-Making Huddle; Independent Reading. |
| Investigation 2 | 27–43 | L20–L35 (16 days) | Ch. 13–22 with Greek/Roman classics (Homer, Virgil), a two-day archetype story-writing task (L23–24), ending in an Academic Discussion on EQ 2 and novel-vs-film. |
| End of Inv. 2 flex | 44–46 | 2 flex days | Language Development Huddle; Meaning-Making Huddle. |
| Showcase | 47–53 | L36–L41 (6 days) | Plan, draft (×2), revise, finalize and present the comparison essay. |
| End of Showcase flex | 54–56 | 2 flex days | Catch-Up Day; Knowledge Boost Huddle. |

The arc matches Newsela's published *ELA Design Framework* (Spark 3–4 days → Investigation 1
10–12 days → flex → Investigation 2 10–12 days → flex → Showcase 5–7 days → flex), except that both
investigations here run 16 days.

**Lesson count.** 41 numbered lessons + 6 flex days = **47 days**, against the brief's "~40 lessons".
The program's own published Grade 6 Unit 4 on the review site has **45** lessons (see §6).

## 5. Oddities a generator would trip on

Grouped by what goes wrong. Row numbers are sheet rows.

**Identity and numbering**
1. **Unit number disagrees with itself.** A1 says `G6, U4`; every filename says `G6_U3`. The review site's Grade 6 Unit 4 is this myth unit, so the filenames are the stale value.
2. **Malformed filenames.** Row 43 `L35_ELA_TE_G6_U3_CA_CoreL30_ELA_TE_G6_U3_CA_Core` (two ids pasted together); row 51 `L309_ELA_TE_G6_U3_CA_Core` for Lesson 39. Flex rows have no filename at all, so they have no stable id.
3. **Column B is mislabelled** ("Lesson" holds the arc). Arc names also carry a trailing space in one place in the hidden tab (`Spark `).
4. **Header rows are mixed in with lesson rows.** Rows 3, 7, 24, 27, 44, 47, 54 are arc headers whose cells hold arc-level prose (row 7 C: "Across Lessons 4-19, students: 1) cite evidence…"; row 7 M: what the culminating writing requires). Several "empty" cells hold a lone non-breaking space (U+00A0), so a naive emptiness test treats them as content.
5. **Days is a float in exports** (`1.0` in xlsx, `1` in csv), and row 57 is a `=SUM(E4:E56)` total row with a stray U+00A0 in B.

**Standards**
6. **Malformed code:** row 8 J `RL.6.1, 6.2 L.6.4` (missing prefix and comma; probably `RL.6.2, L.6.4`).
7. **Codes that do not exist in CA CCSS:** `RL.6.9.a` (rows 30, 34, 39). Grade 6 RL.9 has no sub-parts. (`W.6.9.a` does exist.)
8. **Ranges instead of lists:** `SL.6.1.a–d`, `W.6.2.a–f`, `W.6.3.a–e`, `L.6.2.a–b` (en dash). A parser must expand them.
9. **Parent and child codes mixed:** `L.6.4` next to `L.6.4.b`, `W.6.2` next to `W.6.2.a`. Newsela's published lessons list only leaf codes where sub-parts exist (`L.6.4.a`, never bare `L.6.4`), so the generator must decide which leaf a parent means.
10. **ELD codes are bare and their labels are often wrong.** The sheet writes `ELD.PI.6.6 – Exchange information and ideas orally`; officially PI.6 is *Reading/viewing closely* and "exchanging information/ideas" is PI.1. Of the 12 ELD codes used, 7 carry descriptions that belong to a different strand (detail in `05`). The sheet also omits the sub-part letters (`6a/6b/6c`, `10a/10b`) and the proficiency level (Emerging / Expanding / Bridging) that the published lessons always show (`ELD.PI.6.6a.Em`, `.Ex`, `.Br`).
11. **"CA Media Literacy Standards" are really Model School Library Standards** codes with no prefix (`2.1.a`). Published lessons cite them as `MSLS 2.2b-c`.

**Instructions written to a human, not to a generator**
12. **"Writer must select" notes.** Rows 5, 9, 15, 19, 22 tell the human writer to choose or write the excerpt ("WRITER MUST SLECT AND WRITE TO AN EXCERPT OF THE TEXT"; "Writer should select paragraphs to assign"). The generator either selects a public-domain excerpt (and cites it) or flags the lesson for a human.
13. **Reviewer comments left inside content cells.** Column N and O mix the plan with editorial notes: row 8 N "Context clues are not considered foundational skills. Instead, think about using morphology…"; row 8 O "10 vocabulary words are taught, which is a lot for depth vocabulary words"; row 9 O "Across Investigation 1: Cap at 6 words per lesson." These are constraints on other rows, not content for this row.
14. **Cross-row constraints.** "Cap at 6 words per lesson" (row 9) conflicts with the 10-word lists in rows 10–41. "Identify 3 recurring roots across the investigation" is a unit-level task.
15. **Duplicated text:** row 25 G repeats a whole sentence fragment ("Help bridge students into Investigation 2 by asking questions… Based on • Help bridge…").
16. **Typos in source text:** "SLECT", "occurrred", "firm version" (film), "a a two-column", "teacher then reveal", "Add one metacognitive element" after "As well as adding". A generator should not copy them into output.

**Inconsistent formats**
17. **Vocabulary:** usually `• word (page)` bullets; rows 28, 35, 37 are a comma list with no pages and mixed capitals (`Modernize, Prowess, Enraged`); row 6 starts with a bullet then drops it.
18. **Bullets:** `•`, `◦`, `o`, tab-indented `•`, and plain lines all appear.
19. **Column F changes meaning** in Showcase: it holds "Learning Goals / EQ" lists, sometimes prefixed by `N/A` (rows 49–53).
20. **Page references** come in several forms: `pp. 1–8`, `pp. 100 ("Back at cabin eleven,…")–106`, `top of 100`, `mid 139`, "Read summary of Ch. 16".
21. **Chapter 6 is never read in class** (row 16 homework: "Read summary of… Ch. 6 (full)"), and Chapter 16 is summary-only. Lessons must not assume students read them closely.

**Content-safety and judgment flags**
22. Row 39 I: "Warn students about potentially triggering scene in tonight's reading (references to domestic abuse)". A generator must carry this to the teacher-facing homework note.
23. Copyrighted anchor text: the novel is in copyright, so the generator can cite page ranges and short phrases but must not reproduce long passages. The paired myths are mostly public domain (the sheet says so for Judson, Spence, Baldwin).

## 6. How the sheet lines up with the published Unit 4

The review site carries a published *Grade 6 Unit 4: Myths, Monsters & Modern Stories* with 45
lessons (titles and types listed in `restricted/03-example-lessons/README.md`). Matching by title
and chapter only (content not compared):

- Sheet L1–L19 line up one-to-one with site L1–L19 (Spark 1–3; Ch. 1–12 reading/writing; Socratic Seminar 1).
- After L19 the site inserts lessons the sheet does not have: L20 *Investigation 1 Assessment*, L21 *Flex Day*, L22–L23 *Flex Research*.
- Sheet L20 (Ch. 13) has no site counterpart; sheet L21 (Ch. 14) → site L24, and so on with drift. Investigation 2 on the site ends with an assessment (L37) and a flex day (L38); the Showcase is five writing lessons (L39–L43), a flex day (L44) and a Presentation lesson (L45).
- **Focus standards differ even where the lesson matches.** Sheet L4 focus: `RL.6.1, 6.2 L.6.4`; site L4 focus: `L.6.4.a, RL.6.4, RL.6.6`. Sheet L5: `W.6.2`; site L5: `L.6.3.a, RL.6.9, W.6.2.a, W.6.2.b, W.6.2.f, W.6.9.a`.

What this means: the sheet is an **earlier draft** of a unit that Newsela's team then restructured
and re-standardised by hand. It is a realistic input, and the published lessons are a realistic
"after human review" target, but they are not a clean input → output pair. The published Unit 4
lessons are a **held-out evaluation set** (see `source-register.md`).

## 7. The full sheet

Generated from the xlsx export (`restricted/originals/sheet-export.xlsx`) with no editing.

### A. Summary table (one line per row)

| Sheet row | Kind | Filename (col A) | Arc (B) | Lesson # (C) | Type (D) | Days (E) | Focus standards (J) | Media lit. (L) |
|---|---|---|---|---|---|---|---|---|
| 3 | arc_header |  | Spark |  |  |  |  |  |
| 4 | lesson | L1_ELA_TE_G6_U3_CA_Core | Spark | Lesson 1 | Spark 1 | 1.0 | L.6.4.b, RI.6.1, RI.6.4, SL.6.1.a |  |
| 5 | lesson | L2_ELA_TE_G6_U3_CA_Core | Spark | Lesson 2 | Spark 2 | 1.0 | L.6.4.a, RI.6.1, RI.6.7, RI.6.9 |  |
| 6 | lesson | L3_ELA_TE_G6_U3_CA_Core | Spark | Lesson 3 | Spark 3 | 1.0 | L.6.4.b, RI.6.4 |  |
| 7 | arc_header |  | Investigation 1 | Across Lessons 4-19, students: 1) cite evidence 2) explain tone 3) compare 4) analyze structure 5) write explanatory paragraphs 6) participate in discussion |  |  |  |  |
| 8 | lesson | L4_ELA_TE_G6_U3_CA_Core | Investigation 1 | Lesson 4 | Core Reading | 1.0 | RL.6.1, 6.2 L.6.4 |  |
| 9 | lesson | L5_ELA_TE_G6_U3_CA_Core | Investigation 1 | Lesson 5 | Core Writing | 1.0 | W.6.2 |  |
| 10 | lesson | L6_ELA_TE_G6_U3_CA_Core | Investigation 1 | Lesson 6 | Core Reading | 1.0 | RL.6.1 |  |
| 11 | lesson | L7_ELA_TE_G6_U3_CA_Core | Investigation 1 | Lesson 7 | Core Reading | 1.0 | RL.6.2 |  |
| 12 | lesson | L8_ELA_TE_G6_U3_CA_Core | Investigation 1 | Lesson 8 | Core Reading | 1.0 | RL.6.1, RL.6.4, L.6.4, L.6.4.b |  |
| 13 | lesson | L9_ELA_TE_G6_U3_CA_Core | Investigation 1 | Lesson 9 | Core Reading | 1.0 | RL.6.1, RL.6.5, L.6.4 |  |
| 14 | lesson | L10_ELA_TE_G6_U3_CA_Core | Investigation 1 | Lesson 10 | Core Reading | 1.0 | RL.6.1, L.6.4, L.6.6 |  |
| 15 | lesson | L11_ELA_TE_G6_U3_CA_Core | Investigation 1 | Lesson 11 | Core Writing | 1.0 | W.6.2.c, W.6.2.d, W.6.2.e, W.6.9 |  |
| 16 | lesson | L12_ELA_TE_G6_U3_CA_Core | Investigation 1 | Lesson 12 | Core Reading | 1.0 | RL.6.4, RL.6.7 |  |
| 17 | lesson | L13_ELA_TE_G6_U3_CA_Core | Investigation 1 | Lesson 13 | Core Reading | 1.0 | RL.6.1, RL.6.5, L.6.5.a |  |
| 18 | lesson | L14_ELA_TE_G6_U3_CA_Core | Investigation 1 | Lesson 14 | Core Reading | 1.0 | RL.6.1, RL.6.5, L.6.4, L.6.6 |  |
| 19 | lesson | L15_ELA_TE_G6_U3_CA_Core | Investigation 1 | Lesson 15 | Core Writing | 1.0 | RL.6.1, W.6.9, L.6.1, L.6.1.a |  |
| 20 | lesson | L16_ELA_TE_G6_U3_CA_Core | Investigation 1 | Lesson 16 | Core Reading | 1.0 | RL.6.9, L.6.4, L.6.5.a |  |
| 21 | lesson | L17_ELA_TE_G6_U3_CA_Core | Investigation 1 | Lesson 17 | Core Reading | 1.0 | RL.6.1, RL.6.5, RL.6.7, L.6.4, L.6.5 |  |
| 22 | lesson | L18_ELA_TE_G6_U3_CA_Core | Investigation 1 | Lesson 18 | Core Writing | 1.0 | RL.6.9, W.6.2, W.6.9 |  |
| 23 | lesson | L19_ELA_TE_G6_U3_CA_Core | Investigation 1 | Lesson 19 | Academic Discussion | 1.0 | SL.6.1, SL.6.6, RL.6.9 |  |
| 24 | arc_header |  | End of Investigation 1 (Flex Days) |  |  |  |  |  |
| 25 | flex_day |  | Flex |  | End-of-Arc Flex Day | 1.0 |  |  |
| 26 | flex_day |  | Flex |  | End-of-Arc Flex Day | 1.0 |  |  |
| 27 | arc_header |  | Investigation 2 |  |  |  |  |  |
| 28 | lesson | L20_ELA_TE_G6_U3_CA_Core | Investigation 2 | Lesson 20 | Core Reading | 1.0 | RL.6.4, L.6.4.a |  |
| 29 | lesson | L21_ELA_TE_G6_U3_CA_Core | Investigation 2 | Lesson 21 | Core Reading | 1.0 | RL.6.1, RL.6.5 |  |
| 30 | lesson | L22_ELA_TE_G6_U3_CA_Core | Investigation 2 | Lesson 22 | Core Reading | 1.0 | RL.6.9, RL.6.9.a, L.6.4, L.6.5.a, L.6.6 |  |
| 31 | lesson | L23_ELA_TE_G6_U3_CA_Core | Investigation 2 | Lesson 23 | Core Writing (Double Lesson) | 1.0 | W.6.3, W.6.4, RL.6.9 |  |
| 32 | lesson | L24_ELA_TE_G6_U3_CA_Core | Investigation 2 | Lesson 24 | Core Writing (Double Lesson) | 1.0 | W.6.3, W.6.4, RL.6.9 |  |
| 33 | lesson | L25_ELA_TE_G6_U3_CA_Core | Investigation 2 | Lesson 25 | Core Reading | 1.0 | RL.6.1, RL.6.5, L.6.4 |  |
| 34 | lesson | L26_ELA_TE_G6_U3_CA_Core | Investigation 2 | Lesson 26 | Core Writing | 1.0 | W.6.2, W.6.4 |  |
| 35 | lesson | L27_ELA_TE_G6_U3_CA_Core | Investigation 2 | Lesson 27 | Core Reading | 1.0 | RL.6.4, L.6.5.c |  |
| 36 | lesson | L28_ELA_TE_G6_U3_CA_Core | Investigation 2 | Lesson 28 | Core Reading | 1.0 | RL.6.1, RL.6.5 |  |
| 37 | lesson | L29_ELA_TE_G6_U3_CA_Core | Investigation 2 | Lesson 29 | Core Reading | 1.0 | RL.6.2, RL.6.3, L.6.6 |  |
| 38 | lesson | L30_ELA_TE_G6_U3_CA_Core | Investigation 2 | Lesson 30 | Core Reading | 1.0 | RL.6.1, RL.6.5 |  |
| 39 | lesson | L31_ELA_TE_G6_U3_CA_Core | Investigation 2 | Lesson 31 | Core Writing | 1.0 | W.6.2 |  |
| 40 | lesson | L32_ELA_TE_G6_U3_CA_Core | Investigation 2 | Lesson 32 | Core Reading | 1.0 | L.6.1, L.6.4, RL.6.2, RL.6.3, RL.6.6 |  |
| 41 | lesson | L33_ELA_TE_G6_U3_CA_Core | Investigation 2 | Lesson 33 | Core Reading | 1.0 | RL.6.1, RL.6.2, L.6.4, L.6.6 |  |
| 42 | lesson | L34_ELA_TE_G6_U3_CA_Core | Investigation 2 | Lesson 34 | Core Writing | 1.0 | W.6.2, W.6.4, RL.6.1, RL.6.2, RL.6.9, L.6.1, L.6.1.e |  |
| 43 | lesson | L35_ELA_TE_G6_U3_CA_CoreL30_ELA_TE_G6_U3_CA_Core | Investigation 2 | Lesson 35 | Academic Discussion | 1.0 | SL.6.1, SL.6.2, SL.6.6, RL.6.7, RL.6.9 |  |
| 44 | arc_header |  | End of Investigation 2 (Flex Days) |  |  |  |  |  |
| 45 | flex_day |  | Flex |  | End-of-Arc Flex Day | 1.0 |  |  |
| 46 | flex_day |  | Flex |  | End-of-Arc Flex Day | 1.0 |  |  |
| 47 | arc_header |  | Showcase |  |  |  |  |  |
| 48 | lesson | L36_ELA_TE_G6_U3_CA_Core | Showcase | Lesson 36 | Writing | 1.0 | W.6.2, W.6.2.a, W.6.5, W.6.8, SL.6.5 | 2.1.a, 2.1.b |
| 49 | lesson | L37_ELA_TE_G6_U3_CA_Core | Showcase | Lesson 37 | Writing | 1.0 | L.6.3, L.6.3.a, W.6.2, W.6.2.b, W.6.2.c, W.6.2.d | 2.2.a |
| 50 | lesson | L38_ELA_TE_G6_U3_CA_Core | Showcase | Lesson 38 | Writing | 1.0 | L.6.3, L.6.3.b, W.6.2, W.6.2.e, W.6.2.f |  |
| 51 | lesson | L309_ELA_TE_G6_U3_CA_Core | Showcase | Lesson 39 | Writing | 1.0 | L.6.2, L.6.2.a, L.6.2.b, W.6.5 |  |
| 52 | lesson | L40_ELA_TE_G6_U3_CA_Core | Showcase | Lesson 40 | Writing | 1.0 | W.6.2, W.6.4, W.6.6, W.6.8, W.6.9, W.6.9.a, W.6.10 | 3.3.a |
| 53 | lesson | L41_ELA_TE_G6_U3_CA_Core | Showcase | Lesson 41 | Writing | 1.0 | SL.6.1, SL.6.2, SL.6.4, SL.6.5, SL.6.6 | 4.3.a |
| 54 | arc_header |  | End of Showcase (Flex Days) |  |  |  |  |  |
| 55 | flex_day |  | Flex |  | End-of-Arc Flex Day | 1.0 |  |  |
| 56 | flex_day |  | Flex |  | End-of-Arc Flex Day | 1.0 |  |  |
| 57 | total_row |  |  |  |  | =SUM(E4:E56) |  |  |

### B. Every row in full (verbatim cell text)

Column letters follow the sheet. Empty cells are omitted; multi-line cells are kept as written.

#### Row 3 — Spark — Spark  (arc_header)

- **B · Lesson:** Spark
- **G · Lesson Description:** Builds knowledge related to the topic, piques excitement, and students show what they already know about the unit topic and key ELA content.

#### Row 4 — Spark — Lesson 1  (lesson)

- **A · Filename:** L1_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Spark
- **C · Lesson #:** Lesson 1
- **D · Type of Lesson:** Spark 1
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** N/A
- **G · Lesson Description:**

  ```text
  What Are Myths?
  • Students read "What Are Myths?" to gather and discuss as a whole class initial ideas about why cultures create stories about gods, nature, danger, or the unknown. Then students receive three very short, unlabeled passages from Coolidge’s Prometheus/Pandora myths. Without titles or context, they work in small groups to annotate evidence to answer these three questions (infer):
     ◦ What problem is this passage trying to explain?
     ◦ What kind of world does this story imagine?
     ◦ What clues hint at fear, hope, or cultural values?
  • Students share theories and add to their previous response to "what is a myth" (teacher then reveal morphology of the word mythology and the source myths.
  ```
- **H · Text Set Choice:**

  ```text
  • "What Are Myths?" Newsela article
  • 3 passages from Coolidge's Prometheus/Pandora myths
  ```
- **J · Focus Standards (assessed):** L.6.4.b, RI.6.1, RI.6.4, SL.6.1.a
- **K · Additional Supported CA ELA Standards:** SL.6.1
- **M · Skill or content that will be needed for Performance Task:** Build curiosity and mystery through inference; introduce myths as explanations of the world
- **N · Foundational Skills Focus:**

  ```text
  vocabulary: Morphology: 
  
  Mini Morphology Move:
  mythology → study of myths
  bio + logy → study of life
  ```
- **O · Vocabulary:**

  ```text
  • myth
  • mythology
  ```
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.6 – Exchange information and ideas orally
  • ELD.PI.6.7 – Analyze how meaning is conveyed
  • ELD.PII.6.4 – Expand noun phrases and descriptive language
  ```

#### Row 5 — Spark — Lesson 2  (lesson)

- **A · Filename:** L2_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Spark
- **C · Lesson #:** Lesson 2
- **D · Type of Lesson:** Spark 2
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** N/A
- **G · Lesson Description:**

  ```text
  Ancient Greece in Words Only
  • In small groups, students read short paragraphs from each informational text (Writer should select paragraphs to assign). Each group receives a different excerpt. Their task:
     ◦ Extract 3–4 facts about ancient Greek life, beliefs, learning, or daily challenges.
     ◦ Predict: How might stories from a world like this sound? What kinds of fears, natural events, or mysteries would people try to explain?
     ◦ Share “prediction posters.”
     ◦ Groups compare predictions across different texts.
  ```
- **H · Text Set Choice:**

  ```text
  • A Short History of Greek and Roman Myth (Newsela)
  • Ancient Greece: The First Greeks (Newsela)
  • Ancient Greek Thinkers, Truth Seekers (Newsela)
  ```
- **J · Focus Standards (assessed):** L.6.4.a, RI.6.1, RI.6.7, RI.6.9
- **K · Additional Supported CA ELA Standards:** SL.6.1
- **M · Skill or content that will be needed for Performance Task:** Build students' understanding of how myths arise from cultural needs; introduce cultural/historical context without visuals
- **N · Foundational Skills Focus:**

  ```text
  Introduction to Fluency - Accuracy & Prosody: Oral Reading of myth excerpts with attention to emphasis on pausing to reflect meaning and tone. As well as adding Add one metacognitive element:
  
  After oral reading:
  
  Why did the author pause here?
  What idea is emphasized?
  
  This supports comprehension + syntax awareness.
  ```
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.1 – Participate in collaborative discussions
  • ELD.PI.6.6 – Describe and explain information from texts
  • ELD.PII.6.3 – Use content-specific vocabulary accurately
  ```

#### Row 6 — Spark — Lesson 3  (lesson)

- **A · Filename:** L3_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Spark
- **C · Lesson #:** Lesson 3
- **D · Type of Lesson:** Spark 3
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** N/A
- **G · Lesson Description:**

  ```text
  Rick Riordan as a Myth Adapter
  • Students read a short excerpt from Riordan’s interview about adapting myths for modern readers. They annotate:
     ◦ What does Riordan believe myths do for people?
     ◦ Why does he think kids connect with ancient stories?
     ◦ How does he describe modernization (humor, setting, character updates)?
  • Students discuss in pairs:
     ◦ How might an author take a 2,000-year-old story and make it happen in New York City?
     ◦ What kinds of monsters or gods might show up today?
  • Ease into the Essential Questions for this unit: How do myths reflect cultural values? How do retellings change across cultures and generations?
  ```
- **H · Text Set Choice:** • Rick Riordan: "I'm hardly the first to modernise Greek myths" (The Guardian interview)
- **I · Homework:** • Read and annotate The Lightning Thief Ch. 1 (pp. 1–8)
- **J · Focus Standards (assessed):** L.6.4.b, RI.6.4
- **K · Additional Supported CA ELA Standards:** SL.6.1
- **M · Skill or content that will be needed for Performance Task:** Build curiosity about the main text; focus on author's craft and intention
- **N · Foundational Skills Focus:**

  ```text
  Introduce the academic comparison structures explicitly:
  	•	while
  	•	whereas
  	•	unlike
  	•	both…and
  
  Teach them as grammar for meaning — not just vocabulary.
  
  This is foundational for the culminating essay.
  ```
- **O · Vocabulary:**

  ```text
  • modernization
  transform
  traditional
  adapt(er)
  ```
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.7 – Analyze author purpose and message
  • ELD.PI.6.6 – Explain ideas using evidence
  • ELD.PII.6.4 – Produce expanded, connected explanations
  ```

#### Row 7 — Investigation 1 — Across Lessons 4-19, students: 1) cite evidence 2) explain tone 3) compare 4) analyze structure 5) write explanatory paragraphs 6) participate in discussion  (arc_header)

- **B · Lesson:** Investigation 1
- **C · Lesson #:** Across Lessons 4-19, students: 1) cite evidence 2) explain tone 3) compare 4) analyze structure 5) write explanatory paragraphs 6) participate in discussion
- **G · Lesson Description:** Core of the unit: engaging with anchor text, writing instruction, academic discussion, on-demand writing, and text set resources. Regular support with language development and foundational skills.
- **M · Skill or content that will be needed for Performance Task:** Culminating writing requires: 1) cross-text comparison 2) cultural value analysis 3) adaptation analysis 4) multi-source evidence 5) abstract nouns 6) sustained cohesion

#### Row 8 — Investigation 1 — Lesson 4  (lesson)

- **A · Filename:** L4_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 1
- **C · Lesson #:** Lesson 4
- **D · Type of Lesson:** Core Reading
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** How do Percy’s comments in the opening pages show his world values (and fears) about “normal” kids, and how might these opening pages be setting him up to become a hero or “problem” figure in a modern myth?
- **G · Lesson Description:**

  ```text
  Chapter 1
  Focus: pp. 1–8 Teacher Read Aloud - modeling engaging fluency - think alouds 
  • Students will cite evidence to make inferences and predictions about Percy and Percy's story based around what future Percy says through his first-person narration in the opening pages.
  • Students analyze how the narrator's informal, sarcastic word choices shape the tone of the opening and readers' first impression of him.
  ```
- **I · Homework:**

  ```text
  • Read and annotate The Lightning Thief Ch. 1 (pp. 9–15)
  • Read and annotate excerpt from the “The Hare and the Lion”
  ```
- **J · Focus Standards (assessed):** RL.6.1, 6.2 L.6.4
- **K · Additional Supported CA ELA Standards:** RL.6.1, RL.6.2, RL.6.3, RL.6.4, RL.6.5, RL.6.6, RL.6.10, L.6.4, L.6.4.a, L.6.4.d, L.6.5, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Identifying and explaining emerging themes
- **N · Foundational Skills Focus:**

  ```text
  • Teacher reviews determining/clarifying the meaning of words using examples from today's vocabulary word list, demonstrating how to use context to find and verify word meanings.
  • Students will add this week's vocabulary words to their Unit Vocabulary graphic organizers.
  Context clues are not considered foundational skills. Instead, think about using morphology when teaching the vocabulary words 
  
  Consider using context clues for during reading vocabulary instruction to confirm before reading instruction and provide in context learning. This could be part of Worktime A
  
  Replace repeated “context clue review” with:
          •        Morphology mini-lessons tied to the unit vocabulary.
  
  Introduce morphology tied to myth language:
          •        mort- (mortal, immortal)
          •        -ology (mythology)
          •        trans- (transform, transport)
  
  Quick 5-minute word building routine:
  
  If mort means death, what does immortal mean?
  ```
- **O · Vocabulary:**

  ```text
  • envy (1)
  • recognize (1)
  • frayed (2)
  • expelled (2)
  • probation (3)
  • threatened (3)
  • spawn (4)
  • detention (4)
  • immortal (6)
  • dyslexia (7)
  10 vocabulary words are taught, which is a lot for depth vocabulary words
  ```
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.7 – Analyze how language creates meaning
  • ELD.PI.6.6 – Justify interpretations with evidence
  • ELD.PII.6.5 – Use transitions to connect ideas
  ```

#### Row 9 — Investigation 1 — Lesson 5  (lesson)

- **A · Filename:** L5_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 1
- **C · Lesson #:** Lesson 5
- **D · Type of Lesson:** Core Writing
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** What similar fears and values do both stories reveal?
- **G · Lesson Description:**

  ```text
  Chapter 1
  • Teacher reviews explanatory writing; models using clear topic sentences, relevant evidence, and a concluding statement.
  Focus: pp. 9–15
  • Students cite specific details about how Percy is treated as “trouble” and how adults deny his experience in Ch. 1 to explain the problem he faces.
  • Students cite key moments from “The Hare and the Lion” (e.g., Soongoora’s lie about the honey, Simba’s challenge, and the hare’s escape plan) to explain the conflict the trickster faces with more powerful animals.
  • Students analyze how both texts portray characters who are at a power disadvantage—Percy as a “problem kid” and Soongoora as a trickster—to compare what each story suggests about power, cleverness, and community rules.
  • Students write a brief explanatory paragraph comparing how Percy and Soongoora respond when more powerful figures try to control or punish them, using a clear topic sentence, relevant evidence from both texts, appropriate transitions, and precise language.
  ```
- **H · Text Set Choice:**

  ```text
  • A short, excerpt from “The Hare and the Lion” in Zanzibar Tales: Told by Natives of the East Coast of Africa, translated by George W. Bateman
  
  WRITER MUST SLECT AND WRITE TO AN EXCERPT OF THE TEXT
  ```
- **I · Homework:** • Read and annotate The Lightning Thief Ch. 2 (pp. 16–22)
- **J · Focus Standards (assessed):** W.6.2
- **K · Additional Supported CA ELA Standards:** RL.6.1, RL.6.2, RL.6.3, RL.6.4, RL.6.9, RL.6.10, W.6.2, W.6.2.a, W.6.2.b, W.6.2.f, W.6.4, W.6.5, W.6.9, L.6.1, L.6.2, L.6.3, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Comparing characters across texts to explain shared ideas
- **N · Foundational Skills Focus:** Morphology mini-lessons tied to the unit vocabulary. Word Study 2: decoding multisyllabic mythological names and terms
- **O · Vocabulary:**

  ```text
  Across Investigation 1:
  	•	Cap at 6 words per lesson.
  	•	Identify 3 recurring roots across the investigation.
  	•	Add a “Word Families in This Unit” anchor.
  
  For example:
  
  mort- (immortal, mortals)
  trans- (transform, transition)
  -tion (transformation, isolation, revelation)
  
  That creates cumulative language power.
  ```
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.10 – Write explanatory texts
  • ELD.PI.6.7 – Compare how ideas are developed across texts
  • ELD.PII.6.5 – Use cohesive language for comparison
  ```

#### Row 10 — Investigation 1 — Lesson 6  (lesson)

- **A · Filename:** L6_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 1
- **C · Lesson #:** Lesson 6
- **D · Type of Lesson:** Core Reading
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** How does the museum field trip reveal fears and values about ancient powers still being present in the modern world?
- **G · Lesson Description:**

  ```text
  Chapter 2
  Focus: pp. 16–22
  • Students cite details about Percy’s behavior, Grover’s nervousness, and Mr. Brunner’s lecture to analyze what is explicitly happening at the museum and what is being hinted at.
  • Students analyze how the museum field trip functions as rising action that layers in mythology content and danger signs, explaining how this episode fits into the overall plot and builds toward later confrontations.
  ```
- **I · Homework:** • Read and annotate The Lightning Thief Ch. 2 (pp. 23–28)
- **J · Focus Standards (assessed):** RL.6.1
- **K · Additional Supported CA ELA Standards:** RL.6.1, RL.6.2, RL.6.3, RL.6.4, RL.6.5, RL.6.6, RL.6.10, L.6.4, L.6.4.c, L.6.5, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Explaining how scenes contribute to overall plot structure
- **N · Foundational Skills Focus:**

  ```text
  Morphology mini-lessons tied to the unit vocabulary.
  
  Consider identifying which prefixes and suffixes from the identified vocabulary words should be taught there. This can help reduce the number of vocabulary words
  ```
- **O · Vocabulary:**

  ```text
  • hallucination (16)
  • talons (16)
  • unusual (17)
  • eavesdropper (19)
  • solstice (19)
  • ignorance (19)
  • discouraged (21)
  • sarcastic (21)
  • juvenile (22)
  • delinquents (22)
  ```
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.7 – Analyze how events shape meaning
  • ELD.PI.6.6 – Explain interpretations with evidence
  • ELD.PII.6.5 – Use transitions to show sequence and cause
  ```

#### Row 11 — Investigation 1 — Lesson 7  (lesson)

- **A · Filename:** L7_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 1
- **C · Lesson #:** Lesson 7
- **D · Type of Lesson:** Core Reading
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** How do these pages demonstrate a pattern of adults ignoring “mythic” truths?
- **G · Lesson Description:**

  ```text
  Chapter 2
  Focus: pp. 23–28
  • Students cite lines showing how adults deny Ms. Dodds ever existed to analyze Percy’s confusion and isolation.
  • Students summarize this portion of the chapter distinct from their opinions and analyze how it deepens a central idea about being doubted and dismissed.
  ```
- **I · Homework:** • Read and annotate The Lightning Thief Ch. 3 (pp. 29–36)
- **J · Focus Standards (assessed):** RL.6.2
- **K · Additional Supported CA ELA Standards:** RL.6.1, RL.6.2, RL.6.3, RL.6.4, RL.6.5, RL.6.6, RL.6.10, L.6.4, L.6.5, L.6.5.b, L.6.5.c, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Summarizing a section of text and linking it to a central idea
- **N · Foundational Skills Focus:**

  ```text
  • Teacher reviews using the relationship between words (e.g., known word "shivering" (cause) → new word "chattering" (of teeth) (effect)) and distinguishing words with similar denotations  (e.g., glumly/mournfully) to better understand words from today's vocabulary word list.
  • Students will add today's vocabulary words to their Unit Vocabulary graphic organizers.
  ```
- **O · Vocabulary:**

  ```text
  • assumed (23)
  • considered (24)
  • glumly (24)
  • shimmering (25)
  • wrenched (26)
  • shuddered (26)
  • feverish (27)
  • dabbed (27)
  • chattering (27)
  • mournfully (28)
  ```
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.2 – Summarize key ideas accurately
  • ELD.PI.6.7 – Identify patterns and central ideas
  • ELD.PII.6.4 – Produce expanded, precise summaries
  ```

#### Row 12 — Investigation 1 — Lesson 8  (lesson)

- **A · Filename:** L8_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 1
- **C · Lesson #:** Lesson 8
- **D · Type of Lesson:** Core Reading
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** What do these pages show Percy values most, and how might those values fit the kind of hero we often see in myths?
- **G · Lesson Description:**

  ```text
  Chapter 3
  Focus: pp. 29–36
  • Students cite details about Percy’s mom, Gabe, and Percy’s Montauk memories to analyze his relationships and what he values.
  • Students analyze Percy’s word choice when he describes home versus Gabe’s apartment to explain how specific phrases and connotations create mood and tone.
  ```
- **I · Homework:** • Read and annotate The Lightning Thief Ch. 3 (pp. 37–43)
- **J · Focus Standards (assessed):** RL.6.1, RL.6.4, L.6.4, L.6.4.b
- **K · Additional Supported CA ELA Standards:** RL.6.1, RL.6.2, RL.6.3, RL.6.4, RL.6.5, RL.6.6, RL.6.10, L.6.4, L.6.4.b, L.6.5, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Using character description to infer relationships and values
- **N · Foundational Skills Focus:**

  ```text
  Morphology mini-lessons tied to the unit vocabulary.
  • Teacher reviews determining/clarifying the meaning of words using examples from today's vocabulary word list, demonstrating how to use affixes/roots to find word meanings (e.g., sym- ("together") + -pathos ("feeling") + -y (indicates state/quality) = sympathy (feeling together/sharing a feeling).
  • Students will add today's vocabulary words to their Unit Vocabulary graphic organizers.
  ```
- **O · Vocabulary:**

  ```text
  • ditched (29)
  • diploma (30)
  • reeked (30)
  • strewn (31)
  • nauseous (31)
  • sympathy (32)
  • demanded (33)
  • conscience (34)
  • interrupting (35)
  • anxiety (36)
  ```
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.7 – Analyze how language conveys meaning
  • ELD.PI.6.6 – Explain character values with evidence
  • ELD.PII.6.3 – Use precise descriptive vocabulary
  ```

#### Row 13 — Investigation 1 — Lesson 9  (lesson)

- **A · Filename:** L9_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 1
- **C · Lesson #:** Lesson 9
- **D · Type of Lesson:** Core Reading
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** What fears and values about family are reflected on these pages?
- **G · Lesson Description:**

  ```text
  Chapter 3
  Focus: pp. 37–43
  • Students cite key events and reactions during the storm, monster attack, and Grover's reveal to track the turning point in the plot.
  • Students analyze how this climactic episode closes Percy’s “ordinary world” and launches the adventure, explaining its role within the larger plot structure.
  ```
- **I · Homework:** • Read and annotate The Lightning Thief Ch. 4 (pp. 44–50)
- **J · Focus Standards (assessed):** RL.6.1, RL.6.5, L.6.4
- **K · Additional Supported CA ELA Standards:** RL.6.1, RL.6.2, RL.6.3, RL.6.4, RL.6.5, RL.6.6, RL.6.10, L.6.4, L.6.5, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Tracing a turning point in a plot and its impact on a character
- **N · Foundational Skills Focus:**

  ```text
  • Students will add today's vocabulary words to their Unit Vocabulary graphic organizers. 
  • Students focus on phonics by examining vowel teams (bellow, hooves), and prefixes (resented, regretted) in today's vocabulary words.
  ```
- **O · Vocabulary:**

  ```text
  • routine (37)
  • suckered (38)
  • rebellious (38)
  • resented (39)
  • regretted (39)
  • muzzle (41)
  • desperate (42)
  • bellow (42)
  • cloven (43)
  • hooves (43)
  ```
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.7 – Analyze narrative structure
  • ELD.PI.6.6 – Explain cause and effect
  • ELD.PII.6.5 – Use temporal transitions accurately
  ```

#### Row 14 — Investigation 1 — Lesson 10  (lesson)

- **A · Filename:** L10_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 1
- **C · Lesson #:** Lesson 10
- **D · Type of Lesson:** Core Reading
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** What do Percy's questions and reactions suggest about how people in this modern myth value safety and truth—and what they fear learning?
- **G · Lesson Description:**

  ```text
  Chapter 4
  Focus: pp. 44–50
  • Students cite dialogue and description—such as Grover’s panic, Percy’s questions, and details about the storm—to analyze how the truth about monsters and satyrs is slowly revealed.
  • Students analyze how the author's word choice influences the tension and action in this part of the story.
  ```
- **I · Homework:**

  ```text
  • Read and annotate The Lightning Thief Ch. 4 (pp. 51–56)
  • Read and annotate excerpt from Myths and Legends of Alaska
  ```
- **J · Focus Standards (assessed):** RL.6.1, L.6.4, L.6.6
- **K · Additional Supported CA ELA Standards:** RL.6.1, RL.6.2, RL.6.3, RL.6.4, RL.6.5, RL.6.6, RL.6.10, L.6.4, L.6.5, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Analyzing how word choice builds tension in a scene
- **N · Foundational Skills Focus:**

  ```text
  • Students will add today's vocabulary words to their Unit Vocabulary graphic organizers.
  • Students complete a review activity covering the vocabulary words they've learned so far this unit.
  ```
- **O · Vocabulary:**

  ```text
  • lashed (44)
  • irritated (45)
  • bleat (45)
  • swerved (46)
  • anticipating (47)
  • numb (47)
  • wedged (48)
  • slumped (48)
  • spattered (48)
  • bulging (50)
  ```
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.7 – Analyze how language creates tension
  • ELD.PI.6.6 – Explain meaning using evidence
  • ELD.PII.6.4 – Produce expanded analytical statements
  ```

#### Row 15 — Investigation 1 — Lesson 11  (lesson)

- **A · Filename:** L11_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 1
- **C · Lesson #:** Lesson 11
- **D · Type of Lesson:** Core Writing
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** How do both stories show a world "transforming," and what shared values do these transformations reflect?
- **G · Lesson Description:**

  ```text
  Chapter 4
  • Teacher reviews using transitions, precise language, and formal style in explanatory writing.
  Focus: pp. 51–56
  • Students cite key actions and descriptions from Ch. 4, pp. 51–56 (Percy’s fight with the Minotaur, his mother’s disappearance, and his crossing toward the farmhouse lights) to explain how this section marks a turning point in his journey.
  • Students cite important events in the Raven story—such as Raven bringing light or reshaping the land—to explain how Raven changes the world for humans or other beings.
  • Students analyze how both texts show a crossing between worlds or states (Percy leaving his old life behind as he reaches the camp, Raven transforming the world from darkness or chaos to something new) and identify central ideas about sacrifice, change, or responsibility.
  • Students write a brief explanatory paragraph that compares how Percy and Raven each act as a boundary-crosser or world-changer, using evidence from both texts to explain what new world or reality their actions create.
  ```
- **H · Text Set Choice:** • A short,  Raven creation or “world-shaping” story from Myths and Legends of Alaska (e.g., a Raven tale in which Raven changes the world or brings light) collected by Katharine B. Judson (Indigenous Alaskan traditions; public-domain collection). WRITER NEEDS TO SELECT AND WRITE TO A SPECIFIC MYTH.
- **I · Homework:** • Read and annotate The Lightning Thief Ch. 5 (pp. 57–66)
- **J · Focus Standards (assessed):** W.6.2.c, W.6.2.d, W.6.2.e, W.6.9
- **K · Additional Supported CA ELA Standards:** RL.6.1, RL.6.2, RL.6.3, RL.6.4, RL.6.5, RL.6.9, RL.6.10, W.6.2, W.6.2.c, W.6.2.d, W.6.2.e, W.6.4, W.6.5, W.6.9, L.6.1, L.6.2, L.6.3, L.6.4, L.6.5, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Explaining how two texts show a transition or transformation
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.10 – Write explanatory paragraphs
  • ELD.PI.6.7 – Compare ideas across texts
  • ELD.PII.6.5 – Use cohesive comparison language
  ```

#### Row 16 — Investigation 1 — Lesson 12  (lesson)

- **A · Filename:** L12_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 1
- **C · Lesson #:** Lesson 12
- **D · Type of Lesson:** Core Reading
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** What do these pages tell about Percy's fears and hopes about belonging?
- **G · Lesson Description:**

  ```text
  Chapter 5
  Focus: pp. 57–66
  • Students analyze Percy’s dreams, his reaction to the Minotaur horn, and the description of Camp Half-Blood to trace how themes of grief, identity, and belonging begin to emerge.
  • Students cite vivid phrases about Percy’s world after his mother’s disappearance and his disorientation at camp to analyze how word choice shapes mood.  
  *In a two-column graphic organizer, students will make specific notes on the left side from the book about the incident with the Minotaur, noting the emotions that the main characters are experiencing, and the tone that the narrator uses in describing the event. Then, they should watch the film version of this event from the 2010 film of The Lightning Thief and answer the same questions about the film in the right hand column. Below the graphic organizer, students make notes contrasting what they “see” and “hear” when reading the text to what they perceive when they listen or watch.
  ```
- **I · Homework:**

  ```text
  • Read summary of Ch. 5 (pp. 67–74), Ch. 6 (full), and Ch. 7 (pp. 93–top of 100 ("…as if drawing a battle plan."))
  • Read and annotate The Lightning Thief Ch. 7 (pp. 100 ("Back at cabin eleven,…")–106)
  ```
- **J · Focus Standards (assessed):** RL.6.4, RL.6.7
- **K · Additional Supported CA ELA Standards:** RL.6.1, RL.6.2, RL.6.3, RL.6.4, RL.6.5, RL.6.6, RL.6.10, L.6.4, L.6.5, L.6.5.a, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Tracing how a theme develops across part of a narrative
- **N · Foundational Skills Focus:**

  ```text
  • phonics study of consonant digraphs
  
  Students analyze how complex sentences signal comparison and contrast (e.g., although, whereas, while, however). They practice combining simple sentences into compound and complex sentences to express relationships between ideas clearly.
  ```
- **O · Vocabulary:**

  ```text
  • pinochle (57)
  • hovered (57)
  • smirking (57)
  • scorpion (58)
  • satyr (59)
  • minotaurs (59)
  • pavilion (62)
  • mischievous (63)
  • gladiator (65)
  • typical (66)
  ```
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.7 – Analyze how themes develop
  • ELD.PI.6.6 – Explain mood using evidence
  • ELD.PII.6.3 – Use precise descriptive language
  ```

#### Row 17 — Investigation 1 — Lesson 13  (lesson)

- **A · Filename:** L13_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 1
- **C · Lesson #:** Lesson 13
- **D · Type of Lesson:** Core Reading
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** What values are built into life at Camp Half-Blood, and how do those values echo traditions in ancient myths?
- **G · Lesson Description:**

  ```text
  Chapter 7
  Focus: pp. 100–106
  • Students cite Luke’s conversation with Percy in cabin eleven and at dinner, as well as details about the cabins and tables at the pavilion, to clarify how Camp Half-Blood is organized and what expectations and traditions shape Percy’s new life there.
  • Students analyze how the sequence from cabin eleven to the pavilion, offerings to the gods, and the campfire sing-along functions as the closing episode of Percy’s first day at camp, explaining how this section helps conclude the “arrival at camp” arc.
  • Students interpret descriptive and figurative language in pp. 100–106—such as the magically filling goblet, the smoke that smells like favorite foods, and the campfire scene—to explain how word choice and imagery create a warm, welcoming mood and deepen Percy’s sense that he has finally found a home.
  ```
- **I · Homework:** • Read and annotate The Lightning Thief Ch. 8 (pp. 107–116)
- **J · Focus Standards (assessed):** RL.6.1, RL.6.5, L.6.5.a
- **K · Additional Supported CA ELA Standards:** RL.6.1, RL.6.2, RL.6.3, RL.6.4, RL.6.5, RL.6.6, RL.6.10, L.6.4, L.6.5, L.6.5.a, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Using descriptive details to infer community norms and traditions
- **N · Foundational Skills Focus:**

  ```text
  • Students will add today's vocabulary words to their Unit Vocabulary graphic organizers.
  • Students examine the syllabication of today's vocabulary words.
  ```
- **O · Vocabulary:**

  ```text
  • resemblance (100)
  • prophecies (102)
  • quests (102)
  • destined (102)
  • omen (102)
  • nymphs (103)
  • centaur (103)
  • offerings (104)
  • Underworld (105)
  • laurels (105)
  ```
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.7 – Analyze descriptive language
  • ELD.PI.6.6 – Explain cultural values with evidence
  • ELD.PII.6.4 – Expand descriptive phrases
  ```

#### Row 18 — Investigation 1 — Lesson 14  (lesson)

- **A · Filename:** L14_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 1
- **C · Lesson #:** Lesson 14
- **D · Type of Lesson:** Core Reading
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** How do Percy's struggles and successes reflect the common myth patterns of a hero in training, and what skills or values does this community expect a hero to develop?
- **G · Lesson Description:**

  ```text
  Chapter 8
  Focus: pp. 107–116
  • Students cite Percy’s training experiences and interactions with other campers to analyze how his skills and relationships are changing.
  • Students analyze how the sequence of training “episodes” in this section contributes to Percy’s development and builds toward the capture-the-flag event and the quest call.
  ```
- **I · Homework:**

  ```text
  • Read and annotate The Lightning Thief Ch. 8 (pp. 117–126)
  • Read and annotate excerpt from Popol Vuh
  ```
- **J · Focus Standards (assessed):** RL.6.1, RL.6.5, L.6.4, L.6.6
- **K · Additional Supported CA ELA Standards:** RL.6.1, RL.6.2, RL.6.3, RL.6.4, RL.6.5, RL.6.6, RL.6.10, L.6.4, L.6.5, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Describing how a sequence of events shows character growth
- **N · Foundational Skills Focus:** • phonics study of syllabication
- **O · Vocabulary:**

  ```text
  • pulverize (107)
  • excelled (108)
  • technique (110)
  • appraised (111)
  • fates (112)
  • mortals (113)
  • escort (114)
  • hoard (114)
  • sacrificed (115)
  • demigod (115)
  ```
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.7 – Analyze character development
  • ELD.PI.6.6 – Explain sequences with evidence
  • ELD.PII.6.5 – Use temporal language clearly
  ```

#### Row 19 — Investigation 1 — Lesson 15  (lesson)

- **A · Filename:** L15_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 1
- **C · Lesson #:** Lesson 15
- **D · Type of Lesson:** Core Writing
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** What patterns across the two stories show how different cultures use contests to test heroes and highlight values like courage, teamwork, and cleverness?
- **G · Lesson Description:**

  ```text
  Chapter 8
  • Teacher reviews using pronouns in the proper case.
  Focus: pp. 117–126
  • Students cite important moments in the capture-the-flag sequence and hellhound attack—Percy’s strategy in the creek, the injury, and the trident appearing above his head—to explain how this episode reveals his abilities and identity.
  • Students cite key events from the Popol Vuh ballgame excerpt—how the Hero Twins play, face traps, or outwit opponents—to explain what kind of heroes they are and what trials they face.
  • Students analyze how both texts use a game or contest (capture the flag vs. the ballgame) to test heroes, reveal supernatural connections, and advance the plot, comparing how each story presents courage, skill, and relationships with powerful forces.
  • Students write a brief explanatory paragraph that compares Percy’s capture-the-flag trial with the Hero Twins’ ballgame, using a clear topic sentence, specific evidence from both texts, and compare/contrast language to explain what each trial shows about being a hero.
  ```
- **H · Text Set Choice:** • A short,  excerpt from the Popol Vuh describing the Hero Twins’ ballgame and their confrontation with the lords of Xibalba (K’iche’ Maya sacred narrative; public-domain English translation by Lewis Spence available via Project Gutenberg). WRITER MUST SLECT and write to a myth from Popol Vuh.
- **I · Homework:**

  ```text
  • Read summary of Ch. 9 (pp. 127–mid 139 ( "'…we will talk more.'"))
  • Read and annotate The Lightning Thief Ch. 9 (pp. 139 ( "Four flights up,…")–148)
  • Read and annotate informational article on Delphi and the Oracle of Apollo
  ```
- **J · Focus Standards (assessed):** RL.6.1, W.6.9, L.6.1, L.6.1.a
- **K · Additional Supported CA ELA Standards:** RL.6.1, RL.6.2, RL.6.3, RL.6.4, RL.6.5, RL.6.9, RL.6.10, W.6.2, W.6.4, W.6.5, W.6.9, L.6.1, L.6.2, L.6.3, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Comparing trials in two stories to explain what makes a hero
- **N · Foundational Skills Focus:** Students analyze how academic vocabulary (e.g., transformation, identity, responsibility, fate) is formed through morphology and nominalization. They practice converting verbs and adjectives into abstract nouns to strengthen analytical writing.
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.10 – Write explanatory comparisons
  • ELD.PI.6.7 – Compare how ideas are developed
  • ELD.PII.6.5 – Use cohesive compare/contrast language
  ```

#### Row 20 — Investigation 1 — Lesson 16  (lesson)

- **A · Filename:** L16_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 1
- **C · Lesson #:** Lesson 16
- **D · Type of Lesson:** Core Reading
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** How does the Oracle's prophecy reveal what people value and fear about the future?
- **G · Lesson Description:**

  ```text
  Chapter 9
  Focus: pp. 139–148
  • Students cite lines from the Oracle scene—both the prophecy and Percy’s reactions—to analyze what is stated and what is implied about his future and the quest.
  • Students analyze the prophecy episode as a structural hinge in the novel, explaining how this scene shifts Percy from camp life into the official quest and shapes later events.
  • Students compare the novel’s depiction of the Oracle with the informational article by identifying central ideas, supporting details, and technical vocabulary, explaining how each text presents the same figure differently.
  • Students interpret the Oracle’s imagery and prophetic language to explain figurative or symbolic phrasing in context.
  ```
- **H · Text Set Choice:** • A short, student-friendly informational article on Delphi and the Oracle of Apollo, such as “Delphi – Kids” (Britannica Kids)
- **I · Homework:**

  ```text
  • Read summary of Ch. 10 (pp. 149–157)
  • Read and annotate The Lightning Thief Ch. 10 (pp. 158–167)
  ```
- **J · Focus Standards (assessed):** RL.6.9, L.6.4, L.6.5.a
- **K · Additional Supported CA ELA Standards:** RL.6.1, RL.6.2, RL.6.3, RL.6.4, RL.6.5, RL.6.6, RL.6.9, RL.6.10, RI.6.1, RI.6.2, RI.6.3, RI.6.4, L.6.4, L.6.5, L.6.5.a, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Comparing a fictional scene with an informational source
- **N · Foundational Skills Focus:**

  ```text
  • Students will add today's vocabulary words to their Unit Vocabulary graphic organizers. 
  • Students examine the morphology of today's vocabulary words and divide them into root, prefix, suffix.
  
  Students analyze how cohesive devices (this suggests, this implies, this reflects, consequently, therefore) signal reasoning and interpretation. They practice writing multi-sentence explanations that connect evidence to broader claims.
  ```
- **O · Vocabulary:**

  ```text
  • memento (140)
  • tendrils (140)
  • betrayed (141)
  • retreated (142)
  • grudge (143)
  • summoned (144)
  • confront (146)
  • shredded (146)
  • shrieked (147)
  • rival (147)
  ```
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.7 – Analyze symbolic language
  • ELD.PI.6.6 – Explain implied meaning with evidence
  • ELD.PII.6.3 – Use precise interpretive vocabulary
  ```

#### Row 21 — Investigation 1 — Lesson 17  (lesson)

- **A · Filename:** L17_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 1
- **C · Lesson #:** Lesson 17
- **D · Type of Lesson:** Core Reading
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** What do Percy's choices under pressure reveal about the kind of hero he is becoming and the values, such as loyalty or bravery, that myths often celebrate?
- **G · Lesson Description:**

  ```text
  Chapter 10
  Focus: pp. 158–167
  • Students cite key details from the bus fight and Percy’s decisions in pp. 158–167 to analyze how he responds to danger and what that reveals about him as a hero.
  • Students analyze how this bus episode functions as one in a series of quest challenges, explaining how its unfolding raises the stakes and advances the larger quest arc.
  *For the second time, In a two-column graphic organizer, students will make specific notes on the left side from the book, this time about about the bus fight incident, noting the emotions that the main characters are experiencing, and the tone that the narrator uses in describing the event. Then, they watch the film version of this event from the 2010 film of The Lightning Thief and answer the same questions about the film in the right hand column. Below the graphic organizer, students make notes contrasting what they “see” and “hear” when reading the text to what they perceive when they listen or watch.
  ```
- **I · Homework:**

  ```text
  • Read summary of Ch. 11 (pp. 168–top of 178 ("…into the garden of statues.")
  • Read and annotate The Lightning Thief Ch. 10 (pp. 178 ("Aunty Em directed us…")–187)
  • Read and annotate excerpt from “The Quest of Medusa’s Head” in Old Greek Stories
  ```
- **J · Focus Standards (assessed):** RL.6.1, RL.6.5, RL.6.7, L.6.4, L.6.5
- **K · Additional Supported CA ELA Standards:** RL.6.1, RL.6.2, RL.6.3, RL.6.4, RL.6.5, RL.6.6, RL.6.10, L.6.4, L.6.5, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Explaining how a challenge raises the stakes in a quest
- **N · Foundational Skills Focus:** • fluency work--students read during class time
- **O · Vocabulary:**

  ```text
  • aura (159)
  • delicacy (160)
  • withered (161)
  • dispelled (161)
  • eerily (162)
  • hideous (164)
  • impulsive (164)
  • careened (164)
  • stampede (165)
  • submit (166)
  ```
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.7 – Analyze character development
  • ELD.PI.6.6 – Explain motivations with evidence
  • ELD.PII.6.5 – Use causal connectors accurately
  ```

#### Row 22 — Investigation 1 — Lesson 18  (lesson)

- **A · Filename:** L18_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 1
- **C · Lesson #:** Lesson 18
- **D · Type of Lesson:** Core Writing
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** What different values about blame, justice, and the power of the gods does each text highlight?
- **G · Lesson Description:**

  ```text
  Chapter 11
  • Teacher reviews using all pronouns, including intensive pronouns, in writing (Students analyze how pronoun reference and attribution clarify stance in comparative writing (e.g., this portrayal, this shift, this interpretation). They practice revising sentences to ensure clear antecedents and precise attribution when comparing multiple texts.)
  Focus: pp. 178–187
  • Students cite details from Ch. 11, pp. 178–187 (Aunty Em’s behavior, the reveal of Medusa, the use of the reflecting surface, and Percy’s reflections afterward) to explain how this scene portrays Medusa and Percy’s choices.
  • Students cite key moments from the Baldwin Perseus excerpt (gods’ gifts, Perseus using reflection, the beheading of Medusa) to explain how the original myth presents Medusa and the hero’s task.
  • Students analyze how the novel and the Greek myth develop central ideas about responsibility, blame, and the power of the gods—for example, how each text explains why Medusa became a monster and how the gods are portrayed.
  • Students write a brief explanatory paragraph comparing Riordan’s retelling of the Medusa episode to the traditional Perseus myth, using evidence from both texts to explain how the modern version both honors and changes the original story.
  ```
- **H · Text Set Choice:** • A short, excerpt from “The Quest of Medusa’s Head” in Old Greek Stories by James Baldwin (retelling of the Perseus and Medusa myth; public-domain text). WRITER MUST SELECT EXCERPT and write to a specific excerpt.
- **I · Homework:**

  ```text
  • Read and annotate The Lightning Thief Ch. 12
  • Review annotations from the myths covered in Inv 1 and Chs. 1–12 of The Lightning Thief to prepare for discussion
  ```
- **J · Focus Standards (assessed):** RL.6.9, W.6.2, W.6.9
- **K · Additional Supported CA ELA Standards:** RL.6.1, RL.6.2, RL.6.3, RL.6.4, RL.6.5, RL.6.9, RL.6.10, W.6.2, W.6.4, W.6.5, W.6.9, L.6.1, L.6.1.b, L.6.2, L.6.3, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Comparing a modern retelling with a traditional myth
- **N · Foundational Skills Focus:** Students refine paragraph structure by strengthening topic sentences and ensuring logical progression of ideas. They practice revising for clarity, cohesion, and precise academic vocabulary.
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.10 – Write explanatory text
  • ELD.PI.6.7 – Compare ideas across texts
  • ELD.PII.6.5 – Maintain cohesion with transitions
  ```

#### Row 23 — Investigation 1 — Lesson 19  (lesson)

- **A · Filename:** L19_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 1
- **C · Lesson #:** Lesson 19
- **D · Type of Lesson:** Academic Discussion
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** How does chapter 12 show modern values about the environment and human actions?
- **G · Lesson Description:**

  ```text
  Academic Discussion
  • Prepare students to discuss the EQ "How do myths reflect cultural values?"
  Focus: Myths from Inv 1 and Chs. 1–12 of The Lightning Thief
  • Students synthesize what they read from Chs. 1–12 and excerpts from traditional myths to explore how the story’s mythic elements reflect cultural values.
  • Discussion:
    o Use specific scenes, characters, and events from the assigned readings to respond to the EQ.
    o Trace how fears, values, and recurring patterns are emerging so far in the narrative.
    o Compare patterns they see in The Lightning Thief to myths they read from other cultures.
  ```
- **I · Homework:**

  ```text
  • Read summary of Ch. 13 (pp. 197–201)
  • Read and annotate The Lightning Thief Ch. 13 (pp. 202–211)
  ```
- **J · Focus Standards (assessed):** SL.6.1, SL.6.6, RL.6.9
- **K · Additional Supported CA ELA Standards:** SL.6.1.a–d, SL.6.6, RL.6.9
- **M · Skill or content that will be needed for Performance Task:** Discussing an essential question using evidence from texts
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.1 – Participate in academic discussions
  • ELD.PI.6.6 – Support claims with evidence
  • ELD.PII.6.1 – Use collaborative discussion strategies
  ```

#### Row 24 — End of Investigation 1 (Flex Days) — End of Investigation 1 (Flex Days)  (arc_header)

- **B · Lesson:** End of Investigation 1 (Flex Days)
- **G · Lesson Description:** Flexible days used to support ongoing student needs based on formative assessment, progress on in-class work, or extensions of learning. Teachers may select to use a small group or whole group format based on formative data collection.

#### Row 25 — Flex — End-of-Arc Flex Day  (flex_day)

- **B · Lesson:** Flex
- **D · Type of Lesson:** End-of-Arc Flex Day
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** N/A
- **G · Lesson Description:**

  ```text
  Meaning-Making Huddle
  • Revisit Chs. 1–12 of The Lightning Thief, supporting students' understanding of key ideas/events
  • Help bridge students into Investigation 2 by asking questions, such as: "What questions emerged from the texts you've read? Based on • Help bridge students into Investigation 2 by asking questions, such as: "What questions emerged from the texts you've read? Based on what you've read so far, how do you feel retellings change across cultures and generations?"                               
   *Students should re-read two key events from the book and, in three rows of a a two-column graphic organizer, make specific notes on the left side about what occurrred, the emotions that the main characters are experiencing, and the tone that the narrator uses in describing the event, and how they know. Then, they should watch film versions of these events from the 2010 firm version of The Lightning Thief and answer the same questions about the film in the right hand column. Below the graphic organizer, students make notes contrasting what they “see” and “hear” when reading the text to what they perceive when they listen or watch.
  ```

#### Row 26 — Flex — End-of-Arc Flex Day  (flex_day)

- **B · Lesson:** Flex
- **D · Type of Lesson:** End-of-Arc Flex Day
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** N/A
- **G · Lesson Description:**

  ```text
  Independent Reading
  Students choose one of the books on the independent reading books list for themselves, have a Content Knowledge Huddle about the book they chose, and make themselves a plan for reading it.
  ```
- **H · Text Set Choice:** Independent Reading List

#### Row 27 — Investigation 2 — Investigation 2  (arc_header)

- **B · Lesson:** Investigation 2
- **G · Lesson Description:** Continued engaging with anchor text OR further engaging with text sets, writing instruction, academic discussion, and on-demand writing. Regular support with language development and foundational skills.

#### Row 28 — Investigation 2 — Lesson 20  (lesson)

- **A · Filename:** L20_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 2
- **C · Lesson #:** Lesson 20
- **D · Type of Lesson:** Core Reading
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** How does the battle at the Gateway Arch test Percy’s courage when facing an ancient unknown?
- **G · Lesson Description:**

  ```text
  Chapter 13
  Focus: pp. 202–211
  Modern Battle: 
  Students analyze the confrontation at the Gateway Arch in Chapter 13 to explain how Rick Riordan modernizes a classic hero-versus-monster battle. They cite specific descriptive details to show how the setting and the Chimera are portrayed in a contemporary context. Students also interpret figurative language—such as Percy calling the Arch a “huge shopping bag handle”—to explain how these specific word choices shape the story's humorous and high-stakes tone.
  ```
- **I · Homework:** • Read and annotate The Lightning Thief Ch. 14
- **J · Focus Standards (assessed):** RL.6.4, L.6.4.a
- **K · Additional Supported CA ELA Standards:** RL.6.1, RL.6.6, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Citing descriptive language to explain how a scene is set up
- **N · Foundational Skills Focus:**

  ```text
  • Students will add today's vocabulary words to their Unit Vocabulary graphic organizers. 
  • Students focus on phonics by examining long i vowels (confined, trident) and suffixes (poisonous, faithless) in today's vocabulary words.
  
  Domain Precision: Using technical verbs for battle mechanics.
  ```
- **O · Vocabulary:** confined, vicious, faithless, plummeted, Modernize, Prowess, Enraged, Spectacle
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.7 – Analyze descriptive language
  • ELD.PI.6.6 – Explain tone with evidence
  • ELD.PII.6.3 – Use precise imagery vocabulary
  ```

#### Row 29 — Investigation 2 — Lesson 21  (lesson)

- **A · Filename:** L21_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 2
- **C · Lesson #:** Lesson 21
- **D · Type of Lesson:** Core Reading
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** How is the familiar “death and rebirth” pattern from older myths retold in a modern way, and what does this version emphasize about Percy’s powers and identity?
- **G · Lesson Description:**

  ```text
  Chapter 14
  • Students cite concrete details—such as Percy staying dry, breathing underwater, and lighting a lighter at the bottom of the river—to analyze evidence of his divine parentage and growing powers.
  • Students analyze how the fall, underwater sequence, and emergence form a turning-point episode in the hero’s journey and explain how this chapter fits into the overall structure and raises the stakes of the quest.
  ```
- **I · Homework:**

  ```text
  • Read summary of Ch. 15 (pp. 219–top of 224 ("'Come on, let's find some dinner.'")
  • Read and annotate The Lightning Thief Ch. 15 (pp. 224 ("A few minutes later,…")–233)
  • Read and annotate excerpt from “The Song of Ares and Aphrodite"
  ```
- **J · Focus Standards (assessed):** RL.6.1, RL.6.5
- **K · Additional Supported CA ELA Standards:** RL.6.1, RL.6.2, RL.6.3, RL.6.4, RL.6.5, RL.6.6, RL.6.10, L.6.4, L.6.5, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Explaining how a key event functions as a turning point
- **N · Foundational Skills Focus:**

  ```text
  • Students will add today's vocabulary words to their Unit Vocabulary graphic organizers.
  • Students complete a fluency routine using a passage from the text that includes one of today's vocabulary words.
  ```
- **O · Vocabulary:**

  ```text
  • fugitive (212)
  • revelation (212)
  • mortality (212)
  • sonar (214)
  • foul (215)
  • descend (215)
  • immune (215)
  • caress (215)
  • onlookers (216)
  • surveillance (217)
  ```
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.7 – Analyze narrative structure
  • ELD.PI.6.6 – Explain identity development
  • ELD.PII.6.5 – Use temporal transitions
  ```

#### Row 30 — Investigation 2 — Lesson 22  (lesson)

- **A · Filename:** L22_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 2
- **C · Lesson #:** Lesson 22
- **D · Type of Lesson:** Core Reading
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** How does Riordan’s retelling change the way we view the gods’ jealousy and betrayal compared to the older poetic telling?
- **G · Lesson Description:**

  ```text
  Chapter 15
  Focus: pp. 224–233
  • Students cite Percy, Annabeth, and Ares’s dialogue about the Tunnel of Love, Hephaestus’s traps, and Aphrodite’s behavior in pp. 224–233 to analyze how the novel references the original myth and what that reveals about the gods’ relationships.
  • Students analyze how themes of jealousy, betrayal, and trickery in divine relationships appear in the novel’s retelling and compare them to how those themes appear in the Homeric excerpt.
  • Students compare Riordan’s humorous, modernized take on the mythic love triangle with the more formal poetic version by analyzing differences in narrator voice, tone, and level of detail.
  • Students interpret similes, hyperbole, and other figurative language in the Tunnel of Love setting and Ares’s dramatic speech to explain their effects on tone and meaning.
  ```
- **H · Text Set Choice:** • An adapted excerpt from Homer’s Odyssey Book 8, “The Song of Ares and Aphrodite,” where Hephaestus traps Aphrodite and Ares in a net and the gods comment on their behavior.
- **I · Homework:**

  ```text
  • Read and annotate The Lightning Thief Ch. 15 (pp. 234–241)
  • Read summary of Ch. 16
  ```
- **J · Focus Standards (assessed):** RL.6.9, RL.6.9.a, L.6.4, L.6.5.a, L.6.6
- **K · Additional Supported CA ELA Standards:** RL.6.1, RL.6.2, RL.6.3, RL.6.4, RL.6.5, RL.6.6, RL.6.9, RL.6.9.a, RL.6.10, L.6.4, L.6.5, L.6.5.a, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Comparing themes across versions of a mythic relationship
- **N · Foundational Skills Focus:**

  ```text
  • Students will add today's vocabulary words to their Unit Vocabulary graphic organizers.
  • Students complete a review activity for the week's newly taught vocabulary words.
  ```
- **O · Vocabulary:**

  ```text
  • brutal (225)
  • sneer (226)
  • proposition (226)
  • suspicions (228)
  • clouded (229)
  • temperamental (230)
  • defunct (231)
  • gossip (232)
  • crippled (232)
  • marooned (233)
  ```
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.7 – Compare how ideas are presented
  • ELD.PI.6.6 – Explain author choices
  • ELD.PII.6.4 – Produce expanded comparisons
  ```

#### Row 31 — Investigation 2 — Lesson 23  (lesson)

- **A · Filename:** L23_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 2
- **C · Lesson #:** Lesson 23
- **D · Type of Lesson:** Core Writing (Double Lesson)
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** How can Riordan’s modern version of divine characters give you ideas for your story?
- **G · Lesson Description:**

  ```text
  Archetype-Based Story Writing
  • Students plan a short archetype-based story by selecting an original myth or archetypal pattern (hero, cautionary, or transformation) and outlining new characters, setting, and key plot events for a modern retelling.
  • Students begin drafting their story using narrative techniques such as dialogue, pacing, and description to develop experiences, events, and characters.
  ```
- **I · Homework:**

  ```text
  • Read summary of Ch. 17 (pp. 266–top of 274 ("…we turned our backs on the sea.")
  • Read and annotate The Lightning Thief Ch. 17 (pp. 274 ("With some spare change…")–282)
  ```
- **J · Focus Standards (assessed):** W.6.3, W.6.4, RL.6.9
- **K · Additional Supported CA ELA Standards:** W.6.3.a–e, W.6.4, W.6.5, W.6.9, W.6.10, RL.6.9, L.6.1, L.6.2, L.6.3, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Crafting a narrative that adapts an archetypal pattern
- **N · Foundational Skills Focus:** Students analyze how narrative sequencing and expanded noun phrases clarify character motivation and theme. They revise sentences to ensure clarity of pronoun reference and precise description in storytelling.
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.10 – Write narrative texts
  • ELD.PI.6.7 – Apply archetypal ideas
  • ELD.PII.6.5 – Organize events coherently
  ```

#### Row 32 — Investigation 2 — Lesson 24  (lesson)

- **A · Filename:** L24_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 2
- **C · Lesson #:** Lesson 24
- **D · Type of Lesson:** Core Writing (Double Lesson)
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** How does changing the setting and details allow a modern myth keep the same archetypal pattern but send a different message?
- **G · Lesson Description:**

  ```text
  Archetype-Based Story Writing
  • Students finish writing/revising their archetype-based story.
  • Students use compare/classify sentence frames (e.g., “In the original myth…, but in my story…,” “Both versions show…, however my version…”) to explain how their retelling honors key archetypal elements (character roles, plot pattern, central message) while changing setting, details, or point of view.
  • Formative Checkpoint: students give peer feedback on their partner's story
  ```
- **I · Homework:** • Read and annotate The Lightning Thief Ch. 18 (pp. 283–top of 291 ("We followed the spirits up a well-worn path.")
- **J · Focus Standards (assessed):** W.6.3, W.6.4, RL.6.9
- **K · Additional Supported CA ELA Standards:** W.6.3.a–e, W.6.4, W.6.5, W.6.9, W.6.10, RL.6.9, L.6.1, L.6.2, L.6.3, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Revising a narrative to clarify how it reinterprets a myth
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.10 – Revise narrative writing
  • ELD.PI.6.7 – Compare archetypal elements
  • ELD.PII.6.5 – Use cohesive language in revisions
  ```

#### Row 33 — Investigation 2 — Lesson 25  (lesson)

- **A · Filename:** L25_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 2
- **C · Lesson #:** Lesson 25
- **D · Type of Lesson:** Core Reading
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** How does the DOA Recording Studio's lobby retell the traditional gateway to the Underworld, and what do these changes suggest about how our culture imagines death and bureaucracy today?
- **G · Lesson Description:**

  ```text
  Chapter 18
  Focus: pp. 283–291
  • Students cite specific details such as the “NO LIVING” sign, descriptions of the lobby, and dialogue with the guard to analyze how the Underworld entrance is set up and what it suggests about this world’s rules.
  • Students analyze how this “threshold” episode moves the heroes from the world of the living toward the Underworld and explain how it fits into the overall quest structure.
  ```
- **I · Homework:**

  ```text
  • Read and annotate The Lightning Thief Ch. 18 (pp. 291–299)
  • Read and annotate  excerpt from Virgil’s Aeneid Book 6, lines 295–336
  ```
- **J · Focus Standards (assessed):** RL.6.1, RL.6.5, L.6.4
- **K · Additional Supported CA ELA Standards:** RL.6.1, RL.6.2, RL.6.3, RL.6.4, RL.6.5, RL.6.6, RL.6.10, L.6.4, L.6.5, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Explaining how a scene advances a mythic quest
- **N · Foundational Skills Focus:**

  ```text
  • Students will add today's vocabulary words to their Unit Vocabulary graphic organizers. 
  • Students examine the morphology of today's vocabulary words and divide them into root, prefix, suffix.
  ```
- **O · Vocabulary:**

  ```text
  • etched (283)
  • stenciled (283)
  • transparent (284)
  • elegant (284)
  • bewilderment (284)
  • agitated (286)
  • stalactites (290)
  • volcanic (290)
  • reassurance (290)
  • warbled (291)
  ```
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.7 – Analyze setting and symbolism
  • ELD.PI.6.6 – Explain narrative function with evidence
  • ELD.PII.6.3 – Use precise descriptive vocabulary
  ```

#### Row 34 — Investigation 2 — Lesson 26  (lesson)

- **A · Filename:** L26_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 2
- **C · Lesson #:** Lesson 26
- **D · Type of Lesson:** Core Writing
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** What details from these pages show how Riordan honors classic myths and what he changes to fit a contemporary world?
- **G · Lesson Description:**

  ```text
  Chapter 18
  • Teacher reviews recognizing/correcting inappropriate shifts in pronoun number and person
  Focus: pp. 291–299
  • Students cite key details from Ch. 18 and from the Aeneid excerpt—such as the crowded souls, the dark river, and the ferryman figure—to describe how each text presents entry into the underworld.
  • Students analyze imagery and word choice in both texts (for example, muddy “fathomless” water and a squalid ferryman in Aeneid versus the modern DOA setting and boatman in the novel) to explain how language creates tone and mood.
  • Students write a brief explanatory paragraph that compares Riordan’s modern underworld crossing with Virgil’s classical version, explaining how the novel both honors and changes the older myth.
  ```
- **H · Text Set Choice:** • Translated excerpt from Virgil’s Aeneid Book 6, lines 295–336
- **I · Homework:** • Read and annotate The Lightning Thief Ch. 19 (pp. 300–309)
- **J · Focus Standards (assessed):** W.6.2, W.6.4
- **K · Additional Supported CA ELA Standards:** W.6.2.a–f, W.6.4, W.6.5, W.6.9, W.6.10, RL.6.1, RL.6.2, RL.6.4, RL.6.9, RL.6.9.a, RL.6.10, L.6.1, L.6.1.c, L.6.2, L.6.3, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Comparing two depictions of the same setting to analyze tone
- **N · Foundational Skills Focus:** Students analyze how abstract nouns (justice, apathy, betrayal, loyalty, destiny, authority) function as thematic anchors in analytical writing. They practice embedding these nouns in topic sentences to strengthen thematic clarity. (which can be the designated ELD lesson)
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.10 – Write explanatory text
  • ELD.PI.6.7 – Compare ideas across texts
  • ELD.PII.6.5 – Maintain cohesion with transitions
  ```

#### Row 35 — Investigation 2 — Lesson 27  (lesson)

- **A · Filename:** L27_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 2
- **C · Lesson #:** Lesson 27
- **D · Type of Lesson:** Core Reading
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** How does the "apathy" of the Fields of Asphodel represent a different kind of danger than a monster?
- **G · Lesson Description:**

  ```text
  Chapter 19
  Focus: pp. 300–309
  Updated Afterlife:
  Students explore how Rick Riordan uses figurative language to modernize the Fields of Asphodel in Chapter 19. They analyze descriptions of souls waiting for a "concert that will never start" to identify central ideas about justice, punishment, and apathy in the afterlife. By interpreting specific figurative phrases, such as comparing stalactites to booster rockets, students explain how the author’s word choice creates a mood of hollow, endless waiting. This analysis helps students understand how modern metaphors can be used to represent ancient concepts of morality.
  ```
- **I · Homework:** • Read and annotate The Lightning Thief Ch. 19 (pp. 310–319)
- **J · Focus Standards (assessed):** RL.6.4, L.6.5.c
- **K · Additional Supported CA ELA Standards:** RL.6.1, RL.6.4, L.6.4.b
- **M · Skill or content that will be needed for Performance Task:** Interpreting figurative language to explain mood and ideas
- **N · Foundational Skills Focus:**

  ```text
  • Students will add today's vocabulary words to their Unit Vocabulary graphic organizers. 
  • Students focus on phonics by examining r-controlled vowels (hazards, eternal) and suffixes (wickedly, wistfully) in today's vocabulary words.
  
  Interpreting Nuance: Distinguishing connotations of the afterlife.
  ```
- **O · Vocabulary:** eternal, wistfully, charisma, tragic, Apathy, Judgement, Symbolic, Figurative

#### Row 36 — Investigation 2 — Lesson 28  (lesson)

- **A · Filename:** L28_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 2
- **C · Lesson #:** Lesson 28
- **D · Type of Lesson:** Core Reading
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** How does Riordan alter the classic "descent into the Underworld" myth so that elements from the modern world drive the conflict?
- **G · Lesson Description:**

  ```text
  Chapter 19
  Focus: pp. 310–319
  • Students cite Hades’s accusations and Percy’s responses to analyze misunderstandings among the gods and what evidence each character uses to support their claims.
  • Students analyze this confrontation scene as a climactic episode in the Underworld arc and explain how it shapes the plot and fits into the broader quest structure.
  ```
- **I · Homework:** • Read and annotate The Lightning Thief Ch. 20 (pp. 320–326)
- **J · Focus Standards (assessed):** RL.6.1, RL.6.5
- **K · Additional Supported CA ELA Standards:** RL.6.1, RL.6.2, RL.6.3, RL.6.4, RL.6.5, RL.6.6, RL.6.10, L.6.4, L.6.5, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Analyzing a confrontation scene to explain character claims
- **N · Foundational Skills Focus:**

  ```text
  • Students will add today's vocabulary words to their Unit Vocabulary graphic organizers.
  • Students examine the syllabication of today's vocabulary words.
  ```
- **O · Vocabulary:**

  ```text
  • torment (310)
  • arrogant (310)
  • debris (311)
  • scheme (312)
  • exposed (312)
  • ultimatum (313)
  • possess (314)
  • smug (318)
  • defy (318)
  • plumes (319)
  ```
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.7 – Analyze character arguments
  • ELD.PI.6.6 – Explain conflicts with evidence
  • ELD.PII.6.5 – Use logical connectors
  ```

#### Row 37 — Investigation 2 — Lesson 29  (lesson)

- **A · Filename:** L29_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 2
- **C · Lesson #:** Lesson 29
- **D · Type of Lesson:** Core Reading
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** After the Underworld, how has Percy's view of betrayal and the unknown changed?
- **G · Lesson Description:**

  ```text
  Chapter 20
  Focus: pp. 320–326
  Thematic Evolution: 
  Students perform a recursive analysis of how the themes of trust and sacrifice have evolved following the Underworld sequence. They cite the conversation between Percy and Annabeth—specifically noting the strategy "worthy of Athena"—and Percy’s processing of his mother’s disappearance to analyze how the characters' perspectives have shifted. Students summarize how central ideas of betrayal and loyalty surface in the aftermath of their deepest trial. Finally, students watch the film version of this dialogue to contrast the internal reflections found in the text with the visual and auditory portrayal in the movie.
  ```
- **I · Homework:** • Read and annotate The Lightning Thief Ch. 20 (pp. 327–333)
- **J · Focus Standards (assessed):** RL.6.2, RL.6.3, L.6.6
- **K · Additional Supported CA ELA Standards:** RL.6.1, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Using evidence to explain reappearing themes
- **N · Foundational Skills Focus:**

  ```text
  • Students will add today's vocabulary words to their Unit Vocabulary graphic organizers.
  • Students complete a review activity for the week's newly taught vocabulary words.
  
  Thematic Phrasing: Embedding themes into summary statements.
  ```
- **O · Vocabulary:** mystified, impending, uneasiness, disoriented, Trust, Sacrifice, Fulfillment, Revelation

#### Row 38 — Investigation 2 — Lesson 30  (lesson)

- **A · Filename:** L30_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 2
- **C · Lesson #:** Lesson 30
- **D · Type of Lesson:** Core Reading
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** How does the modern setting affect the battle between Percy and Ares?
- **G · Lesson Description:**

  ```text
  Chapter 20
  Focus: pp. 327–333
  • Students cite concrete details from the fight—Percy’s injuries, Ares’s attacks, and the intervention of mortals—to analyze Percy’s growth as a hero and the risks he takes.
  • Students analyze how this near-climactic battle resolves the conflict with Ares and explain how its structure (buildup, confrontation, outcome) contributes to the overall plot resolution.
  ```
- **I · Homework:**

  ```text
  • Read and annotate The Lightning Thief Ch. 21 (pp. 334–343)
  • Read and annotate excerpts from Homer's Iliad
  ```
- **J · Focus Standards (assessed):** RL.6.1, RL.6.5
- **K · Additional Supported CA ELA Standards:** RL.6.1, RL.6.2, RL.6.3, RL.6.4, RL.6.5, RL.6.6, RL.6.10, L.6.4, L.6.5, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Describing how a climactic battle resolves a major conflict
- **N · Foundational Skills Focus:**

  ```text
  • Students will add today's vocabulary words to their Unit Vocabulary graphic organizers.
  • Students complete a fluency routine using a passage from the text that includes one of today's vocabulary words.
  ```
- **O · Vocabulary:**

  ```text
  • catapulted (327)
  • deflected (327)
  • disguised (328)
  • recede (330)
  • disbelief (330)
  • fled (331)
  • disintegrate (331)
  • hesitated (331)
  • drained (332)
  • reclaimed (332)
  ```
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.7 – Analyze climactic structure
  • ELD.PI.6.6 – Explain character development
  • ELD.PII.6.5 – Use temporal/causal transitions
  ```

#### Row 39 — Investigation 2 — Lesson 31  (lesson)

- **A · Filename:** L31_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 2
- **C · Lesson #:** Lesson 31
- **D · Type of Lesson:** Core Writing
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** Which details show how each story reflects its own culture's ideas about power, beauty, and the gods' separation from humanity?
- **G · Lesson Description:**

  ```text
  Chapter 21
  • Teacher reviews recognizing/correcting vague pronouns
  Focus: pp. 334–343
  • Students cite descriptive details and figurative language from Ch. 21, pp. 334–343 (e.g., Olympus atop the skyscraper, palaces, clouds, throne room) and from the Iliad excerpt (e.g., Zeus's throne on the "highest peak," the banquet at the end of Book 1) to compare how each text portrays the gods’ home.
  • Students analyze imagery and word choice in both passages to explain how each author creates tone and mood—for instance, the serene, timeless Olympus in Homer versus the bustling, modern skyscraper Olympus in The Lightning Thief.
  • Students write an explanatory paragraph that compares the two descriptions, explaining how Riordan’s modern Olympus both honors key elements of the traditional setting and updates them for a contemporary world.
  ```
- **H · Text Set Choice:** • Short, teacher-chosen excerpts from lines 488–611 of Book 1 of Homer's Iliad describing Olympus
- **I · Homework:**

  ```text
  • Read and annotate The Lightning Thief Ch. 21 (pp. 344–353)
  • Warn students about potentially triggering scene in tonight's reading (references to domestic abuse)
  ```
- **J · Focus Standards (assessed):** W.6.2
- **K · Additional Supported CA ELA Standards:** W.6.2.a–f, W.6.4, W.6.5, W.6.9, W.6.10, RL.6.1, RL.6.2, RL.6.4, RL.6.9, RL.6.9.a, RL.6.10, L.6.1, L.6.1.d, L.6.2, L.6.3, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Comparing two descriptions of a setting to analyze author choices
- **N · Foundational Skills Focus:** Students analyze how cohesive transitions (whereas, however, in contrast, similarly, as a result) clarify comparative reasoning. They revise paragraphs to ensure logical progression and clear comparative structure.
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.10 – Write explanatory text
  • ELD.PI.6.7 – Compare cultural portrayals
  • ELD.PII.6.5 – Maintain cohesion in comparisons
  ```

#### Row 40 — Investigation 2 — Lesson 32  (lesson)

- **A · Filename:** L32_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 2
- **C · Lesson #:** Lesson 32
- **D · Type of Lesson:** Core Reading
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** How does Percy's first-person narration and modern attitude affect how characters are perceived, and how might the interactions between these characters be different if it was told in the past?
- **G · Lesson Description:**

  ```text
  Chapter 21
  Focus: pp. 344–353
  • Students cite dialogue and actions from Percy, Zeus, and Poseidon in pp. 344–353 to analyze how each character responds to the crisis and to one another, noting evidence of power, anger, forgiveness, or distance.
  • Students analyze how this Olympus confrontation resolves the central conflict over the missing master bolt and helm, and summarize how themes of power, responsibility, and family loyalty are expressed in the resolution, distinct from their own opinions.
  • Students analyze how Percy’s first-person narration shapes readers’ view of Zeus and Poseidon—for example, what he notices, how he interprets their expressions and words, and which details he emphasizes.
  ```
- **I · Homework:** • Read and annotate The Lightning Thief Ch. 22 (pp. 354–363)
- **J · Focus Standards (assessed):** L.6.1, L.6.4, RL.6.2, RL.6.3, RL.6.6
- **K · Additional Supported CA ELA Standards:** RL.6.1, RL.6.2, RL.6.3, RL.6.4, RL.6.5, RL.6.6, RL.6.10, L.6.4, L.6.5, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Analyzing dialogue to explain relationships and power dynamics
- **N · Foundational Skills Focus:**

  ```text
  • Students will add today's vocabulary words to their Unit Vocabulary graphic organizers. 
  • Students examine the morphology of today's vocabulary words and divide them into root, prefix, suffix.
  ```
- **O · Vocabulary:**

  ```text
  • conscious (344)
  • restrained (345)
  • gratitude (347)
  • interjected (349)
  • instinctively (350)
  • falsetto (350)
  • pleaded (350)
  • condemned (352)
  • deserve (353)
  • twinge (353)
  ```
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.7 – Analyze dialogue and perspective
  • ELD.PI.6.6 – Explain power dynamics
  • ELD.PII.6.3 – Use precise analytical vocabulary
  ```

#### Row 41 — Investigation 2 — Lesson 33  (lesson)

- **A · Filename:** L33_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 2
- **C · Lesson #:** Lesson 33
- **D · Type of Lesson:** Core Reading
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** How do the characters' choices show a modern interpretation of "home" and "destiny," compared to traditional myths?
- **G · Lesson Description:**

  ```text
  Chapter 22
  Focus: pp. 354–363 + In-Class Reading of pp. 364–369
  • Teacher reads the climactic scene of the chapter in class, highlighting how the story reveals the plot twist and escalates tension.
  • Students analyze how themes of home, choice, and identity come together in these final scenes and summarize how those central ideas are resolved, distinct from their own opinions.
  ```
- **I · Homework:**

  ```text
  • Read and annotate The Lightning Thief Ch. 22 (pp. 370–375)
  • Read and annotate excerpt from Odyssey
  ```
- **J · Focus Standards (assessed):** RL.6.1, RL.6.2, L.6.4, L.6.6
- **K · Additional Supported CA ELA Standards:** RL.6.1, RL.6.2, RL.6.3, RL.6.4, RL.6.5, RL.6.6, RL.6.10, L.6.4, L.6.5, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Synthesizing the end of a text to explain how themes are resolved
- **N · Foundational Skills Focus:** • Students do a fluency routine and read aloud
- **O · Vocabulary:**

  ```text
  • tradition (354)
  • procession (354)
  • disposed (356)
  • enroll (356)
  • devising (359)
  • alliances (359)
  • commemorates (359)
  • vacated (360)
  • harpies (360)
  • celestial (362)
  ```
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.7 – Analyze thematic resolution
  • ELD.PI.6.6 – Explain consequences and meaning
  • ELD.PII.6.4 – Produce expanded synthesis
  ```

#### Row 42 — Investigation 2 — Lesson 34  (lesson)

- **A · Filename:** L34_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 2
- **C · Lesson #:** Lesson 34
- **D · Type of Lesson:** Core Writing
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** What are the similarities and differences in how these stories depict a hero returning home?
- **G · Lesson Description:**

  ```text
  Chapter 22
  • Teacher reviews recognizing variations from standard English in writing, and using strategies to improve expression
  Focus: pp. 370–375
  • Students cite key details from Ch. 22 (Percy’s feelings about home, his mother’s choices, and the decision about where to spend the year) and from the Odyssey homecoming excerpt (Odysseus’s joy, gesture of kissing the ground, and prayer) to describe each hero’s return.
  • Students analyze how each text presents the idea of “coming home,” explaining what home means to Percy versus Odysseus and how those portrayals reflect different family situations and values.
  ```
- **H · Text Set Choice:** • Short excerpt from Homer's Odyssey Book 13, in which Odysseus finally recognizes Ithaca, rejoices at finding himself again in his own land, and kisses the soil while praying to the local nymphs
- **I · Homework:**

  ```text
  • Review annotations from The Lightning Thief and myths read in Inv 1 and 2 in preparation for the Academic Discussion
  • Watch teacher-chosen clips from the movie version of The Lightning Thief
  ```
- **J · Focus Standards (assessed):** W.6.2, W.6.4, RL.6.1, RL.6.2, RL.6.9, L.6.1, L.6.1.e
- **K · Additional Supported CA ELA Standards:** W.6.2.a–f, W.6.4, W.6.5, W.6.9, W.6.10, RL.6.1, RL.6.2, RL.6.3, RL.6.4, RL.6.9, RL.6.10, L.6.1, L.6.1.e, L.6.2, L.6.3, L.6.6
- **M · Skill or content that will be needed for Performance Task:** Comparing two homecoming narratives to explain different views of “home”
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.10 – Write explanatory text
  • ELD.PI.6.7 – Compare narrative outcomes
  • ELD.PII.6.5 – Maintain cohesion in writing
  ```

#### Row 43 — Investigation 2 — Lesson 35  (lesson)

- **A · Filename:** L35_ELA_TE_G6_U3_CA_CoreL30_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Investigation 2
- **C · Lesson #:** Lesson 35
- **D · Type of Lesson:** Academic Discussion
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** N/A
- **G · Lesson Description:**

  ```text
  Academic Discussion
  • Prepare students to discuss the EQ "How do retellings change across cultures and generations?" and the movie vs. novel versions of The Lightning Thief
  Discussion (Part 1) Focus: Myths from Inv 1 and 2 and The Lightning Thief
  • Students synthesize what they've read this unit to analyze how The Lightning Thief's narrative functions as a retelling or reworking of myth.
    o Students trace how the story has updated, shifted, or reinterpreted traditional mythic elements for a modern audience.
    o Students consider how setting, character, humor, and point of view in the assigned readings change the cultural messages of the myths being referenced.
    o Students connect the text to broader questions about how communities adapt myths over time and how students themselves might reinterpret a myth to express contemporary values.
  Discussion (Part 2) Focus: The Lightning Thief novel vs. film
  • Students analyze how what they “saw” and “heard” in the movie (actors’ performances, camera angles, music, special effects) differs from what they imagined when reading, and explain how those choices change their experience of the scene.
  • Students analyze how changes in the adaptation—such as added or omitted dialogue, reordered events, or altered settings—affect characterization, tone, or themes compared with the original text.
  • Students discuss how well the film clips honor or change the novel, using academic language and evidence from both text and film to build on one another’s ideas.
  ```
- **H · Text Set Choice:** • Teacher-chosen clips from the movie version of The Lightning Thief
- **J · Focus Standards (assessed):** SL.6.1, SL.6.2, SL.6.6, RL.6.7, RL.6.9
- **K · Additional Supported CA ELA Standards:** SL.6.1.a–d, SL.6.2, SL.6.6, RL.6.7, RL.6.9
- **M · Skill or content that will be needed for Performance Task:** Discussing an essential question using evidence from texts; comparing/contrasting two interpretations of a story
- **N · Foundational Skills Focus:** Students analyze how academic discourse markers (Building on…, I would like to add…, In contrast…, A recurring pattern is…) support sustained discussion.
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.1 – Participate in extended academic discussions
  • ELD.PI.6.7 – Analyze how retellings change meaning
  • ELD.PII.6.4 – Produce expanded oral explanations
  ```

#### Row 44 — End of Investigation 2 (Flex Days) — End of Investigation 2 (Flex Days)  (arc_header)

- **B · Lesson:** End of Investigation 2 (Flex Days)

#### Row 45 — Flex — End-of-Arc Flex Day  (flex_day)

- **B · Lesson:** Flex
- **D · Type of Lesson:** End-of-Arc Flex Day
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** N/A
- **G · Lesson Description:**

  ```text
  Language Development Huddle/Catch-Up Day
  • Teacher provides additional time and support for students to finish their Academic Discussion
  ```

#### Row 46 — Flex — End-of-Arc Flex Day  (flex_day)

- **B · Lesson:** Flex
- **D · Type of Lesson:** End-of-Arc Flex Day
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** N/A
- **G · Lesson Description:**

  ```text
  Meaning-Making Huddle/Catch-Up Day
  • Review/analyze sections from The Lightning Thief that students need additional time/support with
  ```

#### Row 47 — Showcase — Showcase  (arc_header)

- **B · Lesson:** Showcase
- **G · Lesson Description:** Opportunity for students to showcase their learning in the form of a performance task.

#### Row 48 — Showcase — Lesson 36  (lesson)

- **A · Filename:** L36_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Showcase
- **C · Lesson #:** Lesson 36
- **D · Type of Lesson:** Writing
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:**

  ```text
  Learning Goals / EQ
  	•	Students will plan an explanatory essay comparing or classifying myths from multiple cultures.
  	•	Students will develop a clear thesis, organize ideas logically, and use precise comparative language.
  	•	Students will plan a visual representation (chart, concept map, digital collage) to support their argument.
  ```
- **G · Lesson Description:**

  ```text
  Plan for Performance Task—Shared Stories, Shared Lessons
  • Introduce the explanatory essay students will be writing, explaining that they will be using the myths from different cultures they read this unit to craft an essay that shows what these stories teach us about being human, how they explain the world, and how they express values. Students will choose to:
     o Compare two myths that share a similar lesson or theme, or
     o Classify several myths into types (e.g., creation, hero, cautionary, or transformation)
  They will also include a visual (chart, concept map, or digital collage) to make the comparison.
  • Using a model essay, the teacher explains that a successful essay has a clear thesis identifying a shared theme or category, logical organization with transitions that show relationships, precise comparative language (both, unlike, while, although), relevant evidence from more than one myth, a visual or diagram (chart, concept map, or digital collage) that helps the reader see reasoning, and a formal style.
  • Explain that students will use their essays while participating in a seminar or podcast at the end of the unit where they will be listening, responding, and connecting ideas to modern values.
  • Students plan out their essay, using their annotations and notes on this unit's myths to choose which myths to write about, along with the Research Essay Outline graphic organizer to plan out their paragraphs and visual.
  ```
- **I · Homework:** • Finish essay outline
- **J · Focus Standards (assessed):** W.6.2, W.6.2.a, W.6.5, W.6.8, SL.6.5
- **K · Additional Supported CA ELA Standards:** W.6.2.a–f, W.6.4, W.6.5, W.6.6, W.6.8, W.6.9, W.6.9.a, W.6.10
- **L · CA Media Literacy Standards:** 2.1.a, 2.1.b
- **M · Skill or content that will be needed for Performance Task:** Planning Performance Task
- **N · Foundational Skills Focus:** Students rehearse complex thesis statements using subordinating conjunctions (although, while, because) to clarify relationships among myths. Mini-lessons focus on precise comparative vocabulary (similarly, in contrast, unlike) and pronoun clarity when referencing multiple texts. Students orally rehearse full thesis statements before drafting.
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.10 – Plan extended explanatory texts
  • ELD.PI.6.6 – Explain relationships among ideas
  • ELD.PII.6.5 – Use cohesive organizational language
  ```

#### Row 49 — Showcase — Lesson 37  (lesson)

- **A · Filename:** L37_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Showcase
- **C · Lesson #:** Lesson 37
- **D · Type of Lesson:** Writing
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:**

  ```text
  N/A
  
  Learning Goals / EQ
  	•	Students will draft explanatory essays using evidence from myths across cultures.
  	•	Students will expand sentences for clarity, style, and precision.
  	•	Students will connect evidence to analysis, using varied sentence structures and precise academic verbs.
  	•	Students will draft strong essay introductions.
  	•	Students will provide and receive peer feedback to improve clarity and cohesion.
  ```
- **G · Lesson Description:**

  ```text
  Craft Focus
  • Using an example essay, the teacher models varying sentence patterns for meaning, reader interest, and style, and demonstrates how visual language creates an impression.
  • Students begin crafting their essays.
  ```
- **I · Homework:** • Continue draft
- **J · Focus Standards (assessed):** L.6.3, L.6.3.a, W.6.2, W.6.2.b, W.6.2.c, W.6.2.d
- **K · Additional Supported CA ELA Standards:** W.6.2.a–f, W.6.4, W.6.6, W.6.9, W.6.9.a, W.6.10, L.6.3, L.6.3.a
- **L · CA Media Literacy Standards:** 2.2.a
- **M · Skill or content that will be needed for Performance Task:** Crafting Performance Task
- **N · Foundational Skills Focus:** Students revise for sentence expansion using appositives, prepositional phrases, and subordinating clauses to add clarity. Instruction targets combining short evidence sentences into cohesive analytical commentary. Students practice varying sentence openings to avoid repetitive structure.
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.10 – Draft extended explanatory writing
  • ELD.PI.6.6 – Clarify explanations with evidence
  • ELD.PII.6.4 – Produce expanded, clear sentences
  ```

#### Row 50 — Showcase — Lesson 38  (lesson)

- **A · Filename:** L38_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Showcase
- **C · Lesson #:** Lesson 38
- **D · Type of Lesson:** Writing
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:**

  ```text
  N/A
  
  Learning Goals / EQ
  	•	Students will continue drafting explanatory essays, maintaining a formal academic style.
  	•	Students will include relevant evidence in body paragraphs to support thesis and analysis.
  	•	Students will use cohesive transitions to link ideas across paragraphs.
  	•	Students will revise for consistent verb tense and formal tone.
  ```
- **G · Lesson Description:**

  ```text
  Craft Focus
  • Using an example essay, the teacher models maintaining a consistent formal style and tone.
  • Students continue crafting their essays.
  ```
- **I · Homework:** • Complete draft
- **J · Focus Standards (assessed):** L.6.3, L.6.3.b, W.6.2, W.6.2.e, W.6.2.f
- **K · Additional Supported CA ELA Standards:** W.6.2.a–f, W.6.4, W.6.6, W.6.9, W.6.9.a, W.6.10, L.6.3, L.6.3.b
- **M · Skill or content that will be needed for Performance Task:** Crafting Performance Task
- **N · Foundational Skills Focus:** Students revise for consistent verb tense and eliminate informal language. Mini-lessons target transition phrases that signal comparison and classification across paragraphs. Students highlight cohesive devices to ensure logical progression.
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.10 – Continue drafting explanatory text
  • ELD.PI.6.6 – Maintain formal style
  • ELD.PII.6.5 – Use cohesive transitions
  ```

#### Row 51 — Showcase — Lesson 39  (lesson)

- **A · Filename:** L309_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Showcase
- **C · Lesson #:** Lesson 39
- **D · Type of Lesson:** Writing
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:**

  ```text
  N/A
  
  Learning Goals / EQ
  	•	Students will revise their explanatory essays for clarity, cohesion, and formal style.
  	•	Students will practice writing effective conclusions that synthesize ideas across myths.
  	•	Students will use a revision checklist and the Lesson 36 rubric to guide revisions.
  	•	Students will engage in structured peer feedback focused on reasoning, evidence, and formal style.
  ```
- **G · Lesson Description:**

  ```text
  Revision Focus
  • Teacher models revising an example essay using proper capitalization, punctuation, and spelling.
  • Students work in pairs to peer-review one another's essays.
  ```
- **I · Homework:** • Incorporate revision feedback into essay
- **J · Focus Standards (assessed):** L.6.2, L.6.2.a, L.6.2.b, W.6.5
- **K · Additional Supported CA ELA Standards:** W.6.2.a–f, W.6.4, W.6.5, W.6.6, W.6.9, W.6.9.a, W.6.10, L.6.2.a–b
- **M · Skill or content that will be needed for Performance Task:** Revising Performance Task
- **N · Foundational Skills Focus:** Students revise for capitalization of proper nouns (myth titles, cultural groups) and correct punctuation in complex sentences. Instruction reinforces subject-verb agreement in longer analytical sentences. Students use editing checklists aligned to standards.
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.5 – Revise writing for clarity
  • ELD.PI.6.10 – Improve explanatory text
  • ELD.PII.6.4 – Refine sentence-level clarity
  ```

#### Row 52 — Showcase — Lesson 40  (lesson)

- **A · Filename:** L40_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Showcase
- **C · Lesson #:** Lesson 40
- **D · Type of Lesson:** Writing
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:**

  ```text
  N/A
  
  Learning Goals / EQ
  	•	Students will finalize explanatory essays by revising for clarity, cohesion, formal style, and evidence use.
  	•	Students will incorporate peer feedback to strengthen reasoning and connections to thesis.
  	•	Students will practice preparing for the seminar/podcast by articulating their key claims and supporting evidence.
  ```
- **G · Lesson Description:**

  ```text
  Finalization Focus
  • Students work on finishing their essays and preparing for the seminar/podcast.
  ```
- **I · Homework:** • Finish final draft
- **J · Focus Standards (assessed):** W.6.2, W.6.4, W.6.6, W.6.8, W.6.9, W.6.9.a, W.6.10
- **K · Additional Supported CA ELA Standards:** W.6.2.a–f, W.6.4, W.6.6, W.6.8, W.6.9, W.6.9.a, W.6.10
- **L · CA Media Literacy Standards:** 3.3.a
- **M · Skill or content that will be needed for Performance Task:** Finalizing Performance Task
- **N · Foundational Skills Focus:** Students conduct a final read-through to ensure consistent terminology for themes (e.g., justice vs. fairness). Mini-lessons reinforce eliminating redundancy and clarifying pronoun references. Students check that each paragraph explicitly connects to the thesis.
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.10 – Finalize extended explanatory writing
  • ELD.PI.6.6 – Clarify and refine ideas
  • ELD.PII.6.5 – Maintain cohesion across the text
  ```

#### Row 53 — Showcase — Lesson 41  (lesson)

- **A · Filename:** L41_ELA_TE_G6_U3_CA_Core
- **B · Lesson:** Showcase
- **C · Lesson #:** Lesson 41
- **D · Type of Lesson:** Writing
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:**

  ```text
  N/A
  
  Learning Goals / EQ
  	•	Students will present their explanatory essays orally in a seminar or podcast format, using evidence to support claims.
  	•	Students will actively listen, paraphrase, and build on peers’ ideas.
  	•	Students will self-reflect on both their written and oral performance.
  ```
- **G · Lesson Description:**

  ```text
  Performance Task—Shared Stories, Shared Lessons
  • Prepare students for the seminar or podcast
  • Drawing from the evidence in their essays, students will participate in the seminar or podcast, listening, responding, and connecting ideas to modern values.
  • Students submit the final drafts of their essays.
  • Students close by completing the Self-Reflection graphic organizer.
  ```
- **I · Homework:** • Finish Self-Reflection
- **J · Focus Standards (assessed):** SL.6.1, SL.6.2, SL.6.4, SL.6.5, SL.6.6
- **K · Additional Supported CA ELA Standards:** SL.6.1.a–d, SL.6.2,  SL.6.4, SL.6.4.a, SL.6.5, SL.6.6
- **L · CA Media Literacy Standards:** 4.3.a
- **M · Skill or content that will be needed for Performance Task:** Delivering Performance Task
- **N · Foundational Skills Focus:** Students rehearse clear pronunciation of myth names and academic vocabulary. Instruction reinforces using complete sentences when responding and citing evidence orally. Students practice paraphrasing peers before responding.
- **P · Designated ELD Standards:**

  ```text
  • ELD.PI.6.1 – Engage in collaborative academic discussion
  • ELD.PI.6.4 – Present ideas clearly
  • ELD.PII.6.6 – Adjust language to task and audience
  ```

#### Row 54 — End of Showcase (Flex Days) — End of Showcase (Flex Days)  (arc_header)

- **B · Lesson:** End of Showcase (Flex Days)
- **G · Lesson Description:** Flexible days used to support ongoing student needs based on formative assessment, progress on in-class work, or extensions of learning. Teachers may select to use a small group or whole group format based on formative data collection.

#### Row 55 — Flex — End-of-Arc Flex Day  (flex_day)

- **B · Lesson:** Flex
- **D · Type of Lesson:** End-of-Arc Flex Day
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** N/A
- **G · Lesson Description:**

  ```text
  Catch-Up Day
  Teacher provides additional time and support for students to finish their Performance Task and present.
  ```

#### Row 56 — Flex — End-of-Arc Flex Day  (flex_day)

- **B · Lesson:** Flex
- **D · Type of Lesson:** End-of-Arc Flex Day
- **E · Days:** 1.0
- **F · Text Dependent Question tied to the EQ:** N/A
- **G · Lesson Description:**

  ```text
  Knowledge Boost Huddle
  • Review of entire unit
  ```

#### Row 57 —  —   (total_row)

- **E · Days:** =SUM(E4:E56)
