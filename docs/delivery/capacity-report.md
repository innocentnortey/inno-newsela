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
