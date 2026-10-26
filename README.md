# Newsela Lesson Studio

A hiring-partner project for Newsela, via Gauntlet AI.

| Release SHA | Demo video | Licence |
|---|---|---|
| pending: NL-137 (set when the release check runs) | pending: NL-138 (recording not made) | pending: NL-137 (no `LICENSE` file yet; GR-17 asks for "All rights reserved; evaluation use permitted") |
 Newsela is entering California Core ELA/ELD instruction: 40-week
programs of four units with about 40 lessons each, and the bottleneck is staff review, not first drafts.
Lesson Studio takes an uploaded unit-outline sheet, bulk-generates standards-aligned ~50-minute lessons with an LLM,
stores them, and gives reviewers a collaborative editor with AI assists and an approval workflow.
All test, eval and demo data is synthetic.
Real-model status (one run, n = 47): after two prompt rounds, 30 of 47 lessons of the issued unit are ready and 17 are blocked with
recorded reasons; the 90% first-pass target is not met (40% clean first pass). See
[`docs/delivery/real-model-results.md`](docs/delivery/real-model-results.md).

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
(the `.env.example` default) the stack runs on stub model output; stub output is not a generated lesson.
The `web` image copies the files the app reads at run time (locked prompts, the standards table and the model
fixtures) into the standalone build in `Dockerfile.web`; a missing copy there made the container fail at start, and
the fix is in the committed file.

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
The web image bakes the browser's collab URL at build time (`NEXT_PUBLIC_COLLAB_URL`, default `ws://localhost:${COLLAB_PORT}`), so changing `COLLAB_PORT` needs `--build`.

`npm run db:migrate` and `npm run db:seed` run from the host and need a Postgres your shell can reach. The `migrate`
service already applies migrations when the stack starts, and Postgres is not published, so point `DATABASE_URL` and
`MIGRATE_DATABASE_URL` at a reachable database (for example the test one below) before running them on the host.

#### Seeding the local demo (standards, prompt v1, demo accounts)

After `up --wait`, run once (safe to repeat; it only adds what is missing):

```
/home/linuxuser/workspaces/bin/with-provider-env --project-env .env -- docker compose --profile seed run --rm seed
```

The `seed` service sets `SEED_ALLOW_DEMO_ACCOUNTS=1` for this one-shot step only, which creates
`author.demo@example.test`, `reviewer.demo@example.test` and `approver.demo@example.test` with the password the
sign-in page's "Demo accounts" box shows (one shared constant in `packages/core/src/auth/demo-accounts.ts`; see
[`docs/devlog/2026-10-26-demo-accounts.md`](docs/devlog/2026-10-26-demo-accounts.md)). The accounts are one author,
one reviewer and one approver. Without the flag the seed generates random passwords into `.demo/`
(unchanged). `render.yaml` sets neither `SEED_ALLOW_DEMO_ACCOUNTS` nor `DEMO_ACCOUNTS`.

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
| `npm run ops:import-spike` | import a committed spike report into the experiment tables (WF-32, WF-33, WF-34) |
| `npm run eval:kickoff` | write the experiment kickoff page from the code (WF-46) |
| `npm run dev` | the Compose stack described above |

`scripts/script-targets.json` lists each script's target file and owning ticket; a target whose file is missing exits 2
with `NOT BUILT`. At the time of writing every listed target file exists, and `eval:full-run` has been run on a real key (30 of 47 lessons ready on the issued unit after two prompt rounds; the 90%
first-pass target is not met; see `docs/delivery/real-model-results.md`). `eval:judge-calibrate` and the experiment scoring
have not been run on a real key.

## Deploy

The demo runs locally under Docker Compose (PD-15, option D: no new hosting spend). `render.yaml` is committed for
Render, the Gauntlet default host. Whether the Render service is live is not recorded in this README: no verified live URL
exists in the repository.

Render note (PD-37, 2026-10-26): Innocent has since approved hosting on Render, built from the GitHub mirror of this
repository's `main`. The step-by-step setup (blueprint gaps to check, the `ls-secrets` environment group, provisioning
and live verification) is in [`docs/delivery/render-deploy-prompt.md`](docs/delivery/render-deploy-prompt.md). Keys live
only in the Render environment group, never in `render.yaml` or this repository.

## Docs map

- Architecture write-up: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- How AI was used to build and inside the product: [`docs/AI-USAGE.md`](docs/AI-USAGE.md)
- Capacity results: [`docs/delivery/capacity-report.md`](docs/delivery/capacity-report.md)
- Requirements: [`docs/prd/newsela-prd.md`](docs/prd/newsela-prd.md)
- Shared interface contracts: [`docs/contracts/INTERFACE.md`](docs/contracts/INTERFACE.md)
- Submission deliverables: [`SUBMISSION.md`](SUBMISSION.md)
- Project entry and boundaries: [`CLAUDE.md`](CLAUDE.md); where the project is: [`PROJECT-CHECKLIST.md`](PROJECT-CHECKLIST.md)
- How the VPS run is operated: [`ops/vps-run/README.md`](ops/vps-run/README.md)

## Licence

Pending: NL-137 (no `LICENSE` file yet; the pointer is added when the file exists).
