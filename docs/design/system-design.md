# System design (DO-1) — Newsela Lesson Studio

**Owner of:** why this shape meets the promises within the limits: the eight steps of
`.claude/workflow/system-design-readiness/GUIDELINE.md` at the depth the readiness report set, and the decision sentence
for every major choice. **Written:** 2026-10-25 by Claude (System track, §6). **Status:** ready — Claude's
recommendation adopted under Innocent's standing authorization (PD-32); the five foundation answers are his (readiness
report [`system-design-readiness.md`](system-design-readiness.md) §2). **Depth:** light (PD-23), with steps 5 and 8 full
on the model path (SD-1.9).
**Read with:** [architecture](architecture.md) (DO-2: components, trust boundaries, model rungs),
[observability](observability.md) (DO-6), [capacity and workload](capacity-and-workload.md) (the load owner),
[hard-problem register](hard-problems.md) (HP-1…HP-10, SP-1…SP-3), the interface spec
[`docs/contracts/INTERFACE.md`](../contracts/INTERFACE.md) (every external promise; this file never restates a card),
the evaluation plan `docs/design/eval-plan.md` (DO-5, in progress) and the metrics registry
`docs/design/metrics-registry.md` (DO-7, in progress).

**Labels.** `[F]` a fact from an issued or external source · `[T]` a target we chose · `[A]` an assumption a
measurement will replace · `[C]` a calculation from the labelled inputs · `[M]` a measurement we took.
`[A] → SP-N` marks a value the running spike sets (SP-1, SP-2 and SP-3 are running now; their results go to
`docs/analysis/spikes/`). When a spike reports, its number replaces the `[A]` here and becomes `[M]`.

## What it looks like in practice

On Sunday evening an author confirms the issued Grade 6 Unit 4 outline and presses Generate. The web app writes one
`run` row and 47 `lesson_job` rows in one transaction and returns in well under a second. A separate worker process
claims up to 6 jobs at a time [A] → SP-1, makes one structured model call per lesson, checks the result in code, repairs
it at most once, and stores it. About 25 minutes later [C on A] the board shows 47 tiles, most `ready`, a few
`failed: <reason>` with a "retry failed" button. Meanwhile 140 reviewers [A] are editing other lessons through one
collaboration server; their work never waits behind generation, because the two kinds of load use different processes
and different limits.

The design in one line: **one Postgres holds every record, the queue, the Yjs documents and the traces; three Node
processes (web, worker, collaboration) do the work; the model fills typed slots in a pipeline we drew ourselves.**

---

## 1. Frame the problem (full)

- **Outcome.** Staff reviewers turn an uploaded unit outline into approved, standards-aligned ~50-minute lessons, with
  the least reviewer time per approved lesson (the north star, PD-1). Brief: "an interface for our review staff to
  review, edit/update … and then mark the content as approve/finalized" [F].
- **Hardest uncertainty (SD-1.9, interview Q-003):** "whether one structured call can produce a valid ~3,300-word
  teacher edition in Newsela's schema within a few minutes and under $1 per lesson". SP-1 answers it; if it fails, the
  pipeline becomes one call per section (HP-1 option B) and nothing else in this design changes shape.
- **Constraints.** Due Tue 2026-10-27 03:00 CT [F] (Q-001); all TypeScript, Postgres for everything (PD-11, PD-13);
  ProseMirror + Yjs [F, brief Technology]; $0 new hosting spend, the demo recorded under local Docker Compose (PD-15
  option D); **$75 model spend for the whole build** [T] (PD-29); traces never leave our Postgres (PD-19); no student
  data, nothing from the restricted folder (GR-9, GR-13).
- **Ruled out:** an autonomous agent (PD-3), bulk approve (PD-10), live publishing (PD-22), retrieval over the novel
  (PRD §7), replica or zone failover (SD-7.2).

## 2. Measurable promises (light)

Promises are per operation. Correctness rules are invariants: they hold every time or it is a bug.

| Operation | Correctness invariant (never) | Latency target | Recovery |
|---|---|---|---|
| Upload and validate an outline (CON-2, CON-3) | A re-upload changes a lesson; Generate runs while an intake error is unconfirmed (R-1, R-5) | not targeted; < 2 s for 200 rows [A] | stateless; retry the upload |
| Generate a unit (CON-5, CON-6) | A lesson stored twice; a finished call paid for again; a run past its cap (R-16 as amended) | p95 ≤ 5 min per lesson [T]; 47 days ≤ 2 h [T] (R-55); tile reflects a change ≤ 3 s [T] (R-17) | worker restart resumes at the next unfinished lesson (SD-7.2) |
| Review and co-edit (CON-11, CON-12, CON-13) | An acknowledged edit lost; content written by anything but the collaboration server (HP-4) | at the 200-user spike: lesson open p95 < 1.5 s, remote edit p95 < 500 ms, store → checks ≤ 5 s [T] (capacity doc; R-28); store transaction p95 ≤ 500 ms [T] [A] → SP-2 | socket reconnects ≤ 10 s; unsent edits held locally; RPO ≤ 2 s (R-26) |
| Approve or request changes (CON-18) | Approval of a version other than the one seen; approve with a blocking issue; more than one lesson per call (R-33, R-34) | ≤ 2 s including the blocking-check re-run [A] | refused calls change nothing (INTERFACE shared guarantee 2) |
| Export (CON-23) | An unapproved version exported; two exports of unchanged data differ (R-42) | not targeted | idempotent; re-run |

"Did it run" (operational success) and "was it right" (correctness) are kept apart: H-1…H-6 versus V-1…V-6 and G-3
(framing §3.4; DO-7). A green trace never counts as a correct lesson.

**Note on two timing tables.** PD-33 moved R-56/R-57 to the 200-user spike, and PRD §5.4 says the capacity doc's targets
win (remote edit p95 < 500 ms). The *Timing in one place* table in `INTERFACE.md` still shows R-56's 25-user figure
(< 300 ms). This file uses the capacity doc; the contract review reconciles the card (readiness report, contract gap
CG-2).

## 3. Workload model (light)

The load owner is [`capacity-and-workload.md`](capacity-and-workload.md). The two foundation figures are Innocent's:
**500 users per day, a spike of 200 concurrent users, no 200-day requirement** (PD-33, 2026-10-25). Everything below is
derived from them and labelled.

**Two kinds of load, never mixed.** Concurrent users cost web, database and socket capacity. Generation jobs cost money
and provider rate limit. 200 people online does not mean 200 generation jobs.

| Class | Volume | Source |
|---|---|---|
| Interactive HTTP at the spike | ≈ 40 requests/s: ~20 polls/s, ~9.3 heartbeats/s, ~6.7 page loads/s, ~2 actions/s | [C on A], capacity doc |
| Collaboration socket at the spike | ≤ 140 open sockets (70% of 200 in the workspace) [C on A]; ≈ 17.5 inbound updates/s; ≈ 5 durable stores/s | [C on A], capacity doc |
| Generation | 1 `UnitPlan` call + 47 lesson jobs per run (the issued sheet: 41 lessons + 6 flex days) [F]; 1 draft + ≤ 1 repair per lesson (R-19); ≤ 6 jobs in flight across ≤ 3 runs | [F] data README; [A] → SP-1 for the cap |
| Burst shape | 2-min ramp to 200, 15-min plateau, 2-min ramp down | [A], capacity doc |
| Background | the generation worker; checks after every store; nothing scheduled, no polling of external sources (SD-3.5) | [F] PRD R-16, R-28 |
| Data size | outline ≤ 200 rows [T]; published teacher edition median 3,306 words [M, framing §3.2]; one stored lesson tens of KB of JSON [A] → SP-1 | |

## 4. Logical flow (light): two traces

### 4.1 The traced request: a reviewer's edit becomes a refreshed issue list

*Input → process → output.* A reviewer deletes the only checking item for RL.6.6 in Lesson 4 → the edit reaches
co-editors, is stored, re-checked → the issue list shows "RL.6.6 has no checking item" as blocking within 5 s [T]
(R-28's acceptance criterion).

| # | Step | Who owns the record | Time budget |
|---|---|---|---|
| 1 | Keystroke → `y-prosemirror` → Yjs update over the lesson's socket (CON-12) | browser | ~20 ms local [A] |
| 2 | Collaboration server applies the update in memory and broadcasts it to co-editors | collaboration server (in-memory Y.Doc) | p95 < 500 ms at the spike [T] |
| 3 | Debounce, then one store transaction: Y.Doc bytes + derived `Lesson` JSON + SHA-256 + state vector in `lesson_doc`, and one coalesced `check_job` row, in one commit (HP-4) | collaboration server → Postgres | debounce ≤ 2 s [T] (R-26); transaction p95 ≤ 500 ms [T], [A] → SP-2 |
| 4 | `stored` acknowledgement to every client with `content_hash`, `state_vector`, `stored_at` (CON-12) | collaboration server | < 50 ms [A] |
| 5 | Worker claims the `check_job` (woken by `NOTIFY`, polling every 500 ms as backstop [A]), reads the stored derived row, runs the deterministic suite (R-19 as amended) | worker | claim ≤ 0.5 s [A]; checks ~50 ms per lesson [A] |
| 6 | Worker writes `issue` rows keyed to the checked hash, clears `pending` | worker → Postgres | < 50 ms [A] |
| 7 | The workspace re-fetches the issue list on each `stored` acknowledgement and while `pending` is true (CON-13, `getLessonIssues`) | web app | p95 < 300 ms [T] (capacity doc poll target) |
| | **Total, store-to-refresh worst case** | | 2 s + 0.5 s + 0.5 s + 0.05 s + 0.05 s + 0.3 s ≈ **3.4 s** [C on A] against **≤ 5 s** [T] |

The budget has ~1.6 s of headroom. The debounce is the largest term; if SP-2's store p95 comes in above 500 ms, the
headroom absorbs it up to about 2 s before R-28 fails.

### 4.2 The traced background job: one lesson generated

*Input → output:* row 8 (Lesson 4, Reading; focus `RL.6.1, RL.6.2, L.6.4.b`) → one stored `lesson_version` v1 with
provenance and cost, tile `ready` (or `failed: <reason>`).

| # | Step | Record written | Time budget |
|---|---|---|---|
| 1 | Claim the job: `SELECT … FOR UPDATE SKIP LOCKED`, set a lease (HP-7) | `lesson_job` | < 50 ms [A] |
| 2 | Reserve spend in one atomic update against three caps (run, user-day, build total) | `run`, `spend_reservation` | < 20 ms [A] |
| 3 | One structured `LessonDraft` call to the generation model (DIR-4 context: own row, arc, neighbours, `UnitPlan` lines, CDE text, template, 1–2 structure-only examples) | `model_call` (rendered prompt first, raw output saved the moment it arrives) | ~3 min [A] → SP-1; p95 ≤ 5 min [T]; per-call timeout [A] → SP-1 |
| 4 | Parse with Zod, compile to Newsela-shaped ProseMirror JSON, run the blocking checks | `issue` | < 2 s [A] |
| 5 | If a blocking check fails: one repair call on the cheaper model with the draft and the failing checks only | `model_call` | ~1 min [A] → SP-1 |
| 6 | Store v1: `INSERT … ON CONFLICT DO NOTHING` on the idempotency key (run, lesson, prompt version, schema version), the derived row and the Y.Doc seeded from it | `lesson_version`, `lesson_doc` | ≤ 500 ms [T] |
| 7 | Settle actual cost from usage fields, release the reservation's remainder, mark the job terminal | `spend_reservation`, `lesson_job` | < 20 ms [A] |
| | **Total** | | ≈ 3–4 min typical [C on A]; hard job wall-clock brake 10 min [T] (HP-1) |

Every step is retry-safe: a restart between 3 and 6 finds the raw output in `model_call` and skips the call (HP-7
mechanic 2).

## 5. Resource demand (light for interactive, full for the model path)

### 5.1 Interactive capacity at the 200-user spike

The question for each resource is the guideline's: *what is held, for how long, and how many can hold it at once?*
(Little's Law: average in progress = arrival rate × time each one is held.)

| Resource | Demand at the spike | Capacity | Headroom |
|---|---|---|---|
| Web CPU | 33.3 light requests/s × 5 ms [A] + 6.7 page loads/s × 50 ms SSR [A] ≈ **0.5 core** [C] | 1 Node process ≈ 1 core | ~2× |
| HTTP requests in flight | 40/s × 80 ms mean [A] ≈ **3.2** [C] | Node handles hundreds of concurrent awaits | large |
| Postgres connections busy (average) | polls 20 × 15 ms + heartbeats 9.3 × 5 ms + page loads 6.7 × 40 ms + actions 2 × 30 ms + stores 5 × 100 ms + check writes 5 × 20 ms + worker ≈ **1.3** [C on A]; ×3 for bursts ≈ 4 | pools: web 10, collaboration 5, worker 4 = 19 [T], under Postgres's default `max_connections` of 100 [F] | ~5× on the pools |
| Collaboration event loop (one Node process) | broadcasts ≈ 35 messages/s + stores 5/s × ~30 ms encode, derive and hash [A] ≈ **0.15–0.2 core** [C on A] | 1 event loop = 1 core, shared by all 140 sockets | ~5× **with checks moved out** (decision D-6) |
| Collaboration memory | ≤ 140 open Y.Docs × ~0.5 MB [A] ≈ **70 MB** [C] | container memory, no limit set locally | large |
| Worker CPU (checks) | 5 checks/s × ~50 ms [A] ≈ **0.25 core** [C]; generation compile and checks add < 0.01 core | 1 Node process ≈ 1 core | ~4× |

**Why checks left the collaboration process.** With checks inside the collaboration server, its one event loop would
carry broadcasts, stores *and* checks: 0.2 + 0.25 = 0.45 core at the assumed 50 ms per check, but 0.2 + 0.75 ≈ 0.95
core if checks take 150 ms [C on A]. At that point every co-editor's keystrokes queue behind check runs. That is the
"single shared resource held by slow work" failure the guideline warns about, so checks run in the worker (D-6).

### 5.2 Generation capacity (kept separate)

| Quantity | Value | Label |
|---|---|---|
| Jobs in flight | ≤ 6 across ≤ 3 runs, fair-share round robin by run, FIFO within a run; starts at 4 | [A] → SP-1 rate-limit headers (PD-13, HP-7) |
| One unit, alone | ⌈47 ÷ 6⌉ × ~3 min + ~2 min `UnitPlan` ≈ **26 min** | [C on A]; R-55 gate ≤ 2 h [T] |
| One unit while 3 runs share the cap | 2 slots each → 47 ÷ 2 × ~3 min ≈ **71 min** | [C on A]; at the 5-min p95 it becomes ≈ 118 min, right at the 2 h gate |
| Provider tokens per minute needed at 6 in flight | output ≈ 6 × 6,600 ÷ 3 min ≈ **13k OTPM**; input ≈ 6 × 12k ÷ 3 ≈ **24k ITPM**; ≈ 2 requests/min | [C on A]; checked against the tier's headers in SP-1 |

The three-run row is the first place a load figure presses on a target: three units generating at once meet the 2 h
gate only if the per-lesson p95 stays near 3 minutes. The scale path's step 4 (below) is the fix; no new decision is
needed now because the expected case is one run at a time.

### 5.3 Cost per lesson (the model path, full)

Prices from the claude-api reference (models table cached 2026-10-06, read 2026-10-25) [F]: the generation model at $2
input / $10 output per million tokens, the repair model at $0.10 / $0.50 (PD-12; final IDs and prices re-confirmed at
build).

| Item | Arithmetic | Value |
|---|---|---|
| Draft output tokens | 3,306 words [M] × ~1.33 tokens/word [A] × ~1.5 JSON overhead [A] | ≈ 6,600 tokens [C] |
| Draft input tokens | schema + locked prompt + DIR-4 context + 1–2 examples | ≈ 12,000 tokens [A] → SP-1 |
| One draft call | 12k × $2/M + 6.6k × $10/M | ≈ **$0.09** [C on A] |
| One repair call | ~20k × $0.10/M + 6.6k × $0.50/M | ≈ $0.005 [C on A] |
| `UnitPlan` call | ~15k in, ~8k out at generation prices | ≈ $0.11 [C on A] |
| One 47-lesson run | 47 × $0.09 + $0.11 + repairs on ~40% [A] | ≈ **$4.50** [C on A] |
| PRD planning figure | ~$0.50 per lesson (PRD §12) × 47 | ≈ $24 [C on A], kept as the conservative bound |

The price-sheet calculation is about five times below the PRD's planning figure. We keep the larger number for budgeting
until SP-1 measures the real one, because the input estimate and the JSON overhead are both guesses.

## 6. Overload and failure behaviour (light)

### 6.1 Per operation

| Operation | When demand exceeds capacity | When a dependency fails |
|---|---|---|
| Generation | **Queue.** Jobs wait in `queued`; the tile says "queued, n ahead". Nothing is rejected for load. A run stops only at its spend cap (`capped`), the user's day cap (`DAY_CAP_REACHED`), cancel, or the circuit breaker (`paused`) (HP-7) | Provider 429/529: honour `retry-after`, jitter, ≤ 3 attempts, never using the repair round. Truncation: one raised-cap retry, then `generation_failed: truncated`. Provider down: jobs fail as a normal partial state with "retry failed" (SD-2.5) |
| Review, edit, read | **Serve.** No shedding at 200 users [C]. If a pool is exhausted, a request waits up to 2 s for a connection, then gets a retryable 503 the client retries with backoff [A] (capacity doc; contract gap CG-1) | Model down: review, checks and approval keep working because checks are code; only AI assist (CON-17) returns `MODEL_UNAVAILABLE`. Collaboration server down: editor shows `DISCONNECTED`, board and approval reads continue |
| Approve | Serve; one lesson per call | Collaboration server down: Approve still works, because it reads the frozen snapshot, not the live document (HP-5) |

### 6.2 The failure the deployment must survive (SD-7.2)

Innocent's answer (interview Q-008, 2026-10-25): **a worker restart mid-run**. "The run resumes at the next unfinished
lesson, no lesson is stored twice, no completed call is paid for again, calls lost in flight are at most the
concurrency cap and are counted." No replica or zone failure is designed for.

How the design survives it (HP-7 option B):

1. **Lease expiry.** A restarted worker returns jobs whose lease lapsed to `queued`. On SIGTERM it stops claiming and
   lets in-flight calls finish.
2. **Raw-output checkpoint.** A job whose `model_call` already holds raw output compiles from it with no second call.
3. **Idempotent store.** A unique key on (run, lesson, prompt version, schema version) makes a second store a no-op.
4. **Bounded loss.** Calls in flight when the process dies are paid for and lost; there are at most 6 [A], and the run
   summary counts them (`calls_lost_in_flight`, CON-21).

Failures we do *not* design to survive, and what happens: losing Postgres loses the project (mitigated by one
`pg_dump` after the full run and before recording, PD-30); a collaboration restart drops sockets for ≤ 10 s with edits
held locally (capacity doc recovery criteria); a web restart is invisible beyond one failed request.

## 7. The smallest deployment that fits (light)

| Component | Count | Why it exists | Cost |
|---|---|---|---|
| `web` (Next.js: pages and the HTTP API) | 1 | every CON card except CON-12 | $0 local |
| `worker` (Node: generation and checks) | 1 | long jobs outlive requests (T-9); checks off the socket loop (D-6) | $0 local |
| `collab` (Node: one Hocuspocus server) | 1 | Yjs needs one long-lived process per document set (PD-9) | $0 local |
| `postgres` | 1 | records, queue, Yjs persistence, traces (PD-13, PD-19) | $0 local |
| Model spend | — | generation, repair, judge (if built), AI assist | ≤ $75 for the build [T] (PD-29) |

The recording runs under Docker Compose on the Mac (PD-15 option D). The `Dockerfile`s and a `render.yaml` describing
AD-15's shape (~$20/month [C], not provisioned) are committed, so a deploy is one approval away. The 200-user load test
runs on the VPS (8 cores, 31 GB [F]) with the model provider stubbed (capacity doc).

### 7.1 Spend (SD-1.6)

Innocent's answer (interview Q-002, PD-29, 2026-10-25): hosting **$0 new spend**; model spend **$75 total for the
build** [T], a hard ceiling, with SP-1 ≤ $5 and the per-run cap set after SP-1.

| Cap | Value | Enforced by |
|---|---|---|
| Build total | $75 [T] (PD-29) minus spend already settled | the same reservation update: refused when settled + reserved would pass it |
| Per run | measured cost per lesson × 47 × 1.5 (PD-14): ≈ $6.35 at the $0.09 calculation, ≈ $35 at the $0.50 planning figure, ≈ $71 at the $1 target [C] | [A] → SP-1 |
| Per user per day | 2 × the per-run cap [A] (R-54) | [A] → SP-1 |
| Per call (the reservation) | input estimate × input price + output cap × output price ≈ 12k × $2/M + 16k × $10/M ≈ **$0.18** [C on A]; output cap 16,000 tokens | [A] → SP-1 |

**Reserve-then-settle (PD-14, HP-7).** Before each call one atomic update reserves the call's maximum cost against all
three caps; if any would be passed, the call is refused and the run becomes `capped`. After the call the actual cost is
settled from the usage fields. With 6 calls in flight at most 6 × $0.18 ≈ $1.10 is reserved at once [C], and the
overshoot is zero by construction, which a check-before-call cap cannot promise (HP-7 reason 2).

**Budget plan for the $75** [C on A]: SP-1 ≤ $5; one full run ≤ $24 at the planning figure (≈ $4.50 at list prices); the
live 3-row demo and reruns ≤ $10; leaving ≥ $36 unallocated for re-runs after a prompt fix.

### 7.2 Scale path (each step's trigger)

From the capacity doc, with the measurement that fires each step:

1. **Now:** one `web`, one `worker`, one `collab`, Postgres.
2. Lesson open p95 > 1.5 s or web CPU > 70% at the spike → two `web` instances behind a proxy (stateless; sessions in
   Postgres).
3. Remote edit p95 > 500 ms or collaboration event-loop lag p95 > 100 ms → a second Hocuspocus process with
   Postgres or Redis pub/sub fan-out, documents sharded by lesson.
4. Generation queue wait > 15 min regularly, or three-run units passing the 2 h gate → raise the worker cap to the
   provider's measured limit, then several workers (the `SKIP LOCKED` claim already supports them).
5. Whole-program runs (180 lessons per grade) → the provider's batch API for the full-unit path (HP-7 option D,
   roadmap), keeping the interactive path for live demos and retries.

### 7.3 Bottleneck order, and what breaks first at the 200-user spike

Predicted [A], to be confirmed by the load script (step 8):

1. **The collaboration process's single event loop** carries every socket, broadcast and store. It is the only
   single-threaded resource every editing user shares, so it is the first to show latency (remote edit p95). Moving
   checks out (D-6) buys roughly 5× headroom [C on A]; step 3 of the scale path is the next fix.
2. **Postgres connections during store bursts.** The store transaction is the longest hold (p95 ≤ 500 ms), so a burst
   of simultaneous stores is where the collaboration pool of 5 [T] could queue. Average demand is ~1.3 busy connections
   [C on A].
3. **Next.js server rendering on lesson open** (≈ 0.33 core at the spike [C on A]); step 2 of the scale path.

On the generation side the order is: **provider rate limit**, then the **per-run spend cap**, then the **worker cap**.
None of them touches interactive latency, because generation runs in its own process and its own pool.

## 8. Validate and revise (light; full on the model path)

| What | How | Replaces |
|---|---|---|
| One call per lesson works (SD-1.9) | SP-1 on rows 8, 9, 25 with its pass line (hard-problems.md *Spikes*) | the HP-1 choice's assumption; the cost, time, token and rate-limit `[A]`s in §4.2, §5.2, §5.3, §7.1 |
| Approval stays pinned under live edits; store p95 | SP-2, 20/20 runs per assertion, store p95 ≤ 500 ms | the store `[A]` in §4.1 |
| Name-scan blocking scope | SP-3: every code-detectable plant caught, ≤ 1 false flag per clean lesson, else the name scan blocks only in checks | the scope in R-19 as amended |
| Worker restart survival (SD-7.2) | the HP-7 fault-injection script on a stubbed provider: kill, 429, truncation and cap tests (observability WF-28) | §6.2's claims |
| 200-user spike | load script (k6 or Node, chosen when built) on the VPS, the capacity doc's mix and burst shape, provider stubbed; reports p95s, error rate, event-loop lag, connection counts and store → checks time, each `[M]` with *n* and the machine | §5.1 and §7.3's `[A]`s |
| Generation time and cost | the full 47-lesson run report (R-51, R-55) | §5.2 and §5.3 |
| Correctness | the evaluation plan (DO-5) and the metrics registry (DO-7) | — |

**Redesign triggers:** SP-1 fails → per-section calls (HP-1 B), and the cut order drops #1–#5 if the Sunday 14:00
tripwire is missed (PRD §6.4). Store → checks p95 > 3 s → move checks to a worker thread pool or raise the worker count.
Collaboration event-loop lag p95 > 100 ms at the spike → scale step 3. H-2 above its gate → raise the cap if the rate
limit allows. Any spike result that contradicts an assumption reopens its PD row (PRD §10).

---

## Decisions (each completes the decision sentence)

**D-1 · Fixed pipeline, one structured call per lesson (HP-1 A, PD-3, PD-4).** Because the workflow is known in advance
and every check needs typed blocks (R-19), we chose a fixed skeleton in which the model fills only the `UnitPlan`, one
`LessonDraft` per lesson and at most one repair, at the cost of a truncation risk on the largest lessons and a
per-section fallback we may have to build. It should give ≥ 90% schema-valid first passes [T] at ≤ $1 per lesson [T].
We will verify it with SP-1 and the full-run report, and revisit it when SP-1 misses its pass line.

**D-2 · Postgres for everything, including the queue (HP-7 B, PD-13, PD-19).** Because the board, the run summary and
the queue must agree on one job's state and the demo has one operator, we chose one `lesson_job` table claimed with
`SKIP LOCKED` and a lease, at the cost of ~100 lines of queue code we own and no built-in dashboard. It should give zero
duplicate lesson versions and zero re-paid calls across a restart. We will verify it with the kill test, and revisit it
when several workers or multi-unit runs need a real job system.

**D-3 · A separate worker process (R-16, T-9).** Because a 47-lesson run outlives any HTTP request and must survive a
restart, we chose a long-running worker apart from the web app, at the cost of a third process to run and observe. It
should give interactive latency unaffected by generation. We will verify it with the load script running during a
stubbed generation run, and revisit it never for this build.

**D-4 · One Hocuspocus process (PD-9).** Because 200 concurrent users means at most ~140 open sockets [C on A] and one
process holds that with ~5× headroom, we chose one authenticated collaboration server persisted to our Postgres, at the
cost of a single point of failure for live editing (≤ 10 s reconnect). It should keep remote edit p95 < 500 ms at the
spike [T]. We will verify it with the load script's socket clients, and revisit it when scale step 3's trigger fires.

**D-5 · The Y.Doc is master; every store writes the derived JSON too (HP-4 A, PD-7).** Because checks, approval and
export must read exactly what reviewers see, we chose one transaction per store writing the Y.Doc bytes, the derived
`Lesson` JSON, its hash and the state vector, at the cost of a slower store (p95 ≤ 500 ms [T]). It should give zero
drift between what is edited and what is approved. We will verify it with SP-2's round-trip and pinning runs, and
revisit it when SP-2's store p95 exceeds the budget.

**D-6 · Checks run in the worker, from a coalesced `check_job` (Proposal, adopted under PD-32).** Because checks must
refresh within 5 s of every store (R-28) and the single collaboration event loop also carries every co-editor's
keystrokes, we chose to write one `check_job` row per lesson inside the store transaction and let the worker run the
checks, at the cost of one more small queue table and up to ~0.5 s of claim latency [A]. It should keep collaboration
event-loop lag p95 < 50 ms [T] and store → checks ≤ 5 s [T] at the spike. We will verify it with the load script, and
revisit it when store → checks p95 passes 3 s or worker CPU passes 70%. *If Innocent prefers checks inside the
collaboration server, CON-13's `pending` flag comes from in-memory state instead and the event-loop budget in §5.1 loses
its headroom.* This also answers CON-13's System question ("whether checks run in the worker or the collaboration
server"; "the `pending` flag's source"): `pending` is true while a `check_job` exists for a hash newer than
`checked_hash`.

**D-7 · Progress by polling every 2 s (PD-18).** Because half-formed JSON helps nobody and 40 polling users cost ~20
requests/s [C], we chose polling over streaming, at the cost of up to 2 s of staleness. It should give a tile change
within 3 s [T]. We will verify it with a timed run on the board, and revisit it when polling passes half the web CPU.

**D-8 · Reserve-then-settle against three caps (PD-14, PD-29, HP-7).** Because the build has a $75 hard ceiling and a
check-before-call cap overshoots by up to 6 calls under concurrency, we chose an atomic reservation of each call's
maximum cost against the run, user-day and build caps, at the cost of refusing some calls that would have fit. It should
give zero overshoot. We will verify it with the cap test (cap = 3 lessons' cost), and revisit it when SP-1's measured
cost makes the reservation's output cap too pessimistic.

**D-9 · Local Docker Compose for the recording (PD-15 D).** Because the brief asks for source, documentation and a video,
not a URL [F], and a new Render service would pass Innocent's $40/month cap, we chose to record locally with the deploy
configuration committed, at the cost of nothing public to click. It should give a $0 hosting line. We will verify it by
running the full demo under Compose, and revisit it when Innocent approves the spend or AQ-17 says a URL is expected.

**D-10 · Survive a worker restart, nothing more (SD-7.2).** Because Innocent named a worker restart mid-run as the
failure to survive and the demo has one operator, we chose lease, checkpoint and idempotent-store mechanics without
replicas, at the cost of losing the project if Postgres is lost (one `pg_dump` mitigates it, PD-30). It should give 47/47
terminal lessons and 0 duplicates after a kill [T]. We will verify it with the kill test, and revisit it when the system
serves real staff.

## Values the running spikes set

| Value | Now | Set by |
|---|---|---|
| Per-call model timeout | ~2× the measured p95, inside the 10-min job brake [A] | [A] → SP-1 |
| Concurrency cap (jobs in flight) | starts at 4, ≤ 6 [A] | [A] → SP-1 (rate-limit headers) |
| Output cap per draft call | 16,000 tokens [A] | [A] → SP-1 (zero truncations at the chosen cap) |
| Cost per lesson; per-run spend cap | $0.09 calculated, $0.50 planning [A]; cap = measured × 47 × 1.5 | [A] → SP-1 |
| Per-user day cap | 2 × per-run cap [A] | [A] → SP-1 |
| Name-scan blocking scope | blocking in checks; elsewhere per result [A] | [A] → SP-3 |
| Store transaction p95 | ≤ 500 ms target [T]; actual unknown | [A] → SP-2 |
