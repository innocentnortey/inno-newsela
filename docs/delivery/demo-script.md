# Demo script - Newsela Lesson Studio (NL-136, 2026-10-26)

**Status: draft script, written from the record only.** Source of truth: the decision inventory
([`demo-decision-inventory.md`](demo-decision-inventory.md), draft 2, NL-131), the NL-126 QA report
([`QA_REPORT.md`](../ux/05-verify/QA_REPORT.md)), the NL-127 load report
([`load-2026-10-26.md`](../../evals/reports/load-2026-10-26.md)), the eval reports in `evals/reports/`, and the framing
doc ([`2026-10-24-angle-and-demo-framing.md`](2026-10-24-angle-and-demo-framing.md)). Nothing is narrated from memory.
The restricted source folder was not read (GR-9). The tool is framed as expert-driven (GR-16): it drafts, named
reviewers decide.

## Read this first: what does not exist yet

Rows marked **pending: <ticket>** wait for a result that is not in the repo. No number is guessed for them. The real-model
full run now exists (see the first row); it is a partial result and the narration says so.

| Missing result | Ticket | What it blocks in this script | State on 2026-10-26 |
|---|---|---|---|
| Full real-model 47-lesson run (the unit the random lesson is picked from; spend; retries) | NL-112 | Flow rows F-2 to F-6, caught-error row C-2, success row F-6 | **Measured 2026-10-26, audited**: final run 30 of 47 lessons stored-ready, 17 blocked with reasons (checker false positives per an offline replay; a fresh run on the fixed candidate is pending), 44 of 47 original drafts parse and compile (meets the 90% M-31 target), 19 of 47 needed no repair, $3.597, p50 36.3 s / p95 57.1 s per lesson, 347 s wall, n = 47, one run (`docs/delivery/real-model-results.md`; `evals/reports/full-run-run_01M5W7VQFD6AEVPMPZA2Z4S9ZK.md`). The QA walk (NL-126) predates it and used the stub stack |
| Measured review sessions (reviewer minutes per approved lesson, G-2) | NL-123 | The north-star number on the success surface (S-2, F-6) | pending: NL-123 |
| Seeded-error catch rate (M-4) | NL-135 | The M-4 line in S-2 | pending: NL-135 |
| Judge calibration / held-out comparison | NL-132 | Nothing is shown; judge and held-out comparison are listed under "cannot be shown" | pending: NL-132 |

Two things exist and are stated as facts, not softened:

1. **The stored p95 missed its target.** M-24 stored p95 is **6,008 ms against a target of under 3,000 ms**
   (n = 22,533 samples, 140 socket editors, stub provider, one run, 2026-10-26;
   `evals/reports/load-2026-10-26.md`, "Misses"). It was not tuned. The report points at the store path (Postgres write
   plus check refresh) and 1,310 `check.failed` worker log lines as the first thing to examine.
2. **Four blocking QA findings are open, fixes in flight.** NL-126 filed 18 findings (4 blocking, 6 major, 8 minor),
   none fixed in that report (`docs/ux/05-verify/QA_REPORT.md`, "Findings"): F-1 (unit-id confirm sends `U4`, server
   answers 422, Generate can never turn on), F-2 (Compose web-to-collab URL lacks `/internal`, 503 on every command),
   F-3 (browser editor never connects on Compose), F-4 (Compose stub mode cannot generate, run sits in Planning).
   NL-133 (Innocent's sign-off) is blocked by F-1 to F-4. The recording must not happen until those four are fixed and
   the walk is repeated; the script then states what was fixed.

## Time plan

Product demo first, under 5:00. Decisions and candour second, up to 5:00. Total at most 10:00; the brief sets no video
length (inventory, "How to read it"). Times are mm:ss.

| Segment | Window | Length | Sum check |
|---|---|---|---|
| Product (sections 1 to 4) | 0:00 to 4:50 | 290 s | 25 + 25 + 195 + 45 = 290 |
| Decisions and limits (section 5) | 4:50 to 9:50 | 300 s | 245 + 55 = 300 |
| Total | 0:00 to 9:50 | 590 s | 290 + 300 = 590, under the 600 s cap |

Columns: `time` is the row's window; the shot column is the `demo-video` skill's shot-list line for that row.

## 1. The problem, in Newsela's words (0:00 to 0:25)

| Id | Time | On screen | Narration | Source row | Evidence path | Shot (demo-video) |
|---|---|---|---|---|---|---|
| P-1 | 0:00-0:25 (25 s) | Title card with the brief's two quotes | "Newsela is entering core instruction for California, an ARR market of tens of millions. The obstacle in your brief is 'prohibitively enormous manual authoring work'. Your first program exists; what limits the next one is how fast a small team can prove each lesson meets the state's bar." Open on this, not on the tool. | Inventory 40 (name and positioning, `decided`) | `docs/delivery/2026-10-24-angle-and-demo-framing.md` (section 1 and its demo table); quote source `docs/analysis/2026-10-24-brief-audit.md` | Static title card, 25 s, no cursor; large quote text; no product UI yet |

No number is spoken here beyond the brief's own words. The "about 1,000 lessons per program" figure in the framing doc
is tagged `[A]` (assumption) there; do not say it as a fact.

## 2. What success means: two layers, the north star and its guard (0:25 to 0:50)

| Id | Time | On screen | Narration | Source row | Evidence path | Shot |
|---|---|---|---|---|---|---|
| S-1 | 0:25-0:38 (13 s) | Two-layer diagram: business value above, build metrics below | "Two layers. The business layer: more proven lessons per reviewer-hour. The build layer: the metrics I can measure here. I will not claim revenue; no build can." | Inventory 3 (`decided`) | `docs/delivery/2026-10-24-angle-and-demo-framing.md` (section 3, metrics tree) | Static diagram, 13 s |
| S-2 | 0:38-0:50 (12 s) | North-star tile with the G-2 guard beside it; M-4 shown as "pending" | "The north star is reviewer minutes per approved lesson, never shown without its guard, G-2, the fast-approval rate, so skimming cannot win. Every figure says 'one reviewer, n = k'. Review-time figure: pending: NL-123. Seeded-error catch rate M-4: pending: NL-135." | Inventory 3, 19 (`decided` / `assumption`, stated as a limit) | `docs/delivery/2026-10-24-angle-and-demo-framing.md`; QA_REPORT SCR-8 row: the tile showed only its empty state, "No approved lessons yet ... No baseline yet (AQ-14)" | Zoom on SCR-8 tile (empty-state caption visible) until NL-123; then the measured tile |

Do not speak any minutes value until `docs/testing/` holds the NL-123 report. The only review-time statement allowed
today is that there is no baseline (AQ-14, unanswered).

## 3. The flow, narrated by what the partner cares about (0:50 to 4:05)

Order: upload, defects caught before money is spent, generation, a lesson picked at random, a blocked Approve, the
second account approves the pinned version, the success surface. Screens: SCR-3, SCR-4, SCR-5/6, SCR-9, SCR-14, SCR-8.

| Id | Time | On screen | Narration | Source row | Evidence path | Shot |
|---|---|---|---|---|---|---|
| F-1 | 0:50-1:15 (25 s) | SCR-3 upload of the issued Grade 6 Unit 4 sheet, then SCR-4 validation report | "I upload your issued sheet. Before any model call and before any money is spent, the report reads it. It computes 6 errors and 16 ELD findings across 9 distinct codes, counted by code, not recalled." Say "n = one unit, 47 rows". | Inventory 8 (a measured result, narrate as a result), 20 (`decided`) | `docs/devlog/2026-10-25-w6-nl94.md` (the counts, n = 1 unit, 47 rows); `docs/ux/05-verify/QA_REPORT.md` SCR-4 row (report shows 6 errors to confirm) | Screen capture SCR-3 to SCR-4, cursor on the "6 errors to confirm" count |
| F-2 | 1:15-1:40 (25 s) | SCR-5 start dialog (scope, locked rules + guidance version, spend cap) then SCR-6 progress | "One unit plan call, then one call per lesson, capped fan-out, one repair on an invalid draft, with a spend cap you can see." Numbers from the final NL-112 run: per-lesson time p50 36.3 s, p95 57.1 s; unit spend $3.597 against a $6.00 cap; 347 s wall (n = 47, one run). | Inventory 5, 9, 26 (`decided`) | Run numbers: `evals/reports/full-run-run_01M5W7VQFD6AEVPMPZA2Z4S9ZK.md` (measured). Design basis: `docs/analysis/spikes/SP-1-one-call-draft.md` (n = 3 lessons, max 119.7 s, $0.182 per lesson mean) | Screen capture SCR-5 dialog, SCR-6 progress. Cannot be recorded today: QA F-4 (run stays in Planning on the stub stack) and no real-model run |
| F-3 | 1:40-2:25 (45 s) | A lesson picked at random from the finished 47-lesson run, opened in SCR-9 with its evidence pane | "I did not choose this lesson. The seed and the method are on screen." Show the pick: seed value and the command, written to the recording log before the pick. | Inventory 21 (`decided`) | Random-pick method (GR-14): a seeded draw over the 47 lesson ids of the NL-112 run; the seed is recorded in the run log before the draw. Seed and result: drawn at recording time over the 30 ready lessons of the final run (the 17 blocked ones were never stored as a ready lesson; say so on screen). The seed is logged before the draw. Method statement: `docs/prd/newsela-prd.md` (GR-14), `SUBMISSION.md` | Terminal flash of the pick (seed visible), then SCR-9 capture. Not recordable until the editor connects on Compose (QA F-3: editor never connects on Compose) |
| F-4 | 2:25-3:00 (35 s) | SCR-9 -> SCR-14: Approve disabled by a blocking issue (grounding placeholder or unconfirmed standard) | "The draft carries no invented quote. Where the model had no source text, code left a typed placeholder, so Approve is off until a named reviewer fills it or confirms the standard." | Inventory 1, 4, 7 (`decided`) | Behaviour: `docs/ux/05-verify/QA_REPORT.md` SCR-14 rows (the BLOCKED refusal path; finding F-5 crashed the page, fixed on `fix/nl126-G3`, not yet on main). Real-draft instance: open a blocked lesson from the final run (15 were blocked by the name check, 2 by the page check; reasons are stored) | Screen capture SCR-14, cursor on the disabled Approve and its reason |
| F-5 | 3:00-3:35 (35 s) | Sign in as the second account; approve the pinned version; stale tab gets a 409 | "A second account approves, and the approval is pinned to the version the reviewer saw. A stale tab gets a 409 and changes nothing." Say the stale-approve figure only with its n. | Inventory 4, 6 (`decided`) | Stale-approve: 20 of 20 trials; the S5 integrity suite passes 120 of 120 (six assertions, 20 trials each), stub provider, no model call (`evals/reports/integrity-988d2cd73a6a.md`, n = 120). **Approve success and reopen were NOT WALKED in NL-126** (no lesson without blocking issues); the live walk on a real-model lesson has not been done | Screen capture, two browser contexts side by side. Not recordable today |
| F-6 | 3:35-4:05 (30 s) | SCR-8 board: roll-up and the north-star tile with the G-2 guard | "The board shows where the unit stands. The tile shows reviewer minutes per approved lesson, with its guard, from one reviewer: n = k." Speak the value only from the NL-123 report. | Inventory 3, 19 | Tile value: **pending: NL-123**. Today's tile: empty state only (`docs/ux/05-verify/QA_REPORT.md`, SCR-8 row) | Zoom on tile and caption; repeat of S-2 shot with data |

## 4. One caught error, shown (4:05 to 4:50)

| Id | Time | On screen | Narration | Source row | Evidence path | Shot |
|---|---|---|---|---|---|---|
| C-1 | 4:05-4:25 (20 s) | SCR-4 report line: a code on the issued sheet that does not exist (`RL.6.9.a`, proposed `RL.6.9`) | "This is a real defect in your issued sheet, caught before spend: the code `RL.6.9.a` does not exist." | Inventory 8, 20 | `docs/devlog/2026-10-25-w6-nl94.md`; `docs/ux/05-verify/QA_REPORT.md` SCR-4 (and finding F-8: the proposal collapses a multi-code Focus cell to one code, open) | Screen capture SCR-4, cursor on the row |
| C-2 | 4:25-4:50 (25 s) | A generated lesson where the quote scan blocked an invented quote and left a typed placeholder | "Here the model brought in a name that is not in our sources. The check blocked the lesson and stored the reason for a reviewer." (The final run produced no unmatched-quote failures, so show a name or page block, not a quote.) Say the scan's measured limit: it was checked on 3 real drafts plus 1 synthetic (SP-3), flags not labelled by a person. | Inventory 1, 18 | Instance: pick one of the 17 blocked lessons in the final run. Method evidence: `docs/analysis/spikes/SP-3-invention-scans.md` (n = 3 real drafts plus 1 synthetic) | Screen capture SCR-9 evidence pane. If no suitable instance is chosen, drop this row and extend C-1 to 45 s |

## 5. Decisions, cuts and candour (4:50 to 9:50)

Each decision row cites an inventory row whose status is `decided`. Rows 8, 11, 14 and 15 are results and are spoken as
"we measured ...". Anything `proposed` or `assumption` is spoken as an assumption.

### 5a. Decisions (4:50 to 8:55, 245 s)

| Id | Time | On screen | Narration (choice, rejected alternative, evidence, limit) | Source row | Evidence path | Shot |
|---|---|---|---|---|---|---|
| D-1 | 4:50-5:20 (30 s) | Placeholder block in the editor | "Choice: no source texts, so no quote block; code scans for quotes of 3+ words, page numbers and invented names. Rejected: let the model fill from memory. Limit: heuristic, see SP-3." | Inventory 1 (`decided`) | `docs/analysis/spikes/SP-3-invention-scans.md`; `docs/design/hard-problems.md` (HP-2) | Title card with the rejected option crossed out |
| D-2 | 5:20-5:40 (20 s) | Repo and data-boundary card (no content shown) | "Choice: pre-adoption material stays out; traces and Yjs state stay in our own Postgres. Rejected: fine-tune on the crawl, hosted tracing." | Inventory 2 (`decided`) | `docs/prd/newsela-prd.md` (PD-9, PD-19, PD-20) | Static card, no crawled content shown |
| D-3 | 5:40-6:10 (30 s) | North-star tile with G-2 | "Choice: reviewer minutes per approved lesson, human sessions only. Rejected: lessons per hour. Limit: no baseline exists (AQ-14); this build uses us as reviewers, not Newsela's LXDs (n = k)." | Inventory 3 (`decided`), 19 (assumption, a limit) | `docs/delivery/2026-10-24-angle-and-demo-framing.md` section 3.2; value pending: NL-123 | Zoom on tile |
| D-4 | 6:10-6:35 (25 s) | Approve disabled; roles | "Choice: no bulk approve; per lesson, per version, separate reviewer and approver. Rejected: batch approval with sampling." | Inventory 4 (`decided`) | `docs/analysis/2026-10-24-brief-audit.md` (T-3) | Repeat F-4 shot |
| D-5 | 6:35-7:00 (25 s) | Architecture sketch: one call per lesson | "Choice: one structured call per lesson, validated in code, one repair. Rejected: per-section calls. Evidence: the spike passed on 3 of 3 lessons; 2 of 3 needed the repair (n = 3, one unit). Limit: Innocent had not read the spike result when this inventory was written." | Inventory 5 (`decided`) | `docs/analysis/spikes/SP-1-one-call-draft.md` | Static diagram |
| D-6 | 7:00-7:25 (25 s) | Two-tab stale approve | "Choice: Submit freezes the lesson and approval is pinned to the version. Rejected: close every connection at Submit; it resurrected refused keystrokes on reconnect. Evidence: SP-2, 20/20 per pass line, PGlite stand-in; S5 suite 120/120 (stub). Limit: store times indicative only." | Inventory 6 (`decided`) | `docs/analysis/spikes/SP-2-freeze-at-submit.md`; `evals/reports/integrity-988d2cd73a6a.md` (n = 120) | Repeat F-5 shot |
| D-7 | 7:25-7:50 (25 s) | Alignment view | "Choice: alignment is layered and never self-asserted; a named reviewer confirms. Rejected: copy the codes in and call it aligned." | Inventory 7 (`decided`) | `docs/design/hard-problems.md` (HP-3) | SCR-10/11 capture if reachable (QA F-3) |
| D-8 | 7:50-8:05 (15 s) | Architecture beat | "Choice: an LLM pipeline with a fixed skeleton, named as that. Rejected: an autonomous agent that judges itself." | Inventory 9 (`decided`) | `docs/prd/newsela-prd.md` (PD-3, PD-4) | Static diagram |
| D-9 | 8:05-8:25 (20 s) | Contract cards and change log | "Choice: contracts first. 24 cards agreed on 2026-10-25; later changes numbered CHG-1 to CHG-6. Rejected: each side guessing the other's API." | Inventory 10 (`decided`) | `docs/contracts/INTERFACE.md`; `docs/contracts/CHANGES.md` | Scroll the change log |
| D-10 | 8:25-8:40 (15 s) | Hosting card | "Choice: Render from the GitHub mirror, about $27 a month list price, inside the $40 cap. Rejected: local Compose only. Limit: the deployment was not verified when this inventory was written; this recording runs on local Compose." | Inventory 12 (`decided` 2026-10-26) | `docs/delivery/render-deploy-prompt.md`; `docs/prd/newsela-prd.md` (PD-37) | Static card |
| D-11 | 8:40-8:55 (15 s) | Spend card | "Choice: a $75 hard-stop model-spend ceiling for the whole build. Rejected: no ceiling. The spike measured $0.182 per lesson (n = 3)." Run spend: $3.597 for the final full run (the run before it: $4.19; about $9.8 of $20 authorised across the session). | Inventory 13 (`decided`) | `docs/analysis/spikes/SP-1-one-call-draft.md` | Static card |

### 5b. Candour: what was measured, what missed, what is open (8:55 to 9:50, 55 s)

| Id | Time | On screen | Narration | Source row | Evidence path | Shot |
|---|---|---|---|---|---|---|
| K-1 | 8:55-9:15 (20 s) | QA findings table and load table | "Two honest misses. The stored p95 was 6,008 ms against a 3,000 ms target (n = 22,533, stub, one run); I did not tune it. And my own QA walk filed 4 blocking findings; fixes are in flight, so this stack is not signed off yet. The load run used a stub provider and padded synthetic lessons, so its other passes are optimistic." | Inventory 32 (targets `decided`, measured now) | `evals/reports/load-2026-10-26.md` ("Misses", F-1, F-2); `docs/ux/05-verify/QA_REPORT.md` ("Findings" F-1 to F-4) | Zoom on the M-24 row (MISSED) and the F-1 to F-4 rows |
| K-2 | 9:15-9:25 (10 s) | Fault suite report | "Four of four scripted faults pass on the stub, at $0 of model spend. That proves the recovery code, not real-provider behaviour (n = 4, one run)." | Inventory 14 (a result) | `evals/reports/faults-05b70004372e.md` (n = 4) | Report capture |
| K-3 | 9:25-9:35 (10 s) | Seam follow-ups | "One finding I left open on purpose: with the shipped retry budget, 8 consecutive 429s lose 2 lessons. The test is marked as an expected failure, not hidden (S-28, n = 1 scripted burst)." | Inventory 15 (a finding, open) | `docs/plans/seam-followups.md` (S-28) | Cursor on S-28 |
| K-4 | 9:35-9:50 (15 s) | Capability table | "On the connected stack, sign-in passes 22 of 22 specs and outline upload 15 of 15; everything else on the board is still 'no'. Counts of specs, not of users or lessons." Re-read the capability table at recording time. | Inventory 11 (a result) | `docs/delivery/capability-status.md`; `docs/delivery/evidence-con-1-real-stack-2026-10-25.log` | Capability table capture |

Limits to say once, plainly (GR-14): one reviewer group (us, not Newsela's LXDs), every figure "n = k"; one unit; the
the full-run result is 30 of 47 lessons ready after two prompt rounds in the recorded run (one run, n = 47); the 17 blocked were checker false positives per an offline replay (replay only: not a fresh run, the stored 30/17 is unchanged); a fresh measurement on the fixed candidate is pending; review-time and seeded-error results are pending (NL-123, NL-135 needs the blind human review).

## Cannot be shown (so the video never implies them)

| Item | Why it cannot be shown | Source |
|---|---|---|
| A claim that a fresh run on the fixed candidate reached any rate, that lessons are good, or that a teacher judged the quality | not proven: the 17 blocks are an offline replay, no fresh run, no human quality sample | `docs/delivery/real-model-results.md` |
| Measured reviewer minutes per approved lesson | pending: NL-123 | inventory, "Reserved" |
| Seeded-error catch rate (M-4, R-52) | pending: NL-135; PRD cut #6 | `docs/prd/newsela-prd.md` section 6.4 |
| An LLM alignment judge, or a held-out comparison | pending: NL-132; PRD cut #2; "no model judge" unless a report exists | `docs/prd/newsela-prd.md` section 6.4 |
| Cross-lesson arc checks, the coverage matrix (unit grid) | PRD cuts #3 and #4 | `docs/prd/newsela-prd.md` section 6.4 |
| Pause and resume of a run; the unit plan (SCR-7); candidate compare and adopt (SCR-12); AI assist (SCR-13) | NOT WALKED in NL-126 | `docs/ux/05-verify/QA_REPORT.md` ("Journeys") |
| Approve success and reopen on a live lesson | NOT WALKED in NL-126 | `docs/ux/05-verify/QA_REPORT.md`, journey 6 |
| Live co-editing in the browser on Compose | QA F-2 and F-3 open | `docs/ux/05-verify/QA_REPORT.md` |
| A live publish to Newsela's application | none exists; "Publish" is a labelled JSON export | inventory 25 |
| The hosted Render deployment as verified | not verified in the record | inventory 31 |
| Tool replacing writers, or bulk approval | never claimed (GR-16; inventory 4) | inventory 4, 40 |

## Before recording: checklist

1. QA F-1 to F-4 fixed and merged; the NL-126 walk repeated on the connected stack. Until then, none of F-2 to F-5 can be recorded.
2. The NL-112 final report exists; the lesson id is drawn by the seeded method and the seed is logged first.
3. NL-123 report exists before the tile value is spoken; NL-135 before M-4.
4. Re-read the inventory and `capability-status.md`; any row that changed status is re-checked.
5. Innocent has not reviewed the inventory (its Verification section); rows not `decided` are spoken as assumptions.
