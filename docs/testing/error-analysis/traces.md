# Error analysis round: the traces (NL-120)

Synthetic lesson data only. Read-only reads of two kept databases (`BEGIN READ ONLY`): `ls_nl112_dev` (attempt 2, run
`run_01M5W6JK5XJQ7VE0WMR7HR1Z11`) and `ls_nl112c` (attempt 3, run `run_01M5W7VQFD6AEVPMPZA2Z4S9ZK`). Nothing from
`docs/source/restricted` was opened, and no provider key was printed or copied. No model call was made for this round.
The taxonomy, the models x failures table and the candidate experiments are in [`taxonomy.md`](taxonomy.md).

## What this file is

For 20 lessons it records the first thing that went wrong, in the words of what happened, with one quoted line of
evidence, the starting category from `docs/design/eval-plan.md` (FC-1 to FC-14) and the final failure type (`FT-N`, defined
in `taxonomy.md`). Later damage is not catalogued. A trace is one `lesson_job` plus its `model_call` rows.

## How the 20 were chosen (selection rule and seed)

The ticket's rule, in its order: (1) every lesson that ended `generation_failed`; (2) every lesson with a blocking issue after
the repair; (3) every lesson whose first draft needed the repair; (4) fill to about 20 with a seeded-random draw across lesson types.

**This rule cannot be applied literally, and the departure is stated here rather than hidden.** The ticket was written for one
run of 47. Two runs exist, and applied to them the literal rule gives 17 failed + 11 repaired-and-ready in attempt 3 alone, and 47
repaired lessons in attempt 2: far more than the 18 to 22 rows the acceptance criterion allows. So the rule was applied within a
budget of 20 (13 from attempt 3, the run whose numbers are reported; 7 from attempt 2, the "before prompt round 1" column).
**Not every failed lesson was read.** Of attempt 3's 17 blocked lessons, 8 were read; the other 9 are covered only by the audit's
replay (see `taxonomy.md`, "Measured, replayed, not done").

Seed: **20261026**, `random.Random(20261026)`, candidate lists sorted by plain string order of `lesson_id`, draws made in this order:

```python
rng = random.Random(20261026)
# attempt 3, failed (17):
#   take all with an initial draft that failed the schema   -> G6.U4.L28, G6.U4.L32
#   take all with page_out_of_range                         -> G6.U4.L21, G6.U4.L22
#   draw 4 of the 13 remaining name-check blocks            -> rng.sample(names, 4)
# attempt 3, ready after one repair (11): rng.sample(repaired_ready, 5)
# attempt 2, ready after one repair (8):  rng.sample(ready, 2)
# attempt 2, fill across lesson types: for each type (Academic Discussion, Flex Day, Reading, Spark, Writing),
#   rng.choice(lessons of that type not already drawn)       -> 5 more
```

| Pool | Population | Read | Why these |
|---|---|---|---|
| Attempt 3, `generation_failed` (blocked after repair) | 17 | 8 | all 2 with a schema-invalid first draft, all 2 `page_out_of_range`, 4 of 13 other name blocks by the draw |
| Attempt 3, ready after one repair | 11 | 5 | seeded draw |
| Attempt 3, ready with no repair | 19 | 0 | no failure to read |
| Attempt 2, ready after one repair | 8 | 2 (+1) | seeded draw; the per-type draw for Reading also landed on a ready lesson (L27) |
| Attempt 2, `generation_failed` | 39 | 4 | per-type draw (Academic Discussion, Flex Day, Spark, Writing) |

Lesson types in the 20 (counted from the table below): Reading 8, Writing 5, Flex Day 3, Spark 2, Academic Discussion 2.

## How "first failure" was read

A draft goes through four steps: (1) the model's JSON must parse against `LessonDraft`; (2) it must compile; (3) the
generation gate runs the check rules and lists findings; (4) one repair, then the gate again. The first failure is the earliest
step that failed. Steps 1 and 2 were measured here by running `LessonDraft.safeParse` on each stored first draft
(the schema is unchanged since attempt 3). For step 3 the stored finding is read from the `repair_findings` block of the
repair call's rendered prompt, which holds the findings of the first draft; where several are listed, the first in the order
the gate printed them is used (that is the gate's order, not a clock time). A draft that is schema-valid and has no
finding never reached repair; those 19 lessons in attempt 3 are not traces.

## The trace table

Columns: `lesson_job` id, attempt, lesson, type, outcome at the end of that run, first failing step, one quoted line of
evidence, starting category, final `FT-N`. Evidence lines are copied from the stored draft, finding or schema message.

| Trace (lesson_job) | Att. | Lesson | Type | End of run | First failing step | Evidence (quoted) | Start FC | FT |
|---|---|---|---|---|---|---|---|---|
| lesson_job job_01M5W7VQGAH45FSFTV0J3MSC1R | 3 | G6.U4.L21 | Reading | failed | step 3: Homework flagged | finding: `page_out_of_range ... @ G6.U4.L21.Homework`; draft: "Read the summary of Chapter 15 (pp. 219 through the top of p. 224"; row: "Read summary of Ch. 15 (pp. 219–top of 224" and "(pp. 224 ... )–233" | FC-6 | FT-2 |
| lesson_job job_01M5W7VQGAH45FSFTV0J3MSC1S | 3 | G6.U4.L22 | Reading | failed | step 3: Look Back flagged | finding: `page_out_of_range ... @ G6.U4.L22.LookBack`; draft: "Use one detail from Chapter 15 and one word from this week's vocabulary." | FC-6 | FT-2 |
| lesson_job job_01M5W7VQGAH45FSFTV0J3MSC1Z | 3 | G6.U4.L28 | Reading | failed | step 1: schema | `blocks.12.code_origins`: "code_origins must match standard_codes" (callout_say, 2 codes `RL.6.1`, `ELD.PI.6.7`, origins `["outline"]`) | FC-2 | FT-3 |
| lesson_job job_01M5W7VQGAH45FSFTV0J3MSC23 | 3 | G6.U4.L32 | Reading | failed | step 1: schema | `blocks.10.code_origins`: "code_origins must match standard_codes" (callout_purpose, 3 codes, origins `["outline"]`) | FC-2 | FT-3 |
| lesson_job job_01M5W7VQGAH45FSFTV0J3MSC28 | 3 | G6.U4.FLEX-2b | Flex Day | failed | step 3: Learning in Action flagged | finding: `proper_noun_unsourced ... @ G6.U4.FLEX-2b.LearningInAction`; rationale: "Listing events is retelling, not explaining meaning." | FC-6 | FT-1 |
| lesson_job job_01M5W7VQGAH45FSFTV0J3MSC1B | 3 | G6.U4.L10 | Reading | failed | step 3: Literacy Lab flagged | finding: `proper_noun_unsourced ... @ G6.U4.L10.LiteracyLab`; rationale: "Ignoring the word gives no way to understand the sentence." | FC-6 | FT-1 |
| lesson_job job_01M5W7VQGAH45FSFTV0J3MSC1M | 3 | G6.U4.L19 | Academic Discussion | failed | step 3: Literacy Lab flagged | finding: `proper_noun_unsourced ... @ G6.U4.L19.LiteracyLab`; rationale: "Too short and unclear. It does not say whose idea or what the idea is." | FC-6 | FT-1 |
| lesson_job job_01M5W7VQGAH45FSFTV0J3MSC2D | 3 | G6.U4.L40 | Writing | failed | step 3: Learning in Action flagged | finding: `proper_noun_unsourced ... @ G6.U4.L40.LearningInAction`; rationale: "Switching terms can confuse readers about whether the ideas are the same." | FC-6 | FT-1 |
| lesson_job job_01M5W7VQGAH45FSFTV0J3MSC2F | 3 | G6.U4.FLEX-3a | Flex Day | ready (1 repair) | step 3: Learning in Action flagged | finding: `proper_noun_unsourced ... @ G6.U4.FLEX-3a.LearningInAction`; draft: "finish their Performance Task, Shared Stories, Shared Lessons, and to present it"; repair wrote "finish their unit task" | FC-6 | FT-7 |
| lesson_job job_01M5W7VQGAH45FSFTV0J3MSC12 | 3 | G6.U4.L1 | Spark | ready (1 repair) | step 3: minutes | finding: `minutes_out_of_range: "Learning in Action" is 28 minutes; the template expects 30` | FC-3 | FT-6 |
| lesson_job job_01M5W7VQGAH45FSFTV0J3MSC1X | 3 | G6.U4.L26 | Writing | ready (1 repair) | step 3: minutes | finding: `minutes_out_of_range: Lesson totals 57 minutes; expected 50 plus or minus 5` (Learning in Action 37 against 30) | FC-3 | FT-6 |
| lesson_job job_01M5W7VQGAH45FSFTV0J3MSC22 | 3 | G6.U4.L31 | Writing | ready (1 repair) | step 1: schema | `blocks.16.code_origins`: "code_origins must match standard_codes"; `standard_codes` is one string `"W.6.2, ELD.PI.6.10, ELD.PI.6.7, ELD.PII.6.5"` with four origins | FC-2 | FT-3 |
| lesson_job job_01M5W7VQGAH45FSFTV0J3MSC29 | 3 | G6.U4.L36 | Writing | ready (1 repair) | step 3: quote | finding: `quote_unmatched: Quoted passage of 4 words ... @ G6.U4.L36.Launch`; draft: "the question 'Which path interests you?'"; repair: "the question about which path interests you" | FC-6 | FT-7 |
| lesson_job job_01M5W6JK66Q93BV09RBY67TW9Y | 2 | G6.U4.L4 | Reading | ready (1 repair) | step 3: standard | finding: `standard_not_checked: Standard RL.6.2 has no Pulse Check item tagged with it at G6.U4.L4.LearningInAction` | FC-5 | FT-5 |
| lesson_job job_01M5W6JK66Q93BV09RBY67TWA0 | 2 | G6.U4.L6 | Reading | ready (1 repair) | step 1: schema | `blocks.8.cfu`: "cfu_item requires cfu" (Literacy Lab `cfu_item` written with `"cfu": null`) | FC-2 | FT-4 |
| lesson_job job_01M5W6JK66Q93BV09RBY67TWAZ | 2 | G6.U4.L35 | Academic Discussion | failed | step 1: schema | `blocks.7.cfu`: "cfu_item requires cfu" (Literacy Lab `cfu_item`, `"cfu": null`) | FC-2 | FT-4 |
| lesson_job job_01M5W6JK66Q93BV09RBY67TWB0 | 2 | G6.U4.FLEX-2a | Flex Day | failed | step 1: schema | `blocks.3.cfu`: "cfu_item requires cfu" (Learning in Action `cfu_item`, `"cfu": null`) | FC-2 | FT-4 |
| lesson_job job_01M5W6JK66Q93BV09RBY67TWAQ | 2 | G6.U4.L27 | Reading | ready (1 repair) | step 1: schema | `blocks.7.cfu`: "cfu_item requires cfu" (Literacy Lab `cfu_item`, `"cfu": null`) | FC-2 | FT-4 |
| lesson_job job_01M5W6JK66Q93BV09RBY67TW9V | 2 | G6.U4.L1 | Spark | failed | step 1: schema | `blocks.5.cfu`: "cfu_item requires cfu" (Learning in Action `cfu_item`, `"cfu": null`) | FC-2 | FT-4 |
| lesson_job job_01M5W6JK66Q93BV09RBY67TWB4 | 2 | G6.U4.L38 | Writing | failed | step 1: schema | `blocks.8.cfu`: "cfu_item requires cfu" (Literacy Lab `cfu_item`, `"cfu": null`) | FC-2 | FT-4 |

20 rows: attempt 3 has 13, attempt 2 has 7.

## Notes a reader needs

- The FT-1 lines are copied from the first draft and appear unchanged in the repair output. The repair therefore could not
  clear them, and the lesson stayed blocked. At the time the repair request carried no matched word, so the model could not know
  which word was meant (the repair request was changed in commit `42f6989`, after these runs).
- In the attempt 2 rows, the first draft failed the schema first; the final failure the job stored (`standard_not_checked` or
  `section_missing`) came after that and is not the first failure. Four of the seven attempt 2 traces still ended blocked.
- FT-2, row L21: the row gives the pages as "pp. 219–top of 224" and "pp. 224 ... –233", so p. 233 is inside the lesson's pages.
  The stored extractor read the second range as page 224 only (see `docs/delivery/error-analysis-real-run.md`).
  FT-2, row L22: the extractor read "Chapter 15 and one" as chapters 1 to 15 (re-run of the stored and the corrected extractor: `taxonomy.md`, "Measured, replayed, not done").
- No trace here ended on a 429, a timeout, a cap or a truncation. See "Operational failures" in `taxonomy.md`.
- No trace in this file is an eval case. Unreviewed traces never become cases (DO-5 *Case provenance*).
