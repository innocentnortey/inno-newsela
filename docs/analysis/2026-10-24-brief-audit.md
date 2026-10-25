# Newsela brief: consolidated audit (problem, traps, guideline, requirements)

**Reviewed:** 2026-10-24, America/Chicago. **Deadline:** Tue 2026-10-27 03:00 CT (Innocent: "Monday night at 3 am"),
about 2.5 days from now. **Status:** consolidated from three adversarial parts. Recommended options are adopted under
Innocent's pre-approval of 2026-10-24 ("if you have any questions, just do the recommended option"); see §10.
Nothing has been sent to Newsela.

**Owner of:** merged trap IDs `T-n`, audit requirements `AR-n`, merged questions `AQ-n` and audit decisions `AD-n`.
The part IDs stay with their parts and are cross-referenced, never renumbered:
`L-n` = [legal audit](audit-parts/2026-10-24-legal-audit.md), `E-n` = [ethical audit](audit-parts/2026-10-24-ethical-audit.md),
`N-n` / `ER-n` / `Q-n` = [engineering audit](audit-parts/2026-10-24-engineering-audit.md).
Research files are cited by short name: **[CA]** [california-core-market](company-research/2026-10-24-california-core-market.md),
**[Biz]** [business-and-customers](company-research/2026-10-24-business-and-customers.md),
**[Site]** [website-features-and-value-map](company-research/2026-10-24-website-features-and-value-map.md),
**[Sent]** [reviews-and-sentiment](company-research/2026-10-24-reviews-and-sentiment.md).
Source files: **[Brief]** [`01-project-brief.md`](../source/01-project-brief.md), **[Sheet]** [`02-sample-unit-outline.md`](../source/02-sample-unit-outline.md),
**[Struct]** [`04-lesson-structure-analysis.md`](../source/04-lesson-structure-analysis.md).

**Labels (GP-129).** **[F]** = a cited source says it. **[I]** = our inference. **[A]** = an assumption we chose and
would check. Numbers are marked *measurement*, *calculation*, *assumption* or *target* (GP-119).

## Summary

1. **The brief asks for a lesson generator; the problem is review.** Newsela already wrote a 180-day grades 6–8 program
   with freelancers and AI under staff review, and it is recommended for California adoption (vote 2026-11-12/13). The
   next programs need the same output faster and cheaper, and the slow part is people proving each lesson meets the
   state's bar ([CA], [Site]).
2. **The cause we can change:** drafts arrive without the evidence that proves them, so reviewers rebuild it by hand.
3. **Top traps:** invented quotes and copyrighted excerpts at bulk scale (T-1); "aligned" with no check, fed by a dirty,
   mislabelled outline (T-2, T-5); an Approve button that becomes a rubber stamp (T-3); the example site being the
   state-review copy (T-4); six products in 1–2 days (T-6).
4. **The real guideline:** turn one messy expert outline into a unit of draft lessons in Newsela's own schema, where every
   claim is either checked or visibly marked for a human, then approve one version at a time on the evidence (§6).
5. **Proposed north star:** reviewer minutes per approved lesson, with all blocking checks cleared, guarded against
   rubber-stamping. No baseline yet (AQ-14).
6. **This audit adds 40 requirements (27 must, 10 should, 3 later), 16 questions with working assumptions, and 20
   decisions taken under pre-approval.** Two items still need Innocent himself: hosting spend over the $40 cap (AD-15),
   and whether to send the questions (§9).

---

## 1. The problem behind this brief (GP-121)

**The partner's stated solution.** "An AI tool to generate the lessons in bulk, review, edit and approve them by our
staff -- versus prohibitively enormous manual authoring work" [Brief, PRD]. It takes "an uploaded instructional
outline", generates lessons "using an agent/LLM", persists them, and gives "review staff" a WYSIWYG editor with AI
tools and an approve step [Brief, Business Context].

**What we found when we looked.**

- **[F] The "new market" program already exists.** Newsela submitted *Threads & Themes* (grades 6–8, ELA and ELA/ELD) to
  California's 2026 ELA/ELD follow-up adoption. Both versions were recommended for adoption. The State Board votes
  2026-11-12/13 [CA §2; L context]. The review site holds 4 units × 45 lessons per grade, which is 180 days [Struct;
  `restricted/03-example-lessons/README.md`].
- **[F] It is already produced with freelancers plus AI, under staff review.** A 2026 *Learning Experience Designer, Core*
  posting says the role will "own the review of contributor- and AI-generated lessons, activities, and assessments" and
  refine "AI prompts and specifications that power lesson production" [Site §5.1 item 5; read from third-party
  mirrors]. Freelancers work through internal tools (the Wire, Alexandria, Bundles) [Site §5.1].
- **[F] The issued sample outline is that program's own Grade 6 Unit 4**, in an earlier draft. Newsela's team then
  restructured it (41 → 45 lessons, adding assessment and flex days) and redid the standards by hand. For Lesson 4, the
  sheet says `RL.6.1, 6.2 L.6.4`; the published lesson says `L.6.4.a, RL.6.4, RL.6.6` [Sheet §6].
- **[F] What comes next needs the same production line.** Grades 9–12 are "coming 2027" [Site §1]. K–5, other states
  (the Core PMM role plans "state-level adoptions") [Site §5.1 item 6], the 60-day edits-and-corrections cycle and the
  biennial revisions all follow [CA §2, §5].
- **[F] Reviewers grade evidence the publisher writes.** That means an Evaluation Criteria Map and per-grade Standards
  Maps, with citations to lesson addresses such as "G6.U3.L18: Learning in Action, Part B". Their corrections are
  word-level (a syllable split, a schwa) [CA §3].

**The problem we think it answers.** Newsela must produce, and keep producing, full years of daily lessons that pass a
state review which checks every standard, every fact and every word. Writing a draft is no longer the expensive part,
because AI already helps with it. The expensive part is a thin staff of grade-level designers proving that each draft
meets the bar: standards actually taught, quotes real, texts cleared, content safe [Sent friction 8; E-4]. Then the
draft has to be converted into Newsela's system ("tons of lesson documents we need to review/revise and then import")
[Brief].

**The customer it serves.** First, Newsela's internal reviewers: grade-level Learning Experience Designers (LXDs) and
content experts, "20+" of them [Brief; Site §5.1]. Behind them are California district adoption committees, who need
alignment evidence they can sign [CA §2, AB 1454 certification], and the teachers and students who get one lesson a day
for a year [E-13].

**[I] If this tool didn't exist,** Newsela would keep its current line: freelancers and prompts produce drafts, LXDs
review them in documents, and someone re-keys the result. That is slower, and it leaves no record of what was checked.

---

## 2. Why-chain (GP-124, GP-125)

**Scope line:** Newsela's Core content production line (the product and content-operations level, not the whole company).
**Customer:** Newsela's internal LXD reviewers, producing programs for California district buyers.

| # | Why? | Answer | Evidence |
|---|---|---|---|
| 1 | Why build an AI tool to generate and review lessons? | Manual authoring is "slow", needs "enormous coordination", has "inordinate timelines" and "quality issues" | [Brief, Business Context] |
| 2 | Why does that matter now, with grades 6–8 already submitted? | Each new program needs ~180 lessons per grade, for ELA plus a parallel designated-ELD course: 9–12 in 2027, then K–5, other states, revisions | [Site §1, §2.1]; [CA §4] workload model (*assumption*: 1,000+ teacher-edition lessons per 6–8 Type 2 program) |
| 3 | Why is it still slow when AI already writes drafts? | Every lesson must be proven against the state's bar, and reviewers do the proving by hand. The input outline is itself inconsistent: 7 of 12 ELD codes carry another strand's description, and the standards were redone by hand between the outline and the published lesson | [Sheet §5 item 10, §6]; [CA §3] |
| 4 | Why do reviewers prove it by hand? | Drafts arrive as prose. A standard is *named* but not *mapped* to the activity that teaches it, a quote is not tied to a source, and nothing records what was checked. The reviewer has to rebuild that evidence for each lesson | N-4, N-5, E-2, E-3; [Struct §4] (standards sit at lesson level in front matter, not per activity) |
| 5 | **The cause we can change** | *Drafts arrive without the evidence that proves them, so reviewers rebuild it by hand. A pipeline that writes each lesson in Newsela's own schema, together with checked evidence (each standard mapped to an activity, quotes sourced or left as placeholders, provenance recorded), plus a review flow that only approves what it can show, cuts reviewer minutes per approved lesson without lowering the bar.* | Measurable from stored data: review timestamps, check results, edit distance (N-23) |

**The level we work at (GP-125).** "ARR of 10's of millions" and "beat McGraw Hill / Pearson" sit at the company level.
They are context, not something a 2.5-day build can move (N-25). We work one level down: the production line.

**Rejected branches.**

- **"Generate faster, or generate more."** Rejected. The brief itself allows "a few minutes per lesson". Generation is not
  the constraint; review is (E-4, N-12).
- **"Remove the reviewer: auto-approve when checks pass."** Rejected. A state adoption needs human-verified accuracy,
  and only people "who actually contributed" may be credited (5 CCR §9517[i]) [CA §3]. It is also the rubber-stamp
  failure (E-3).
- **"Build a Google-Docs-grade collaborative editor."** Rejected as the main effort. No functional requirement asks for
  simultaneous editing (N-2). Yjs is adopted minimally (AD-6).
- **"Fine-tune a model on their lessons."** Rejected. Newsela's Terms §9(b) forbid using their content to "train or
  improve" AI models (L-6), and there is no time.

---

## 3. The brief's assumptions (GP-122)

| # | Assumption inside the brief | Mark | Why (source) |
|---|---|---|---|
| A-1 | An LLM given one outline row can write a lesson that meets the bar | Probably needed | It is the premise. Untested until our eval runs (N-5, N-28) |
| A-2 | The outline is a correct, clean spec | **Question it** | Wrong unit number, malformed and non-existent codes, mislabelled ELD codes, reviewer notes inside cells (N-8; [Sheet §5]) |
| A-3 | "40 weeks … 4 sequential units of ~40 lessons each" | **Question it** | The California year is 180 days (36 weeks). The published units have 45 lessons; the sheet has 47 rows ([CA §1]; [Struct]; N-8) |
| A-4 | A lesson is ~50 minutes | Needed | Published lessons run 5/10/30/5 ([Struct §0]). The linked example is a Spark lesson, which has a different shape |
| A-5 | "Standards and definitions can be found online" is a good enough source | Probably needed, from the CDE only | Only SBE standards may be cited ([CA §3]); the sheet's own labels are wrong (L-8) |
| A-6 | Lessons can "reference" the novel without us having its text | **Question it** | Without the text, any quote or page claim is invented (E-1, N-6, L-1) |
| A-7 | "OK to improvise" | **Question it** for facts; needed for activities | Improvised activities are fine; improvised quotes, facts and articles are not (E-5, N-6, L-2) |
| A-8 | Content may be stored "separate of the visual template" | Needed | This enables a typed lesson schema (N-4). Their content is already ProseMirror JSON ([Struct §1]) |
| A-9 | The outline arrives as a sheet "upload/link" | Needed; a *public* link is **question it** | Real sheets are probably domain-restricted (*assumption*) (N-9, L-14) |
| A-10 | Generation can be asynchronous, "a few minutes per lesson" | Needed | This makes it a job system (N-12) |
| A-11 | "Performant … 20+ reviewers" | Probably needed; needs a number | Unmeasurable as written (N-20) |
| A-12 | ProseMirror and Yjs | Needed | Their production stack ([Struct §1]). *Real-time co-editing* of one lesson is **question it** (N-2, AQ-2) |
| A-13 | WYSIWYG editing plus "AI tools as needed" | Needed | AI edits must stay attributable (E-11, N-17) |
| A-14 | Marking a lesson approved means it was reviewed | **Question it** | It means a person clicked, unless the workflow makes review real (E-3, N-18) |
| A-15 | "Ultimately published to our application" | Probably needed, as an export | We have no API for their system (N-19) |
| A-16 | Authors should edit the prompt (bonus) | Probably needed, with a locked layer | Otherwise the prompt bypasses every guardrail (L-15, E-10, N-14) |
| A-17 | "Using an agent/LLM" | LLM needed; an autonomous *agent* is **question it** | The workflow is known in advance (N-10) |
| A-18 | "Vercel or Railway … feel free" | **Question it** for this workload | Long jobs and websockets need long-lived processes (N-21) |
| A-19 | Freelance writing can be "supplanted" | **Question it**, but it is Newsela's call | Experts still write outlines and judge lessons (E-12, L-12) |
| A-20 | ARR is the impact metric | Probably needed as context; **question it** as our success measure | Lagging, and no build can be credited with it (N-25) |
| A-21 | "Feel free to crawl as many examples as needed" | Probably needed, with limits | The site is likely the state-review copy (L-3, N-29) |
| A-22 | The "Off-Limits Tech" field lists banned tech | **Question it** | It holds evaluation prose; nothing is banned (N-2; [Brief] note) |
| A-23 | 1–2 days | Needed | Our runway is ~2.5 days to the 2026-10-27 03:00 CT deadline |

---

## 4. Complaint → observed → underneath (GP-123)

| Complaint (brief's words) | What we observed | What we think is underneath |
|---|---|---|
| "prohibitively enormous manual authoring work"; freelance writing is "slow" | A full 6–8 program already exists, 4 × 45 lessons per grade, built with contributors plus AI under LXD review ([Site §5.1]; [Struct]) | Drafting is partly solved. What stays slow is turning a draft into something the state will accept |
| "fighting quality issues" | The sample outline has reviewer comments left in content cells, typos, a non-existent code (`RL.6.9.a`) and 7 of 12 ELD labels from the wrong strand ([Sheet §5]). The published lesson's standards differ from the outline's ([Sheet §6]) | Quality problems start upstream, in the outline. Reviewers silently repair them, and nothing records the repair |
| "tons of lesson documents we need to review/revise and then import into our system" | Newsela's lesson records are JSON whose rich text is ProseMirror, with custom nodes (`routine_heading`, `callout`, `collapsible`) ([Struct §1]) | Format conversion is a cost on its own. Output in their native schema removes the import step |
| "a rigorous state approval process" | Reviewers grade publisher-written criteria and standards maps that cite lesson addresses. Corrections are word-level; only SBE standards may be cited ([CA §3]) | The bar is *provable* coverage and accuracy, not pleasant prose. The evidence is part of the product |
| "handle staff of 20+ reviewers" | One grade-level LXD holds "final grade-level responsibility" for alignment ([Site §5.1]). The content team is thin and anxious after layoffs, and freelance leveling dried up in 2024 ([Sent] friction 8) | Reviewer capacity is the bottleneck. At ~1,000+ lessons per program (*assumption*, [CA §4]) and 20 reviewers, that is 50+ lessons each (*calculation*), so every minute per lesson counts. It is also exactly where rubber-stamping starts (E-3, E-4) |
| "~40 lessons" per unit | 41 lessons + 6 flex days = 47 rows in the sheet (*measurement*, N-8); 45 lessons published ([Sheet §6]) | Unit size varies. Coverage is judged over the 180-day year, not per unit ([CA §1]) |

**A cheaper fix that changes the experience (the "mirror" option).** Even before generation, a validation report that
shows a reviewer every outline defect and every standards mismatch removes a hidden repair step (N-8, L-8). We build it
first (AR-1).

---

## 5. Traps and contradictions

Merged from the three parts, with duplicates removed, ranked by severity (highest first). **Type:** Leg = legal,
Eth = ethical, Eng = engineering. Each response points to the requirement (AR-n) or decision (AD-n) that carries it.

| ID (sources) · severity | The brief's words | Trap (malicious reading) | Honest reading | Our response | Type |
|---|---|---|---|---|---|
| **T-1** (L-1, L-2, E-1, E-15, N-6, N-7) · Critical | "referencing text/novel indicated in the provided unit outline sheet"; sheet: "WRITER MUST SLECT AND WRITE TO AN EXCERPT OF THE TEXT" | No source texts are supplied. The model fills the gap from memory: invented quotes and page numbers, reconstructed passages of *The Lightning Thief* (in copyright), modern Homer and Virgil translations, a Guardian interview, Britannica Kids. In a statewide program, one error becomes hundreds | They want lessons that *point at* texts the school owns, as the human lessons do. Published lessons quote one sentence at a time and treat the novel as an off-platform text ([Struct §5]) | Reference, don't reproduce. Quotes only from supplied source text; otherwise a typed placeholder. Public-domain allowlist with URL and hash. Rights field per excerpt. Newsela articles become references with `content_available: false` (AR-8 to AR-12, AD-8) | Leg, Eth, Eng |
| **T-2** (N-5, E-2, L-8) · Critical | "aligned to teach the CA Core ELA/ELD standards numbers indicated in the sheet"; "what's important is that we generate standard aligned content" | "Aligned" is the whole value and is never defined or checked. Copy the codes into the header and call it aligned. False alignment claims then feed a state procurement process | Alignment can be checked in layers: codes resolve, each focus standard maps to an activity that teaches it and a task that checks it, a judge reviews each pair, and a person confirms | Official CDE standards table; an alignment map per lesson; code checks block approval; a calibrated judge stays advisory; labels say who asserted what. Never a bare "aligned" badge (AR-5 to AR-7, AR-13) | Eng, Eth, Leg |
| **T-3** (E-3, E-4, E-11, N-18, N-17) · Critical | "approval workflow … once reviewed/updated it is flagged as complete"; "even AI tools as needed" | Approve becomes a fast rubber stamp ("approve all 40") that shifts blame onto reviewers. AI rewrites slip in after review. The document can change between reading it and clicking Approve | They need a clear "done" state to manage 20+ reviewers. The danger is in how "done" is reached | One lesson at a time, no bulk approve; Approve is disabled while blocking issues stand; approval is pinned to the version the approver saw; AI edits are suggestions a person accepts; an append-only audit log (AR-15 to AR-19, AD-11) | Eth, Eng |
| **T-4** (L-3, L-4, L-6, N-29) · Critical (legal) | "feel free to crawl as many examples as needed via that link"; "these are legitimate lessons already created" | `ca-2026-review` is almost certainly the state-review copy of a program the Board has not yet adopted ([CA §2]). A public repo, mirror or video that republishes it means *we* disclosed pre-adoption material, against Terms §3. The sample unit is that program's own Unit 4, so regenerating it can look like rewriting reviewed content | Newsela authorises the crawl in writing for this project. Using a unit with a known answer is good evaluation practice | Crawled content stays in git-ignored `docs/source/restricted/`, never committed, deployed or recorded. The real Unit 4 is a held-out eval set, never few-shot. Repo private. The demo shows only generated content (AR-28 to AR-30, AD-3, AD-4) | Leg |
| **T-5** (N-8, L-8, L-14; [Sheet §5]) · High | "That outline is a google spreadsheet of ~40 lessons" | The issued sheet is dirty. A1 says **U4**, every filename says **U3**. 41 lessons + 6 flex = **47 days**. Malformed `RL.6.1, 6.2 L.6.4`; non-existent `RL.6.9.a`; ranges (`W.6.2.a–f`); filename typos (`L309`, two IDs pasted together); `ELD.PI.6.6` labelled "Exchange information and ideas orally" (that is PI.6.1; PI.6.6 is *Reading/viewing closely*); reviewer notes inside cells. A happy-path parser drops `6.2`, mislabels the unit, and every later check passes against the wrong list | The outline is human-made and will always be a bit messy. The tool's job is to show the mess before money is spent | A deterministic normalizer plus a validation report a human must confirm before Generate is enabled. Each defect is pinned as a parser test. IDs come from the `Lesson #` column; the unit is U4 (AR-1 to AR-4, AD-9) | Eng, Leg |
| **T-6** (N-1) · Critical (scope) | Six functional requirements, a bonus, ProseMirror + Yjs, "1-2 days" | Build a thin layer of everything. Everything appears, nothing holds up, and the part only we can add (checked generation) gets the least work | They are testing which slice we choose. The grading prose rewards "thoughtful design" and staff productivity | The minimum defensible slice ([engineering audit, slice](audit-parts/2026-10-24-engineering-audit.md#the-minimum-defensible-slice-for-12-days)), with a drop order. Every cut is named in the conformance table (AD-1) | Eng |
| **T-7** (N-4, N-2, N-3) · Critical | "ProseMirror and Yjs for the frontend/collaborative editor"; "content separate of the visual template" | Generate an HTML blob, load it into ProseMirror, save Yjs binary. It looks finished, but nothing can check, diff or export it, and an edit can silently break the alignment record. Yjs also brings a sync server, persistence and websocket auth with it | Their production content model *is* ProseMirror JSON with custom nodes ([Struct §1]). "Separate of the visual template" invites a typed schema | A typed, versioned `Lesson` schema matching theirs. Standards and minutes are form fields, not editor text. One Hocuspocus server, persisted to Postgres, authenticated, read-only after approval (AR-14, AR-20, AD-5, AD-6) | Eng |
| **T-8** (E-5, N-6, L-2) · High | "its OK to improvise what content goes in there based on the examples" | Permission to fill 160 days with generic filler and to invent facts, presented as expert design | The line is addressed to *us* as non-experts. Improvise **activities**, never **facts about texts** | The locked prompt layer forbids invented facts. Each section cites the exemplar pattern it follows. Activity patterns are labelled as prototype placeholders for Newsela's designers to own (AR-9, AR-22) | Eth, Eng |
| **T-9** (N-12, N-21) · High | "a few minutes per lesson is ok"; "Vercel or Railway … feel free" | "Async is fine" hides a job system: 47 rows × ~3 min is ~2 hours serially (*calculation*). Serverless functions time out and cannot host websockets, so jobs die mid-lesson and collaboration only works locally. The workaround is a third-party Yjs SaaS holding pre-adoption content | "Works" is the condition, and the brief allows "Any" | A Postgres-backed queue in a long-running worker on Render, with idempotent, resumable, capped jobs. No hosted Yjs vendor (AR-21, AD-14, AD-15) | Eng |
| **T-10** (L-15, E-10, N-14) · High | "bonus points if you allow the editing of the prompt" | One text box: delete the grounding rule, regenerate 40 lessons, leave no trace. The record shows a staff member did it | It is a good feature. It puts content experts in control | Two layers: guardrails locked, guidance editable. Immutable prompt versions. Each lesson records the version that made it. Output checks run regardless of the prompt (AR-23) | Leg, Eth, Eng |
| **T-11** (N-16) · High | "upload the spreadsheet/link … and start the generation process" (silent on the second time) | A re-upload or "regenerate unit" overwrites lesson 12 after a reviewer spent 40 minutes on it | Generation makes drafts; people own everything after the first edit | Regenerate never overwrites edited, in-review or approved lessons. It creates a candidate version beside the current one; re-upload creates a new outline version with a row diff (AR-24) | Eng |
| **T-12** (research; N-8; E-4) · High | "programs of 40 weeks of instruction … 4 sequential units of ~40 lessons each" | Hard-code 40 lessons per unit. The tool then cannot represent the real 45-lesson units or the 180-day year that coverage is judged on | Round numbers in a business description. The real shape comes from the outline | No fixed unit size; size comes from the outline (≤200 rows, *target*). Flex days are real lessons. Coverage is reported per unit and rolls up to the year (AR-2, AR-26, AD-10) | Eng |
| **T-13** (N-20, E-4) · Medium | "should be performant and be able to handle staff of 20+ reviewers" | "Performant" cannot fail, so it invites either no evidence or over-built infrastructure | The tens-of-users scale; one Hocuspocus process and one Postgres carry it | Numeric targets (p95 open < 1.5 s, remote edit < 300 ms, durable store < 3 s, dashboard < 1 s, 25 sessions with no lost update), measured by a load script *during* a generation run. No per-reviewer speed leaderboard (AR-32, AR-33) | Eng, Eth |
| **T-14** (N-2) · Medium | "Off-Limits Tech: Thoughtful design and easy to understand/use/navigate workflow; creativity and resourcefulness…" | The field is misfiled. One reading hunts for hidden banned tools; the other ignores the clearest statement of how the work is judged. Meanwhile the real stack constraint sits under "Other Requirements" | Nothing is banned. The field is grading guidance: a navigable staff workflow and staff productivity | Off-limits list treated as empty. ProseMirror + Yjs treated as required. Design effort goes to the reviewer workflow (AD-2) | Eng |
| **T-15** (N-10) · High | "using an agent/LLM" | An autonomous ReAct agent that decides what to generate and judges itself: unbounded cost, no replay, no reliable stop | The workflow is known in advance; only the content is open-ended | A fixed pipeline: normalize → plan unit → generate → code checks → one repair → judge → persist → human. Called "an LLM pipeline, not an autonomous agent" in the docs (AD-7) | Eng |
| **T-16** (N-22) · High | Silent on authentication | A public "Generate unit" button is a cost attack, and the deployment exposes unpublished curriculum | A minimal real auth layer belongs in the slice; SSO does not | Allow-list login; author, reviewer and approver roles enforced on the API and the websocket; per-user limits and spend caps (AR-25) | Eng, Leg |
| **T-17** (L-7, E-6, E-7, E-8) · High | "CA Core ELA/ELD standards"; the sheet's Popol Vuh, Raven, *Zanzibar Tales* (1901) and Odyssey Book 8; row 39 "references to domestic abuse" | The brief names academic standards, not California's legal social-content rules. Bulk prompts about sacred narratives, a colonial-era translation and adult myth content for 11-year-olds; an "ELD support" that swaps in an easier task; prompts asking students to disclose trauma | Experts chose these texts deliberately, for range (the CDE praised the "Indigenous texts"). The tool must handle them with care | Locked rules: respectful framing, no personal-disclosure prompts, ELD supports keep the same text and task, content warnings carried to the teacher note. An advisory social-content screen plus a human-ticked checklist item (AR-17, AR-27) | Leg, Eth |
| **T-18** (L-5, L-9, E-9) · Medium | "supplant the manual lesson writing step"; silent on disclosure | AI's role disappears behind "staff reviewed it". Lessons that were only approved may have no copyright at all, so a competitor could copy the program | Disclosure is Newsela's decision; our job is that a truthful record exists | Non-optional provenance per lesson version, plus an authorship ledger of human versus AI edits, exportable per unit (AR-19, AR-34) | Leg, Eth |
| **T-19** (N-11) · High | "indicating what each lesson should cover and the learning arc" | All 47 lessons generated in parallel open with the same warm-up and ignore yesterday's homework; or run serially, they take hours and die at lesson 23 | Coherence needs a small shared summary, not the whole history | A unit-plan call first, then a capped fan-out where each lesson sees its row, its arc header and its neighbours. A code check flags repeated activities and homework mismatches (AR-26) | Eng, Eth |
| **T-20** (N-19) · Medium | "import them into a system for persistence"; "ultimately published to our application" | A fake Publish button implies an integration nobody specified | Our system is the system of record for drafting and approval; publishing is an export contract we propose | A versioned JSON export of approved versions in their schema, labelled as an export (AR-35) | Eng |
| **T-21** (N-25) · Medium | "Impact Metrics: ARR … 10's of millions market for us" | Build to ARR and have no number at all | ARR explains why the brief exists; the tool moves cost and time per approved lesson | A metrics tree with hop chains (§7); proposed north star with a guard (AD-19) | Eng |
| **T-22** (E-17, N-28, E-16) · Medium | "Required Deliverables: … Demo Video" | Cherry-pick the best lesson, call it "standards-aligned" and "classroom-ready", show one lesson and imply 47 | The video is evidence | Run the full issued unit before recording. Show a lesson picked at random and at least one caught error. Report measured results with sample sizes, plus a limits section. Same checks for every lesson, no showcase lane (AR-31, AR-36) | Eth, Eng |
| **T-23** (L-6, L-11, L-10) · Medium | "OpenAI or Anthropic APIs"; "an interface for our review staff" | Their pre-adoption lessons sit in our API account; whole novels get uploaded; a pasted student answer goes to the AI assist; the published content is inaccessible | In-context examples are permitted; this is a staff-only content tool | In-context only, no fine-tune, no vendor file stores; nothing in prompts beyond the allowed list; no student fields; semantic lesson structure; staff UI checked with axe (AR-29, AR-37, AR-38) | Leg |
| **T-24** (L-12, E-12, L-13) · Low | "an army of freelancers"; "supplant"; "1-2 days" | We hand over a production tool for free, and our deliverables read as "AI replaces writers" | Lawful. Experts still author outlines and judge lessons | Frame the tool as expert-driven; keep "replace writers" wording out; reviewer notes become reusable guidance. Explicit LICENSE; no Newsela content in the repo (AD-18) | Leg, Eth |
| **T-25** (E-13, E-14) · Medium | "adopted by the State/District for all teachers to follow" | Errors get patched quietly after publication; earned brand trust carries AI content unchecked | Trust is a legitimate advantage if quality evidence backs it | Versioned published lessons and an errata log (later). Unit quality report as the sales asset (AR-34) | Eth |
| **T-26** (N-15, N-13, N-24, N-26, N-27, N-23) · Low | "uploaded/imported lesson outline"; "view the generation in process"; "OpenAI or Anthropic"; "Python (if desired)"; "Clean, well structured architecture" | Cells as instruction channels and an XSS path; token streaming of half-formed JSON; one model for everything; two schemas in two languages; "clean" left undefined; nothing logged | Cheap architectural defences, plus our own definitions | Cells as delimited data, allow-listed ProseMirror nodes, no `innerHTML`; per-lesson progress polling; models per role; all TypeScript; modules along the real seams; traces in Postgres (AD-12, AD-13, AD-16, AD-17, AR-33) | Eng |

### Where the three parts disagreed, and the resolution

| Topic | Parts | Resolution |
|---|---|---|
| Long-quote threshold | L-1: 25 words or 2 sentences. N-6: 12 words | **12 words** for any quoted run not matched in a supplied source (the stricter value). Matched quotes from supplied public-domain text are not flagged by length (AR-10) |
| Batch approval | [Sent] friction 8 suggests "batch approval with sampling". E-3: no bulk approve | **No bulk approve.** Speed comes from a triage queue and evidence beside the content instead (AD-11) |
| Where crawled examples live | N-29: `docs/data/examples/`. L-3: git-ignored private folder | **`docs/source/restricted/`**, already git-ignored (AD-4) |
| Few-shot examples | N-29: pick 2–3 from the site. L-4: keep Unit 4 out | Few-shot from Units 1–3 and other grades only. **Grade 6 Unit 4 is held out** (AD-3) |
| Override on failed checks | N-18: checks pass or carry an override reason. E-3: blocking issues disable Approve | No silent override. A blocking issue clears only when the content is fixed, or when a named person records a resolution (for example, inserts the quote and sets its rights status). The resolution shows in the provenance export (AR-16) |
| Hosting shape | N-21: three services | Two services plus Postgres, to stay near the spend cap (AD-15) |

**Corrections to the parts.** N-8 cites `docs/source/originals/sheet-export.csv`; the file is at
`docs/source/restricted/originals/sheet-export.csv`. N-8/N-29 had not opened the example site; [Struct] has since
confirmed the 5/10/30/5 sequence and shown that the linked example is a Spark lesson, an atypical shape. L-8's
"[I, verify] PII.6.3" sits inside the wider finding of [Sheet §5 item 10] (7 of 12 ELD labels are wrong).

**One exposure to note (L-3, L-14).** The tracked files `docs/source/02-sample-unit-outline.md` and
`docs/data/samples/g6-u4-lesson-outline.json` hold the whole sheet verbatim. That is acceptable while the repo, its
GitLab project and its GitHub mirror stay private (AD-4). If any of them ever becomes public, these files move under
`restricted/` first. This audit does not edit `docs/source/`.

---

## 6. The real guideline

Once the traps are removed, the brief asks for this:

1. **Take one expert unit outline as it really arrives** (messy, 40–50 rows), show its defects, and let a person confirm
   it before anything is spent.
2. **Generate a full unit of draft lessons asynchronously in Newsela's own lesson schema:** front matter, then
   Launch / Literacy Lab / Learning in Action / Look Back, with ProseMirror rich text.
3. **Make every claim either checked or visibly marked for a human:** standards resolve and map to the activity that
   teaches them, timings add up, quotes come from a supplied source or stay as placeholders.
4. **Store lessons as versioned records with provenance** (outline row, prompt version, model, checks), not as documents
   to import later.
5. **Give reviewers a ProseMirror + Yjs editor** where AI help is a suggestion they accept, and approval of one lesson
   version at a time, only when its blocking issues are cleared.
6. **Prove it on the issued unit end to end**, with measured cost, time, pass rates and failures, and show none of
   Newsela's own content in public.
7. **Judge success by reviewer time per approved lesson at the state's bar**, not by the number of lessons generated.

---

## 7. Hop chains to money or customer value (GP-126)

Each chain has three hops or fewer. Hops without evidence are flagged ⚑. The full metrics tree belongs to the
angle-and-demo framing doc (in progress); this section supplies its chains.

| Metric the brief implies | Hop chain | Evidence per hop |
|---|---|---|
| **ARR, "10's of millions"** | (1) checked generation and review cut time and cost per approved lesson → (2) the next program (9–12, other states) is ready on its adoption calendar → (3) district core licences, which cover every student in the adopted grades | (1) our own measurement against ⚑ **no baseline** (AQ-14). (2) [Site §1] "coming 2027"; ⚑ the calendar for 9–12 is our inference (9–12 is adopted locally, [CA §2]). (3) **[F]** core deals are district-wide (Orange Unified approved $3.68M for K–6 ELA, [CA §4]); the brief's ARR claim |
| **Time and cost to author a unit** | (1) reviewer minutes per approved lesson + generation cost per lesson → (2) cost per unit | (1) measured in our build from review timestamps and provider usage fields (N-12, N-23). (2) ⚑ baseline is an *assumption*: $40–45/hour contract writers ([CA §4], an Amplify posting) × 15–30 hours per lesson (*assumption*, [CA §4]) ≈ **$600–1,350 per lesson** (*calculation*) |
| **Review throughput** (approved lessons per reviewer-week) | (1) more lessons approved per reviewer → (2) a 1,000+-lesson program (*assumption*) finishes within the calendar with 20 reviewers → (3) revenue arrives on time | (1) measured. (2) 1,000 ÷ 20 = 50+ lessons per reviewer (*calculation*); E-4 gives 70–80 for a TK–8 scale. (3) ⚑ timing-to-revenue is an inference. **Guard:** throughput alone rewards rubber-stamping (E-3), so it is always paired with the second-review defect rate |
| **First-pass approval rate** (share of lessons whose checks pass at first generation and are approved with light edits) | (1) fewer regenerations and rewrites → (2) fewer reviewer minutes per lesson → (3) lower cost per unit | (1)–(2) measured: check pass rate and per-section edit distance (N-23, *with GP-141 noise caveat*). (3) follows from the cost chain. **Guard:** pair with a reason tag on "request changes" |
| **Adoption pass** (Category 1 "met", few edits and corrections) | (1) lessons carry checked evidence (standards map, sourced quotes, social-content log) → (2) the program meets all Category 1 criteria, with fewer word-level corrections → (3) state listing, or cheap AB 1454 certification for non-list districts → purchases | (1) measured as coverage completeness and zero unverified claims. (2) **[F]** Category 1 is the gate; Newsela's 6–8 report listed 3 word-level corrections ([CA §2]). (3) **[F]** AB 1454 requires non-list LEAs to certify alignment ([CA §2]). ⚑ We cannot test against a real adoption in the time box; (1) is the leading proxy |

**Proposed north star (for the framing doc to confirm, GP-127).** *Reviewer minutes per approved lesson, counting only
lessons approved with every blocking check cleared.* It is stored (review session timestamps plus approval events), it
can be computed for every reviewer and every lesson, it has **no baseline** (AQ-14), and its **guard** is the
second-review disagreement rate on a sample of approved lessons (AR-36, later), plus a soft signal when a lesson is
approved within seconds of being opened (E-4). It is a *lower-is-better* number, so the guard is not optional: lower
minutes from skipped checks is the failure we are measuring against.

---

## 8. Requirements this audit adds to the PRD

Merged and deduplicated across the three parts. **Must (guardrail)** = the build is not defensible without it.
**Should** = in the slice if time holds, in the drop order of AD-1. **Later** = named in the PRD's production path.

### Ingest and outline

| ID | Requirement | Sources | Tier |
|---|---|---|---|
| AR-1 | A deterministic outline normalizer: find the header row by column names; classify rows (`lesson`, `flex_day`, `arc_header`, `total`); attach arc text as context; expand ranges; take IDs from `Lesson #`, not the filename | N-8, ER-8, L-14 | **Must** |
| AR-2 | A validation report before generation. It lists every row as OK / warning / error, with the original cell text. Unresolved codes, the unit mismatch and filename defects need a person's confirmation before Generate is enabled. No fixed unit size (≤200 rows, *target*) | N-8, N-9, L-14, T-12 | **Must** |
| AR-3 | Upload CSV or XLSX as the main path; a public Sheet link as a convenience, with a clear error for private sheets. Store an immutable snapshot and hash of each outline version | N-9, ER-9, L-14, L-5 | **Must** |
| AR-4 | Outline cells enter prompts as delimited, labelled data, never as instructions. "Writer should / select" cells become `writer_task` items | N-15, N-7, L-14 | **Must** |

### Standards and alignment

| ID | Requirement | Sources | Tier |
|---|---|---|---|
| AR-5 | A seeded table of CA CCSS ELA (grade 6), CA ELD (grade 6, with sub-parts and Em/Ex/Br levels) and Model School Library Standards, with official text from the CDE. Every code in the outline and the output must resolve. Show the sheet's label next to the official text with a mismatch flag | N-5, ER-6, L-8, E-2 | **Must** |
| AR-6 | An alignment map per lesson: for each focus standard, the section that teaches it and the task that checks it. Code checks: schema, minutes sum to 50 ± 5 (*target*), every focus standard covered, no code outside the row's lists. One repair round, then `generation_failed` with reasons | N-5, ER-4, E-2, L-8 | **Must** |
| AR-7 | Alignment labels say who asserted them: outline, generator, judge or named reviewer. Never a bare "standards-aligned" badge | E-2, L-8 | **Must** |
| AR-13 | A binary per-(activity, standard) judge on a different provider from the generator, with a calibration record (sample size, failures caught, passes cleared). Advisory until calibrated; marked provisional, not expert | N-5, ER-5, E-2 | Should |

### Grounding, texts and rights

| ID | Requirement | Sources | Tier |
|---|---|---|---|
| AR-8 | Anchor and companion texts appear as citations (title, edition/ISBN, chapter and page range). The generator never writes a passage of a text it was not given | L-1, E-15, N-6 | **Must** |
| AR-9 | A locked grounding rule: no invented quotes, page numbers, facts about real people, or article content. Where a lesson needs evidence, it emits a typed placeholder (`text_evidence_needed`, `QUOTE NEEDED`) rendered as a "reviewer to insert" block | E-1, L-2, N-6, N-7, ER-7 | **Must** |
| AR-10 | A code check flags any quoted run of 12+ words that does not match a supplied source, and any page number outside the row's range. Flags are blocking issues | N-6, L-1, E-1 | **Must** |
| AR-11 | Verbatim excerpts only from a public-domain allowlist we supply (Gutenberg IDs: Baldwin, Judson, Spence, Bateman, Butler/Lang translations), copied from the fetched text with its URL and hash | L-1, E-15 | Should |
| AR-12 | A rights status on every excerpt (`public-domain`, `Newsela-owned`, `licensed`, `to-clear`, `short-quote-commentary`); `to-clear` blocks approval | L-1 | **Must** |

### Lesson record, editor and workflow

| ID | Requirement | Sources | Tier |
|---|---|---|---|
| AR-14 | A typed, versioned `Lesson` schema matching Newsela's record ([Struct §2, §9]): typed front matter, sections as ProseMirror JSON with their custom node types, `activities[]` with `minutes` and `standards_addressed[]`. Immutable `lesson_version` rows at generation, approval and reopen | N-4, ER-3 | **Must** |
| AR-15 | An approval state machine enforced on the server by role (draft → in_review → changes_requested → approved → published, plus reopened). Approval is pinned to the content hash and state vector the approver saw; read-only after approval; reopen needs a reason | N-18, ER-15, E-3 | **Must** |
| AR-16 | Approve is disabled while blocking issues exist (unverified quotes, unmapped standards, `to-clear` rights, unaccepted AI spans, open safety flags), and the screen lists them. A block clears only by fixing the content or by a named person recording a resolution | E-3, N-18, L-1 | **Must** |
| AR-17 | Per-lesson approval from inside the lesson, with no bulk approve. A 4–6 item checklist, each item linked to its evidence: quotes, standards, ELD keeps the task, social content | E-3, E-7, L-7 | **Must** |
| AR-18 | An evidence pane beside the content: the outline row, the official standard text, and the matched source passage or placeholder | E-3, E-1 | Should |
| AR-19 | An append-only audit log of every transition (who, when, from, to, version hash, reason), and provenance on every lesson version (prompt version, model and parameters, schema version, outline-row hash, example set, run id) | N-18, N-14, ER-12, L-5, L-9, E-9 | **Must** |
| AR-20 | A ProseMirror editor with a Yjs binding through one Hocuspocus server: persisted to Postgres (debounced ≤ 2 s), authenticated with the app session, approved lessons read-only. Standards and minutes edited as form fields | N-2, N-3, ER-1, ER-2 | **Must** |
| AR-22 | One AI-assist tool, "rewrite selection", returned as a suggestion and applied only by a person's click, as a transaction tagged `ai-assist` and logged. No AI tools on approved lessons | N-17, ER-14, E-11 | Should |
| AR-24 | Regenerate and re-upload never overwrite an edited, in-review or approved lesson; they create a candidate version or a new outline version with a row diff | N-16, ER-13 | **Must** |
| AR-36 | A blind second review of a configurable sample of approved lessons, with disagreement reported per unit | E-3 | Later |

### Generation pipeline and operations

| ID | Requirement | Sources | Tier |
|---|---|---|---|
| AR-21 | A fixed pipeline on a durable Postgres job queue in a separate long-running process: idempotent per-lesson jobs, backoff retries, partial failure with "retry failed", resumable, cancellable, a concurrency cap, a per-run spend cap enforced in code, cost recorded per lesson, per-lesson progress on the unit page | N-10, N-12, N-13, ER-10, ER-11 | **Must** |
| AR-23 | Prompts in two layers (locked guardrails and schema; editable guidance), immutable versions, a run pins one version, "try on one lesson" before a unit run | L-15, E-10, N-14, ER-12 | Should (the bonus feature); the lock is **Must** if the feature ships |
| AR-25 | Allow-list auth; author, reviewer and approver roles on the API and the websocket; per-user generation limits; per-run and per-day spend caps | N-22, ER-17 | **Must** |
| AR-26 | A unit-plan call before fan-out; each lesson sees its row, its arc header, its neighbours and the plan. A unit-level check flags repeated activity types in a 3-lesson window and homework that doesn't match the next lesson | N-11, E-5 | Should |
| AR-27 | Locked content rules: respectful framing of sacred narratives, grade-appropriate summaries, no prompts that ask students to disclose trauma, content warnings carried to the teacher note (sheet row 39), ELD supports on the same text and task. An advisory social-content and brand-name screen labelled "advisory, not clearance" | L-7, E-6, E-7, E-8 | **Must** (rules) / Should (screen) |
| AR-33 | Traces per run, lesson and call (prompt, output, tokens, cost, verdicts) stored in our Postgres; review-derived value signals (edit distance per section, untouched sections, draft-to-approved time, AI-assist accept rate, placeholders left), reported separately from health | N-23, ER-18 | Should |
| AR-32 | A load script: 25 simulated editors across 10 lessons during a generation run, with measured p95s reported against the targets in T-13 | N-20, ER-16 | Should |

### Data boundary, evidence and honesty

| ID | Requirement | Sources | Tier |
|---|---|---|---|
| AR-28 | Crawled Newsela content stays in git-ignored `docs/source/restricted/`, never committed, mirrored, deployed or recorded. The crawler is capped, rate-limited and identifies itself | L-3, N-29 | **Must** |
| AR-29 | In-context examples only: no fine-tuning, no vendor file or vector stores. Prompts may hold our schema, 1–2 short format examples, official standards text, outline rows and supplied public-domain excerpts; never full copyrighted works, student data, freelancer details or credentials | L-6 | **Must** |
| AR-30 | Grade 6 Unit 4's published lessons are a held-out eval set, never few-shot | L-4, N-29, [Struct] | **Must** |
| AR-31 | Before recording, run the full issued unit; report measured wall time, cost, failures and retries, pass rates, judge flags and placeholders left. The demo shows a randomly chosen lesson and one caught error. The docs carry a limits section | E-17, N-28, E-16 | **Must** |
| AR-34 | A per-unit export of provenance and the human-contribution summary (share of sections and characters changed by people), plus a standards-coverage table citing lesson addresses (`G6.U4.L5.LearningInAction.PartA`) in the shape reviewers use | L-5, L-9, E-9, E-14, [CA §5] | Should |
| AR-35 | "Publish" = a versioned, idempotent JSON export of approved versions in the `Lesson` schema, with the schema in `docs/contracts/`, labelled in the UI as an export | N-19, ER-19 | Should |
| AR-37 | No student or teacher-of-record fields in the schema; content-only database; staff authentication only | L-11 | **Must** |
| AR-38 | Semantic, accessible lesson output (heading levels, tables with headers, required alt text) and a staff UI aimed at WCAG 2.1 AA with an axe check; plus an AI-assist warning against pasting student work | L-10, L-11 | Later (lint and warning) / **Must** (semantic schema) |
| AR-39 | Version lineage that can mark a lesson `adopted-locked`; edits to it create a new version that must be classified as an edit-and-correction or new content | L-4, [CA §3] | Later |
| AR-40 | Published-lesson errata log and "report a problem" routing back to review | E-13 | Later |

**Count:** 40 requirements (AR-1 to AR-40; grouped by area, so the numbers are not in order): **27 must** (AR-27 and
AR-38 each carry a should or later part), **10 should**, **3 later**. The musts are the AD-1 slice items 1–8; when time
runs short, Should rows are dropped from the bottom of AD-1's order first.

---

## 9. Questions for Newsela

To **andrew.parker@newsela.com** (the brief's technical contact). **Not sent.** Innocent decides whether and when to send
them. Each carries the working assumption we build on, so no answer blocks the build.

| ID | Question | Working assumption until answered | Sources |
|---|---|---|---|
| AQ-1 | Is `ca-2026-review.newsela.com` the reviewer copy for the 2026 adoption, and is its content confidential until the Board acts? | Yes, treat it as confidential (AD-4) | L Q1, N Q-15; [CA §2] |
| AQ-2 | May our repo and demo video be public? May they show any crawled lesson content? | Repo private; video shows only our generated output and our UI (AD-4) | L Q2, L Q3 |
| AQ-3 | Do two reviewers ever edit the same lesson at the same time, or does each own a set? | Usually one editor; we support 2–3 live and test 25 sessions (AD-6) | N Q-2, N Q-12 |
| AQ-4 | Is raw ProseMirror with `y-prosemirror` required, or is Tiptap acceptable? Is the review-site JSON the schema of your authoring system? | Raw ProseMirror, with a schema mirroring the review-site node types (AD-5) | N Q-1; [Struct §10 Q1] |
| AQ-5 | The sheet says "G6, U4" and the filenames say "U3". Which is the unit, and are the filenames your IDs? | Unit 4 (the review site's Unit 4 is this myth unit); IDs from `Lesson #` (AD-9) | N Q-4; [Sheet §5] |
| AQ-6 | Should flex days be generated, and is a "Double Lesson" one 100-minute record or two 50-minute ones? | Flex days generated as Flex lessons; each "Double Lesson" row is one 50-minute lesson in a two-day task (AD-10) | N Q-5, N Q-6 |
| AQ-7 | Which sections and front-matter fields are mandatory per lesson type? Should outline types (`Core Reading`) or published types (`Reading`) be used? | Published types and the 5/10/30/5 sequence; Spark keeps its 15/30/5 shape (AD-5) | N Q-3; [Struct §10 Q2] |
| AQ-8 | Who resolves parent codes (`L.6.4`) into leaves (`L.6.4.a`) and bare ELD codes into sub-parts and levels? | The generator proposes leaves and levels, marked "AI-proposed"; the reviewer confirms (AR-7) | [Struct §10 Q3]; L Q9 |
| AQ-9 | What does your rights team clear for anchor and companion texts? Should lessons never reproduce excerpts? Can you supply article text or licensed novel text? | Reference only; public-domain excerpts from our allowlist; placeholders elsewhere (AD-8) | L Q5, E-1, E-15, N Q-8 |
| AQ-10 | Do you hold IP assignments from the freelancers who wrote the example lessons and outlines? | Yes; we use examples in-context only, never for training (AR-29) | L Q6 |
| AQ-11 | Will generated lessons ever replace lessons in the adopted *Threads & Themes*, or only feed new units, grades and states? | Only new units, grades and states; adopted-locked versioning is in the PRD's production path (AR-39) | L Q7, E Q (E-16) |
| AQ-12 | Do you disclose AI involvement to the state, districts or teachers? | Not ours to decide; the provenance record always exists (AR-19, AR-34) | L Q4, E Q (E-9) |
| AQ-13 | Must the approver differ from the last editor? Are reviewer and approver separate roles today? | Separate roles; four-eyes on by default as a setting (AD-11) | N Q-10 |
| AQ-14 | What does a freelance-authored lesson cost today, in authoring and review hours and dollars? What review time per lesson do you budget? | No baseline; we report our measurements and the [CA §4] assumption, labelled (AD-19) | N Q-14, E Q (E-4) |
| AQ-15 | What format does "published to our application" expect (shape, IDs, push or pull)? | A JSON export in the review-site lesson shape (AR-35) | N Q-11 |
| AQ-16 | Which LLM accounts would production use, and may content go to a hosted tracing vendor? | Your enterprise account with zero data retention in production; for us, traces stay in our own Postgres (AD-17) | L Q8, N Q-13, N Q-9 |

Questions dropped as duplicates: L Q10 (accessibility target) is covered by AR-38's WCAG 2.1 AA default; N Q-7
(expert labels for calibration) is folded into the judge's "provisional" label and can be added to AQ-14's message if
Innocent sends one.

---

## 10. Decisions taken under Innocent's pre-approval

Innocent, 2026-10-24: *"if you have any questions, just do the recommended option."* Each row below is the recommended
option from the cited part, adopted on that basis. **Status for every row:** decided — recommended option, pre-approved
by Innocent 2026-10-24 (with the two exceptions marked ⚠ in the status cell).

| ID | Choice | Basis | Status |
|---|---|---|---|
| AD-1 | Build the minimum defensible slice with its drop order: ingest and validate → schema → pipeline → checks → provenance → review and approval → editor → auth → one AI assist → prompt guidance → observability → judge → export → load script | N-1; GP-109, GP-128 | decided — recommended option, pre-approved by Innocent 2026-10-24 |
| AD-2 | Treat "Off-Limits Tech" as empty (nothing banned) and as grading guidance; treat ProseMirror + Yjs as required | N-2; [Brief] note | decided — recommended option, pre-approved by Innocent 2026-10-24 |
| AD-3 | Few-shot examples come from Grade 6 Units 1–3 and other grades only; Grade 6 Unit 4 is held out as the eval set | L-4, N-29, [Struct] | decided — recommended option, pre-approved by Innocent 2026-10-24 |
| AD-4 | Crawled content stays in git-ignored `docs/source/restricted/`. The GitLab repo and its GitHub mirror are private. The demo shows only generated output. Treat the site as confidential until AQ-1/AQ-2 say otherwise | L-3, L-13, AQ-1, AQ-2 | decided — recommended option, pre-approved by Innocent 2026-10-24 |
| AD-5 | Raw ProseMirror with `y-prosemirror`, schema mirroring Newsela's node types (`routine_heading`, `callout`, `collapsible`, tables); published lesson types and the 5/10/30/5 sequence (Spark 15/30/5); the teacher edition is generated, and the student edition is a named cut (the brief asks for "the sections within the lesson that the teacher should follow") | N-2, N-4; [Struct §0–§1]; AQ-4, AQ-7 | decided — recommended option, pre-approved by Innocent 2026-10-24 |
| AD-6 | Yjs adopted minimally: one Hocuspocus server persisted to Postgres, authenticated, cursors and names only; no comments, offline mode or history browser | N-3, AQ-3 | decided — recommended option, pre-approved by Innocent 2026-10-24 |
| AD-7 | A fixed LLM pipeline, not an autonomous agent; named as such in the docs | N-10 | decided — recommended option, pre-approved by Innocent 2026-10-24 |
| AD-8 | Reference, don't reproduce: citations plus typed placeholders; verbatim only from our public-domain allowlist; Newsela articles as references with `content_available: false`; retrieval over the novel is a named cut | L-1, L-2, E-1, N-6, N-7, AQ-9 | decided — recommended option, pre-approved by Innocent 2026-10-24 |
| AD-9 | The sample unit is **Grade 6 Unit 4**; lesson IDs come from the `Lesson #` column; filename defects are shown in the validation report, not trusted | N-8, [Sheet §5–§6], AQ-5 | decided — recommended option, pre-approved by Innocent 2026-10-24 |
| AD-10 | Flex-day rows are generated as Flex lessons; each "Double Lesson" row is one 50-minute lesson within a two-day task; unit size comes from the outline, never a fixed 40 | N-8, T-12, AQ-6 | decided — recommended option, pre-approved by Innocent 2026-10-24 |
| AD-11 | Approval: per lesson, no bulk approve, blocking issues disable Approve, pinned to the version seen. Reviewer and approver are separate roles; four-eyes (approver ≠ last editor) is a setting, on by default; demo seeds one account per role | E-3, N-18, AQ-13; resolves the [Sent] "batch approval" suggestion | decided — recommended option, pre-approved by Innocent 2026-10-24 |
| AD-12 | All TypeScript: Next.js app, Node worker, Zod as the single schema, Hocuspocus | N-26 option A | decided — recommended option, pre-approved by Innocent 2026-10-24 |
| AD-13 | Models per role: a strong mid-tier Anthropic model for lesson generation, a cheaper model for the repair round, an OpenAI model for the alignment judge (a different provider); structured output and prompt caching. Model ids and prices confirmed at build time from the providers' docs, not from memory | N-24 (memory `ask-which-models-per-role`, answered by the pre-approval) | decided — recommended option, pre-approved by Innocent 2026-10-24 |
| AD-14 | Postgres-backed job queue (pg-boss or `SKIP LOCKED`), no Redis; concurrency cap 4–6 (*assumption*, tuned to the measured rate limit); per-run spend cap enforced in code | N-12, GP-108 | decided — recommended option, pre-approved by Innocent 2026-10-24 |
| AD-15 | Render (Gauntlet default), two paid Starter services plus Render Postgres Basic: (1) the Next.js web app; (2) one Node service running Hocuspocus and the job worker as separate entry points of the same image, which can be split later. Estimate $7 + $7 + $6 = **~$20/month** (*calculation* from the rule's listed prices, unchecked against today's pricing page). Docker images with a written AWS mapping | N-21; `gauntlet-hosting-default` | decided — recommended option, pre-approved by Innocent 2026-10-24. ⚠ **Spend still needs Innocent's own OK before provisioning:** HouseAccount, Riverside and the AEA call center already run on Render, so ~$20 more probably passes the $40/month cap, and the hosting rule requires his approval for that |
| AD-16 | Progress is shown as per-lesson status events polled every 2 s; finished lessons open for review while others generate; token streaming is a stretch goal | N-13 | decided — recommended option, pre-approved by Innocent 2026-10-24 |
| AD-17 | Traces and review signals are stored in our own Postgres, not a hosted tracer | N-23, AQ-16 | decided — recommended option, pre-approved by Innocent 2026-10-24 |
| AD-18 | Ship a `LICENSE` reading "All rights reserved; evaluation use permitted"; no Newsela content in the repo; no click-through that assigns rights | L-13 | decided — recommended option, pre-approved by Innocent 2026-10-24 |
| AD-19 | Proposed north star: reviewer minutes per approved lesson with all blocking checks cleared, guarded by second-review disagreement and a fast-approval signal; no baseline (AQ-14). The framing doc owns the final tree | N-25, §7, GP-127 | decided — recommended option, pre-approved by Innocent 2026-10-24 (as the proposal handed to the framing doc) |
| AD-20 | Questions in §9 are drafted, not sent | Task instruction; L-13 | decided — recommended option, pre-approved by Innocent 2026-10-24. ⚠ **Whether to send them is Innocent's call** |

**What would reopen a decision.** An answer from Newsela to the matching AQ; a spike result that contradicts an
*assumption* (concurrency cap, quote threshold, judge usefulness); or Innocent overriding a row. Record the reversal in
the PRD's decision table, not only here.
