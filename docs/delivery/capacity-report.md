# Capacity report: 200-user spike (NL-127)

Written 2026-10-26 from `evals/reports/load-2026-10-26.md` (the probe's own output plus the run record). Every number below
is **[M] measured** with its *n*, on the VPS (8 cores, 31 GB, linux), the committed Compose stack (web, collab, worker,
Postgres 16), and the **model provider stubbed** (no key, no real model call: `grep -c api.anthropic.com` = 0, real-provider
`model_call` rows = 0). Targets come from `docs/design/capacity-and-workload.md` (PD-33: 500 users a day, a 200-user spike).
Nothing was tuned during the run; a miss is reported as a miss.

## What was run

200 virtual HTTP users in the capacity mix (70% in a lesson with a heartbeat, 20% on polling screens, 10% authors and
approvers) plus 140 Yjs socket editors, one load: 2-minute ramp, 15-minute plateau, 2-minute ramp down, about 19 minutes
wall clock. Command: `npm run load:spike -- --users 200 --ramp-s 120 --plateau-s 900 --ramp-down-s 120 --socket-editors 140 ...`.
Rows read back with `psql`: `probe_run` `pr_01M5VD8MK0FYZW3E26YSKVTP4E` (http) and `pr_01M5VE7XWE796CFYZ7S22YE9GF` (yjs).

## Results against the targets

| Metric | Target | [M] Measured (n) | Result |
|---|---|---|---|
| M-18 Lesson open p95 | < 1.5 s | 23 ms (n = 4,902) | met |
| M-20 Unit board p95 | < 1 s | 20 ms (n = 20,402) | met |
| M-21 Board and progress poll p95 | < 300 ms | 20 ms, board only (n = 20,402) | met (progress poll not exercised, see Qualifiers) |
| M-22 Error rate | < 0.5% | 0.00% of 38,909 HTTP; 0 socket errors in 22,533 Yjs samples | met |
| M-23 Recovery after the plateau | <= 120 s | 100 s | met (see Qualifiers) |
| M-19 Remote-edit p95 (collaboration latency) | < 500 ms | 6.7 ms (n = 44,612) | met |
| M-27 Lost acknowledged updates | 0 | 0 lost, 0 duplicate tokens, 0 unacknowledged after drain (n = 22,533) | met |
| M-24 Socket reconnect p95 | <= 10 s | 9.95 s | met by 0.05 s |
| **Stored p95** (US-36 / M-19's durable-store half) | **< 3 s** | **6,008 ms (n = 22,533)** | **MISSED** |
| Max DB connections | informational | 21 | n/a |

## Misses

- **Stored p95, 6.0 s against < 3 s** (the run record labelled it M-24; M-24 is reconnect time, met at 9.95 s; stored p95 belongs to
  US-36 / M-19). Not tuned in the run. The scale path has no step keyed to store latency; step 3 (a second Hocuspocus process) is
  triggered by socket lag, and remote-edit lag was 6.7 ms, so it did not fire. **Diagnosis since the run**
  (`docs/devlog/2026-10-26-nl127-followup.md`): outage contamination explains about 0 ms (about 15 of 22,533 stored samples crossed
  a drop); the shipped `STORE_MAX_DEBOUNCE_MS=4000` with typers sending every 2 s puts p95 near 3.8 s plus store time, which is
  above the 3 s target by construction. The residual after the debounce is **not measured**. The decision (lower the store
  debounce and max debounce, or relax the target) and a quiet-machine re-run are open.

## Qualifiers (these make the passes weaker than they look)

1. **Synthetic unit.** NL-112 (the real-key full-unit run) has not run. The HTTP half read a padded 40-lesson unit (about
   3,300 words each); the Yjs half used small fixture lessons. Both make the numbers optimistic against real content.
2. **No generation load.** The stub run's first job (`unit_plan`) failed (`error_kind: unexpected`) and the run stayed in
   `planning`, so the worker was idle and the progress poll was not exercised (the board was polled instead).
3. **Recovery reading.** The 100 s is computed from windows that overlap the ramp down; the 5 extra minutes of sampling the
   ticket asks for were not added.
4. **Check failures.** 1,310 `check.failed` lines on the Yjs load lessons were `no_outline_version`: the load unit had no outline, so
   every check failed and was retried every 30 s. Fixed in the load fixture afterwards (NL-127 follow-up F-B); the run itself still carried them.
5. **Contention.** Another agent used the machine during the run (load average about 8 at the start); not a quiet-machine figure.
6. **Scope.** A single instance on a VPS, not production hosting. Render (PD-37) sizes differ: Starter instances are
   0.5 CPU / 512 MB, so these figures do not transfer; nothing here was measured on Render.

## What this supports

For the demo and the defence: lesson open, the board and polling stay far inside their budgets at 200 users on the demo
stack with a stubbed provider, with zero lost acknowledged edits. It does **not** show the 3 s store target is met, a
generation run under load, or real-content sizes. Re-run after NL-112 and after the store path is diagnosed.

## Re-run after PD-38

Run 2026-10-26 09:38 to 09:57 UTC on main `c46f4ef` (PD-38: store debounce defaults 1 s, ceiling 2 s; were 2 s / 4 s). Same command and load as the first run (200 users, 2/15/2 min, 140 socket editors, stub provider, no provider key, no real model call). Nothing was tuned. Record: `evals/reports/load-2026-10-26-rerun.md`; rows `pr_01M5VS62RT0YMN6X40Q26YGCRA` (http) and `pr_01M5VT5EA2SA8WTZAERR8GBADH` (yjs). All values below are **[M] measured** with *n*.

**This was a native run, not Compose** (no image builds, disk): `next build` + `next start`, `tsx` collab and worker, on a throwaway database `ls_nl127b` in the shared test Postgres container (the first run had a dedicated Compose Postgres). The HTTP unit `G6.U1` was recreated (40 lessons, about 3,200 words each, now with outline rows); the Yjs load unit now has an outline per follow-up F-B. **Contention was heavy and worse than the first run:** load average 13.2 before the run started, 26.8 to 27.9 during the plateau (first run: about 8), from other agents' orphaned `next-server` processes, `dockerd` and a ClickHouse container. Not a quiet-machine figure.

### Before and after

| Metric | Target | First run (NL-127) | Re-run after PD-38 | Result now |
|---|---|---|---|---|
| **Stored p95** | < 3 s | 6,008 ms (n = 22,533, all samples) | **1,124 ms** (n = 22,517 clean; p50 1,063 ms) | **met** |
| Stored p95 across a socket drop | reported separately | 15 samples, not split | 3,094 ms (n = 3) | informational |
| Remote-edit p95 | < 500 ms | 6.7 ms (n = 44,612) | 6.8 ms (n = 44,588) | met |
| Lost acknowledged updates | 0 | 0 | 0 (0 duplicate tokens, 0 unacknowledged) | met |
| Socket reconnect p95 (M-24) | <= 10 s | 9.95 s | 8.39 s | met |
| Lesson open p95 (M-18) | < 1.5 s | 23 ms (n = 4,902) | **7,188 ms** (n = 4,902 requests incl. 337 busy) | **MISSED** |
| Board and poll p95 (M-20, M-21) | < 1 s, < 300 ms | 20 ms (n = 20,402) | **4,032 ms** (board only) | **MISSED** |
| Heartbeat p95 (informational, CON-20 < 200 ms) | < 200 ms | 27 ms | 7,232 ms | missed |
| Page load p95 | informational | 21 ms | 44 ms (n = 2,036) | n/a |
| Error rate (M-22) | < 0.5% | 0.00% of 38,909 | **4.33%** of 38,909 (1,684 `SERVICE_BUSY` 503s) | **MISSED** |
| Recovery after the plateau (M-23) | <= 120 s | 100 s | not recovered | **MISSED** |
| Max DB connections | informational | 21 | 20 | n/a |
| Load-script event-loop lag p95 | informational | 12.1 ms | 14.6 ms | n/a |
| Yjs socket errors | 0 | 0 | 0 of 22,520 | met |
| `check.failed` lines | 0 expected | 1,310 | **0** (worker and collab logs); `check.done` 3,327 | met |

### Stored-wait split (from `collab.stored` logs, n = 22,520)

| Part | p50 | p95 |
|---|---|---|
| Debounce wait (`store_wait_ms`) | 1,002 ms | 1,007 ms |
| Database write (`db_write_ms`) | 58 ms | 117 ms |
| Wait + write | n/a | 1,121 ms |

The stored p95 is now almost entirely the 1 s debounce; the database write is about 0.1 s even under this load. The first run's 6 s was the 4 s ceiling plus the cycle (GEN-4 smoke: wait p95 5,999 ms, db p95 65 ms). The 3 s stored target is met with about 1.9 s of headroom; the lower debounce roughly sets the floor (about 1 s) and there is no longer a gap between the wait and the target.

### Misses, stated plainly

- **The HTTP half missed four targets in this run** (lesson open 7.2 s, board and poll 4.0 s, error rate 4.33%, recovery), where the first run met all of them by a wide margin. 1,684 of the 38,909 requests were `SERVICE_BUSY` (the 2 s database pool wait ran out): board 716, heartbeat 551, lesson open 337, act read 62, act write 18.
- **I did not diagnose this and did not tune anything.** The run differs from the first in three ways that are not separated here: much heavier machine contention (load average 27 against 8), a database that is a shared container with other agents' test traffic and Docker's port proxy (dockerd was at 100% CPU) rather than a dedicated one, and a native `next start` web process rather than the Compose image. PD-38 changes only the collab store debounce, so it does not obviously explain the HTTP numbers, but this run cannot rule out an effect (the lower debounce raises the store write rate against the same database). A quiet-machine re-run, ideally on the Compose stack, is needed before these HTTP numbers are read as a capacity result in either direction.
- Qualifiers 1, 2 and 6 of the first report still apply (synthetic padded unit, no generation load, single instance not Render). Qualifier 4 (check failures) is closed by this run: 0 `check.failed`.

## A/B check

Run 2026-10-26 10:01 to 10:18 UTC. Question: is the HTTP slowdown in "Re-run after PD-38" (lesson open p95 7,188 ms, board 4,032 ms, 4.33% `SERVICE_BUSY`) a code regression between `1d9e78d` (first NL-127 run) and main, or contention/setup? All values are **[M] measured**; each run is one run (n = 1 per cell), 5,843 requests per run.

**Setup (identical for both builds).** Native `next build` + `next start` from a git worktree per build, stub provider, no provider key, no Yjs sockets (`--socket-editors` off), random port, a throwaway migrated database in the shared test Postgres at 127.0.0.1:55440 (owner role, not the `ls_app` role of the re-run), dropped after each run. Seed: unit `G6.U1`, 40 lessons from the WP-1 fixture padded to about 24 KB of lesson JSON each (about 3,000+ words), outline rows, demo accounts; the same seed script for both builds. Command: `npm run load:spike -- --users 200 --ramp-s 30 --plateau-s 120 --ramp-down-s 30`. Build A = `1d9e78d`; build B = main `52b6902` (contains GEN-2 to GEN-6, PD-38 and NL-103/104/117, so it covers every candidate named in the question).

| Run | Build | Machine state at load start (`uptime`, 1/5/15 min) | Lesson open p95 | Board p95 | Heartbeat p95 | Busy 503s | Error rate |
|---|---|---|---|---|---|---|---|
| A1 | `1d9e78d` | load 5.11, 11.10, 15.76 (falling) | 13 ms | 9 ms | 15 ms | 0 | 0.00% |
| B1 | `52b6902` | load 5.60, 8.38, 13.84 | 13 ms | 8 ms | 15 ms | 0 | 0.00% |
| B2c | `52b6902` | load 16.54, 9.17, 12.76 (20 busy-loop processes of mine added; 32.6 at the end) | 168 ms | 84 ms | 164 ms | 0 | 0.00% |
| A2c | `1d9e78d` | load 33.04, 21.32, 16.91 (same 20 busy loops) | 168 ms | 84 ms | 154 ms | 0 | 0.00% |

A first A run used an unpadded 3 KB lesson by mistake (lesson open 14 ms, board 10 ms, 0 errors); it is discarded as not comparable, not part of the table.

### What was established

- On the same machine state, main is **not slower** than `1d9e78d` on the HTTP half: 13 ms against 13 ms (lesson open), 8 against 9 ms (board), at load about 5; 168 ms against 168 ms and 84 ms against 84 ms with the machine pushed to load 33. The A/B/A third leg was not run because A and B did not differ. No bisect was needed.
- Heavy CPU contention alone (load 33, more than the re-run's 27) raised latency about 13 times but **did not produce 503s or seconds-long p95s** for either build.

### What was not established

- The re-run's 7.2 s / 4.0 s / 4.33% was **not reproduced**, so its cause is not identified. It is not explained by code merged between `1d9e78d` and main on the lesson read, board or heartbeat path. Differences from the re-run that this check did not test: the 140 Yjs socket editors writing to the same database at the same time, the 900 s plateau (this check used 120 s), the non-owner `ls_app` role, the heavy `dockerd` and ClickHouse load that sat on the same Postgres container path, and the count of orphaned `next-server` processes. Of these, database-side slowness behind the container (the `SERVICE_BUSY` is a 2 s pool wait) is the likeliest but is a hypothesis.
- Each cell is one run (n = 1); differences of a few milliseconds are noise. Machine load was not held equal across the quiet pair (A1 5.1 against B1 5.6 at start); in the contended pair it was 16.5 (rising to 32.6) against 33.0.
- Not tested: the socket half, or the capacity target at the original 15-minute plateau. A quiet-machine full re-run (with sockets and the `ls_app` role) is still what settles the headline HTTP numbers.
