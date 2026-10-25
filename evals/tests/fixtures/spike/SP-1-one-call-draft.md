# SP-1 · Can one structured call write a valid ~3,300-word `LessonDraft`?

### Pass line (written before the run; verbatim)

From the register's *Spikes* table:

## Results

_Filled by the orchestrator (main session), 2026-10-25, from its own re-run of the frozen harness
(`29db9be`; `git diff --stat 29db9be HEAD -- spikes/sp1/harness spikes/sp1/fixtures` printed nothing):
`cd spikes/sp1 && node harness/score.ts out/A-noformat-20261025T121519` on branch `spike/SP-1`._

**Run directories scored:** _A:_ `spikes/sp1/out/A-noformat-20261025T121519` (commit `6888948`) · _B:_ row 8 only,
`results/B-noformat.txt` · **Spend used (ledger):** $3.55 of $5.00 (the ledger settles rejected 400 calls at their
full reservation; real provider spend ≈ $1.7).

### Comparison table

| Option | Item | Schema valid (first try / final) | Truncations | Wall time | Cost | Words | Required blocks | Within pass line? |
|---|---|---|---|---|---|---|---|---|
| A | row 8 (WP-1) | yes / yes | 0 | 83.1 s | $0.1445 | 3,476 | 10/12 | ✓ |
| A | row 9 (WP-2) | no / yes (1 repair) | 0 | 119.7 s | $0.2573 | 3,281 | 9/11 | ✓ |
| A | row 25 (WP-3) | no / yes (1 repair) | 0 | 56.6 s | $0.1444 | 1,603 (no band) | 6/9 | ✓ |
| A | `UnitPlan` (47 days) | yes | 0 | 63.8 s | $0.1583 | — | — | ✓ (47 entries) |
| B | row 8 (WP-1) | n/a / yes (1 repair, 7 calls) | 0 | 95.9 s | $0.2598 | 3,438 | 11/12 | ✓ |

Pass line marks: valid 3/3 ✓ · 0 truncations ✓ · ≤ 300 s per lesson ✓ (max 119.7 s) · ≤ $1.00 per lesson ✓ (max
$0.26) · rows 8–9 within 1,827–3,878 words ✓ · `UnitPlan` valid with 47 entries ✓. **OVERALL: PASS.**

Model `claude-sonnet-5-5` (served = requested on every call), effort low, `max_tokens` 32,000; a lesson's first call
used ~5.7k input + ~11.2k output tokens. Price used: $2 / $10 per million input / output tokens (claude-api skill
reference, checked 2026-10-25).

### Rate-limit headers (last successful lesson call)

| Header | Value |
|---|---|
| `anthropic-ratelimit-requests-limit` | 1,000 per minute |
| `anthropic-ratelimit-input-tokens-limit` | 2,000,000 per minute |
| `anthropic-ratelimit-output-tokens-limit` | 400,000 per minute |

