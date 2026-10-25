# System Design Readiness — Newsela Lesson Studio

**Last audited:** 2026-10-25
**Verdict:** READY. Every required item is Found, Decided, Assumed (with the measurement that replaces it) or N/A; all
five foundation questions were answered by Innocent and are quoted below.
**Gates:** interview complete yes (`docs/prd/interview.md`, state *complete*) · design ready READY · ticket ready no —
`design_outputs.py --gate tickets` needs DO-3 and DO-4 `ready` (both `planned` on 2026-10-25) and the three
*Before the ticket-ready gate* checks (§6 below). Kept separate per `DESIGN-OUTPUTS.md`.
**Design outputs register:** [`docs/prd/interview.md#Design outputs`](../prd/interview.md) (one register, never two).
**Checklist:** `.claude/workflow/system-design-readiness/CHECKLIST.md` (60 items; the project's pinned copy of
`Gauntlet AI/.claude/skills/system-design-readiness/CHECKLIST.md`).
**Sources read:** the interview's *Checklist coverage* (every item dispositioned 2026-10-25; this audit verified its
citations rather than redoing the sweep); PRD v1.0 `docs/prd/newsela-prd.md` (§5.3, §5.4, §9, §10 PD-1…PD-35, §12,
§13); [`capacity-and-workload.md`](capacity-and-workload.md); [`hard-problems.md`](hard-problems.md) (index, *Spikes*,
HP-1, HP-7); [`docs/contracts/INTERFACE.md`](../contracts/INTERFACE.md) (shared definitions, CON-12, CON-13, CON-20,
CON-21); framing doc §3. Not read: `docs/source/restricted/` (GR-9).

**What this means in practice.** A reviewer asking "who decided the system is built for 200 people at once?" gets a
dated quote from Innocent, not a number Claude inferred from the brief's "20+ reviewers". A reviewer asking "how much
does a lesson cost?" gets an `[A]` with the spike that is measuring it right now (SP-1), not a guess presented as fact.

## Hardest uncertainty and depth

**SD-1.9:** whether one structured call can produce a valid ~3,300-word teacher edition in Newsela's schema within a
few minutes and under $1 per lesson (interview Q-003). SP-1 answers it on rows 8, 9 and 25; if it fails, generation is
one call per section (HP-1 option B).

| Step | Depth | Why |
|---|---|---|
| 1 Frame | full | Always |
| 2 Promises | light | Per-operation targets exist in the PRD and capacity doc; light mode (PD-23) |
| 3 Workload | light | Two foundation figures plus a labelled mix (capacity doc); no sustained-throughput requirement (PD-33) |
| 4 Logical flow | light | Two traces (one request, one job) in DO-1 §4 |
| 5 Resource demand | full on the model path, light elsewhere | SD-1.9 is a model-cost-and-time question (interview SD-1.9 row) |
| 6 Overload and failure | light | One failure to survive (SD-7.2); HP-7 already designs it |
| 7 Deployment | light | Local Compose decided (PD-15 D); one instance of each process |
| 8 Validation | full on the model path, light elsewhere | Spikes, full-run report, evals; load test stubbed |

Which tiers apply: Core ✓ · Full (steps 5 and 8 on the model path; SD-2.6, SD-3.1–SD-3.4, SD-3.6, SD-5.1, SD-5.2,
SD-5.6, SD-6.5, SD-7.2, SD-7.3, SD-8.3 answered at light depth) · AI ✓ · Legacy ✗ (no existing system is extended;
SD-4.6 n/a).

## 1. Go find — blocks the design

No Issued or External item is missing or ambiguous. The brief is silent (not ambiguous) on load, spend, telemetry and
judging; each became a Decision and is answered in §2. The partner questions AQ-1…AQ-22 stay drafted, not sent (PD-24);
each has a working assumption labelled in the PRD and none is foundation-level.

| ID | What's missing | What was checked | Where to get it / who to ask | Logged as |
|---|---|---|---|---|
| — | nothing outstanding | brief Required Deliverables, Technology, Cloud Platforms, Performance, Time Constraints; capture notes; claude-api reference (2026-10-25); hosting rule (Render facts read 2026-10-22) | — | — |

## 2. Decide — closed in the interview

### 2.1 The five foundation questions (rule `system-design-questioning` §1), answered by Innocent

| ID | Question | Options offered | Decision (date, his words) | Recorded in |
|---|---|---|---|---|
| SD-3.1 | What load is it built for, and what larger load needs a written path? | Batch 1 recommendation (25 concurrent editor sessions, one unit at a time) vs his own figure | **Decided by Innocent, 2026-10-25:** "Capacity: **500 users per day, with a spike of 200 concurrent users**. There is **no 200-day requirement**." Supersedes Q-006's batch 1 answer. Scale path: DO-1 §7.2 | PRD §10 PD-33; interview Q-006 (batch 2, "changed (Innocent)"); `capacity-and-workload.md` *The decision*. No dev-log entry names PD-33 yet (checked `docs/devlog/` 2026-10-25): the third record rule 6 asks for is still to be written |
| SD-3.4 | Peak and concurrency: how many at once, how bursty? | as SD-3.1 | **Decided by Innocent, 2026-10-25**, same words: a spike of 200 concurrent users. Kept apart from generation: ≤ 6 lesson jobs in flight across ≤ 3 runs [A] → SP-1 (PD-13). Burst shape [A] in the capacity doc | PD-33; interview Q-007 (batch 2); capacity doc |
| SD-7.2 | What failure must the deployment survive? | a worker restart mid-run (recommended); also losing the collaboration process; a replica or zone | **Decided 2026-10-25 under Innocent's instruction** "finish stage 3 and 4 dont ask for my input ill follow your recommendations": "A worker restart mid-run: the run resumes at the next unfinished lesson, no lesson is stored twice, no completed call is paid for again, calls lost in flight are at most the concurrency cap and are counted (R-16 reworded). No replica or zone failure is designed for." | interview Q-008; HP-7 option B; PRD R-16 as amended (§5.4) |
| SD-1.6 | Spending ceiling: hosting, model spend, paid APIs | hosting options A–D (PRD §9); a model-spend total | **Decided 2026-10-25 under the same instruction:** hosting "**$0 new spend** — record the demo locally under Docker Compose … a Render deploy is one approval away (PD-15 option D)"; model spend "**$75 total for the build** [T], a hard ceiling: SP-1 ≤ $5, the per-run cap from PD-14 … set after SP-1, reserve-then-settle enforcement (HP-7)" | interview Q-002; PRD PD-15, PD-29 |
| SD-1.9 | The hardest uncertainty | one-call drafts vs other risks (approval pinning, grounding) | **Decided 2026-10-25 under the same instruction:** "Whether one structured call can produce a valid ~3,300-word teacher edition in Newsela's schema within a few minutes and under $1 per lesson. SP-1 answers it on rows 8, 9 and 25; if it fails, generation is one call per section (HP-1 option B)." | interview Q-003; hard-problems.md SP-1; PD-4 |

**Candour on the basis.** SD-3.1 and SD-3.4 carry Innocent's own figures. SD-7.2, SD-1.6 and SD-1.9 were answered by
his explicit delegation ("ill follow your recommendations"), recorded as his answers with that quote as the basis
(interview *How this interview ran*). The design treats all five as decided; anything he raises later reopens the
affected row (status `revisit`). Stack, host and database are settled by earlier decisions (PD-11, PD-13, PD-15), so
they did not join the foundation list.

### 2.2 Other decisions the design drew on

Every other Decision-type item was closed in the interview, each with its PD or HP row (*Full audit* below). Decisions
made during §6 design, none foundation-type:

| ID | Question | Options offered | Decision | Recorded in |
|---|---|---|---|---|
| SDQ-1 | Where do checks run after a store (CON-13's System question)? | (A) in the worker from a coalesced `check_job` row written in the store transaction; (B) inside the collaboration server | A — **Proposal, adopted under PD-32** (2026-10-25). If B were chosen, CON-13's `pending` flag comes from in-memory state and the collaboration event loop loses its headroom | DO-1 decision D-6 |
| SDQ-2 | How does the judge reach "another provider" (PD-12)? | (A) an OpenAI model through OpenRouter; (B) OpenAI's API directly | A — **Proposal, adopted under PD-32**. Only the adapter and key change under B. Judge stays cut #2 | DO-2 decision A-3 |
| SDQ-3 | Is there a build-total guard beyond the per-run and per-day caps? | (A) the reservation also checks the $75 build total; (B) per-run and per-day only | A — **Proposal, adopted under PD-32**; it implements PD-29's "hard ceiling" in code | DO-1 §7.1, D-8 |

### 2.3 Contract gaps handed to the System review of `INTERFACE.md`

This audit does not edit the cards (another session holds the System review). Found while designing:

| ID | Card | Gap | Proposed fix |
|---|---|---|---|
| CG-1 | shared error table | The capacity doc's overload behaviour (wait ≤ 2 s for a connection, then a retryable 503) has no named error code | add a `SERVICE_BUSY` 503 with `retryable: true` to the shared table |
| CG-2 | *Timing in one place*, CON-12 | Remote-edit p95 < 300 ms and lesson open/board figures are R-56/R-57's 25-user numbers; PD-33 and PRD §5.4 move them to the 200-user spike with the capacity doc's targets (< 500 ms remote edit; board poll < 300 ms) | update the timing rows to the capacity doc, citing PD-33 |
| CG-3 | CON-13 | The System questions "where checks run" and "the `pending` flag's source" are answered by SDQ-1 | record the answer in the card's System review |

## 3. Assumptions — replaced by measurement later

| ID | Assumed value | Basis for the guess | Test that replaces it |
|---|---|---|---|
| SD-3.2 | Per-user traffic at the spike: 1 heartbeat / 15 s, 1 poll / 2 s on polling screens, ~1 action / 10 s, ~1 page load / 30 s; ≈ 40 HTTP requests/s [C on A] (supersedes the interview's 25-session figure) | CON-20, PD-18; capacity doc mix | the R-49 scripted 3-lesson review and the load script's request logs (observability WF-16, WF-29) |
| SD-3.3 | Mix: polls and heartbeats dominate HTTP; Yjs updates dominate the socket; model calls only in generation (1 `UnitPlan` + 1 draft + ≤ 1 repair per lesson) | R-8, R-19; capacity doc | call rows in the full 47-lesson run (WF-25) and the load script (WF-29) |
| SD-3.6 | One stored lesson tens of KB of JSON; draft ≈ 6,600 output tokens and ≈ 12,000 input tokens | published median 3,306 words [M]; JSON overhead guess | **SP-1** (tokens and size per call), then the full run |
| SD-5.1 | Web ≈ 0.5 core at the spike; checks ≈ 50 ms CPU each | DO-1 §5.1 per-request guesses | load script: process CPU and event-loop lag (WF-29) |
| SD-5.2 | ≈ 1.3 busy Postgres connections on average, pools 10 + 5 + 4 | DO-1 §5.1 hold-time guesses | load script: connection counts during a stubbed generation run (WF-29) |
| SD-5.3 | ≈ $0.09 per draft call at list prices; $0.50 per lesson kept as the planning bound; ~3 min per lesson | DO-1 §5.3; PRD §12 | **SP-1** (cost and time from usage fields and wall clock), then the full-run report (WF-25) |
| SD-7.3 | One instance of each process carries the 200-user spike with ~2–5× headroom | DO-1 §5.1 | load script on the VPS, provider stubbed (WF-29); the collaboration process is predicted to bend first (DO-1 §7.3) |
| — | Concurrency cap 4 → ≤ 6; per-call timeout; output cap 16,000 tokens; per-run and per-day caps | HP-7, PD-13, PD-14 | **SP-1** (rate-limit headers, p95, truncations, cost) |
| — | Store transaction p95 ≤ 500 ms | HP-4 target | **SP-2** |
| — | Name-scan blocking scope | HP-2 | **SP-3** |

## 4. Full audit

Status words: **Found** (an issued or external source answers it), **Decided** (Innocent's answer, or his delegation
recorded as his answer), **Assumed** (Measure item with its replacing test), **N/A**. Evidence is the interview's
*Checklist coverage* row, verified 2026-10-25 against the cited owner. "Verified" in the note means the cited rows were
opened and agree; "stale cell" means the interview row predates PD-33 and this report's evidence wins.

| ID | Status | Evidence | Note |
|---|---|---|---|
| SD-1.1 | Found | brief PRD paragraph; PRD §3 personas; PD-1 | verified |
| SD-1.2 | Found | brief Required Deliverables; PRD §5.2; SUBMISSION.md | verified |
| SD-1.3 | Found | brief Off-Limits (empty, AD-2); PRD §7, §8 | verified |
| SD-1.4 | Found | brief Technology; PRD §9; PD-11, PD-13 | verified |
| SD-1.5 | Found | brief Time Constraints; interview Q-001; PRD §6.1 | verified |
| SD-1.6 | Decided | interview Q-002; PD-15 option D; PD-29 | foundation; §2.1 |
| SD-1.7 | Found | brief Impact Metrics; framing §3.2; PRD §12 | illustration only, labelled |
| SD-1.8 | Found | GR-9, GR-13, AR-37; data README; PD-20 | verified |
| SD-1.9 | Decided | interview Q-003; SP-1 | foundation; §2.1 |
| SD-1.10 | Decided | PD-19, PD-30; interview Q-022 | DO-6 *Storage and access* |
| SD-2.1 | Decided | PRD §5.1; PD-2 | DO-1 §2 |
| SD-2.2 | Decided | GR-1, GR-6, GR-7; R-5, R-16, R-19, R-29, R-33, R-34 | DO-1 §2 invariants |
| SD-2.3 | Decided | R-17, R-28, R-55, R-57 as amended; capacity doc targets | DO-1 §2; CG-2 |
| SD-2.4 | Decided | R-1, R-7, R-26, R-28; PD-18 | verified |
| SD-2.5 | Decided | R-16, R-19, R-31 | DO-1 §6.1 |
| SD-2.6 | Decided | R-26 (RPO ≤ 2 s), R-16, R-35; PD-30 backup | DO-1 §6.2 |
| SD-2.7 | Decided | PRD §4; framing §3.3; PD-1 | DO-7 owns formulas |
| SD-2.8 | Decided | R-16, R-19, R-48; framing §3.4 | DO-6 |
| SD-2.9 | Decided | PRD §4; framing §3.2–§3.4 | DO-7; mapping M-1…M-20 in DO-6 |
| SD-3.1 | Decided | PD-33; interview Q-006 batch 2; capacity doc | foundation; §2.1; stale cell (interview row still reads 25 sessions) |
| SD-3.2 | Assumed | capacity doc mix | §3; stale cell (interview row reads 12 reviews per reviewer) |
| SD-3.3 | Assumed | R-8, R-19; capacity doc | §3 |
| SD-3.4 | Decided | PD-33; interview Q-007 batch 2 | foundation; §2.1; stale cell (interview row reads 6 jobs while 25 sessions) |
| SD-3.5 | Found | R-16, R-28; data README (41 + 6 days) | verified |
| SD-3.6 | Assumed | R-3; framing §3.2 [M]; SP-1 | §3 |
| SD-3.7 | Decided | interview SD-3.7 list | every entry gets a WF-n in DO-6 (40 rows; cut items marked) |
| SD-4.1 | Decided | T-20; R-1, R-35; PD-7 / HP-4 | DO-2 §3 |
| SD-4.2 | Found | claude-api reference read 2026-10-25; capture notes 2026-10-24; PD-9, PD-12 | judge route via OpenRouter: SDQ-2 |
| SD-4.3 | Decided | PD-3, PD-4 / HP-1; R-8, R-11, R-19, R-20, R-23, R-31 | DO-2 §5 |
| SD-4.4 | Decided | journey steps 1–4; R-16, R-28, R-42, R-49 | DO-2 §4 |
| SD-4.5 | Decided | R-16, R-19, R-29, R-33; HP-5, HP-7 | verified |
| SD-4.6 | N/A | PD-22 | no existing system is extended; "published" is a JSON export |
| SD-4.7 | Decided | R-16, R-17, R-33, R-48, R-49, R-55 | DO-6 *Correlation across boundaries* |
| SD-5.1 | Assumed | DO-1 §5.1 | §3 |
| SD-5.2 | Assumed | DO-1 §5.1 | §3 |
| SD-5.3 | Assumed | PRD §12; DO-1 §5.3 | §3; SP-1 |
| SD-5.4 | Found | claude-api reference (models table cached 2026-10-06, read 2026-10-25); PD-12 | IDs and prices re-confirmed at build |
| SD-5.5 | Found | capture notes 2026-10-24 | one fetch per upload |
| SD-5.6 | Found | Node single event loop; PD-9, PD-13; AD-15 | drives DO-1 D-6 |
| SD-6.1 | Decided | HP-7; R-16, R-54; capacity doc queue behaviour | DO-1 §6.1 |
| SD-6.2 | Decided | R-16, R-33, R-42; HP-7 | per-call timeout [A] → SP-1 (DO-1, deferred item closed) |
| SD-6.3 | Found | claude-api error codes read 2026-10-25; R-2, R-26 | verified |
| SD-6.4 | Decided | R-1, R-7, R-12 | verified |
| SD-6.5 | Decided | R-3; one active unit run queued behind; GP-114 | fair share across ≤ 3 runs [A] (capacity doc) |
| SD-6.6 | Decided | R-16, R-19, R-48; framing §3.4 | health routes now WF-39 (the interview deferred them to DO-6) |
| SD-7.1 | Decided | brief Cloud Platforms "Any"; PD-15 option D; interview Q-009 | verified |
| SD-7.2 | Decided | interview Q-008; HP-7 B | foundation; §2.1 |
| SD-7.3 | Assumed | DO-1 §5.1, §7 | §3; stale cell (interview row reads 25 sessions) |
| SD-7.4 | Found | hosting rule (read 2026-10-22); claude-api prices | AD-15 ~$20/month not provisioned |
| SD-7.5 | Decided | PD-11, PD-13, PD-19; PRD §9 | verified |
| SD-7.6 | Decided | PD-19, AD-17 | DO-6 *Storage and access* |
| SD-8.1 | Decided | R-3, R-19, R-23, R-51, R-52, R-53; WP-1…WP-5 | DO-5 |
| SD-8.2 | Found | data README; rule synthetic-test-data | verified |
| SD-8.3 | Decided | R-57 and R-56 as amended (PD-33); capacity doc *How capacity is validated* | load at the 200-user spike on the VPS, provider stubbed; stale cell (interview row reads 25 clients) |
| SD-8.4 | Decided | R-35, R-48, R-49, R-57 | DO-6 required records |
| SD-8.5 | Found | brief Required Deliverables; SUBMISSION.md | verified |
| SD-8.6 | Decided | PRD §6.4; framing decision lines | DO-1 §8 redesign triggers |
| SD-8.7 | Decided | R-35, R-48, R-55; GR-10 | DO-6 WF-22 |
| SD-8.8 | Decided | R-3–R-5, R-19, R-23; PD-6; data README | DO-5 |
| SD-8.9 | Decided | GR-11, R-52, R-53, PD-20; AD-3 | DO-5 |

Counts (*calculation* from the table): 60 items: 16 Found, 36 Decided, 7 Assumed, 1 N/A, 0 Missing.

## 5. Design outputs

The register lives in [`docs/prd/interview.md`](../prd/interview.md) → *Design outputs*. On 2026-10-25: DO-1
[`system-design.md`](system-design.md), DO-2 [`architecture.md`](architecture.md) and DO-6
[`observability.md`](observability.md) are `ready`; DO-5 and DO-7 were marked `ready` by their own session; DO-3 and
DO-4 are `planned`. `design_outputs.py check-obs docs/design/observability.md` exits 0.

## 6. Before the ticket-ready gate (not run yet)

The three judgement checks of `DESIGN-OUTPUTS.md` (*signature completeness*, *spec dry run*, *coverage requirements
sweep*) need DO-3 and DO-4, which are not written yet. One input is ready: every record DO-6 requires names a Postgres
table that has an owner in the architecture's data-authority table (DO-2 §3), so the *Storage* row of the signature
check can pass once DO-3 gives those tables their columns.

## Audit log

- 2026-10-25: first audit, at §6 (System track), verifying the interview's *Checklist coverage* rather than redoing the
  sweep. 16 Found, 36 Decided, 7 Assumed, 1 N/A, 0 Missing. All five foundation items decided (SD-3.1 and SD-3.4 by
  Innocent's own figures, PD-33; SD-7.2, SD-1.6, SD-1.9 by his recorded delegation). Five interview cells found stale
  after PD-33 (SD-3.1, SD-3.2, SD-3.4, SD-7.3, SD-8.3); this report's evidence supersedes them. Three non-foundation
  proposals adopted under PD-32 (SDQ-1…SDQ-3); three contract gaps handed to the System review (CG-1…CG-3). Verdict
  READY.
