# Paid measurement of f08da39 (S3 placeholder/Part-role prompt fix), 2026-10-26 (DRAFT)

Run from a throwaway worktree at f08da39 (removed afterwards); main working tree untouched. Keys only via with-provider-env.

## Rerun-rule evidence
| | previous (ed7a073) | this (f08da39) |
|---|---|---|
| prompt_version | pr_01M5WTKTZ18CGJWEAYYNWQSY5S | pr_01M5WXE455TG2GHDWHQZRVSZEY (number 1, fresh DB) |
| locked hash | f1d29f98868a... | 6bb5ea4f5fbd... (full 6bb5ea4f5fbda5d4...) |
| model | claude-sonnet-5-5 | claude-sonnet-5-5 requested and served, all purposes |
Hash changed, so the rerun rule fired; not like-for-like with ed7a073.

## Step A: S3 drafts x3, real, --max-usd 3.2
9/9 pass (prev 3/9). All 8 assertions pass in every repeat (wp-1 placeholders [2,2,2], wp-2 [1,1,1], wp-3 [0,0,0]; minutes 50 each). M-31 initial draft parses and compiles 9/9; repairs used 3 of 9 (wp-1#1, wp-2#2, wp-3#1, first failing step "checks", all recovered; the finding kind is not in the S3 report). 21 calls completed of 21. Cost $0.8449 (prev $0.7457). Report: drafts-f08da39c2ce0.md.

## Step B: SUPPLEMENTARY nine-lesson run (NOT a 47-lesson result)
Filtered copy of the committed issued.csv (issued-9row.csv: header, 3 arc-header rows, 9 lessons). The importer accepted it (same single unit_conflict error as the full sheet). Flex ids are assigned by position, so they shift: sheet FLEX-1a = original FLEX-2b, FLEX-2a = original FLEX-3a, FLEX-2b = original FLEX-3b. L36..L41 keep their ids. Arc context differs from a 47-lesson run (no Spark/Investigation arcs, no neighbouring lessons from them, 9-lesson unit plan).
Run run_01M5WY33SBM3C860VHP7ZDD479, state partial, --cap-usd 1.7 (task said 2; my remaining budget was 1.76 after step A), worker GENERATION_CONCURRENCY=3, web stub, judge unset, fresh DB. Stored spend before step: $0.00.
- ready 8/9, failed 1 (L36: schema_invalid first draft, blocks.19-21.standard_codes; repair fixed schema, final failure check_failed proper_noun_unsourced).
- initial draft parses and compiles 8/9; no repair needed 5/9; repairs attempted 4, recovered 3/4; repair output parses+compiles 4/4.
- cost $0.7817 (drafts 0.5097, repairs 0.2256, plan 0.0464), max per lesson $0.143. Time per lesson p50 38.3 s, p95 65.7 s; wall 145 s.
- tokens in 66,908 / out 58,104 / cache read 43,803 / cache write 23,228; 14 calls, all claude-sonnet-5-5.
- 5 blocking excerpt_slot_open (L37-L41 Part A): human-fill slots, by design.

## Total spend this task: $0.8449 + $0.7817 = $1.63 (limit $2.60). Session total about $16.1 of $20.
