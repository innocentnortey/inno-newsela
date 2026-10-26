# Error analysis: real full-unit run (run_01M5W6JK5XJQ7VE0WMR7HR1Z11)

Synthetic data only. Source: stored rows in `ls_nl112_dev` (47 lessons, 8 ready, 39 failed), read-only. The S3 real run
(`evals/reports/drafts-975600f9564c-dirty.md`, 0/9) is a second sample and agrees with this one.

## How this was measured

The job row stores only the first failing kind (`check_failed` + one `check_kind`), so the report undercounts: a lesson that
failed on `standard_not_checked` often also failed on other checks that were hidden behind it. I replayed the stored final
(post-repair) draft of every lesson through the same compile + generation-gate rules. The replay reproduces the run exactly
(23 `standard_not_checked`, the 8 ready lessons come out clean). Counts below are lessons with at least one such finding.

Also: first-pass schema-valid was 0/47. Every first draft failed on `blocks.N.cfu` (a `cfu_item` with `cfu: null`), so the single
repair was spent on the schema, and the check findings that appeared afterwards got no repair at all.

| Cause (lessons with it) | Count | Tag |
|---|---|---|
| First draft always schema-invalid: `cfu_item` written with `cfu: null` (71 blocks); locked prompt never says the `cfu` object is required | 47/47 | prompt gap |
| `standard_not_checked`: a focus code has no Pulse Check tagged with it | 23 | prompt gap (21 lessons: model wrote fewer check items than focus codes, 41 of 47 missing codes were simply untagged); code gap (6 codes in 5 lessons: leaf tag such as `L.6.4.a` under focus `L.6.4`) |
| `section_missing`: Learning in Action lacks ELD callouts (purpose/say/watch) | 9 (all 6 Flex, 3 Spark) | code bug: draft template for Spark/Flex asks only `teacher_talk`+`cfu_item`; check rules require the three callouts |
| `minutes_out_of_range`: block `minutes` left null, so sections sum to 0 | 11 | prompt gap (template shows minutes, nothing says to put them in block `minutes`) |
| `quote_unmatched` (3+ words in quote marks not in the row/text cards) | 20 | prompt gap + model variance; checker is strict by policy (3 words), left alone |
| `proper_noun_unsourced` (Medusa, Perseus, Baldwin ...) | 13 | model variance / prompt gap (outside knowledge); left alone |
| `page_out_of_range` | 6 | 2 checker too strict (see below), rest model variance |

Report counts (23/6/4/3/2/1) are the first kind only; the table is the real picture.

## Examples (two per cause)

- First draft schema: G6.U4.L1 block 5, role `cfu_item`, `cfu: null`; same for every other lesson (71 blocks).
- standard_not_checked, untagged: G6.U4.L1 focus `L.6.4.b, RI.6.1, RI.6.4, SL.6.1.a`, one Pulse Check tagged `L.6.4.b` only
  (3 codes unchecked). G6.U4.L40: 7 focus codes, 2 check items.
- standard_not_checked, leaf: G6.U4.L8 focus `L.6.4`, check tagged `L.6.4.b`. Front matter is built from the outline row only
  (`front-matter-standards.ts`), so a narrowed leaf is never "recorded" and `covered()` rejects it (the NL-109 "Unfixed" note).
  Not fixed in code: recording a leaf needs a confirmation decision. The prompt now tells the model to keep the listed code.
- section_missing: G6.U4.FLEX-1a "Learning in Action" is missing eld_callout_purpose / say / watch; G6.U4.L1 (Spark) same.
- minutes: G6.U4.L1 "Lesson totals 0 minutes"; G6.U4.L31 same shape.
- quote_unmatched: G6.U4.L28 quotes the teacher question "What is a claim, and what is evidence?" (8 words); G6.U4.L11 6-word quote.
- proper_noun_unsourced: G6.U4.L18 names Medusa, Perseus, Baldwin, none on the card; G6.U4.L10 two names in Literacy Lab.
- page_out_of_range: G6.U4.L21 homework says p. 233, but the row says "pp. 224 ("A few minutes later,...")-233", and the range
  extractor reads only "224" (checker too strict on real-row formatting). G6.U4.L11 "Ch. 4": the row title is "Chapter 4"
  but titles are not a chapter-range source (checker too strict). Both left for Innocent; loosening them is a correctness call.

## S3 real run (second sample)

First-pass schema-valid 3/9, repairs 8/9: same `cfu: null` cause. `standard_not_checked` (wp-1#3) and `quote_unmatched` (wp-2#1, #2) appear.
`required_blocks` (FC-3, most common) compares to part-level expectations ("Learning in Action Part A:support_table"); the model
is never told the part structure, so that is a prompt gap shared with this run but not fixed here (needs the golden's part names
in the template, which is a design change). Missing Spark/Flex callouts and null minutes (`section_minutes` FC-3) are shared.

## Fixes made (this change)

1. `packages/core/src/compile/templates.ts` (+test): Spark and Flex "Learning in Action" now require the three callouts, matching the check rules.
2. `packages/prompts/locked/lesson-shape.md`: cfu object required; every focus code is the exact `standard_code` of some check
   item (comma-separated list allowed); minutes in block `minutes` summing to the template; callouts; quotation marks only for
   copied text; no names/pages outside the card.
3. `packages/prompts/locked/repair.md`: repair must also meet the lesson shape (there is no second repair).
   The locked hash changed, so `sync_locked_layer` records a new prompt version ("locked layer changed") on next start.

Not changed: max repair rounds (1), checker rules, narrowed-leaf recording.

## Verification (8 previously failed lessons, real provider, fresh DB)

Before: 0/8 ready. After: 3/8 ready (L1, L10, L29, all with 0 repairs, first pass valid). Failed: FLEX-1a, L9, L12, L36
(`proper_noun_unsourced`) and L21 (`page_out_of_range`). No `standard_not_checked`, `section_missing` or `minutes_out_of_range` remained on the sample.
Spend about $1.22. Next layer is now visible: names outside the card and page/chapter references.
