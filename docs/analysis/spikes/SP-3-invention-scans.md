# SP-3 · Do the quote, page and name scans catch planted inventions without false alarms?

**Owner of:** the SP-3 spike record (zero-to-hero §5, light mode). **Decides:** the open part of
[HP-2](../../design/hard-problems.md#hp-2) option B: whether the proper-name scan blocks everywhere or only inside
`cfu_item`s, and the quote-span word threshold (3 words, an assumption). **Brief written:** 2026-10-25 by Claude
(planner), before anything ran. **Status:** brief written; harness not built yet. **Procedure:**
[`spikes.md`](../../../.claude/skills/zero-to-hero/references/spikes.md). **Implementer plan:**
[`docs/plans/fanout/2026-10-25-spikes/SP-3.md`](../../plans/fanout/2026-10-25-spikes/SP-3.md).

## What this spike does, concretely

A lesson draft comes out of the generator as JSON (the `LessonDraft`, HP-1). It must not contain a quote, a page
number or a name that the lesson's own outline row does not give us (GR-1). HP-2 chose to have no `quote` block in
the draft at all, plus three cheap code scans over every generated string:

1. **Quote spans.** Any quotation-mark span of 3+ words that is not a substring of the lesson's sources.
2. **Page and chapter references.** Any page or chapter reference outside the row's range.
3. **Proper names.** Any proper noun not in the lesson's sources (minus an allow-list of routine and section
   names).

*Input → process → output.* Input: the Lesson 4 draft (row 8), with a Pulse Check rationale that says "Percy's friend
Grover also gets into trouble at school". Process: the name scan collects the lesson's sources (row 8's cells, the
Investigation 1 header on row 7, the sheet title, the official text of the standards the lesson cites) and finds
"Grover" in none of them. (Grover is on row 10, which is exactly the trap HP-2 reason 4 names.) Output: one flag,
`name · cfu · $.sections[3].blocks[1].options[2].rationale · "Grover"`.

The spike plants known inventions into copies of lesson drafts and counts how many the scans catch. It also counts
the flags they raise on clean drafts, where every flag is a false alarm.

**The lesson's sources** (HP-2 option B, R-19 as amended): this lesson's own row cells, its arc header row, the
sheet's title cell (it names the novel and its author), and the official CDE text of every standard code in the row
or cited by the draft (from [`05`](../../source/05-standards-referenced.md)). Other rows of the unit are **not**
sources (HP-2 reason 4).

## Question, card, budget

| Item | Value |
|---|---|
| Question | Do the quote, page and name scans catch planted inventions without false alarms? |
| HP card | [HP-2](../../design/hard-problems.md#hp-2) · Grounding and quotes without the source texts (option B chosen; PD-5) |
| Requirements touched | R-12, R-19 (amended wording, PRD §4 change table), PD-5 |
| Worked pairs | WP-1 (row 8 → L4), WP-2 (row 9 → L5), WP-3 (row 25 → flex day, the control), WP-4 (row 39 → L31) |
| Time box | ≤ 1.5 h |
| Spend | $0. No model calls. It reuses SP-1's drafts once they exist |

## Options (2, light mode)

Quote and page scans are **the same code in both options**, written as HP-2 specifies. Only the name scan differs.

| Option | Name scan |
|---|---|
| **A** (recommended in the plan) | A capitalised-word heuristic. A capitalised word is a candidate unless it is in the lesson's sources, in a fixed allow-list of routine and section names, or appears in lower case somewhere in the draft or sources. At the start of a sentence, a fixed list of common sentence starters is also allowed. Pure code, no dependencies |
| **B** (its strongest rival) | A, filtered by the `compromise` NLP library (14.19.0, pure JS, no model): a candidate from A is kept only if `compromise` tags it `ProperNoun`, `Person`, `Place` or `Organization`; a sentence-initial word that `compromise` tags `Person`, `Place` or `Organization` and that is not in the sources is added back |

## Data

**Synthetic until SP-1 lands.** SP-1 (running in parallel) writes real drafts for rows 8, 9 and 25. Until they exist,
the harness runs on four hand-written clean drafts (rows 8, 9, 25 and 39) that follow the draft output contract
([`04` §9](../../source/04-lesson-structure-analysis.md)) and DIR-3's block kinds, with no `quote` block. They use
only names, quotes and page references their sources give. The harness takes directory arguments, so the
orchestrator re-runs it on SP-1's drafts afterwards (row 39 stays synthetic: SP-1 does not draft it).

**Plants** (HP-2 *How we'll know it worked*: 12 planted errors in copies of the WP-1, WP-2 and WP-4 drafts). Every
planted quote is invented by us. None is a line of the novel, the tale or the Iliad.

| ID | Row | Kind (HP-2 category) | Field | Planted text (appended to an existing string) | Expected scan | Code-detectable? |
|---|---|---|---|---|---|---|
| P01 | 8 | short quote in prose (8 words) | elsewhere | Listen to how Percy opens: “Nobody at my school ever listened to me.” | quote | yes |
| P02 | 8 | quote in a `cfu_item` rationale (6 words) | cfu | Percy says “my teachers always liked me best,” so he cannot be a problem figure. | quote | yes |
| P03 | 8 | out-of-range page (row: pp. 1–8, 9–15) | elsewhere | Reread page 27 with a partner and mark one detail. | page | yes |
| P04 | 8 | name not in the row (it is on row 10) | cfu | Percy's friend Grover also gets into trouble at school. | name | yes |
| P05 | 8 | nameless invented plot step | elsewhere | Remind students that on the class trip Percy is blamed when a classmate falls into a fountain. | none | **no** (HP-2 reason 3; reported, not hidden) |
| P06 | 9 | short quote in prose (exactly 3 words: the threshold) | elsewhere | As the hare tells the lion, “Trust me, friend.” | quote | yes |
| P07 | 9 | quote in a `cfu_item` rationale (5 words; partly overlaps the row) | cfu | It could quote Soongoora saying “the honey was never mine” as evidence. | quote | yes |
| P08 | 9 | invented character name | elsewhere | In the tale, the elephant Tembo warns the hare about the lion. | name | yes |
| P09 | 9 | out-of-range chapter (row: Ch. 1, Ch. 2) | elsewhere (sample response) | In Chapter 4, Percy runs away from the adults who punish him. | page | yes |
| P10 | 39 | short quote in prose (9 words) | elsewhere | Homer calls Olympus “a hall of bronze where the gods feast forever.” | quote | yes |
| P11 | 39 | quote in a sample response (8 words) | elsewhere (sample response) | Riordan's narrator says the city of the gods “glows like a lantern above the busy streets.” | quote | yes |
| P12 | 39 | name not in the row | cfu | The palaces were built by Hephaestus in a single night. | name | yes |

Totals: 3 short quotes in prose (P01, P06, P10), 3 quotes in rationales or sample responses (P02, P07, P11), 2 page
or chapter references (P03, P09), 3 names (P04, P08, P12), 1 nameless plot step (P05). **11 code-detectable.**

## Measures (written before anything runs)

| Measure | How it is computed |
|---|---|
| Recall | Code-detectable plants caught ÷ code-detectable plants placed. A plant is caught when the scan it expects raises a flag at the plant's field path whose matched text overlaps the planted needle |
| False flags per clean lesson | Every flag on a clean draft, by scan (quote / page / name) and field kind (`cfu` vs elsewhere). On synthetic drafts every flag is false by construction. On SP-1's real drafts each flag is labelled by hand: **invention** (states something the sources do not, even if true of the real book) or **false** (the sources do give it, or it is not a quote, reference or name at all) |
| Name flags in `cfu` fields per clean lesson | Decides "blocks in checks only" |
| Quote-threshold sweep | Recall on quote plants and quote false flags at 2, 3, 4 and 5 words |
| WP-3 control | Grounding flags on the row 25 draft (target 0, HP-2) |
| Placeholders (info) | `text_evidence_needed` and excerpt-slot blocks per clean draft; expected WP-1 = 2, WP-2 = 1, WP-3 = 0, WP-4 = 1 |
| Collateral (info) | Flags on a seeded copy that are neither a plant nor on its clean twin |
| Time (info) | Milliseconds per lesson for each option |

## Pass line (verbatim from the HP-2 card and the Spikes table)

> every code-detectable plant caught; ≤ 1 false flag per clean lesson (else the name scan blocks only in checks)

How the result is read (HP-2 *Needs a spike?*): if the pass line holds, the name scan blocks everywhere. If the name
scan gives 2+ false flags per lesson, it blocks only in `cfu_item`s and is advisory elsewhere. The 3-word span
threshold is set the same way, from the sweep. If neither option clears the line even for `cfu_item`s, the card goes
back to Innocent as options.

**Provisional vs final.** Results on the synthetic drafts are provisional, because a hand-written clean draft is
shorter (about 1,000 words, against a ~3,300-word median) and avoids patterns we already know to be risky. The decision
is taken on the re-run over SP-1's drafts.

## Known false-alarm patterns the synthetic drafts do not exercise

The scans can be expected to flag these on real drafts. Each will be labelled on the SP-1 re-run, not designed away
in advance:

- a full name the row does not give ("Percy Jackson": row 8 says only "Percy");
- "Percy" on the flex day (row 25 names no character);
- an invented section title in quotation marks (Newsela's own Part headings quote titles, `04` §4);
- teacher talk written inside quotation marks instead of a `say` block;
- a sentence split across ProseMirror text nodes (a quote span broken in two).

## Results

_Filled by the orchestrator (main session), 2026-10-25, from its own re-run of the frozen harness on branch
`spike/SP-3` (fixtures/harness frozen at `c8e4fe8`; `git diff --stat c8e4fe8 HEAD -- spikes/sp3/harness
spikes/sp3/fixtures` printed nothing) over **SP-1's real drafts** (rows 8, 9, 25; copied under unique names because
SP-1 names every file `draft.json`, which made the seeder overwrite them on the first attempt) plus the synthetic
row 39. Outputs: `spikes/sp3/results/{a,b}-sp1.txt`, synthetic runs `{a,b}-synthetic.txt`._

```bash
cd spikes/sp3; mkdir -p out/sp1-drafts out/clean-row39; cp fixtures/clean/row39.json out/clean-row39/
for r in row08 row09 row25; do cp $SP1/$r/draft.json out/sp1-drafts/$r.json; done
npm run seed -- --clean out/sp1-drafts --clean out/clean-row39 --plants fixtures/plants.json --out out/seeded-sp1
npm run harness -- --option b --clean out/sp1-drafts --clean out/clean-row39 --seeded out/seeded-sp1
```

| Measure | Pass line | A · capitalised-token heuristic | B · A + `compromise` proper-noun tagging |
|---|---|---|---|
| Code-detectable plants caught (real drafts) | all (11) | 11/11 ✓ | 11/11 ✓ |
| P05 (paraphrased invented event) | not code-detectable | not caught (expected) | not caught (expected) |
| False flags per clean lesson, all fields (rows 8 / 9 / 25 / 39) | ≤ 1 | 30 / 24 / 8 / 3 ✗ | 13 / 12 / 2 / 0 ✗ |
| False flags in check items (`cfu`) only | ≤ 1 | 3 / 1 / 3 / 0 ✗ | **0 / 0 / 0 / 0 ✓** |
| Quote and page scan false flags | — | 0 on every lesson | 0 on every lesson |
| Collateral flags on seeded copies | — | 0 | 0 |
| Name scan scope verdict (harness) | | neither | **blocks in checks only** |

**Result:** the quote and page scans pass outright (every plant caught, 0 false flags) and block everywhere. The name
scan cannot block everywhere: on real drafts most of its flags are capitalised words that open a list item, table cell
or `watch_for` string ("Prompt", "Reviewer", "Shared"). With option B it raises **0 false flags inside check items**,
which is exactly the pass line's fallback: *the name scan blocks only in checks*. Elsewhere its flags are shown to the
reviewer as advisory issues (non-blocking). Quote threshold: 3 words (HP-2's assumption) catches every quote plant with
0 false flags on the real drafts (the synthetic sweep showed 4+ misses P06).

**Recommendation:** option **B** (heuristic + `compromise` tagging), name scan **blocking in `cfu_item`s, advisory
elsewhere**; quote and page scans blocking everywhere; quote span ≥ 3 words. HP-2 → `proven (SP-3)` with that scope.
This is the default CON-13 already states ("until then it blocks in check items"), so no `CHG-N`. Adopted under
Innocent's standing authorization (PD-32), 2026-10-25. **Innocent has not read this result yet.**

**Limits:** 3 real drafts and 1 synthetic; each flag on a real draft is an upper bound on false flags until a person
labels it (row 9's "Persephone" may be a genuine invention the advisory flag should surface). `compromise` misses a
proper noun at a sentence start (the planner's note); the heuristic catches those.
