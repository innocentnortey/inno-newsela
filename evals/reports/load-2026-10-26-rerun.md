# HTTP load probe 2026-10-26 (re-run after PD-38; probe output below; only this title line edited)

Results are [M] measured: n = 38909 requests, on 8 cores, 31 GB RAM, linux, model provider stub.

| Field | Value |
|---|---|
| Git SHA | c46f4ef262b2-dirty |
| Probe run | pr_01M5VS62RT0YMN6X40Q26YGCRA |
| Machine | 8 cores, 31 GB RAM, linux |
| Provider | stub |
| n (requests) | 38909 |
| Virtual users | 200 |
| Duration | 1137 s |
| Max DB connections | 20 |
| Load-script event-loop lag p95 | 14.6 ms |
| Heartbeat p95 (informational, CON-20 < 200 ms) | 7232 ms |
| Page load p95 | 44 ms |
| Busy (SERVICE_BUSY) responses | 1684 |
| Client errors (4xx, excluded) | 0 |

## Targets

| Target | Goal | Measured | Result |
|---|---|---|---|
| Lesson open p95 | < 1500 ms | 7188 ms | MISSED |
| Poll p95 (board and progress) | < 300 ms | 4032 ms (board 4032 ms) | MISSED |
| Error rate | < 0.5% | 4.33% | MISSED |
| Recovery after the plateau | <= 120 s to the pre-spike p95 | not recovered | MISSED |

## Missed targets and the scale path

- Lesson open p95: Scale path step 2: Trigger: p95 lesson open > 1.5 s or CPU > 70% at the spike → two web instances behind a proxy.
- Poll p95 (board and progress): Scale path step 2: Trigger: p95 lesson open > 1.5 s or CPU > 70% at the spike → two web instances behind a proxy.
- Error rate: Scale path step 2: Trigger: p95 lesson open > 1.5 s or CPU > 70% at the spike → two web instances behind a proxy.
- Recovery after the plateau: Scale path step 2: Trigger: p95 lesson open > 1.5 s or CPU > 70% at the spike → two web instances behind a proxy.
- Busy responses mean the database pool wait (2 s) ran out; the fix is the same: scale path step 2.

## Notes

- Server-side event-loop lag is not measured by this probe.
- The 3 sign-ins are shared by role (author, reviewer, approver); heartbeats from many virtual reviewers share one user id with distinct tab ids.
- The only write class is the approver heartbeat, stored as synthetic data and excluded from review minutes.
- Latency counts successful responses only; 5xx, SERVICE_BUSY and socket errors are errors, never slow successes.
- 140 socket editors requested; their Yjs figures are in the separate kind=yjs probe_run row (NL-119), not in this report.
- progress poll skipped: no run (board polled instead)

---

# Re-run after PD-38: run record (native stack, not Compose)

Run by the lane::direct capacity re-run task. Nothing was tuned; the code under test is main `c46f4ef` (PD-38: store debounce defaults 1 s with a 2 s ceiling, were 2 s / 4 s; no `STORE_*` env var set). The probe prints `-dirty`: other agents' untracked plan files were in the tree; no tracked file was modified.

## Header

| Field | Value |
|---|---|
| Date and start | 2026-10-26, started 09:38:06 UTC, probe wall clock about 19 min (ramp 120 s + plateau 900 s + ramp down 120 s; HTTP half 1,137 s, Yjs half 1,026 s) |
| Stack | **Native, not Compose** (no image builds: about 6 GB disk free). `next build` + `next start -p` for `apps/web` (note: `next start` with `output: standalone` prints a warning and works), `tsx apps/collab/src/main.ts`, `tsx apps/worker/src/main.ts`, all on loopback random ports (web 53905, collab 60053); `MODEL_PROVIDER_MODE=stub`, no provider key in the environment (`env | grep -c -E "ANTHROPIC|OPENROUTER"` = 0) |
| Database | throwaway database `ls_nl127b` on the shared test Postgres 16 container at 127.0.0.1:55440 (a container shared with other agents, reached through Docker's port proxy; the first run had its own dedicated Compose Postgres). Migrated and seeded with `npm run db:migrate`, `apply-runtime-grants.mjs` and `npm run db:seed`; web, collab and worker used the non-owner role `ls_app`. Dropped at the end; no other database touched |
| Seed data | HTTP half: recreated synthetic unit `G6.U1`, 40 lessons from the committed WP-1 fixture padded with repeated filler to about 3,200 words each, plus a `G6.U1` outline version and outline rows (so checks can run); throwaway script, not committed. Yjs half: the load unit `G6.U9` with 47 small fixture lessons and, per NL-127 follow-up F-B, an outline version and one outline row per lesson |
| Machine | 8 cores, 31 GB RAM, linux |
| Contention | **Heavy; worse than the first run.** Load average at start 13.23 (1 min) / 13.25 (5 min) before this run started anything; first run was about 8. During the run the 1-minute load average rose to 26.8 (09:44) and peaked at 27.9 (09:52); it was 16.6 at 09:57. Sampled once a minute, below. Sources seen in `top`: four orphaned `next-server` processes (cwd in deleted worktrees `newsela-NL-90`, `NL-110`, `NL-73`, `GEN-3`; two near 94% CPU each), `dockerd` at 100%, a ClickHouse container at 88%, several `evals/src/suites/s6-child.ts` workers. None were mine; none were touched |
| Command | `npm run load:spike -- --users 200 --ramp-s 120 --plateau-s 900 --ramp-down-s 120 --socket-editors 140 --collab-url ws://127.0.0.1:60053 --base-url http://localhost:53905 --unit G6.U1 --out-dir <tmp>` (same flags as the first run; only the URLs, the database and the output folder differ) |
| Rows | `probe_run` `pr_01M5VS62RT0YMN6X40Q26YGCRA` (kind http) and `pr_01M5VT5EA2SA8WTZAERR8GBADH` (kind yjs), read back with a SQL query before the database was dropped |

Load average (1 / 5 / 15 min), once a minute:

| Time (UTC) | Load average |
|---|---|
| 09:39:06 | 13.32, 13.31, 13.11 |
| 09:40:06 | 15.89, 13.94, 13.33 |
| 09:41:06 | 18.82, 15.11, 13.77 |
| 09:42:06 | 20.80, 16.42, 14.31 |
| 09:43:06 | 22.57, 17.76, 14.91 |
| 09:44:06 | 26.77, 19.85, 15.81 |
| 09:45:06 | 25.51, 20.88, 16.42 |
| 09:46:07 | 24.93, 21.58, 16.95 |
| 09:47:07 | 23.57, 21.89, 17.35 |
| 09:48:07 | 24.05, 22.28, 17.77 |
| 09:49:07 | 22.37, 22.14, 18.00 |
| 09:50:07 | 23.76, 22.66, 18.45 |
| 09:51:07 | 27.16, 23.87, 19.13 |
| 09:52:07 | 27.92, 24.84, 19.77 |
| 09:53:07 | 27.50, 25.13, 20.18 |
| 09:54:07 | 25.18, 24.94, 20.43 |
| 09:55:07 | 22.07, 24.10, 20.42 |
| 09:56:07 | 19.69, 23.19, 20.35 |
| 09:57:07 | 16.64, 21.62, 19.98 |

## Yjs half (separate probe_run row, kind=yjs)

editors 140, lessons 47, duration 1,026 s, `incomplete: false`, socket errors 0.

| Metric | Value (n) |
|---|---|
| Stored p95, clean samples | **1,124 ms** (n = 22,517); p50 1,063 ms |
| Stored p95 across a socket drop (reported separately) | 3,094 ms (n = 3) |
| Remote-edit p95, clean | 6.8 ms (n = 44,588) |
| Remote-edit p95 across a drop | 675 ms (n = 2) |
| Lost acknowledged updates / duplicate tokens / unacknowledged after drain | 0 / 0 / 0 |
| Reconnect p95 | 8.39 s |

## Stored-wait split from the collab log (`npx tsx load/store-split.ts collab.log`)

`collab.stored` lines n = 22,520: `store_wait_ms` p50 1,002 ms, p95 1,007 ms; `db_write_ms` p50 58 ms, p95 117 ms; wait + write p95 1,121 ms; `store_wait_ms` missing on 0 lines.

## Worker and collab logs

`check.failed`: 0 in the worker log and 0 in the collab log. `check.done`: 3,327 (worker). `api.anthropic.com` mentions: 0. Provider mode stub; no model call.

## HTTP half: what the 503s were

Of 38,909 counted requests, 1,684 were `SERVICE_BUSY` (HTTP 503: the database pool wait of 2 s ran out): board 716, heartbeat 551, lesson open 337, act read 62, act write 18. No other error class: client errors 0. The probe counts these as errors, never as slow successes. Page loads (2,036) all succeeded, p95 44 ms.
