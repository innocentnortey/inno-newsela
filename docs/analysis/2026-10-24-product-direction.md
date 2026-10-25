# Newsela Lesson Studio: product direction

**Summary**

1. **The brief asks for a lesson generator, but the slow, costly step is review.** Newsela already writes lessons with freelancers and AI. What stays slow is a few staff designers proving that each draft meets California's bar, and then re-keying it into Newsela's system.
2. **Our primary user is the Newsela content reviewer** (a Learning Experience Designer who "own[s] the review of contributor- and AI-generated lessons"). The outline author, the approver, and the teachers, districts and state reviewers downstream come next.
3. **We found 19 friction points (F-1…F-19).** The worst five are a dirty outline, invented quotes, "aligned" that nobody can prove, rubber-stamp approval, and evidence maps built by hand.
4. **The product direction: "the system may only say what it can show."** A fixed pipeline turns one messy outline into draft lessons in Newsela's own ProseMirror schema. Every claim in a draft is either checked by code or visibly flagged for a person, and people approve one version at a time on the evidence.
5. **43 features (FE-1…FE-43) in ten groups.** 34 are MVP: the audit's slice (AD-1) plus three cheap moves (arc checks, a minimal evidence pane, a coverage matrix). 4 are Stretch and 5 are Roadmap. A traceability matrix closes the document.
6. **The MVP is one unit end to end:** the issued Grade 6 Unit 4 sheet, 47 teaching days generated in batch, 3 generated live in the demo. It is measured honestly against the success measure the audit proposed: reviewer minutes per approved lesson.

**Written:** 2026-10-24 (America/Chicago). **Deadline:** Tue 2026-10-27 03:00 CT, about 2.5 days away.
**Rank:** DERIVED from the ISSUED brief, the audit and the company research; its decisions are PROPOSED inputs to the
PRD (`docs/prd/newsela-prd.md`, not yet written). **Nothing here has been sent to Newsela.**
**Owner of:** friction IDs `F-n`, feature IDs `FE-n`, direction decisions `DIR-n`. It cites the audit's `T-n`
(traps), `AR-n` (audit requirements), `AD-n` (audit decisions) and `AQ-n` (questions for Newsela), plus the part IDs
`L-n` (legal), `E-n` (ethical) and `N-n` (engineering), without renumbering them.

**Labels.** **[F]** = a cited file says it. **[I]** = our inference. **[A]** = an assumption we chose and would check.
Each number is marked as a *measurement*, *calculation*, *assumption* or *target*. Each decision says either
**"recommendation, pre-approved by Innocent 2026-10-24"** or **"assumption"**. The pre-approval is Innocent's
2026-10-24 instruction to take the recommended option for any open question; it covers the calls made here.

**Short names for sources.**

| Short name | File |
|---|---|
| [Brief] | `docs/source/01-project-brief.md` (ISSUED; it wins every disagreement) |
| [Sheet] | `docs/source/02-sample-unit-outline.md` |
| [Struct] | `docs/source/04-lesson-structure-analysis.md` |
| [Stds] | `docs/source/05-standards-referenced.md` |
| [Reg] | `docs/source/source-register.md` |
| [Audit] | `docs/analysis/2026-10-24-brief-audit.md` |
| [Profile] | `docs/analysis/2026-10-24-newsela-company-profile.md` |
| [CA], [Biz], [Site], [Sent] | `docs/analysis/company-research/2026-10-24-{california-core-market, business-and-customers, website-features-and-value-map, reviews-and-sentiment}.md` |

**Data boundary.** This document quotes no restricted material. It describes Newsela's lessons only through the
tracked structural analysis in [Struct]. The captured lessons, PDFs and raw sheet exports stay in
`docs/source/restricted/` (git-ignored; AD-4, AR-28). Their only mention here is that path.

---

## 1. Why Newsela gave this brief to an applied AI engineer

### The story, in plain words

**Where Newsela is.** [F] Newsela built *Threads & Themes*, a full-year core English (ELA) and English Language
Development (ELD) program for California grades 6–8. Its content was frozen on **2026-05-15**, when complete
programs were delivered to the state. State review panels recommended both versions for adoption in summer 2026.
The State Board votes on **2026-11-12/13** [Profile §6; CA §2]. The program is 4 units of about 45 lessons per
grade, so 180 days [Struct; Profile §6]. **So the program the brief describes already exists and is locked.**

**How they made it.** [F] Freelancers and AI drafts, under staff review. A 2026 *Learning Experience Designer, Core*
posting says the designer will "Own the review of contributor- and AI-generated lessons, activities, and assessments at
your grade". It also says the designer will "Hold final grade-level responsibility for verifying that all materials
align to the relevant state ELA standards", and refine "AI prompts and specifications that power lesson production"
[Profile §3, §7 item 5; Site §5.1]. The issued sample outline is that program's own Grade 6 Unit 4, in an earlier
draft. Newsela's team then restructured it (41 lessons became 45) and redid its standards by hand [Sheet §6].

**What comes next.** [F] Grades 9–12 are "coming 2027" [Profile §6]. The Core marketing role plans "state-level
adoptions" [Site §5.1]. After the Board votes, a 60-day edits-and-corrections package is due, and a fee-based
revision follows about every two years [CA §2–3]. Each grade band needs about 180 ELA lessons plus a parallel
designated-ELD course. **[A]** That is 1,000+ teacher-edition lessons per program [CA §4]. **[I]** Each new program
needs the same production line, run faster and cheaper, on someone else's adoption calendar.

**What the line is made of.** [F] Newsela's lessons are JSON records. Their rich-text fields are **ProseMirror
documents** with three custom nodes: `routine_heading`, `callout` and `collapsible`. Every lesson is written twice,
as a teacher edition (a script with *Say:* / *Ask:* and sample answers) and a student edition [Struct §1, §3c]. **So
"output" means their schema, not a Word document.** That is why the brief can say content may live "separate of the
visual template" [Brief].

**How the state judges the line.** [F] California reviewers do not read a year of lessons cover to cover. They grade
**evidence the publisher writes**. That evidence is an Evaluation Criteria Map (134 pages for Program Type 2) and one
Standards Map per grade, with ELD rows for each proficiency level. Both cite lessons by address, for example
"G6.U3.L18: Learning in Action, Part B". Their corrections are word-level, for example a syllable split in G7.U2.L9
[CA §3; Profile §6].

**[I] Put together:** writing a draft is no longer the expensive part. The expensive part is a thin staff proving
each draft: every standard taught, every quote real, every text cleared, every ELD support at grade level. Then the
draft still has to be re-keyed ("tons of lesson documents we need to review/revise and then import") [Brief]. The
audit's why-chain ends in the same place: *drafts arrive without the evidence that proves them, so reviewers rebuild
it by hand* [Audit §2].

### Why an applied AI engineer, and what they are really testing

The role on the brief is "Principal Product Engineer/Member of Technical Staff" [F, Brief]. No matching public
posting was found [F, Profile §10.4]. **[I]** The brief is small on purpose, and every cohort member gets the same
text. What it really tests is judgement in five areas, each signalled by a line in the brief:

| What they are testing [I] | The brief's signal [F] | What a weak submission does [I] | What we do |
|---|---|---|---|
| **Orchestrating long generation jobs** | "a few minutes per lesson is ok"; "view the generation in process"; "Vercel or Railway … feel free" | Puts the run in one API request. At 47 lessons × ~3 min (*assumption*), that is ~2 hours serially (*calculation*, N-12), so the run dies mid-unit | A durable Postgres queue in a separate worker, idempotent per-lesson jobs, partial failure as a normal state, a spend cap enforced in code (FE-14, FE-15) |
| **Grounding and verification** | "aligned to teach the CA Core ELA/ELD standards"; "referencing text/novel"; "OK to improvise" | Copies the codes into the header and calls the lesson aligned, and lets the model "quote" a copyrighted novel it half-remembers | Codes resolve against official CDE text, each focus standard is mapped to an activity and a check, quotes only from supplied text, typed placeholders everywhere else (FE-3, FE-10, FE-16, FE-17) |
| **Human-in-the-loop UX** | "review, edit/update … and then mark the content as approve/finalized"; "Thoughtful design and easy to … navigate workflow" | An Approve button, or "approve all 40" | Evidence beside the content, blocking issues that disable Approve, one lesson and one pinned version at a time (FE-22, FE-25, FE-26) |
| **Collaborative editing** | "ProseMirror and Yjs for the frontend/collaborative editor"; "staff of 20+ reviewers" | Saves an HTML blob, or rents a hosted Yjs service that then holds unadopted curriculum | Their node schema in ProseMirror, one authenticated Hocuspocus server persisting to our Postgres, AI edits as attributed suggestions (FE-21, FE-23) |
| **Judgement about traps** | A dirty sheet; "40 weeks … ~40 lessons"; "feel free to crawl"; a misfiled "Off-Limits Tech" field | Builds to the brief's literal words | Shows the sheet's defects before money is spent, takes the unit size from the outline, keeps crawled content out of the repo, names every cut (T-1…T-26) |

### What would impress a Principal Product Engineer or MTS reader [I]

- **Naming the real bottleneck before they do.** "You asked for a generator; your constraint is reviewer minutes per
  approved lesson" (AD-19). We then show that number, measured, with a guard against gaming it.
- **Output in their schema, from day one.** A reviewer could open a lesson we generated in their own editor,
  because it uses their node types and field names [Struct §9].
- **Product sense about evidence.** Every lesson part gets an address like `G6.U4.L5.LearningInAction.PartA` with its
  standards tagged. The standards map a state reviewer grades then falls out as a by-product (FE-32, FE-33).
- **Restraint.** A fixed pipeline, not an autonomous agent (AD-7). The model gets the one open-ended job, authoring
  inside a lesson step; code does the rest (GP-4, GP-72).
- **Honest numbers.** The full issued unit is run before recording. The demo shows wall time, cost, failures,
  placeholders left and one caught error, on a lesson picked at random (AR-31).
- **Clean seams.** Intake, planning, generation, checks, review and export are separate modules with typed contracts.
  The Zod schema is the single contract (AD-12).

---

## 2. The target customer and users

**[I] Who pays and who uses are different people.** Newsela is the customer. Its content staff are the users. The
people who decide whether the program sells (districts and the state) never touch our tool, but they judge what it
produces. Teachers and students get the result. **Our tool is staff-side only. No student or teacher data enters it**
(AR-37).

The roles in the product are **author** (runs intake and generation), **reviewer** (edits and requests changes) and
**approver** (approves). They map onto the first three personas below (AD-11).

### P-1 · Content reviewer / Learning Experience Designer (primary user)

| | |
|---|---|
| **Who** | [F] A grade-level Learning Experience Designer (LXD) on Newsela's content team, one of the brief's "20+ reviewers". The posting: "Own the review of contributor- and AI-generated lessons, activities, and assessments at your grade" [Site §5.1; Profile §3]. Pay signal about $60–70K (*aggregator*) [Profile §3]. |
| **Goal** | Get a unit of lessons to "approved" without lowering the bar, and be able to say *why* each one passes. |
| **A day in their work** [I] | Opens the unit queue. Starts with the lessons that have blocking issues: a quote nobody can source, a focus standard with no activity that teaches it. Reads each lesson's 5/10/30/5 sequence beside its outline row and the official standard text. Fixes a sample answer, rejects an AI rewrite that changed the task, inserts a real quote from the class copy of the novel and marks its rights status, then submits. Today that evidence lives in their head and in comment threads. Nothing records which checks were done. |
| **What "done" means** | Every blocking issue in the lesson is cleared, by a fix or by a named resolution. The lesson reads like a Newsela lesson. The reviewer would defend it in front of a state reviewer. |
| **Pressure** [F] | Thin, anxious team: layoffs in 2022 and 2023, freelance leveling "basically stopped" in 2024 [Sent friction 8; Profile §7]. **[I]** The tool must make one reviewer much more productive and visibly in charge, never read as "AI replaces you". |

### P-2 · Instructional designer (outline author)

| | |
|---|---|
| **Who** | [F] "the instructional design our experts create prior to the AI generating" [Brief]. They wrote the 16-column sheet: arc, lesson type, pages, paired text, focus and supporting standards, vocabulary, the Foundational Skills mini-lesson and ELD targets [Sheet §3]. |
| **Goal** | Have their design turned into lessons faithfully, so the generator does not quietly rewrite their intent. |
| **A day in their work** [I] | Drafts a unit outline in a spreadsheet, often leaving notes to writers and to each other inside cells ("WRITER MUST SLECT AND WRITE TO AN EXCERPT OF THE TEXT"; "Cap at 6 words per lesson") [Sheet §5 items 12–14]. Uploads it. Today they would learn about a malformed code only when a reviewer finds it weeks later. |
| **What "done" means** | The outline is confirmed clean (or its known defects accepted), and every row has become a lesson that follows the row. |

### P-3 · Content lead / approver

| | |
|---|---|
| **Who** | [I] A senior LXD or grade-level lead, the person with "final grade-level responsibility for verifying that all materials align" [F, Site §5.1], or a Content Operations lead [F, Profile §7]. In our product: the approver role, which by default must be a different person from the lesson's last editor (AD-11). |
| **Goal** | Ship a unit on the calendar and know the review process was real, not theatre. |
| **A day in their work** [I] | Checks the unit board: 38 approved, 6 in review, 3 failed generation. Opens a lesson at "awaiting approval" and reads the checklist and its evidence links. Approves this version or sends it back with a reason. Looks at unit health (median review minutes, blocking issues found, AI-assist accept rate) to decide whether the process is healthy, never to rank people (E-4). |
| **What "done" means** | Every lesson in the unit is approved on a pinned version. The unit has an export and a provenance record that could answer a state or district question. |

### P-4 · Teacher (downstream, never a user)

| | |
|---|---|
| **Who** | [F] A California middle-school ELA teacher in an adopting district who follows the program every day: "what I teach tomorrow, in order" [Profile §3]. |
| **Goal** | A coherent 50-minute lesson with a script, real supports for English learners and checks that actually measure reading. |
| **What they say** [F] | Praise: "it adjusts the reading level for the same article…". Doubts: "threw some CommonLit and NewsELA articles … together and called it curriculum"; quizzes "[n]one of these seem to be accurately or effectively measuring 8th grade reading comprehension" [Profile §4]. |
| **What "done" means to them** [I] | Lesson 12 builds on lesson 11. The day's quiz has one defensible answer. The English learner support keeps the same text and task. |

### P-5 · District adoption committee and curriculum director (downstream buyer)

| | |
|---|---|
| **Who** | [F] Committees that are mostly classroom teachers (Ed Code §60210), led by a district ELA or English-learner director. Since AB 1454, a district using non-adopted materials "shall certify" alignment. Core deals are large: Orange Unified approved $3.68M for K–6 ELA [Profile §3]. |
| **Goal** | Pick a program they can certify and defend at a Williams hearing (the annual board hearing on whether every pupil has sufficient standards-aligned materials) [Profile §6]. |
| **What "done" means to them** [I] | A standards map they can sign, with each citation pointing at a lesson part they can open. |

### P-6 · State reviewer (gatekeeper)

| | |
|---|---|
| **Who** | [F] Panel reviewers (instructional materials reviewers, IMRs), content review experts (CREs), the Instructional Quality Commission (IQC) and the State Board (SBE) [Profile §3]. |
| **Goal** | Check that every criterion and standard is met, with citations, accurate terms and word-level correctness [CA §3]. |
| **What "done" means to them** | Category 1 (content and standards alignment) is fully met, because it is the gate [F, CA §2]. |

**Affected but not a user: freelance contributors.** [F] Newsela's contributor groups include **Units**, Standards,
Quizzes and Leveling [Profile §3]. The brief would "supplant the manual lesson writing step" [Brief]. **[I]** Some
freelancers become reviewers. Our copy frames the tool as expert-driven, and the record credits human work (T-24, FE-27).

---

## 3. Friction points

**How to read the table.** Each row is something that costs a persona time, quality or trust today, or would once
bulk generation starts. *Evidence* cites the file and ID. *Frequency / severity* uses the audit's severity where one
exists. *Root cause* is the part a feature can change.

| ID | Friction | Who feels it | Evidence | How often / how severe | Root cause |
|---|---|---|---|---|---|
| **F-1** | **The outline is dirty, and a happy-path parser makes it worse.** The unit number disagrees with itself (A1 says `G6, U4`, every filename `G6_U3`). There is a malformed code (`RL.6.1, 6.2 L.6.4`), a non-existent one (`RL.6.9.a`), ranges (`W.6.2.a–f`) and two pasted-together filenames. Flex days have no ID, arc headers are mixed into lesson rows, and the sheet has 47 days, not "~40". | P-2, then P-1 | [Sheet §5 items 1–11]; [Stds] summary items 1–7; T-5, N-8 | **Every unit** [I]: outlines are typed by hand. High: one dropped code makes every later check pass against the wrong list (T-5) | A planning spreadsheet doubles as a machine spec, with no validation between them |
| **F-2** | **Instructions to humans hide inside content cells.** Writer tasks ("WRITER MUST SLECT AND WRITE TO AN EXCERPT"), reviewer notes ("Context clues are not considered foundational skills…") and cross-row rules ("Cap at 6 words per lesson", which rows 10–41 then break) | P-2, P-1 | [Sheet §5 items 12–14]; N-7, N-15 | 5 writer-task rows; notes in columns N and O across the unit (*measurement*, [Sheet]). Medium-high: a generator either obeys a note meant for a colleague or drops a real constraint | The sheet is also the team's comment thread. Notes, tasks and content are not typed apart |
| **F-3** | **Invented quotes and page numbers, and copyright on anchor texts.** No source texts are supplied. *The Lightning Thief* is in copyright. The model fills the gap from memory | P-1 (must catch it); P-6 (accuracy); Newsela (legal) | T-1 (L-1, L-2, E-1, N-6); [Sheet §4] (ISBN 9780786838653); [Struct §5]: lessons quote one sentence at a time; [Sent] friction 6: "…is not present in the original Washington Post article" | **Critical** (T-1). Every Reading and Writing lesson quotes text; 37 homework page references in 50 published lessons (*measurement*, [Struct §5]) | The model has no text to ground in, and nothing separates "cite the book" from "reproduce the book" |
| **F-4** | **"Aligned" cannot be proven.** Codes sit in the lesson header and are not mapped to the activity that teaches them or the task that checks them. The outline uses parent codes (`L.6.4`), but published lessons cite only leaves (`L.6.4.a`) and ELD tiers (`.Em/.Ex/.Br`). Newsela redid the standards by hand anyway (sheet L4 `RL.6.1, 6.2 L.6.4` → published `L.6.4.a, RL.6.4, RL.6.6`) | P-1 (holds "final grade-level responsibility"), P-5, P-6 | T-2 (N-5, E-2, L-8); [Struct §4]; [Stds] items 4–5; [Sheet §6]; [Site §5.1] | **Critical** (T-2). Every lesson; Category 1 is the adoption gate [CA §2] | Standards are a list of names, not a map. No check exists, and no record says who asserted the alignment |
| **F-5** | **Review fatigue and rubber-stamping at volume.** About 160 lessons per program in the brief's words, 1,000+ teacher-edition lessons per 6–8 program (*assumption*), 50+ per reviewer at 20 reviewers (*calculation*). An Approve button with no evidence invites "approve all" | P-1, P-3 | T-3, E-3 (a 2,784-person experiment: people accept more wrong AI suggestions when correcting takes more effort); E-4; [Audit §4]; [Sent] friction 8 | **Critical** (T-3). Grows with every program | Generation is now cheap and judgement is not. Approval is a flag, not a decision made on evidence |
| **F-6** | **The unit arc drifts.** Lessons generated alone each open with the same warm-up, ignore yesterday's homework (L3's homework is the text L4 reads aloud) and lose the performance-task thread | P-1, P-4 | N-11, E-5, T-19; [Sheet §4] arc table; [Sent] friction 2 | High (T-19). Invisible in single-lesson review | Each lesson is generated without a shared unit plan, and no check looks across lessons |
| **F-7** | **Format fidelity.** Newsela's lessons have typed front matter, timed sections by lesson type (5/10/30/5; Spark 15/30/5; Flex 5/40/5), named routines, three-callout ELD boxes, support tables, colour that carries meaning (teal = teacher talk, purple = sample answer), and two editions | P-1 (re-keying), Content Ops | [Struct §1–§3, §8–§9]; [Brief]: "tons of lesson documents we need to review/revise and then import"; T-7, N-4 | Every lesson. Teacher-edition sections run a median ~3,066 words (*calculation* from [Struct §3b] medians) | Drafts arrive as prose or HTML, not in their schema, so someone converts them by hand |
| **F-8** | **A prompt tweak silently changes a unit.** One edit regenerates 40 lessons, can remove the "don't invent quotes" rule, and leaves no trace | P-2, P-3 | T-10, E-10, L-15, N-14; [Site §5.1]: LXDs refine "AI prompts and specifications that power lesson production" | High (T-10). Weekly, once authors tune prompts [I] | Prompts are unversioned text, with guardrails and style mixed in one box |
| **F-9** | **Long generation with no visibility, and failures mid-unit.** ~2 hours serially (*calculation*); provider rate limits (429s) and truncated structured output are certain at this volume; one failure can kill the run | P-2, P-1 | T-9, N-12, N-13; [Brief]: "a few minutes per lesson is ok"; "view the generation in process" | **Critical** (N-12). Every run | A batch job built as a request; no durable state, no per-lesson status |
| **F-10** | **Regenerating or re-uploading destroys reviewed work.** Lesson 12 gets overwritten after a reviewer spent 40 minutes on it | P-1 | T-11, N-16 | High (T-11). Every outline revision | Generation writes straight to the record instead of making a candidate |
| **F-11** | **Collaboration conflicts, and AI edits slipped in after review.** Two reviewers edit at once; an "AI improve" rewrite is skimmed and approved; the record says "human-reviewed" | P-1, P-3 | [Brief]: "20+ reviewers"; E-11, N-17, N-3 | Medium-high / high likelihood (E-11). Concurrent editing is usually 1–3 people per lesson (*assumption*, AQ-3) | No conflict-free merge, and AI changes are not attributed or held as suggestions |
| **F-12** | **Approval is not tied to a version.** The document can change between reading it and clicking Approve, and later edits keep the "approved" flag | P-3, P-6 | T-3, N-18; 5 CCR §9517(i): only people "who actually contributed" may be credited [CA §3] | **Critical** (T-3) | Status is a flag on a mutable document |
| **F-13** | **Evidence maps are built by hand.** The criteria map runs 134 pages; standards maps go row by row per standard and per ELD level, each citing a lesson part address | P-3, Content Ops, P-5, P-6 | [CA §3]; [Profile §6] worked example ("someone has to build the 134-page map by hand"); AR-34 | Every program and every adoption, again for each grade band and state (*inference* from [Profile §6]) | Standards tags and lesson-part addresses are not captured when the lesson is written |
| **F-14** | **ELD supports get watered down.** The model's natural reading of "support English learners" is "give them an easier task". The sheet's ELD labels are also wrong for 7 of 12 codes, so trusting the code or the label gives different supports | P-4's English learners, P-6 | E-6, T-17; [Stds] ELD table (7 of 12 mismatched; PII.6.5 alone on 20 lessons); [Struct §6] (137 I-ELD drop-downs in 50 lessons) | High (E-6). California has ~1.1M English learners [Profile §5] | No rule that a support must keep the same text and task, and no check of the code against its official strand |
| **F-15** | **The quality bar for core is higher than Newsela's reputation.** Teachers see "articles, not curriculum"; quizzes are the most common product-quality complaint | P-4, P-5 (buy decision), Newsela's brand | [Sent] frictions 2 and 3 (~8 and ~10 items); [Profile §4]; [Sent] §6 Assessment | ~10 items, the top product-quality theme (*measurement*, [Sent]) | Generic AI defaults to recall questions with arguable keys and to interchangeable lessons |
| **F-16** | **Sensitive content and social-content rules.** Row 39's homework warns of "references to domestic abuse"; sacred narratives (Popol Vuh); a 1901 colonial-era translation; California's social-content review (5 CCR §9525) | P-1, P-6, P-4 | T-17 (L-7, E-7, E-8); [Sheet §5 item 22]; [CA §2]; [Sent] friction 4 | High (T-17). A handful of rows per unit, but any slip is public | Content rules exist only in reviewers' heads; the outline carries warnings in homework cells, where a generator drops them |
| **F-17** | **Reviewer anxiety and missing credit.** "AI replaces you" fear in a team after layoffs; the state credits only people "who actually contributed" | P-1, freelancers | [Sent] friction 8; [Profile §7 item 7]; 5 CCR §9517(i) [CA §3]; T-18, T-24 | Ongoing [I] | Tools framed as replacing people, and no record of what humans changed |
| **F-18** | **Cost is unknown and unbounded.** A public "generate unit" button is a cost attack; nobody knows cost per lesson | Newsela, P-3 | T-16, N-22, N-12; AQ-14 (no baseline) | High (T-16) | No spend cap in code, and no cost recorded per lesson |
| **F-19** | **The corrections cycle after the freeze.** Word-level fixes due within 60 days of the vote; "rewrites" are barred (revising a section, adding content) | P-3, Content Ops | [CA §2–3]; [Profile §6] "What is frozen"; AR-39 | Medium now; rises after 2026-11-12/13 | No version lineage that tells an allowed edit from a barred rewrite |

---

## 4. Product direction

### Vision

**Newsela Lesson Studio** (working name, already used in [Reg]): the place where a Newsela instructional designer
uploads a unit outline, sees every defect in it before a cent is spent, and gets back a full unit of draft lessons in
Newsela's own lesson schema. Each draft carries its evidence: which activity teaches which standard, where each quote
came from (or a marked gap where none could be sourced), and which outline row, prompt version and model produced it.
Reviewers edit together in a ProseMirror editor with the evidence beside the text. AI help arrives as suggestions they
accept or reject, and they approve one lesson version at a time once nothing is blocking. **The product's job is not
to write more lessons. Its job is to make each approved lesson cost fewer reviewer minutes without lowering the
state's bar.**

> **DIR-1 · Name and positioning.** "Newsela Lesson Studio", positioned as *an expert-driven production line*:
> designers plan, the pipeline drafts, people judge and approve. Never "AI writes the curriculum".
> *Recommendation, pre-approved by Innocent 2026-10-24.* Basis: F-17, T-24, [Sent] friction 7–8.

### The core principle: the system may only say what it can show

Concretely, the product never displays an unqualified claim. Take a lesson that cites `RL.6.6`:

- **Input:** outline row 8 lists `RL.6.1, 6.2 L.6.4` as focus standards.
- **Process:** the normalizer flags `6.2` as malformed and proposes `RL.6.2`. The designer confirms. The generator maps
  `RL.6.2` to "Learning in Action, Part B" and to the Pulse Check that tests it. Code checks that the code resolves,
  that it appears in the row's list, and that a teaching activity and a checking item both reference it. The judge
  (a model from a different provider) gives its advisory yes/no.
- **Output:** the lesson's alignment panel shows `RL.6.2`: *asserted by outline (confirmed by J. Designer) · mapped by
  generator to LiA Part B and Pulse Check 1 · code checks passed · judge: yes (provisional) · reviewer: not yet
  confirmed*. It never shows a bare "standards-aligned ✓" badge (AR-7).

The same rule applies everywhere. A quote has a source passage and rights status, or it is a "reviewer to insert"
block. An approval names a person, a version and the checklist items they ticked. A cost is read from the provider's
usage fields, not estimated.

> **DIR-2 · The principle is enforced in code, not just in copy.** Every claim type (standard, quote, page number,
> rights, approval) has a typed record with an `asserted_by` field, and the UI renders only from those records.
> *Recommendation, pre-approved by Innocent 2026-10-24.* Basis: T-1, T-2, T-3; GP-16, GP-18.

### The user journey: outline to approved unit

| # | Step | What the product does | What a human decides | Who |
|---|---|---|---|---|
| 1 | **Upload** | Stores an immutable snapshot and hash, normalizes rows (lesson / flex day / arc header / total), resolves every code against the official CDE table | Nothing yet | P-2 (author) |
| 2 | **Validate** | Shows every row as OK / warning / error with the original cell text and a proposed fix. Lists writer tasks and editor notes separately. Keeps **Generate** disabled while errors are unconfirmed | Accept or reject each proposed fix (`6.2` → `RL.6.2`; `RL.6.9.a` → `RL.6.9`); confirm the unit is U4; keep or re-map each mismatched ELD label; turn each writer task into a placeholder or pick an allow-listed public-domain excerpt | P-2 |
| 3 | **Start a run** | Shows the scope (all 47 rows or selected rows), the pinned prompt version and the spend cap; queues per-lesson jobs | Scope, prompt version, cap. "Try on one lesson" first | P-2 |
| 4 | **Plan the unit** | One model call writes a typed `UnitPlan`: per lesson, a one-line purpose, its main activity types, what it hands forward, and the performance-task thread | Read it. (Approving the plan before fan-out is Stretch) | P-2 |
| 5 | **Generate lessons** | Per lesson: draft (model) → compile to ProseMirror (code) → checks (code) → one repair (model) → checks → judge (model, advisory) → store version 1 with provenance. Progress is visible per lesson | Watch, cancel, or "retry failed" | P-2 |
| 6 | **Check the unit** | Code checks across lessons: an activity type repeated within 3 lessons, homework that doesn't match the next lesson's reading, the performance-task thread broken | Nothing; the results become issues on lessons | — |
| 7 | **Triage** | A queue sorted by blocking issues, then by advisory flags | Which lesson to take next | P-1 |
| 8 | **Review and edit** | Editor with evidence pane; AI rewrite as a suggestion; "regenerate as candidate" beside the current version; checks re-run on save | Every content change; accept or reject each AI suggestion; how to resolve each issue (fix it, or record a named resolution such as "quote inserted, rights: short-quote-commentary") | P-1 (reviewer) |
| 9 | **Submit** | Refuses while blocking issues remain, and lists them | When the lesson is ready | P-1 |
| 10 | **Approve** | Shows the 4–6 item checklist with links to evidence; pins the approval to the content hash the approver saw; makes the lesson read-only | Approve, or request changes with a reason | P-3 (approver, not the last editor by default) |
| 11 | **Export** | Versioned JSON of approved lessons in the `Lesson` schema; the unit coverage matrix | When to export | P-3 |
| 12 | **Reopen** | Creates a new draft version from the approved one; the approval stays in history | That a change is needed, and why | P-1 / P-3 |

**[I] The pattern:** the product does everything that can be written as code or as a bounded model call. A human
makes every decision that changes what a classroom will see, or what Newsela will claim.

### Orchestration shape: a fixed skeleton, the model only inside the lesson step

**What it does.** One run is a fixed graph that we draw ourselves (GP-72). The model makes no routing decisions. It
fills exactly three typed slots: the unit plan, each lesson draft (and its one repair), and the advisory judge verdicts.
Everything else is deterministic code: parsing, standards lookup, compiling to ProseMirror, checks, retries, caps,
state transitions, export.

```
upload ─► snapshot+hash ─► normalize ─► resolve standards ─► validation report
                                                               │
                                                    [HUMAN: confirm fixes]
                                                               ▼
                       run (scope, prompt version, spend cap) ─► UnitPlan  (model call 1, typed)
                                                               │
                         fan-out, concurrency cap 4–6, one durable job per lesson
                                                               ▼
   ┌──────────────────────────── per-lesson job (idempotent) ───────────────────────────┐
   │ LessonDraft (model, typed blocks) ─► compile to ProseMirror JSON (code, allow-list)│
   │      ─► checks (code) ──pass──► judge (model, other provider, advisory) ─► store v1│
   │                 └─fail─► one repair (cheaper model) ─► checks ─► store or `failed` │
   └────────────────────────────────────────────────────────────────────────────────────┘
                                                               ▼
                    unit checks (code: repeats, homework continuity, PT thread)
                                                               ▼
              review queue ─► [HUMAN: edit, accept AI, resolve] ─► [HUMAN: approve v_n]
                                                               ▼
                                              export (code, approved versions only)
```

**How it works, and why each choice.**

- **Rung named (GP-3): a single structured call per lesson, plus one repair.** Not a ReAct loop or an autonomous
  agent: the workflow is known in advance (AD-7, T-15). One rung lower (no repair) leaves truncated or invalid drafts
  stranded. One rung higher (an agent loop) adds unbounded cost and removes replay.
- **Brakes, set explicitly (GP-14):** at most 1 repair round; up to 3 retries with backoff on 429/5xx; a wall-clock
  timeout per job; a per-run spend cap checked in the worker before every call; a concurrency cap of 4–6
  (*assumption*, tuned to the measured rate limit) (AD-14). The run log records which brake fired.
- **Workers never route (GP-78).** A lesson job returns a typed result, not a transcript. Whether to repair, fail or
  store is decided by a pure function over check results.

> **DIR-3 · The model writes a typed `LessonDraft` of role-tagged blocks, and code compiles it to Newsela's
> ProseMirror JSON.** Block kinds: `say`, `ask` (+ `sample_response`), `directions`, `teacher_note`, `routine`
> (+ icon), `cfu_item` (stem, lettered options, one key, a rationale per option, standard tag), `eld_support`
> (`purpose` / `say` / `watch`), `support_table` (struggling / extension rows), `teacher_tip`, `quote` (+ source ref)
> and `text_evidence_needed`. The compiler maps roles to Newsela's nodes and marks (teal and purple at render time,
> never colours from the model, [Struct §1]).
> **Why:** (1) the model can only produce allow-listed nodes, so there is no malformed or unsafe markup (T-26);
> (2) far fewer output tokens than raw ProseMirror JSON for a ~3,000-word teacher edition, so less truncation (N-12);
> (3) checks run on typed blocks ("every `ask` has a `sample_response`", "every `cfu_item` has exactly one key");
> (4) the student edition can be compiled later from the same blocks (FE-13). If a measured draft still truncates, the
> fallback is one call per section, with the same block types (*assumption*, to test on the first 3 lessons).
> *Recommendation, pre-approved by Innocent 2026-10-24.* Basis: GP-4, GP-5, N-4, AR-14.

> **DIR-4 · Context per lesson call is narrow.** Each lesson sees its own normalized row, its arc header, its
> neighbours' rows, the `UnitPlan` lines for itself and its neighbours, the official text of its standards, the type
> template (sections and minutes), and 1–2 structure-only examples from Grade 6 Units 1–3. It never sees Unit 4's
> published lessons, which are held out (AD-3, AR-30), and never full copyrighted text (AR-29).
> *Recommendation, pre-approved by Innocent 2026-10-24.* Basis: N-11, GP-25, L-4.

---

## 5. Feature set

**How to read a card.** *Does* says what the feature does, with one input → output example. *Resolves* lists F-IDs.
*Brief* quotes the requirement it serves. *Audit* lists the requirements (AR), traps (T) and decisions (AD) it
satisfies. *Tier*: **MVP** = built by the deadline (the AD-1 slice, with its drop position `#n` where it has one);
**Stretch** = built only if the whole MVP lands; **Roadmap** = named in the production path, not built.

### A. Intake and outline validation

**FE-1 · Outline intake and snapshot** — **MVP** (AD-1 #1)
- *Does:* accepts CSV or XLSX upload (main path) and a public Google Sheet link (convenience), with a clear message for
  private sheets. It stores each upload as an immutable outline version with a SHA-256 hash. Example: the issued
  sheet's XLSX export → outline version 1, 57 rows, hash recorded; re-uploading it makes version 2 and touches no lesson.
- *Resolves:* F-1, F-10. *Brief:* "upload the spreadsheet/link for a Unit and start the generation process".
- *Audit:* AR-3, AR-24 (re-upload never overwrites), T-5, N-9, L-14.

**FE-2 · Outline normalizer** — **MVP** (AD-1 #1)
- *Does:* finds the header row by column names. It classifies rows as `lesson`, `flex_day`, `arc_header` or `total`,
  attaches arc text to its lessons as context, and strips lone non-breaking spaces. It expands ranges, takes lesson
  IDs from `Lesson #` (never the filename), and makes flex-day IDs from their position in the arc. Example: row 15's
  `W.6.2.a–f` → six codes; row 43's doubled filename → kept as an error on the report, ID `L35` from `Lesson #`;
  row 25 → `G6.U4.FLEX-1a`.
- *Resolves:* F-1. *Brief:* "That outline is a google spreadsheet of ~40 lessons indicating what each lesson should
  cover and the learning arc".
- *Audit:* AR-1, AD-9, AD-10, T-5, T-12 (no fixed unit size). Every defect in [Sheet §5] becomes a parser test (FE-41).

**FE-3 · Standards resolver** — **MVP** (AD-1 #1)
- *Does:* resolves every code against a seeded table of official CDE text: CA CCSS ELA grade 6, CA ELD grade 6 with
  sub-parts and Emerging / Expanding / Bridging levels, and the Model School Library Standards for grade six (column L).
  It proposes fixes for malformed or missing codes and proposes leaves for parent codes, marked "AI-proposed" (AQ-8).
  It shows the sheet's ELD label beside the official strand, with a mismatch flag. Example: `ELD.PII.6.5 – Use
  transitions to connect ideas` → official strand "Modifying to add details" → **mismatch warning**, with the suggested
  re-map `ELD.PII.6.2b` (Understanding cohesion) [Stds].
- *Resolves:* F-1, F-4, F-14. *Brief:* "aligned to teach the CA Core ELA/ELD standards numbers indicated in the sheet
  (e.g., RI.6.4, -- standards and definitions can be found online)".
- *Audit:* AR-5, T-2, T-5, L-8, A-5 (cite SBE standards only).

> **DIR-5 · ELD label mismatches.** The sheet's *code* stays the record unless the designer re-maps it, because state
> reviewers check codes. The lesson shows the official strand text, and the mismatch travels to the lesson as an
> advisory issue. Re-mapping is a one-click choice on the validation report, and each re-map is logged. We never
> re-map silently. *Recommendation, pre-approved by Innocent 2026-10-24.* Basis: [Stds] ELD table, F-14.

**FE-4 · Validation report with a confirm gate** — **MVP** (AD-1 #1)
- *Does:* one screen listing every row as OK / warning / error, with the original cell text and the proposed fix.
  **Errors** (malformed code, non-existent code, unit-number conflict, duplicate or missing ID) must each be confirmed
  or fixed. **Warnings** (ELD label mismatch, parent code, the vocabulary cap broken) are listed and carried forward.
  **Generate** stays disabled until every error is confirmed. Example: the issued sheet → 47 teaching days found
  (not "~40"), 1 unit-number conflict, 1 malformed code, 3 rows with a non-existent code, 2 bad filenames, 7 ELD codes
  carrying another strand's label (*measurement* from [Sheet §5] and [Stds], to be reproduced by the parser).
- *Resolves:* F-1. *Brief:* "start the generation process".
- *Audit:* AR-2, T-5, T-12, N-8. Audit §4 calls this the "mirror" option: it removes a hidden repair step even
  before any generation.

**FE-5 · Writer tasks and editor notes, typed apart** — **MVP** (AD-1 #1)
- *Does:* the normalizer splits cell text into `content`, `writer_task` and `editor_note` by pattern ("WRITER MUST",
  "Writer should", "Instead, think about…", "Cap at…"). The designer confirms each split on the validation report.
  Content goes into the prompt as delimited data, never as instructions. Writer tasks become placeholders or
  allow-list choices, and editor notes become constraints shown to the reviewer. Example: row 9's H cell → a writer
  task "select and write to an excerpt of *The Hare and the Lion*" → on the lesson, a `text_evidence_needed` block
  ("Reviewer to insert: excerpt, Bateman translation, public domain"), or the allow-listed passage if one was chosen.
- *Resolves:* F-2, F-3. *Brief:* "this is the instrucitonal design our experts create prior to the AI generating".
- *Audit:* AR-4, N-7, N-15 (cells as instruction channels), T-26.

**FE-6 · Outline version diff** — **Stretch**
- *Does:* compares outline version *n* with *n−1* row by row and lists which lessons a change affects. A human chooses
  which of those to regenerate, and each regeneration comes back as a candidate (FE-24). Example: the designer changes
  row 30's focus standards → "Lesson 22 affected (in review); regenerate as candidate?"
- *Resolves:* F-10. *Brief:* (silent on re-upload; serves "import … for persistence and tracking").
- *Audit:* AR-24, T-11, N-16. The MVP already makes a re-upload a new version that touches nothing (FE-1); the diff
  view is the stretch part.

### B. Unit planning (the arc pass)

**FE-7 · Unit plan pass** — **MVP** (AD-1 #3)
- *Does:* before any lesson, one model call produces a typed `UnitPlan`. For each lesson it gives a one-line purpose,
  the main activity types (from Newsela's routine names, [Struct §1]), what the lesson hands forward (homework, skill)
  and the performance-task thread. The plan is shown read-only on the unit page. Example: for L3 → "hands forward:
  Ch. 1 pp. 1–8 read and annotated", and L4's plan line → "Launch picks up L3's annotations; teacher read-aloud of
  pp. 1–8".
- *Resolves:* F-6. *Brief:* "indicating what each lesson should cover and the learning arc".
- *Audit:* AR-26, T-19, N-11. Approving the plan before fan-out is Stretch (GP-68).

**FE-8 · Arc continuity checks** — **MVP** (added to the slice, drop position after the judge; see §6)
- *Does:* code checks across the generated unit. It flags the same primary activity type within any 3-lesson window,
  homework whose pages don't match the next lesson's reading, a performance-task skill (column M) that no lesson
  practises, and a vocabulary list longer than the cap the designer confirmed. Example: L6, L7 and L8 all open with
  Think-Pair-Share → an advisory issue on L8: "Launch repeats L6–L7; vary?"
- *Resolves:* F-6, F-15. *Brief:* "the learning arc".
- *Audit:* AR-26, E-5 (sameness that no single-lesson review sees), T-19.

> **DIR-6 · Arc checks join the MVP.** They are pure code over typed blocks we already produce, and they answer
> the "articles, not curriculum" doubt directly (F-15). *Recommendation, pre-approved by Innocent 2026-10-24.*

### C. Lesson generation

**FE-9 · Schema-native lesson drafts** — **MVP** (AD-1 #2–3)
- *Does:* produces a typed, versioned `Lesson` matching Newsela's record [Struct §9]: typed front matter (title,
  type, minutes, three standards lists with official descriptions, Content / Language / Foundational Skills objectives
  in teacher and student wording, essential questions, the four connections, routines, materials, vocabulary lists,
  anchor-text cards), then the sections as ProseMirror JSON compiled from the `LessonDraft` (DIR-3). Section templates
  follow the lesson type: Reading, Writing, Discussion, Research and Presentation 5/10/30/5 + Homework; Spark 15/30/5;
  Flex Day and assessments 5/40/5. Outline types map to published types (`Core Reading` → `Reading`; each "Double
  Lesson" row → one 50-minute `Writing` lesson within a two-day task, AD-10). Example: row 9 → "Lesson 5: …",
  type `Writing`, Literacy Lab built from column N's mini-lesson, Learning in Action Part A and Part B, each heading
  carrying its standards and minutes.
- *Resolves:* F-7, F-15. *Brief:* "The lesson format and structure (e.g., what sections and how to break down a
  lesson)"; "It will show the front matter we include with each lesson header and then the sections … (Launch,
  Learning In Action, Look Back, etc)".
- *Audit:* AR-14, AD-5, T-7, N-4.

**FE-10 · Grounding by construction** — **MVP** (the public-domain excerpt allowlist is **Stretch**)
- *Does:* anchor and companion texts appear as citation cards (title, author, edition or ISBN, chapter and page range),
  with the novel as `off-platform-text`, as Newsela does [Struct §5]. A locked rule (FE-30) forbids invented quotes,
  page numbers and facts about real people. Where a lesson needs a quote, the draft emits a `text_evidence_needed`
  block that renders as "Reviewer to insert". Newsela articles become references with `content_available: false`.
  *Stretch:* verbatim excerpts only from an allowlist we supply (Gutenberg sources: Baldwin, Judson, Spence, Bateman,
  Butler or Lang translations), copied from the fetched text with URL and hash. Example: an L4 "Target Sentence"
  activity → `QUOTE NEEDED: one sentence from Ch. 1 pp. 1–8 showing Percy's sarcastic tone`, not a remembered line.
- *Resolves:* F-3, F-2. *Brief:* "referencing text/novel indicated in the provided unit outline sheet"; "its OK to
  improvise what content goes in there".
- *Audit:* AR-8, AR-9, AR-11 (Stretch), AR-12, AD-8, T-1, T-8, A-6, A-7.

**FE-11 · Integrated ELD and student supports that keep the task** — **MVP**
- *Does:* each Literacy Lab and Learning in Action part gets an "Integrated ELD Instructions" block in Newsela's
  pattern (purpose → say/ask with 3–5 graduated sentence frames → watch-for with if/then prompts), plus an
  "Additional Student Support" table (struggling with / ready for extension) [Struct §6]. A locked rule says supports
  scaffold the **same text and task**, and the ELD purpose cites the row's ELD code with its official strand. Example:
  L31's comparison paragraph → frames such as "Homer's Olympus is ___, whereas Riordan's is ___ because ___", not
  "write two sentences about Olympus".
- *Resolves:* F-14, F-7. *Brief:* "aligned to teach the CA Core ELA/ELD standards".
- *Audit:* AR-27 (rules), E-6, T-17. The "keeps the task" judgement is a judge question (FE-18) and an approval
  checklist item (FE-26).

**FE-12 · Checks for understanding built to be defensible** — **MVP**
- *Does:* Pulse Checks and Checks for Understanding are typed `cfu_item`s: a stem, lettered options, exactly one key,
  a "Correct / Incorrect" rationale for every option, and a standard tag that must be in the lesson's focus list. Code
  checks all of these. Each lesson needs at least one check in Learning in Action and an exit-ticket Quick Write in
  Look Back [Struct §7]. Example: a Pulse Check tagged `RL.6.9` on a lesson whose focus list lacks `RL.6.9` → blocking
  issue "check tests a standard this lesson doesn't teach".
- *Resolves:* F-15, F-7, F-4. *Brief:* "generate standard aligned content to fill out the lesson".
- *Audit:* AR-6 (every focus standard has a checking task); [Sent] §6 ("item-level review: one defensible key,
  standard tag").

**FE-13 · Student edition by rule** — **Stretch**
- *Does:* compiles the student edition from the same `LessonDraft`: drops `say` labels, `sample_response`,
  `teacher_note` and `teacher_tip`, keeps `directions`, prompts, frames and CFU stems without keys, and sets times to
  `[0,0]` as Newsela stores them. A leak check fails if any teacher-only block reaches the student edition. Example: L4
  teacher Launch → student Launch "Directions: Turn and talk with a partner…".
- *Resolves:* F-7. *Brief:* "the sections within the lesson that the teacher should follow".
- *Audit:* AD-5 names the student edition as a cut; it stays one. The draft carries `directions` blocks from day one,
  so this is a compile step later, not a rewrite.

**FE-14 · Durable generation jobs** — **MVP** (AD-1 #3)
- *Does:* a Postgres-backed queue with a separate long-running worker. Each job is idempotent, keyed by `(run, lesson,
  prompt version, schema version)`. It retries with backoff, treats partial failure as a normal state ("38 of 41
  generated, 3 failed: reason") with a "retry failed" button, resumes after a restart, and can be cancelled. Runs have
  a concurrency cap, a per-run spend cap enforced before each call, a run scope (all rows or selected rows) and cost
  recorded per lesson. A second unit queues behind the first. Example: worker redeployed at lesson 23 → it resumes at
  23, and no lesson is billed twice.
- *Resolves:* F-9, F-18. *Brief:* "Generation of lessons can happen asynchronously … a few minutes per lesson is ok".
- *Audit:* AR-21, AD-14, AD-15, T-9, N-12.

**FE-15 · Live progress board** — **MVP** (AD-1 #3)
- *Does:* the unit page shows one tile per lesson (queued → planning → drafting → checking → repairing → ready /
  failed), polled every 2 seconds, with running cost against the cap. Finished lessons open for review while others
  still generate. Example: at minute 6, 9 lessons are ready, so a reviewer starts on L1.
- *Resolves:* F-9. *Brief:* "bonus points if you … let them view the generation in process".
- *Audit:* AD-16, N-13. Token streaming is out (half-formed JSON helps nobody).

### D. Verification and checks

**FE-16 · Deterministic check suite, with one repair** — **MVP** (AD-1 #4)
- *Does:* runs on every draft and after every save. **Blocking:** schema valid; sections present and in order for the
  lesson type; minutes sum to 50 ± 5 (*target*); every focus standard mapped to a teaching activity *and* a checking
  item; no code outside the row's lists; leaf codes only; any quoted run of 12+ words not matched in a supplied source;
  any page number outside the row's range; a `to-clear` rights status; an unaccepted AI span; an open safety flag.
  **Advisory:** ELD label mismatch, arc repeats, vocabulary over cap. On failure, one repair call (cheaper model,
  AD-13) gets the failed check list; if checks still fail, the lesson is stored as `generation_failed` with reasons.
  Example: draft L12 Look Back has 3 minutes → repair → 5 minutes → passes.
- *Resolves:* F-3, F-4, F-14, F-15. *Brief:* "what's important is that we generate standard aligned content".
- *Audit:* AR-6, AR-10, AR-12, AR-16, T-1, T-2, N-5, N-6.

**FE-17 · Alignment map per lesson, with "asserted by"** — **MVP** (AD-1 #4)
- *Does:* for each standard, it records the lesson parts that teach it and the items that check it, with a role
  (introduced / practised / assessed) and who asserted each link: outline, generator, judge or a named reviewer. The
  reviewer confirms links in the evidence pane. Example: `L.6.4.a` → Literacy Lab "Language Study" (practised,
  generator) + CFU 1 (assessed, generator) → reviewer confirms → "confirmed by M. Reviewer, v3".
- *Resolves:* F-4, F-13. *Brief:* "aligned to teach the CA Core ELA/ELD standards".
- *Audit:* AR-6, AR-7, T-2, E-2.

**FE-18 · Cross-provider alignment judge** — **MVP** (AD-1 #12)
- *Does:* gives a binary verdict per (activity, standard) pair and asks "does the ELD support keep the grade-level
  task and text?". It runs on a different provider from the generator (AD-13) and sees only the activity, the
  official standard text and a short rubric. It is advisory only, labelled "provisional, not expert", with a
  calibration record: about 30 pairs labelled by Innocent, with agreement and sample size reported. Example: "LiA
  Part A teaches RL.6.6?" → no → advisory flag "judge disagrees; check point-of-view task".
- *Resolves:* F-4, F-14. *Brief:* "standard aligned content".
- *Audit:* AR-13, T-2, E-6, GP-47–49.

**FE-19 · Content-safety rules and warnings** — rules **MVP**; advisory screen **Stretch**
- *Does:* locked rules: sacred narratives framed respectfully, grade-appropriate summaries, no prompts asking
  students to disclose trauma, and content warnings carried into the teacher-facing Homework tip. *Stretch:* an
  advisory screen for social-content and brand-name issues, labelled "advisory, not clearance". Example: row 39's "Warn
  students about potentially triggering scene…" → a `teacher_tip` in L31 Homework, plus an open safety flag the
  reviewer must clear.
- *Resolves:* F-16. *Brief:* (silent; serves "standard aligned content" for a state adoption).
- *Audit:* AR-27, T-17, L-7, E-7, E-8.

### E. The review workspace

**FE-20 · Unit board and triage queue** — **MVP** (AD-1 #6)
- *Does:* one table for the unit: lesson, type, state, blocking issues, advisory flags, reviewer, last change. It
  sorts by blocking issues first, filters by state, and shows the unit roll-up ("31 approved · 9 in review · 4 changes
  requested · 3 failed"). Example: a reviewer opens the queue and starts with L22 (2 blocking: unsourced quote, `to-clear`
  rights).
- *Resolves:* F-5. *Brief:* "Have a UI/UX for approval workflow for lessons within a unit".
- *Audit:* AR-15 roll-up, E-3 ("make correcting cheap").

**FE-21 · Collaborative lesson editor** — **MVP** (AD-1 #7)
- *Does:* a ProseMirror editor with a schema mirroring Newsela's nodes (`routine_heading`, `callout`, `collapsible`,
  tables, lettered lists) and role marks (teacher talk, sample response). It uses a Yjs binding through one Hocuspocus
  server, authenticated with the app session and persisted to Postgres (debounced ≤ 2 s), with names and cursors for
  co-editors. Standards and minutes are form fields, not editor text. Approved lessons are read-only. Example: two
  reviewers in L5, one fixing the Launch and one the Pulse Check; both edits merge, and each save re-runs FE-16.
- *Resolves:* F-11, F-7. *Brief:* "a UI/UX for reviewing and editing/updating a lesson's content in the system
  (wysiwyg)"; "ProseMirror and Yjs for the frontend/collaborative editor".
- *Audit:* AR-20, AD-5, AD-6, T-7, N-3. Out: comments, track changes, offline mode, history browser.

**FE-22 · Evidence pane and jump-to issues** — **MVP** (minimal form; matched source passage display is **Stretch**)
- *Does:* beside the editor it shows the outline row (as confirmed), the official text of each standard, the alignment
  map with its "asserted by" labels, and the issue list. Clicking an issue jumps to its span. *Stretch:* the matched
  source passage for each quote. Example: the reviewer clicks "RL.6.6 has no checking item" → the cursor lands in
  Look Back, where they add a point-of-view question.
- *Resolves:* F-5, F-3, F-4. *Brief:* "an interface for our review staff to review, edit/update".
- *Audit:* AR-18, E-3 ("check against the source, not just read what is shown"), GP-17.

> **DIR-7 · The evidence pane moves from Should to MVP, in a minimal form.** Without it, Approve is a button on prose,
> which is exactly T-3. *Recommendation, pre-approved by Innocent 2026-10-24.*

**FE-23 · AI assist as suggestions** — **MVP** (AD-1 #9)
- *Does:* one tool, "rewrite selection with my note". It returns a suggestion shown as a tracked insertion. A person
  accepts or rejects it, and an accepted change is applied as a transaction tagged `ai-assist` with the requester's
  name and logged. Unaccepted suggestions block approval. Accepted ones re-run the checks. It is unavailable on
  approved lessons and warns against pasting student work. Example: "make this Ask more open-ended" → suggestion →
  accept → the provenance says "1 AI-assisted span, accepted by M. Reviewer".
- *Resolves:* F-11, F-17. *Brief:* "edit/update (via direct wysiwyg editing and even AI tools as needed)"; "AI assisted
  tooling as helpful".
- *Audit:* AR-22, E-11, N-17, AR-38 (warning).

**FE-24 · Regenerate as a candidate** — **MVP** (whole lesson); section-level regenerate with a note is **Stretch**
- *Does:* "Regenerate" never overwrites an edited, in-review or approved lesson. It creates a candidate version
  beside the current one. The reviewer compares the two and adopts the candidate, or copies parts of it in. Example: L18
  failed generation → retry produces v1. L19 is in review → regenerate gives "candidate v2 (not adopted)".
- *Resolves:* F-10. *Brief:* "so that next steps of editing, approval, finalization can take place".
- *Audit:* AR-24, T-11, N-16.

### F. The approval workflow

**FE-25 · Lesson state machine, version-pinned approval** — **MVP** (AD-1 #6)
- *Does:* the server enforces `draft → in_review → changes_requested → approved → exported`, plus `reopened`, by role
  (`exported` is AR-15's `published`, renamed so the UI doesn't imply a live integration, T-20).
  Approval pins the content hash and Yjs state vector the approver saw; if the document changed since they opened it,
  Approve refuses and asks them to reload. Approved means read-only. Reopening needs a reason and makes a new version.
  "Request changes" carries a reason tag and a note (not threaded comments). Four-eyes (approver ≠ last editor) is on
  by default. **There is no bulk approve.** Example: the approver opens L5 v4, a reviewer saves v5 meanwhile → Approve
  says "this lesson changed since you opened it".
- *Resolves:* F-12, F-5. *Brief:* "Have a UI/UX for approval workflow for lessons within a unit, where once
  reviewed/updated it is flagged as complete in our system".
- *Audit:* AR-15, AR-17, AD-11, T-3, N-18.

**FE-26 · Approval checklist with linked evidence** — **MVP** (AD-1 #6)
- *Does:* Approve stays disabled while any blocking issue stands, and the screen lists them. A block clears only by
  fixing the content, or by a named person recording a resolution (for example: "quote inserted from class copy,
  rights: short-quote-commentary"). The checklist has 4–6 items, each linked to its evidence: quotes verified, each
  standard has a teaching and a checking task, ELD supports keep the task, social content checked, AI spans reviewed.
- *Resolves:* F-5, F-3, F-14, F-16. *Brief:* "once reviewed/updated it is flagged as complete".
- *Audit:* AR-16, AR-17, E-3 (short on purpose: long checklists get clicked through).

**FE-27 · Audit log and provenance** — **MVP** (AD-1 #5–6)
- *Does:* an append-only log of every transition (who, when, from, to, version hash, reason). Every lesson version
  records the outline-row hash, prompt version, model and parameters, schema version, example set, run ID and cost.
  Example: "L5 v4: generated by run 12, prompt guidance v3, model X; edited by A (212 chars), AI-assist span accepted
  by A; approved by B at 14:02 on hash 9f…".
- *Resolves:* F-12, F-8, F-17, F-19. *Brief:* "import them into a system for persistence and tracking".
- *Audit:* AR-19, T-18, L-5, L-9, E-9; 5 CCR §9517(i).

**FE-28 · Fast-approval soft prompt** — **Stretch**
- *Does:* if a 50-minute lesson is approved within N seconds of opening (*assumption*: 60 s), it asks once, "Approve
  after this short a review?", and records it as an aggregate process signal, never a per-person score. Example: an
  approval at 40 s → prompt → the approver confirms → it counts toward the unit's "fast approvals" total.
- *Resolves:* F-5. *Brief:* "handle staff of 20+ reviewers". *Audit:* E-4, AD-19 guard.

**FE-29 · Blind second review by sampling** — **Roadmap**
- *Does:* a configurable share of approved lessons (e.g. 10%, *assumption*) goes to a second reviewer who can't see
  the first decision. Disagreement is reported per unit. This is the north star's real guard.
- *Resolves:* F-5. *Audit:* AR-36, E-3, AD-19.

### G. Prompt and version management

**FE-30 · Two-layer prompts with versions** — **MVP** (AD-1 #10)
- *Does:* the **locked layer** (grounding rules, content rules, output schema) can't be edited in the UI. The
  **guidance layer** (tone, activity preferences, routine choices) can. Each save makes an immutable version with
  author, time, diff and reason. A run pins one version, "try on one lesson" previews a change, and the code checks
  run whatever the prompt says. Example: an author adds "prefer Graffiti/Table Talk in Launch" → guidance v4 → tried
  on L8 → used for a re-run of L20–L35 as candidates.
- *Resolves:* F-8. *Brief:* "bonus points if you allow the editing of the prompt so content authors can tweak the
  output".
- *Audit:* AR-23, T-10, E-10, L-15, N-14.

**FE-31 · Prompt regression set** — **Roadmap**
- *Does:* a changed guidance version must run on a fixed set of rows (including the hard rows: 8, 9, 30, 39) and show
  check results before it can be used for a full unit.
- *Resolves:* F-8. *Audit:* E-10, GP-21.

### H. Evidence and standards-map export

**FE-32 · Lesson-part addresses** — **MVP**
- *Does:* every section and Learning in Action part gets a stable address in the form reviewers cite, e.g.
  `G6.U4.L5.LearningInAction.PartA`, shown in the editor and stored on each alignment link. Example: the alignment map
  row `W.6.2.a` → "G6.U4.L5.LearningInAction.PartB (assessed)".
- *Resolves:* F-13, F-4. *Brief:* "aligned to teach the CA Core ELA/ELD standards numbers".
- *Audit:* AR-34 (address shape), [CA §3, §5 item 1].

**FE-33 · Unit standards coverage matrix** — **MVP** (added to the slice, drop position just before export; see §6)
- *Does:* a read-only grid of standard × lesson, each cell showing the role (I introduced / P practised / A assessed)
  and whether it is confirmed by a person, judge-only or generator-only. It highlights standards that are never
  assessed and lessons with no focus coverage. It is computed from stored alignment links, never recomputed by a model.
  Example: "RL.6.7: introduced L12, practised L17, never assessed in this unit" → a gap the content lead sees before a
  state reviewer does.
- *Resolves:* F-13, F-4, F-6. *Brief:* "aligned to teach the CA Core ELA/ELD standards numbers indicated in the sheet".
- *Audit:* AR-34 (coverage table), T-12 (rolls up to the year later), [Profile §9] ("no rival cohort slice is likely
  to show it").

> **DIR-8 · The coverage matrix joins the MVP.** It turns stored data into the artifact the state actually grades,
> for the cost of one query and one table, and it is the product's clearest picture of "the system may only say what
> it can show". *Recommendation, pre-approved by Innocent 2026-10-24.*

**FE-34 · "Publish" as a versioned JSON export** — **MVP** (AD-1 #13)
- *Does:* exports the approved versions of a unit in the `Lesson` schema (the contract lives in `docs/contracts/`),
  idempotent and versioned, labelled in the UI as an export. Exported lessons move to `exported`. Example: "Export
  unit G6.U4 → 47 lessons, schema v1, export #3".
- *Resolves:* F-7. *Brief:* "and ultimately published to our application".
- *Audit:* AR-35, T-20, N-19, AQ-15.

**FE-35 · Standards-map and provenance export** — **Stretch**
- *Does:* CSV in the row shape of the CDE Standards Map (one row per standard, ELD per level, a citations column of
  addresses), plus a per-unit provenance summary: the share of sections and characters changed by people, AI-assist
  spans accepted, and who approved what.
- *Resolves:* F-13, F-17. *Audit:* AR-34, L-5, L-9, E-9, E-14.

**FE-36 · Corrections-cycle change control** — **Roadmap**
- *Does:* marks lessons `adopted-locked`. An edit to one creates a new version that must be classified as an
  edit-and-correction (allowed) or a rewrite (barred), with before/after exports for the 60-day package.
- *Resolves:* F-19. *Audit:* AR-39, [CA §5 item 12].

**FE-37 · Designated ELD lessons paired with ELA** — **Roadmap**
- *Does:* generates the ELD Core course's lessons (differentiators for Emerging, Expanding, Bridging, Newcomers and
  LTELs, plus language-at-a-glance), each tied to its ELA lesson's essential question and text [Struct §2, §6].
- *Resolves:* F-14. *Audit:* E-6 question; [CA §5 item 5].

**FE-38 · Year-level coverage and social-content tally** — **Roadmap**
- *Does:* rolls coverage up across the 4 units of a grade to the 180-day year, and counts representation across the
  year, as "fair proportion" judgements require.
- *Resolves:* F-13, F-16. *Audit:* T-12, [CA §5 items 4 and 8].

### I. Observability, cost and evaluation

**FE-39 · Traces, cost per lesson and run summary** — **MVP** (AD-1 #11; cost per lesson is part of #3 and never cut)
- *Does:* stores in our own Postgres, per run, lesson and model call: the rendered prompt, raw output, tokens, cost,
  check results and judge verdicts, all under one correlation ID. It shows a run summary: wall time, cost, retries,
  failures by reason and placeholders left. Example: "Run 12: 47 lessons, 24 min, cost $X (from usage fields), 2
  repairs, 1 failed (truncation), 19 quote placeholders".
- *Resolves:* F-9, F-18. *Brief:* "a few minutes per lesson is ok". *Audit:* AR-33, AD-17, N-23, GP-23.

**FE-40 · Review value signals and a Unit health panel** — **MVP** (AD-1 #11, minimal: edit distance at approval and
draft-to-approved time)
- *Does:* computes the north star, **reviewer minutes per approved lesson, counting only lessons approved with every
  blocking check cleared** (AD-19), from review-session timestamps. Beside it: edit distance per section, untouched
  sections, AI-assist accept rate, placeholders left at approval and fast-approval count. It is a manager view per
  unit, kept separate from health metrics like latency and failures (GP-22, GP-58), with no per-person leaderboard.
- *Resolves:* F-5, F-17. *Brief:* "Impact Metrics: ARR"; "improving productivity of internal staff".
- *Audit:* AR-33, AD-19, E-4, T-21. **No baseline** exists (AQ-14); the panel says so.

**FE-41 · Unit eval run and golden cases** — **MVP**
- *Does:* (1) one golden test per outline defect in [Sheet §5] and [Stds] (the parser must reproduce FE-4's counts);
  (2) golden cases for the checks, including cases whose right output is a refusal or a placeholder (a row with a
  writer task must yield `text_evidence_needed`, never a quote); (3) before recording, a full run of the issued unit
  reporting pass rates, repairs, failures, placeholders, judge flags and cost; (4) a **local-only** structural
  comparison with the held-out published Unit 4: lesson types, section sequence and focus-standard overlap, as numbers,
  with no content copied. Example: "focus-standard overlap with the published unit: n of m lessons share at least one
  focus code (*measurement*, local only)".
- *Resolves:* F-1, F-15. *Brief:* "Clean, well structured architecture" (and the demo video as evidence).
- *Audit:* AR-30, AR-31, T-22, GP-19, GP-20, GP-44 (sealed holdout).

**FE-42 · Load script for 20+ reviewers** — **MVP** (AD-1 #14, first to cut)
- *Does:* 25 simulated editors across 10 lessons during a live generation run. It reports measured p95s against the
  targets: open < 1.5 s, remote edit < 300 ms, durable store < 3 s, dashboard < 1 s, no lost update (*targets*, T-13).
- *Resolves:* F-11. *Brief:* "Rest of workflow and loading/editing of lessons should be performant and be able to
  handle staff of 20+ reviewers". *Audit:* AR-32, T-13, N-20.

### J. Access

**FE-43 · Allow-list sign-in, roles and caps** — **MVP** (AD-1 #8)
- *Does:* an allow-list login with author, reviewer and approver roles, enforced on the API and the websocket. It adds
  per-user generation limits and per-run and per-day spend caps. Demo seeds one account per role. Example: a reviewer
  account can't start a run or approve; an unknown email can't open the websocket.
- *Resolves:* F-18, F-11. *Brief:* (silent; serves "an interface for our review staff"). *Audit:* AR-25, AR-37, T-16,
  N-22.

**Tier count (*calculation* from the cards above):** **34 MVP** cards (FE-1–5, 7–12, 14–27, 30, 32–34, 39–43), of
which seven carry an AD-1 drop position from #9 to #14 or one of our two additions (see §6). **4 Stretch** cards
(FE-6, FE-13, FE-28, FE-35). **5 Roadmap** cards (FE-29, FE-31, FE-36, FE-37, FE-38). Five MVP cards also have a
Stretch part: FE-7 plan approval, FE-10 allowlist excerpts, FE-19 advisory screen, FE-22 matched passages and FE-24
section-level regenerate.

---

## 6. The MVP cut for the deadline

### What the demo proves

**One unit, end to end: the issued Grade 6 Unit 4 sheet (*The Lightning Thief*).**

- **Batch, before recording:** all 47 teaching days (41 lessons + 6 flex days; arc headers are context, not lessons)
  are generated in one run. At 6 concurrent jobs and ~3 minutes per lesson (*assumption*), that is roughly 25 minutes
  (*calculation*). The run summary (FE-39) gives the real numbers.
- **Live, in the video: N = 3.** Upload the sheet → the validation report shows the U3/U4 conflict, the malformed
  `6.2`, `RL.6.9.a` and the ELD label mismatches → confirm → a scoped run of three rows: row 8 (Reading, L4), row 9
  (Writing, L5) and row 25 (a flex day) → the progress board → open L4 while the others finish.
- **Review, on a lesson picked at random** from the batch run (AR-31): the evidence pane, one caught error (for
  example an unsourced quote replaced by "Reviewer to insert", or a check testing a standard the lesson doesn't teach),
  an AI suggestion rejected, a fix, submit, then approval by a second account.
- **Close on numbers:** wall time, cost per lesson, check pass rate at first draft, repairs, failures, placeholders
  left, the coverage matrix, and the Unit health panel saying "no baseline".

> **DIR-9 · Live N = 3, scoped by row selection (FE-14).** It shows each lesson shape (5/10/30/5 Reading, Writing
> with a writer task, 5/40/5 Flex) within a few minutes of video. *Recommendation, pre-approved by Innocent
> 2026-10-24.*

> **DIR-10 · The spend cap for the full run** is set after the 3-lesson trial: measured cost per lesson × 47 × 1.5.
> We do not guess a price before measuring (AD-13). *Assumption.*

### In (the MVP), with the cut order

Items keep AD-1's order. FE-8 and FE-33 are our two additions to the slice. FE-22 is AR-18, moved up from Should
(DIR-7).

| AD-1 # | Features | Never cut? |
|---|---|---|
| 1 Ingest and validate | FE-1, FE-2, FE-3, FE-4, FE-5 | **Never** |
| 2 Schema | FE-9 (schema, compiler, type templates), FE-12 (CFU item shape) | **Never** |
| 3 Pipeline | FE-7, FE-14, FE-15, FE-10 (grounding rule and placeholders), FE-11 (ELD rules) | **Never** |
| 4 Checks | FE-16, FE-17, FE-32 | **Never** |
| 5 Provenance | FE-27 (version fields) | **Never** |
| 6 Review and approval | FE-20, FE-22 (minimal), FE-24 (whole lesson), FE-25, FE-26, FE-27 (log), FE-19 (rules) | **Never** |
| 7 Editor | FE-21 | **Never** (ProseMirror + Yjs is required, AD-2) |
| 8 Auth | FE-43 | **Never, if deployed.** If cut, the demo runs locally and is said to |
| 9 AI assist | FE-23 | cut 8th |
| 10 Prompt guidance | FE-30 | cut 7th (the brief calls it a bonus) |
| 11 Observability | FE-39 (beyond cost per lesson and run summary), FE-40 | cut 6th (cost per lesson and the run summary stay) |
| — Arc checks | FE-8 | cut 5th |
| 12 Judge | FE-18 | cut 4th |
| 13 Export | FE-34 | cut 3rd |
| — Coverage matrix | FE-33 | cut 2nd |
| 14 Load script | FE-42 | cut 1st |
| Evals | FE-41 parts 1–3 | **Never** (AR-31). Part 4, the held-out comparison, is cut with the judge |

### Out (named cuts, each in the conformance table)

Google OAuth for private sheets and SSO; comments and threads, track changes, history browsing and offline editing;
retrieval over the novel or Newsela's article library; AI tools beyond "rewrite selection"; multi-unit or course
management; the teacher-facing visual template; any student-facing surface; real push integration into Newsela's app;
horizontal scaling; expert-grade judge calibration; Designated ELD course lessons (FE-37); bulk approve (never, by
design) [engineering audit, slice "Out"; AD-1].

### Faked and labelled (each says so in the UI and the docs)

| What the brief implies | What we ship | Label shown |
|---|---|---|
| "ultimately published to our application" | Versioned JSON export plus an `exported` state (FE-34) | "Export (no live integration)" |
| Newsela articles and novel passages inside lessons | Citations and "Reviewer to insert" blocks (FE-10) | "Source text not supplied" |
| An expert judge | About 30 pairs labelled by Innocent, provisional (FE-18) | "Provisional, not expert" |
| "20+ reviewers" | A simulated load test (FE-42) | "Simulated load" |
| Flex days and double lessons | AD-10's stated assumption | "Assumption, awaiting Newsela (AQ-6)" |
| Standards granularity | Leaves and ELD levels proposed by the generator (AQ-8) | "AI-proposed, confirm" |
| Activity patterns | Patterns improvised from Units 1–3 structure | "Prototype pattern; Newsela's designers own the real library" (T-8) |

### A realistic build plan (~2.5 days, agent-assisted) [A]

| Block | Work | Exit check |
|---|---|---|
| Sat 10/24, evening | PRD; Zod `Lesson` + `LessonDraft` contracts; seed the grade 6 standards table from CDE text; normalizer + validation report + golden defect tests | The parser reproduces FE-4's counts on the issued sheet |
| Sun 10/25 | Queue + worker; unit plan; lesson draft → compiler → checks → repair; progress board; 3-lesson trial, then cost-capped full run overnight | 47 rows in a terminal state; run summary recorded |
| Mon 10/26, day | Review workspace: editor + Hocuspocus, evidence pane, state machine, checklist, audit log; auth; AI assist; prompt guidance | One lesson goes draft → approved by two accounts, with a pinned hash |
| Mon 10/26, evening | Late items in reverse cut order; eval report; deploy (if spend approved, AD-15); record; submit | Submission before Tue 03:00 CT |

**The rule when time runs short:** cut from the top of the cut order. Never trade the full-unit run or the honest
numbers for a feature (T-22).

---

## 7. Why this direction wins

### How it moves Newsela's business, in plain words

**The chain (three hops, from [Audit §7]):**

1. **Checked drafts plus evidence-first review cut reviewer minutes per approved lesson.** Reviewers stop rebuilding
   evidence by hand: the standard is already mapped, the quote is already sourced or flagged, the row is already
   beside the text. *Measured in our build; no baseline (AQ-14).*
2. **Fewer minutes per lesson means the next program fits its calendar with the same thin team.** [A] A 6–8 program is
   1,000+ teacher-edition lessons; at 20 reviewers, that is 50+ each (*calculation*). [F] Grades 9–12 are "coming
   2027", and in California each high-school district adopts on its own (Ed Code §60400), which means many evidence
   packages, not one [Profile §6].
3. **A program on time, with evidence a district can certify, wins core licences.** [F] Core deals are district-wide
   and large: Orange Unified approved $3.68M for K–6 ELA. Non-list districts must certify alignment under AB 1454
   [Profile §3, §6]. That is the brief's "10's of millions" ARR [Brief].

**The cost side, as an illustration, not a claim.** [A] Traditional authoring at $40–45/hour × 15–30 hours per lesson
≈ $600–1,350 per lesson (*calculation*, [Audit §7]). For 1,000 lessons that is about $0.6–1.35M of writing labour per
program (*calculation*), close to [CA §4]'s $1–2M estimate. The tool moves that spend from writing to judging. Our
demo reports measured generation cost per lesson and measured review minutes, and says plainly that the before-number
is an assumption.

**Why this beats the obvious submission [I].**

- It names Newsela's real constraint (review, at the state's bar) and measures it, guarded against rubber-stamping.
- It produces the state's evidence (addresses, alignment links, coverage) as a by-product of writing lessons, which
  is what California actually grades [CA §5].
- It keeps Newsela on the side teachers defend: vetted content, not generic AI text. "We fought back and said no"
  was said about generic AI, not about Newsela [Sent §10]. Its own policy is "nothing AI-generated in front of
  students that teachers don't have the ability to see" [Profile §7].
- It speaks Newsela's format: their nodes, their lesson types, their section timings. There is no import step.

### What we deliberately don't build

| Not built | Why |
|---|---|
| An autonomous agent that plans and judges itself | The workflow is known; an agent adds unbounded cost and no replay (AD-7, T-15) |
| Bulk approve, or auto-approve when checks pass | Rubber-stamping, and the state credits only people "who actually contributed" (T-3, 5 CCR §9517(i)) |
| Fine-tuning on Newsela lessons | Their Terms forbid it, and there is no time (L-6) |
| Retrieval over the novel or the article library | We don't have the texts; placeholders are honest (AD-8) |
| A Google-Docs-grade editor (comments, track changes, history) | No requirement asks for it; Yjs is adopted minimally (AD-6) |
| A per-reviewer speed leaderboard | It would drive rubber-stamping (E-4) |
| Anything student-facing | Staff-side AI is the accepted side of the market [Sent §10] |
| A fake "Publish to Newsela" button | No integration was specified; we ship an export and say so (T-20) |

---

## 8. Risks and open questions

Each item carries the working assumption we build on, so no answer blocks the build.

| # | Risk or question | Why it matters | Working assumption | Source |
|---|---|---|---|---|
| R-1 | Long structured drafts truncate or break the schema | A lesson's teacher edition is ~3,000 words (*calculation*) | Typed blocks + compiler (DIR-3); raise the output cap once on truncation; fall back to one call per section if the 3-lesson trial shows truncation | N-12, DIR-3 |
| R-2 | Lessons read as generic even when every check passes | The "articles, not curriculum" doubt (F-15) | Unit plan + arc checks + type templates; activity patterns labelled as prototype placeholders for Newsela's designers | E-5, T-8 |
| R-3 | Too many quote placeholders make lessons feel unfinished | Reviewers must insert evidence by hand | Correct by design: a placeholder is cheaper than catching an invented quote. We report the count, and the public-domain allowlist (Stretch) reduces it | T-1, AD-8 |
| R-4 | The judge disagrees with experts | It could mislead reviewers | Advisory only, labelled provisional; ~30-pair calibration with its agreement rate reported | AR-13, GP-49 |
| R-5 | Hosting spend over the $40/month cap | ~$20 more for Render on top of three running projects | **Needs Innocent's own OK before provisioning** (AD-15 ⚠). If declined, demo locally and say so | AD-15 |
| R-6 | The ca-2026-review content leaks into the repo, prompts or video | Pre-adoption, likely confidential material | Restricted folder git-ignored; Unit 4 held out; video shows only generated output; repo private | T-4, AD-3, AD-4 |
| R-7 | Two people edit one lesson at the same time more often than assumed | Merge conflicts, lost updates | Yjs merges; load script measures; usually 1–3 per lesson | AQ-3, AD-6 |
| R-8 | Our schema differs from Newsela's authoring system | Export may need mapping | Mirror the review site's node types; schema in `docs/contracts/` | AQ-4, [Struct §10 Q1] |
| R-9 | Unit number U3 vs U4 | Wrong addresses everywhere | Unit 4 (the site's Unit 4 is this myth unit); the conflict is shown on the report | AQ-5, AD-9 |
| R-10 | Flex days and double lessons | Unit size and timings | Flex rows → Flex Day lessons (5/40/5); each double row → one 50-minute lesson in a two-day task | AQ-6, AD-10 |
| R-11 | Who resolves parent codes into leaves and ELD into levels | Alignment records and the coverage matrix | The generator proposes, marked "AI-proposed"; the reviewer confirms | AQ-8 |
| R-12 | ELD code vs label: which is the designer's intent? | Different supports for the same row | Code stays the record; official text shown; one-click re-map on the report (DIR-5) | [Stds], DIR-5 |
| R-13 | Is the next program 9–12, K–5, another state or the corrections package? | Which features rise up the roadmap (FE-36 for corrections, FE-38 for year coverage) | All of them follow; the MVP serves any new unit outline | [Profile §10.5 Q1] |
| R-14 | Disclosure of AI involvement to the state, districts or teachers | Policy and trust | Not ours to decide; the provenance record always exists (FE-27, FE-35) | AQ-12, E-9 |
| R-15 | No baseline for review minutes per lesson | We can't claim savings | Report measured numbers and the labelled assumption ($600–1,350 per lesson authoring) | AQ-14, AD-19 |
| R-16 | Time: 34 MVP features in ~2.5 days | A thin layer of everything (T-6) | The cut order in §6; items 1–7 are never cut; the full-unit run and honest numbers come before any late feature | T-6, AD-1 |
| R-17 | Should the questions in [Audit §9] go to Newsela? | Answers would firm up R-8 to R-14 | Drafted, not sent. **Innocent's call** (AD-20 ⚠) | AD-20 |
| R-18 | The zero-to-hero gates (PRD approval, UX and System tracks) don't fit 2.5 days at full depth | Process versus deadline | Run the gates light, and record any skip in `PROJECT-CHECKLIST.md`'s *Skips* table with Innocent's decision; never skip silently | `PROJECT-CHECKLIST.md`; rule `new-project-zero-to-hero` |

---

## Traceability matrix: friction × feature

Rows are frictions; columns are feature groups; each cell lists the features in that group that resolve the friction.
Every feature appears at least once (checked below the table).

| Friction | A Intake | B Plan | C Generate | D Verify | E Review | F Approve | G Prompts | H Evidence | I Observe | J Access |
|---|---|---|---|---|---|---|---|---|---|---|
| F-1 Dirty outline | FE-1, FE-2, FE-3, FE-4 | | | | | | | | FE-41 | |
| F-2 Human notes in cells | FE-5 | | FE-10 | | | | | | | |
| F-3 Invented quotes, copyright | FE-5 | | FE-10 | FE-16 | FE-22 | FE-26 | | | | |
| F-4 "Aligned" unprovable | FE-3 | | FE-12 | FE-16, FE-17, FE-18 | FE-22 | | | FE-32, FE-33 | | |
| F-5 Review fatigue, rubber stamp | | | | | FE-20, FE-22 | FE-25, FE-26, FE-28, FE-29 | | | FE-40 | |
| F-6 Arc drift | | FE-7, FE-8 | | | | | | FE-33 | | |
| F-7 Format fidelity | | | FE-9, FE-11, FE-12, FE-13 | | FE-21 | | | FE-34 | | |
| F-8 Silent prompt changes | | | | | | FE-27 | FE-30, FE-31 | | | |
| F-9 Long runs, no visibility | | | FE-14, FE-15 | | | | | | FE-39 | |
| F-10 Overwrite of reviewed work | FE-1, FE-6 | | | | FE-24 | | | | | |
| F-11 Collaboration and AI edits | | | | | FE-21, FE-23 | | | | FE-42 | FE-43 |
| F-12 Approval not version-pinned | | | | | | FE-25, FE-27 | | | | |
| F-13 Evidence maps by hand | | | | FE-17 | | | | FE-32, FE-33, FE-35, FE-38 | | |
| F-14 ELD watered down | FE-3 | | FE-11 | FE-16, FE-18 | | FE-26 | | FE-37 | | |
| F-15 Core quality bar | | FE-8 | FE-9, FE-12 | FE-16 | | | | | FE-41 | |
| F-16 Sensitive content | | | | FE-19 | | FE-26 | | FE-38 | | |
| F-17 Anxiety and credit | | | | | FE-23 | FE-27 | | FE-35 | FE-40 | |
| F-18 Unbounded cost | | | FE-14 | | | | | | FE-39 | FE-43 |
| F-19 Corrections cycle | | | | | | FE-27 | | FE-36 | | |

**Reverse check (every feature resolves at least one friction):** FE-1 (F-1, F-10) · FE-2 (F-1) · FE-3 (F-1, F-4,
F-14) · FE-4 (F-1) · FE-5 (F-2, F-3) · FE-6 (F-10) · FE-7 (F-6) · FE-8 (F-6, F-15) · FE-9 (F-7, F-15) · FE-10 (F-2,
F-3) · FE-11 (F-7, F-14) · FE-12 (F-4, F-7, F-15) · FE-13 (F-7) · FE-14 (F-9, F-18) · FE-15 (F-9) · FE-16 (F-3, F-4,
F-14, F-15) · FE-17 (F-4, F-13) · FE-18 (F-4, F-14) · FE-19 (F-16) · FE-20 (F-5) · FE-21 (F-7, F-11) · FE-22 (F-3,
F-4, F-5) · FE-23 (F-11, F-17) · FE-24 (F-10) · FE-25 (F-5, F-12) · FE-26 (F-3, F-5, F-14, F-16) · FE-27 (F-8, F-12,
F-17, F-19) · FE-28 (F-5) · FE-29 (F-5) · FE-30 (F-8) · FE-31 (F-8) · FE-32 (F-4, F-13) · FE-33 (F-4, F-6, F-13) ·
FE-34 (F-7) · FE-35 (F-13, F-17) · FE-36 (F-19) · FE-37 (F-14) · FE-38 (F-13, F-16) · FE-39 (F-9, F-18) · FE-40
(F-5, F-17) · FE-41 (F-1, F-15) · FE-42 (F-11) · FE-43 (F-11, F-18). **No orphan features; no unaddressed friction.**

## Decisions recorded in this document

| ID | Decision | Status |
|---|---|---|
| DIR-1 | Name "Newsela Lesson Studio"; positioned as an expert-driven production line | Recommendation, pre-approved by Innocent 2026-10-24 |
| DIR-2 | "May only say what it can show", enforced through typed claim records with `asserted_by` | Recommendation, pre-approved by Innocent 2026-10-24 |
| DIR-3 | The model writes a typed `LessonDraft`; code compiles it to ProseMirror; per-section calls as a fallback | Recommendation, pre-approved by Innocent 2026-10-24 (the fallback trigger is an assumption) |
| DIR-4 | Narrow per-lesson context; Unit 4 held out; no full copyrighted text | Recommendation, pre-approved by Innocent 2026-10-24 |
| DIR-5 | ELD mismatches: code stays the record, official text shown, re-map is the designer's logged choice | Recommendation, pre-approved by Innocent 2026-10-24 |
| DIR-6 | Arc continuity checks join the MVP | Recommendation, pre-approved by Innocent 2026-10-24 |
| DIR-7 | Minimal evidence pane joins the MVP | Recommendation, pre-approved by Innocent 2026-10-24 |
| DIR-8 | Unit coverage matrix joins the MVP | Recommendation, pre-approved by Innocent 2026-10-24 |
| DIR-9 | Live demo generates 3 rows (Reading, Writing, Flex); full unit in batch | Recommendation, pre-approved by Innocent 2026-10-24 |
| DIR-10 | Full-run spend cap = measured cost per lesson × 47 × 1.5 | Assumption |

**Still Innocent's own call (not covered by the pre-approval):** hosting spend over the cap (AD-15, R-5), and whether to
send the audit's questions (AD-20, R-17).

**What would reopen a decision.** An answer from Newsela to the matching AQ; a 3-lesson trial that contradicts an
assumption (truncation, cost, concurrency); or Innocent overriding a row. Record the reversal in the PRD's decision
table, not only here.
