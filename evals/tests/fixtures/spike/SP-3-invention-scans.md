# SP-3 · Do the quote, page and name scans catch planted inventions without false alarms?

## Pass line (verbatim from the HP-2 card and the Spikes table)

> every code-detectable plant caught; ≤ 1 false flag per clean lesson (else the name scan blocks only in checks)

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
