# Route: integration tickets (a screen on the real backend, end to end)

As of main `9951739` (2026-10-25). Status words: [routes/README](README.md). Serves NL-93…99 (wave 5), NL-100…104 and
NL-113…117 (waves 5–6). The pattern was set by **NL-90** (CON-1 sign-in), merged in W4 batch 13.

## Responsibility and governing sources

An integration ticket reruns a merged screen against the real web server, database and (where needed) worker or collab
server, proving the agreed `CON-N` end to end. It owns its specs and support files, not the screen or the services.

| What decides | Where |
|---|---|
| The behaviour to prove | `docs/contracts/INTERFACE.md`, heading `CON-<n>`; the screen's `SCR-<n>` in `SCREEN_SPECS.md` |
| The wiring each service gets | `docs/plans/slice-plan.md`, *Composition-root wiring owners* (one filler per A0 wiring file) |
| The harness pattern | NL-90's plan, `docs/plans/fanout/2026-10-25-w4/NL-90.md` (sections on owned files and the stack start) |

## The pattern (as NL-90 built it)

| Piece | Path · symbol | Status |
|---|---|---|
| Separate Playwright config (do not edit `playwright.config.ts`) | `apps/web/playwright.real.config.ts` | verified at merge (NL-90) |
| Stack start: `next build` then `next start -p $E2E_PORT` from a global setup (per NL-90's plan) | `apps/web/e2e/integration/support/{global-setup,real-stack,db,db-admin,users,axe,outline-fixtures,copy-rules}.ts` | verified at merge (NL-90) |
| Specs per contract | `apps/web/e2e/integration/con-<n>/*.spec.ts`; example `con-1/` (10 specs incl. `axe`, `visual`, `wf-1-obligations`; frozen manifest `docs/plans/frozen-tests/NL-90.manifest.json`) | verified at merge (NL-90) |
| Database | `packages/db/src/testing/test-db.ts` `create_test_db()` (fresh `ls_t_<hex>` database, migrated); server `scripts/test-db.sh up` (127.0.0.1:55440; never `down` while others run) | built |
| Seed | `ops/seed.ts` (`seed_reference_data`, `main`) with `DATABASE_URL`, `SEED_DEMO_PASSWORD` | verified at merge (NL-82) |

## Web wiring each wave-5 ticket relies on (`apps/web/src/server/wiring/`)

| File | State at `9951739` | Used by |
|---|---|---|
| `sessions.ts` `wire_sessions` | real | NL-90 and every integration spec (sign-in) |
| `outlines.ts` `wire_outlines`, `runs.ts` `wire_runs` | real | NL-93, NL-94, NL-95, NL-96, NL-97 |
| `prompts.ts` `wire_prompts` | real (seeds v1) | NL-95, NL-103 |
| `metrics.ts` `wire_metrics` | real (`BoardService`, `HeartbeatService`) | NL-98, NL-99, NL-104 |
| `review.ts` | real (all six review services) | NL-99, NL-100, NL-113–115 |
| `coverage.ts`, `exports.ts`, `assist.ts` | **stub** ("Wiring stub", every service unset); fillers NL-91, NL-102, NL-116 | NL-117, NL-102, NL-116 |
| worker `apps/worker/src/wiring/{generation,checks}.ts` | real; `judge.ts` stub (NL-110) | NL-96, NL-97 |
| collab `apps/collab/src/wiring/commands.ts` | stub (NL-105) | NL-113–116 |

## Check before planning (in the work system, not here)

- NL-90 found that the web container did not build the real db, ids and clock (`apps/web/src/server/container.ts`,
  commit `4804a90`): an integration ticket that hits a new service checks that its wiring is real (table above).
- Is every screen and service ticket in the ticket's *Blocked by* list in `merged.txt`?
- Does the ticket need the worker to *run* jobs? At `9951739` the worker's `main.ts` builds its wiring but never starts
  the claim loop or the check lane (**S-8**). NL-96 and NL-97 need that fixed or a scripted stand-in the ticket names.
- Open seam rows for the contract: S-11 (TRACEABILITY ids), S-12 (sign-in helper workaround), S-13 (NL-94), S-15
  (NL-98), S-16 (timing-sensitive generation test, NL-96/97), S-17 (NL-99).

## Stale when

- the support files under `apps/web/e2e/integration/support/` change;
- a wiring file changes state (stub → real);
- S-8 is fixed, or `playwright.real.config.ts` changes how the stack starts.
