# SP-2 · Freeze at Submit while two people type (HP-5, HP-4)

### Pass line (verbatim, from the HP register's *Spikes* table)

> 20/20 runs per assertion; 0 edits persisted after a lock; 0 silent keystroke losses; JSON round trip keeps the hash; store p95 ≤ 500 ms

## Results

_Filled by the orchestrator (main session) from its own re-run of the harness on 2026-10-25 (harness
`919ac12`, unchanged on the branch: `git diff --stat 919ac12 HEAD -- spikes/sp2/harness spikes/sp2/package.json
spikes/sp2/package-lock.json spikes/sp2/tsconfig.json` printed nothing). Control row from the builder's run
(`spikes/sp2/results/control.txt`, 3 trials). ✓ = meets the pass line._

| Measure | Pass line | A · read-only flip + guard | B · close all connections | Control (no freeze, sanity) |
|---|---|---|---|---|
| No edits after a lock | 20/20, 0 edits | 20/20, 0 ✓ | 20/20, 0 ✓ | 0/3 (150 edits after lock) |
| No silent keystroke losses | 20/20, 0 losses | 20/20, 0 ✓ | 20/20, 0 ✓ | 3/3 |
| Round trip keeps the hash | 20/20 | 20/20 ✓ | 20/20 ✓ | 3/3 |
| Stale approve → 409, no change | 20/20 | 20/20 ✓ | 20/20 ✓ | 3/3 |
| Approver client hash = server hash | 20/20 | 20/20 ✓ | 20/20 ✓ | 3/3 |
| Store transaction p50 / p95 (n) | p95 ≤ 500 ms | 13.0 / 25.1 ms (130) ✓ | 13.2 / 25.8 ms (130) ✓ | — |
| Submit duration p50 / p95 (info) | — | 23.4 / 29.8 ms | 24.2 / 30.4 ms | — |
| Resurrected keystrokes (info) | — | 0 | 120 (6 per trial) | — |
| Verdict | | **PASS** | **PASS** | FAIL (as it must) |

Re-run: `cd spikes/sp2 && npm run sp2 -- --option A --trials 20` (and `--option B`), on branch `spike/SP-2`
(kept as `archive/spike/SP-2-*` after clean-up).
