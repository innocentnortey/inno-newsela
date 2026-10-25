# Worked pairs — one outline row in, what the product must produce out (zero-to-hero §2)

**Owner of:** `WP-N` IDs: hand-worked input → output pairs. They become the first dev set at §6 (DO-5) and one test
each at §8 (rule build-loop-test-scope). **Written:** 2026-10-24 by Claude. **Status:** draft. Every *uncertain* item
is for Innocent to check. Samples and the selection matrix: [`README.md`](README.md).

## How to read a pair

Each pair takes one row of the issued outline sheet (or a labelled synthetic variant) and works it by hand through the
product's three core workflows ([PRD §5.1](../prd/newsela-prd.md)):

1. **Intake and validation** (journey steps 1–2): the normalized row and the validation report the outline author sees.
   This part is deterministic code, so the output is exact.
2. **Generation** (steps 3–5): the lesson draft in Newsela's shape (the output contract in
   [`04` §9](../source/04-lesson-structure-analysis.md)). Teaching text is the model's job, so the pair fixes the
   fields, sections, minutes, standards, checks and placeholders, and shows sample wording only where it pins a rule.
3. **Review and approval** (steps 6–9): what the reviewer sees on version 1, what blocks Approve and how it clears.

**Where the outputs come from.** Only the row itself, its arc header and neighbours, the official CDE standards text
([`05`](../source/05-standards-referenced.md)), the output contract and Newsela's *ELA Design Framework* (S-7) as
summarised in `04`. **Not** from the held-out published Unit 4 (S-5): where a pair mentions it, the note is labelled
and was not used to derive anything. **No line of the novel is quoted anywhere.** Where a lesson would quote it, the
pair shows a placeholder (PRD R-12, GR-1, GR-2).

**Labels.** *Difficulty:* easy = copy or map; hard = needs judgement (a hard pair joins a §3 hard-problem card).
*Confidence:* sure, or uncertain = Innocent to check the listed `U` items (numbered U1–U10 across all pairs, as on the review page). Codes marked **[AI-proposed]** are leaves the
product proposes for a parent code; a person confirms them (AQ-8, R-20).

## Summary

| Pair | Row → lesson | Workflows | Difficulty | Confidence | What makes it hard | Joins (§3) |
|---|---|---|---|---|---|---|
| [WP-1](#wp-1) | row 8 → L4 Reading | intake · generate · review | hard | uncertain (U1–U3) | malformed code; an editor's note decides which standard is taught; novel quotes; homework names a text another lesson must choose | HP-6, HP-2, HP-3, HP-1 |
| [WP-2](#wp-2) | row 9 → L5 Writing | intake · generate · review | hard | uncertain (U4–U6) | the writer's task ("select and write to an excerpt") lands on the tool; a paired text we don't have | HP-2, HP-6, HP-3 |
| [WP-3](#wp-3) | row 25 → flex day | intake · generate · review | hard (one judgement) | uncertain (U7–U8) | no ID and **no standards**, though Newsela's flex days carry them | HP-3, HP-6 |
| [WP-4](#wp-4) | row 39 → L31 Writing | intake · generate · review | hard | uncertain (U9–U10) | a warning to the teacher hidden in the homework cell must block approval until a person reads it | HP-5 (or a new card) |
| [WP-5](#wp-5) | SYN-3 (row 10, cleaned) → L6 Reading | intake | easy | sure | nothing: the control case | — |

**Coverage of the core workflows.** Intake: WP-1…WP-5. Generation: WP-1…WP-4 (Reading, Writing, Flex Day). Review and
approval: WP-1…WP-4 (quote placeholders, an unverified text, an unconfirmed standard, a safety flag). Light mode asks
for 3 pairs; there are 5, because WP-3 turned out hard and an easy control (WP-5) was needed to see "nothing wrong".

**Change to the PRD's guess.** PRD §13 expected WP-3 to be *easy, sure*. The data says otherwise (see WP-3 and
[`README.md`](README.md), *One structural fact*). PRD §13 now points here.

---

<a id="wp-1"></a>
## WP-1 · row 8 → Lesson 4 (Core Reading → Reading)

`source: S-2 · sample: samples/issued-2026-10-24-row08-l04-core-reading.json · synthetic: no`
**Difficulty:** hard · **Confidence:** uncertain (U1–U3) · **Checked:** Innocent ✓ ____

### Input (the parts that matter, verbatim)

| Cell | Text |
|---|---|
| A Filename | `L4_ELA_TE_G6_U3_CA_Core` |
| C · D | `Lesson 4` · `Core Reading` |
| F Question | "How do Percy’s comments in the opening pages show his world values (and fears) about “normal” kids, and how might these opening pages be setting him up to become a hero or “problem” figure in a modern myth?" |
| G Description | "Chapter 1 / Focus: pp. 1–8 Teacher Read Aloud - modeling engaging fluency - think alouds" · "Students will cite evidence to make inferences and predictions about Percy and Percy's story…" · "Students analyze how the narrator's informal, sarcastic word choices shape the tone of the opening…" |
| I Homework | "Read and annotate The Lightning Thief Ch. 1 (pp. 9–15)" · "Read and annotate excerpt from the “The Hare and the Lion”" |
| J Focus | `RL.6.1, 6.2 L.6.4` |
| K Supporting | `RL.6.1, RL.6.2, RL.6.3, RL.6.4, RL.6.5, RL.6.6, RL.6.10, L.6.4, L.6.4.a, L.6.4.d, L.6.5, L.6.6` |
| M Performance task | "Identifying and explaining emerging themes" |
| N Foundational skills | Plan: "Teacher reviews determining/clarifying the meaning of words … demonstrating how to use context…"; "Students will add this week's vocabulary words to their Unit Vocabulary graphic organizers." Then a reviewer's note: "Context clues are not considered foundational skills. Instead, think about using morphology when teaching the vocabulary words" … "Introduce morphology tied to myth language: mort- (mortal, immortal), -ology (mythology), trans- (transform, transport)" … "If mort means death, what does immortal mean?" |
| O Vocabulary | envy (1), recognize (1), frayed (2), expelled (2), probation (3), threatened (3), spawn (4), detention (4), immortal (6), dyslexia (7) · "10 vocabulary words are taught, which is a lot for depth vocabulary words" |
| P ELD | "ELD.PI.6.7 – Analyze how language creates meaning" · "ELD.PI.6.6 – Justify interpretations with evidence" · "ELD.PII.6.5 – Use transitions to connect ideas" |
| Context | Row 7 (Investigation 1 header): students "1) cite evidence 2) explain tone 3) compare…". Row 9 O: "Across Investigation 1: Cap at 6 words per lesson." |

### Required output

**A. Normalized row and validation report (intake, exact)**

```
id            G6.U4.L4                  ← from "Lesson #"; unit U4 (AD-9). Filename kept as written, not trusted
type          Reading                   ← "Core Reading" (AD-5)
template      Launch 5 · Literacy Lab 10 · Learning in Action 30 · Look Back 5 · Homework 0
reading       The Lightning Thief, Ch. 1, pp. 1–8 (teacher read-aloud)
focus         as written "RL.6.1, 6.2 L.6.4"
              → RL.6.1 · RL.6.2 (proposed fix) · L.6.4 → L.6.4.b [AI-proposed, see U1]
supporting    RL.6.3–RL.6.6, RL.6.10, L.6.4.a, L.6.4.d, L.6.6; parents L.6.4, L.6.5 kept and flagged
              (RL.6.1 and RL.6.2 are also listed: focus wins)
eld           ELD.PI.6.7   sheet "Analyze how language creates meaning"  · official PI.7 Evaluating language choices · fits
              ELD.PI.6.6   sheet "Justify interpretations with evidence" · official PI.6 Reading/viewing closely · sub-part 6b [AI-proposed]
              ELD.PII.6.5  sheet "Use transitions to connect ideas"      · official PII.5 Modifying to add details · MISMATCH
                           suggested re-map PII.6.2b (Understanding cohesion); the code stays unless the designer re-maps it (DIR-5)
              each code is expanded to its three tiers: .Em · .Ex · .Br
vocabulary    10 words with page numbers
cell split    N content:     context-clue review; add words to Unit Vocabulary organizers
              N editor_note: "Instead, think about using morphology…" + roots mort-, -ology, trans- + the word-building question
              O editor_note: "10 vocabulary words … is a lot"
homework      Ch. 1 pp. 9–15 · "The Hare and the Lion" excerpt → linked to row 9's writer task (not chosen yet)
```

| Report line | Level | Shown to the author | Must act? |
|---|---|---|---|
| `6.2` has no strand prefix | **error** | original cell, proposed fix `RL.6.2, L.6.4` | yes: confirm or edit (Generate stays off until then, R-5) |
| `L.6.4` in focus is a parent | warning | proposed leaf `L.6.4.b` and why (the editor note) | confirm or pick another leaf |
| `L.6.4`, `L.6.5` in supporting are parents | warning | listed | no |
| `ELD.PII.6.5` label belongs to another strand | warning | sheet label beside official text, suggested `PII.6.2b` | keep or re-map (logged) |
| 10 words, over the Investigation 1 cap of 6 | warning | proposed split 6 + 4 (below) | confirm |
| Editor notes in N and O | warning | each note, with "apply / show to reviewer only / ignore" | choose |
| Homework names a text not chosen yet | warning | link to row 9 | no |
| Filename says U3 | info | points to the one unit-level error (A1 says U4) | confirmed once per unit |

**B. The lesson draft (generation)**

| Field | Required content | Why |
|---|---|---|
| `title` | "Lesson 4: The Lightning Thief, Chapter 1" | Lesson # + novel + G's title line |
| `type` · minutes | `Reading` · `[50, 50]` | template |
| Focus standards | `RL.6.1`, `RL.6.2`, `L.6.4.b` **[AI-proposed]**, each with official CDE text | J after the fix; U1 |
| Supporting | the confirmed K list minus focus codes | K |
| ELD standards | `ELD.PI.6.7.{Em,Ex,Br}`, `ELD.PI.6.6b.{Em,Ex,Br}` **[AI-proposed sub-part]**, `ELD.PII.6.5.{Em,Ex,Br}` + advisory | P, DIR-5 |
| Objectives (teacher) | **Content:** "Students will cite evidence from Percy's first-person narration in Chapter 1, pp. 1–8, to make inferences and predictions about him and his story." **Language:** "Students will explain how the narrator's informal, sarcastic word choices shape the tone of the opening." **Foundational Skills:** "Students will use the root *mort-* to work out the meaning of *mortal* and *immortal*." | G bullets; N note |
| Objectives (student) | the same three, without "Students will" | `04` §3c |
| Essential question | "How do myths reflect cultural values?" | Investigation 1's EQ ([`02` §4](../source/02-sample-unit-outline.md)) |
| Connections | Knowledge-Building (Spark L1–L3 on what myths are) · Enduring Understanding · Future Lessons (L5 compares Percy with Soongoora) · Unit Performance Task ("Identifying and explaining emerging themes" → the essay "Shared Stories, Shared Lessons") | rows 4–6, 9, M, `02` §4 |
| Routines | Think-Pair-Share · Teacher Read Aloud with think-alouds · Introduce New Words Using Morphemes · Pulse Check · Quick Write | G, N; routine names from `04` |
| Materials | *The Lightning Thief* · Unit 4 Lesson 4 Student Edition · Unit Vocabulary graphic organizer | G, N |
| Vocabulary | **Addressed in Lesson (6):** immortal, expelled, probation, threatened, frayed, envy. **For Additional Support (4):** recognize, spawn, detention, dyslexia. Page numbers kept | O, the cap; U2 |
| Anchor text card | Novel · *The Lightning Thief* · Rick Riordan · `off-platform-text` · ISBN 9780786838653 | A1 |

| Section (address) | Min | What it does | Typed blocks that must be there |
|---|---|---|---|
| Launch `G6.U4.L4.Launch` | 5 | Think-Pair-Share on how a storyteller's sarcastic voice changes how you hear a story; "Connection to Today's Learning" | `routine` · `ask` + `sample_response` · `say` |
| Literacy Lab `…LiteracyLab` | 10 | Morphology: *mort-* (mortal, immortal), *-ology* (mythology), *trans-* (transform, transport); add the words to the organizer | `routine` "Introduce New Words Using Morphemes" · `cfu_item` (below) · `eld_support` · `support_table` |
| Learning in Action `…LearningInAction.PartA` | 15 | "Percy's Voice" (RL.6.1, RL.6.4): read-aloud of pp. 1–8 with think-alouds; a three-column chart (what Percy says · what I infer · what I predict); context clues while reading (L.6.4.a, the note's "during reading" suggestion) | `say`/`ask` · **`text_evidence_needed`**: "Reviewer to insert: one sentence from Ch. 1, pp. 1–8, where Percy's sarcastic word choice sets the tone" · `eld_support` · `support_table` |
| Learning in Action `…LearningInAction.PartB` | 15 | "Hero or Problem?" (RL.6.2): what idea the opening starts to build; a claim with evidence from the chart | `cfu_item` Pulse Check tagged `RL.6.2` (stem from F; 4 options; one key; a rationale per option) · `eld_support` · `support_table` |
| Look Back `…LookBack` | 5 | Quick Write on F's question, starter "Percy's comments show that his world sees 'normal' kids as ___, because ___." | `routine` Quick Write tagged `RL.6.1` · `sample_response` (paraphrase, no quote) |
| Homework `…Homework` | 0 | Read and annotate Ch. 1 pp. 9–15; read and annotate the excerpt from "The Hare and the Lion" | the excerpt is a **link to L5's excerpt slot**, not a text |

The Literacy Lab check, in full (it needs no novel facts, so it can be pinned exactly):

```
cfu_item  tag L.6.4.b   stem "If mort means death, what does immortal mean?"
  A  able to live forever      KEY  — im- means "not", so immortal means "not able to die"
  B  very old                       — the root is about death, not age
  C  afraid of dying                — nothing in the word means fear
  D  dead for a long time           — im- turns the meaning around: not dying
```

**Alignment map** (R-20): `RL.6.1` taught Part A, checked Look Back (asserted by: outline) · `RL.6.2` taught Part B,
checked Part B Pulse Check (outline, code fixed by the author) · `L.6.4.b` taught Literacy Lab, checked its
`cfu_item` (generator, from the editor note: **confirm**).

**Rule for every option and rationale in Part B:** it may use what the sheet says about the chapter (first-person
narration, sarcastic word choice, "normal" kids, hero or problem figure). It may not state any other plot fact. A
distractor that needs a fact about the novel to be wrong is replaced (HP-2).

**C. What the reviewer sees on version 1**

| Issue | Level | Where | Clears when |
|---|---|---|---|
| Quote placeholder open | **blocking** | `G6.U4.L4.LearningInAction.PartA` | a named reviewer inserts a sentence from a class copy with rights `short-quote-commentary` (a recorded resolution, R-34) |
| Homework text not chosen | **blocking** | `G6.U4.L4.Homework` | L5's excerpt is inserted (the link resolves) or a named resolution |
| `ELD.PII.6.5` label mismatch | advisory | front matter | — |
| `L.6.4.b` asserted by the generator (`origin: narrowed`) | **blocking** confirmation (changed at §3, [HP-3](../design/hard-problems.md#hp-3)) | alignment map | a named reviewer confirms or removes it |

Approve is disabled with those three reasons (the confirmation is not counted as a check failure in V-1, HP-3). Two placeholders is the PRD's ceiling per lesson (V-3: ≤ 2).

### Gap: what it took to get from input to output

1. **A human must fix a code** before anything is generated. The parser can propose `RL.6.2`, but `6.2` alone could
   also be `RI.6.2` or `W.6.2`; only the author knows.
2. **A reviewer's note changes what the lesson teaches.** N's plan says context clues (`L.6.4.a`); its note says
   "instead … morphology" (`L.6.4.b`). Both are leaves of the focus code `L.6.4`. The cell's plan and its note disagree.
3. **A rule written on another row** (row 9's 6-word cap) applies here.
4. **Two bullets become ~3,300 words** of teacher script (the published median, PRD §4): every Say, Ask, sample answer,
   check and support is invented teaching. None of it may be invented *text*.
5. **Every quote from the novel becomes a placeholder**, and the homework points at a text another lesson must choose.

### Uncertain: Innocent to check

- **U1. Which leaf of `L.6.4`?** *Recommended:* follow the editor note (`L.6.4.b`, morphology in the Literacy Lab),
  with context clues kept inside Part A as supporting `L.6.4.a`. *Alternative:* follow the cell's own plan (`L.6.4.a`).
  Same question for the ELD sub-part: `PI.6.6b` fits the sheet's label; `PI.6.6c` (morphology) fits the activity.
- **U2. Which 6 words are taught in depth?** *Recommended:* the cap applies to "Vocabulary Addressed in Lesson"; the
  other 4 go to "Vocabulary for Additional Support", Newsela's second list. The pick of 6 is ours.
- **U3. May one lesson block another?** *Recommended:* yes. L4's homework stays blocked until L5's excerpt is chosen,
  so the pair is approved in order.

*Held-out note, not used above:* the published Lesson 4 lists focus `L.6.4.a, RL.6.4, RL.6.6`
([`02` §6](../source/02-sample-unit-outline.md)), which matches neither the sheet nor this pair. Newsela's reviewers
settle the standards. That is why every alignment link records who asserted it.

**Joins:** HP-6 (the code fix, the leaf, the ELD label) · HP-2 (quotes → placeholders) · HP-3 (an AI-proposed leaf as an
alignment link) · HP-1 (a link between two lessons is unit-level state).

---

<a id="wp-2"></a>
## WP-2 · row 9 → Lesson 5 (Core Writing → Writing)

`source: S-2 · sample: samples/issued-2026-10-24-row09-l05-core-writing.json · synthetic: no` (its injected twin is SYN-1)
**Difficulty:** hard · **Confidence:** uncertain (U4–U6) · **Checked:** Innocent ✓ ____

### Input (the parts that matter, verbatim)

| Cell | Text |
|---|---|
| C · D | `Lesson 5` · `Core Writing` |
| F Question | "What similar fears and values do both stories reveal?" |
| G Description | "Teacher reviews explanatory writing; models using clear topic sentences, relevant evidence, and a concluding statement." · "Focus: pp. 9–15" · students cite how Percy is treated as "trouble" and how adults deny his experience · cite "key moments from “The Hare and the Lion” (e.g., Soongoora’s lie about the honey, Simba’s challenge, and the hare’s escape plan)" · compare characters "at a power disadvantage" · "write a brief explanatory paragraph comparing how Percy and Soongoora respond when more powerful figures try to control or punish them, using a clear topic sentence, relevant evidence from both texts, appropriate transitions, and precise language." |
| H Text set | "A short, excerpt from “The Hare and the Lion” in Zanzibar Tales: Told by Natives of the East Coast of Africa, translated by George W. Bateman" · "WRITER MUST SLECT AND WRITE TO AN EXCERPT OF THE TEXT" |
| I Homework | "Read and annotate The Lightning Thief Ch. 2 (pp. 16–22)" |
| J Focus | `W.6.2` |
| K Supporting | `RL.6.1, RL.6.2, RL.6.3, RL.6.4, RL.6.9, RL.6.10, W.6.2, W.6.2.a, W.6.2.b, W.6.2.f, W.6.4, W.6.5, W.6.9, L.6.1, L.6.2, L.6.3, L.6.6` |
| N Foundational skills | "Morphology mini-lessons tied to the unit vocabulary. Word Study 2: decoding multisyllabic mythological names and terms" |
| O Vocabulary | "Across Investigation 1: • Cap at 6 words per lesson. • Identify 3 recurring roots across the investigation. • Add a “Word Families in This Unit” anchor." (no words for this row) |
| P ELD | "ELD.PI.6.10 – Write explanatory texts" · "ELD.PI.6.7 – Compare how ideas are developed across texts" · "ELD.PII.6.5 – Use cohesive language for comparison" |

### Required output

**A. Normalized row and validation report (intake, exact)**

```
id            G6.U4.L5 · type Writing ("Core Writing") · template 5 · 10 · 30 · 5 · Homework
reading       Ch. 1, pp. 9–15  (= L4's homework: the hand-forward check passes)
paired text   "The Hare and the Lion", Zanzibar Tales, trans. George W. Bateman · rights to-clear until verified (U6)
focus         W.6.2 (parent) → W.6.2.a · W.6.2.b · W.6.2.f [AI-proposed: the sub-parts K lists]
              advisory: G also teaches "appropriate transitions" (W.6.2.c) and "precise language" (W.6.2.d), listed nowhere
supporting    RL.6.1–RL.6.4, RL.6.9, RL.6.10, W.6.4, W.6.5, L.6.6; parents W.6.9, L.6.1, L.6.2, L.6.3 flagged
eld           ELD.PI.6.10  "Write explanatory texts" · official PI.10 Writing · sub-part 10a · fits
              ELD.PI.6.7   "Compare how ideas are developed across texts" · official PI.7 Evaluating language choices
                           · PARTIAL (comparing texts is PI.6a) · suggested re-map PI.6.6a
              ELD.PII.6.5  "Use cohesive language for comparison" · official PII.5 Modifying to add details · MISMATCH → PII.6.2b
cell split    H content:      the citation
              H writer_task:  select and write to an excerpt   (typo "SLECT" not carried)   → an excerpt slot
              O unit_rule:    Investigation 1 (rows 8–23): cap 6 words; 3 recurring roots; a "Word Families" anchor
vocabulary    none for this row (O holds a unit rule, not words)
homework      Ch. 2, pp. 16–22  (= row 10's focus pages: passes)
```

Report: **0 errors**; warnings: `W.6.2` leaves proposed · `W.6.2.c`/`.d` named but not listed · 4 parent codes ·
`PI.6.7` partial · `PII.6.5` mismatch · the writer task (confirm: it becomes an excerpt slot) · the unit rule (confirm:
it applies to 16 rows).

**B. The lesson draft (generation)**

| Field | Required content |
|---|---|
| `title` | "Lesson 5: Comparing Percy and Soongoora" (from G; the sheet gives no title line beyond "Chapter 1") |
| Focus | `W.6.2.a`, `W.6.2.b`, `W.6.2.f` **[AI-proposed]** with official text (U5) |
| Objectives (teacher) | **Content:** "Students will write an explanatory paragraph comparing how Percy and Soongoora respond when more powerful figures try to control or punish them." **Language:** "Students will use comparison transitions to connect evidence from two texts." **Foundational Skills:** "Students will decode multisyllabic mythological names by syllable." |
| Essential question | "How do myths reflect cultural values?" |
| Anchor text cards | Novel (as WP-1) · Short-Form Text: "The Hare and the Lion", from *Zanzibar Tales: Told by Natives of the East Coast of Africa*, trans. George W. Bateman · rights `to-clear` · `content_available: false` until chosen |
| Vocabulary lists | both present and **empty** (Newsela's Writing lessons mostly have empty lists, `04` §8) |

| Section | Min | What it does | Typed blocks that must be there |
|---|---|---|---|
| Launch | 5 | Turn and Talk: where were you told Percy is "trouble" in last night's pages? | `ask` + `sample_response` (paraphrase only) |
| Literacy Lab | 10 | Model an explanatory paragraph: topic sentence → evidence → explanation → concluding statement. The model is on a topic **outside the unit's texts**, so it can't leak invented text facts. Word Study 2 as a 2-minute move: syllable-split the names in today's tale (Soongoora, Simba) | `routine` · `cfu_item` tagged `W.6.2.a` ("Which is the strongest topic sentence for a paragraph comparing two characters?", 4 options, one key) · `eld_support` citing `ELD.PI.6.10a` · `support_table` |
| Learning in Action Part A | 12 | Read the excerpt; a two-text evidence chart (Percy · Soongoora · what each does when a stronger figure pushes) | **excerpt slot:** "Reviewer to insert: the passage of 'The Hare and the Lion' (Bateman translation) covering Soongoora's lie about the honey, Simba's challenge and the hare's escape plan" · `eld_support` · `support_table` |
| Learning in Action Part B | 18 | Write the paragraph; checklist (topic sentence, evidence from both texts, concluding statement) | checklist `cfu_item`s tagged `W.6.2.b`, `W.6.2.f` · I-ELD frames such as "Percy ___, whereas Soongoora ___." "Both stories show that ___." |
| Look Back | 5 | Quick Write on F | `routine` Quick Write |
| Homework | 0 | Read and annotate Ch. 2, pp. 16–22 | — |

**The grounding line for this pair:** the lesson may name the three moments G names (the honey lie, Simba's
challenge, the escape plan) because the outline states them. It may not add any other detail of a tale we were not
given: no quoted line, no extra plot step, no description of a character (GR-1).

**Alignment map:** `W.6.2.a` taught Literacy Lab, checked its `cfu_item` · `W.6.2.b` taught Part A, checked the Part B
checklist · `W.6.2.f` taught Literacy Lab, checked the checklist. All three: asserted by the generator as leaves of the
outline's `W.6.2`; **confirm**.

**C. What the reviewer sees on version 1**

| Issue | Level | Clears when |
|---|---|---|
| Excerpt slot open in Part A | **blocking** | a reviewer inserts the passage from a source they verified, with its URL; or, in Stretch, the allowlist supplies it with URL and hash (R-13) |
| Rights `to-clear` on the paired text | **blocking** (GR-3) | the reviewer records `public-domain` with the source |
| `PI.6.7` partial, `PII.6.5` mismatch | advisory | — |
| Leaves of `W.6.2` asserted by the generator (`origin: narrowed`) | **blocking** confirmation (changed at §3, [HP-3](../design/hard-problems.md#hp-3)) | a named reviewer confirms or removes each |

Inserting the excerpt here also clears WP-1's homework block.

### Gap

1. **The writer's whole job lands on the tool:** "select and write to an excerpt". We don't have the text, so the tool
   can only make a precise, cited slot; a person chooses the words.
2. **The plan names facts from a text we lack.** The tool may repeat them; it may not extend them.
3. **Two cells pull the Literacy Lab two ways.** G's first bullet is a writing model; N is word study. Newsela's
   framework puts a writing strategy in a Writing lesson's Literacy Lab (`04` §3b), so the writing model takes the 10
   minutes and the word study becomes a 2-minute move (U4).
4. **A note on this row is a rule for 16 rows** (O).

### Uncertain: Innocent to check

- **U4. What fills the Literacy Lab?** *Recommended:* G's writing model, with N's word study folded in as 2 minutes.
  *Alternative:* N's word study as the Literacy Lab, the writing model moved into Part B.
- **U5. Which leaves of `W.6.2`?** *Recommended:* `a`, `b`, `f` (K lists exactly these). Show `c` and `d` as an
  advisory "G teaches these; add?" rather than adding them silently.
- **U6. Who supplies the excerpt?** *Recommended for the MVP:* always a reviewer, with rights `to-clear` until they
  record the source. The public-domain allowlist (R-13) stays Stretch. We have not verified the Bateman translation's
  public-domain status, so the pair does not assume it.

**Joins:** HP-2 (an excerpt slot and the grounding line) · HP-6 (the writer-task and unit-rule splits, the leaves, ELD) ·
HP-3 (leaves asserted by the generator).

---

<a id="wp-3"></a>
## WP-3 · row 25 → the first flex day after Investigation 1

`source: S-2 · sample: samples/issued-2026-10-24-row25-flex-day.json · synthetic: no`
**Difficulty:** hard (one judgement) · **Confidence:** uncertain (U7–U8) · **Checked:** Innocent ✓ ____

### Input (the parts that matter, verbatim)

| Cell | Text |
|---|---|
| A · C | *(empty: no filename, no Lesson #)* |
| B · D | `Flex` · `End-of-Arc Flex Day` |
| F | `N/A` |
| G | "Meaning-Making Huddle" · "Revisit Chs. 1–12 of The Lightning Thief, supporting students' understanding of key ideas/events" · the bridge bullet **twice**, the first copy cut off ("…Based on • Help bridge students into Investigation 2 by asking questions, such as: "What questions emerged from the texts you've read? Based on what you've read so far, how do you feel retellings change across cultures and generations?"") · "Students should re-read two key events from the book and, in three rows of a a two-column graphic organizer, make specific notes on the left side about what occurrred, the emotions …, and the tone that the narrator uses … Then, they should watch film versions of these events from the 2010 firm version … answer the same questions about the film in the right hand column. Below the graphic organizer, students make notes contrasting what they “see” and “hear” when reading the text to what they perceive when they listen or watch." |
| J, K, P | *(empty: no standards of any kind)* |
| Context | Row 24 header: "Teachers may select to use a small group or whole group format based on formative data collection." |

### Required output

**A. Normalized row and validation report (intake, exact)**

```
id            G6.U4.FLEX-1a       ← first flex day after Investigation 1 (FE-2; no ID in the sheet)
row_kind      flex_day · arc End of Investigation 1 (context: row 24)
type          Flex Day · template Launch 5 · Learning in Action 40 · Look Back 5 · Homework (none given)
G             title "Meaning-Making Huddle"; the duplicated fragment removed; typos noted, not copied
              ("a a", "occurrred", "firm version" → film version)
texts         The Lightning Thief, Chs. 1–12 (students' own copies) · the 2010 film (clips chosen by the teacher)
standards     none in J, K or P
```

Report: **0 errors**; warnings: duplicated text in G (proposed clean text shown, author confirms) · **no standards in
the outline** (with the U7 choice).

**B. The lesson draft (generation)**

| Field | Required content |
|---|---|
| `title` | "Flex Day: Meaning-Making Huddle" (U8) |
| `type` · minutes | `Flex Day` · `[50, 50]` |
| Standards | per U7. *Recommended:* the generator proposes `RL.6.7` (G repeats RL.6.7's own wording: "contrasting what they 'see' and 'hear' when reading the text to what they perceive when they listen or watch") and `ELD.PI.6.1` (the huddle is a discussion), each labelled **proposed by generator, not in the outline** |
| Essential questions | both unit EQs: "How do myths reflect cultural values?" · "How do retellings change across cultures and generations?" (the day bridges the two investigations) |
| Materials | the novel · teacher-selected clips from the 2010 film · a two-column graphic organizer (text · film), three rows |

| Section | Min | What it does | Typed blocks |
|---|---|---|---|
| Launch | 5 | Turn and Talk on the bridge question "What questions emerged from the texts you've read?" | `ask` + `sample_response` |
| Learning in Action | 40 | The huddle, small group or whole class (the teacher decides from formative data): pick and re-read two key events from Chs. 1–12; fill the organizer's left column (what occurred, the characters' emotions, the narrator's tone, how they know); watch the film scenes for the same events and fill the right column; note what they "see" and "hear" differently | `teacher_note` (choosing the format) · `teacher_tip` (choose clips that match the events students pick; preview them) · `routine` graphic organizer · a check on see vs hear, tagged `RL.6.7` if confirmed |
| Look Back | 5 | Quick Write: "Based on what you've read so far, how do you feel retellings change across cultures and generations?" | `routine` Quick Write |
| Homework | — | none (the sheet gives none) | — |

**No quote placeholders are expected.** Students re-read their own copies and pick their own events, so the lesson
never needs a line of the novel.

**C. What the reviewer sees on version 1**

| Issue | Level | Clears when |
|---|---|---|
| Standards proposed by the generator (if U7 = recommended) | **blocking** | a named reviewer confirms or removes each |
| No standards in the outline | advisory | — |

With the standards confirmed, this is the unit's likely **first-pass clean** lesson: the demo's clean path (DIR-9).

### Gap

The lesson itself is mostly mapping: the cell already describes the activity step by step. The judgement is the
standards. All three published Unit 4 flex days carry 3 focus standards and ELD standards
([`README.md`](README.md), *One structural fact*), so a Newsela-shaped flex lesson needs codes the outline never gives.
The PRD's check "no code outside the row's lists" (R-19) would then block every flex lesson that has them.

### Uncertain: Innocent to check

- **U7. Standards for a row that names none.**
  - (a) Leave them empty, with an advisory. Follows the outline; unlike Newsela's format; the unit's standards map
    skips six days.
  - (b) **Recommended:** the generator may propose codes **only on rows whose outline lists none**, each labelled
    "proposed by generator" and **blocking Approve until a named reviewer confirms it**. Matches Newsela's format and
    keeps "no unconfirmed code outside the outline". R-19's wording changes to say so (decided at §4).
  - (c) The author adds codes on the validation report before Generate. Clean, but adds work at the busiest step.
- **U8. Title for a lesson with no number.** *Recommended:* "Flex Day: <G's title line>". The published site numbers
  flex days as lessons; the sheet does not, so we don't invent a number.

**Joins:** HP-3 (who may assert a standard) · HP-6 (rows without IDs or codes).

---

<a id="wp-4"></a>
## WP-4 · row 39 → Lesson 31 (Core Writing → Writing): the content warning

`source: S-2 · sample: samples/issued-2026-10-24-row39-l31-content-warning.json · synthetic: no`
**Difficulty:** hard · **Confidence:** uncertain (U9–U10) · **Checked:** Innocent ✓ ____

### Input (the parts that matter, verbatim)

| Cell | Text |
|---|---|
| C · D | `Lesson 31` · `Core Writing` |
| G | "Chapter 21" · "Teacher reviews recognizing/correcting vague pronouns" · "Focus: pp. 334–343" · compare how Ch. 21 and the Iliad excerpt portray the gods' home · "write an explanatory paragraph that compares the two descriptions…" |
| H | "Short, teacher-chosen excerpts from lines 488–611 of Book 1 of Homer's Iliad describing Olympus" |
| I Homework | "Read and annotate The Lightning Thief Ch. 21 (pp. 344–353)" · "**Warn students about potentially triggering scene in tonight's reading (references to domestic abuse)**" |
| J · K | `W.6.2` · `W.6.2.a–f, W.6.4, W.6.5, W.6.9, W.6.10, RL.6.1, RL.6.2, RL.6.4, RL.6.9, RL.6.9.a, RL.6.10, L.6.1, L.6.1.d, L.6.2, L.6.3, L.6.6` |
| N | "Students analyze how cohesive transitions (whereas, however, in contrast, similarly, as a result) clarify comparative reasoning…" |
| P | "ELD.PI.6.10 – Write explanatory text" · "ELD.PI.6.7 – Compare cultural portrayals" · "ELD.PII.6.5 – Maintain cohesion in comparisons" |

### Required output

**A. Normalized row and validation report (intake, exact)**

```
id            G6.U4.L31 · type Writing · template 5 · 10 · 30 · 5 · Homework
focus         W.6.2 → W.6.2.a · W.6.2.b · W.6.2.c [AI-proposed: comparison structure, details, transitions (N)]
supporting    W.6.2.a–f → 6 codes; RL.6.9.a → ERROR (does not exist; proposed fix: drop it, RL.6.9 is already listed);
              L.6.1.d (vague pronouns, matches G); parents W.6.9, L.6.1, L.6.2, L.6.3 flagged
eld           PI.6.10 → 10a fits · PI.6.7 "Compare cultural portrayals" PARTIAL (→ PI.6.6a) · PII.6.5 MISMATCH (→ PII.6.2b)
homework      item 1 → student homework: Ch. 21, pp. 344–353
              item 2 → safety_note (addressed to the teacher, not homework) → a safety flag on the lesson
paired text   Iliad Book 1, lines 488–611 · "teacher-chosen" · translation not named · rights to-clear
```

Report: **1 error** (`RL.6.9.a`); warnings: leaves proposed · parents · ELD ×2; **1 safety note** for the author to
confirm as a safety flag.

**B. The lesson draft (generation): the part this pair pins**

| Block | Required content |
|---|---|
| Homework, student-facing | "Read and annotate *The Lightning Thief* Chapter 21 (pp. 344–353)." |
| Homework `teacher_tip` (teacher edition only) | Says the pages include references to domestic abuse; tells the teacher to let students know before they read, that they can talk privately with the teacher or a counselor, and to follow the school's policy on alternatives. Wording is the model's; the content points are fixed |
| Never | a prompt that asks students to share their own experiences of the topic, in this lesson or the next (GR-12, R-22); the warning in the student edition |
| Safety flag | open on the lesson, linked to the tip, reason "content warning from the outline (row 39, Homework)" |
| Literacy Lab | N's cohesive transitions for comparison (`W.6.2.c`); G's vague-pronoun review becomes a revision step in Part B (`L.6.1.d`) |
| Learning in Action Part A | **excerpt slot:** "Reviewer to insert: lines from Iliad Book 1, 488–611, describing Olympus; name the translation" · rights `to-clear` |

**C. What the reviewer sees on version 1**

| Issue | Level | Clears when |
|---|---|---|
| Safety flag open | **blocking** (R-22) | a named reviewer reads the tip and clears the flag with a note |
| Excerpt slot open; rights `to-clear` | **blocking** | the reviewer inserts the lines and records the translation and its status |
| Leaves of `W.6.2` asserted by the generator (`narrowed`) | **blocking** confirmation (HP-3) | a named reviewer confirms or removes each |
| ELD partial / mismatch | advisory | — |

### Gap

A sentence written **to the teacher** sits in the **homework** column. Copied as written, it would land in the
students' homework list. The tool has to see that it is a warning, move it to a teacher-only tip, keep it out of the
student edition, keep personal-disclosure prompts out of the lessons, and stop the lesson being approved until a
person has read it. Separately, "teacher-chosen excerpts" leaves the text open, like WP-2.

### Uncertain: Innocent to check

- **U9. Who may clear a safety flag?** *Recommended:* any named reviewer, with a note, recorded in the audit log; the
  approver then sees "safety flag cleared by <name>" on the checklist. *Alternative:* only the approver may clear it.
- **U10. "Teacher-chosen" text: a slot for the reviewer, or left to the teacher?** *Recommended:* a reviewer slot, so the
  lesson is complete as approved (Newsela's published lessons name their excerpts as text cards, `04` §5).
  *Alternative:* a `teacher_tip` with the line range, no slot, no block.

**Joins:** HP-5 (approval integrity: a flag that blocks Approve), or its own card at §3 (content sensitivity) · HP-2.

---

<a id="wp-5"></a>
## WP-5 · SYN-3 (row 10, every known defect removed) → Lesson 6, intake only

`source: S-2 (mutated) · sample: samples/synthetic-2026-10-24-syn3-clean-control-row10.json · synthetic: yes`
**Assumption:** a row a designer has already corrected looks like this; every issued row has at least one defect.
**Difficulty:** easy · **Confidence:** sure · **Checked:** not needed (sure)

### Input (the cells changed from row 10)

Filename `L6_ELA_TE_G6_U4_CA_Core` · focus `RL.6.1` · supporting `RL.6.1, RL.6.2, RL.6.3, RL.6.4, RL.6.5, RL.6.6,
RL.6.10, L.6.4.c, L.6.6` · N "Morphology mini-lessons tied to the unit vocabulary." · six vocabulary words with pages ·
ELD `ELD.PI.6.6b`, `ELD.PI.6.7`, `ELD.PII.6.2b`, each labelled with its own strand.

### Required output (intake, exact)

```
id            G6.U4.L6 · type Reading · template 5 · 10 · 30 · 5 · Homework
focus         RL.6.1                                            OK
supporting    8 codes (RL.6.1 sits in focus), all leaves or codes without sub-parts  OK
eld           ELD.PI.6.6b.{Em,Ex,Br} · ELD.PI.6.7.{Em,Ex,Br} · ELD.PII.6.2b.{Em,Ex,Br}   OK (labels match strands)
vocabulary    6 words, at the cap                               OK
cell split    no writer tasks, no editor notes                  OK
homework      Ch. 2, pp. 23–28                                  OK
report        OK · 0 errors · 0 warnings · Generate enabled for this row
```

### Gap

None: copy and map. **Why it is here:** it is the false-alarm check. If the validator flags anything on this row, the
validator is wrong.

---

## What the pairs changed or confirmed

| Finding | Effect | Where it goes |
|---|---|---|
| Published flex days carry standards; the sheet's don't | WP-3 is hard, not easy; R-19's "no code outside the row's lists" needs a rule for rows with none | §3 HP-3; R-19 wording at §4 |
| An editor's note can decide which standard a lesson teaches | Notes need "apply / show / ignore" on the validation report | §3 HP-6 |
| A cell can carry a rule for many rows (row 9 O) | Unit-level rules are a type of their own | §3 HP-6 |
| One lesson's homework can depend on another lesson's text choice | Cross-lesson links are unit-level state | §3 HP-1 |
| A warning to the teacher can hide in a student-facing column | Cell classification includes `safety_note` | §3 HP-5 or a new card |
| The sheet names plot facts of texts we don't have | The grounding line: repeat the outline's facts, add none | §3 HP-2 |
