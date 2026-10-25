# GEN-1 seam fixes: pinned user id, plan_stored_at after Resume, paused_reason.lesson_ids

risk::security: no. Lane: build-loop. **Merge order: GEN-1 merges AFTER NL-96** (branch `ticket/NL-96` holds the fixme specs and `repairPinnedChoices`; the e2e edits below apply on top of it; NL-97 reuses the helpers).

## 1. Goal and sources
Three defects found by NL-96 (`docs/devlog/2026-10-25-w6-nl96.md` "Seam defects", worktree `/home/linuxuser/workspaces/.worktrees/newsela-NL-96`) block real generation. Fix each at its owner on main.

## 2. Boundary
Modify only:
- `packages/db/src/repos/outlines.ts` (`choices`, new `user_names`)
- `packages/db/src/repos/outlines.choices.test.ts`
- `packages/db/src/repos/runs.ts` (`store_unit_plan`)
- `packages/db/src/repos/runs.int.test.ts`
- `apps/web/src/server/services/outline-service.ts` (+ `outline-service.test.ts` or `.more.test.ts`)
- `apps/web/src/server/services/run-read-model.ts` (+ `run-read-model.test.ts`)
- `apps/worker/src/generation/unit-plan-job.test.ts` (test only; worker parse stays strict)
- on the NL-96 branch: `apps/web/e2e/integration/con-6/helpers.ts`, `plan-failed-resume.spec.ts`, `cancel-pause-restart.spec.ts`; devlog `docs/devlog/2026-10-25-w6-gen1.md`; area-map note.
Read only: `packages/core/src/ports/{runs,alignment}.ts`, `packages/schema/src/outline.ts` (already types `confirmed_by: UserId.nullable()`), `run-service.ts`, `run-finalizer.ts`. Do not edit `run-service.ts` (it already pins `await this.outlines.choices(id)`; fixed by the repo change), core ports, or schema.

## 3. Requirements
| # | Requirement | Implementation | Verify |
|---|---|---|---|
| R1 | Pinned `run.choices_json[].confirmed_by` is `usr_<ULID>`, so `PgRunRepo.pinned_choices` parses | `PgOutlineRepo.choices()` returns the raw `intake_choice.confirmed_by` id: remove the `LEFT JOIN app_user u` and `coalesce(u.name, ...)`; select `c.confirmed_by`. Add (not on the port, like `runs_from_version`) `async user_names(ids: readonly string[]): Promise<Map<string,string>>` = `SELECT id, name FROM app_user WHERE id = ANY($1)` | `outlines.choices.test.ts`: change the "returns the user's name" test to expect `confirmed_by: USER` and add a `user_names([USER])` test -> `"Test author"`. `runs.int.test.ts`: start/seed a run from `choices()` of a confirmed choice and assert `pinned_choices` resolves with the user id (no ZodError) |
| R2 | SCR-4 / report still show the person's NAME | `OutlineService`: widen the repo type with `UserNameReader { user_names(ids: readonly string[]): Promise<Map<string,string>> }` (`OutlineRepo & UnitOverviewReader & ReportReader & UserNameReader`). Add private `named(choices)` mapping `confirmed_by` id -> `names.get(id) ?? id`. Use it in `report()` (line ~162) and for `before` in `record_choice` (line ~188). The `view()` line (~196) already uses `user.name`; leave it. `upsert_choice` keeps writing `user.user_id`. Do NOT pass named rows to the gate or any pin | `outline-service` test: report `choice.by` is the name after a confirm; route test `app/api/outline-versions/[outlineVersionId]/choices/route.test.ts` stays green (fakes must implement `user_names`; update the in-memory outline fake in `apps/web/src/server/services/testing/` only if it is a service-owned test double, else report it) |
| R3 | Run start pins the id | no code change in `run-service.ts`; assert in `run-service.test.ts` is NOT owned: instead cover in R1 DB test that `choices_hash` input holds ids | R1 test |
| R4 | Worker parse | unchanged (strict `UserId`). Add a test in `unit-plan-job.test.ts`: a run whose pinned choices carry `usr_<valid ULID>` plans fine (use the existing fakes in `generation/testing/unit-plan-fakes.ts`) | `-t` below |
| R5 | `store_unit_plan` sets `plan_stored_at` after Resume (state already `running`) | In `packages/db/src/repos/runs.ts` `store_unit_plan` change the UPDATE to `SET plan_stored_at = $2::timestamptz, state = 'running', paused_check = NULL WHERE id = $1 AND state IN ('planning','paused','running')`. Cancelled/capped stay untouched. | `runs.int.test.ts`: new case "store_unit_plan after resume (state running) sets plan_stored_at"; existing cancelled-stays-cancelled case green |
| R6 | `paused_reason.lesson_ids` non-empty for circuit-breaker pause | `paused_check` is a check KIND (finalizer `set_state(run_id,"paused",d.check,t)`; the lesson's reason is `{check:"check_failed", check_kind:"section_missing"}`). In `build_progress` line ~59 match `r.check === run.paused_check \|\| r.check_kind === run.paused_check` | `run-read-model.test.ts`: add case failing three tiles with `check:"check_failed", check_kind:"section_missing"`, run `paused_check:"section_missing"` -> `lesson_ids` has 3; existing `provider_error` and `unit_plan` expectations stay |
| R7 | NL-96 specs un-fixme'd | On the NL-96 branch delete `test.fixme(true, ...)` in `plan-failed-resume.spec.ts` (~l.39) and `cancel-pause-restart.spec.ts` (~l.84, keep its assertion `lesson_ids.length >= 3` and banner number); remove the "DEFECT" comments | `npm run test:e2e:real -- con-6/plan-failed-resume con-6/cancel-pause-restart` (use the exact real-stack script name from `package.json`; stack per NL-96 devlog) |

## 4. Shared code (real signatures)
- `PgOutlineRepo.choices(outline_version_id: OutlineVersionId): Promise<IntakeChoiceRow[]>` (outlines.ts:301), row `at` stays `coalesce(v.confirmed_at, v.created_at)`.
- `PgRunRepo.pinned_choices(run_id: RunId): Promise<IntakeChoiceRow[]>` (runs.ts:146, `IntakeChoiceRowSchema.parse`); `store_unit_plan(run_id, plan: UnitPlanDraft, model_call_id: ModelCallId): Promise<UnitPlanRow>`.
- `build_progress(rows: RunProgressRows, concurrency_cap: number): RunProgress`.

## 5. Steps
1. Repo `choices()` + `user_names` + update its tests (R1). 2. `store_unit_plan` + DB test (R5). 3. Read-model fix + test (R6). 4. OutlineService naming + tests (R2). 5. Worker test (R4). 6. Rebase/merge onto `ticket/NL-96` (after it lands on main), un-fixme specs, delete `repairPinnedChoices` and its call at helpers.ts:63 (R7). 7. Devlog + area-map row.

## 6. Data
Synthetic only: users `usr_` + 26-char ULID (`01J...`), existing fixtures in the tests named above.

## 7. Checks
- `npx vitest run packages/db/src/repos/outlines.choices.test.ts packages/db/src/repos/runs.int.test.ts` (needs `scripts/test-db.sh up`; `down` after).
- `npx vitest run apps/web/src/server/services/run-read-model.test.ts apps/web/src/server/services/outline-service apps/web/src/server/services/run-service.test.ts "apps/web/app/api/outline-versions" apps/worker/src/generation/unit-plan-job.test.ts`
- Before commit: `npx tsc --noEmit` (workspace typecheck script), eslint, prettier check on changed files. No full suite.

## 8. Risks and requests
- Gate/`choices_hash` change: hash now covers ids (stable, arguably better); old runs' pinned hashes unaffected.
- Any other consumer of `choices()` expecting a name: grep found only outline-service (2 sites), run-service, `row_context`, `generate_gate_inputs` (none display it).
- Helper rewrites that become unnecessary: `repairPinnedChoices` (helpers.ts, DEFECT comment and its call) only. Still needed: NL-96's valid `usr_<ULID>` minting (`createUser` ids `usr_e2e_<hex>` fail the worker's strict `UserId`; harness request to NL-90 support, not GEN-1), and NL-97's id-shaped-display-name users can revert to normal names (NL-97 owner to decide).
- Reviewer may prefer a port method over the non-port `user_names`; that would be a core port change, so deferred.

## 9. Readiness
READY
