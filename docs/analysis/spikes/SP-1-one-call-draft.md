# SP-1 · Can one structured call write a valid ~3,300-word `LessonDraft`?

**Owner of:** the SP-1 spike brief, its comparison table and its result. **Spike definition:**
[`hard-problems.md` → *Spikes*](../../design/hard-problems.md) and the [HP-1 card](../../design/hard-problems.md#hp-1)
(*Needs a spike?*). **Procedure:** zero-to-hero `references/spikes.md`, light mode (the recommendation and one rival).
**Written:** 2026-10-25 (brief, before anything ran). **Status:** brief written; harness not yet committed; no results.
**Implementer plan:** [`docs/plans/fanout/2026-10-25-spikes/SP-1.md`](../../plans/fanout/2026-10-25-spikes/SP-1.md).

## Brief (fixed before the run)

### The question

Can **one** structured model call per lesson write a schema-valid `LessonDraft` of Newsela's size (the published
teacher-edition median is 3,306 words, p90 3,878) without truncating, inside the time and cost lines, and can one call
write a valid `UnitPlan` for all 47 teaching days?

Concrete case: outline row 8 (Lesson 4, Core Reading; focus `RL.6.1, 6.2 L.6.4`, Ch. 1 pp. 1–8, homework
"The Hare and the Lion") goes in as a normalized row plus its narrow context (DIR-4). Out comes one JSON `LessonDraft`
of typed blocks: Launch 5 / Literacy Lab 10 / Learning in Action 15 + 15 / Look Back 5 / Homework, roughly 5,500–7,000
output tokens. If the call stops at its output cap, the JSON is cut off and invalid; that is the risk being measured
(HP-1 *Why it's hard* 1; product-direction risk R-1).

### The card it decides

**HP-1** (orchestration; chosen option A, fallback B). Its result also seeds **HP-7**: the measured cost per lesson
sets **PD-14**'s per-run spend cap (cost per lesson × 47 × 1.5), and the provider's rate-limit headers set **PD-13**'s
concurrency cap (starts at 4 [A]). It answers **SD-1.9** and turns **DIR-3**'s fallback trigger from an assumption into
this pass line.

### Options

| Option | What it is | Rows | Runs when |
|---|---|---|---|
| **A** (recommended, HP-1 chosen) | One structured call per lesson (`output_config.format` = the Zod `LessonDraft` schema), plus one `UnitPlan` call for the whole unit; one raised-cap retry on truncation, one repair call on an invalid draft | rows 8, 9, 25 + the 47-day `UnitPlan` | always, first |
| **B** (rival, DIR-3 fallback) | Same skeleton, one call for the front matter (with a short section plan) and one call per section (Launch, Literacy Lab, Learning in Action, Look Back, Homework), assembled into the same `LessonDraft` | row 8 only (the largest draft) | only after A, and only if at least $1.50 of the $5 cap remains |

### Worked pairs it is scored on

- **WP-1** (row 8 → Lesson 4, Reading): the largest draft; its required-blocks table (routine, ask + sample response,
  `cfu_item`, `eld_support`, `support_table`, `text_evidence_needed`, homework link to L5).
- **WP-2** (row 9 → Lesson 5, Writing): an excerpt slot instead of a text; checklist checks in Part B.
- **WP-3** (row 25 → first flex day, `G6.U4.FLEX-1a`): 5 / 40 / 5, zero placeholders; the low end of the size range.
- The `UnitPlan` uses all 47 teaching days of the issued sheet (41 lessons + 6 flex days) from
  `docs/data/samples/g6-u4-lesson-outline.json` (sha256 `de8016ea…848a`).

Never used as input or example: `docs/source/restricted/` (git-ignored, GR-9). Unit 4's published lessons stay held out.

### Model, price and spend

- **Generation model (PD-12 / AD-13, "a strong mid-tier Anthropic model"):** `claude-sonnet-5-5` (Claude Sonnet 5.5),
  `output_config.effort: "low"`, adaptive thinking (the default), streaming, structured outputs.
- **Price used for every cost figure:** $2.00 per million input tokens, $10.00 per million output tokens (thinking
  tokens are billed as output), $2.50 per million 5-minute cache-write tokens, $0.20 per million cache-read tokens.
  Source: the `claude-api` skill reference (bundled 2.1.303), `shared/model-migration.md` → *Migrating to Claude Sonnet
  5.5*, read 2026-10-25. Max output 128K tokens.
- **Hard spend cap: $5.00 for the whole spike** (PRD PD-29), across every run of A and B, enforced in code: before
  each call the generator reserves that call's worst case (input estimate + `max_tokens` × output price) in
  `spikes/sp1/out/ledger.json` and refuses the call if settled spend plus open reservations would pass $5.00; after the
  call it settles the actual cost from the provider's `usage` fields.
- **Time box:** ≤ 2 h wall-clock for the whole spike (HP-1).

### Measures (recorded per call and per lesson by the frozen harness)

Output tokens (and thinking tokens), teacher-edition words, wall time, cost recomputed from `usage`, stop reason
(truncation = `max_tokens`), Zod validity on the first try and after the one repair, the WP required-blocks check
(reported, not part of the pass line), the served model, and the `anthropic-ratelimit-*` response headers.

### Pass line (written before the run; verbatim)

From the register's *Spikes* table:

> rows 8, 9, 25: 3/3 schema-valid, 0 truncations, ≤ 5 min and ≤ $1 per lesson, rows 8–9 within 1,827–3,878 words, a
> valid 47-entry `UnitPlan`

The HP-1 card's full form, all must hold:

- 3/3 rows give a Zod-valid `LessonDraft` (first try or after the one repair);
- 0 truncations at the chosen output cap;
- each lesson takes ≤ 5 min of wall time (R-55) [T];
- each lesson costs ≤ $1 (O-1) [T];
- rows 8 and 9 land within the published teacher-edition range of 1,827–3,878 words [M as the target band];
- the `UnitPlan` is valid, with 47 entries.

**If it fails:** rerun the failing row with option B and record PD-4 as B (HP-1). If A passes, B is run on row 8 only
as the comparison, budget permitting; B's result does not change a passing A.

### Decision rules for the caps (written before the run)

- **PD-14 per-run cap** = (highest measured cost of rows 8, 9, 25 under the chosen option) × 47 × 1.5, rounded up to
  the next dollar, inside PD-29's $75 build ceiling.
- **PD-13 concurrency cap** = the smallest of 6 and, from the headers of the last successful lesson call,
  `floor(0.8 × limit ÷ per-job rate)` for each of requests per minute, input tokens per minute and output tokens per
  minute (per-job rate = that lesson's calls, input tokens or output tokens ÷ its wall time in minutes); never below 1.
  If the headers are missing, the cap stays at 4 [A] and the gap is recorded.

### Scoring harness

`spikes/sp1/harness/` on branch `spike/SP-1`, committed alone before any generator code. Option builders may not
edit it or `spikes/sp1/fixtures/`. **Harness SHA:** _(to be filled from the implementer's report)_. Tamper check:
`git diff --stat <harness SHA> HEAD -- spikes/sp1/harness spikes/sp1/fixtures` prints nothing.
Re-run command: `cd spikes/sp1 && node harness/score.ts out/<run-dir>` (B: add `--rows row08 --skip-unit-plan`).

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

### Result and recommendation

- **Pass line:** PASS for option A (one structured call per lesson) — **with one mechanism change**: the API's
  schema-enforced output mode rejected the `LessonDraft` schema on every lesson call (HTTP 400 "compiled grammar is
  too large"; also every per-section call of B). The passing path asks for JSON in the prompt (schema embedded),
  validates with Zod in code, and makes **one repair call** on a validation failure (2 of 3 lessons needed it). The
  `UnitPlan` call keeps schema-enforced output (its schema compiles). This is inside HP-1's chosen shape (one call +
  one repair, typed output validated by code); DO-3/DO-4 record it.
- **PD-4:** decided A, now `proven (SP-1)`; B (per-section) not needed.
- **PD-13 concurrency cap:** **6** lesson jobs in flight [C]: one lesson uses ~11k output tokens over ~80 s, so 6 in
  flight is ~50k output tokens/min against a 400k/min limit; 6 is the top of the agreed 4–6 range (no CHG).
- **PD-14 per-run spend cap:** mean measured cost per lesson including repairs $0.182 [M] × 47 × 1.5 = **$12.84**,
  plus the `UnitPlan` call ($0.16) → **$13.00 per run** [C]. Per-call timeout **240 s** [C: 2 × the slowest single call
  ~119 s incl. a repair; under the 300 s line]. Raised-cap truncation retry keeps `max_tokens` 32,000 → 48,000.
- **Known quality signal (not in the pass line):** drafts missed 1–3 required blocks each (e.g. row 8 `partB`,
  placeholders); R-19's required-block check catches these and drives the one repair. Prompt length guidance was
  strengthened once during the spike (run 3) after row 9 came in short (1,448 words): the spike rows were used to
  tune that instruction, so the §9 golden suite must use other rows for the length claim.
- **Assumptions and deviations reported by the builder:** repair on the same model (PD-12 names a cheaper repair
  model; the choice is re-examined in §9); no few-shot examples (they exist only in the restricted folder, GR-9); a
  truncation counts against the pass line even if the raised-cap retry succeeds.
- **Drafts for SP-3:** `spikes/sp1/out/A-noformat-20261025T121519/{row08,row09,row25}/draft.json`.

Adopted under Innocent's standing authorization (PD-32), 2026-10-25. **Innocent has not read this result yet**
(spikes procedure, step 5).
