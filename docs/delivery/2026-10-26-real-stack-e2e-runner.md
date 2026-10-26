# Isolated real-stack e2e runner (`ops/e2e-real-stack.sh`)

Contract slice F3, 2026-10-26. One script runs the real-stack Playwright specs (`apps/web/e2e/integration/*`) **serially** on a **private
copy** of the candidate tree and writes a run record. It proves the real stack (built Next app, worker, collab, migrated Postgres) with
the **stub model**; it says nothing about paid real-model generation.

## Why it exists

The 2026-10-26 real-stack runs (`docs/devlog/2026-10-26-e2e-real-stack-final.md`) were disturbed by a second Playwright run in the same
`apps/web` (it wiped `test-results/integration-stack/stack.json`), a stale server on port 3121, a half-rebuilt `.next`, and a wrapper that
left out the env con-17 needs. Results from such runs cannot be tied to a commit.

## How to run

```
ops/e2e-real-stack.sh                          # every folder, serial, about tens of minutes, needs about 3 GB free
ops/e2e-real-stack.sh --only con-1,con-17      # a subset (the record says valid_subset)
ops/e2e-real-stack.sh --dry-run                # the plan and the record; starts nothing, builds nothing
ops/e2e-real-stack.sh --print-fingerprint      # head, dirty files and their hash
```

Options `--out <dir>` (default `docs/testing/e2e-runs/<UTC time>-<head8>`) and `--keep-tree`. Env: `E2E_REPO_ROOT`, `E2E_LOCK_FILE`,
`E2E_COLLAB_PORT` (4399), `E2E_MIN_FREE_MB` (3000).

## What each guard means (exit 2, nothing started)

| Guard | Meaning |
|---|---|
| unknown folder | `--only` named a folder that is not under `apps/web/e2e/integration` |
| free disk | less than `E2E_MIN_FREE_MB` free on the repo filesystem (the VPS disk was 95% full) |
| lock | another real-stack run holds `E2E_LOCK_FILE` (flock): one run at a time |
| collab port | something already listens on `E2E_COLLAB_PORT` (con-17 starts its own collab there) |

## What it does

It copies `git archive HEAD` plus the uncommitted files into `<out>/tree` (hard-linked `node_modules`, its own `.next` and
`test-results`), picks a free web port in 3200 to 3399 and a free sheets port, then runs each folder with `timeout 900` in its own process
group. The first folder builds. con-17 gets `E2E_COLLAB_PORT`, `E2E_COLLAB_INTERNAL_URL` (ends in `/internal`), `E2E_ASSIST_TIMEOUT_MS`
and `E2E_ASSIST_STUB_FILE`; con-2 gets `E2E_SHEETS_BASE_URL`; every other folder gets none of them. Provider keys are removed from the
child environment. Each run uses its own database (`support/db-admin.ts` makes and drops an `ls_t_*` database).
Paths under `docs/testing/e2e-runs/` and the `--out` dir are left out of the fingerprint, so writing the record cannot invalidate it.

## Reading `run-record.json`

`git.head`, `git.dirty_hash` (hash of every uncommitted file and status), `tree_fingerprint_at_end`, `build.build_id` (and whether it was
unchanged), `env`, one entry per folder (`exit_code`, `expected`/`unexpected`/`flaky`/`skipped`, log path), `other_processes_seen`
(information only), `claims`, and `validity`:

- `valid`: every folder ran, the build exists and did not change, the tree did not change during the run.
- `valid_subset`: the same, with `--only`.
- `invalid` with reasons from `tree_changed_during_run`, `build_failed`, `build_id_changed`, `folder_not_run:<name>`, `interrupted`.

A red folder is a result, not invalidity. Exit codes: 0 valid and green, 1 valid with failing folders, 2 guard refusal, 3 invalid.

**The one rule: quote the record's `git.head`, `git.dirty_hash` and `validity.status` whenever a result is cited.** A run whose status is
not `valid` or `valid_subset` is not evidence for that commit.
