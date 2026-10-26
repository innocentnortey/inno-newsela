# Newsela: Two Layers of Success, the Metrics Tree, and How We Present It

**Date:** 2026-10-24 · **Status:** 0.1, draft. The north star below is the recommendation that the brief audit's
AD-19 handed to this doc. It is adopted under Innocent's pre-approval of 2026-10-24 ("if you have any questions, just
do the recommended option"), and he can override it. **Due:** Tue 2026-10-27 03:00 CT.
**Owns:** the presentation layer: the two layers, the metrics tree (metric IDs `NS`, `G-n`, `V-n`, `O-n`, `H-n`), the
success surface, the demo script and the interview answers. It adds no requirement. Requirements stay `AR-n` in the
[brief audit](../analysis/2026-10-24-brief-audit.md) until the PRD absorbs them. Table and event names below are
**proposed**; the Stage 6 design owns the real ones.
**Rule:** [`.claude/rules/hiring-partner-framing.md`](../../.claude/rules/hiring-partner-framing.md), with
`business-metrics` (GP-131–144) and `problem-framing` (GP-126/127). Format follows
`../inno-cerbo/docs/delivery/2026-10-10-angle-and-demo-framing.md`.
**Product direction:** `docs/analysis/2026-10-24-product-direction.md` did not exist when this doc was first written.
Feature names now carry its FE-IDs (aligned 2026-10-24); requirements live in `docs/prd/newsela-prd.md`.

**Refreshed 2026-10-26 (NL-131):** only measured values and their source were changed (SP-1 cost and time, PD-36 counts, PD-37 hosting, PD-33 capacity marked superseded and unmeasured, *n* on the word median). The north star, the two layers and the recommendation are unchanged. Results from NL-112, NL-120 and NL-127 do not exist yet and stay [A]/[T].

**Labels.** **[M]** measured, **[A]** assumption, **[T]** target (GP-119, GP-142). **[F]** a cited source says it;
**[I]** our inference (GP-129).

## Summary

1. **Layer 2:** Newsela wants to sell full-year core programs ("ARR … 10's of millions"). Each new program needs about 1,000 lessons [A] proven to the state's bar, and the brief says that is "prohibitively enormous manual authoring work".
2. **Layer 1:** turn one messy expert outline into a unit of draft lessons in Newsela's own schema. Every claim in a draft is either checked or visibly flagged. A reviewer approves one version at a time, on the evidence.
3. **North star:** **reviewer minutes per approved lesson** (median per unit, split by lesson type; lower is better). It is computed from stored activity and approval events, and guarded by a fast-approval signal and a seeded-error catch rate, with a second-review disagreement rate later. There is no baseline (AQ-14).
4. **Why that one:** reviewer time is about 98% of the cost of a generated lesson ([A] about $20 of review against model spend that **SP-1 measured at $0.182 per lesson [M, n = 3 lessons, `docs/analysis/spikes/SP-1-one-call-draft.md`]**; the $0.50 first assumed was too high, and the 98% share is still [A] because the review minutes are not measured), it can be computed for every approved lesson, and it is the brief audit's real guideline: success is time to an approved lesson, not lessons generated.
5. **Success surface:** a per-unit *Unit quality* page (FE-40). It reads metrics that were frozen when each lesson was approved and never recomputes them. Health and value are kept in separate groups, and there is no per-reviewer leaderboard.
6. **Demo:** under 5 minutes of product (outline defects caught → generation → a lesson picked at random → blocked Approve → approval → the success page), then up to 5 minutes of decisions. The brief sets no video length.

---

## 1. Layer 2: the business value that made the project exist

**In the brief's words [F].**

- The market: Newsela is entering "'Core' Instruction for California … programs of 40 weeks of instruction that are
  adopted by the State/District for all teachers to follow". It is "a huge opportunity (that plots us against
  slow-moving/less innovative 'textbook' incumbents like McGraw Hill/Pearson)".
- The money: **"ARR (annual recurring revenue) - 10's of millions market for us."**
- The obstacle: building those programs "versus **prohibitively enormous manual authoring work** required to do so in
  the past". Freelance authoring "is slow and requires enormous coordination and inordinate timelines and fighting
  quality issues, and results in us getting tons of lesson documents we need to review/revise and then import into our
  system."
- What success unlocks: the tool "will **remove the barriers to entry to market and unlock our ability to sell full
  programs to users who already love us**."

**What the research adds** ([company profile](../analysis/2026-10-24-newsela-company-profile.md) §6, §9).

- **[F]** The first program already exists. *Threads & Themes* (grades 6–8, ELA and ELA/ELD) was recommended by
  California's review panels in summer 2026. The State Board votes 2026-11-12/13. Its content was frozen on 2026-05-15.
- **[F]** It was built by freelancers plus AI drafts, under staff review. A 2026 *Learning Experience Designer, Core*
  posting says the role will "own the review of contributor- and AI-generated lessons".
- **[F/I]** So the brief serves **the next programs**: the 60-day edits-and-corrections package, grades 9–12 ("coming
  2027"), possibly K–5 and other states ("state-level adoptions" in a PMM posting). Each one needs roughly a thousand
  new lessons [A, CA §4 workload model] and a new evidence package.
- **[F]** California grades a program on evidence the publisher writes: Standards Maps and an Evaluation Criteria Map
  that cite lessons by address ("G6.U3.L18: Learning in Action, Part B"). Category 1 (standards alignment) is the gate.
- **[F]** In 9–12 there is no state list. A district that picks a program must *certify* that it aligns (Ed Code
  §60205). The evidence has to be something a district can sign.

**What success means at this layer, in one line.** Newsela can get its next full program to buyers on the adoption
calendar, with evidence a state or district reviewer accepts, and its thin review staff is not the thing that limits
how fast it can enter a market.

**The level we work at (GP-125).** ARR and beating Savvas or McGraw Hill are company-level outcomes. A 2.5-day build
cannot be credited with them. We work one level down, on the content production line. The money appears only at the
end of a hop chain (§3.6).

## 2. Layer 1: the project's problem, and what makes it correct

**The frame (GP-130).** *The brief said* "build an AI tool to generate the lessons in bulk". *We found* that drafting is
already partly solved (Newsela already uses AI drafts), and that the slow part is people proving each draft meets the
state's bar. *So we built* a pipeline that writes each lesson in Newsela's own schema along with the evidence that
proves it, plus a review flow that only approves what it can show. *The metric moves because* the reviewer no longer
has to rebuild that evidence by hand ([audit](../analysis/2026-10-24-brief-audit.md) §2, why-chain row 5).

**Concrete example.** Input: row 4 of the issued Grade 6 Unit 4 outline, *The Lightning Thief* Chapter 1, standards
written as `RL.6.1, 6.2 L.6.4`. Today a reviewer gets a prose draft. They notice that "6.2" is not a code, look up
what RL.6.1 actually says, hunt for the activity that teaches it, check every quoted line against the book, and then
retype the lesson into Newsela's system. In our tool:

1. the validation report (FE-4) flags the malformed code before generation;
2. the generated lesson arrives as Newsela's record shape (front matter, then Launch 5 → Literacy Lab 10 → Learning in
   Action 30 → Look Back 5, as ProseMirror JSON);
3. each focus standard is mapped to the section that teaches it and the task that checks it;
4. a quote that cannot be matched to a supplied source is a "reviewer to insert" placeholder and a blocking issue;
5. Approve stays disabled until those issues are cleared, and the approval is pinned to the version the reviewer saw.

**What makes Layer 1 correct.** These are the audit's guideline (§6) restated as pass conditions:

| Condition | Why it is the bar | Where it is enforced |
|---|---|---|
| The outline's defects are shown and confirmed before money is spent | The issued sheet is dirty: U4 vs U3, `RL.6.9.a` does not exist, the validation report computes **6 errors and 16 ELD findings across 9 distinct codes [M, PD-36, NL-94 real-stack run, `docs/devlog/2026-10-25-w6-nl94.md`]** (the earlier "7 of 12 ELD labels" was a recalled count; the PRD wording change is only proposed) | AR-1, AR-2 |
| Output is Newsela's own schema, not an HTML blob | Their content is already ProseMirror JSON with custom nodes [M, Struct §1]; that removes the "import into our system" step | AR-14 |
| Every claim is checked or visibly flagged: codes resolve, standards map to activities, minutes add to 50, quotes are sourced or left as placeholders | "Aligned" is the whole value and the brief never defines it (T-2); invented quotes at bulk scale are the worst failure (T-1) | AR-5–AR-10, AR-12 |
| Approval is per lesson and per version, blocked by open issues, never bulk | Otherwise "approved" means "a person clicked" (T-3). The company profile suggested "batch approval with sampling"; the audit resolved that as no bulk approve (AD-11) | AR-15–AR-17 |
| Provenance on every version (outline row, prompt version, model, checks, who changed what) | State rules credit only people "who actually contributed" (5 CCR §9517[i]); disclosure is Newsela's call, and the record must exist either way | AR-19, AR-34 |
| Proven on the full issued unit, with measured cost, time, pass rates and failures, and no Newsela content shown in public | The video is evidence, not a showcase (T-22); the review site is pre-adoption material (T-4) | AR-28–AR-31 |

## 3. The metrics tree

### 3.1 Who and what for (GP-144, GP-137)

**User:** a grade-level Learning Experience Designer (LXD), one of "20+ reviewers" [F, Brief]. They hold "final
grade-level responsibility" for alignment [F, profile §7], earn about $60–70K [F, profile §9], and work for a content
team that is thin after layoffs [F, profile §7].
**Use case:** reviewing a generated unit of 40–50 lessons until every lesson is approved at the state's bar.
**What they value [I]:** *proven, not fast.* A lesson that is quick to approve and wrong later costs a correction cycle
and credibility with a state panel. The second user is the instructional expert who writes the outline. Teachers and
students never touch the tool.

### 3.2 The north star: reviewer minutes per approved lesson

**Definition.** For each lesson that reaches `approved`: the sum of **active** minutes that all staff spent on that
lesson, from the moment its generated draft was ready until the approval event. "Active" means the lesson was open in
a foreground tab and the person had scrolled, typed or clicked within the last 60 seconds [A]. Reported as the
**median per unit, split by lesson type**, with the 90th percentile beside it. Lower is better.

**Worked example.** Lesson 4 is opened by reviewer A for 14 active minutes. A inserts two quotes and requests changes.
Approver B spends 9 active minutes and approves. That lesson's value is 23 minutes. The figure is written once, at the
approval event, into the lesson's frozen metrics row. If the unit's Reading lessons have values 18, 23, 31 … the page
shows their median.

**Why this one and not the alternatives.**

| Candidate | Verdict | Reason (GP) |
|---|---|---|
| **Reviewer minutes per approved lesson** | **Chosen** | **Computable for every approved lesson** from heartbeats, with nothing self-reported (GP-140). **Per lesson, as a median**, so one slow reviewer or one hard lesson cannot dominate it (GP-136). **It is the cost:** at ~$40/hour loaded [A, from the $60–70K salary], 30 minutes of review is ~$20 per lesson, against model spend of well under $1 per lesson [A, to be measured]. Reviewer time is the line item. **It ties to money in 3 hops** (§3.6, GP-126). **It is the audit's real guideline**: judge success by reviewer time per approved lesson, not by lessons generated (audit §6 item 7) |
| Approved lessons per reviewer-hour | The reciprocal; kept as a lagging capacity view (O-2) | Its denominator is the hours reviewers *had*, which the system cannot see (meetings, other work). As a ratio of totals it is weighted toward heavy reviewers. It is also the number most easily turned into a per-person speed target, the surveillance failure in E-4 |
| Lessons generated per unit or per hour | Rejected as vanity (GP-135) | Generation is not the constraint: the brief allows "a few minutes per lesson" |
| First-pass approval rate | Supporting (V-1), not the north star | It explains *why* the minutes move, but a lesson can pass first time and still take 90 minutes to review |
| ARR | Context, at the end of the chain | Lagging, years out, and no build can be credited with it (GP-134, T-21) |

**Its guard (GP-127).** Because lower is better, the cheapest way to "improve" it is to skim. So the north star is
never shown without its guards (G-1 to G-3, below). Only lessons approved with every blocking check cleared count, and
that is true by construction, because Approve is disabled while blocks stand (AR-16). Lessons cleared by a recorded
*resolution* rather than a fix are counted separately (G-1).

| Field | Value |
|---|---|
| Unit, denominator | active minutes ÷ approved lesson; median per unit |
| Segments | lesson type (Reading, Writing, Spark, Discussion, Research, Presentation, Flex Day, Assessment); unit; prompt version; model; role (reviewer minutes vs approver minutes); a reviewer's 1st–5th lesson vs later lessons (the learning curve). **Never per named person** on the page (E-4) |
| Leading or lagging | Lagging for the unit (settled at approval); leading for the program |
| Decision line | If the unit median for a lesson type is above the hard gate, read V-4 (edit distance by section) and V-2/V-3 (block types) for that type, fix the prompt or check for the worst section, and re-run one lesson before the next unit. If it is below the aspiration while G-2 rises, investigate skimming before celebrating |
| Baseline | **No baseline** (AQ-14 asks Newsela what review time it budgets per lesson). The context we do have: the teacher edition of a published Unit 4 lesson is a **median 3,306 words** (p10 1,827, p90 3,878; **n = 45 lessons**) **[M]**, measured 2026-10-24 from the captured records in `docs/source/restricted/`, which is word counts only. At 250 words a minute [A] that is **about 13 minutes just to read** [calculation]. Hand authoring is assumed at 15–30 hours per lesson [A, CA §4]. That is authoring, not review, so it is not a baseline for this metric |
| Aspiration | **Median ≤ 30 min for Reading lessons [T].** Basis: ~13 min to read [M-derived] plus about the same again to check the evidence pane and fill placeholders [A] |
| Hard gate | **Median > 60 min, or more than 25% of lessons over 120 min [T].** Basis: at about 4.5× the read time, the reviewer is rewriting rather than reviewing [A]. Revisit once AQ-14 gives Newsela's own budget |
| Computed from | `review_activity` heartbeats (every 15 s while active) rolled into `review_session` rows; at the `approved` transition in the append-only `lesson_transition` log (AR-19), the server writes `lesson_review_metrics.active_minutes`. The page reads that row |
| Review cadence | After each unit is fully approved; weekly while a program is in production; the definition itself is reviewed after the first three units or the AQ-14 answer (GP-143) |
| Coverage caveat (GP-140) | Lessons never approved are missing, so a unit with many stuck lessons looks better than it is. O-3 (share of the unit approved, and the age of open lessons) is always shown beside it. Time spent reviewing on paper or offline is not captured |

### 3.3 The value group (did the reviewer and Newsela benefit?)

**Guards: quality partners to the north star (GP-141).**

| ID · metric and definition | Unit · segments | Lead/lag | Decision line | Baseline · aspiration · gate | Computed from | Review |
|---|---|---|---|---|---|---|
| **G-1 Blocks cleared by resolution.** Share of blocking issues cleared by a named person recording a resolution rather than by fixing the content | % of blocking issues · issue type, lesson type | Leading | If above the gate, the check is wrong or reviewers are routing around it: inspect the resolutions and fix the check or the prompt | none · ≤ 10% [T] · > 25% [T] | `check_result` rows with `cleared_by ∈ {fix, resolution}` | Per unit |
| **G-2 Fast-approval rate.** Share of approvals where active minutes were under half of that lesson's own read time (its teacher-edition words ÷ 250) | % of approved lessons · lesson type, unit; aggregate only | Leading | If above the gate, the reviewer sees a soft prompt at approval time, and the process owner reviews a sample. Never a per-person flag on the page (E-4) | none · ≤ 5% [T] · > 15% [T] | `lesson_review_metrics.active_minutes` against `lesson_version.teacher_word_count` | Per unit |
| **G-3 Seeded-error catch rate**, and later **second-review disagreement**. Share of planted errors (wrong code, invented quote, mismatched homework) caught before approval; later, the share of a blind re-reviewed sample (AR-36) where the second reviewer would not approve | % of seeded errors · error type | Lagging | If below the gate, the north star's gains are not trusted and the review checklist changes before the next unit | none · ≥ 90% caught [T] · < 70% [T] | `seeded_error` rows matched to `check_result` / `lesson_transition`; later `second_review` | Per unit. In our build: one seeded run, with us as reviewers, labelled as such |

**Supporting metrics: why the north star moved (GP-139).**

| ID · metric and definition | How it explains the north star | Unit · segments | Lead/lag | Decision line | Baseline · aspiration · gate | Computed from | Review |
|---|---|---|---|---|---|---|---|
| **V-1 First-pass clean rate.** Share of generated lessons with zero blocking issues after the one repair round | Fewer blocks, so fewer minutes fixing | % of generated lessons · lesson type, prompt version, model | Leading | Below the gate: no new unit runs on this prompt version; read V-2/V-3 for the top block type | none · ≥ 60% [T] · < 30% [T] | `check_result` on the first `lesson_version` | Per run |
| **V-2 Standards claims verified.** Share of focus-standard claims in approved lessons whose alignment-map entry (the section that teaches it and the task that checks it) a named reviewer confirmed. Prerequisite: 100% of codes resolve to the official CDE table | Unmapped standards are the slowest thing to fix by hand; this is also what a state reviewer grades | % of focus-standard claims · standard family (RL, RI, W, SL, L, ELD), lesson type | Lagging (settled at approval) | Below 100% on an approved lesson is a bug in the Approve gate: stop and fix it. A judge "not taught" verdict the reviewer overrides is logged for judge calibration | none · 100% [T] · < 100% [T] (hard) | `alignment_map` rows with `asserted_by` (outline, generator, judge, reviewer id) (AR-7) | Per unit |
| **V-3 Quote verification pass rate.** Share of quoted runs of 12+ words in generated lessons that match a supplied source; the rest become placeholders. Shown beside it: **placeholders per lesson** | Each placeholder is reviewer work (finding the line in the book); each unmatched quote is a block | % of quoted runs; placeholders ÷ lesson · text, lesson type | Leading | If unmatched quotes appear in output at all, tighten the locked grounding rule. If placeholders per lesson are above the gate, supply more public-domain source text or change the activity pattern | none · 100% of quotes sourced-or-placeholder, ≤ 2 placeholders per lesson [T] · any unsourced quote reaching approval [T] (hard) | `check_result` of type `quote_match`; `placeholder` nodes in `lesson_version` | Per run |
| **V-4 Edit distance, AI draft to approved.** Normalized text distance between the generated and the approved version, per section (Launch, Literacy Lab, Learning in Action, Look Back, Homework). Shown beside it: **share of sections approved untouched** | It shows *where* the minutes go. A high distance in one section type points at that section's prompt | 0–1 per section · section type, lesson type, prompt version | Lagging | The section type with the highest median distance is the next prompt fix. Noisy, because reviewers make style edits (GP-141), so it is read with V-5's reason tags | none · median ≤ 0.2 [T] · > 0.5 [T] (the reviewer is re-authoring) | immutable `lesson_version` snapshots at generation and approval | Per unit |
| **V-5 Changes-requested rate, with reasons.** Share of lessons sent back at least once, with the reason distribution (wrong standard, inaccurate text reference, too long, activity doesn't fit, other) | Round trips multiply minutes; the reasons say what to fix | % of lessons · reason, lesson type | Leading | The top reason in a unit becomes the next prompt or check change | none · ≤ 20% [T] · > 50% [T] | `lesson_transition` rows `in_review → changes_requested` with `reason_tag` | Per unit |
| **V-6 AI-assist accept rate**, paired with **accepted-then-rewritten rate** (an accepted span whose text changes again by more than half before approval) | Engagement paired with quality (GP-141). A tool people accept and then rewrite costs minutes | % of suggestions; % of accepted spans · tool, section type | Leading | High acceptance and high rewriting: the assist is not worth its button; change it or cut it | none · no target until a unit is measured [T: set after the first unit] · rewritten > 40% [T] | `ai_assist_event` (offered, accepted, rejected) plus span diffs between versions | Per unit |

**Outcomes (lagging), from the north star to money.**

| ID · metric and definition | Unit · segments | Decision line | Baseline · aspiration · gate | Computed from | Review |
|---|---|---|---|---|---|
| **O-1 Cost per approved lesson.** Model spend for every call on that lesson's lineage, plus active review minutes × a loaded rate | $ per approved lesson · lesson type, model | If model spend is above 10% of the total, model choice is worth revisiting; otherwise, cost work means review work | none [M once the run exists] · model spend ≤ $1 per lesson [T] · **measured $0.182 mean per lesson [M, SP-1, n = 3]** · per-run spend cap enforced in code (AR-21) · loaded rate $40/h [A] | `llm_call.cost_usd` (from provider usage fields) plus `lesson_review_metrics.active_minutes` | Per unit |
| **O-2 Approved lessons per reviewer-hour** (the reciprocal of the north star, as a capacity view) | lessons ÷ active reviewer-hour · unit, lesson type; team aggregate only | Used for planning ("20 reviewers × N hours covers a 1,000-lesson program in W weeks"), never as a target for a person | derived from NS | `lesson_review_metrics` | Monthly |
| **O-3 Unit lead time and share approved.** Calendar days from outline confirmed to the last lesson approved; % of the unit approved; age of the oldest open lesson | days; % · unit | If the share approved stalls while the north star looks good, the hard lessons are stuck: look at the open lessons' blocks | none · [T: set after the first unit] | `outline_version.confirmed_at`, `lesson_transition` | Weekly |
| **O-4 Standards coverage completeness.** Share of the outline's focus standards that are introduced, practised *and* assessed somewhere in the unit's approved lessons, each with a lesson address (`G6.U4.L5.LearningInAction.PartA`) | % of focus standards · unit, rolled up to the 180-day year | A standard never assessed goes back to the outline author before the unit closes | none · 100% [T] · any focus standard with no assessed address [T] | `alignment_map` rows on approved versions (AR-34) | Per unit |

### 3.4 The health group (does it run?)

These are kept separate from value (GP-132). If all of them are green, a slow review cannot be blamed on the tool.

| ID · metric | Decision line | Aspiration · gate | Computed from | Review |
|---|---|---|---|---|
| **H-1 Generation success rate** (lessons that reach a draft without `generation_failed` after retries) and retries per lesson | Below the gate: pause unit runs and read the failed traces | ≥ 98% [T] · < 90% [T] | `generation_job` status, `llm_call` | Per run |
| **H-2 Generation time per lesson** (p95) and unit wall time | Above the gate: raise the concurrency cap if the rate limit allows | p95 ≤ 5 min per lesson (the brief: "a few minutes per lesson is ok") [T] · **SP-1 max 119.7 s over 3 lessons, including a repair, against the 5-minute target [M, n = 3; a maximum, not a p95]** · unit > 2 h [T] | `generation_job.started_at/finished_at` | Per run |
| **H-3 Model spend per run** against the cap | The run stops at the cap by design; repeated stops mean the cap or the prompt is wrong | within the cap [T] | `llm_call.cost_usd` summed per `run_id` | Per run |
| **H-4 p95 lesson open** (editor ready with content) | Above the gate: profile the load path before anything else | < 1.5 s [T] · > 3 s [T] | load-script results stored in `load_test_run` (AR-32), plus client timing events | Before each deploy |
| **H-5 Collaboration latency and durability:** p95 remote edit visible, p95 durably stored, lost updates with 25 sessions across 10 lessons *during* a generation run **(superseded: PD-33 sets 500 users per day and a 200-concurrent-user spike; nothing is measured yet, see `docs/design/capacity-and-workload.md`)** | Any lost update blocks the deploy | < 300 ms; < 3 s; 0 lost [T, unmeasured] | `load_test_run` | Before each deploy |
| **H-6 p95 unit page load** (about 47 rows) | Above the gate: index or snapshot the metrics query | < 1 s [T] | `load_test_run`, server timing | Before each deploy |

### 3.5 If only two metrics could be shown (GP-138)

**The north star and G-2 (fast-approval rate)**: the number, and the check that the number was not bought by skimming.
The first one dropped would be V-6, because the AI assist is a Should-tier feature (AR-22).

### 3.6 Hop chains to money (GP-126; at most 3 hops, with evidence per hop)

| Metric | Chain | Evidence per hop |
|---|---|---|
| **NS** reviewer minutes per approved lesson | (1) fewer minutes per lesson → (2) a 1,000-lesson program [A] needs fewer reviewer-hours and less calendar time → (3) the next program (9–12, other states) reaches district buyers on its adoption calendar, and core licences are district-wide ARR | (1) measured by us. (2) [calculation] every 10 minutes saved × 1,000 lessons = 167 reviewer-hours, about 4 reviewer-weeks; at $40/h [A] that is about $6,700. ⚑ The program size is an assumption [CA §4]. (3) [F] "coming 2027" [Site §1]; core deals are district-wide (Orange Unified, $3.68M for K–6 ELA [CA §4]); the brief's ARR claim. ⚑ That 9–12 timing depends on production speed is our inference |
| **V-1** first-pass clean rate | (1) fewer blocked drafts → (2) fewer minutes (NS) → then NS's chain | (1)–(2) measured together in the build (block count against active minutes per lesson) |
| **V-2 / O-4** standards verified, coverage | (1) every approved lesson carries a confirmed standards map with addresses → (2) the publisher's Standards Map and Category 1 evidence come out as a by-product, with no hand-built 134-page map → (3) state listing, or a district can sign its AB 1454 certification, so the program is purchasable | (1) measured. (2) [F] reviewers grade publisher-written maps that cite addresses [CA §3]; the Program Type 2 criteria map runs 134 pages. (3) [F] Category 1 is the gate; non-list districts must certify (Ed Code §60205). ⚑ We cannot test against a real adoption in the time box |
| **V-3** quote verification | (1) no invented quote reaches approval → (2) fewer word-level corrections in the 60-day edits-and-corrections cycle and no copyright exposure → (3) adoption and brand trust protected | (1) measured. (2) [F] the 6–8 report required three word-level fixes [CA §2]; T-1 (copyright). (3) ⚑ Inference |
| **O-1** cost per approved lesson | (1) cost per lesson → (2) cost per program → (3) margin on a "10's of millions" ARR line | (1) measured. (2) [A] hand authoring is about $600–1,350 per lesson [calculation, CA §4]. (3) [F] the brief's ARR figure |
| **Health group** | (1) green health → (2) a slow north star cannot be blamed on the tool | Measured by the load script and run traces |

## 4. The success surface: the *Unit quality* page (FE-40)

**What it is.** One page per unit (the unit header's *Quality* tab) and one roll-up per program. It is the answer to
the brief's Impact Metrics line, shown inside the product instead of only in a document. Process owners use it to
decide whether the review process is healthy (E-4). It is not a staff-performance screen.

**Read, never recomputed.** Each lesson's metrics are written **once**, when the event happens: the frozen
`lesson_review_metrics` row at approval (active minutes, edit distance per section, blocks at open, blocks cleared by
fix or by resolution, placeholders, AI-assist counts, the fast-approval flag), `check_result` rows at generation,
`llm_call` cost at call time, and `load_test_run` rows from the load script. The page aggregates those rows. Reopening
a lesson creates a new version and a new row; it never rewrites the old one. Every number shows its *n* ("median of 41
approved Reading lessons") and its label.

**Layout, top to bottom.**

| Band | Shows | Notes |
|---|---|---|
| 1 North star | Median reviewer minutes per approved lesson for this unit, by lesson type, with p90 and *n*; the aspiration and hard-gate lines drawn on a per-lesson strip plot; **G-2 fast-approval rate and G-1 resolutions directly beside it** | The north star never appears without its guards. Caption: "No baseline yet (AQ-14). Our run used us as reviewers, not Newsela LXDs." |
| 2 Why it moved | V-1 first-pass clean rate; V-2/V-3 block types per lesson (a stacked bar by type); V-4 edit distance by section (a small table: section × median distance); V-5 top return reasons | Each tile names the north-star branch it explains |
| 3 Evidence a state reviewer reads | O-4 coverage table (FE-33): one row per focus standard, with introduced / practised / assessed lesson addresses; standards with no assessed address in red | This becomes a Standards Map export later (AR-34) |
| 4 Outcomes | O-1 cost per approved lesson (model spend and review time shown apart); O-3 share approved and the oldest open lesson | Cost shows that review time, not tokens, is the line item |
| 5 Lessons | One row per lesson: status, active minutes, blocks open/cleared, placeholders, prompt version, fast-approval flag (shown as "review time below read time", not tied to a name) | Sorted by blocks open, so it doubles as the triage queue |
| Health tab (separate) | H-1 to H-6 with their targets and the last load-script run (FE-42) | Kept off the value page on purpose (GP-132) |

**Deliberately absent:** totals since launch, lessons generated, tokens processed (GP-135), and any per-reviewer
ranking (E-4).

## 5. The demo script

**Length.** The brief lists "Demo Video" under Required Deliverables and sets **no time limit** (checked in
`docs/source/01-project-brief.md` on 2026-10-24). Under the rule's *Demo video* table, that means the demo runs
**under 5 minutes**, followed by a **decisions segment of up to 5 minutes** (total ≤ 10), unless Innocent sets
another length.

**Preconditions.** Record only after the full issued unit has run end to end (AR-31). Show only our UI and generated
output: no lesson from `ca-2026-review` is on screen (AD-4). The lesson shown is picked at random on camera. One
caught error is shown.

### Part 1: the product (≤ 5:00)

| Beat | Time | Say (what Newsela cares about) | Show |
|---|---|---|---|
| 1 The problem, in Newsela's words | 0:00–0:25 | "Newsela is entering core instruction for California, an ARR market of tens of millions. The obstacle, in your brief, is 'prohibitively enormous manual authoring work'. Your first program already exists. What limits the next one is how fast a small team can prove each lesson meets the state's bar." | Title card with the brief's quote |
| 2 What success means | 0:25–0:55 | "Two layers. The business: next programs reach buyers on the adoption calendar. The project: a unit of drafts reviewers can approve fast *at the state's bar*. So I measure reviewer minutes per approved lesson, guarded against skimming, not lessons generated." | The *Unit quality* page (FE-40), north-star band |
| 3 Your outline, as it really arrives | 0:55–1:35 | "This is your Grade 6 Unit 4 sheet. A1 says U4 and every filename says U3; `RL.6.9.a` doesn't exist; ELD labels from the wrong strand are flagged (16 findings across 9 codes, 6 errors in all; PD-36, computed). A reviewer would fix those silently. Here they're caught before a cent is spent." | Upload (FE-1) → validation report (FE-4) → confirm |
| 4 Generate a unit | 1:35–2:05 | "Generation runs in the background, a few minutes per lesson as you allowed. Finished lessons open for review while others generate. Content experts can edit the guidance; the guardrails stay locked." | Live progress board (FE-15); the prompt-guidance panel (FE-30) |
| 5 A lesson picked at random | 2:05–3:15 | "It's your structure: front matter, then Launch, Literacy Lab, Learning in Action, Look Back, in your ProseMirror shape. Beside it, the evidence: each standard's official text and the activity that teaches it. The model wasn't given the novel, so it didn't invent a quote: here's a placeholder for the reviewer. Approve is disabled, and these are the reasons." | Random pick → lesson (FE-9) → evidence pane (FE-22) → blocking list (FE-26); insert the quote; one AI rewrite shown as a suggestion and accepted (FE-23) |
| 6 Approve, on the evidence | 3:15–3:45 | "One lesson at a time, pinned to the exact version I read. Afterwards it's read-only, and the log says who did what. A second reviewer's cursor is live; that's Yjs." | Checklist (FE-26) → Approve (FE-25) → read-only state, audit log (FE-27); a second cursor (FE-21) |
| 7 The success surface | 3:45–4:30 | "Across the whole unit: median minutes per approved lesson with *n*, the fast-approval guard beside it, first-pass clean rate, where the edits went, cost per lesson (review time, not tokens), and the standards coverage table a state reviewer would read. Here is the error we planted, and where it was caught." | *Unit quality* page (FE-40), then the health tab's p95s from the load script (FE-42) |
| 8 Back to the business | 4:30–4:55 | "Every ten minutes saved on a thousand-lesson program is about four reviewer-weeks. That's how this tool moves the ARR line: the next program ships on its calendar, with evidence a district can sign." | Back to the north-star band |

### Part 2: decisions, cuts and candour (≤ 5:00)

The narration comes from the **decision inventory** (`docs/delivery/demo-decision-inventory.md`, written under NL-131), built from the dev log, the PRD and design decision tables and the audit. Nothing is narrated from memory.
Candidate rows, ranked by what a reviewer would probe first:

| Rank | Decision (alternative rejected) | Source | Status | ~Time |
|---|---|---|---|---|
| 1 | The north star is reviewer minutes per approved lesson (rejected: lessons generated, or ARR) | AD-19, this doc §3.2 | decided (pre-approval) | 0:40 |
| 2 | Reference, don't reproduce: citations and placeholders, verbatim text only from a public-domain allowlist (rejected: letting the model quote *The Lightning Thief* from memory) | AD-8, T-1 | decided | 0:40 |
| 3 | No bulk approve; Approve blocked by issues; pinned to the version seen (rejected: "approve all 40", and batch approval with sampling) | AD-11, T-3 | decided | 0:35 |
| 4 | Newsela's own typed schema with ProseMirror JSON; standards and minutes as form fields (rejected: an HTML blob loaded into an editor) | AD-5, T-7 | decided | 0:30 |
| 5 | A fixed LLM pipeline, not an autonomous agent; models per role, with the judge on a different provider (rejected: a ReAct agent judging itself) | AD-7, AD-13, T-15 | decided | 0:30 |
| 6 | Yjs kept minimal: one authenticated Hocuspocus process persisted to Postgres (rejected: a hosted Yjs vendor holding pre-adoption content, and Google-Docs-grade co-editing) | AD-6, T-9 | decided | 0:25 |
| 7 | Unit 4 held out as the eval set; crawled content never committed or shown (rejected: few-shot on the unit we're graded on) | AD-3, AD-4, T-4 | decided | 0:25 |
| 8 | A Postgres job queue in a long-running worker on Render (rejected: serverless functions that time out) | AD-14, AD-15, PD-37 | decided; spend approved 2026-10-26 (PD-37, about $27/month) | 0:20 |
| 9 | Cuts: student edition, retrieval over the novel, comments, errata, publish-as-integration (it ships as a JSON export) | AD-5, AD-8, AR-35, AR-40 | decided | 0:25 |
| 10 | Candour: no baseline; the judge is provisional and advisory; our numbers come from us as reviewers, not LXDs; "aligned" is never shown as a bare badge | AQ-14, AR-13, AR-7 | assumption / stated limit | 0:30 |

The total is about 5:00. If the narration runs long, trim from the bottom; the product demo is never trimmed.

## 6. Interview answers (two layers)

The shape follows the interview-preparation route in the rule: the business problem in one sentence, then most of the
answer on the architecture, the decision, the rejected alternative, the verification and the limit. Paths marked
*planned* do not exist yet.

| They'll ask | Layer 2: why it matters to Newsela | Layer 1: the answer (decision, rejected alternative, verification, limit) | Evidence path |
|---|---|---|---|
| **Why not just a good prompt?** | Your reviewers are the bottleneck, and a prompt hands them prose they have to prove by hand | The prompt is one step in a fixed pipeline: normalize the outline → plan the unit → generate → code checks → one repair → judge → persist → human. The checks are what a prompt can't give you: codes resolve, minutes sum to 50, every focus standard maps to an activity, quotes match a source. Rejected: an autonomous agent, which has unbounded cost and no replay. Limit: the activity patterns are improvised from examples and need your designers' routine library | Audit T-15, AD-7, AR-6; *planned* `src/pipeline/` |
| **How do you prove alignment?** | Category 1 is the gate, and a district certifying a non-list program needs evidence it can sign | In layers, and each layer says who asserted it: (1) codes resolve to the official CDE table; (2) each focus standard maps to the section that teaches it and the task that checks it; (3) a judge on a different provider gives a per-pair verdict, advisory until calibrated; (4) a named reviewer confirms. Rejected: copying the codes into the header and calling it aligned. Limit: the judge isn't calibrated against your experts yet | AR-5–AR-7, AR-13; V-2, O-4; coverage table on the *Unit quality* page |
| **How do you stop rubber-stamping?** | Throughput pressure on a thin team is exactly where "approved" stops meaning "checked" | No bulk approve. Approve is disabled while blocks stand, and approval is pinned to the version hash the reviewer saw. The north star is never shown without G-2 (review time below read time) and G-3 (seeded-error catch rate; later, blind second review). There's no per-person leaderboard, because that would cause the skimming it claims to measure. Limit: a determined skimmer can still click through a clean lesson; G-3 is how we'd find out | AR-15–AR-17, AD-11, E-4; G-1–G-3 |
| **What about copyright, and our review site?** | One invented or reproduced passage at statewide scale is a correction cycle and a legal exposure; the review site is pre-adoption material | Reference, don't reproduce: the generator never writes a passage it wasn't given. Quotes come only from supplied public-domain text, with URL and hash; everything else is a typed placeholder. 12+-word unmatched runs are blocking. Every excerpt has a rights status, and `to-clear` blocks approval. Crawled lessons stay git-ignored; Unit 4 is held out as the eval; the video shows only generated output. Rejected: letting the model quote from memory | T-1, T-4, AR-8–AR-12, AR-28–AR-30, AD-3, AD-4 |
| **How do Yjs and AI edits coexist?** | Reviewers must trust that nothing changed between reading a lesson and approving it | An AI edit is a suggestion that a person applies as a ProseMirror transaction tagged `ai-assist` and logged, never a background write into the shared document. Approval records the content hash and Yjs state vector, and the lesson goes read-only. Any later change needs a reopen with a reason and creates a new version. Rejected: the AI writing straight into the live doc. Limit: no comments or history browser in this slice | AR-15, AR-20, AR-22, AD-6, T-7 |
| **Will it scale to 20+ reviewers?** | Review capacity is the whole constraint, so the editor must not be what slows them down | This is the tens-of-users bucket: one Hocuspocus process and one Postgres carry it. The likely first breakers are the LLM rate limit, the shared connection pool and cold starts, not the editor. Targets: p95 open < 1.5 s, remote edit < 300 ms, durable < 3 s, and no lost update; the "25 sessions" figure is **superseded by PD-33 (500 users per day, a 200-concurrent-user spike; unmeasured)**, to be measured by a load script *during* a generation run. Rejected: Redis and horizontal sync servers for a load that doesn't need them | N-20, AR-32; H-4–H-6; *planned* load script results |
| **What does it cost?** | The money question is review time, not tokens | Model spend is recorded per call and capped per run in code. At our assumptions (~$0.50 of model spend and ~30 minutes of review at ~$40/h), review is about 98% of the cost per lesson, which is why the north star is reviewer minutes. Hosting is about **$27/month on Render, deployed from the GitHub mirror (PD-37, decided 2026-10-26; the blueprint's list price, not a bill [A])**, with a written AWS mapping. Limit: the prices are confirmed at build time, and the measured number replaces the assumption | O-1, H-3, AD-13, AD-15 |
| **Why reviewer minutes, and how do you know it worked without a baseline?** | It's the cost line and the calendar line for your next program at once | It can be computed for every approved lesson from activity events, and it's a per-lesson median, so it can't be gamed by a few heavy users. I don't claim improvement: there's no baseline (AQ-14 asks what you budget). I report a measurement with *n* and its guards. The causal test would be the same lessons reviewed with and without the evidence pane. Until then any change is an association (GP-134) | §3.2, §7; AQ-14 |

## 7. The best objection to the north star, and our answer (GP-143)

**The objection.** *"Reviewer minutes per approved lesson rewards exactly the wrong thing. The fastest way to lower it is
to read less, and a fast, wrong approval looks like success until the state panel finds the error. It also only counts
lessons that got approved, so hard lessons stuck in review make the number look better. And the minutes depend on who
is reviewing: a veteran LXD is faster than a new one. You'd be measuring your reviewers, not your tool."*

**Our answer.**

1. **Skimming.** That's why the number is never shown alone (§3.2, §4 band 1). Approve cannot happen while blocks stand
   (AR-16), so the minutes only count lessons that cleared every check. G-2 shows when review time falls below the
   lesson's own read time (median 3,306 words, n = 45 lessons, about 13 minutes [M]). G-3, a seeded-error catch rate now and a blind
   second review later, is the real quality test. If G-3 falls below 70%, the north star's gains are not trusted that
   unit.
2. **Survivorship.** O-3 (share of the unit approved, and the oldest open lesson) sits beside it. A unit can't look
   good while a third of it is stuck.
3. **Reviewer mix.** Segments by lesson type and by a reviewer's first five lessons versus later ones separate the tool
   from the learning curve. We report the process, never a person.
4. **What we'd change if the objection is right.** If G-3 shows fast approvals missing errors, we would change the
   north star to **defect-free approved lessons per reviewer-hour**, where "defect-free" means the lesson survived the
   blind second review. That number is slower to compute and needs AR-36 (later tier), which is why it isn't the first
   choice for a 2.5-day build.

**The second-best objection, briefly:** "Our ops team plans in lessons per reviewer-week." That is the reciprocal of the
north star, and it is on the page as O-2 for planning. It isn't the headline, because its denominator (hours reviewers
had) is invisible to the system and it turns easily into a per-person target (E-4).

---

## What this changes downstream

- **PRD:** adopt `NS`, its guards and the health/value split as the metrics section. Record AD-19 as closed by this doc.
- **Design (Stage 6):** owns the real names for `review_activity`/`review_session`, `lesson_review_metrics` (written
  once at approval), `check_result`, `alignment_map`, `llm_call`, `ai_assist_event`, `seeded_error` and
  `load_test_run`. The heartbeat activity tracking is a new requirement that this framing implies; the PRD should
  carry it beside AR-33.
- **Demo:** build the decision inventory before writing the narration, and seed one run with planted errors for G-3.
- **Open for Innocent:** whether to send AQ-14 (review-time budget) and the rest of the audit's §9 questions (AD-20).
  The answer to AQ-14 is the only way the north star gets a real baseline.
