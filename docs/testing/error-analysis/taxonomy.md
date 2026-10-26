# Error analysis round: the taxonomy (NL-120)

Written from the 20 traces in [`traces.md`](traces.md), each read to its first failure. It replaces the plan in
[`README.md`](README.md) for NL-120's part of the protocol. Synthetic lesson data only.

**Human gate (AC-5).** Innocent has not reviewed this taxonomy or the candidate list. The state the ticket prescribes when he
has not answered by the time the next dependent ticket is ready is the line below; it is recorded now so the record is
exact, and it is the PD-32 fallback label, not a human review. The issue stays open.

adopted under PD-32 fallback, not reviewed by Innocent

Unreviewed traces never become eval cases. No file in `evals/cases/` was touched.

## In plain words

Twenty lessons were read to the first thing that went wrong. Seven kinds of first failure showed up. Two of those kinds are
not the model's fault: our own checker flagged text that was fine (6 of 20 traces). The other five are the model's
behaviour (14 of 20). Two of the model kinds were already fixed by the first prompt round and do not appear in attempt 3's
sample at all. What is left worth an experiment is small: two candidates, and a third slot closed unused.

## The failure types (FT-N)

"Where the fix lives" is the ticket's list: prompt layer, schema, check, compiler, code. FT-1 and FT-2 are
**checker/compiler failure types**: the lesson was not wrong, the check or the compiler's output was. They are kept apart from
the **model-behaviour failure types** (FT-3 to FT-7), where the draft itself was wrong.

| FT | Definition (one sentence) | Kind | Count (of 20) | Example trace | Where the fix lives | Started as |
|---|---|---|---|---|---|---|
| FT-1 | The name check reads an ordinary word at the start of an answer rationale (for example "Listing", "Ignoring", "Switching", "Too") as a proper name that is not on the lesson card. | checker/compiler | 4 | `job_01M5W7VQGAH45FSFTV0J3MSC28` (G6.U4.FLEX-2b) | check (name scan) and compiler (it puts "B." style labels in front of rationales); fixed in `d727537` | FC-6 split |
| FT-2 | The page and chapter check misreads a reference: a row range written "pp. 224 (...)–233" is read as page 224 only, and "Chapter 15 and one" is read as chapters 1 to 15. | checker/compiler | 2 | `job_01M5W7VQGAH45FSFTV0J3MSC1S` (G6.U4.L22) | check (page parser); fixed in `d727537` | FC-6 split |
| FT-3 | The draft's `code_origins` list does not have one entry per entry of `standard_codes` (too few origins, or all codes joined in one string), so the draft fails the schema. | model behaviour | 3 | `job_01M5W7VQGAH45FSFTV0J3MSC1Z` (G6.U4.L28) | prompt layer (locked lesson shape); the schema could also derive it | FC-2 split, and FC-4 (origin) |
| FT-4 | A `cfu_item` block is written with `"cfu": null`, so the draft fails the schema. | model behaviour | 6 | `job_01M5W6JK66Q93BV09RBY67TWA0` (G6.U4.L6) | prompt layer (locked lesson shape); changed in prompt round 1 | FC-2 split |
| FT-5 | Fewer Pulse Check items are written than there are focus codes, so a focus code has no check tagged with it. | model behaviour | 1 | `job_01M5W6JK66Q93BV09RBY67TW9Y` (G6.U4.L4) | prompt layer (locked lesson shape); changed in prompt round 1 | FC-5 |
| FT-6 | The block `minutes` in a section do not add up to the template's minutes for that section. | model behaviour | 2 | `job_01M5W7VQGAH45FSFTV0J3MSC12` (G6.U4.L1) | prompt layer (locked lesson shape); the compiler could also reconcile | FC-3 |
| FT-7 | The model writes text the lesson card and text cards do not support: words in quotation marks that are not on a card, or a name or title from its own knowledge. | model behaviour | 2 | `job_01M5W7VQGAH45FSFTV0J3MSC29` (G6.U4.L36), quote; `job_01M5W7VQGAH45FSFTV0J3MSC2F` (G6.U4.FLEX-3a), name | prompt layer (locked grounding rule) | FC-6 split |

FC-1, FC-7 to FC-14 did not appear in any of the 20 first failures. FC-4 (standards code) shows only as the origin half of FT-3.
Nothing here says those categories are healthy: these traces never reached the steps where they would show.

### Counts add up

| FT | Attempt 2 read (n = 7) | Attempt 3 read (n = 13) | Total (n = 20) |
|---|---|---|---|
| FT-1 | 0 | 4 | 4 |
| FT-2 | 0 | 2 | 2 |
| FT-3 | 0 | 3 | 3 |
| FT-4 | 6 | 0 | 6 |
| FT-5 | 1 | 0 | 1 |
| FT-6 | 0 | 2 | 2 |
| FT-7 | 0 | 2 | 2 |
| **Sum** | **7** | **13** | **20** |

Checker/compiler FTs (FT-1, FT-2): 6 of 20. Model-behaviour FTs (FT-3 to FT-7): 14 of 20. These are counts of the traces
read, not rates for the run. The read traces were picked by the rule in `traces.md` (which favours failures), so "6 of 20" is
not "30% of lessons".

## Models x failures

Every `lesson_draft`, `repair` and `unit_plan` call in both runs went to `claude-sonnet-5-5` (requested and served name
agree in the stored rows). So there is one model; the columns are the two runs, which differ in prompt and code, not in model.
No other model was run, so there is no model comparison here and none is claimed.

| | Attempt 2 (`ls_nl112_dev`) | Attempt 3 (`ls_nl112c`) |
|---|---|---|
| Run | `run_01M5W6JK5XJQ7VE0WMR7HR1Z11` | `run_01M5W7VQFD6AEVPMPZA2Z4S9ZK` |
| Model, draft and repair | `claude-sonnet-5-5` | `claude-sonnet-5-5` |
| Prompt version stored in the database | `pr_01M5W6FH80BNK8MRKMQVJBD5E7`, before prompt round 1 | `pr_01M5W7TNXN3RW5HBTC37H9SSPN`, after rounds 1 and 2 |
| Code at run time (from the run reports) | `975600f9564c-dirty` | `64fe0e951216-dirty` |
| Also changed between the runs | Round 1 also changed the Spark and Flex templates in `packages/core/src/compile/templates.ts` and the repair prompt, so the columns differ by prompt and template, not by prompt alone | |
| Lessons in the run / read as traces | 47 / 7 | 47 / 13 |
| FT-1 name check on a label word | 0 of 7 | 4 of 13 |
| FT-2 page or chapter misread | 0 of 7 | 2 of 13 |
| FT-3 `code_origins` does not match | 0 of 7 | 3 of 13 |
| FT-4 `cfu_item` with `cfu: null` | 6 of 7 | 0 of 13 |
| FT-5 too few check items | 1 of 7 | 0 of 13 |
| FT-6 minutes do not add up | 0 of 7 | 2 of 13 |
| FT-7 text the cards do not support | 0 of 7 | 2 of 13 |

The samples were drawn differently for each run (attempt 3 over-represents blocked lessons), so compare the two columns only
with the whole-run counts below, not with each other's rows.

### Whole-run context (all 47 lessons each; measured, not read)

The first stored failing step of every lesson, from the same method as the traces (schema check on the stored first draft,
and the first finding the gate listed for it). This shows how common each first failure is. It does **not** say which of
the check findings were false: only the 17 attempt 3 blocks were replayed (next section).

| First stored failure | Attempt 2 | Attempt 3 | Maps to |
|---|---|---|---|
| Schema: `cfu: null` (6 of these also have a `code_origins` issue) | 35 | 0 | FT-4 (and FT-3 for the 6) |
| Schema: `code_origins` only | 1 | 3 | FT-3 |
| Check: `standard_not_checked` | 9 | 0 | FT-5 |
| Check: `quote_unmatched` | 2 | 2 | FT-7 (not read, except 1) |
| Check: `proper_noun_unsourced` | 0 | 12 | FT-1 for blocked lessons (replay); unknown for the ready ones |
| Check: `page_out_of_range` | 0 | 5 | FT-2 for the 2 blocked (replay); unknown for 3 ready ones |
| Check: `minutes_out_of_range` | 0 | 4 | FT-6 (not read, except 2) |
| Check: `section_missing` | 0 | 2 | not read; not classified (G6.U4.L38, L39) |
| No repair needed | 0 | 19 | no failure |
| **Sum** | **47** | **47** | |

Attempt 2 had 11 of 47 first drafts that parse and compile; attempt 3 had 44 of 47 (audit, same numbers reproduced here by
running the schema on the stored first drafts). Attempt 3: 19 of 47 needed no repair, 28 were repaired, 11 of the 28 recovered,
30 of 47 stored ready.

## Operational failures (listed apart, not counted as wrong answers; GP-58)

None occurred. Across both runs every `lesson_draft`, `repair` and `unit_plan` call has status `completed` and stop reason
`end_turn`; retries, lost calls, truncation retries and fired brakes are all 0 in `lesson_job`. So no 429, timeout, cap or
truncation is in the 20 traces, or in any of the 94 draft and repair calls of attempt 2 and 75 of attempt 3. (Measured from
`model_call` and `lesson_job`, read-only.)

## Measured, replayed, not done

**Measured** (stored rows, no new call): job outcomes; the schema result of each stored first draft; the first finding the gate
listed for each first draft; call status, stop reason, models and costs.

**Replayed** (offline, no paid call; classification as "the checker was wrong" rests on these):
- The audit (`astra-audit-2026-10-26.json`) re-ran the corrected checks (its pending patch, which the task brief places in commits `d727537` and `f236214`) on the **final**
  drafts of attempt 3's 17 blocked lessons: all 17 have no generation blocker afterwards, 15 name blocks (matched words such as
  "Nothing", "Switching", "Copying", "Too", "Retelling", "Dismissive") and 2 page blocks. That is why FT-1 and FT-2 are
  filed as checker/compiler types.
- This round's own replay: for each of FT-1's four traces the flagged rationale sentence is word for word the same in the first
  draft and in the repair output, so the audit's replay of the final draft covers the same text. For FT-2 the stored page
  extractor (`e7e72a3`) and the corrected one were both run on the first-draft text of G6.U4.L22: the old one returns chapters
  1 to 15 for "Chapter 15 and one", the corrected one returns chapter 15 only. For G6.U4.L21 only the draft was read against the
  row text (p. 233 is the row's upper bound, so it is in range); the old and new extractors give the same references for the
  draft, so the difference is in how the row's range is read, which was not re-run in this round.

**Not done:** no fresh generation run after `d727537` / `f236214`, so the real size of FT-1 and FT-2 after the fix is not
measured; the 9 blocked attempt 3 lessons that were not read are covered by the audit replay only; the 11 ready lessons with a
first `proper_noun_unsourced` or `page_out_of_range` finding were not replayed, so their share of false findings is unknown;
FT-7's name half (FLEX-3a) is classed as the model's because the repair removed the phrase and the lesson then passed, which is
a measured outcome but not proof that the name check was right; no human reviewed any trace or this taxonomy; the 2
`section_missing` first findings (G6.U4.L38, L39) were not read.

## Candidate experiments

At most three, each tied to one `FT-N` and one changed variable, to be scored on the frozen set before and after (GP-21,
GP-51). They become NL-128 to NL-130. **Recommend, do not run.** The frozen set (S3: 9 cases x 3 repeats) is declared by NL-109;
its status is not asserted here. The cost figure is an estimate from attempt 3's measured mean of $0.0765 per lesson
($3.596973 over 47, unit plan included), not a measured cost of this experiment.

**Slot 1 (NL-128). FT-3: `code_origins` does not match `standard_codes`.**
- Variable: one sentence in the locked lesson-shape prompt saying `code_origins` has exactly one entry for each entry of
  `standard_codes`, and that `standard_codes` holds one code per list item and never a comma-joined string. Nothing else changes.
- Why this one: it survived both prompt rounds (attempt 2: 7 of 47 lessons had a `code_origins` issue; attempt 3: 3 of 47,
  all of the initial schema failures that remain), and 3 of 13 attempt 3 traces start there.
- Expected effect: initial schema failures from this cause 3 of 47 to 0 of 47; at most 3 fewer repairs per 47 lessons. The
  size is small and the n is small; the experiment can confirm or fail to move it.
- Cost to score: 27 drafts per arm (9 cases x 3 repeats), about $2.10 per arm, about $4.20 for before and after.
- An alternative, deriving the origins in the schema or compiler, is a code change and is not this experiment.

**Slot 2 (NL-129). FT-6: block minutes do not add up to the template.**
- Variable: one added instruction in the locked lesson-shape prompt asking the model to add up each section's block minutes and
  match the template's number before answering, with the Learning in Action section (30) as the worked sum. Nothing else changes.
- Why this one: in attempt 3, 4 of 47 lessons had a minutes finding first, and both read traces (G6.U4.L1: 28 against 30;
  G6.U4.L26: 57 total, 37 against 30) are the model's arithmetic. The compiler could also reconcile minutes; that is a code
  change and is not this experiment.
- Expected effect: first-finding `minutes_out_of_range` from 4 of 47 to 0 or 1 of 47.
- Cost to score: same as slot 1, about $2.10 per arm.

**Slot 3 (NL-130). Closed unused.** No `FT-N` warrants it yet. FT-1 and FT-2 are already changed in code (`d727537`) and are
checked by NL-134's rerun, not by an experiment. FT-4 and FT-5 are already fixed by prompt round 1 (0 of 47 in attempt 3, with
the template change in the same round as a confound). FT-7 has one quote trace and one name trace, and its real size cannot be
separated from checker false positives until a fresh run uses the corrected checker.

## What this round does not claim

No failure rate for the product, no model comparison, no human review, no promoted eval case, and no effect of any fix.
