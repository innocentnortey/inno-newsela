# Source Register — Newsela Lesson Studio

**Owner of:** every source this project relies on: where it is, how authoritative it is, when it was
captured, and what it can and cannot tell us. Other documents cite sources by `S-N`.
**Started:** 2026-10-24.

**Authority labels (highest first):**
- **ISSUED:** text or data the partner handed over via Gauntlet. Wins every disagreement.
- **ISSUED-REFERENCE:** partner content the brief points to as a reference ("Example of lesson and
  format/structure … feel free to navigate to other examples too"). Authoritative for *form*, not a
  requirement in itself.
- **PROPOSED:** our own drafts awaiting Innocent's decision (PRD, decisions). None yet in this folder.
- **DERIVED:** our analyses of the sources above.
- **CONTEXT:** background that explains, never adds a requirement. Includes official public
  standards documents (PRIMARY text, but context for this project: they define codes, not the product).

## Handling rule for restricted material (2026-10-24, coordinator's legal-audit instruction)

The review site `ca-2026-review.newsela.com` is very likely the **state adoption reviewers' copy**
of Newsela's *Threads & Themes* Grades 6–8 program (CA 2026 ELA/ELD adoption; its course page lists
"Reviewer Resources" such as *Evaluation Criteria Map: Program Type 1*). Its content is Newsela's
copyrighted work, captured only for analysis because the brief invites it.

- Full lesson text, raw page data, screenshots, program PDFs and the raw sheet exports live under
  **`docs/source/restricted/`**, which is listed in `inno-newsela/.gitignore` and must never be
  committed, mirrored, deployed or pasted into a prompt that leaves the machine without Innocent's say-so.
- Tracked files describe structure, fields, section names, timings and patterns, with at most a
  sentence or two of excerpt where a field's form needs showing.
- **Held-out evaluation set.** The sample outline is the program's own Grade 6 Unit 4 (the site's
  *Unit 4: Myths, Monsters & Modern Stories*). The 45 real Unit 4 lessons (S-5) are a **held-out
  evaluation set: never used as few-shot examples, retrieval context or fine-tuning data for
  generation.** Few-shot examples, if any, come from other units (S-3, S-4), and only from their
  structure unless Innocent decides otherwise.

## ISSUED

| ID | Source | Path | Origin | Captured | What it can tell us | Limits |
|---|---|---|---|---|---|---|
| S-1 | Portal brief, *Lesson Content Generation and Editing/Approval Workflow* (Silver, Version 1, last updated 10/19/2026) | [`01-project-brief.md`](01-project-brief.md) | Gauntlet portal, pasted by Innocent into `Gauntlet AI/artifacts/2026-10-13-partner-briefs/newsela-project-brief.md` | 2026-10-24 | The requirements, benchmarks (async generation, 20+ reviewers), stack (Next/Node, React, OpenAI/Anthropic, ProseMirror + Yjs), deliverables, 1–2 day timebox | No due date in the text. "Off-Limits Tech" field holds guidance prose, not a list (form misfiling). No attachments. |
| S-2 | Sample Unit Outline, Google Sheet `1OfigF5jtwagY8jJMk5g536tAgykkIR6xHGa0Bic_QnE`, tab *Lesson Outline* | Rendering: [`02-sample-unit-outline.md`](02-sample-unit-outline.md); structured: [`../data/samples/g6-u4-lesson-outline.json`](../data/samples/g6-u4-lesson-outline.json); raw: `restricted/originals/sheet-export.{xlsx,csv}`, `tab-lesson-outline.gviz.csv`, `sheet-htmlview.html` | https://docs.google.com/spreadsheets/d/1OfigF5jtwagY8jJMk5g536tAgykkIR6xHGa0Bic_QnE/edit?usp=sharing (public, no sign-in) | 2026-10-24 | The generator's input format: 16 columns, 41 lessons + 6 flex days for G6 U4 *The Lightning Thief* | One unit only; an earlier draft of what was published (see `02` §6); many inconsistencies (`02` §5). The live sheet may change; our copy is the 2026-10-24 export. |
| S-2h | Hidden tab *CG Working Tab 6.3 DELD Scope &* in the same sheet | `restricted/originals/tab-hidden-cg-working-tab-6.3-deld-scope.from-xlsx.csv` | xlsx export only | 2026-10-24 | Column names of a Designated-ELD planning template (Launch / Literacy Lab / Learning in Action / Look Back ideas) | Nearly empty; for Grade 8 Unit 4, not this unit. Probably left in by accident; not a requirement. |

## ISSUED-REFERENCE (the review site the brief links)

| ID | Source | Path (all git-ignored) | Origin | Captured | What it can tell us | Limits |
|---|---|---|---|---|---|---|
| S-3 | The linked example: Grade 6 Unit 1 Lesson 1 "Ordinary Moments, Extraordinary Stories, Part 1" (Spark) | `restricted/03-example-lessons/01-…md`, `restricted/originals/lessons-json/g6-u1-l01.json`, screenshots `restricted/originals/g6-u1-l01-screenshot-{collapsed,expanded}.png` | https://ca-2026-review.newsela.com/course/cmkfw4elj004k8a90yvyfyfb8/unit/ck73kftqkdhaojqgqft3acmy/lesson/c0c4tx7u3mnezs5w9u8vzvi1 | 2026-10-24 21:01 UTC | Front matter and section layout as the brief describes | A **Spark** lesson: no Literacy Lab, 15-minute Launch, no `materials` field. Not the typical shape. |
| S-4 | Five more lessons outside the sample's unit: G6 U1 L22 (Research), G6 U1 L45 (Academic Discussion), G8 U2 L23 (Reading), ELD Core 6 U4 L1 (Designated ELD) — plus G6 U4 L4 and L5 rendered for reading (those two belong to S-5) | `restricted/03-example-lessons/02…07-*.md`, `restricted/originals/lessons-json/` | same site | 2026-10-24 | How the structure varies by lesson type, grade and course (ELA vs Designated ELD) | Seven lessons rendered of ~1,080 on the site; Grade 7 not sampled. |
| S-5 | **All 45 lessons of G6 Unit 4 "Myths, Monsters & Modern Stories"** — the published version of S-2's unit. **Held-out evaluation set.** | `restricted/originals/lessons-json/g6-u4-l01…l45.json` | same site, unit `c0rwxfse5262agf59dprt4ll` | 2026-10-24 | A human-finished target for the same unit: lesson types, timings, standards, structure; the main evidence behind `04` | Not a clean pair with S-2: lessons were added, merged and re-standardised (`02` §6). Contains Newsela's own slips (typos, merged vocabulary entries, malformed codes). Never a few-shot source. |
| S-6 | Site structure: course list (6 courses: ELA Core 6/7/8, ELD Core 6/7/8), course outlines (4 units × 44–46 lessons), G6 U1 and U4 unit pages | `restricted/originals/site-structure/*.json`; summary in `restricted/03-example-lessons/README.md` | `/`, `/course/<id>`, `/course/<id>/unit/<id>` | 2026-10-24 | Program shape: 4 units per course, ~45 lessons per unit, "9 weeks" per unit; unit overview fields (EQs, arcs, performance task, assessments) | Structure only; we did not read unit-level PDFs (assessments, performance task). |
| S-7 | Newsela *ELA Design Framework* (Threads & Themes, Grades 6–8), 61 pp. | `restricted/originals/program-resources/ela-design-framework.pdf` | https://media.newsela.com/core/pdfs/c524nu8omludo542fluwykwc.pdf (linked from the G6 course page, *Teacher Resources*) | 2026-10-24 | Newsela's own definition of the unit arc, the 7 lesson types, the 4-phase lesson (Launch 5, Literacy Lab 10, Learning in Action 30, Look Back 5) and the I-ELD Purpose / Say-Ask / Watch-For pattern | Describes design intent; the captured lessons deviate in places (Spark 15-minute Launch, 16-day investigations). Read in part (sections 1–3, 9). |
| S-8 | *ELA Routines Guide* (54 pp.) and *Grade 6 ELA Scope and Sequence* (53 pp.) | `restricted/originals/program-resources/` | `media.newsela.com/core/pdfs/c67ps0xhep4273beo497ndog.pdf`, `…/cu20ngr47zzhp91vur2omyyy.pdf` | 2026-10-24 | Routine definitions (Quick Write, Pulse Check, Think-Pair-Share…) and the year's scope | **Downloaded, not yet read.** Read before writing generation prompts for routines. |

## DERIVED

| ID | Document | Built from | Status |
|---|---|---|---|
| D-1 | [`02-sample-unit-outline.md`](02-sample-unit-outline.md) — column meanings, arc, 23 oddities, sheet ↔ published mapping | S-2, S-2h, S-5 (titles and standards only) | written 2026-10-24 |
| D-2 | [`04-lesson-structure-analysis.md`](04-lesson-structure-analysis.md) — ProseMirror schema, front matter, sections, voices, supports, draft output contract | S-3, S-4, S-5, S-7 | written 2026-10-24; the output contract is a **draft** until the PRD adopts it |
| D-3 | [`05-standards-referenced.md`](05-standards-referenced.md) — every code in the sheet with official text and problems | S-2, C-1…C-3 | written 2026-10-24 |
| D-4 | [`capture-notes.md`](capture-notes.md) — how each capture was made and how to repeat it | all of the above | written 2026-10-24 |
| D-5 | [`../data/samples/g6-u4-lesson-outline.json`](../data/samples/g6-u4-lesson-outline.json) — the sheet as structured rows | S-2 | written 2026-10-24 |

## PROPOSED

None in `docs/source/`. The PRD (`docs/prd/newsela-prd.md`, in progress) will be the first.

## CONTEXT

| ID | Source | URL | Captured | Used for | Limits |
|---|---|---|---|---|---|
| C-1 | California Common Core State Standards for ELA/Literacy (CDE) | https://www.cde.ca.gov/be/st/ss/documents/finalelaccssstandards.pdf | 2026-10-24 | Official grade 6 RL/RI/W/SL/L text in D-3 | Three-column layout makes text extraction unreliable; checked by eye where needed |
| C-2 | California English Language Development Standards K–12 (CDE, 2014) | https://www.cde.ca.gov/sp/el/er/documents/eldstndspublication14.pdf | 2026-10-24 | Official ELD strand names and grade 6 text in D-3 | Text differs by proficiency level; D-3 quotes Expanding only |
| C-3 | Model School Library Standards for California Public Schools (SBE, 2010) | https://www.cde.ca.gov/be/st/ss/documents/librarystandards.pdf | 2026-10-24 | Identifying column L's codes (Grade Six) | 2010 document; no newer edition checked |

The CDE PDFs were read from a temporary download and are not stored in the repo; the URLs are the
record.
