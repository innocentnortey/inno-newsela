# Newsela Lesson Studio

A hiring-partner project for Newsela, via Gauntlet AI. Newsela is entering California Core ELA/ELD instruction: 40-week
programs of four units with about 40 lessons each, and the bottleneck is staff review, not first drafts.
Lesson Studio takes an uploaded unit-outline sheet, bulk-generates standards-aligned ~50-minute lessons with an LLM,
stores them, and gives reviewers a collaborative editor with AI assists and an approval workflow.
All test, eval and demo data is synthetic.

## Prerequisites

- Node 24 and npm 11 (`engines` in `package.json`).
- Docker with Compose v2.

## Run it locally

```bash
npm ci
cp .env.example .env     # project settings only: safe local values, no provider keys
/home/linuxuser/workspaces/bin/with-provider-env --project-env .env -- npm run dev
```

`npm run dev` is `docker compose up --build` (project name `ls`). Provider keys (`ANTHROPIC_API_KEY`,
`OPENROUTER_API_KEY`) come from the shared env file through the launcher and are passed to the containers by name; never
paste them into `.env`. `with-provider-env --check` shows their status without values. With `MODEL_PROVIDER_MODE=stub`
(the `.env.example` default) the stack runs on stub model output.

Services (see `docker-compose.yml`):

| Service | What it does | Published port |
|---|---|---|
| `postgres` | Postgres 16 | none (reachable only inside the Compose network) |
| `migrate` | one-shot: applies migrations and refreshes the non-owner runtime role, then exits | none |
| `worker` | generation and check jobs | none (health probe inside the network) |
| `collab` | collaborative-editing server | `127.0.0.1:1234` (`COLLAB_PORT`) |
| `web` | the app | `127.0.0.1:3000` (`WEB_PORT`) |

Open <http://localhost:3000>. Compose stops and names any required variable that is unset (`DATABASE_URL`,
`MIGRATE_DATABASE_URL`, `COLLAB_INTERNAL_TOKEN`, `AUDIT_HASH_SALT`).

`npm run db:migrate` and `npm run db:seed` run from the host and need a Postgres your shell can reach. The `migrate`
service already applies migrations when the stack starts, and Postgres is not published, so point `DATABASE_URL` and
`MIGRATE_DATABASE_URL` at a reachable database (for example the test one below) before running them on the host.

### Dev notes

- `scripts/test-db.sh up|down` starts or stops a test Postgres on `127.0.0.1:55440` (project `newsela-test`, via
  `docker-compose.test.yml`). It wraps `docker compose` with dummy values for the required variables, so it needs no real secrets.
- `scripts/link-node-modules.sh <worktree-dir>` gives a git worktree a hard-linked copy of the main checkout's
  `node_modules`, so a worktree needs no second install.

## Commands

All run from the repository root. The WF-n numbers are the workflows in `docs/design/observability.md`.

| Command | What it does |
|---|---|
| `npm run lint` | ESLint over the repository |
| `npm run typecheck` | type-checks every workspace, then the root `tsc` project |
| `npm test` | Vitest run |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run db:migrate` | apply database migrations (WF-36) |
| `npm run db:seed` | seed the CDE standards table and one demo account per role (WF-37) |
| `npm run schemas:emit` | emit the JSON Schemas (WF-45) |
| `npm run gen:error-status` | regenerate the error-to-status table in `apps/web` |
| `npm run eval:golden` | golden suites: intake, checks, drafts, safety notes (WF-24) |
| `npm run eval:grounding` | grounding plants suite (WF-42) |
| `npm run eval:faults` | fault-injection script (WF-28) |
| `npm run eval:full-run` | full-run report on the issued unit (WF-25) |
| `npm run eval:seed` | seeded-error run (WF-26) |
| `npm run eval:heldout` | held-out structural comparison (WF-27) |
| `npm run eval:judge-calibrate` | judge calibration (WF-31) |
| `npm run load:spike` | HTTP load probe at the 200-user spike (WF-29) |
| `npm run ops:backup` | one `pg_dump` backup (WF-40) |
| `npm run dev` | the Compose stack described above |

Some targets are placeholders until their owning ticket lands; `scripts/script-targets.json` lists each target and owner.

## Deploy

The demo runs locally under Docker Compose (PD-15, option D: no new hosting spend). `render.yaml` is committed for
Render, the Gauntlet default host, and is not provisioned until Innocent approves the spend.

## Docs map

- Architecture write-up: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Requirements: [`docs/prd/newsela-prd.md`](docs/prd/newsela-prd.md)
- Shared interface contracts: [`docs/contracts/INTERFACE.md`](docs/contracts/INTERFACE.md)
- Submission deliverables: [`SUBMISSION.md`](SUBMISSION.md)
- Project entry and boundaries: [`CLAUDE.md`](CLAUDE.md); where the project is: [`PROJECT-CHECKLIST.md`](PROJECT-CHECKLIST.md)
- How the VPS run is operated: [`ops/vps-run/README.md`](ops/vps-run/README.md)

## Licence

Pending: NL-139 (no `LICENSE` file yet).
