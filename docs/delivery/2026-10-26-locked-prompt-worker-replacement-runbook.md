# Replacing a worker while generation jobs are queued (locked-prompt runbook)

Written 2026-10-26 (contract slice F3). Applies to any release that changes `packages/prompts/locked/**` (the prompt files that
tell the model the fixed rules). Tool: `npx tsx ops/queue-compat.ts`. It only reads; it never changes, cancels or repins a job.

## 1. What a pin is

When an author starts a run, the run stores `run.prompt_version_id`. That row in `prompt_version` has a `locked_hash`: a fingerprint
of the locked files the run was started under. Every job of the run carries that pin through the run. A guidance edit makes a new
`prompt_version` with the **same** `locked_hash`, so it is compatible. A change to a locked file makes a different hash.

Example: run R1 pinned `pv_old` (hash `aaaa...`). The new release has locked files hashing to `bbbb...`. R1's queued jobs are
**old pins** for the new worker and **matches** for the old one.

## 2. The hazard, from the code

The claim SQL (`packages/db/src/repos/job-queue.ts`, `CLAIM_SQL`) picks the next queued job of any `planning` or `running` run and has
no filter on the pin. The renderer then compares the job's pinned hash with the hash of the files on disk
(`packages/prompts/src/render.ts`, `assert_locked`) and throws `LockedLayerMismatch` when they differ. So a worker with new locked
files that claims an old-pin job fails it. `LockedLayerMismatch` here is the **expected symptom** of a swap done in the wrong order, not
a bug in the job. Nothing in the code skips such jobs first (request R-F3-2: a pin-aware claim).

## 3. Before a swap: read the inventory

```
npx tsx ops/queue-compat.ts --include-failed            # against this checkout's locked files
npx tsx ops/queue-compat.ts --artifact-hash <64 hex>    # ask: what can THAT artifact still finish?
```

Synthetic example output:

```
artifact locked hash: bbbbbbbbbbbb
queued + running jobs: match 4, old_pin 3, pin_missing 1
[old_pin] locked aaaaaaaaaaaa  prompt versions pv_old
  queued 2 (latent, in paused/capped runs: 1), running 1, oldest queued 2026-10-26T09:00:00.000Z
  runs run_a, run_b
  old artifact must keep running until this group is 0, or use a supported transition (runbook section 5)
```

Read it like this: `queued` jobs of `planning`/`running` runs are live; `latent` ones sit in `paused` or `capped` runs and become live on a
resume or retry, so they count. `running` jobs hold a lease; the old worker must finish or lose them. `pin_missing` means the run names a
prompt version that has no row: nothing can render it; treat it as a defect to repair by hand with the owner, not to skip.

## 4. Order of a safe swap

1. Do **not** start the new web artifact first. Its start syncs a new `prompt_version` (`apps/web/src/server/wiring/prompts.ts`), after
   which authors could start runs the old worker cannot render.
2. Stop accepting new runs (tell authors; no code switch exists). Keep the **old** worker running.
3. Re-run the inventory with the **old** artifact's hash until `old_pin` and `pin_missing` of the **new** hash are all finished or decided,
   and every latent run is resumed to completion or handled by section 5.
4. Replace worker and web together.
5. Gate: `npx tsx ops/queue-compat.ts --fail-on-old` must exit `0` (it exits `3` while any old or missing pin remains).

## 5. Supported transitions for a job you cannot or will not finish on the old artifact

- (a) Run control `cancel` on the old run (`RunService.control`: recorded and audited), then start a **new** run with
  `scope: { kind: "unfinished_of_run", run_id: <old run> }` and the new `prompt_version_id`. The new run carries `parent_run_id`, so the
  repin is visible in the data and the audit log and is never silent. The scope takes every lesson of the old run whose job is not `ready`.
- (b) `retry_failed` on a `partial` run requeues failed jobs **on their old pin** and therefore needs the old artifact (the inventory lists
  them under `--include-failed`).

Never edit `run.prompt_version_id`, `lesson_job.status` or `prompt_version` by SQL, and never delete a job to make the count zero.

## 6. What to write down

Date, the inventory output (and its SHA-256), the artifact hashes before and after, and the decision for each group (waited, cancelled and
restarted as run `<id>`, or left on the old worker). Keep it with the release note.

## 7. Known gap

A pin-aware claim (claim only jobs whose `locked_hash` equals the worker's) would remove the hazard. It is a production change in
`packages/db/src/repos/job-queue.ts` and is not made here (F3 report, request R-F3-2).
