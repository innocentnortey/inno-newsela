# Capacity and workload — Newsela Lesson Studio

**Owner of:** the load the system is built for, the workload assumptions behind it, the performance targets, burst
behaviour, queueing and recovery criteria. Feeds §6 DO-1 (system design) and the capacity validation at §8–§10.
**Written:** 2026-10-25. **Status:** the two capacity figures are **Innocent's decision**; everything else here is
**Claude's recommendation adopted under Innocent's standing authorization** (PD-32), marked `[A]` assumption, `[T]`
target or `[C]` calculation. A measurement replaces each `[A]` when it exists; measured numbers are labelled `[M]`.

## The decision (Innocent, 2026-10-25)

> "Capacity: **500 users per day, with a spike of 200 concurrent users**. There is **no 200-day requirement**."

It **supersedes** the earlier answers to SD-3.1 and SD-3.4 (interview Q-006 "25 concurrent editor sessions, one unit at a
time" and Q-007 "up to 6 generation jobs while 25 editor sessions are active"), and the 25-user figures in R-56 and R-57.
"No 200-day requirement" means: no sustained multi-month throughput or retention target is set; the system is sized for a
day's load and a spike.

## Two different kinds of load (never mixed)

**Concurrent users** are people with the app open at the same moment: reading, editing, triaging, approving. They cost
web, database and collaboration-socket capacity, which is cheap and scales with ordinary servers.

**Simultaneous generation jobs** are lessons being written by the model at the same moment. Each costs real money and
minutes, and is limited by the provider's rate limit and the spend caps, not by how many people are online. 200 users at
once does **not** mean 200 generation jobs at once.

| | Concurrent users | Generation jobs |
|---|---|---|
| Peak | **200** (decided) | **≤ 6 lesson jobs in flight** [A] (PD-13 cap, set from SP-1's rate-limit headers), across **≤ 3 active runs** [A] |
| Bottleneck | web process, Postgres connections, the Hocuspocus socket | provider rate limit, spend caps (PD-14, PD-29), worker concurrency |
| When demand exceeds it | more instances (scale path below) | jobs **queue**; nothing is rejected except at a spend cap |

## Workload assumptions at the 200-user spike

| Who (share of 200) [A] | Doing what | Traffic per user [A] | Total at spike [C] |
|---|---|---|---|
| Reviewers in the lesson workspace (140, 70%) | reading and editing a lesson | 1 heartbeat / 15 s (CON-20); Yjs updates when typing (~1 / 2 s while typing, 25% typing at any moment); checks refresh after each store | ~9.3 heartbeats/s; ~17.5 socket updates/s; ~5 stores/s |
| Users on polling screens (40, 20%) | unit board, run progress | 1 poll / 2 s (PD-18) | ~20 polls/s |
| Authors and approvers acting (20, 10%) | intake, start runs, approve, export | ~1 request / 10 s | ~2 requests/s |
| Everyone | page loads and navigation | ~1 page load / 30 s | ~6.7 loads/s |

**Peak HTTP ≈ 40 requests/s plus ≈ 18 socket messages/s** [C on A]. **Burst shape:** a 2-minute ramp to 200, a
**15-minute plateau**, a 2-minute ramp down [A]. **Daily volume:** 500 distinct users, about 4 active hours each spread
over the working day; peak hour ≈ 200 concurrent [A].

## Performance targets [T]

| Measure | Target at the 200-user spike | Source |
|---|---|---|
| Lesson open (editor ready with content), p95 | < 1.5 s | R-57 (now at 200 users, was 25) |
| Board / progress poll, p95 | < 300 ms | new |
| Remote edit visible to a co-editor, p95 | < 500 ms | R-56 (now at 200 users, was 25) |
| Store → checks refreshed | ≤ 5 s | R-28 |
| Error rate (5xx and socket drops) during the plateau | < 0.5% | new |
| Generation, per lesson, p95 | ≤ 5 min from start (not counting queue wait) | R-55 |
| Queue wait shown to the author | always: "queued, n ahead" | new (FLOW-4) |

## Queue behaviour

- Generation jobs run in the separate worker (HP-7). Interactive requests are **never** queued behind generation.
- Jobs beyond the concurrency cap wait in `queued`, in fair-share order across runs (round robin by run, FIFO inside a
  run) [A], so one big run cannot starve a small one.
- No rejection for load. A run stops only at its spend cap (`capped`), a user's day cap (`DAY_CAP_REACHED`), cancel, or the
  circuit breaker (`paused`) (HP-7, R-16).
- At the web tier, if Postgres connections run out, requests wait up to 2 s for a connection, then return a retryable
  503 that the client retries with backoff [A].

## Recovery criteria

- After the plateau ends, p95 latencies return to the pre-spike level within **2 minutes** [T].
- A worker restart mid-run resumes at the next unfinished lesson; nothing is stored twice, no finished call is paid for
  again (SD-7.2, R-16 as amended).
- A dropped collaboration socket reconnects within **10 s** and restores presence; unsent edits are held locally and
  Submit stays off until stored (UXP-7).
- No acknowledged edit is lost (RPO ≤ 2 s for edits in flight, R-26).

## Scale path (each step's trigger)

1. One web instance, one worker, one Hocuspocus process, Postgres (the demo; PD-15 option D, local Docker Compose).
2. Trigger: p95 lesson open > 1.5 s or CPU > 70% at the spike → two web instances behind a proxy.
3. Trigger: socket messages lag > 500 ms → a second Hocuspocus process with Redis or Postgres pub/sub fan-out.
4. Trigger: generation queue wait > 15 min regularly → raise the worker cap to the provider limit, then several workers.
5. Whole-program runs → the provider's batch API (HP-7 option D, roadmap).

## How capacity is validated (§8–§10)

- A load script (k6 or a Node script, chosen at §6) runs the mix above for the burst shape against the full stack on the
  **VPS** (8 cores, 31 GB; not production hosting), with the **model provider stubbed** (simulated dependency) so the
  run costs no model spend. Results are reported as `[M]` with *n*, the machine and the stub stated.
- Generation timing comes from the real full-unit run (R-51) and SP-1, not from the load test.
- Any target missed is reported as missed, with the scale-path step that would fix it.
