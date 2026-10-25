# Visual Review Pages (Stages 1–3 and 6)

Added 2026-10-17 at Innocent's instruction, after a Stage 1 page that was only a Markdown-to-HTML
conversion "technically creates a page, but … does not help me review the work visually."

## What it is, concretely

Before each early gate (Stage 1 Frame, Stage 2 Data reality, Stage 3 Hard problems) and the design
gate (Stage 6, added 1.5.0), Innocent
gets **one standalone, local HTML page** that lets him see, in a few minutes, what the stage
established and what he is being asked to approve.

- It is a **synthesis**, not a copy. Diagrams, timelines, cards, matrices and side-by-side
  comparisons carry the content; prose is short.
- The **Markdown files remain the source of truth.** They are written first. The page is generated
  *afterwards* from them and links back to each one in full.
- When a source changes, the page is **refreshed before any sign-off is asked for**.

A page that is the source document re-flowed into HTML (pandoc output, headings plus paragraphs)
does **not** meet this standard, however tidy it looks.

## Context before content: every problem is told as a story (added 2026-10-19)

Added at Innocent's instruction after the YourAI Stage 3 page showed six hard-problem cards that
opened straight on "options" and "why it's hard". His words: *"you can't just randomly bring this
stuff up because I don't have any context on what's going on."* He reads these pages without the
session's context, so a page that assumes it can't be reviewed.

**The rule.** A page never introduces a problem, choice or uncertain item cold. It does two things:

1. **Opens with "The story so far"** (`data-visual="story"`): a few plain sentences, plus where
   useful a small diagram, saying what the project is for, who uses it and what they are doing,
   what earlier stages settled, and how this stage's items were found. Example: *"YourAI wants
   physicians and attorneys to use outside AI models on their own files without the model provider
   seeing who the files are about. Stage 2 walked ten example documents through the pipeline by
   hand; the places where that walk needed judgement became the six hard problems below."*
2. **Gives every item it asks Innocent to judge three parts, in this order, before any options:**

   | Part | Answers | Must contain |
   |---|---|---|
   | **Where this comes up in the project** (`data-part="context"`) | Where in the product's story does this happen, and how did we get here? | A concrete user, document or moment ("an attorney uploads the litigation memo and asks …"), the step of the pipeline it sits in, and the evidence that surfaced it (worked pair, decision, brief line) |
   | **The problem we're solving** (`data-part="problem"`) | What exactly has to be decided or built? | One plain sentence, then one input → output example |
   | **Why it's hard** (`data-part="why-hard"`) | Why isn't the obvious answer enough? | The reasons, step by step, each tied to a requirement, decision or measurement; not a list of buzzwords |

   Only after those three come the options, recommendation, consequences and measure.

**Where it applies.** Every Stage 1–3 and Stage 6 page, and any later HTML page that asks
Innocent for a decision. On Stage 3 it is mandatory per hard-problem card: the card carries `data-hp="HP-N"` and
the three `data-part` blocks, and `scripts/check_review_page.py` fails a card that lacks one. On
Stage 2 it applies to each uncertain item, and on Stage 1 to the approval request. Mark the parts
in the HTML the same way wherever they appear.

**Sources still rule.** The story is built from the Markdown sources and the brief, and passes the
same claim-to-source check as everything else. Context is explanation, not new facts.

## Write it as a story, in plain words (added 2026-10-19, 1.5.0)

Added at Innocent's instruction after the YourAI Stage 6 page. His words: *"I need explanation to be
story-driven in a way that connects it to the overall grand scheme of the project, all the way down
to the actual explanation for whatever point is trying to be made. Don't just state random things.
Always try to explain it in the context of the project. Be story-driven and try to use an even
fifth-grade reading level. When doing those explanations, feel free to include technical concepts
that aren't fifth-grade reading level. Just make sure that you explain them a bit while you use
them. And if any decision is being asked of me, you also need to explain why you're asking that, in
the same way."* He also asked that a page he studies holds **all** the findings, not a sample.

**The rules.**

1. **Every point hangs on the project's story.** Before a number, a table or a diagram, one or two
   sentences say where it fits: what the product is for, who is using it at that moment, and what
   would go wrong for them if this point were ignored. A fact with no "so what for this project" is
   cut or given one.
2. **Plain words, about a fifth-grade reading level.** Short sentences (aim under 20 words), common
   words, one idea per sentence, active voice. Use "we" for the team and name the person in the
   story ("the attorney", "the nurse").
3. **Technical terms are welcome, but explained where they are used.** The first time a term
   appears, explain it in the same sentence or the next, in everyday words, with a picture from
   daily life when it helps. Example: *"SQLite lets only one writer change the file at a time, like
   one pen passed around a table: everyone else waits for the pen."*
4. **Concrete before abstract.** Show the example (one document, one question, one number) before
   the general rule (global CLAUDE.md, *Explanation style*).
5. **Every decision asked of Innocent says why it is being asked.** Mark it `data-ask="ID"` with four
   parts in this order, before any options: *where this comes up in the project* (`context`), *the
   problem* (`problem`), *why it's hard* (`why-hard`), and **why we're asking you and what your
   answer changes** (`why-asked`): which later work waits on it, what each answer would make us
   build or not build, and what it costs. Then the options, recommendation first.
6. **A study page holds every finding.** When the page is for study (Stage 6 above all), every
   finding in its sources appears: each number with its label ([T]/[A]/[C]/[M]), its reasoning and
   its consequence. A summary may lead, but it never replaces the full findings below it.

`scripts/check_review_page.py` fails a `data-ask` item that lacks any of its four parts or has them
out of order, and **warns** when the page's prose reads above roughly a ninth-grade level
(Flesch–Kincaid). The warning is a prompt to rewrite, not a pass: read it aloud as if to someone
new to the project.

## How it is produced

1. Write or update the Markdown sources. They own every fact, decision and number.
2. Build the page from them. Start from `templates/visual-review-page.html` and keep its tokens,
   components, status vocabulary and metadata contract. Put content in only what the sources say.
3. Record each source's SHA-256 in the page (`<meta name="review-source" content="path|sha256">`)
   so staleness is checkable.
4. Run `python3 scripts/check_review_page.py <page.html> --root <project>` (in this skill folder)
   and fix every failure.
5. Inspect the page in a browser at laptop width (~1280px) and phone width (~400px), in light and
   dark, and in print preview. Fix layout problems. Don't tick what you didn't look at.
6. Link the source(s) → page in the project's `.claude/README.md`, and tick the checklist line.

## Required anatomy

| Part | Must show |
|---|---|
| Header | Stage, page title, **draft/review status**, **date**, **Markdown source paths with direct links** (and their short SHA-256), and the rendered date |
| Status legend | The five status kinds below, with their visual treatment explained |
| Visual summary | One screen that says what the stage established, as a diagram, timeline or card set |
| Stage sections | The stage's expected visuals (below), each item carrying a status |
| Approval request | What exactly Innocent is asked to approve now, what is *not* being approved, and the open decisions, with the recommendation first |
| Footer | *Local file, not published. Markdown is the source of truth*, plus a refresh instruction |

### Status vocabulary (mandatory, shown visually, never colour alone)

| `data-status` | Meaning | Must include |
|---|---|---|
| `fact` | Established: a cited source says it | The source (S-N, file §, or URL) |
| `decision` | Innocent decided it | Date (and rule or ID) |
| `proposal` | Claude proposes it; not decided | Why, and what would settle it |
| `unknown` | Not established | The RQ/GQ, or who could close it |
| `awaiting` | Waiting for Innocent's approval at this gate | What approving it would mean |

Every card, badge, diagram node or table row that states something carries one of these. A
proposal or unknown is **never** styled or worded like a decision. Words such as *approved*,
*final*, *decided*, *confirmed* or *signed off* may not appear in `proposal`, `unknown` or
`awaiting` items, except negated (*not approved*).

## Expected visual content by stage (the form fits the project)

**Stage 1 · Frame**
- **The problem:** the business value first, and a why-chain.
- **The user's journey:** a flow diagram that shows **what the product does versus what humans or
  the organisation decide**.
- **The metrics chain:** north star → supporting → lagging → money, each with its baseline (or
  *unknown*), target labels ([T]/[A]) and guardrails.
- **Scope and cuts:** in, out, the build plan and its cut line.
- **Evidence limits:** what the research could not establish.
- **The current approval request:** what Innocent is asked to approve now.

**Stage 2 · Data reality**
- **Sample coverage:** a matrix of sources × types × edge cases, showing which sample fills which
  cell and what is synthetic, with its assumption.
- **The worked pairs:** shown side by side as input → required output → gap, each with its
  difficulty and confidence badges and its *Innocent to check* flags.

**Stage 3 · Hard problems**
- **The story so far**, then a map of where each hard problem sits in the user's journey through
  the product.
- **One card per hard problem**, starting with HP-1 orchestration. Each card opens with *where this
  comes up in the project*, *the problem we're solving* and *why it's hard* (see "Context before
  content"), then shows the options as small diagrams, the recommendation, and the consequences of
  each option.
- **Status and evidence:** each card's status (open / chosen / needs spike) and the worked pairs
  it rests on.
- **Handled by default:** a short list of the easy problems.


**Stage 6 · Design** (added 1.5.0, 2026-10-19; a study guide, so it may be long)
- **The story so far**: what the project is for, what each earlier stage settled, and what changed
  the design (decisions with their IDs).
- **System map**: where each part runs, what crosses each boundary, what never leaves; trust
  boundaries marked.
- **One real request, traced**: each step, which component does it, and its time against the
  limit, alone and under the stated load.
- **Load and bottlenecks**: the arithmetic for today's size and the scale target, ranked, with what
  each assumption is measured by.
- **The scale path**: ordered steps, the trigger for each, the change, rough cost.
- **Every major decision**: because → chose → over → at the cost of → verify → revisit.
- **Every DO-1/DO-2 finding in full**, each tied back to the story.
- **Open items** as `data-ask` cards (context → problem → why hard → why we're asking), then the
  approval request.

Use inline SVG for diagrams (each with `role="img"`, a `<title>` and a text equivalent nearby), and
CSS grids for cards and matrices. Choose the visual that makes the point. A diagram is required
wherever there is a flow, a sequence, a branch or a chain; a missing one is a review failure.

## Quality bars

- **Standalone and local:**
  - `<!doctype html>`, `lang`, charset, viewport and title;
  - inline CSS (and JS only if needed);
  - **no external assets** (no remote fonts, scripts, images or stylesheets);
  - opens from `file://`.
- **Responsive:** no horizontal page scroll at ~400px; wide tables and diagrams scroll inside their
  own container or reflow.
- **Accessible:** WCAG 2.2 AA contrast (≥4.5:1 text) in light and dark; landmarks and a skip link;
  status shown with text and shape as well as colour; visible keyboard focus.
- **Reduced motion:** `prefers-reduced-motion` respected.
- **Printable:** an `@media print` block, so the page prints legibly on paper.
- **Follows `modern-ui-principles`** (the `ui-*` rules); a project's own design system wins.

## Review check (run before asking for a sign-off)

`scripts/check_review_page.py` fails a page when any of these hold:
1. It is a **plain dump**: it has a pandoc generator tag, has no `data-status` items, or has no
   diagram and no visual summary.
2. A **diagram is missing**: no inline SVG at all (unless the page carries an explicit
   `data-no-diagram-reason`).
3. It is **stale**: any recorded source hash differs from the file now.
4. **Required metadata or links are missing**: stage, status, date, the sources, links to each
   source.
5. It loads **external assets**.
6. **Basics are missing**: `lang`, viewport, print styles, a dark theme, reduced motion, a skip link,
   `main`, SVG titles.
7. **Finality language appears** in `proposal`, `unknown` or `awaiting` items, or the page status
   says *approved* without an approval record.
8. **Context is missing** (2026-10-19): a Stage 3 page has no `data-visual="story"` section or no
   `data-hp` cards, or a `data-hp` card lacks its `context`, `problem` and `why-hard` parts, has them
   out of order, or has one too thin to explain anything. On other stages a missing story section is
   a warning.
9. **A decision item lacks its why** (1.5.0): a `data-ask` element misses `context`, `problem`,
   `why-hard` or `why-asked`, or has them out of order. A Stage 6 page with no story section fails.
   Prose above about a ninth-grade reading level is a **warning**.

Then the human-eye checks the script can't make:
- Does the page imply that an open choice is decided?
- Does every visual match its source?
- **Claim-to-source pass:** search the listed sources for every number, quotation, source ID and
  named organisation on the page. Anything not found is either cited to the file that does hold it
  (and linked) or removed. Check each status badge against the source's own status column (a
  decision recorded in a register is `decision`, not `proposal`).
- Is it readable at phone width and in print? At phone width wide diagrams scroll inside their own
  box, so they need the scroll hint and the numbered text equivalent beneath.

*First build (Riverside Stage 1, 2026-10-17):* the page passed the script while three citations
were wrong: review counts attributed to the audit, a company account that no source contained, and
a regulation section number added from memory. A decided reading was also badged as a proposal. The
claim-to-source pass caught all four.

## Inspection notes (learned 2026-10-18, Riverside Stages 2–3)

- **Embedding a sample image as inline SVG:** the template's `svg text{fill;font-size}` rule overrides
  the image's own `fill` / `font-size` attributes (CSS beats presentation attributes), so a
  document's text can vanish in dark mode and shrink to 13px. Move those attributes into each
  `<text style="…">`, or wrap the image in a class the page CSS excludes. Look at it in dark mode.
- **If the Chrome DevTools MCP can't start** (its profile held by another session — don't kill it),
  command-line headless Chrome works: `--screenshot` at `--window-size=1280,<tall>` per theme (add
  `data-theme` to a temp copy), `--dump-dom` on a copy with a measuring script for overflow and
  contrast, and `--print-to-pdf`. Its narrowest window is **500px**, so a "400px" capture is a clipped
  500px layout; record the width actually measured. Cap each run (it can hang).

## Anti-patterns

- A problem card that opens on its options or on "why it's hard", with no story of where it comes
  up in the project (YourAI Stage 3, 2026-10-18).
- The PRD re-flowed into HTML.
- A diagram that shows a recommended option as the plan.
- One colour for both *decided* and *proposed*.
- A metrics chain without baselines.
- Approval wording on a draft.
- A page last rendered before its source changed.
