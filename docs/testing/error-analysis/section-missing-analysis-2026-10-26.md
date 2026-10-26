# section_missing after F1: what the 26 findings are (2026-10-26)

**Question.** The F4 attribution replay shows F1 (e8a7f27) taking the generation gate from 4/47 to 1/47 effective passes, with `section_missing` going from 3 to 26 lessons. Is that a real regression in what the model writes, or a stricter check that is wrong, or a measurement artifact?

**Short answer.** It is mostly a measurement artifact plus two over-strict requirements. 44 of the 60 findings ask for something the model was never told at the time the stored drafts were written (prompt gap). 13 ask for a role no worked pair requires (over-strict). 2 are real model omissions that the repair step fixed. 0 are mapping bugs. One more is not a template role at all (excerpt obligation, F3). The replay re-checks old drafts, written under the old prompt, with the new check; it cannot show whether the new prompt, which now lists every required role, closes the gap. Only a fresh draft run can.

## How this was measured

- Replay of `run_01M5W7VQFD6AEVPMPZA2Z4S9ZK` (attempt 3, `ls_nl112c`, read-only, no model call, no spend) with `evals/src/replay-finals-main.ts --which original,effective,final --messages`, run on the working tree at e8a7f27 plus F2's uncommitted edits. The pass counts reproduce the F4 numbers exactly (1/47 original, effective and final). Findings below are the `effective` set (the first draft of each lesson; for 28 lessons the `final` set uses the stored repair output instead).
- Lesson types from `lesson.type` in the same database. Stored drafts and the prompt text each draft was written under come from `model_call.raw_output` and `model_call.rendered_prompt` of the same run.
- 44 of 47 lessons compiled; L28, L31 and L32 fail the draft schema and have no gate findings in `effective`.

## 1. The 26 lessons and 60 findings by role and lesson type

26 lessons: Reading 10 of 21, Writing 8 of 15, Flex Day 6 of 6, Academic Discussion 1 of 2, Spark 1 of 3. No Assessment, Research or Presentation lesson is in the run.

| Lesson type | Section | Missing | Findings | Lessons |
|---|---|---|---|---|
| Flex Day | Launch | role `sample_response` | 6 | FLEX-1a, 1b, 2a, 2b, 3a, 3b |
| Flex Day | Learning in Action | role `teacher_tip` | 6 | FLEX-1a, 1b, 2a, 2b, 3a, 3b |
| Flex Day | Learning in Action | role `routine_heading` | 1 | FLEX-2a |
| Reading | Learning in Action | part "Part A" | 9 | L4, L6, L9, L12, L14, L20, L25, L30, L33 |
| Reading | Learning in Action | part "Part B" | 10 | the nine above plus L10 |
| Reading | Learning in Action | role `routine_heading` | 8 | L4, L6, L9, L12, L14, L20, L30, L33 |
| Writing | Learning in Action | part "Part A" | 4 | L26, L36, L37, L41 |
| Writing | Learning in Action | part "Part B" | 6 | the four above plus L15, L24 |
| Writing | Learning in Action | role `routine_heading` | 4 | L26, L36, L37, L41 |
| Writing | Literacy Lab | role `callout_watch` | 2 | L38, L39 |
| Academic Discussion | Learning in Action | Part A, Part B, `routine_heading` | 3 | L19 |
| Spark | whole lesson | required excerpt slot (outline writer task) | 1 | L2 |
| | | **Total** | **60** | **26** |

By kind: parts 31 (Part A 14, Part B 17), `routine_heading` in Learning in Action 14 (13 outside Flex), Flex Launch `sample_response` 6, Flex `teacher_tip` 6, Literacy Lab `callout_watch` 2, excerpt 1. Every other template role (Launch routine heading, teacher talk, sample response; Literacy Lab heading, check, three callouts bar `callout_watch`, support table; Learning in Action teacher talk, check, three callouts, support table; Look Back quick write and sample response; Homework text) is present in every compiled draft. 100% of the failure sits in these six categories.

## 2. Is each role required? (authority)

Authority used: the issued-brief analysis `docs/source/04-lesson-structure-analysis.md` (sections 3b, 6, 7, 8 and node table), PRD R-11 and R-21, worked pairs `docs/data/worked-pairs.md` WP-1..WP-3 table B, and `evals/cases/drafts/wp-{1,2,3}/expected.json` (which say "authority: worked-pairs.md ... Required output B"). Nothing under `docs/source/restricted` was read.

| Role (where) | Authority | Verdict |
|---|---|---|
| Flex Launch `sample_response` | WP-3 table B: Launch is "`ask` + `sample_response`"; expected.json lists it | **Required** |
| Flex Learning in Action `teacher_tip` | WP-3 table B: `teacher_tip` (choose clips that match the events; preview them); expected.json lists it | **Required** |
| Flex Learning in Action `routine_heading` | WP-3 table B: `routine` graphic organizer; expected.json lists `routine_heading` | **Required** |
| Learning in Action `routine_heading` in Reading, Writing, Academic Discussion (and Research, Presentation) | WP-1 expected.json: Part A = teacher_talk, text_evidence_needed, support_table; Part B = cfu_item, support_table. WP-2: excerpt_slot, support_table; cfu_item, support_table. No routine heading is required. Source 04 says routine headings exist inside bodies (row 28) but names no per-section requirement | **Not required** (over-strict) |
| Part A and Part B in Learning in Action, Reading and Writing | WP-1 and WP-2 table B and expected.json; source 04 section 3b "Usually Part A and Part B (35 lessons; 3 parts in 2; none in 11)"; PRD R-21 addresses `...LearningInAction.PartA` | **Required for Reading and Writing** (two worked pairs). "Usually", not always, in the published lessons |
| Part A and Part B, Academic Discussion, Research, Presentation | No worked pair. Source 04 section 8: "Learning in Action parts (0-3)" varies by lesson | **Unproven**; conditional |
| Literacy Lab `callout_watch` (and purpose, say) | Source 04 section 6: the Integrated ELD drop-down holds "exactly three callouts in order" purpose, say, watch; node table; "at least one per lesson in Literacy Lab / Learning in Action"; Literacy Lab has one in 40 of 41 lessons. WP-1/WP-2 expected.json do not list callouts | **Required as a set when the drop-down is present**; the drop-down itself is "nearly always", not strictly always |

Latent over-strictness, not hit by this run because the model writes these anyway: Launch and Literacy Lab `routine_heading` (WP-1 yes, WP-2 no), Look Back `sample_response` (WP-1 yes, WP-2 no), Homework text (source 04: Homework present in 44 of 50 lessons), Literacy Lab `cfu_item` (source 04: Check for Understanding in 24 Literacy Labs; the worked pairs have it). `five()` in `templates.ts` is the union of WP-1 and WP-2.

## 3. Did the prompt tell the model? Classification

The stored drafts were written under the run's prompt version (`c8fb9306...`). Its rendered template block lists, for Flex Day, Launch = `routine_heading, teacher_talk` and Learning in Action = `teacher_talk, cfu_item, callout_purpose, callout_say, callout_watch`; for the five-section types, Learning in Action = `teacher_talk, cfu_item, callout_*, support_table` with no `parts:` suffix and no `routine_heading`. Its `lesson-shape.md` had no "Parts" paragraph and no Flex sentence (those arrived with 88d6b97 and e8a7f27). At HEAD the template block is built from the same `SECTION_TEMPLATES` the check reads (`render.ts` `template_block`, `draft-node.ts` `template_for`), so the HEAD prompt lists every blocking role and part. The check and the prompt can no longer disagree; the stored drafts predate that.

Classes (counts are findings; 0 mapping bugs because every flagged role or part is truly absent from the stored draft, checked programmatically for all 59 role/part findings):

| Class | Findings | Lessons | What it covers |
|---|---|---|---|
| **Prompt gap** (run prompt never named it) | 44 | 25 | Flex Launch `sample_response` 6, Flex `teacher_tip` 6, Flex `routine_heading` 1, Part A 14, Part B 17 |
| **Over-strict check** (role optional per authority) | 13 | 13 (all also have the parts gap) | Learning in Action `routine_heading` in Reading 8, Writing 4, Academic Discussion 1. Also a prompt gap at run time |
| **Model omission** (told, left out) | 2 | 2 | Writing Literacy Lab `callout_watch` |
| **Mapping bug** | 0 | 0 | none |
| **Other rule** (not a template role) | 1 | 1 | Spark L2 required excerpt slot (`excerpt_obligation`, CM-5 / F3) |

Two concrete stored examples per class (lesson id, role):

- **Prompt gap, Flex `sample_response` (Launch):** G6.U4.FLEX-1a (Launch blocks are `routine_heading` 1 min and `teacher_talk` 4 min only) and G6.U4.FLEX-3b.
- **Prompt gap, Flex `teacher_tip` (Learning in Action):** G6.U4.FLEX-1a (callouts, two `teacher_talk` parts, one `cfu_item`, no tip) and G6.U4.FLEX-2b.
- **Prompt gap, parts:** G6.U4.L12 (all 8 Learning in Action blocks have `part: null`, so neither Part A nor Part B) and G6.U4.L9 (9 blocks, all null). One-label drafts miss only Part B: G6.U4.L10 (one block labelled "Model", six null) and G6.U4.L24 (two blocks labelled "Peer feedback").
- **Over-strict, Learning in Action `routine_heading`:** G6.U4.L12 and G6.U4.L4 (no routine heading anywhere in the section, and WP-1 does not require one).
- **Model omission, Literacy Lab `callout_watch`:** G6.U4.L38 (has purpose and say callouts, no watch) and G6.U4.L39 (same). Both listed `callout_watch` in the run's template line. Both are gone in the stored `final` (repair) output, so the repair step does fix this kind of omission.
- **Mapping:** none. Descriptive part labels are mapped by `compile/part-labels.ts` `plan_parts` to Part A, Part B in order of appearance, so a draft with two distinct labels passes (23 of the 44 compiled lessons pass the parts check that way, by luck rather than by instruction); a draft with one label or none misses Part B or both. That is correct behaviour, not a bug.

### Two side effects of the compiler that the check hides

1. **The Learning in Action `routine_heading` check passes by accident.** `compile_draft` emits a routine heading for every part title (`N.routine_title`). The 19 compiled Reading, Writing and Discussion lessons that pass it have no `routine_heading` block in their draft at all (0 of 33 Reading, Writing and Discussion drafts have one except L25); a title for a part label satisfies it. So the requirement measures "has a titled part", which `parts` already measures. Same for the five Flex lessons that pass it (FLEX-1a, 1b, 2b, 3a, 3b): their `routine_heading` is a compiler part-title for a label the model invented.
2. **`compile_draft` makes Part headings in sections whose template lists no parts** (Flex Day Learning in Action: "Set up the organizer", "Choose", "Catch-up work time"; Spark Learning in Action: "Small-group annotation"). The authority says Spark and Flex have no parts (source 04 section 3b; `code-design.md` CM-1). The current prompt says "in a section whose template line lists no parts, part is null", but the compiler does not enforce it.

### Caveat on the `final` numbers

The stored repair outputs were produced from the old checks' findings, so they were never asked to add a Flex sample response, a teacher tip or Part A/B. In `final`, the 28 repaired lessons still carry 64 findings (26 lessons). The `final` column cannot say whether repair would fix these under the new checks. Do not read the 5-to-1 `final` drop as a repair-loop failure.

## 4. Recommendation per role

| Role | Recommendation | Why |
|---|---|---|
| Flex Launch `sample_response` | **Keep blocking.** Fix prompt: already in the HEAD template line; add it to the Flex sentence in `lesson-shape.md` | WP-3 requires it. Prompt gap only |
| Flex `teacher_tip` | **Keep blocking.** Prompt already names it at HEAD (template line and the Flex sentence) | WP-3 requires it |
| Flex Learning in Action `routine_heading` | **Keep blocking.** Prompt already names it at HEAD | WP-3 requires it. Passes today only through compiler part titles |
| Learning in Action `routine_heading`, five-section types | **Make not required** (remove from `five()` Learning in Action roles; keep it for Flex) | No worked pair requires it; it duplicates `parts`; the check does not test what it says. Removes 13 findings, 0 lessons change verdict because all 13 also lack parts |
| Part A and Part B, Reading and Writing | **Keep blocking; fix prompt only** (HEAD already lists `parts: Part A, Part B` and the Parts paragraph). Re-measure with a fresh draft sample | WP-1 and WP-2 require it. 17 findings in 3 lessons (L10, L15, L24) are one-label drafts, the clearest test of whether the new prompt works |
| Part A and Part B, Academic Discussion, Research, Presentation | **Make conditional**: drop `parts` from these three slots in `templates.ts` (or make it advisory) until a worked pair or a published-lesson count shows it. Owner decision on whether to keep | No authority beyond "usually"; source 04 section 8 says parts vary 0-3. Affects 1 lesson here (L19), 0 verdict change if the Reading and Writing parts fail anyway |
| Literacy Lab `callout_watch` | **Keep blocking** | Source 04: the three callouts come as a set. Repair fixes it |
| Spark excerpt slot (L2) | **Out of scope here**; route to F3 (CM-5) | Different rule, outline-writer task |
| Mapping (`role-nodes.ts`) | **No fix needed.** Optional hardening: (a) make `routine_heading` not satisfiable by `N.routine_title`; (b) have `compile_draft` drop part labels for slots with no `parts` | Section 3 side effects |

**Expected effect of the template changes alone: none on the pass count.** After removing the Learning in Action heading requirement and dropping Academic Discussion parts, `section_missing` still blocks 25 of the 26 lessons (6 Flex, 18 Reading and Writing, L2). The way down is the prompt, and it has to be measured on new drafts. Do **not** loosen Flex or Reading and Writing requirements to recover the replay number; those are authority-backed.

## 5. Exact edits (code is not changed by this analysis)

**F1 owner: `packages/core/src/compile/templates.ts`**
1. In `five()`, Learning in Action roles: remove `"routine_heading"` (keep `teacher_talk, cfu_item, callout_purpose, callout_say, callout_watch, support_table`). Flex keeps `FLEX_LIA_ROLES` (which includes `routine_heading`, `teacher_tip`).
2. (Owner decision) Give `five(lesson_type, { parts })` a flag; pass parts for `Reading` and `Writing` only, none for `Academic Discussion`, `Research`, `Presentation`.
3. Update `template-contract.test.ts` and `required-roles.test.ts` expectations accordingly, plus the CM-1 row in `docs/design/code-design.md` ("roles unioned from WP-1/WP-2; routine heading in Learning in Action not required; parts for Reading and Writing").

**F1 owner: `compile/role-nodes.ts`, `structural/section_missing.ts`, `compile/compile-draft.ts`** (optional): none required. Hardening: in `compile_draft`, call `plan_parts` only for slots with `parts`, and treat a part label in a slot without `parts` as null (title routine kept as a routine heading); give `part_heading` titles a flag so `role_present("routine_heading")` ignores compiler part titles.

**Prompt text (shared with F2: `lesson-shape.md`, `render.ts` template block):**
4. `lesson-shape.md` line 7: extend the Flex sentence to "A Flex Day lesson also needs a sample_response in Launch, and in Learning in Action a routine_heading that names the activity and a teacher_tip..." (today the Launch sample response is only in the template line). Assessment shares the Flex template.
5. `render.ts` `template_block`: no change; it already prints roles and `parts:`. If edit 2 is taken, the Academic Discussion line will stop printing `parts:` automatically.
6. After the edits, re-draft a bounded sample with a model (needs the spend decision): the 6 Flex rows, L10, L15, L24 (one-label Part B cases), L12, L9 (null parts), L38, L39. That is 13 drafts and settles whether the prompt closes the gap.

## 6. What this replay cannot show

Prompt not re-rendered (the replay re-checks stored drafts only); reviewer state, standards texts and cross-lesson links as in the F4 report; Assessment, Research and Presentation lessons are not in the run, so those templates are unmeasured. Source: `/tmp/sm-analysis.json` (not kept in the repo; regenerate with the command above).
