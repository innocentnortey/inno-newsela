# 04 — Lesson Structure Analysis (what a Newsela lesson is made of)

**Rank:** DERIVED (our analysis). **Written:** 2026-10-24.
**Evidence:** 50 lesson records captured from the review site on 2026-10-24 (git-ignored under
`restricted/originals/lessons-json/`): the linked lesson (Grade 6 Unit 1 Lesson 1), Unit 1 Lessons
22 and 45, **all 45 lessons of Grade 6 Unit 4** (the sample outline's unit), Grade 8 Unit 2
Lesson 23 and ELD Core 6 Unit 4 Lesson 1. Counts below are over those 50 unless stated. Cross-checked
against Newsela's own *ELA Design Framework* PDF (program "Newsela Threads & Themes", linked from the
course page; git-ignored copy in `restricted/originals/program-resources/`).

This file describes **structure only**. It quotes a sentence at most, where needed to show a field's
form. Full lesson text stays in the restricted folder.

## 0. The one-paragraph answer

A Newsela lesson is a **JSON record whose rich-text fields are ProseMirror documents**. It has
**front matter** (title, lesson type, minutes, three standards lists with full descriptions, three
learning objectives written twice — once for the teacher, once for the student — essential
questions, four "connections", routines, materials, two vocabulary lists, lesson texts and resource
cards) and a **lesson sequence** of 3–5 timed sections, also written twice (teacher edition and
student edition). In almost every Reading, Writing, Discussion, Research and Presentation lesson the
sequence is **Launch 5 → Literacy Lab 10 → Learning in Action 30 → Look Back 5 → Homework**
(50 minutes). The page the brief links is a **Spark** lesson, the one type with no Literacy Lab
(Launch 15 → Learning in Action 30 → Look Back 5), so it is not the typical shape.

**Concrete example.** Grade 6 Unit 4 Lesson 4 ("The Lightning Thief, Chapter 1", type `Reading`):
front matter lists focus standards `L.6.4.a, RL.6.4, RL.6.6`, objectives *Content / Language /
Foundational Skills*, two vocabulary lists (`immortal`, `sarcastic` …), the novel and "The Hare and
the Lion" as lesson texts. The sequence is Launch (5 min, a Think-Pair-Share on the narrator), Literacy
Lab (10 min, a *Language Study* routine on embedding evidence with a noun clause, ending in a *Check
for Understanding*), Learning in Action (30 min, Part A and Part B, each with an *Integrated ELD
Instructions* drop-down and an *Additional Student Support* drop-down, a *Pulse Check* multiple-choice
item with right/wrong feedback), Look Back (5 min, a *Quick Write*), Homework (read Ch. 1 pp. 9–15,
with a teacher tip about intense scenes).

## 1. How the content is stored (this matters for the editor)

The lesson object arrives in the page's Next.js server payload (react-query key `['lesson','page']`).
Every rich-text field is a **ProseMirror document** (`{"type":"doc","content":[…]}`), the same editor
framework the brief requires (ProseMirror + Yjs). So Newsela's production content model is
already ProseMirror JSON, and a generator that emits this schema can be loaded into their editor
without conversion. *Assumption to confirm with Newsela:* that the review site's schema is the
schema of their authoring system.

**Node types seen (count over all 50 lessons):** `text` 15,811 · `paragraph` 10,458 (attr `align`:
null or `center`) · `list_item` 3,189 · `bullet_list` 1,754 · `doc` 1,477 · `table_cell` 1,464
(attrs `colspan`, `rowspan`, `colwidth`) · `table_row` 1,340 · `table_header` 667 · `heading` 519
(attr `level` 1–5) · **`routine_heading`** 511 (attr `icon`) · `table` 442 · **`callout`** 407 (attr
`variant`) · **`collapsible`** 251 (attr `label`) · `ordered_list` 57 (attrs `order`, `type`: `A` for
lettered answer choices).

**Marks:** `strong` 3,534 · `textColor` 2,618 · `em` 2,241. The unit and course pages use `bold`,
`italic` and `hard_break` instead, so the mark names are not consistent across Newsela's own
documents.

**Custom nodes** (the three that carry Newsela's lesson semantics):

| Node | Attribute values seen | What it renders as |
|---|---|---|
| `routine_heading` | `icon` ∈ `cfu` (190), `notes_section` (135), `writing` (109), `graphic_organizer` (34), `academic_discussion` (30), `personal_dictionary` (8), `reading` (5) | A named classroom routine with an icon: "Quick Write", "Think-Pair-Share", "Pulse Check (RL.6.9)", "Language Study" |
| `callout` | `variant` ∈ `purpose`, `say`, `watch` | The three coloured boxes of an Integrated ELD support: 🎯 PURPOSE, 🗣️ SAY / ASK, 👁️ WATCH FOR / SUPPORT IF NEEDED |
| `collapsible` | `label` ∈ "Integrated ELD Instructions", "Additional Student Support" (often with a suffix, e.g. "Additional Student Support: Finding Evidence") | A drop-down ("View Integrated ELD Instructions", "View Additional Student Support") |

**Colour carries meaning.** `textColor #208095` (teal) marks words the teacher says aloud, always
after a bold **Say:** / **Ask:** / **Say these Directions:** label. `textColor #720780` (purple)
marks an **exemplar student answer** nested under an *Ask:* bullet. Six other colours appear rarely
(`#0d47a1`, `#141413`, `#1f4d78`, `#45818e`, `#4a86e8`, `#bf360c`), apparently pasted formatting.
A generator should emit role, not colour (e.g. a `teacher_talk` / `sample_response` mark), and map to
colour at render time.

**Boxed tables.** A one-column table is used as a box: "Teacher Tip" boxes, "Pulse Check" and
"Check for Understanding" items (a `routine_heading`, a question, a lettered `ordered_list` of
choices, each with a nested "Correct: …" / "Incorrect: …" rationale), "Reflection" prompts. Real
multi-column tables hold support grids ("Situation | Try this"), sentence-chunk tables
("Chunk | Meaning | Function") and rubrics ("Criteria | 1 — Beginning …").

## 2. Front matter (exact field names as stored)

Top-level keys of the lesson object, in the order the API returns them:

| Key | Type | Present | Notes, with the form seen |
|---|---|---|---|
| `id` | string (cuid) | 50/50 | `c0c4tx7u3mnezs5w9u8vzvi1` |
| `title` | string | 50/50 | `"Lesson <n>: <name>"`, e.g. "Lesson 4: The Lightning Thief, Chapter 1". Multi-day topics end ", Part 1/2". |
| `type` | string | 50/50 | `Spark` 5, `Reading` 19, `Writing` 14, `Academic Discussion` 3, `Research` 3, `Flex Day` 3, `Mid-Unit Assessment` 1, `End Unit Assessment` 1, `Presentation` 1 |
| `subject` | string | 50/50 | `ELA` (also on the ELD-course lesson) |
| `total_time_in_minutes` | [min, max] integers | 50/50 | `[50, 50]`; ELD Designated lesson `[30, 45]` |
| `breadcrumbs` | {teacher, student} lists | 50/50 | Home › course › Unit n › Lesson n |
| `standard_lists` | list of {title, standards[{id, code, description}]} | 50/50 | Titles exactly: "California CCSS: Focus Standards" (49), "California CCSS: Supporting Standards" (47), "ELD Standards" (48). Every code carries its full official description. |
| `objectives` | {teacher[], student[]} of {title, audience, body: doc} | 50/50 | Titles "Content" (50), "Language" (50), "Foundational Skills" (39). Teacher wording "Students will determine…"; student wording drops "Students will" ("Determine…"). |
| `essential_questions` | doc (bullet list) | 50/50 | The unit's (or investigation's) EQs, 1–2 bullets |
| `connections` | list of {title, body: doc} | 50/50 | Titles exactly "Knowledge-Building", "Enduring Understanding", "Future Lessons", "Unit Performance Task"; the ELD lesson uses "ELA", "Future Lessons", "Unit Performance Task"; Unit 1 Lesson 45 has only the first two |
| `routines` | doc (bullet list) | 50/50 | Names of the routines used, e.g. "Turn and Talk", "Graffiti/Table Talk", "Quick Write" |
| `materials` | doc (bullet list) | 49/50 | e.g. the novel (italic title) and "Unit 4 Lesson 4 Student Edition". **Missing on the linked example lesson.** |
| `vocabulary_lists` | list of {title, vocabulary[{word, definition, cognate?}]} | 50/50 (empty on 16) | ELA lessons: "Vocabulary Addressed in Lesson" and "Vocabulary for Additional Support". ELD lesson: "Vocabulary Present in the Text(s)" and "Academic/Analysis Vocabulary" with a Spanish `cognate` (e.g. myth → `mito`). |
| `anchor_text_cards` | list of {id, label, title, author, type, image, href} | 50/50 (empty on 15) | `label` "Novel" (type `off-platform-text`, no link) or "Short-Form Text" (type `article`, links to a Newsela reader page) |
| `resource_cards` | {teacher[], student[]} | 50/50 (empty on 9) | PDFs such as "3-Column Chart", `group_name` `additional_resources` |
| `differentiators` | list of {level, supports: doc, output_example: doc} | 1/50 (ELD lesson only) | Levels "Emerging", "Expanding", "Bridging", "Newcomers", "LTELs" |
| `language_at_a_glance` | list of {title, audience, body} | 1/50 (ELD lesson only) | "Language Domain Focus", "Formative Language Output" |
| `sections` | {teacher[], student[]} of {title, sequence, audience, purpose: doc, estimated_time_in_minutes: [min,max], body: doc} | 50/50 | See §3 |

The page renders the front matter in this order: type badge, title, minutes, the three standards
lists, the student-lesson card, **Student Learning Objectives** (numbered 1–3), **Essential
Questions**, **Connections to**, **Lesson Pacing** (a table of section · minutes · purpose),
**Routines**, then the **Lesson Sequence** accordion, then **Lesson Texts**.

## 3. The lesson sequence

### 3a. Which sections appear (teacher edition)

| Sequence | Lessons | Types |
|---|---|---|
| Launch › Literacy Lab › Learning in Action › Look Back › Homework | 36 | Reading, Writing, Academic Discussion, Research, Presentation |
| Launch › Literacy Lab › Learning in Action › Look Back | 2 | (no homework that day) |
| Launch › Learning in Action › Look Back › Homework | 5 | Spark, Flex Day |
| Launch › Learning in Action › Look Back | 4 | Spark, assessments |
| Launch › Literacy Lab: *subtitle* › Learning in Action[: *subtitle*] › … | 3 | Research (section titles carry a subtitle after a colon, e.g. "Literacy Lab: Organizing Notes for Synthesis") |

The **student edition** has the same sections minus Homework (38 lessons: Launch › Literacy Lab ›
Learning in Action › Look Back), and stores every section time as `[0, 0]`. Three flex/assessment
lessons have a student edition with a Launch only.

### 3b. Each section: purpose, minutes, content and voice

Minutes are `estimated_time_in_minutes[0]` from the teacher sections. Word counts are the teacher
body text.

| Section | Minutes seen | Purpose (Newsela's framework, paraphrased) | Typical content | Words (median, range) |
|---|---|---|---|---|
| **Launch** | 5 (most); 15 in Spark; 2 in the ELD lesson | Activate prior knowledge, connect to the EQ or yesterday's Look Back; low stakes | An italic teacher note, one routine (Think-Pair-Share 15, Turn and Talk 16), a *Say these Directions* line, an *Ask:* with a purple sample answer, often a "Connection to Today's Learning" heading with a *Say:* | 196 (97–619) |
| **Literacy Lab** | 10 | Short targeted skill block: vocabulary/morphology/syntax/fluency in Reading lessons; a writing strategy in Writing lessons; a research routine in Research; the discussion protocol in Academic Discussion | A routine ("Language Study", "Introduce New Words Using Morphemes", "Context Clues Routine"), a displayed model sentence, a *Chunk / Meaning / Function* table, a **Check for Understanding** box (24 lessons), one Integrated ELD drop-down (40/41) and often an Additional Student Support drop-down | 782 (363–1,514) |
| **Learning in Action** | 30; 40 in assessments and flex days | Core application with the anchor text: close reading, a reading–writing connection, guided practice, drafting, discussion | Usually **Part A** and **Part B** (35 lessons; 3 parts in 2; none in 11), each a level-2 heading with its standards in brackets and minutes, e.g. "Part A: … (RI.6.1, RI.6.2) (15 minutes)". Inside: *Teach:* / *Guided Practice* / *Independent Choice Work* / *Reteach* / *Quick Check* headings, a Pulse Check (35), a Reflection, Integrated ELD (93 drop-downs) and Additional Student Support (90) | 1,837 (473–3,448) |
| **Look Back** | 5; 3 in the ELD lesson | Exit ticket tied to the content objective; at least every fifth lesson a reflection | One routine, usually **Quick Write** (31), a prompt, an optional sentence starter, a purple sample answer | 200 (29–532) |
| **Homework** | 0 | Next reading or practice | Reading assignment with chapter and page range (37 page references), often a "Teacher Tip" box (content warnings, what to preview). Its `purpose` is usually empty. | 51 (8–153) |

**Lesson type changes the timing.** Spark: 15 / 30 / 5 (no Literacy Lab). Reading, Writing,
Discussion, Research, Presentation: 5 / 10 / 30 / 5. Assessments and Flex Days: 5 / 40 / 5. The ELD
Designated lesson: 2 / 10 / 15 / 3 (30 of a 30–45-minute block).

**Section `purpose`.** Each teacher section has a `purpose` doc, shown in the Lesson Pacing table:
one or two "Students will …" sentences; in Learning in Action it lists each Part's bold title with
its standards and a one-line summary. Homework's purpose is empty in most lessons.

### 3c. Teacher voice versus student voice

- **Teacher edition** (`sections.teacher`) is a script for the teacher: italic stage directions
  ("*Pause for students to discuss.*"), bold labels **Say:**, **Ask:**, **Say these Directions:**
  followed by teal words to read aloud, and purple **sample responses** under each Ask. Counts over
  the 50: *Ask:* 430, *Say:* 322, *Say these Directions:* 156, "Teacher Tip" boxes 65.
- **Student edition** (`sections.student`) speaks to the student: "**Directions:** …" (213), the
  same prompts, frames and Pulse Checks, without the Say/Ask labels, sample answers or teacher tips.
- **Objectives** are also written twice (teacher "Students will…" / student imperative).

So every generated lesson needs **two renderings of the same plan**. A generator can produce the
teacher edition and derive the student edition, but the student edition must drop answers and
teacher notes, which is a checkable rule.

## 4. How standards are shown

1. **In front matter**, as three lists with the code and the full official description (§2). Focus
   standards are what the lesson teaches and assesses; Supporting are practised; ELD are listed in all
   three proficiency tiers, e.g. `ELD.PI.6.6a.Em`, `ELD.PI.6.6a.Ex`, `ELD.PI.6.6a.Br`.
2. **Inline in Part headings**: "Part A: Ordinary Moments: "Love Your Stories" (RI.6.1, RI.6.2)".
3. **Inline in routine headings** of checks: "Pulse Check (RL.6.9)", "Check for Understanding
   (L.6.4.a)", "Reflection (RL.6.2, RL.6.4)". Research lessons also cite library standards here as
   `MSLS 1.2a, 2.2b-c` (CA Model School Library Standards).
4. **In the Lesson Pacing table**, through the Learning in Action purpose.

**Only leaf codes.** Where a standard has sub-parts the lessons cite the sub-part (`L.6.4.a`, never
bare `L.6.4`). The sample outline does the opposite (see `02` §5, item 9).

**Newsela's own data has slips** a generator must not learn: `L.6.3a`, `L6.3.b` and `Sl.6.1.d`
appear as stored codes (Grade 6 Unit 1, Lesson 45 and the Unit 1 page); "Pulse Check (RI.6.2,
RI.6.2)" repeats a code in the linked lesson. Treat the published lessons as a noisy reference,
not ground truth for codes.

## 5. How the anchor text is used

- **The novel is an off-platform text**: its card has `type: off-platform-text`, label "Novel", and
  no link. Students read it in print.
- **Short quotations, no long passages.** Lessons quote the novel a sentence at a time as evidence
  ("Target Sentence Block" in a Literacy Lab; a quoted line inside a sample answer). Page numbers
  appear mainly in Homework ("Chapter 1, pp. 9–15") and in a few Launch/Learning-in-Action
  directions (31 page references outside Homework across the 50 lessons). There are no plot
  summaries in the teacher script beyond a line of context.
- **Short paired texts are on-platform** (`type: article`, label "Short-Form Text") with a link to
  Newsela's reader, e.g. "The Hare and the Lion" (From *Zanzibar Tales*), "What Are Myths?" (Newsela
  staff). Classical texts are given as named excerpts ("Virgil's Aeneid Book 6 Excerpt", "Homer's The
  Iliad Book 1 Excerpt").
- **Film** is used as a second text (RL.6.7 "see vs. hear" comparison) via teacher-chosen clips.

## 6. ELD and differentiation supports

Every ELA lesson carries **Integrated ELD (I-ELD)** inside the activity it supports, not in a
separate block:

- A `collapsible` "Integrated ELD Instructions" holding exactly three `callout`s in order:
  `purpose` (the language goal), `say` (modelled language and 3–5 graduated sentence frames, e.g.
  "This line shows ___ because ___."), `watch` (observable indicators and **if/then** prompts, e.g.
  "If evidence is missing → Prompt: …"). 137 such drop-downs in 50 lessons, mostly in Literacy Lab
  and Learning in Action.
- A `collapsible` "Additional Student Support" with a two-column table "Situation | Try this", rows
  labelled "**Struggling with:** …" and "**Ready for extension:** …" (114 drop-downs).
- **Academic Discussion and Presentation lessons** break frames and look-fors out by ELD level
  (Emerging / Expanding / Bridging); "Listen-Fors ELD.PI.6…" tables appear.
- The **Designated ELD** lesson (ELD course) adds `differentiators` per level (Emerging, Expanding,
  Bridging, Newcomers, LTELs — long-term English learners), each with supports and an
  `output_example`, plus `language_at_a_glance`.

## 7. Assessment and checks for understanding

- **Pulse Check** (`routine_heading`, icon `cfu`): a multiple-choice item, lettered A–D, each option
  followed by "Correct: …" or "Incorrect: …" with a reason. 35 in Learning in Action.
- **Check for Understanding**: a short task or item, usually closing the Literacy Lab (24).
- **Reflection**: a rating or short-response prompt ("Choose a number from 1 to 5…").
- **Quick Write** in the Look Back: the daily exit ticket.
- **Checklist** and **rubric tables** ("Criteria | 1 — Beginning | …") in Writing lessons.
- **Mid-Unit / End Unit Assessment** lessons (types of their own) point to PDF assessments on the
  unit page ("6.4 Investigation 1 Assessment").

## 8. What stays the same and what varies

**Constant across lessons:** the key set of the record; the three standards-list titles; the
objective titles (Content, Language, and usually Foundational Skills); the four connection titles;
the section names and their order; 50 total minutes; the Say/Ask/Directions labels; the I-ELD
three-callout pattern; Pulse Check answer-feedback format; teacher and student editions.

**Varies by lesson type:** whether a Literacy Lab exists (no in Spark, Flex, assessments); section
minutes (§3b); Learning in Action parts (0–3); vocabulary lists (empty in most Writing lessons);
section subtitles (Research); differentiators and language-at-a-glance (ELD course only).

**Varies by lesson:** the routines chosen, the text and page focus, the sample answers, the number of
supports, the homework.

## 9. Fields a generator must produce (draft output contract)

"Required" means every captured lesson of that kind has it. Types: `doc` = a ProseMirror document
using the nodes in §1; `str` = plain text. Examples are short and taken from the captures.

| # | Field | Type | Required? | Example (from a capture) |
|---|---|---|---|---|
| 1 | `title` | str, `Lesson <n>: <name>` | yes | "Lesson 4: The Lightning Thief, Chapter 1" |
| 2 | `type` | enum: Spark, Reading, Writing, Academic Discussion, Research, Presentation, Flex Day, Mid-Unit Assessment, End Unit Assessment | yes | `Reading` |
| 3 | `subject` | enum (`ELA`) | yes | `ELA` |
| 4 | `total_time_in_minutes` | [int, int] | yes | `[50, 50]` |
| 5 | `standard_lists[Focus]` | list of {code, description} | yes (49/50; absent only on the Designated ELD lesson) | `RL.6.6` — "Explain how an author develops the point of view of the narrator or speaker in a text." |
| 6 | `standard_lists[Supporting]` | list of {code, description} | yes (47/50; absent on the ELD lesson and the two assessments) | `SL.6.1.a` |
| 7 | `standard_lists[ELD]` | list of {code with sub-part and tier, description} | yes (48/50; absent on the two assessments) | `ELD.PI.6.6a.Ex` |
| 8 | `objectives.teacher[]` | {title ∈ Content, Language, Foundational Skills; body: doc} | Content + Language yes; Foundational Skills in 39/50 | Content: "Students will determine and explain a central idea and connect it to their own experiences." |
| 9 | `objectives.student[]` | same titles, student wording | yes | "Determine and explain a central idea…" |
| 10 | `essential_questions` | doc (bullets) | yes | "How do ordinary moments reveal who we are and how we belong?" |
| 11 | `connections[]` | {title ∈ Knowledge-Building, Enduring Understanding, Future Lessons, Unit Performance Task; body} | yes (all four in 48/50; Unit 1 Lesson 45 has only the first two) | Future Lessons: "This Spark lesson sets the foundation for all future lessons…" |
| 12 | `routines` | doc (bullets of routine names) | yes | Turn and Talk · Graffiti/Table Talk · Quick Write |
| 13 | `materials` | doc (bullets) | yes (49/50) | "Unit 4 Lesson 4 Student Edition" |
| 14 | `vocabulary_lists[]` | {title ∈ "Vocabulary Addressed in Lesson", "Vocabulary for Additional Support"; vocabulary[{word, definition}]} | yes as keys; may be empty (empty in 16/50) | immortal — "able to live forever" |
| 15 | `anchor_text_cards[]` | {label ∈ Novel, Short-Form Text; title; author; type} | when the lesson uses a text (35/50) | Novel — *The Lightning Thief* — Rick Riordan |
| 16 | `resource_cards` | {teacher[], student[]} of {title, type} | optional (41/50 non-empty) | "3-Column Chart" (pdf) |
| 17 | `sections.teacher[]` | ordered {title, sequence, purpose: doc, estimated_time_in_minutes, body: doc} | yes | see rows 18–22 |
| 18 | └ Launch | section | yes | 5 min; Think-Pair-Share; "Connection to Today's Learning" |
| 19 | └ Literacy Lab | section | yes for Reading, Writing, Discussion, Research, Presentation; **absent** for Spark, Flex Day, assessments | 10 min; Language Study; Check for Understanding |
| 20 | └ Learning in Action | section with Part A/B headings carrying standards and minutes | yes | 30 min; "Part A: … (RI.6.1, RI.6.2) (15 minutes)" |
| 21 | └ Look Back | section | yes | 5 min; Quick Write with sentence starter |
| 22 | └ Homework | section (0 min) | yes in 44/50 | "Read Chapter 1, pp. 9–15" + Teacher Tip |
| 23 | Inside bodies: teacher talk | `Say:` / `Ask:` / `Say these Directions:` + teacher-talk mark | yes (every lesson) | **Ask:** "What hopes and concerns do you have about middle school?" |
| 24 | Inside bodies: sample responses | nested bullet with sample-response mark under each Ask | yes | "I'm excited about the new classes … but I'm worried …" |
| 25 | Inside bodies: Integrated ELD | `collapsible` "Integrated ELD Instructions" with `callout` purpose → say → watch | yes, at least one per lesson in Literacy Lab / Learning in Action | Purpose: "Help students identify what makes a story meaningful by citing a detail…" |
| 26 | Inside bodies: Additional Student Support | `collapsible` with a Situation / Try this table (Struggling with … / Ready for extension …) | yes in most Literacy Lab and Learning in Action blocks | "Struggling with: Identifying everyday moments" |
| 27 | Inside bodies: checks | `routine_heading` Pulse Check / Check for Understanding with lettered options and Correct/Incorrect rationales | yes (at least one check per lesson) | "Pulse Check (RI.6.2)" with 4 options |
| 28 | Inside bodies: routines | `routine_heading` with `icon` from the 7 values | yes | `Quick Write` · icon `writing` |
| 29 | `sections.student[]` | same section titles minus Homework; "Directions:" voice; no Say/Ask, no sample answers, no teacher tips | yes | "**Directions:** Turn and talk with a partner…" |
| 30 | ELD course only: `differentiators[]`, `language_at_a_glance[]` | per level {supports, output_example} | only for Designated ELD lessons | Emerging: "Post one stable frame, allow home-language rehearsal first…" |

**Not produced by a generator** (system-owned): `id`, `breadcrumbs`, card `image` and `href`,
standard `id`s, resource PDFs.

## 10. Open questions this analysis cannot settle

1. Is the review site's JSON the schema of Newsela's authoring system, or a publishing export? (It
   decides whether we emit it directly.)
2. Should generated lessons follow the sheet's lesson types (`Core Reading`, `Core Writing`, `Spark 1`)
   or the published enum (`Reading`, `Writing`, `Spark`)? The mapping is obvious for most, not for
   "Core Writing (Double Lesson)".
3. Who resolves parent standards (`L.6.4`) into leaves (`L.6.4.a`), and bare ELD codes into
   `6a/6b/6c` and tiers: the generator, or the reviewer?
4. Student edition: generated separately or derived from the teacher edition by rule?
