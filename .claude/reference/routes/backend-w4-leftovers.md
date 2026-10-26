# Route: wave-4 back-end tickets still to plan (NL-87, NL-88, NL-89, NL-91)

As of main `5999d9b` (2026-10-26; HEAD, the NL-137 release SHA is not cut), reconciled by NL-140. Every ticket this route served is built; rows below say what exists. Status words: [routes/README](README.md). Each section is one area; owner of paths:
[area map](../area-map.md).

## A16 prompts — NL-88 save a guidance version and try it on one lesson

| Thing | Path · symbol | Status |
|---|---|---|
| Service | `apps/web/src/server/services/prompt-service.ts` `PromptService`; `list` (NL-34) and `save_guidance` (NL-88) | built |
| Existing test that pins the class | `prompt-service.test.ts` (NL-88 updated its expectations) | built |
| Route | `apps/web/app/api/prompt-versions/route.ts`: `GET` and `POST` (NL-88) | built |
| Port | `packages/core/src/ports/prompts.ts` `PromptRepo.insert_guidance(v, diff, tx)`, `NewGuidanceVersion` | built |
| Repo | `packages/db/src/repos/prompts.ts` | verified at merge (NL-34) |
| Double | `apps/web/src/server/services/testing/run-service-fakes.ts` `MemPromptRepo` | built |
| Contract | `saveGuidance` operation; `CON-24` | built |

## A19 judge — NL-89 OpenRouter adapter, judge job, verdict repository

| Thing | Path · symbol | Status |
|---|---|---|
| Ports | `packages/core/src/ports/judge-client.ts` `JudgeClient.verdict`; `ports/judge.ts` `JudgeRepo.insert_verdict`; `ports/spend.ts` `SpendLedger` (`reserve`, `settle`); `ports/model-call-log.ts` `ModelCallLog` | built (NL-12) |
| Stub judge | `packages/llm/src/stub.ts` **already holds `StubJudgeClient`** (NL-32, tests in `stub.test.ts`). The ticket asks for a new `stub-judge.ts`; reconcile before planning (ticket defect: report it) | built |
| Table | `packages/db/migrations/0011_judge.sql` | built |
| Prompt | `packages/prompts/src/inputs.ts` (`render_judge`) | built (NL-14) |
| Added (NL-89) | `packages/llm/src/openrouter-judge.ts` `OpenRouterJudgeAdapter`, `packages/db/src/repos/judge.ts` `PgJudgeRepo`, `apps/worker/src/judge/**` | built |
| Worker wiring | `apps/worker/src/wiring/judge.ts` `wire_judge` (NL-110) | built |
| Doubles | `packages/core/src/testing/{fake-spend,fake-model-call-log}.ts`; `packages/llm/src/test-support/{scripted-client,memory-log}.ts` | built |
| Provider key | never copied: `/home/linuxuser/workspaces/bin/with-provider-env`; tests use the stub | rule |

## A18 coverage — NL-91 coverage matrix query and route

| Thing | Path · symbol | Status |
|---|---|---|
| Port method | `packages/core/src/ports/alignment.ts` `AlignmentRepo.coverage_rows(unit_id)` | built |
| Response type | `packages/schema/src/api/metrics.ts` `CoverageMatrix`; operation `getCoverageMatrix` | built |
| Added (NL-91) | `apps/web/src/server/services/coverage-service.ts`, `apps/web/app/api/units/[unitId]/coverage/route.ts` | built |
| Wiring | `apps/web/src/server/wiring/coverage.ts` `wire_coverage` (NL-91) | built |
| Route-bridge pattern | `apps/web/src/server/http/next-adapter.ts` (built by NL-25; NL-47, NL-50, NL-51, NL-53 reuse it: do not copy an adapter) | built |

## A20 evals — NL-87 spike report importer

| Thing | Path · symbol | Status |
|---|---|---|
| Added (NL-87) | `ops/import-spike.ts` (`import_spike_report`, `ImportReport` per the ticket) | built |
| Port | `packages/core/src/ports/evidence.ts` `EvidenceRepo.insert_experiment_run`; repo `packages/db/src/repos/evidence.ts` | verified at merge (NL-49) |
| Doubles | `evals/src/testing/memory-evidence.ts`; `packages/core/src/testing/fake-model-call-log.ts` `FakeModelCallLog` | built |
| Test location | root `vitest.workspace.ts` collects `ops/*.test.ts`; the AC-10 WF-32 obligations test is NL-87's to write, on the pattern of `evals/src/suites/wf-42-obligations.test.ts` (NL-85) | built (`ops/wf-32-obligations.test.ts` and its siblings) |

## Check before planning

- Dependencies in each ticket's *Blocked by* are in `docs/plans/merged.txt` (all four are in `merged.txt`).
- NL-89: decide the `stub-judge.ts` vs `stub.ts` question with the orchestrator before writing the plan.
- Any `CHG-N` touching CON-22 or CON-24, or the judge decision records.

## Stale when

- a port above changes signature;
- a port above changes signature; `NotBuiltYet` stubs are removed.
