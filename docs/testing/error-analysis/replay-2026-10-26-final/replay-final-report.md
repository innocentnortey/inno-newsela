# Newsela F4 replay on the final code: 47 stored attempt-3 drafts (draft, 2026-10-26)

**What this is.** A current-code reanalysis of historical drafts. The 47 lesson drafts were written by a model under the OLD prompt (locked hash `c8fb9306`) and are re-checked here, with no model call, by the code at each named commit. It is NOT a forecast of a new run and NOT the original run's metric (the original stored outcome is 30 ready / 17 failed, 19 clean first pass). The heading-lift what-if (`--lift-tags`) rewrites the stored drafts and is a simulation, not a measurement.

Run `run_01M5W7VQFD6AEVPMPZA2Z4S9ZK`, database `ls_nl112c` (127.0.0.1:55440), enforced read-only (`default_transaction_read_only=on`, write probe refused 25006, row counts before = after in every run), no model call, no spend. Tool: `evals/src/replay-finals-main.ts` (identical at 97b7b1d and 3bbe94f; copied into each older worktree). Review context `generation_time` (empty reviewer state) unless stated. Each worktree was temporary under `/home/linuxuser/workspaces/.worktrees/newsela-replay-<sha>` and removed after its run; disk stayed at 5 GB free.

Boundaries are in chronological order. Note `8ed5e83` (F2 end) comes BEFORE `62f372f` in history. The D1/D2/D3 boundaries between A and A follow-up were not re-run (see `replay-2026-10-26.md` F4 section 6 for them), so the A to A-follow-up step below bundles slice D (f236214, 99b8e77, 88d6b97) with 6cc5e07.

## 1. Generation-gate passes (reanalysis; cells are `n/47 total, n/compiled`)

Effective = first accepted draft (44 of 47 compile; 3 fail schema: L28, L31, L32). Final = last repair else effective (all 47 compile).

| Boundary | Effective | Final | Final, full review rule set | Lessons agreeing with stored first-pass outcome |
|---|---|---|---|---|
| base e7e72a3 | 19/47, 19/44 | 30/47, 30/47 | 3/47 | 47/47 |
| A d727537 | 35/47, 35/44 | 47/47, 47/47 | 20/47 | 31/47 |
| A follow-up 6cc5e07 | 3/47, 3/44 | 4/47, 4/47 | 4/47 | 31/47 |
| PD-39 45a2a63 | 4/47, 4/44 | 5/47, 5/47 | 4/47 | 32/47 |
| F1 start e8a7f27 | 1/47, 1/44 | 1/47, 1/47 | 1/47 | 29/47 |
| F2 end 8ed5e83 | 1/47, 1/44 | 1/47, 1/47 | 1/47 | 29/47 |
| template/prompt 62f372f | 1/47, 1/44 | 1/47, 1/47 | 1/47 | 29/47 |
| F3 47549fe | 1/47, 1/44 | 1/47, 1/47 | 1/47 | 29/47 |
| final 3bbe94f | 1/47, 1/44 | 1/47, 1/47 | 1/47 | 29/47 |

Base reproduces the historical first-pass count lesson by lesson (19/47, 47 of 47 agree), so the replay is calibrated at the base. At later commits the rules changed, so agreement is not a calibration.

## 2. Delta attributable to each change (verdict changes, generation gate)

| Step | Effective | Final | What changed |
|---|---|---|---|
| base to A d727537 | 19 to 35; +{FLEX-1b, FLEX-2b, FLEX-3a, L10, L12, L15, L19, L20, L21, L22, L24, L33, L35, L4, L40, L9} -{} | 30 to 47; +{FLEX-1b, FLEX-2b, L10, L19, L20, L21, L22, L23, L24, L28, L32, L33, L35, L4, L40, L8, L9} -{} | Slice A: source trust and parity (proper_noun and page_out_of_range cleared) |
| A to A follow-up 6cc5e07 | 35 to 3; +{} -{FLEX-1b, FLEX-2b, FLEX-3a, FLEX-3b, L10, L11, L12, L13, L14, L15, L16, L18, L19, L20, L21, L22, L24, L25, L27, L29, L3, L30, L33, L34, L35, L37, L4, L40, L41, L5, L6, L9} | 47 to 4; +{} -{FLEX-1b, FLEX-2b, FLEX-3b, L1, L10, L11, L12, L13, L14, L15, L16, L17, L18, L19, L2, L20, L21, L22, L23, L24, L25, L26, L27, L28, L29, L3, L30, L31, L32, L33, L34, L35, L36, L37, L38, L39, L4, L40, L41, L5, L6, L8, L9} | Slice D obligations (standard_not_taught, standard_not_checked, code_not_allowed, section_missing excerpt) plus name scan stricter again; BUNDLED, intermediate boundaries not re-run |
| A follow-up to PD-39 45a2a63 | 3 to 4; +{L25} -{} | 4 to 5; +{L25} -{} | PD-39 rulings |
| PD-39 to F1 e8a7f27 | 4 to 1; +{} -{FLEX-1a, FLEX-2a, L25} | 5 to 1; +{} -{FLEX-1a, FLEX-2a, FLEX-3a, L25} | One owner of sections, parts, roles (section_missing 3 to 26 lessons) |
| F1 to F2 end 8ed5e83 | 1 to 1; +{} -{} | 1 to 1; +{} -{} | Standards evidence reader, sub-codes, Quick Write counts as a check |
| F2 end to 62f372f | 1 to 1; +{} -{} | 1 to 1; +{} -{} | Learning in Action heading not required, parts for Reading and Writing only, part labels dropped in slots without parts, Flex Launch sample_response in prompt |
| 62f372f to F3 47549fe | 1 to 1; +{} -{} | 1 to 1; +{} -{} | alignment_link keyed on role, submit gate, background check |
| F3 to final 3bbe94f | 1 to 1; +{} -{} | 1 to 1; +{} -{} | Dedupe judge pairs, name-scan limit note, tests |

Attribution is order-dependent and the steps are never summed into a net. The only passing lesson at the final commit is L7 (effective and final). L28, L31 and L32 are the three effective drafts that fail schema and never compile; they are not passes.

## 3. Findings by kind (generation-gate blocking findings / lessons affected)

**effective drafts**

| Boundary | section_missing | standard_not_taught | standard_not_checked | code_not_allowed | proper_noun_unsourced | page_out_of_range | schema_invalid (full review set) |
|---|---|---|---|---|---|---|---|
| base e7e72a3 | 2 / 2 | 0 / 0 | 0 / 0 | 0 / 0 | 34 / 14 | 5 / 5 | 216 / 42 |
| A d727537 | 2 / 2 | 0 / 0 | 0 / 0 | 0 / 0 | 2 / 1 | 1 / 1 | 0 / 0 |
| A follow-up 6cc5e07 | 3 / 3 | 110 / 38 | 26 / 10 | 3 / 3 | 5 / 3 | 1 / 1 | 0 / 0 |
| PD-39 45a2a63 | 3 / 3 | 107 / 37 | 25 / 9 | 3 / 3 | 5 / 3 | 1 / 1 | 0 / 0 |
| F1 start e8a7f27 | 60 / 26 | 107 / 37 | 25 / 9 | 3 / 3 | 5 / 3 | 1 / 1 | 0 / 0 |
| F2 end 8ed5e83 | 60 / 26 | 107 / 37 | 23 / 9 | 1 / 1 | 5 / 3 | 1 / 1 | 0 / 0 |
| template/prompt 62f372f | 50 / 25 | 107 / 37 | 23 / 9 | 1 / 1 | 5 / 3 | 1 / 1 | 0 / 0 |
| F3 47549fe | 50 / 25 | 107 / 37 | 23 / 9 | 1 / 1 | 5 / 3 | 1 / 1 | 0 / 0 |
| final 3bbe94f | 50 / 25 | 107 / 37 | 23 / 9 | 1 / 1 | 5 / 3 | 1 / 1 | 0 / 0 |

**final drafts**

| Boundary | section_missing | standard_not_taught | standard_not_checked | code_not_allowed | proper_noun_unsourced | page_out_of_range | schema_invalid (full review set) |
|---|---|---|---|---|---|---|---|
| base e7e72a3 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 37 / 15 | 2 / 2 | 232 / 44 |
| A d727537 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| A follow-up 6cc5e07 | 1 / 1 | 118 / 41 | 27 / 11 | 2 / 2 | 3 / 2 | 0 / 0 | 0 / 0 |
| PD-39 45a2a63 | 1 / 1 | 114 / 40 | 25 / 9 | 2 / 2 | 3 / 2 | 0 / 0 | 0 / 0 |
| F1 start e8a7f27 | 64 / 26 | 114 / 40 | 25 / 9 | 2 / 2 | 3 / 2 | 0 / 0 | 0 / 0 |
| F2 end 8ed5e83 | 64 / 26 | 114 / 40 | 23 / 9 | 0 / 0 | 3 / 2 | 0 / 0 | 0 / 0 |
| template/prompt 62f372f | 52 / 25 | 114 / 40 | 23 / 9 | 0 / 0 | 3 / 2 | 0 / 0 | 0 / 0 |
| F3 47549fe | 52 / 25 | 114 / 40 | 23 / 9 | 0 / 0 | 3 / 2 | 0 / 0 | 0 / 0 |
| final 3bbe94f | 52 / 25 | 114 / 40 | 23 / 9 | 0 / 0 | 3 / 2 | 0 / 0 | 0 / 0 |

`schema_invalid` is a full-review-set kind: it is 0 in the generation gate at every boundary (the gate does not carry it) and 0 in the review set from d727537 on; at base it is 216 findings in 42 lessons effective and 232 in 44 final. Other generation-gate kinds at the final commit (effective): minutes_out_of_range 5/4 lessons and quote_unmatched 2/2, unchanged from base; none in final drafts.

## 4. section_missing by role, 25 lessons at 62f372f vs 26 at e8a7f27 (effective drafts, generation gate)

| Section | Missing | e8a7f27 findings / lessons | 62f372f findings / lessons |
|---|---|---|---|
| Flex: Launch | required role sample_response | 6 / 6 | 6 / 6 |
| Flex: Learning in Action | required role routine_heading | 1 / 1 | 6 / 6 |
| Flex: Learning in Action | required role teacher_tip | 6 / 6 | 6 / 6 |
| non-Flex: ? | Lesson a required excerpt slot (outline writer task) | 1 / 1 | 1 / 1 |
| non-Flex: Learning in Action | part "Part A" | 14 / 14 | 13 / 13 |
| non-Flex: Learning in Action | part "Part B" | 17 / 17 | 16 / 16 |
| non-Flex: Learning in Action | required role routine_heading | 13 / 13 | 0 / 0 |
| non-Flex: Literacy Lab | required role callout_watch | 2 / 2 | 2 / 2 |
| **Total** | | **60 / 26** | **50 / 25** |

**Confirmed:** the 13 over-strict non-Flex Learning in Action `routine_heading` findings (Reading 8, Writing 4, Academic Discussion 1) are gone (13 to 0). Part A and Part B each drop by 1 (14 to 13, 17 to 16), which is L19 (Academic Discussion no longer requires parts); L19 leaves the list, so 26 lessons become 25. Net findings 60 to 50, not 60 to 47.

**Side effect the template edit introduced:** Flex Learning in Action `routine_heading` findings rise from 1 to 6 (all six Flex lessons). Before, five Flex drafts passed it only by accident: the compiler turned an invented part label into a titled routine heading. 62f372f now drops part labels in slots without parts, so that accidental heading is gone and the real WP-3 requirement bites. This is correct per the authority, but it means Flex now misses three roles in every Flex draft (Launch sample_response, Learning in Action teacher_tip, routine_heading). The remaining 25 lessons are still blocked by prompt-gap items (these drafts predate the prompt that names the roles): Flex 6, Reading/Writing parts, Literacy Lab callout_watch 2 (L38, L39 real omissions, fixed in the stored repair), and the L2 excerpt slot.

## 5. Names flagged after the cleanups (proper_noun_unsourced)

At 3bbe94f the generation gate blocks effective drafts in 3 lessons (5 findings): L19 (Learning in Action), L23 (Part E, plus one Part B finding), L35 (Learning in Action); final outputs in 2 lessons (3 findings): L19, L35. Reference points: base 34 findings in 14 lessons effective, 37 in 15 final; A d727537: 2 in 1 lesson effective, 0 final; 6cc5e07 onward: 5 in 3 effective, 3 in 2 final (unchanged since). A further 122 effective advisory-level name findings in 29 lessons (30 lessons in final outputs) are non-blocking and do not affect pass counts. The artefact deliberately stores no matched text, so the flagged names themselves are not recorded here; a `--messages` run states only that the name is not in the outline row, arc header or standards.

## 6. L31 safety state

L31 (`G6.U4.L31`) has open safety flag `sf:G6.U4.L31:39`, created by StoreNode (first stored 2026-10-26T13:59:25Z) after the original gate ran. L31 effective draft does not compile (schema), so only final counts.

| Run | Review context | L31 final blocking kinds (generation gate) |
|---|---|---|
| final 3bbe94f | generation_time (empty reviewer state) | standard_not_taught (full review set adds excerpt_slot_open) |
| final 3bbe94f | current (today's flags) | safety_flag_open, safety_note_without_tip, standard_not_taught (review set adds excerpt_slot_open) |
| final 3bbe94f + heading lift (simulation) | generation_time | none; review set only excerpt_slot_open |

So under the generation-time context L31 is blocked only by `standard_not_taught`; the safety kinds appear only with today's review state (`gen_added_blocking_kinds` shows them as state-derived). Passing counts are the same under both contexts at 3bbe94f (1/47 effective, 1/47 final) because L7 is the only passing lesson and L31 fails on `standard_not_taught` either way.

## 7. Heading-lift what-if (SIMULATION at 3bbe94f)

Rewriting teaching tags on the stored drafts (as if a model followed the instruction) lifts the generation gate to effective 3/47 (3/44 compiled) and final 6/47. This models a model that follows one instruction; it says nothing about what a new model does with the new prompt. Findings left: section_missing 50/25 and 52/25, standard_not_taught drops 107 to 77 findings (37 to 29 lessons) effective.

## 8. Provenance (code commit, dirty hashes, input hash)

`input_hash` (pin + review context + lift flag + selected stored outputs) is `aecf38bdc1f0…` for every generation_time run without lift, so every boundary replayed identical stored inputs. The current-context run is `430ca934eb53…`, the lift simulation `829bd6d80968…`. `tracked_diff_sha256` `e3b0c442…` is the hash of an empty diff (tracked tree equals the commit).

| Run | Commit | Dirty code files | Tracked diff hash | schema / template+compile / checks / wiring | current locked prompt hash | input hash |
|---|---|---|---|---|---|---|
| base e7e72a3 | `e7e72a3da607` | 6 | `e3b0c442` | ba763679 / 3c43b1b1 / f6d99f40 / 2e6d3163 | c8fb9306 | `aecf38bdc1f0` |
| A d727537 | `d72753712bdf` | 6 | `e3b0c442` | ba763679 / 65bd3416 / 7a7bd393 / 2b279bb5 | 540e31a3 | `aecf38bdc1f0` |
| A follow-up 6cc5e07 | `6cc5e07863fd` | 6 | `e9b39e28` | ba763679 / 0412ea10 / a1a2110a / 23ffba31 | 30fe769d | `aecf38bdc1f0` |
| PD-39 45a2a63 | `45a2a63a56a7` | 6 | `e9b39e28` | 10754e71 / 79883eca / 757d419e / 23ffba31 | 4fb599e1 | `aecf38bdc1f0` |
| F1 start e8a7f27 | `e8a7f27acb2f` | 0 | `e3b0c442` | 10754e71 / c41ea525 / 6c8a80bf / 23ffba31 | 4fb599e1 | `aecf38bdc1f0` |
| F2 end 8ed5e83 | `8ed5e8318c88` | 0 | `e3b0c442` | 7e489660 / fb4e89b4 / 372e208a / ad3e7554 | cd5ec8bb | `aecf38bdc1f0` |
| template/prompt 62f372f | `62f372f294bb` | 0 | `e3b0c442` | 7e489660 / 7ec2c125 / 372e208a / ad3e7554 | f1d29f98 | `aecf38bdc1f0` |
| F3 47549fe | `47549fe9d586` | 0 | `e3b0c442` | 7e489660 / 7ec2c125 / 372e208a / ad3e7554 | f1d29f98 | `aecf38bdc1f0` |
| final 3bbe94f | `3bbe94f8ead6` | 0 | `e3b0c442` | 7e489660 / 7ec2c125 / cab20c45 / 1c41d6e4 | f1d29f98 | `aecf38bdc1f0` |

The six dirty files at base, A, A follow-up and PD-39 are exactly the six copied tool files (`evals/src/replay-finals{,-readonly,-pin,-lesson,-provenance,-main}.ts`) copied from 3bbe94f; sha256 per file is in `provenance-by-run.json`. e8a7f27 onward ran from clean worktrees. Extra runs: `final-current-context-3bbe94f.json`, `final-lift-simulation-3bbe94f.json`, and `msgs-*.json` (same findings plus message text, used for the role breakdown and names; the messages hold rule text and addresses only, as observed in the 3bbe94f run).

## 9. Interpretation

1. The final code passes 1 of 47 stored drafts (L7), effective and final, with the generation-time context. That has not moved since F1 (e8a7f27); F2, the 62f372f template edit, F3 and the final review follow-ups change no verdict on these drafts.
2. The peak was slice A's cleanup (19 to 35 effective, 30 to 47 final); the D-slice obligations then removed almost all of it (35 to 3), and F1 took the rest down to 1. These drops come from checks asking for things the old prompt never told the model to write (teaching tags, Part A/B, Flex roles). They are not evidence about what a model given the new prompt will write.
3. The 62f372f template edit does what it says on the 13 over-strict heading findings, but it does not move the pass count, and it exposes a Flex routine_heading gap in five more Flex drafts that the compiler had been masking.
4. Real ceilings visible on old drafts: standard_not_taught (107 findings, 37 lessons) is the largest remaining blocker, and the heading-lift simulation only gets to 3 effective / 6 final.
5. L31 is not a generation-time problem; its safety kinds come from today's review state.
6. Only a fresh draft run under the new prompt can say whether the gap closes. Not a floor, not a forecast.
