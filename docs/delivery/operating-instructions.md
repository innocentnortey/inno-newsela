# Operating instructions — Newsela Lesson Studio (draft 1, 2026-10-25)

**Status: proposed (draft).** Every command below was matched against `package.json`, `scripts/script-targets.json`,
`docker-compose*.yml`, `scripts/*.sh`, `ops/*` and `evals/src/*` on 2026-10-25. **None was executed to write this**
(no Docker builds, no live model calls): treat each as *implemented in the repo, not verified by running*. The clean
Compose-from-fresh-clone run is the job of NL-137; replace this banner with its evidence when it exists.
Starting point: [`README.md`](../../README.md). Secrets: names only appear here, never values.

## What this does, in one paragraph

Lesson Studio reads a unit-outline sheet, generates lessons with an LLM, stores them, and gives reviewers a
collaborative editor and an approval workflow. Five processes make it up: Postgres 16, a one-shot `migrate`, a
`worker` (generation and check jobs), `collab` (the live-editing server) and `web` (the app).

## Prerequisites

Node 24 and npm 11 (`engines` in `package.json`); Docker with Compose v2. On this VPS the user has no Docker socket
access, so Docker commands run as `sudo -n docker ...` (`scripts/test-db.sh` does this itself).

## Run it under Docker Compose

```bash
npm ci
cp .env.example .env          # project settings only; provider keys never go in this file
/home/linuxuser/workspaces/bin/with-provider-env --project-env .env -- npm run dev
```

`npm run dev` resolves (through `scripts/run-target.mjs`) to `docker compose up --build`, project name `ls`.
`with-provider-env` puts `ANTHROPIC_API_KEY` and `OPENROUTER_API_KEY` in the environment from the shared file,
`/home/linuxuser/workspaces/.env`, and Compose passes them to `worker` and `web` by name. Check their status without
values: `/home/linuxuser/workspaces/bin/with-provider-env --check`. The compose header recommends
`docker compose up --build --wait` to block until the health checks pass.

With `MODEL_PROVIDER_MODE=stub` (the `.env.example` default, and the compose default when unset) the stack runs on
stub model output and spends nothing. `real` calls the providers and costs money; see *Limits*.

| Service | Role | Published |
|---|---|---|
| `postgres` | Postgres 16, volume `pg_data` | none |
| `migrate` | one-shot: runs migrations (`RUN_MIGRATIONS=1` in `scripts/docker-entrypoint.sh`) and refreshes the non-owner runtime role | none |
| `worker` | generation and check jobs | none |
| `collab` | collaborative editing | `127.0.0.1:1234` (`COLLAB_PORT`) |
| `web` | the app | `127.0.0.1:3000` (`WEB_PORT`) |

Open <http://localhost:3000>. Stop with `docker compose -p ls down` (add `-v` only if you mean to delete the database volume).

## Run it without Compose (dev scripts)

The root has no host `dev` server of its own: `npm run dev` is the Compose command. To work on one app on the host:

- Start only the database: `scripts/test-db.sh up` (Postgres on `127.0.0.1:55440`, project `newsela-test`). Stop: `scripts/test-db.sh down`.
- Export `DATABASE_URL` and `MIGRATE_DATABASE_URL` to that database yourself, then `npm run db:migrate` and `npm run db:seed`.
- The web app has its own `dev` script: `npm run dev -- -p <port>` inside `apps/web` (`next dev`) (this is what `apps/web/playwright.config.ts` runs against Prism mocks `mock:api` and `mock:collab`). Worker and collab entry points are `apps/worker/src/main.ts` and `apps/collab/src/main.ts`, run with `node_modules/.bin/tsx` as in the compose file.
- Hosting on Render is **not** provisioned (`render.yaml` is committed only; PD-15 option D). See accepted risk AR-1 before any real deployment.

## Environment variables (names only)

Required by Compose, which stops and names any that is unset: `DATABASE_URL` (non-owner runtime role),
`MIGRATE_DATABASE_URL` (owner, held only by `migrate`), `COLLAB_INTERNAL_TOKEN`, `AUDIT_HASH_SALT`.
Set in `.env.example`: those plus `POSTGRES_PASSWORD`, `MODEL_PROVIDER_MODE`, `BUILD_ID`. Optional in Compose:
`COLLAB_PORT`, `WEB_PORT`, `APP_ORIGIN`. Provider keys (`ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`) come only from the
launcher. Application settings read by `packages/config` (defaults live in code, not here) include `MODEL_GENERATION_ID`,
`MODEL_REPAIR_ID`, `MODEL_ASSIST_ID`, `MODEL_EFFORT`, `MODEL_CALL_TIMEOUT_MS`, `PROVIDER_MAX_RETRIES`,
`BUILD_SPEND_CEILING_USD`, `RUN_CAP_DEFAULT_USD`, `RUN_CAP_MULTIPLIER`, `USER_DAY_CAP_MULTIPLIER`,
`COST_PER_LESSON_ESTIMATE_USD`, `UNIT_PLAN_COST_ESTIMATE_USD`, `FOUR_EYES_ENABLED`, `OUTLINE_MAX_ROWS`,
`OUTLINE_MAX_BYTES`, `SHEETS_FETCH_TIMEOUT_MS`, `SESSION_COOKIE_NAME`, `SESSION_TTL_HOURS`, `PG_POOL_MAX`,
`PG_ACQUIRE_TIMEOUT_MS`, `LOG_LEVEL`, `WORKER_HEALTH_PORT`, `COLLAB_INTERNAL_URL`. Seeding and the driver add
`SEED_DEMO_PASSWORD`, `DRIVER_EMAIL`, `DRIVER_PASSWORD`, `DRIVER_BASE_URL`, `DRIVER_OUTLINE_PATH`, `DRIVER_CAP_USD`.
`BACKUP_DOCKER_CONTAINER` and `BACKUP_DOCKER` are read by the backup script. The authoritative list is the code in
`packages/config/src`; this list may lag it.

## Seed demo data and credentials

`npm run db:seed` runs `ops/seed.ts` (WF-37). It loads the CDE standards, prompt version 1 and one synthetic demo
account per role: author, reviewer, approver (`*.demo@example.test` addresses). It is idempotent and writes one `seed`
ops event. Passwords come from `SEED_DEMO_PASSWORD` if set; otherwise they are generated and written to
`.demo/seed-credentials.txt`, a git-ignored folder (`.demo/` is in `.gitignore`). They are never logged or stored in
clear. Read that file locally; never paste its contents into a tracked file or a chat. From the host, `DATABASE_URL`
must point at a reachable Postgres (Compose does not publish its own).

## Health checks

| What | How |
|---|---|
| Whole stack | `docker compose -p ls ps` shows each service's health state; `up --wait` blocks on it |
| web | `GET /api/healthz` route exists (`apps/web/app/api/healthz/route.ts`); Compose probes `/` |
| collab | `GET http://127.0.0.1:1234/healthz` (checks Postgres) |
| worker | `GET /healthz` on `WORKER_HEALTH_PORT` (8081) inside the Compose network only |
| Postgres | `pg_isready -U ls` (the compose healthcheck) |

A failing check records a throttled `health.failure` ops event (messages are not logged).

## Backup

`npm run ops:backup` runs `ops/backup.sh`: one verified custom-format `pg_dump` into git-ignored `backups/` (mode 600),
then a `backup` ops event with path, size and SHA-256. Needs `DATABASE_URL` in the environment. It needs `pg_dump` and
`pg_restore` on the host, or set `BACKUP_DOCKER_CONTAINER` to a Postgres container name to dump through
`docker exec`. PD-30: one backup after the full run, before recording. Restore is not scripted; use `pg_restore` by hand.

## Test database wrapper

`scripts/test-db.sh up|down` wraps `docker compose -p newsela-test -f docker-compose.yml -f docker-compose.test.yml`,
supplying throwaway values for the required variables so no real secret is needed. It starts only `postgres`,
published on `127.0.0.1:55440` with database `ls_test`. Do not touch other projects' Postgres containers.
`scripts/link-node-modules.sh <worktree-dir>` gives a git worktree a hard-linked `node_modules`.

## Tests, evals, driver

| Task | Command | Notes |
|---|---|---|
| Lint, types | `npm run lint`, `npm run typecheck` | |
| Unit and integration | `npm test` (Vitest, projects in `vitest.workspace.ts`) | `*.int.test.ts` files need the test Postgres (`scripts/test-db.sh up`); affected tests only during a build, full suite before NL-137 |
| One area | `npx vitest run <path>` | |
| Browser | `npm run test:e2e` | Playwright against Prism mocks; `playwright.real.config.ts` (the real-stack harness) is named in the plan and was not found at this path on 2026-10-25 |
| Golden suites | `npm run eval:golden -- --suite <S1,S2,...>` | aliases in `evals/src/registry.ts` |
| Named suites | `eval:grounding`, `eval:faults`, `eval:full-run`, `eval:seed`, `eval:heldout`, `eval:judge-calibrate` | flags: `--repeat n`, `--provider stub|real`, `--unit G6-U4`, `--fixture`. Exit 0 floors met, 1 floor missed, 2 usage, empty suite, not built or guard |
| Reports | written to `evals/reports/<kind>-<git sha>.md` (held-out: git-ignored `evals/local/reports/`) | |
| Full-run driver | `npx tsx evals/src/driver/main.ts --unit G6-U4 --outline <csv> [--provider stub\|real] [--cap-usd n] [--prompt-version id] [--base-url url]` | credentials only from `DRIVER_EMAIL` / `DRIVER_PASSWORD`. A real-provider run refuses to start without `--cap-usd` or `DRIVER_CAP_USD`; run real ones only through `with-provider-env` inside the $75 ceiling (PD-29) and record the cost |
| Schemas | `npm run schemas:emit`, `npm run gen:error-status` | |

## Known limits (as of this draft)

- Unverified here: a clean `up` from a fresh clone, and every command above (see the banner).
- `scripts/run-target.mjs` exits 2 with `NOT BUILT: owned by NL-n` for a target whose file does not exist. Some targets
  are shells: `load:spike` (`load/spike.ts`, `http-mix.ts`) throws "not implemented" (owner NL-118) and `load/yjs-mix.ts`
  (NL-119). An empty eval suite exits 2, so a shell never reads as passing. Check `evals/src/registry.ts` for which suites
  are real.
- Open seam defects are listed in [`docs/plans/seam-followups.md`](../plans/seam-followups.md) (for example S-8: worker `main.ts` not starting the claim loop; S-17: the live editor not visible on SCR-9). Re-read it; this file does not copy its state.
- Accepted risks: AR-1 (Render owner DB credential) and AR-2 (no sign-in throttle) in `docs/devlog/`. Fine for the local demo, not for a real deployment.
- Capacity, quality and cost figures are not in this file; none have been measured beyond SP-1 to SP-3.
- Provider-key handling: only through `with-provider-env`; nothing in this repo stores them.
