# Evaluation plan — Newsela Lesson Studio

<!-- DO-5. Answers "was it right?", never "did it run?" (that is DO-6, docs/design/observability.md).
Contract: .claude/workflow/system-design-readiness/DESIGN-OUTPUTS.md → Evaluation plan.
Check: python3 .claude/workflow/system-design-readiness/scripts/design_outputs.py check-eval docs/design/eval-plan.md -->

> Owner: Claude drafts, Innocent reviews · Status: ready (Claude recommendation adopted under Innocent's standing
> authorization, PD-32, 2026-10-25) · Sources: SD-8.1, SD-8.2, SD-8.8, SD-8.9, SD-2.7; PRD R-19, R-20, R-23, R-49,
> R-51, R-52, R-53, R-55–R-57, R-60; HP-1…HP-10 (`hard-problems.md`); WP-1…WP-5 (`../data/worked-pairs.md`);
> rule `verification-evals-observability`. Metric IDs (M-n) are in [`metrics-registry.md`](metrics-registry.md) (DO-7).

## What this plan does, in one example

**Input:** worked pair WP-1, outline row 8 (Lesson 4, Core Reading), whose focus-standards cell reads
`RL.6.1, 6.2 L.6.4`. **Process:** the golden suite runs intake on the row, asks the generator for a `LessonDraft`,
compiles it, and runs the R-19 checks. **Output, scored by assertions, not by a model:** intake reports one malformed
code and proposes `RL.6.2`; every block in WP-1's "typed blocks that must be there" table is present; section minutes
match the Reading template; the two novel quotes are placeholders, not invented text; L4's Homework carries a blocking
`lesson_link` to L5's excerpt slot. One assertion failing files the case under one failure category (below), so the
report says *where* to fix, not only *how many* failed.

**How it works.** There are two tiers (GP-40): a **golden tier** that must be 100% green before anything merges or
records, and a **coverage tier** (the full 47-lesson run, the seeded-error run, the held-out comparison) that is
expected to show some failures and reports them with *n*. Thresholds below were committed in this file **before the
first run**. Changing one after a run needs its own commit with a reason and a dev-log entry; an expected output is
never edited to go green, and changing one is a separate commit from any agent or prompt change (rule
`verification-evals-observability` 10, 15). Numbers that depend on a spike are labelled `[A] → SP-N` and are replaced
by the spike's measurement before the first full run.

## Expected-answer authority

A model is never its own authority. Where the brief is silent, the authority is a recorded decision or a named person.

| Behaviour evaluated | Who or what decides the correct answer | Where that authority is written |
|---|---|---|
| Intake: parsed rows, counts, codes, note classes, validation flags (HP-6) | Deterministic rule over the issued sheet, hand-counted | PRD R-3–R-6 acceptance criteria; HP-6 "How we'll know it worked"; WP-1…WP-5 *Required output (intake)* |
| Standards codes resolve, leaves only, `origin` on every code (HP-3) | The official CDE standards tables (C-1 CA CCSS, C-2 CA ELD, C-3 MSLS) plus the row's lists | `docs/source/05-standards-referenced.md`; PRD R-19, R-20 as amended (§5.4) |
| Lesson shape: sections present and ordered, minutes 50 ± 5, required typed blocks | Newsela's published structure as summarised in `04`, and the worked pairs' required-blocks tables | `docs/source/04-lesson-structure-analysis.md` §9; WP-1…WP-4 *Required output* |
| Grounding: no invented quote, page or name; placeholders where a quote is needed (HP-2) | Deterministic scans against the row, arc header, text-card titles and standards text; expected placeholder counts per pair | PRD R-12, R-19 (§5.4); HP-2; WP-1 = 2, WP-2 = 1, WP-3 = 0, WP-4 = 1 placeholders |
| Content safety: warning routed to a teacher-only tip, no leak, Approve blocked (HP-9) | Deterministic rule; Innocent confirmed the one real case (row 39) | PRD R-22 (§5.4); PD-26; WP-4 |
| Approval integrity: stale approve refused, four-eyes, frozen after Submit (HP-5) | Deterministic invariants | PRD R-29, R-31, R-33, R-34; PD-7, PD-10; HP-5 |
| Canonical copy: JSON ↔ Y.Doc round trip keeps the hash (HP-4) | Deterministic invariant (hash equality) | PD-7; HP-4 |
| Long-job behaviour: resume, no double pay, cap respected (HP-7) | Deterministic invariants against a stubbed provider | PRD R-16, R-48; HP-7 |
| North-star measurement: active minutes (HP-8) | The test script's own timeline, and Innocent's stopwatch on 2 real reviews | PRD R-49 (§5.4); HP-8 |
| Activity teaches / checks a standard (judge, R-23) | **Innocent's labels** (~30 (activity, standard) pairs, binary) | PRD R-23; PD-12 (judge on another provider) |
| Teaching quality of a draft (HP-10) | **The approver's rating at Approve** (*usable as drafted / usable with edits / rewritten*) | PRD R-60; PD-28 |
| Seeded errors caught before approval (G-3) | The planter's hidden answer key (planted by someone other than the reviewer) | PRD R-52 (§5.4); framing §3.3 |
| Structural closeness to the published unit (R-53) | The held-out published Unit 4 (S-5), counts only | PRD R-53; PD-20; source register S-5 |

## Case provenance

Every case file carries a `provenance:` field with one of four values, plus the source ID it came from:

| Value | Means | Examples in this build |
|---|---|---|
| `issued` | Verbatim from the issued outline sheet (S-2) | WP-1 (row 8), WP-2 (row 9), WP-3 (row 25), WP-4 (row 39); the 47-row full run; the 14 issued samples under `docs/data/samples/issued-2026-10-24-*` |
| `hand-written` | Written by us from an authority above, with the authority named | the expected outputs of WP-1…WP-5; one golden failing fixture per R-19 blocking rule; the 12 grounding plants of HP-2; the ~5 planted errors of R-52 |
| `synthetic` | Generated by a tracked script from a known source, with the assumption it encodes (rule `synthetic-test-data`) | SYN-1 (injection twin of row 9), SYN-2 (layout-shifted sheet), SYN-3 / WP-5 (clean control of row 10); SYN-4+ (HP-9's 5 warnings and 3 decoys, written at build) |
| `promoted-trace` | A stored trace that a person reviewed and corrected, with the trace ID and reviewer | lessons rated *rewritten* (HP-10) and first failures from the §9 error-analysis round, after Innocent reviews them |

A case also records `source:` (S-2 row number, SYN-N, or trace ID), `guards:` (boundary, invariant or regression, and
the HP or R it guards), and `script:` for synthetic cases (`docs/data/scripts/build_samples.py` or its successor).
**Unreviewed traces never become cases.** No case is derived from S-3…S-5 content; those may inform only structural
counts already recorded in `04`.

## Development and held-out separation

**Development set (read and tuned against freely):**

- **WP-1…WP-5 are the first development set** (zero-to-hero §6). Each becomes one golden case at §8, plus the
  per-rule fixtures they imply.
- SYN-1…SYN-3, the SYN-4+ safety cells, the R-19 golden failing fixtures and HP-2's seeded copies of the WP drafts.
- The issued sheet's 47 rows. It is the product's input, not a test of generalisation, so the full run (R-51) is a
  coverage run on development data and is reported as such.

**Held out (sealed):**

- **S-5, the published Unit 4** (45 lessons) at `docs/source/restricted/originals/lessons-json/g6-u4-l01…l45.json`.
  **Handling rule** (source register, *Handling rule for restricted material*; PD-20): the folder is git-ignored and
  never committed; its content is never placed in a prompt, a few-shot example, a plan, a context pack, a review page
  or an agent's context; no agent opens it. Only the local comparison script (R-53) reads it, on this machine, and it
  writes **counts only** (lesson types, section sequence, focus-standard overlap) to the git-ignored
  `evals/local/held-out/`. Innocent is the only person who may open the files themselves. This plan cites S-5 by path
  and rule only.
- **The R-52 answer key.** Planted errors are written by someone other than the reviewer (Claude plants, Innocent
  reviews) and hidden from the reviewer until the run ends.
- **Judge confirmation labels.** Of Innocent's ~30 labelled pairs (R-23), 20 are used to calibrate the rubric and 10
  are held back to confirm agreement; the judge prompt is not tuned against the 10.

## Scoring

The cheapest grader that works is used, in this order: assertion → invariant → trajectory → judge → human (GP-41).
Deterministic suites run once (two runs must be byte-identical, which is itself a check). Model-driven golden cases
run **3 times** and report the spread (GP-39); the full run is one run and is labelled "single run, *n* = 47".

| Suite | Grader (assertion / invariant / trajectory / judge / human) | Case score | Roll-up |
|---|---|---|---|
| **S1 Intake golden** (HP-6; R-51 part 1: one test per outline defect) | assertion (exact counts and normalized rows) | pass/fail per expected field | all fields pass = case pass; suite = cases passed ÷ cases |
| **S2 Check golden** (R-19; R-51 part 2) | assertion: one failing fixture per blocking rule, one clean pass, cases whose right answer is a placeholder or a refusal | pass/fail | 100% required (golden tier) |
| **S3 Draft golden** (HP-1, HP-2, HP-3 on WP-1…WP-4) | assertion + trajectory (normalize → plan → draft → compile → checks → one repair; the step that first failed is recorded) | pass/fail per required block, per section's minutes, per placeholder count | case passes only if every assertion passes on all 3 repeats; spread reported |
| **S4 Grounding plants** (HP-2, SP-3) | assertion over 12 planted errors and the 4 clean drafts | caught / missed per plant; false flags per clean lesson | catch rate over the 11 code-detectable plants; the nameless plant reported as "not caught by code" |
| **S5 Integrity invariants** (HP-4, HP-5, SP-2) | invariant (Playwright, 3 browser contexts; hash and state-vector equality) | pass/fail per assertion per trial | 20/20 trials per assertion |
| **S6 Long-job faults** (HP-7) | invariant against a stubbed provider (kill, 429, truncation, cap) | pass/fail per invariant | all invariants pass |
| **S7 Safety notes** (HP-9) | assertion (WP-4: 4 checks) + recall over SYN-4+ | pass/fail; recall with *n* | WP-4 4/4; recall reported, labelled synthetic |
| **S8 Measurement** (HP-8, R-49) | assertion against the script's timeline; human stopwatch | minutes within ±1 min (script), ±15% (stopwatch) | every case within tolerance |
| **S9 Full run** (R-51 part 3, R-55; HP-1…HP-4, HP-9 full-run lines) | assertion per lesson (R-19 checks, terminal state, provenance), plus run totals | per-lesson pass/fail and counts | rates with *n* = 47: first-pass schema-valid, repairs, failures by reason, placeholders, grounding flags by kind, confirmations, judge flags (if built), cost |
| **S10 Seeded-error run** (R-52, G-3) | human review through the normal flow, scored against the hidden key | caught before approval / missed, and by what (check or reviewer) | caught ÷ planted, by error type |
| **S11 Held-out structural comparison** (R-53) | assertion (counts compared with S-5), local only | per-lesson type match, section-sequence match, focus-standard overlap | counts and rates only |
| **S12 Judge calibration** (R-23) | human labels vs judge verdict, binary per (activity, standard) claim | agree / disagree | agreement and *n*; the judge enters any score only at ≥ 0.8 on ≥ 20 labels |
| **S13 Draft quality** (HP-10, R-60) | human (the approver's rating) | one of three ratings per approved lesson | split with *n* |
| **S14 Capacity spike** (PD-33; R-56, R-57) | assertion over load-script output, model provider stubbed | p95s, error rate, lost updates | per target, pass or missed |

**Judges.** The R-23 judge is binary per claim ("does this activity teach `RL.6.2`?", "does the ELD support keep the
task?"), reads only the activity, the standard's official text and a human-written rubric, and runs on a different
provider from the generator (PD-12). It is advisory in the product and never blocks Approve. **In this plan it grades
nothing until S12 shows agreement ≥ 0.8 on at least 20 of Innocent's labels**; after that its verdicts appear as a
reported, non-gating column in the S9 report. Any change to its prompt or model re-runs S12.

**Component layers** (a pipeline, not an agent, PD-3; each decision-making step is scored on its own, GP-22):

| Layer | What is scored | Suite |
|---|---|---|
| Intake (no model, PD-27) | normalized rows and flags | S1 |
| Unit plan (one call) | valid `UnitPlan`, 47 entries, hand-forwards named (R-8) | S3, S9 |
| Lesson draft (one structured call) | schema-valid first try, required blocks, minutes, codes with `origin` | S3, S9 |
| Checks and repair | each blocking rule fires on its fixture; exactly one repair; failure reasons listed | S2, S3 |
| Judge (cut #2) | agreement with labels | S12 |
| End to end | the reviewer's rating and minutes on approved lessons | S13, M-1 |

## Failure categories

These are the **starting** categories. At §9 they become the `FT-N` taxonomy: every experiment opens with error
analysis of **about 20 traces**, reading each to its **first failure** only and filing it under an `FT-N` written from
what was seen (categories below are renamed, split or merged as the traces demand), with a models × failures table in
`docs/testing/error-analysis/`. Every experiment (`XP-N`, `docs/testing/experiments/`) targets one `FT-N`, changes one
variable, and is scored on the frozen development set with score and cost before and after (GP-21, GP-51). No tuning
change lands without a named failure type (§9 gate).

| Category | Means | Fix lives in |
|---|---|---|
| FC-1 Intake parse | a count, code, note class or flag differs from the expected report | intake normalizer (R-3–R-6) |
| FC-2 Draft schema / truncation | the `LessonDraft` fails Zod on first try, or stops at the output cap | the draft schema, output cap, or HP-1 fallback B (per-section calls) |
| FC-3 Structure and timing | a section is missing or out of order, or minutes are outside 50 ± 5 | compiler templates per lesson type; the locked prompt |
| FC-4 Standards code | a code outside the row's lists, a parent not resolved to a leaf, a missing `origin` | the code check (R-19) and the draft prompt's code rules |
| FC-5 Alignment link | a focus standard without a teaching and a checking link | the draft schema's alignment fields (R-20) |
| FC-6 Grounding | an invented quote, page or chapter, or name; a quote without `source_ref` | the three scans (HP-2) or the locked grounding rule |
| FC-7 Placeholder load | more placeholders than the pair expects, or more than 2 per lesson | the activity patterns in the guidance layer; supplied source text |
| FC-8 Safety | a warning missed, leaked into a student-facing block, or cleared without a named person | safety pattern rules and the placement code (HP-9) |
| FC-9 Cross-lesson state | a `lesson_link` missing or not blocking; wrong approval order | the unit plan and link writer (HP-1, HP-5) |
| FC-10 Approval integrity | a stale approve accepted, an edit persisted after Submit, a four-eyes breach | the approval service and the collaboration server (HP-5) |
| FC-11 Canonical copy | the JSON ↔ Y.Doc round trip changes the hash; an export differs from its snapshot | the store transaction (HP-4) |
| FC-12 Measurement | heartbeat minutes off the script or stopwatch; a synthetic session counted | heartbeat roll-up (HP-8) |
| FC-13 Teaching quality | the approver rates the lesson *rewritten*; high edit distance in one section type | the section's prompt (guidance or locked layer) |
| FC-14 Judge disagreement | the judge's verdict differs from Innocent's label | the judge rubric (never the expected label) |

Operational failures (429s, timeouts, a run that hits its cap, a dropped socket) are **not** quality failures. They
are filed in DO-6 and the health metrics (M-15…M-27), never counted here as wrong answers (GP-58).

## Baselines

Every suite starts without a measured result; each row names the run that sets it.

| Suite | Baseline | Source |
|---|---|---|
| S1 Intake golden | none yet — Plan: first green run of the intake tests at §8 (expected counts are fixed in HP-6) | `evals/reports/` |
| S2 Check golden | none yet — Plan: first run of the check fixtures at §8 | `evals/reports/` |
| S3 Draft golden | none yet — Plan: SP-1's three drafts (rows 8, 9, 25) set the first numbers; §8 golden run replaces them | SP-1 record in `docs/analysis/spikes/` |
| S4 Grounding plants | none yet — Plan: SP-3 over SP-1's drafts and the seeded copies | SP-3 record in `docs/analysis/spikes/` |
| S5 Integrity invariants | none yet — Plan: SP-2's 20 trials per assertion | SP-2 record in `docs/analysis/spikes/` |
| S6 Long-job faults | none yet — Plan: first fault-injection run against the stub at §8 | `evals/reports/` |
| S7 Safety notes | 0 false proposals across the issued sheet's 620 cells [M] with the tight list (HP-9); recall: none yet — Plan: first run over SYN-4+ | HP-9; `evals/reports/` |
| S8 Measurement | none yet — Plan: R-49 scripted review of WP-1, WP-3, WP-4, then Innocent's 2 stopwatch reviews | `evals/reports/` |
| S9 Full run | none yet — Plan: the one R-51 full run of the issued unit, before recording | `evals/reports/full-run-<run_id>.md` |
| S10 Seeded-error run | none yet — Plan: the R-52 run after the full run | `evals/reports/seeded-<run_id>.md` |
| S11 Held-out comparison | none yet — Plan: first local R-53 run after the full run | `evals/local/held-out/` (git-ignored) |
| S12 Judge calibration | none yet — Plan: Innocent labels ~30 pairs if the judge is built (cut #2) | `evals/reports/judge-calibration.md` |
| S13 Draft quality | none yet — Plan: ratings on the approved demo lessons (WP-1…WP-3) | frozen metrics rows |
| S14 Capacity spike | none yet — Plan: first load-script run on the VPS with the provider stubbed (PD-33) | `probe_run` rows |

## Acceptance conditions

Safety- and refusal-shaped checks are **invariants floored at 1.00**, never averages. Targets are `[T]`, adopted under
PD-1 and PD-32; `[A] → SP-N` values are replaced by the spike's measurement before the first full run.

| Suite | Accepts when | Metric (DO-7) | Approved by |
|---|---|---|---|
| S1 Intake golden | 100% of expected fields match on the issued sheet, SYN-2 and WP-5 (0 errors, 0 warnings on WP-5); two runs byte-identical; no `model_call` row before a run | M-40 | PD-32 (HP-6 targets) |
| S2 Check golden | 100% green: every blocking rule fires on its fixture and the clean case passes **(floor 1.00)** | M-30 | PD-32; R-51 |
| S3 Draft golden | every required block and section timing present on WP-1…WP-3 in 3 of 3 repeats; WP-1 L4 → L5 `lesson_link` blocking; placeholder counts exact | M-30, M-31 | PD-4, PD-32 |
| S4 Grounding plants | 11 of 11 code-detectable plants caught **(floor 1.00)**; ≤ 1 false flag per clean lesson; WP-3 0 flags; SYN-1 0 unflagged quotes; quote-span threshold 3 words `[A] → SP-3` | M-32, M-33 | PD-5, PD-32 |
| S5 Integrity invariants | 20 of 20 trials per assertion: stale approve → 409 with no change, 0 edits after lock, 0 silent keystroke losses, four-eyes refusal, pending suggestion blocks Approve, round-trip hash identity **(all floor 1.00)**; store p95 ≤ 500 ms `[A] → SP-2` | M-36, M-37, M-27 | PD-7, PD-32 |
| S6 Long-job faults | 47/47 terminal, 0 duplicate `lesson_version` rows, 0 re-paid calls, 0 lessons lost to 429 alone, one raised-cap retry on truncation, 0 cap overshoot **(floor 1.00)** | M-44, M-17 | PD-13, PD-14, PD-32 |
| S7 Safety notes | WP-4 4 of 4 **(floor 1.00)**: proposed, routed to a teacher-only tip, no student-facing leak, Approve refused until cleared; ≤ 1 false proposal on the issued sheet, 0 on WP-5; 100% of cleared flags carry user, note, time | M-38, M-39 | PD-26, PD-32 |
| S8 Measurement | scripted minutes within ±1 min; stopwatch within ±15%; idle tab adds ≤ 1 min; two tabs count once; synthetic sessions add 0; no route returns minutes by named person **(floor 1.00)** | M-43, M-1 | PD-1, PD-25, PD-32 |
| S9 Full run | report exists with *n* = 47 before the video (R-51); schema-valid first pass ≥ 90%; 100% of lessons end `ready` or `generation_failed` with reasons; V-2 100% **(floor)**; no unsourced quote reaching approval **(floor)**; 0 disclosure prompts in L31–L32 **(floor)**; round-trip hash 47/47; median confirmations ≤ 4 per lesson; spend ≤ run cap (`[A] → SP-1`: measured cost × 47 × 1.5); model spend ≤ $1 per lesson; p95 ≤ 5 min per lesson; wall time ≤ 2 h; run-summary totals equal the sums over stored call rows | M-31, M-15, M-6, M-7, M-36, M-41, M-17, M-28, M-16 | PD-14, PD-29, PD-32; R-51, R-55 |
| S10 Seeded-error run | ≥ 90% caught before approval; below 70% fails the guard (with *n* ≈ 5, 5 of 5 meets the aspiration, 4 of 5 is reported, 3 or fewer fails); the R-52 "wrong code" plant caught **(floor)** | M-4 | PD-1, PD-32 |
| S11 Held-out comparison | measurement-only: the report holds counts only and lives outside tracked files; no threshold, because S-5 is not a clean pair with S-2 (source register) | M-42 | PD-20 |
| S12 Judge calibration | agreement ≥ 0.8 on ≥ 20 labels, confirmed on the 10 held-back labels, before any verdict is reported; never gates Approve | M-34 | R-23; PD-12, PD-28 |
| S13 Draft quality | 100% of approved lessons rated; ≥ 2 of 3 demo lessons *usable with edits* or better; each *rewritten* lesson becomes a §9 error-analysis trace | M-35 | PD-28 |
| S14 Capacity spike | at 200 concurrent users: lesson open p95 < 1.5 s, board poll p95 < 300 ms, remote edit p95 < 500 ms, 0 lost acknowledged updates **(floor)**, error rate < 0.5%, recovery ≤ 2 min; a missed target is reported with its scale-path step | M-18, M-19, M-20, M-21, M-22, M-23 | PD-33, PD-32 |

### One criterion per hard problem

Each HP card's *How we'll know it worked* becomes an eval criterion here:

| HP | Criterion (from the card) | Suite | Metric |
|---|---|---|---|
| HP-1 Orchestration | schema-valid first pass ≥ 90% on the full run; 100% terminal with reasons; WP-1…WP-3 required blocks and minutes 100%; WP-1 L4 → L5 link blocking; one 47-entry `UnitPlan` stored first | S3, S9 | M-31, M-15 |
| HP-2 Grounding | 11/11 code-detectable plants caught; ≤ 1 false flag per clean lesson; expected placeholders WP-1 = 2, WP-2 = 1, WP-3 = 0, WP-4 = 1; SYN-1 0 unflagged quotes | S4, S9 | M-32, M-33, M-7 |
| HP-3 Alignment | 100% of `narrowed` / `added` codes carry origin and an open confirmation; Approve refused while one is open (WP-1 `L.6.4.b`, WP-3 `RL.6.7`); WP-4 `RL.6.6` goes to repair; median confirmations ≤ 4; V-2 100%; no "aligned" badge | S2, S3, S9 | M-6, M-41 |
| HP-4 Canonical copy | round-trip hash identity 47/47; stored-row audit 100%; export hash = snapshot hash 100%; block clears ≤ 5 s after a fill; store p95 ≤ 500 ms `[A] → SP-2` | S5, S9 | M-36, M-26, M-27 |
| HP-5 Approval integrity | stale approve 409 in 100%; 0 late edits; 0 silent losses; four-eyes 100%; regenerate leaves the hash; pending suggestion blocks; WP-1/WP-2 ordered approval | S5 | M-37 |
| HP-6 Normalization | every R-3 / R-5 count reproduced exactly; SYN-2 identical; WP-5 0 flags; ≤ 10 confirmations before Generate (5 [C] on the issued sheet); byte-identical reruns | S1 | M-40 |
| HP-7 Long jobs | kill, 429, truncation and cap tests all pass on the stub; real run ≤ 2 h and ≤ cap, totals reconcile | S6, S9 | M-44, M-16, M-17 |
| HP-8 North star | scripted ±1 min; stopwatch ±15%; idle, two-tab and synthetic rules hold; no minutes by name; tile never without *n*, G-2, "approved k of N", caption | S8 | M-43, M-1, M-3 |
| HP-9 Safety | WP-4 4/4; ≤ 1 false proposal on 620 cells; recall on SYN-4+ reported; 0 disclosure prompts in L31–L32; 100% of clears audited | S7, S9 | M-38, M-39 |
| HP-10 Teaching quality | 100% rated; ≥ 2 of 3 demo lessons *usable with edits* or better; *rewritten* lessons feed §9 | S13 | M-35 |

### R-19 checks covered

One golden failing fixture each (S2), with the rule wording of PRD §5.4: schema invalid; section missing or out of
order; minutes outside 50 ± 5 (and WP-1's 3-minute Look Back repaired once); focus standard without a teaching or a
checking link; a code outside the row's lists, `narrowed` or `added` unconfirmed; a non-leaf code; a quoted span of
3+ words `[A] → SP-3` not in the sources; page or chapter out of range; a proper noun not in the sources (blocking
scope `[A] → SP-3`); a `quote` without `source_ref`; a reviewer-inserted quote over 12 words; a `to-clear` rights
status; an unresolved cross-lesson link; a pending AI suggestion; a `safety_note` without its `teacher_tip`; a 6+ word
run of a safety note in a student-facing block; disclosure prompts in the flagged lesson and the next; a row word
missing from both vocabulary lists. Advisory rules (ELD label mismatch, arc repeats, vocabulary over cap) each have one
fixture asserting they warn and do not block. A draft that still fails after the one repair is stored
`generation_failed` with its reasons (asserted).

## Verification and evidence

Command names are fixed at DO-3 (code design §9); they run from the repo root in the TypeScript workspace (PD-11)
with **npm** (npm workspaces, Node 24, npm 11: the FW record's choice), so arguments follow `--`. Each command's
workflow in DO-6 is in brackets.

| Suite | Command or procedure | Evidence a reviewer sees |
|---|---|---|
| S1, S2 | `npm run eval:golden -- --suite intake,checks` (no model calls) [WF-24] | `evals/reports/golden-<git-sha>.md` with per-case pass/fail; CI log |
| S3 | `npm run eval:golden -- --suite drafts --repeat 3` [WF-24] (real model, ~9 calls, cost printed) | `evals/reports/drafts-<git-sha>.md`: per-case assertions, spread over repeats, cost |
| S4 | `npm run eval:grounding` [WF-42] over the seeded copies (no new model spend) | `evals/reports/grounding-<git-sha>.md`: each plant caught or missed, false flags per lesson |
| S5 | `npm run test:e2e -- integrity --trials 20` [WF-43] (Playwright, 3 contexts) | Playwright report; `evals/reports/integrity-<git-sha>.md` with 20/20 per assertion and store p95 |
| S6 | `npm run eval:faults` [WF-28] (stubbed provider) | `evals/reports/faults-<git-sha>.md`: each invariant, the run summary of the stubbed run |
| S7 | `npm run eval:golden -- --suite safety` [WF-24] | report section with WP-4 4/4 and recall with *n*, labelled synthetic |
| S8 | `npm run test:e2e -- heartbeat` [WF-44]; Innocent's stopwatch sheet for 2 reviews | report with computed vs scripted minutes; stopwatch readings in the dev log |
| S9 | `npm run eval:full-run -- --unit G6-U4` [WF-25] (the one real run, inside the PD-29 ceiling) | `evals/reports/full-run-<run_id>.md` with *n* = 47, rates, failures by reason, placeholders, grounding flags, confirmations, cost; `run_id` traceable to `run` and `model_call` rows |
| S10 | Claude plants ~5 errors via `npm run eval:seed -- --plan <hidden key>` [WF-26]; Innocent reviews through the normal flow | `evals/reports/seeded-<run_id>.md`: each planted error, caught or not, by check or reviewer, labelled "our reviewers" |
| S11 | `npm run eval:heldout` [WF-27] (local only; reads S-5 per its handling rule) | counts in `evals/local/held-out/<date>.json` (git-ignored); only the headline counts may be quoted in docs |
| S12 | Innocent labels pairs in `evals/judge/labels.csv`; `npm run eval:judge-calibrate` [WF-31] | `evals/reports/judge-calibration.md`: agreement, *n*, the 10 held-back results, judge model and prompt version |
| S13 | Approver's rating at Approve (R-60) [WF-15] | Unit quality page rating split with *n*; frozen metrics rows |
| S14 | `npm run load:spike` [WF-29, WF-30] (200 users, 2-min ramp, 15-min plateau, provider stubbed, on the VPS) | `probe_run` rows and `evals/reports/load-<date>.md` with p95s, error rate, lost updates, machine and stub stated |

Every report names the git SHA, prompt version, model IDs and *n*. A PR that changes a prompt, model, schema or check
attaches the S2/S3 report and cost from before and after (GP-21). The golden tier runs in the merge gate as an affected
test whenever generation, checks or intake change (rule `build-loop-test-scope`); S9 runs once before recording, and
the full suite runs before any deploy.
