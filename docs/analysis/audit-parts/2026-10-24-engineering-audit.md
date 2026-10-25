# Newsela brief — engineering-principles audit (part of the three-person adversarial audit)

**Reviewed:** 2026-10-24. **Auditor role:** engineering principles. **Stance:** the brief was read as if the owner
wanted something that demos well but fails at their real scale or cannot be defended. **Owner of:** finding IDs `N-`
and the engineering requirements `ER-`. **Status:** hypotheses until checked against the example lessons and answered
by Newsela. Nothing here has been sent to anyone.

## Summary

1. The brief asks for six products in 1–2 days. Literally that means bulk generation, a job system, a WYSIWYG editor, real-time collaboration, AI editing and an approval workflow. The defensible slice is a **fixed generation pipeline with checks**, a **review editor on their stack**, and an **approval state machine**. Everything else is named as a cut or faked and labelled (N-1).
2. The core claim, "standards aligned", has no definition and no check. If we build it as written, the demo shows lessons that *look* aligned and nobody can prove it. We make alignment a structured output that code can check, plus a calibrated judge (N-5).
3. "OK to improvise" plus a copyrighted novel is the most dangerous pair. The model will invent quotes, page numbers and Newsela articles it has never seen. We improvise *activities*, never *facts about texts* (N-6, N-7).
4. "ProseMirror and Yjs" quietly imposes a sync server, a storage-format decision and an AI-edit conflict problem. "Performant for 20+ reviewers" is unmeasurable as written. Serverless hosting (Vercel) cannot run either the generation jobs or the websockets (N-3, N-4, N-17, N-20, N-21).
5. The issued sample sheet is dirty, and that is the first trap a literal build hits. It is labelled "U4" but every filename says "U3". It has 41 lessons plus 6 flex days (47 days, not "~40"), a malformed standards cell (`RL.6.1, 6.2 L.6.4`), a range (`W.6.2.a–f`), a filename typo (`L309`) and a concatenated filename. Ingestion needs a validation step a human confirms (N-8).

## How to read this

- **Severity.** *Critical* means a literal build fails the brief's core purpose or can't be defended in the interview. *High* means it fails at their real use or real scale. *Medium* means it is a visible gap a grader will probe. *Low* means it is polish.
- **Evidence used.** The verbatim brief in `Gauntlet AI/artifacts/2026-10-13-partner-briefs/newsela-project-brief.md`, and the issued sheet export in `docs/source/originals/sheet-export.csv`, which I profiled row by row. **Not used:** the example-lesson site (`ca-2026-review.newsela.com`). I did not open it, so the claims below about lesson sections come from the brief's own words ("Launch, Learning In Action, Look Back"). Whoever crawls it must confirm them.
- **Number labels (GP-119).** Every number is marked as a *target*, an *assumption*, a *calculation* or a *measurement*.
- **The response field.** It says whether the finding becomes a requirement (`ER-n`, collected at the end), a cut, a design choice or a question (`Q-n`, collected at the end).

---

## Findings

### N-1 — Six products in one to two days

- **Brief:** "AI Generate lessons for an entire Unit…", "Import the generated lesson content into a system for persistence and tracking", "UI/UX for reviewing and editing/updating a lesson's content in the system (wysiwyg), and AI assisted tooling as helpful", "UI/UX for approval workflow", "bonus points if you allow the editing of the prompt … and let them view the generation in process", "ProseMirror and Yjs for the frontend/collaborative editor", "Time Constraints: 1-2 days".
- **Malicious reading:** each line is a reasonable request on its own, and together they are weeks of work. The tempting response is to build a thin layer of every feature. The result is a demo where everything appears and nothing holds up: collaboration that drops edits, alignment nobody checked, and a job system that loses lessons when it restarts.
- **If built literally:** breadth wins over depth. Then the one part Newsela can't already do in-house, generating aligned lessons at quality, gets the least engineering. GP-109 says design depth goes exactly there.
- **Severity:** Critical.
- **Honest reading:** they want to see judgment about which slice proves the idea. Their own grading prose (see N-2) rewards "thoughtful design" and "productivity of internal staff", not feature count (GP-128).
- **Response:** a design choice. The slice is defined in *The minimum defensible slice* below, with a drop order if time runs out. The generation pipeline with checks comes first, the review editor and approval second, and the collaboration depth third. Every cut is named in the submission's conformance table.
- **GP:** GP-3, GP-30, GP-31, GP-109, GP-120, GP-128.

### N-2 — Misfiled fields: "Off-Limits Tech" holds the grading criteria, and the stack sits under "Other Requirements"

- **Brief:** Off-Limits Tech: "Thoughtful design and easy to understand/use/navigate workflow; creativity and resourcefulness to work with creating a solution for improving productivity of internal staff. Please see details in description fields…". Other Requirements: "ProseMirror and Yjs for the frontend/collaborative editor".
- **Malicious reading:** two readings are both wrong. One treats the field as a list of banned tools and hunts for something hidden. The other ignores it because it is "only" the off-limits field, and so misses that it is the clearest statement of how the work is judged. Meanwhile the real stack constraint sits in a field that sounds optional.
- **If built literally:** someone skips ProseMirror and uses a different rich-text editor because it is "only other requirements". They then fail a stated stack requirement. Or they over-read "collaborative" into a full Google-Docs clone.
- **Severity:** Medium.
- **Honest reading:**
  - **Nothing is off-limits.** The field holds evaluation criteria: a navigable staff workflow and staff productivity.
  - **ProseMirror and Yjs are their production editor stack,** stated so our work could be lifted into their codebase. Treat them as required.
  - **Real-time co-editing is not in any functional requirement.** The functional requirements say "review, edit/update", never "simultaneously".
- **Response:**
  - Requirement ER-1: the editor is ProseMirror-based, with a Yjs binding.
  - Questions: Q-1 (is a Tiptap wrapper, which is built on ProseMirror, acceptable?) and Q-2 (do two reviewers ever edit the *same lesson* at once, or does each reviewer own lessons?).
  - Record both readings in the brief-conformance table.
- **GP:** GP-121, GP-122, GP-129.

### N-3 — Yjs brings a server, persistence, awareness and auth with it

- **Brief:** "ProseMirror and Yjs for the frontend/collaborative editor".
- **Malicious reading:** "Yjs" reads as a library you import. In practice it is a distributed system:
  - a sync server (y-websocket or Hocuspocus);
  - persistence of the binary document updates;
  - an awareness channel (who is here, and where their cursors are);
  - authentication on the websocket, which is a separate entry point from your HTTP auth.
- **If built literally:** a demo using `y-webrtc` or an in-memory y-websocket works in two tabs. In production it loses every edit on restart, lets anyone with the doc name join, and drifts from the database copy the approval and export read (GP-117: two stores written separately are not consistent).
- **Severity:** High.
- **Honest reading:** if we adopt Yjs, we adopt it properly but minimally.
- **Response:** design choice:
  - **Server:** one Hocuspocus server (Node) with its database extension. It stores the Y.Doc state in Postgres, debounced with a target of ≤2 s.
  - **Auth:** `onAuthenticate` checks the same session as the web app, and checks the lesson's state, so an approved lesson is read-only.
  - **Out:** awareness limited to cursors and names; no comments, no offline mode, no version-history browser.
  - **Authority (GP-117):** during editing, the Y.Doc is authoritative. Each store also writes the derived ProseMirror JSON, so every other reader (checks, approval, export) reads one consistent copy (see N-4).
  - Requirement ER-2.
- **GP:** GP-110, GP-116, GP-117, GP-30.

### N-4 — Which format is canonical: Yjs binary, ProseMirror JSON, or a lesson schema?

- **Brief:** "It is ok if the generated lesson content is stored as content separate of the visual template … what's important is that we generate standard aligned content to fill out the lesson."
- **Malicious reading:** the easy path generates one big HTML blob per lesson, loads it into ProseMirror and saves Yjs binary. It looks finished. But nothing can check alignment, export, diff or migrate a binary CRDT log or a free-text blob. Worse, once standards live as free text in the WYSIWYG, any reviewer edit can silently break the alignment record.
- **If built literally:** approval cannot verify anything. "Publish to our application" means hand-converting HTML. Reviewer-edit metrics (N-23) can't be computed per section.
- **Severity:** Critical.
- **Honest reading:** "content separate of the visual template" invites a **structured lesson schema**. That is the right call (GP-5).
- **Response:** design choice, requirement ER-3:
  - **Lesson record:** a versioned, typed `Lesson` schema (GP-105). Front matter is typed fields: lesson id, unit, arc, type, minutes, focus and supporting standards, text-set references, vocabulary, ELD standards and homework. The sections follow the order of the example lessons.
  - **Each section** holds its rich text as ProseMirror JSON, plus a structured list `activities[]`. Each activity carries `minutes` and `standards_addressed[]` (codes from the row only).
  - **Standards and timing are form fields, not editor text,** so checks still work after edits.
  - **Live editing:** one Y.Doc per lesson, with one `XmlFragment` per section.
  - **Storage:** the Y.Doc binary is kept for editing, and ProseMirror JSON is derived on each store.
  - **Versions:** an immutable `lesson_version` row is written at generation, at each approval and at each reopen.
  - Schema changes bump `schema_version` and come with a migration note.
- **GP:** GP-5, GP-10, GP-73, GP-76, GP-84, GP-105, GP-117.

### N-5 — "Standards aligned" has no definition and no check

- **Brief:** "aligned to teach the CA Core ELA/ELD standards numbers indicated in the sheet (e.g., RI.6.4, -- standards and definitions can be found online)", "what's important is that we generate standard aligned content". No eval, no acceptance test.
- **Malicious reading:** "aligned" is the product's whole value and the one thing never measured. A model will happily write "This activity addresses RL.6.2" next to an activity that doesn't. In a demo, that sentence *is* the evidence. A state adoption review will not accept it.
- **If built literally:** we claim alignment with no number. That is a "good feeling, not a result" (GP-131), and a green pipeline means only that it ran (GP-58).
- **Severity:** Critical.
- **Honest reading:** alignment is checkable in layers, cheapest first (GP-41):
  1. **Schema check (code).** The output validates against `Lesson`. Every required section is present. Activity minutes sum to 50 ± 5 for a single lesson; the tolerance is a *target* until Newsela confirms it (Q-6 covers double lessons).
  2. **Coverage check (code).** Every *focus* standard in the row is in at least one activity's `standards_addressed`. No activity cites a code outside the row's focus, supporting or ELD lists, so the model cannot invent standards. Every code resolves in a seeded table of CA ELA, ELD and media-literacy standards, with their official text.
  3. **Alignment judge (LLM, binary, one claim at a time).** For each (activity, standard) pair, the judge sees the standard's official text, the activity and a rubric. It answers: "does this activity require students to do what the standard describes?" (GP-47). It runs on a different model family from the generator.
  4. **Human calibration.** A human labels a sample of about 30 pairs blind. We report how many real failures the judge caught and how many real passes it cleared (GP-48). This has a real limit: Innocent is not a CA ELA expert. So we label the calibration as provisional and ask Newsela for expert-reviewed anchors (Q-7). Real lessons from the example site are positive anchors. Deliberately broken copies, such as a standard swapped or an activity removed, are negatives (GP-36).
  5. **The reviewer.** The approver sees the coverage table and any judge flags *before* approving (GP-17).
- **Response:**
  - Requirements ER-4 (checks 1 and 2 block a lesson from leaving `generation_failed`, after one repair round), ER-5 (judge with calibration record), ER-6 (seeded standards table).
  - Decide the blocking rules before the first run (GP-50). Checks 1 and 2 have a floor of 100%. The judge is reported and doesn't block until it is calibrated.
  - Eval set: about 10 outline rows spanning the lesson types (reading, writing, discussion, double, flex), committed with results (GP-19, GP-40, GP-43).
- **GP:** GP-16, GP-19, GP-20, GP-40, GP-41, GP-42, GP-43, GP-47, GP-48, GP-49, GP-50, GP-53, GP-58, GP-131.

### N-6 — "OK to improvise" meets a copyrighted novel the model only half-remembers

- **Brief:** "its OK to improvise what content goes in there based on the examples"; "referencing text/novel indicated in the provided unit outline sheet". The sheet: *The Lightning Thief* (ISBN 9780786838653), with page-level reading assignments such as "Ch. 1 (pp. 1–8)".
- **Malicious reading:** the brief gives permission to improvise, and the outline needs text-dependent questions about specific pages. The model will produce confident quotes, page numbers and plot details from memory. Some will be wrong, and some may be long verbatim passages of a copyrighted work. These would ship inside a product submitted for state adoption.
- **If built literally:**
  - Lessons cite quotes that aren't on page 3.
  - Reviewers must fact-check every line against the book, which wipes out the time the tool was meant to save.
  - Long reproduced passages create an IP exposure. The legal auditor owns that question; the engineering control is below.
- **Severity:** Critical.
- **Honest reading:** improvise the **pedagogy**: activity design, discussion moves, scaffolds and exit tickets. Never improvise **facts about texts**. The outline row is the binding spec. The example lessons are the format guide (GP-6, GP-18).
- **Response:** requirement ER-7:
  - **Grounding rule in the locked prompt layer.** The model may refer to the novel only by the chapter and page ranges the outline gives. It must not invent a quote. Where a lesson needs one, it emits a typed placeholder, e.g. `{"kind": "text_evidence_needed", "chapter": 1, "pages": "1–8", "purpose": "…"}`, rendered as a highlighted "reviewer to insert" block.
  - **A code check** flags any quoted string over 12 words (a *target*) that is attributed to the anchor text, and any page number outside the row's stated range.
  - **Provenance badges** per field: from outline, generated, or needs source.
  - **Retrieval over the actual novel is a named cut** (we don't have a licensed copy). If Newsela supplies texts, it becomes the next step (GP-26).
- **GP:** GP-6, GP-18, GP-25, GP-26, GP-84, GP-90.

### N-7 — Text sets we don't have: Newsela articles, and "Writer should select paragraphs"

- **Brief and sheet:** text-set cells such as `"What Are Myths?" Newsela article`, `A Short History of Greek and Roman Myth (Newsela)`, `3 passages from Coolidge's Prometheus/Pandora myths`. Lesson 2's description says "(Writer should select paragraphs to assign)".
- **Malicious reading:** the outline was written for a *human freelancer with access to Newsela's library*. It contains instructions to that writer. The model has neither the library nor the books. It will write a plausible summary of an article it has never read and "select paragraphs" that don't exist.
- **If built literally:** lessons that read as complete but reference invented content. This is the hardest kind of error for a reviewer to catch, because nothing looks missing.
- **Severity:** High.
- **Honest reading:** this is where human authoring stays. The generator should make the gap visible, not paper over it.
- **Response:** design choice:
  - Cells with writer-directed instructions ("Writer should…", "select", "choose") produce a `writer_task` item on the lesson, not invented content.
  - Text references are carried through verbatim from the outline as structured `text_set[]` entries, with a `content_available: false` flag.
  - Q-8: can Newsela provide article text or IDs, so a later retrieval step can ground these?
- **GP:** GP-6, GP-18, GP-92, GP-123.

### N-8 — The issued sample outline is dirty, and the brief calls it ~40 lessons

- **Brief:** "a google spreadsheet of ~40 lessons", "4 sequential units of ~40 lessons each", "Each lesson represents about ~50 mins". **What the sheet actually contains** (*measurement*, `sheet-export.csv`):
  - Row 1 is a title ("G6, U4: The Lightning Thief…"). The real header is row 2.
  - The title says **U4**. All 41 filenames say **U3** (`L1_ELA_TE_G6_U3_CA_Core`).
  - **41 numbered lessons + 6 "End-of-Arc Flex Day" rows = 47 days** (the sheet's own total row says 47). That is not ~40.
  - Arc summary rows sit between lessons ("Across Lessons 4-19, students: …") with no filename. There are 11 such rows with a description but no lesson number.
  - Malformed standards: L4's focus is `RL.6.1, 6.2 L.6.4` (a missing prefix and a missing comma). Range notation: `W.6.2.a–f` in supporting standards. Media-literacy codes have no prefix (`2.1.a`). Some codes must be checked against the official list (e.g. `RL.6.9.a`).
  - Filename defects: `L309_…` for Lesson 39, and `L35_ELA_TE_G6_U3_CA_CoreL30_ELA_TE_G6_U3_CA_Core` (two names pasted together).
  - L23 and L24 are "Core Writing (Double Lesson)" but each is marked 1 day.
  - Cells are long multi-line prose (mean about 530 characters, longest 1,512).
  - Flex days have descriptions but no standards.
- **Malicious reading:** the happy-path parser reads row 1 as the header, or skips the summary rows, or silently drops `6.2`. Then the pipeline generates 41 lessons with wrong unit IDs and a missing standard, and nobody sees it, because generation "succeeded" (GP-58).
- **If built literally:** errors made at ingestion carry into every downstream check. The coverage check would pass against the *wrong* standards list.
- **Severity:** High.
- **Honest reading:** the outline is human-authored and will always be a little messy. The tool's job is to show the mess before money is spent on it.
- **Response:** requirement ER-8:
  - **A deterministic normalizer (code, not a model):**
    - finds the header row by its known column names;
    - classifies each row as `lesson`, `flex_day`, `arc_header` or `total`;
    - attaches each arc-header row's text to the lessons in its arc as context;
    - expands ranges (`W.6.2.a–f`);
    - parses standards against the seeded table;
    - takes the lesson ID from the "Lesson #" column, not the filename.
  - **A validation report screen**, shown before generation. It lists every row as OK, warning or error, with the original cell text. Unresolved codes (`6.2`), unit mismatches (U3 vs U4) and filename defects need a human to confirm or edit before "Generate" is enabled (GP-17).
  - **Flex days** are generated as light lessons or skipped. Q-5 asks which.
  - **Double lessons** need an answer: 100 minutes, or two 50-minute halves? That is Q-6; the timing check depends on it.
  - **Fixtures:** the sheet becomes the parser's first fixture, with each defect pinned as a test (GP-42, GP-45).
- **GP:** GP-4, GP-5, GP-17, GP-24, GP-42, GP-45, GP-58, GP-123.

### N-9 — "Upload or link": a public-link demo fails on real internal sheets

- **Brief:** "upload the spreadsheet/link for a Unit"; "That outline is a google spreadsheet".
- **Malicious reading:** the sample is shared "anyone with the link", so `…/export?format=csv` works in the demo. Newsela's real instructional-design sheets very likely sit in a Google Workspace that restricts link sharing to the company domain (an *assumption*). The link path then fails on the first real unit, or pushes someone into OAuth plumbing that eats the time box.
- **If built literally:** a feature that works only on the one sheet we were given.
- **Severity:** High.
- **Honest reading:** the input that matters is the outline's *content*. How it arrives is secondary.
- **Response:** requirement ER-9:
  - **Primary path:** upload CSV or XLSX.
  - **Convenience path:** a public Google Sheets link fetched as CSV, with a clear error if the sheet is private ("share it or download and upload").
  - **Google OAuth or a shared service account is a named cut** (Q-9).
  - **Limits:** a file-size limit and a row limit (≤200 rows, *target*).
  - **Re-upload behaviour** is defined in N-16.
- **GP:** GP-4, GP-31, GP-95, GP-129.

### N-10 — "Using an agent/LLM" tempts an autonomous agent where a fixed pipeline is right

- **Brief:** "generation of those lessons based on an uploaded instructional outline using an agent/LLM".
- **Malicious reading:** "agent" invites a ReAct loop that reads the sheet, decides what to generate, calls tools and judges itself. It sounds advanced. Nothing in it can be verified independently, its cost is unbounded, and it never reliably knows when it is done (GP-65, GP-72).
- **If built literally:** a non-deterministic pipeline whose output varies from run to run in structure, not only in prose. Its failures cannot be replayed. It may stop early or loop.
- **Severity:** High.
- **Honest reading:** the workflow is fully known in advance (parse → plan → generate → check → review). Only the *content* is open-ended. That makes it a static skeleton with generative calls inside nodes (GP-72), the lowest rung that solves the problem (GP-3).
- **Response:** design choice, requirement ER-10. A fixed DAG:
  1. Normalize (code).
  2. Plan the unit (one LLM call; see N-11).
  3. For each lesson: generate (one structured-output call) → schema and coverage checks (code) → on failure, one repair call with the specific defects (GP-66, GP-67) → judge (LLM) → persist as draft.
  4. A human reviews.
  - **Decision table (GP-64):** "what next" belongs to the code (the DAG); "am I done" belongs to the code checks, plus the human approver for release.
  - **Brakes per run (GP-14):** a per-call timeout, max one repair round, a per-run token budget, and a circuit breaker if three lessons in a row fail the same check.
  - **In the submission:** we say plainly that this is "an LLM pipeline, not an autonomous agent", and why.
- **GP:** GP-2, GP-3, GP-4, GP-14, GP-15, GP-64, GP-65, GP-66, GP-67, GP-72, GP-73, GP-75.

### N-11 — Lessons depend on each other; parallel generation breaks the learning arc

- **Brief:** "indicating what each lesson should cover and the learning arc". The sheet shows the dependency directly: Lesson 3's homework is "Read and annotate The Lightning Thief Ch. 1 (pp. 1–8)". Lesson 4 is the teacher read-aloud of Ch. 1 pp. 1–8. The Performance Task column accumulates skills across each arc.
- **Malicious reading:** two tempting shapes both fail:
  - **Generating all 41 lessons in parallel** with each row alone is fast. It also gives 41 lessons that each open with the same "turn and talk" warm-up and ignore yesterday's homework.
  - **Generating them one after another,** feeding each the full previous lessons, is coherent but slow. Its context grows with every lesson (GP-25, GP-67), and one failure blocks the rest of the unit.
- **If built literally:** either repetitive, disconnected lessons, or a 2-hour run that dies at lesson 23.
- **Severity:** High.
- **Honest reading:** coherence needs a *small shared summary*, not the whole history.
- **Response:** design choice:
  - **A unit-plan call first.** It produces a compact, typed `UnitPlan`: per lesson, a one-line purpose, its primary activity types, what it hands forward (homework and skill), and the arc's performance-task thread.
  - **Then the lessons fan out in parallel,** up to a concurrency cap. Each lesson receives only its own row, its arc header, its neighbours' rows and the plan's lines for those lessons (GP-25, GP-80).
  - **A code check after generation** flags repeated activity types within a sliding window of 3 lessons, and homework that doesn't match the next lesson's reading.
  - **The unit plan is itself reviewable,** and can optionally be approved before fan-out (GP-68).
  - **To prove in a spike:** whether the plan pass actually improves coherence, measured by the repeat-activity rate with and without it (GP-51).
- **GP:** GP-25, GP-51, GP-67, GP-68, GP-73, GP-80, GP-87.

### N-12 — "A few minutes per lesson is ok" hides a job system

- **Brief:** "Generation of lessons can happen asynchronously … a few minutes per lesson is ok -- doesn't have to be realtime."
- **Malicious reading:** "async is fine" sounds like a relaxation. In fact it is a requirement for durable background work:
  - Timing (*assumptions*: 41 lessons, ~3 min each): run one after another, that is about 2 hours (*calculation*); at 6 concurrent, about 20–25 minutes (*calculation*).
  - A Next.js API route, or a serverless function, will time out, restart or be redeployed during that window.
  - Provider rate limits (429s) and long structured outputs (truncation, which gives invalid JSON) are certain at this volume.
- **If built literally:** a run that works for 3 lessons in a demo and loses half a unit on the first deploy. A retry that double-generates and double-bills. Or a run where one failed lesson fails the whole unit.
- **Severity:** Critical.
- **Honest reading:** we need a small, boring, durable queue. That is a solved problem (GP-109).
- **Response:** requirement ER-11:
  - **A Postgres-backed job queue** (pg-boss or graphile-worker, or `SELECT … FOR UPDATE SKIP LOCKED`). No Redis needed at this scale (GP-108).
  - **A separate worker process** from the web app.
  - **Idempotency key per lesson job:** `(unit_run_id, lesson_key, prompt_version_id, schema_version)`. A retry overwrites only its own draft and never makes a second one (GP-8, GP-83).
  - **Retries:** exponential backoff on 429 and 5xx errors, at most 3 attempts. Truncation is detected by schema failure, and the job is retried with a raised output cap once.
  - **Partial failure is a first-class state.** For example, a run shows "38 of 41 generated, 3 failed (reason)", with a "retry failed" button. The unit is still reviewable.
  - **Resumable:** all state lives in the database, so restarting the worker resumes where it left off.
  - **Cancellable.**
  - **Concurrency cap:** a config value (default 4–6, an *assumption* to tune against the measured rate limit).
  - **Per-run budget:** a maximum spend, set at run start and enforced in the worker before each call, not by the model (GP-14, GP-96). The run stops cleanly at the cap.
  - **Cost per lesson:** recorded from the provider's usage fields.
  - **Overload behaviour (GP-114):** a second unit queues behind the first, with its position shown. We don't start a parallel run that competes for the same rate limit.
- **GP:** GP-8, GP-14, GP-69, GP-83, GP-96, GP-107, GP-108, GP-110, GP-111, GP-114.

### N-13 — "View the generation in process": token streaming vs progress

- **Brief:** "let them view the generation in process" (bonus).
- **Malicious reading:** streaming raw tokens of a structured JSON document into the UI looks impressive. It shows half-formed JSON, fights with schema validation, and needs a long-lived connection per viewer for the whole run.
- **If built literally:** a fragile streaming path that duplicates the persistence path.
- **Severity:** Medium.
- **Honest reading:** reviewers want to know *what is done, what is running and what failed*, and to start reviewing finished lessons early.
- **Response:** design choice:
  - The worker writes per-lesson status events (queued → planning → generating → checking → ready, or failed with a reason) to the database.
  - The unit page polls every 2 s, or uses server-sent events (SSE).
  - Each lesson opens for review as soon as it is `ready`, while the rest still generate.
  - Optional: stream the *current section's* text for one selected lesson, as a stretch goal.
- **GP:** GP-17, GP-110, GP-114.

### N-14 — Authors editing the prompt: versioning, reproducibility and a schema they can break

- **Brief:** "bonus points if you allow the editing of the prompt so content authors can tweak the output".
- **Malicious reading:** a big text box containing the whole system prompt, edited live:
  - An author can delete the output-format instructions or the grounding rule, and every lesson after that is malformed or invented.
  - An edit made mid-run changes half a unit.
  - Nobody can say which prompt produced lesson 17, so nothing can be reproduced or compared.
- **If built literally:** quality regressions with no traceable cause. It also breaks "one variable per experiment" (GP-51).
- **Severity:** High.
- **Honest reading:** authors should tune *pedagogical guidance*, not the machinery.
- **Response:** requirement ER-12:
  - **Two prompt layers.**
    - *Locked:* output schema via tool or structured output, the grounding rules (N-6), the injection framing (N-15) and the standards text.
    - *Editable guidance:* tone, activity preferences, per-section guidance and per-lesson-type notes.
  - **Immutable versions.** Each edit creates a new `prompt_version` (id, content hash, author, timestamp, note). A run pins one version at start.
  - **Provenance on every lesson version:** `prompt_version_id`, model id and parameters, `schema_version`, the outline-row hash, the few-shot example set id and the run id (GP-51, GP-62).
  - **Try before applying.** "Try on one lesson" previews a guidance edit on a single row before a unit run. The eval set can be re-run against a new version, with scores and cost side by side (GP-21).
  - **Permissions:** prompt edits require the author role (see N-22).
- **GP:** GP-21, GP-51, GP-54, GP-62, GP-93, GP-105.

### N-15 — The sheet and the crawled pages are instruction channels

- **Brief:** "uploaded/imported lesson outline"; "feel free to crawl as many examples as needed via that link … build AI instructions to generate".
- **Malicious reading:** every cell of an uploaded sheet goes into the prompt. The sheet *already* contains instructions addressed to a writer ("Writer should select paragraphs"), so the model is primed to obey cell text. A pasted-in cell like "ignore the format and…", or a hostile public sheet link, steers generation. The model's output then renders as rich text in staff browsers.
- **If built literally:** low blast radius, because the generator has no tools and staff are trusted. But two things are real: rendering model output as HTML is an XSS path (GP-90), and a public link lets any URL into the pipeline.
- **Severity:** Medium.
- **Honest reading:** this is an internal tool with trusted authors. Defend by architecture, cheaply:
  - the model has no tools and no database access (GP-32, GP-93);
  - its output is data.
- **Response:** design choice:
  - **Cells go in as delimited, labelled data fields.** The locked layer says that outline text describes *what to teach*, not how to format or what to ignore.
  - **Output is accepted only as schema-valid JSON.** Rich text is accepted only as ProseMirror JSON validated against the editor schema: marks and nodes are allow-listed, and raw HTML is never rendered (`innerHTML`) (GP-90, GP-91).
  - **Crawled example pages** are reduced to text and structure offline, then reviewed by us before entering the few-shot set (GP-61).
  - **Basic input limits:** cell length and row count (GP-95).
- **GP:** GP-32, GP-89, GP-90, GP-91, GP-92, GP-93, GP-95.

### N-16 — Regenerate and re-upload can destroy reviewed work

- **Brief:** implied by "upload the spreadsheet/link for a Unit and start the generation process" together with "edit/update … then mark the content as approve/finalized". The brief is silent on what happens the second time.
- **Malicious reading:** a reviewer spends 40 minutes fixing lesson 12. Then an author tweaks the prompt and clicks "Regenerate unit", or re-uploads a corrected sheet. The literal implementation overwrites lesson 12, or writes into a live Yjs document while someone is typing in it.
- **If built literally:** silent loss of human work. That is the opposite of the productivity goal, and the one bug staff never forgive.
- **Severity:** High.
- **Honest reading:** generation creates *drafts*. Humans own everything after first edit.
- **Response:** requirement ER-13:
  - **Regenerating never overwrites** a lesson that is edited, in review or approved. It produces a new *candidate version*, shown beside the current one, which a human can adopt in full or section by section.
  - **Re-upload creates a new outline version** and shows a row-level diff (changed, added, removed). Only lessons whose rows changed are offered for regeneration. Removed rows archive their lessons; they never hard-delete them.
  - **Destructive actions** (discard a reviewed version, archive a unit) require an explicit confirmation outside any model's control (GP-94).
- **GP:** GP-82, GP-83, GP-94.

### N-17 — AI-assisted editing inside a live collaborative document

- **Brief:** "editing/updating … (via direct wysiwyg editing and even AI tools as needed)"; "AI assisted tooling as helpful".
- **Malicious reading:** the easy build has the server call the model and write its rewrite straight into the Y.Doc. With a second reviewer typing in the same section, the CRDT merges the AI's paragraph replacement and the human's keystrokes character by character. The result is interleaved garbage, with no record of who or what changed the text.
- **If built literally:** corrupted sections, unattributable edits, and AI changes slipping into approved content unreviewed.
- **Severity:** High.
- **Honest reading:** the model advises; a human applies (GP-11).
- **Response:** requirement ER-14:
  - **AI tools return a suggestion,** shown as a diff in a side panel and scoped to the selection or section.
  - **Only the human's click applies it,** as a single client-side ProseMirror transaction tagged `origin: ai-assist`.
  - **The audit log records** the user, tool, prompt version, model, the before and after hash, and accept or reject.
  - **Two or three tools at most (GP-13):**
    - "Rewrite selection" (with an instruction such as "simplify for ELD Emerging");
    - "Regenerate this section" (grounded with the same row, standards and locked layer as generation);
    - "Check alignment of this section" (runs the N-5 checks on the current text).
  - **No AI tools on approved lessons.**
  - **Accept and reject rates** per tool are logged as a quality signal (N-23).
- **GP:** GP-11, GP-13, GP-17, GP-62, GP-80, GP-81, GP-82.

### N-18 — The approval workflow needs a state machine, and approval must pin what was seen

- **Brief:** "UI/UX for approval workflow for lessons within a unit, where once reviewed/updated it is flagged as complete in our system"; "mark the content as approve/finalized".
- **Malicious reading:** a "status" dropdown on each lesson. Anyone can set anything. Approved lessons stay editable. In a collaborative document, the content can change *between* the approver reading it and clicking "Approve". So the approval certifies a version nobody approved.
- **If built literally:** "approved" means nothing a state reviewer can rely on, and there is no audit trail.
- **Severity:** High.
- **Honest reading:** approval is the release gate (GP-16's top rung, human in the loop). It must be enforced in code (GP-84, GP-94).
- **Response:** requirement ER-15:
  - **States:** `queued → generating → generation_failed | draft → in_review → changes_requested → in_review → approved → published`, plus `reopened` (from approved, back to in_review).
  - **The server enforces transitions by role.**
    - Reviewers: draft → in_review, and request changes.
    - Approvers: approve, reopen.
    - Admins: publish (export).
    - Whether approver ≠ last editor (four-eyes) is Q-10.
  - **Approval is pinned:** the approve request carries the content hash and Yjs state vector the approver loaded. The server rejects it if the document has changed since then (optimistic check), and requires a re-read.
  - **Approval gate:** the N-5 checks (schema, coverage) must pass on the *current* content, or the approver records an override reason.
  - **On approval:** an immutable `lesson_version` snapshot is written, and Hocuspocus switches the document to read-only.
  - **Reopen** needs a reason and invalidates the approval.
  - **Every transition** goes to an append-only `audit_event` table (who, when, from, to, version hash, reason).
  - **Unit status is derived** ("32 of 41 approved"). The unit is "complete" when all lessons (and flex days, per Q-5) are approved.
- **GP:** GP-16, GP-17, GP-77, GP-82, GP-84, GP-94, GP-116.

### N-19 — "Flagged as complete in our system … ultimately published to our application": an integration nobody specified

- **Brief:** "import them into a system for persistence"; "ultimately published to our application"; "flagged as complete in our system".
- **Malicious reading:** "our system" and "our application" are Newsela's. We have no API, schema or credentials for them. A build that pretends to publish is fiction. A build that invents an integration format will be wrong.
- **If built literally:** a fake "Publish" button that implies an integration we didn't build.
- **Severity:** Medium.
- **Honest reading:** our system is the system of record for drafting and approval. Publishing to theirs is an export contract we propose.
- **Response:** design choice:
  - "Publish" produces a versioned, schema-documented JSON export of approved lesson versions (per lesson and per unit), plus an optional Markdown or HTML preview.
  - It is idempotent (same version → same file, same hash).
  - It is **labelled in the UI and the docs** as an export, with the integration a question (Q-11: target format, push vs pull, IDs).
  - The schema is published in `docs/contracts/` (GP-105).
- **GP:** GP-105, GP-129.

### N-20 — "Performant … 20+ reviewers" is not a requirement until it is a number

- **Brief:** "Rest of workflow and loading/editing of lessons should be performant and be able to handle staff of 20+ reviewers".
- **Malicious reading:** "performant" can't fail. That invites two errors: ignoring it (no evidence), or over-engineering for scale (Redis, horizontal Hocuspocus, autoscaling) that this load will never need.
- **If built literally:** either a claim with no measurement, or a day spent on infrastructure for the wrong scale bucket (GP-108).
- **Severity:** Medium.
- **Honest reading:** this is the **tens-of-users bucket**. The workload, using *assumptions* to check with Q-2 and Q-12:
  - 20–30 concurrent staff;
  - at most 1–3 editors on the same lesson;
  - edits at a few updates per second per active typist;
  - one unit generation at a time in the background, which is the bigger workload (GP-111).
  - A single Node Hocuspocus process and one Postgres instance should carry it. The first likely breakers (GP-113) are:
    - the LLM rate limit during generation;
    - the database connection pool shared between web, worker and Hocuspocus;
    - cold starts on a sleeping host.
- **Response:** requirement ER-16, with *targets*:
  - p95 lesson open (editor ready with content) < 1.5 s;
  - p95 remote edit visible to the other editor < 300 ms;
  - p95 edit durably stored < 3 s;
  - p95 unit dashboard (41 rows) < 1 s;
  - 25 concurrent editing sessions across 10 lessons with no lost update.
  - **Verified with** a small load script: 25 Node `HocuspocusProvider` clients typing scripted edits, plus k6 for HTTP. It runs **while** a unit generation is in progress. We report the *measurements* next to the targets.
  - **Revisit trigger (GP-119):** more than 50 concurrent editors, or a p95 regression of more than 20%.
- **GP:** GP-108, GP-110, GP-111, GP-112, GP-113, GP-115, GP-119.

### N-21 — Hosting: "Vercel or Railway is fine" is a trap for this workload

- **Brief:** "Any (we use AWS, but if any lighter-weight hosting platform, e.g. Vercel or Railway, works then feel free)".
- **Malicious reading:** Vercel is the default reflex for Next.js. But serverless functions have execution time limits and cannot hold a websocket server. So both the multi-minute generation jobs (N-12) and the Yjs sync server (N-3) have nowhere to run. The workaround is a hosted Yjs SaaS (Liveblocks, Y-Sweet). That puts Newsela's pre-release curriculum on a third party nobody approved.
- **If built literally:** jobs killed mid-lesson, collaboration that only works locally, or an unvetted vendor holding the content.
- **Severity:** High.
- **Honest reading:** "works" is the condition. We need three long-lived processes.
- **Response:** design choice:
  - **Render** (our Gauntlet default since 2026-10-22, and allowed by the brief's "any" clause), with three services: a web service (Next.js), a background worker (generation), and a web service for Hocuspocus (websockets), plus managed Postgres.
  - **Paid instances, not free.** Free instances sleep, which drops websockets and gives cold starts (inside the approved $40/month).
  - **Portable:** Docker images, so the AWS mapping is direct: ECS/Fargate services, RDS, and optionally SQS for the queue. The submission states that mapping in one table (GP-63).
  - **Secrets** in environment variables; a `sample.env` is committed (GP-32).
- **GP:** GP-30, GP-32, GP-63, GP-108, GP-110.

### N-22 — No auth in the brief, but there is a money button and confidential curriculum

- **Brief:** silent on authentication and roles. "Content experts", "review staff" and "staff of 20+ reviewers" imply roles.
- **Malicious reading:** a public URL with an unauthenticated "Generate unit" button is a cost attack: each click spends a unit's worth of tokens (GP-96). It also exposes unpublished state-adoption content to anyone with the link.
- **If built literally:** a deployed demo anyone can drain, and IP sitting in the open.
- **Severity:** High.
- **Honest reading:** a minimal real auth layer belongs in the slice. SSO does not.
- **Response:** requirement ER-17:
  - **Auth:** email and password, or a magic link, for an allow-listed set of users.
  - **Three roles:** author (upload, prompt edit, generate), reviewer (edit, submit), approver (approve, reopen, export); admin is a superset.
  - **Enforcement:** every API route and the Hocuspocus `onAuthenticate` check them.
  - **Limits:** a per-user rate limit on generation and AI-assist calls; a per-run and a per-day spend cap with an alert (GP-96).
  - **Reviewer access:** demo accounts for the graders, one per role.
- **GP:** GP-32, GP-93, GP-94, GP-96, GP-97.

### N-23 — Observability: a green run is not a good lesson

- **Brief:** none. Its only metric is ARR.
- **Malicious reading:** with nothing asked for, the build logs nothing. Nobody can then say what a unit cost, which prompt version made the bad lessons, or whether reviewers are rewriting everything the model writes.
- **If built literally:** no evidence for the interview, and no way to improve the generator.
- **Severity:** High.
- **Honest reading:** the reviewer's edits are the best quality signal this system will ever get, and they are free.
- **Response:** requirement ER-18:
  - **Tracing (Langfuse or LangSmith):** one trace per unit run, one span per lesson, child spans per call (plan, generate, repair, judge) (GP-57). Each span records the full assembled prompt and raw output (GP-56), the model, tokens, latency and cost, and the check and judge verdicts.
  - **Where traces live:** a hosted tracer is acceptable only if Newsela is fine with curriculum content leaving to it (Q-13). Otherwise self-host or log to Postgres (GP-59, GP-60). Content holds no student data, so PII risk is low; staff names only.
  - **Quality signals from review:**
    - per-section edit distance between the generated version and the approved version (normalized character or ProseMirror-step distance), computed from immutable version snapshots;
    - % of sections approved untouched;
    - time from `draft` to `approved` per lesson;
    - AI-assist accept rate;
    - "needs source" placeholders left per lesson.
  - **A caution (GP-141):** edit distance is noisy, because reviewers make stylistic edits. Pair it with an optional reason tag on "request changes" (wrong standard, inaccurate text reference, too long, activity doesn't fit).
  - **Health** (errors, queue depth, p95s) is reported separately from **value** (GP-22, GP-132).
- **GP:** GP-22, GP-23, GP-44, GP-56, GP-57, GP-58, GP-59, GP-60, GP-62, GP-132, GP-141.

### N-24 — Model choice: "OpenAI or Anthropic" is a per-role decision

- **Brief:** "OpenAI or Anthropic APIs".
- **Malicious reading:** pick one model for everything. Usually that is the strongest model, which is the largest line item (GP-69). Or it is a cheap one, which produces thin lessons. Using the same model as both generator and judge invites the judge to favour its own family's output.
- **If built literally:** either the cost per unit is unexplained, or the quality is.
- **Severity:** Medium.
- **Honest reading:** there are four distinct decisions:
  - the unit plan (short, reasoning-heavy);
  - lesson generation (long structured output, the quality-critical one);
  - the repair round;
  - the alignment judge (binary, many calls).
- **Response:** decision for Innocent at the model interview (memory: ask which models per role):
  - Recommend a strong mid-tier model for generation, a cheap model for repair and coverage-adjacent classification (GP-70), and a **different provider's** model for the judge.
  - Use structured output or a tool schema for generation (GP-10). Turn on prompt caching for the locked layer and the few-shot examples, which repeat across all 41 calls (GP-33).
  - Model ids and prices are confirmed at the time of choice, not from memory. Cost per unit is a *measurement* from a full-unit run, reported next to the formula `lessons × (in_tokens × in_price + out_tokens × out_price) + judge calls`.
- **GP:** GP-10, GP-33, GP-47, GP-51, GP-69, GP-70, GP-107.

### N-25 — The only metric is ARR: lagging, unattributable, and not ours

- **Brief:** "Impact Metrics: ARR (annual recurring revenue) - 10's of millions market for us."
- **Malicious reading:** ARR is a market-size claim, not a success measure for this tool. The tool can't move it in 1–2 days, and no one could attribute a change to it (GP-134). Building to "ARR" means building with no way to know it worked.
- **If built literally:** a demo with no number.
- **Severity:** Medium (it decides the interview story).
- **Honest reading:** the tool's job is to replace freelance authoring time and coordination. The hop chain (GP-126): fewer reviewer-hours and less cost per approved lesson → full programs produced on the adoption timeline → core curriculum ARR. The problem auditor owns the full metrics tree; engineering supplies what it can measure.
- **Response:** suggested north star: **reviewer minutes per approved lesson** (GP-139). Supporting metrics:
  - generation cost per approved lesson;
  - % of sections approved with light edits (edit distance below a threshold);
  - check pass rate at first generation;
  - judge-flag rate.
  - **Each needs a baseline.** Q-14 asks for the freelance authoring hours and cost per lesson.
  - Targets come from Newsela's numbers, not gut (GP-142).
- **GP:** GP-126, GP-127, GP-131, GP-133, GP-134, GP-135, GP-136, GP-139, GP-142, GP-144.

### N-26 — Two languages, one schema

- **Brief:** "Javascript (Next/Node), React, and Python (if desired)".
- **Malicious reading:** Python for the "AI part" is a natural pull (PydanticAI, the house pattern). But ProseMirror, Yjs and Hocuspocus are JavaScript. The lesson schema would then live twice (Pydantic and Zod) and drift in a 1–2 day build.
- **If built literally:** two schemas, two deploys and a contract bug at the seam.
- **Severity:** Medium.
- **Honest reading:** "if desired" means optional.
- **Response:** decision for Innocent:
  - **(A) All TypeScript** (Next.js, a Node worker using the provider SDK's structured output, Zod as the single schema, Hocuspocus). Recommended: one schema, one language, and the editor schema validation is native.
  - **(B) A Python worker with Pydantic** as the source of truth, generating JSON Schema → Zod. This means a codegen step and a contract test at the seam (GP-105).
- **GP:** GP-30, GP-63, GP-105.

### N-27 — "Clean, well structured architecture" is undefined

- **Brief:** "Code Quality Expectations: Clean, well structured architecture."
- **Malicious reading:** it is unfalsifiable, so any structure "meets" it, and any reviewer can say it doesn't.
- **Severity:** Low.
- **Response:** define it ourselves and show it:
  - modules along the real seams: ingest, plan and generate, checks, lessons and versions, workflow, editor sync, export;
  - typed contracts at each seam;
  - the pipeline DAG and the state machine as code that can be read and tested in one file each;
  - the parser fixtures and eval set run with one command.
  - The submission's `ARCHITECTURE.md` carries a trade-off line per decision (GP-30) and the GP-119 closing sentence for the major choices.
- **GP:** GP-30, GP-31, GP-73, GP-119.

### N-28 — Demo honesty: one lesson in a video is not a unit

- **Brief:** "Required Deliverables: … Demo Video"; "AI Generate lessons for an entire Unit".
- **Malicious reading:** the video shows one lesson generating nicely, and everyone assumes 41 work.
- **Severity:** Medium.
- **Response:** before recording, run the **full issued unit** end to end. Report the *measured* results: wall time, cost, lessons failed and retried, schema and coverage pass rates, judge flags, and placeholders left. Show the partial-failure and retry path on camera. Show one cross-lesson coherence check (N-11).
- **GP:** GP-39, GP-58, GP-131.

### N-29 — "Feel free to crawl": permission given, but the examples are the real spec

- **Brief:** "feel free to crawl as many examples as needed via that link to examine content and build AI instructions to generate"; "these are legitimate lessons already created".
- **Malicious reading:** crawl everything and stuff it into the prompt. That floods the context (GP-25, GP-61). It may also hit a review site that is access-gated or rate-sensitive.
- **Severity:** Medium.
- **Honest reading:** the owner explicitly permits crawling this host. The examples are our best source for the lesson schema and for the judge's positive anchors.
- **Response:**
  - Crawl politely: one request at a time, with a delay, only the named host. Store snapshots in `docs/data/examples/` and do not redistribute them.
  - Derive the `Lesson` schema (sections, front matter and their order) from at least 5 examples across lesson types.
  - Choose **2–3** examples as few-shot examples, matched to the lesson type being generated (GP-61).
  - Keep the rest as eval anchors and a holdout (GP-45).
  - If the site needs login, that is Q-15.
- **GP:** GP-24, GP-25, GP-45, GP-61.

---

## The minimum defensible slice for 1–2 days

**Drop order if time runs out:** cut from the bottom of *In* upward. Items 1–6 are the product. Without them there is
nothing to defend.

### In

1. **Ingest and validate** (N-8, N-9): CSV or XLSX upload, plus a public Sheet link; the deterministic normalizer; a validation report that a human confirms; the seeded CA standards table for the codes the sheet uses (ELA, ELD and media literacy, grade 6).
2. **Lesson schema** (N-4), derived from the crawled examples, versioned, with Zod (or Pydantic) as the single source.
3. **Generation pipeline** (N-10, N-11, N-12): the unit-plan call, then lessons fanned out under a concurrency cap; a Postgres queue; a separate worker; idempotent per-lesson jobs; retries; partial failure with "retry failed"; a per-run budget cap; per-lesson progress on the unit page (N-13).
4. **Checks** (N-5, N-6): schema, timing, standards coverage, no invented standards, quote and page-range flags, and placeholders for missing text evidence; one repair round.
5. **Persistence and provenance** (N-4, N-14): the lesson and its immutable versions, each carrying prompt version, model, outline-row hash and run id.
6. **Review and approval** (N-18): the state machine enforced on the server; version-pinned approval; read-only after approval; reopen with a reason; an audit log; the unit progress roll-up.
7. **Editor** (N-3): ProseMirror with a Yjs binding through one Hocuspocus server persisting to Postgres; form fields for standards and timing; two tabs editing one lesson in the demo.
8. **Auth and roles** (N-22): an allow-list login, three roles, and per-user generation limits.
9. **One AI-assist tool** (N-17): "rewrite selection" as an accept/reject suggestion, logged.
10. **Prompt guidance editing** (N-14): the editable layer only, versioned, with "try on one lesson".
11. **Observability** (N-23): traces with cost per lesson; the edit-distance computation at approval.
12. **Alignment judge** (N-5): run on the eval set and on generated lessons as a flag, with a small provisional calibration.
13. **Export** (N-19): JSON of approved versions.
14. **Load script** (N-20): 25 simulated editors during a generation run, with measured p95s.

### Out (named cuts, each in the conformance table)

- Google OAuth for private sheets; SSO.
- Comments and threads, track-changes mode inside the editor, version-history browsing, offline editing.
- Retrieval over the novel or Newsela's article library (needs texts we don't have).
- More than one AI-assist tool beyond rewrite (regenerate section and check alignment are next).
- Multi-unit or course management, the teacher-facing visual template, and real push-integration into Newsela's application.
- Horizontal scaling of Hocuspocus, Redis, autoscaling. Not needed in the tens-of-users bucket (GP-108).
- Expert-grade judge calibration (needs Newsela's content experts).

### Faked and labelled (each says so in the UI and the docs)

- **"Published to our application"** = a versioned JSON export plus a `published` state (Q-11).
- **Newsela articles and novel passages** = structured references and "reviewer to insert" placeholders, never invented content.
- **Judge calibration** = done by Innocent on about 30 pairs, marked provisional and not expert.
- **"20+ reviewers"** = a simulated load test, not real staff.
- **Flex days and double lessons** = handled by the stated assumption until Q-5 and Q-6 are answered.

---

## Requirements this adds to our PRD

| ID | Requirement | From |
|---|---|---|
| ER-1 | Editor is ProseMirror-based with a Yjs binding; a Tiptap wrapper only if Q-1 says yes | N-2 |
| ER-2 | One Hocuspocus server persists Y.Doc state to Postgres (debounced ≤2 s), authenticates with the app session, and serves approved lessons read-only | N-3 |
| ER-3 | Canonical content is a versioned typed `Lesson` schema: typed front matter (standards and minutes as fields), sections as ProseMirror JSON plus `activities[]` with `minutes` and `standards_addressed[]`; immutable `lesson_version` rows at generation, approval and reopen | N-4 |
| ER-4 | Schema, timing and standards-coverage checks run in code on every generated lesson; a failure gets one repair round, then `generation_failed` with the reasons | N-5 |
| ER-5 | A binary per-(activity, standard) alignment judge on a different model family, with a calibration record (sample size, failures caught, passes cleared); it reports and doesn't block until calibrated | N-5 |
| ER-6 | A seeded table of CA ELA, ELD and media-literacy standards with official text; every code in the outline and in the output must resolve | N-5, N-8 |
| ER-7 | No invented quotes or page numbers for anchor texts: typed `text_evidence_needed` placeholders, a code check for long attributed quotes and out-of-range pages, and provenance badges per field | N-6, N-7 |
| ER-8 | A deterministic outline normalizer (header detection, row classes, range expansion, standards parsing) plus a validation report that a human must confirm before generation | N-8 |
| ER-9 | Upload CSV or XLSX as the primary path; public Sheet link as a convenience with a clear private-sheet error; size and row limits | N-9 |
| ER-10 | Generation is a fixed DAG (normalize → plan → generate → check → repair ≤1 → judge → persist), with the GP-64 decision table and the four brakes | N-10, N-11 |
| ER-11 | A durable Postgres job queue on a separate worker: idempotent per-lesson jobs, backoff retries, partial failure with retry-failed, resumable, cancellable, a concurrency cap, a per-run spend cap enforced in code, and cost recorded per lesson | N-12 |
| ER-12 | Prompts in two layers (locked machinery, editable guidance); immutable versions; runs pin a version; every lesson version records prompt, model, schema, outline-row hash, examples and run | N-14 |
| ER-13 | Regenerate and re-upload never overwrite edited, in-review or approved lessons; they create candidate versions or a new outline version with a row diff | N-16 |
| ER-14 | AI-assist returns suggestions applied only by a human click, as a transaction tagged `ai-assist`, with an audit record; no AI tools on approved lessons | N-17 |
| ER-15 | An approval state machine enforced on the server by role; approval pinned to the content hash and state vector the approver saw; checks must pass or carry an override reason; reopen needs a reason; an append-only audit log | N-18 |
| ER-16 | Performance targets: p95 open < 1.5 s, remote edit < 300 ms, durable store < 3 s, dashboard < 1 s, 25 concurrent sessions with no lost updates; verified by a load script during a generation run | N-20 |
| ER-17 | Allow-list auth; author, reviewer and approver roles enforced on the API and the websocket; per-user rate limits and per-run and per-day spend caps | N-22 |
| ER-18 | Hierarchical traces with the full prompt, tokens and cost; per-section edit distance and the other review signals; health and value reported separately | N-23 |
| ER-19 | A versioned JSON export of approved versions, idempotent by hash, with its schema in `docs/contracts/` | N-19 |
| ER-20 | Hosted on Render as three long-lived services plus Postgres on paid instances; Docker images with a written AWS mapping | N-21 |

---

## Questions for Newsela (technical contact: andrew.parker@newsela.com — to be routed through Innocent; nothing sent)

- **Q-1.** Is Tiptap (built on ProseMirror) acceptable, or do you need raw ProseMirror with `y-prosemirror` to match your codebase?
- **Q-2.** Do two reviewers ever edit the same lesson at the same time, or does each reviewer own a set of lessons? How many people typically touch one lesson?
- **Q-3.** Which lesson sections and front-matter fields are mandatory for every lesson type? Is the structure at the example link the same for reading, writing, discussion and flex lessons?
- **Q-4.** The sample sheet's title says "G6, U4" and every filename says "U3". Which is the unit? Are the filenames the IDs your system uses?
- **Q-5.** Should "End-of-Arc Flex Day" rows be generated as lessons, generated as light plans, or skipped?
- **Q-6.** Is a "Double Lesson" 100 minutes in one lesson record, or two 50-minute lessons? Both rows in the sample say 1 day.
- **Q-7.** Can a content expert label about 30 (activity, standard) pairs, or give 5 reviewed lessons, so we can calibrate the alignment check against your bar?
- **Q-8.** Can you provide the text of the Newsela articles in the text sets, or their IDs? Should generated lessons ever quote the anchor novel, and if so, with what length limit?
- **Q-9.** Are real outline sheets shared outside your Google Workspace domain, or do we need a Google service account (or is upload enough)?
- **Q-10.** Must the approver be a different person from the last editor? Are there separate reviewer and approver roles today?
- **Q-11.** What format does "published to our application" expect (JSON shape, IDs, push or pull)? Is there an existing import schema we should target?
- **Q-12.** What does a peak review day look like (concurrent reviewers, lessons opened per hour)? Is there a load you want demonstrated beyond 20?
- **Q-13.** May lesson content and prompts be sent to a hosted tracing vendor, or must traces stay in our own database?
- **Q-14.** What does a freelance-authored lesson cost today, in authoring and review hours and dollars? That is the baseline the tool is measured against.
- **Q-15.** Does the example-lesson site require a login, and is there a preferred crawl rate?
