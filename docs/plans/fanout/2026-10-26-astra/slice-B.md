# Slice B plan: make the reports describe the stage actually measured

Planner: fanout-planner, 2026-10-26. Base: `main` at `e7e72a3`. Lane: `lane::build-loop`, not `risk::security`.
Another slice has uncommitted edits under `packages/core/src/checks/**`: do not open, stage or revert them.
Never read `docs/source/restricted`. Never print or copy the contents of `/tmp/nl112b/env`.

## 1. Goal and sources

Make the full-run (S9) report and the S3 report measure and print the stage they claim, from stored rows, pinned to the
run's own lesson versions.

Sources (read-only for the implementer; the planner has read them):
- `docs/delivery/2026-10-26-astra-fix-handoff.md`, sections "Make reports describe the stage actually measured" and "Execution and evidence order" (step 2, "Repair the metric calculations ... alongside these changes").
- `docs/testing/error-analysis/astra-audit-2026-10-26.json` (attempt 3 = `run_01M5W7VQFD6AEVPMPZA2Z4S9ZK`, database `ls_nl112c`: `initial_and_repair_validation` lesson_draft 47/44/44, repair 28/28/28, `recorded_ready_without_repair` 19, `stored_status_counts` ready 30 / generation_failed 17, `saved_version_slot_nodes` quote_placeholder 13 + excerpt_slot 7 across 16 versions; `failed_lesson_replay[].stored_reasons[].check_kind`).
- `docs/design/metrics-registry.md` M-31: "drafts that parse and compile without repair ÷ drafts". Meaning fixed by the handoff: the ORIGINAL draft output parses against `LessonDraft` AND compiles with `compile_draft`. A later repair never changes that number, and a content/check repair never makes a valid draft invalid.
- `docs/design/eval-plan.md` S9 row (line 195) and S3 row (line 189).

Delivers:
1. Per-stage counts with their own denominators (initial parse/schema validity, initial compilation, initial generation-check cleanliness, repairs/recovery, stored-ready, review blockers, open content slots).
2. Failure breakdown by check kind, first-failure chronology, every stored reason (no collapse to `check_failed`).
3. Run summary and report facts read from the run's own generated lesson versions (slot nodes counted in the content; issues, alignment, round trip pinned to the version's content hash), plus a check-completion watermark so unfinished checking prints "pending", never 0.
4. S3 observer checks parse AND compile; S3 report shows provenance recorded from the run, not "none (stub)".
5. Unit-plan call cost rolled onto its job row by the worker, with the report reconciling both old (not rolled up) and new (rolled up) runs.
6. A read-only reconstruction command that proves attempt 3 = 44/47 initial parse-and-compile, 19/47 no-repair, 30/47 ready, 20 slot nodes.
7. Part 2 of this file: the doc corrections, a separate `lane::direct` list done AFTER the code is merged.

## 2. Boundary

### Owned files: create
| Path | Purpose |
|---|---|
| `evals/src/full-run-initial.ts` | Pure: classify one original/repair draft output (no output / unparseable / schema invalid / compile error / compiled). |
| `evals/src/full-run-initial.test.ts` | Unit tests for the above. |
| `evals/src/full-run-facts.ts` | `FullRunFacts` types and `collect_full_run_facts` (moved out of `full-run-report.ts`, which is 307 lines and would exceed the 400 target). |
| `evals/src/full-run-facts-main.ts` | Read-only CLI: collect facts for one run id and print them as text. Writes no evidence row and no file. |
| `packages/db/src/repos/runs-report.ts` | Types `RunReportFacts`, `RunReportLesson`; `count_slot_nodes`; the SQL for `report_facts` and for the pinned slot count. Split from `runs.ts` (250 lines) so `runs.ts` stays under 400. This is a new file next to the owned `runs.ts`; it is named in the plan so no other slice should create it. |
| `packages/db/src/repos/runs-report.test.ts` | Unit test for `count_slot_nodes` (no database). |
| `packages/db/src/repos/runs-report.int.test.ts` | Postgres test of `report_facts` and the new `summary_rows.placeholders_left`. |

### Owned files: modify
`evals/src/full-run-report.ts`, `evals/src/full-run-deps.ts`, `evals/src/full-run-report.test.ts`, `evals/src/full-run-report.int.test.ts`,
`evals/src/testing/full-run-world.ts` (the seeded fake of `FullRunReadPorts`; only the report tests use it; see Risks R-3),
`evals/src/suites/s3-observe.ts`, `evals/src/suites/s3-assertions.ts`, `evals/src/suites/s3-assertions.test.ts`,
`evals/src/suites/s3-report.ts`, `evals/src/suites/s3-report.test.ts`, `evals/src/suites/s3.ts`,
`packages/db/src/repos/runs.ts`, `packages/db/src/repos/runs.int.test.ts` (only if an existing assertion needs a new field; today it needs none),
`apps/worker/src/queue/claim-loop.ts` and `apps/worker/src/queue/claim-loop.test.ts` (cost rollup only).

Migrations: NONE. Every new fact is derived at read time from existing tables (`lesson_version.run_id`, `lesson_version.content_hash`, `check_job`, `issue`, `alignment_link`, `lesson_doc`, `model_call`). Do not add a migration; if you believe one is unavoidable, stop and report.

### Shared surfaces: read only, never edit
`packages/core/src/ports/**` (including `runs.ts`, `model-call-log.ts`, `outlines.ts`; the new facts type deliberately lives in `packages/db`, see D-1),
`packages/core/src/compile/**`, `packages/core/src/checks/**`, `packages/prompts/**`, `apps/worker/src/generation/nodes/repair-node.ts`,
`apps/worker/src/generation/**` (including `finalizer-doubles.ts`, `unit-plan-job.ts`, `fail-node.ts`), `packages/db/src/repos/model-calls.ts`,
`packages/db/src/repos/job-queue.ts`, `packages/schema/**`, `evals/src/report.ts`, `evals/src/runner.ts`, `evals/src/cli.ts`, `evals/src/types.ts`,
`evals/src/suites/s9.ts` (its `S9_THRESHOLD_IDS` list is fixed: do not add, rename or drop a threshold id), `evals/src/suites/s6-world.ts`, `apps/web/**`.
Do not touch `evals/reports/*` (original run artifacts stay as historical evidence), `evals/src/zz-*.mts` (another session's scratch files) or `tsconfig.tsbuildinfo`.

## 3. Requirements table

| # | Requirement (source) | Implementation | Verification |
|---|---|---|---|
| R1 | "first-pass validity must come from validating the ORIGINAL draft output, not repairs===0" (handoff, Cause) | `collect_full_run_facts` fetches each lesson job's original draft with `ports.calls.completed_for(job_id, "lesson_draft", 1)` and classifies `raw_output` through `assess_initial_draft` (Step 3, 5). `repairs`, `truncation_retries` and `failure_reasons` are not read for this number. | `full-run-report.test.ts` "valid draft needing content repair stays schema-valid"; reconstruction command (R9) |
| R2 | "no-output failure does not count valid" | `completed_for` returns `null` (call failed, lost or never made) or `raw_output` empty: stage `no_output`, counted in `initial.no_output`, never in `parse_valid` or `compiled`. | `full-run-report.test.ts` "no-output failure does not count valid"; `full-run-initial.test.ts` |
| R3 | Separate counts and denominators for initial parse/schema validity, initial compilation, initial generation-check cleanliness, repairs/recovery, stored-ready, review blockers, open content slots | New `FullRunFacts.stages` (section 4.2) and the report "Stages" table (section 4.4). Each row prints `count/denominator`. | `full-run-report.test.ts` "stages are separate rows with their own denominators" |
| R4 | M-31 defines parse AND compile; S3's observer checks parse only | `observe()` in `s3-observe.ts` replaces its `JSON.parse + LessonDraft.safeParse` with `assess_initial_draft` (Step 9). `S3Observed.schema_valid_first_pass` becomes true only for stage `compiled`. New `initial_stage` field. | `s3-assertions.test.ts`, `s3-report.test.ts`, `s3.int.test.ts` (stub, DB) |
| R5 | Failures broken down by check kind, first-failure chronology, all findings, no collapsing to `check_failed` | Key every stored reason with `reason_key(r) = r.check_kind ? r.check + ":" + r.check_kind : r.check`. Facts carry `failures_by_reason` (all reasons), `failures_first_by_reason` (first reason per failed lesson) and `failure_chronology` (failed lessons ordered by `finished_at`, then lesson id, each with its full ordered reason list). | `full-run-report.test.ts` "failures keep their check kind"; reconstruction shows `check_failed:proper_noun_unsourced` 15 and `check_failed:page_out_of_range` 2 for attempt 3 |
| R6 | Run summary counts actual slot nodes, not placeholder issue rows | `PgRunRepo.summary_rows().placeholders_left` = quote_placeholder + excerpt_slot nodes counted in the lesson content of each lesson job's generated version for this run (Step 1, 2). The old `issue`-table query is deleted. | `runs-report.int.test.ts` "slot nodes counted with no issue rows"; reconstruction: 13 + 7 = 20 in 16 lessons |
| R7 | Pin facts to the run's lesson versions/content hashes; later edits do not rewrite history | Version = the lowest-numbered `lesson_version` with `run_id = $run AND lesson_id = $lesson AND kind = 'generated'`. Issues, alignment links, round-trip hash are read at that version's `content_hash` only. Round trip compares the version hash with the FIRST `lesson_doc` row (lowest `seq`), not the latest. The `issues`, `alignment`, `versions`, `docs` ports are removed from `FullRunReadPorts`. | `runs-report.int.test.ts` "a later edit does not change the run's facts" |
| R8 | Check-completion watermark; incomplete checking is "pending", not zero | Per lesson: `check.state` is `checked` when a `check_job` row with `status='done'` or any `issue` row exists at the pinned hash; else `pending`. Run level: `checks_pending`, `checked_through`. The report prints `pending` wherever a check-derived count would otherwise print 0 (Step 7). | `runs-report.int.test.ts` "pending until checked"; `full-run-report.test.ts` "pending checks print pending, not zero" |
| R9 | Acceptance: attempt 3 reconstructs as 44/47 initial parse-and-compile, 19/47 no-repair, 30/47 ready; the 20 slot nodes appear independently of issues | `evals/src/full-run-facts-main.ts` (Step 12), run against `ls_nl112c`. | Section 7, "Reconstruction" |
| R10 | S3 report: `provider_mode: real` with `prompt_version none (stub)` and a stub model note must show real provenance from the recorded run/calls | `observe()` reads the run's prompt version row; `render_drafts_report` prints recorded prompt version, models and call counts and labels the "Suite S3" header as runner config (Step 10, 11). The header itself belongs to `evals/src/report.ts`: Risks R-1. | `s3-report.test.ts` "recorded provenance replaces none (stub)" |
| R11 | Verify totals against stored calls, including the unit-plan call; roll the unit-plan cost onto its job row if feasible | Worker rolls it up (Step 13). Report keeps the add-back for old runs and reconciles both (Step 6). Per-lesson job cost is compared with the sum of that job's completed calls. | `claim-loop.test.ts` "unit_plan_cost_rollup"; `full-run-report.test.ts` "totals reconcile with and without the unit-plan rollup" |
| R12 | Doc corrections | Part 2 | Part 2 checklist |

## 4. Shared code to use (copied from current code)

### 4.1 Imports and signatures that exist today

```ts
// packages/core/src/compile/compile-draft.ts
export interface CompileContext { row: NormalizedRow; template: SectionTemplate; unit_id: UnitId; schema_version: number }
export class CompileError extends Error { readonly lesson_id: LessonId; readonly reason: CompileErrorReason; readonly address: string | null }
export type CompileErrorReason = "section_not_in_template" | "role_not_allowed" | "unknown_node";
export function compile_draft(draft: LessonDraft, ctx: CompileContext): CompiledLesson   // CompiledLesson.placeholders: number
// packages/core/src/compile/templates.ts
export function template_for(lesson_type: string): SectionTemplate | undefined
// packages/core/src/errors.ts   (a second CompileError class, caught the same way by the worker)
import { CompileError as CoreCompileError } from "@ls/core/errors";
import { LessonDraft } from "@ls/schema/lesson-draft";           // zod schema; use LessonDraft.safeParse
import type { NormalizedRow } from "@ls/schema/outline";
import type { UnitId } from "@ls/schema/ids";
// packages/core/src/ports/model-call-log.ts
completed_for(job_id: JobId, purpose: CallPurpose, attempt: number): Promise<RecordedCall | null>;   // RecordedCall.raw_output: string, .cost_usd: Usd
totals_for_run(run_id: RunId): Promise<RunCallTotals>;   // .repairs counts model_call rows with purpose 'repair', INCLUDING the unit-plan repair
// packages/core/src/ports/outlines.ts
rows(outline_version_id: OutlineVersionId): Promise<OutlineRowRecord[]>;   // OutlineRowRecord.row: NormalizedRow (has lesson_id, lesson_type)
// packages/core/src/ports/runs.ts (read only)
RunRow { run_id; unit_id; outline_version_id; ... created_at; finished_at }
RunSummaryRows { run: RunRow; jobs: JobRow[]; calls: RunCallTotals; placeholders_left: number; report_path: string | null }
// packages/core/src/ports/job-queue.ts
JobRow { job_id; run_id; kind; lesson_id; status; tile_state; attempt; queued_at; started_at; finished_at; failure_reasons: FailureReason[]; brakes_fired; repairs; truncation_retries; retries; calls_lost; cost_usd: Usd }
// packages/schema/src/api/runs.ts
FailureReason = { check: "schema_invalid"|"truncated"|"rate_limited"|"provider_error"|"timeout"|"compile_error"|"check_failed"|"cancelled"|"capped"; check_kind?: string | null; message: string }
// packages/core/src/ports/common.ts
type IssueLevelName = "blocking" | "confirmation" | "advisory";   // CheckKind, JobId, LessonId, RunId, Sha256, Usd, VersionId also live here
```

How the worker classifies an original draft (the report must mirror it exactly): `apps/worker/src/generation/nodes/compile-check-node.ts` lines 22-50: `JSON.parse(raw)` failure gives schema issue path `$`; `LessonDraft.safeParse` failure gives the issue paths; `template_for(row.lesson_type)` undefined is an invariant error in the worker (the report treats it as a compile error `template_missing`); `compile_draft(...)` throwing `CompileError` or `CoreCompileError` (use `e.message`), or `RangeError` (message `COMPILE_ERROR: structure_invalid`).

Tables and columns (from `packages/db/migrations`): `lesson_job(id, run_id, kind, lesson_id, status, tile_state, failure_reasons_json, repairs, cost_usd, ...)`; `model_call(id, run_id, lesson_id, job_id, purpose, attempt, status, cost_usd, raw_output, requested_model, served_model, ...)`; `lesson_version(id, lesson_id, number, kind, content_hash, lesson_json, run_id, ...)` (append-only; `kind='generated'`); `lesson_doc(lesson_id, seq, content_hash, ...)`; `issue(id, lesson_id, content_hash, level, kind, resolved_at, cleared_by, created_at, ...)`; `check_job(id, lesson_id, content_hash, status, finished_at, ...)` where `status='done'` marks a finished check; `alignment_link(lesson_id, content_hash, code, address, role, origin, asserted_by, confirmed_by)`; `prompt_version(id, locked_hash, number, ...)`; `run(id, unit_id, outline_version_id, prompt_version_id, ...)`.

Slot node types (compiler output, `packages/core/src/compile/nodes.ts`): `{ type: "quote_placeholder", attrs: {...} }` and `{ type: "excerpt_slot", attrs: {...} }`. A filled slot becomes a `quote` node and is not counted.

### 4.2 Decisions on shape (all made here)

**D-1. Where the new facts type lives.** `RunReportFacts` is exported from `packages/db/src/repos/runs-report.ts` and implemented as an extra public method `report_facts(run_id: RunId): Promise<RunReportFacts>` on `PgRunRepo`. It is NOT added to `RunRepo` in `packages/core/src/ports/runs.ts` (shared, and `ports-surface.test-d.ts` pins `keyof RunRepo`). `evals/src/full-run-facts.ts` imports the type with `import type { RunReportFacts } from "@ls/db/repos/runs-report"` (tools may import any package, `eslint.config.js`).

```ts
// packages/db/src/repos/runs-report.ts  (exact names)
export interface RunReportLesson {
  job_id: JobId;
  lesson_id: LessonId;
  version: { version_id: VersionId; number: number; content_hash: Sha256; schema_version: number } | null;
  slot_nodes: { quote_placeholder: number; excerpt_slot: number };          // zeros when version is null
  check: { state: "checked" | "pending" | "no_version"; checked_at: Date | null };
  open_issues: { kind: CheckKind; level: IssueLevelName; count: number }[]; // unresolved, uncleared rows at the pinned hash
  unconfirmed_alignment: number;                                             // alignment_link at the pinned hash, origin <> 'outline', confirmed_by IS NULL
  seed_doc_hash: Sha256 | null;                                              // content_hash of the lowest-seq lesson_doc row
  calls_cost_usd: Usd;                                                       // sum of cost_usd of this job's completed model_call rows
}
export interface RunReportFacts {
  run_id: RunId;
  lessons: RunReportLesson[];       // lesson jobs only (kind = 'lesson' AND lesson_id IS NOT NULL), ORDER BY queued_at, id
  checks_pending: number;           // lessons whose check.state is "pending"
  checked_through: Date | null;     // max checked_at over lessons whose state is "checked"; null when none
}
export function count_slot_nodes(sections: unknown): { quote_placeholder: number; excerpt_slot: number };
```

**D-2. New `FullRunReadPorts`** (replaces the five-port shape; `GeneratedVersionReader` is deleted, nothing else imports it):

```ts
export interface FullRunReadPorts {
  runs: Pick<RunRepo, "summary_rows"> & { report_facts(run_id: RunId): Promise<RunReportFacts> };
  calls: Pick<ModelCallLog, "totals_for_run" | "completed_for">;
  outlines: Pick<OutlineRepo, "rows">;
}
```

**D-3. "Initial generation-check cleanliness" is derived from the recorded trigger, not re-run.** The generation checks need a full check context (standards, arc, links) that the stored rows do not rebuild cheaply, and the worker repairs exactly once whenever parse, compile or a generation check fails. So, per lesson: `check_clean = stage === "compiled" && job.repairs === 0 && job.truncation_retries === 0 && tile_state === "ready"`. The report labels it "no repair needed (recorded; checks were not re-run)". Denominator `n`; the text also prints `of compiled`. Attempt 3 must give 19/47.

**D-4. Repair stage.** `repair.attempted` = lesson jobs with `repairs >= 1`. `repair.recovered` = attempted jobs whose `tile_state === "ready"`, denominator attempted. `repair.output_compiled` = attempted jobs whose `completed_for(job_id, "repair", 1)` output has stage `compiled`; denominator = attempted jobs whose repair call has an output (`repair.outputs`). Attempt 3: attempted 28, recovered 11/28, outputs 28, compiled 28/28.

**D-5. `FullRunFacts` (exact new shape, `evals/src/full-run-facts.ts`).** Keep every existing field name that `s9.ts` or tests read: `run_id, cap_usd, n, n_ready, first_pass_schema_valid, lessons_run, repairs, failures_by_reason, placeholders, grounding_flags_by_kind, disclosure_prompts_l31_l32, confirmations, round_trip_ok, round_trip_total, cost_usd, jobs_cost, unattributed_cost, prompt_version_id, models_used, per_lesson_max, wall_s, p95_minutes, all_terminal, lessons`. Changed meaning: `first_pass_schema_valid` = `stages.initial.compiled.count`; `repairs` = sum of lesson `job.repairs` (not `totals.repairs`, which also counts the unit-plan repair call); `placeholders` = `stages.open_slots.total`; `failures_by_reason` keyed by `reason_key`, counting every stored reason; `jobs_cost` = LESSON jobs only. Added:

```ts
export interface StageCount { count: number; denominator: number }
export interface FullRunStages {
  initial: {
    parse_valid: StageCount;          // original draft parses as LessonDraft, denominator n
    compiled: StageCount;             // original draft also compiles, denominator n
    no_output: number;                // lessons with no original draft output
    unparseable: number;              // output present, not JSON
    schema_invalid: number;           // JSON but not a LessonDraft
    compile_error: number;            // LessonDraft but compile_draft refused
    invalid_issue_paths: Record<string, number>;   // zod issue paths with numeric segments dropped, joined by ".", e.g. "blocks.code_origins"; counts issues
    check_clean: StageCount;          // D-3, denominator n
  };
  repair: { attempted: number; recovered: StageCount; outputs: number; output_compiled: StageCount };
  stored: { ready: StageCount; failed: StageCount };      // denominators n
  review: {                                               // ready lessons only, at each pinned version hash
    lessons_checked: number; lessons_pending: number;
    lessons_with_blockers: number;                         // among checked lessons: at least one open "blocking" issue
    blocking_by_kind: Record<string, number>;              // open blocking issue rows by kind
    open_by_kind: Record<string, number>;                  // all open issue rows by kind (every level)
    checked_through: number | null;                        // epoch ms
  };
  open_slots: { quote_placeholder: number; excerpt_slot: number; total: number; lessons_with_slots: number };
}
export interface FailureRecord { lesson_id: string; finished_at: number | null; reasons: string[] }   // reasons = reason_key list in stored order; first = reasons[0]
// added to FullRunFacts:
//   stages: FullRunStages;
//   failures_first_by_reason: Record<string, number>;
//   failure_chronology: FailureRecord[];          // failed lessons, ordered by finished_at (nulls last) then lesson_id
//   plan_job_cost: Usd;                           // sum of cost_usd on non-lesson job rows
//   job_cost_mismatches: string[];                // lesson ids where job.cost_usd differs from calls_cost_usd
//   checks_pending: number; checked_through: number | null;
// LessonFact gains: initial_stage: InitialDraftStage; repair_stage: InitialDraftStage | null; slot_nodes: number;
//   check_state: "checked" | "pending" | "no_version"; blocking_open: number; reasons: string[]; finished_at: number | null.
// LessonFact.first_failure becomes reasons[0] ?? null (a reason_key, not a bare check name).
```

**D-6. `full-run-initial.ts` exact API.**

```ts
export type InitialDraftStage = "no_output" | "unparseable" | "schema_invalid" | "compile_error" | "compiled";
export interface InitialDraftAssessment {
  stage: InitialDraftStage;
  issue_paths: string[];            // zod issue paths ("blocks.3.cfu"), "$" for unparseable; [] otherwise
  compile_message: string | null;   // CompileError message ("COMPILE_ERROR: reason at address"), never draft text
}
export function assess_initial_draft(
  raw_output: string | null,
  ctx: { row: NormalizedRow; unit_id: UnitId; schema_version: number },
): InitialDraftAssessment;
export const parse_valid = (s: InitialDraftStage): boolean => s === "schema_invalid" ? false : s === "compile_error" || s === "compiled";
```
Order: `null`/empty string gives `no_output`; `JSON.parse` throws gives `unparseable` with `["$"]`; `LessonDraft.safeParse` fails gives `schema_invalid` with `result.error.issues.map((i) => i.path.join(".") || "$")`; `template_for(ctx.row.lesson_type)` undefined gives `compile_error` with message `COMPILE_ERROR: template_missing`; `compile_draft` throwing `CompileError`/`CoreCompileError` gives `compile_error` with `e.message`; `RangeError` gives `COMPILE_ERROR: structure_invalid`; any other throw gives `compile_error` with `COMPILE_ERROR: unexpected` (never rethrow, never include the error text). It never logs and never returns draft text.

## 5. Steps (build order; each step ends with its check)

Work test-first inside each step: write the named tests with the code. Keep each file under the size caps of `.claude/rules` `code-structure` (`runs.ts` < 400, `full-run-*` < 400, tests < 300).

**Step 1. `packages/db/src/repos/runs-report.ts`: `count_slot_nodes`.** Pure walk of any JSON value: if it is an array, walk each element; if it is an object, and `typeof o.type === "string"`, add 1 to the matching counter when the type is exactly `"quote_placeholder"` or `"excerpt_slot"`; then ALWAYS walk every value of the object (a slot nested inside a list or table cell must count). Everything else is ignored. Input is `lesson_json->'sections'`. Test `runs-report.test.ts`: `count_slot_nodes_counts_nested`, `count_slot_nodes_ignores_filled_quote` (a `quote` node with `attrs.origin: "excerpt_slot"` counts 0), `count_slot_nodes_null_and_empty`.

**Step 2. `report_facts` and `placeholders_left` (same file, SQL steps; all reads in ONE `db.with_tx` read, SELECT only, parameterised).**
1. Load the run's lesson jobs: `SELECT id, lesson_id FROM lesson_job WHERE run_id = $1 AND kind = 'lesson' AND lesson_id IS NOT NULL ORDER BY queued_at, id`.
2. For each job, the version: `SELECT id, number, content_hash, lesson_json->'sections' AS sections, COALESCE((lesson_json->>'schema_version')::int, 1) AS schema_version FROM lesson_version WHERE run_id = $1 AND lesson_id = $2 AND kind = 'generated' ORDER BY number ASC LIMIT 1`. (Pin invariant: the run's own first generated version, never "the lesson's current version".) No row: `version: null`, `check.state: "no_version"`, zero slots, empty issues.
3. `slot_nodes = count_slot_nodes(sections)`.
4. Check state at the pinned hash: `checked` when `EXISTS (SELECT 1 FROM check_job WHERE lesson_id=$1 AND content_hash=$2 AND status='done') OR EXISTS (SELECT 1 FROM issue WHERE lesson_id=$1 AND content_hash=$2)`, else `pending`. `checked_at` = the later of `max(check_job.finished_at)` (status done) and `max(issue.created_at)` at that hash, or null when pending. (Why: a clean check leaves no issue row, so the done job is the only record of "checked and found nothing"; the existing `checked_hash_sql` in `issue-repo.ts` uses the same rule. Do not import it: it picks the newest hash, we need the pinned one.)
5. `open_issues`: `SELECT kind, level, count(*)::int AS count FROM issue WHERE lesson_id=$1 AND content_hash=$2 AND resolved_at IS NULL AND cleared_by IS NULL GROUP BY kind, level ORDER BY kind, level`.
6. `unconfirmed_alignment`: `SELECT count(*)::int FROM alignment_link WHERE lesson_id=$1 AND content_hash=$2 AND origin <> 'outline' AND confirmed_by IS NULL`.
7. `seed_doc_hash`: `SELECT content_hash FROM lesson_doc WHERE lesson_id=$1 ORDER BY seq ASC LIMIT 1`.
8. `calls_cost_usd`: `SELECT COALESCE(sum(cost_usd),0)::text FROM model_call WHERE job_id=$1 AND status='completed'`, wrapped in `new Decimal(...)`.
9. `checks_pending` = count of lessons with `check.state = "pending"`; `checked_through` = max `checked_at` of checked lessons.
Then in `runs.ts` `summary_rows`: delete the `issue`-table query; `placeholders_left` = sum over `report_facts` lessons of `quote_placeholder + excerpt_slot`. Add `async report_facts(run_id: RunId): Promise<RunReportFacts>` to `PgRunRepo` delegating to `runs-report.ts` (the function takes `PgDatabase`). `RunSummaryRows` and `RunRepo` are unchanged.
Tests `runs-report.int.test.ts` (Postgres; seed with `insert_row` from `packages/db/src/testing/insert-row.ts` and `PgRunRepo.insert_run`, as `runs.int.test.ts` does):
- `slot_nodes_counted_with_no_issue_rows`: a generated version with 2 `quote_placeholder` + 1 `excerpt_slot` (one nested inside a list), NO issue rows: `summary_rows().placeholders_left === 3` and `report_facts` lesson `slot_nodes` equals `{ quote_placeholder: 2, excerpt_slot: 1 }`.
- `pinned_to_the_runs_version`: add a second version (number 2, `kind='edit'` or any non-generated kind, different hash and no slots) and issue rows at the new hash: the run's facts are unchanged (still 3 slots, issues of the old hash only).
- `other_runs_version_is_ignored`: a generated version for the same lesson with another `run_id` is not picked.
- `pending_until_checked`: no `check_job`, no `issue` gives `pending`, `checks_pending 1`, `checked_through null`; insert a `check_job` (`status='done'`, `finished_at`) at the pinned hash gives `checked`, `checks_pending 0`, `checked_through` = that time.
- `open_issues_exclude_resolved_and_cleared`.
- `seed_doc_hash_is_lowest_seq` (two `lesson_doc` rows).
Existing `runs.int.test.ts` "summary_rows and active_runs read back what was written" must stay green unchanged (`placeholders_left` is 0 with no versions).

**Step 3. `evals/src/full-run-initial.ts` + test.** Implement D-6. Tests `full-run-initial.test.ts` (no database). Build the row and drafts the way `evals/src/suites/s6-world.ts` does: `normalize_outline(load_issued_grid(), load_standards_index(), 200).rows.find((r) => r.row_number === 9)` (imports `@ls/core/intake/normalize`, `@ls/core/intake/standards-index`, and `load_issued_grid` from `../../packages/core/tests/fixtures/outline/index.ts`); the valid draft is `stub_drafts("wp-2", null).repair` from `./suites/s3-run.ts`. Named tests: `assess_no_output_for_null_and_empty`, `assess_unparseable_json`, `assess_schema_invalid_reports_paths` (set a `cfu_item` block's `cfu` to `null`: paths contain a `blocks.<i>.cfu` entry), `assess_compile_error_section_not_in_template` (change one block's `section` to a name not in the template: stage `compile_error`, message contains `section_not_in_template`), `assess_compiled_for_valid_draft`, `assess_never_returns_draft_text` (the serialised assessment contains none of the draft's block text). If the wp-2 row has a different sheet row number in this repo, use `load_s3_cases()` (`evals/src/suites/s3-cases.ts`) to read each case's `sheet_row`.

**Step 4. `evals/src/full-run-facts.ts`: collect.** Move the types and `collect_full_run_facts` out of `full-run-report.ts` (re-export them from `full-run-report.ts`: `export { collect_full_run_facts } from "./full-run-facts.ts"; export type { FullRunFacts, LessonFact, FullRunStages, StageCount, FailureRecord } from "./full-run-facts.ts";`). Algorithm for `collect_full_run_facts(run_id, ports)`:
1. `rows = ports.runs.summary_rows(run_id)`, `totals = ports.calls.totals_for_run(run_id)`, `rf = ports.runs.report_facts(run_id)`, `outline = ports.outlines.rows(rows.run.outline_version_id)`; map `lesson_id -> NormalizedRow`.
2. `jobs` = `rows.jobs` with `kind === "lesson" && lesson_id !== null` (as today); `rf_by_lesson` map from `rf.lessons`.
3. Per job: `ran = tile_state is ready or failed` (unchanged). Original output: `const call = await ports.calls.completed_for(job.job_id, "lesson_draft", 1)`. Row = outline map lookup; if the row is missing, stage is `compile_error` only when the output parsed (record `compile_message: "COMPILE_ERROR: row_missing"`), otherwise classified as normal (parse/schema do not need the row; pass a placeholder never used: implement by calling `assess_initial_draft` only when the row exists, else classify parse-only with `LessonDraft.safeParse` via a small helper inside `full-run-initial.ts`: add the optional `row: NormalizedRow | null` to the ctx and return `compile_error` with `COMPILE_ERROR: row_missing` when it is null and the draft parsed). `schema_version = rf lesson.version?.schema_version ?? 1`; `unit_id = rows.run.unit_id`.
4. Repair output: only when `job.repairs >= 1`: `completed_for(job.job_id, "repair", 1)`, same assessment.
5. Tally per D-5. `check_clean` per D-3.
6. Failures: for each job whose `failure_reasons.length > 0`: `reasons = failure_reasons.map(reason_key)`; bump `failures_by_reason` for EVERY reason; bump `failures_first_by_reason` for `reasons[0]`; for failed lessons (`tile_state === "failed"`) push a `FailureRecord`. Sort the chronology by `finished_at` ascending (null last), then `lesson_id`.
7. Review and slots only for `tile_state === "ready"` lessons with a version: add `open_slots`; if `check.state === "checked"` add to `lessons_checked`, add `open_issues` to `open_by_kind` (key = kind) and, for level `blocking`, to `blocking_by_kind` and mark the lesson as a blocker; if `pending` add to `lessons_pending`. `grounding_flags_by_kind` = `open_by_kind` restricted to `GROUNDING_KINDS`. Disclosure count = open `disclosure_prompt` issues on lessons whose id matches `/\.L3[12]$/`. `confirmations` per lesson = `unconfirmed_alignment`; median exactly as today (copy the existing median code).
8. Round trip (ready lessons only): `round_trip = version !== null && seed_doc_hash !== null && seed_doc_hash === version.content_hash`.
9. Costs: `jobs_cost` = sum of LESSON job `cost_usd`; `plan_job_cost` = sum of non-lesson job `cost_usd`; `unattributed_cost = totals.unattributed_cost_usd ?? 0`; `job_cost_mismatches` = lesson ids whose `job.cost_usd` is not equal (Decimal `.eq`) to `calls_cost_usd`; `per_lesson_max`, `minutes`, `p95_minutes`, `wall_s`, `all_terminal`, `terminal_ok`, sorting of `lessons` unchanged from the current code.
`reason_key` is exported from this file.

**Step 5. `evals/src/testing/full-run-world.ts`: extend the fake to the new ports.** Add to `WorldLesson`: `initial: "valid" | "schema_invalid" | "compile_error" | "none"` (default `"valid"`), `repair_output: "valid" | "none"`, `slots: { quote_placeholder: number; excerpt_slot: number }` (replaces `placeholders`, same totals: 2 for L8, 1 for L9), `check_state` (default `"checked"`), `reasons: { check: string; check_kind?: string }[]` (empty), `blocking_open: number` (0). Fake ports: `runs.summary_rows` as today (`placeholders_left` = slot totals); `runs.report_facts` builds `RunReportFacts` from the lessons (version hash `hash-<id>`, `seed_doc_hash` = hash or `"other"` when `round_trip_ok` is false); `calls.totals_for_run` as today; `calls.completed_for(job_id, "lesson_draft", 1)` returns `{ raw_output, cost_usd } as never` with `raw_output` = a real valid LessonDraft JSON (the wp-2 draft from `stub_drafts("wp-2", null).repair` with `lesson_id` replaced) for `"valid"`, `"{"` for unparseable, the valid draft with one block's `section` changed for `compile_error`, the valid draft with a `cfu: null` for `schema_invalid`, and `null` for `"none"`; `purpose "repair"` likewise from `repair_output`; `outlines.rows` returns one `{ row }` per lesson: the wp-2 row with `lesson_id` replaced by the world lesson id. The fake's job rows get `failure_reasons` from `reasons`, and `repairs` as today. Remove the `issues`, `alignment`, `versions`, `docs` fakes.

**Step 6. `full-run-report.ts`: thresholds and render.** Keep `evaluate_s9_thresholds` ids exactly (`s9.ts` lists them). Changes:
- `first_pass_schema_valid_rate_ge_0.90`: `rate = stages.initial.compiled.count / n`; passed = `n > 0 && lessons_run > 0 && rate >= 0.9`; detail = `${compiled}/${n} original drafts parse and compile = ${rate.toFixed(3)} (M-31; ${parse_valid}/${n} parse, ${no_output} had no output); no repair needed ${check_clean}/${n}; stored ready ${ready}/${n}; ${lessons_run} ran`. When `lessons_run === 0` keep the text `not evaluated: 0 of ${n} lessons ran` (existing GEN-8 test).
- `totals_equal_call_sums`: `sums_equal = jobs_cost.plus(unattributed_cost).eq(cost_usd)`; `rollup_ok = plan_job_cost.isZero() || plan_job_cost.eq(unattributed_cost)`; `mismatch_ok = job_cost_mismatches.length === 0`; passed = `sums_equal && rollup_ok && mismatch_ok && api_equal`. Detail: `calls ${cost}, lesson jobs ${jobs_cost} + unit-plan call ${unattributed} (${plan_job_cost.isZero() ? "added back here: the job row was not rolled up" : "also on its job row " + plan_job_cost})${mismatch_ok ? "" : "; job cost differs from its calls for " + job_cost_mismatches.join(", ")}` plus the existing api suffix. Do not weaken this check if attempt 3 reports a mismatch: report it.
- Every other threshold keeps its logic. `round_trip_hash_all` now reads the pinned round trip.
- `render_full_run_markdown`: keep the header lines (`git_sha`, `prompt_version`, `models`, `provider_mode`, `n`, `single run, n = N`). Replace "## Counts" with the tables below (exact row labels; tests use `toContain`). Keep "## failures_by_reason", "## grounding_flags_by_kind", "## Thresholds" and "## Lessons" headings; add a column `initial draft` and `reasons` to the lessons table.

```
## Stages (each row is count/denominator)
| stage | value | what it measures |
| initial draft parses (schema-valid) | 44/47 | the ORIGINAL draft output validated as LessonDraft |
| initial draft compiles | 44/47 | and compile_draft accepts it (M-31) |
| initial draft had no output | 0 | counted in neither row above |
| no repair needed (recorded; checks were not re-run) | 19/47 (19/44 of compiled) | initial draft compiled, zero repairs, zero truncation retries, ended ready |
| repairs attempted | 28 | lesson jobs with at least one repair |
| repair recovered to ready | 11/28 | |
| repair output parses and compiles | 28/28 | |
| stored ready | 30/47 | |
| stored failed | 17/47 | |
| review blockers (ready lessons) | <k> of <checked> checked lessons; <p> pending | open blocking issues at each run version; "pending: p of m not yet checked" when p > 0 |
| open content slots | 20 (13 quote_placeholder, 7 excerpt_slot) in 16 lessons | counted in the stored lesson content, independent of issues |
| checks watermark | complete through <ISO time> | or `incomplete: <p> lessons pending` when p > 0, or `no checks recorded` when none checked |
```
The existing Counts rows that stay: `n`, `lessons run (ready or failed) | X of N` (the GEN-8 test greps `lessons run (ready or failed) | 0 of 47`), `repairs` (lesson-job repairs), `confirmations (median)`, `round trip`, `cost_usd`, `p95 minutes per lesson`. The old `first_pass_schema_valid` and `placeholders` rows are removed; `first_pass_schema_valid` stays only in the JS object. Add `## Initial draft failures` with the `unparseable / schema_invalid / compile_error` counts and `invalid_issue_paths` (paths and counts only). Add `## Failure chronology` (table: order, lesson_id, finished_at ISO or `n/a`, `reasons` joined by ` > `) and `## failures_first_by_reason`. When `checks_pending > 0` the `## grounding_flags_by_kind` section starts with the line `pending: <p> ready lessons not yet checked; counts below are partial`, and renders `- none yet` instead of `- none`.
- `build_full_run_report_detailed`: unchanged flow. `FullRunReport` keeps its fields; `first_pass_schema_valid` and `repairs` take the new meaning; `failures_by_reason` is the new keyed map. `failure_category` of each S9 case result becomes the first `reason_key`.
- Leak guard: the text may contain only ids, counts, kind names, ISO times and `COMPILE_ERROR: <reason> at <address>` style messages. Never put draft text, raw output or prompt text in the report. The existing `no_secrets_or_names_in_report` test must stay green.

**Step 7. Pending semantics in tests.** `full-run-report.test.ts` (rewrite the file, keep the NL-86 test names that still apply):
- keep `test_full_run_report_shape`, `path_stored_and_run_named`, `no_secrets_or_names_in_report`, `detailed result carries thresholds and the eval_run id`, the GEN-8 test; adjust: `first_pass_schema_valid` equals the count of world lessons whose `initial` is `"valid"`; `repairs` equals the sum of lesson repairs; `placeholders` is 3.
- `valid draft needing content repair stays schema-valid`: one lesson `initial: "valid"`, `repairs: 1`, ended ready: counted in `parse_valid` and `compiled`, NOT in `check_clean`.
- `invalid draft is not counted valid`: `initial: "schema_invalid"` and `"compile_error"`: `parse_valid` false for the first, true for the second; `compiled` false for both; the counters `schema_invalid` and `compile_error` each 1.
- `no-output failure does not count valid`: `initial: "none"`, job failed with reason `provider_error`: `no_output` 1, in neither valid count, `failures_by_reason` has `provider_error`.
- `repairs===0 is not the validity test`: a lesson with `repairs: 0` but `initial: "schema_invalid"` is not valid.
- `stages are separate rows with their own denominators`: assert the report text contains the exact rows `initial draft parses (schema-valid) | A/47`, `initial draft compiles | B/47`, `no repair needed (recorded; checks were not re-run) | C/47`, `repair recovered to ready | R/K`, `stored ready | `, with A, B, C, R, K computed independently from the fixture arrays.
- `failures keep their check kind`: two failed lessons with `check_failed` kinds `proper_noun_unsourced` and `page_out_of_range`: the keys `check_failed:proper_noun_unsourced` and `check_failed:page_out_of_range` appear; no bare `check_failed` key; the chronology lists the lessons in `finished_at` order; a lesson with two stored reasons contributes both to `failures_by_reason` and only its first to `failures_first_by_reason`.
- `pending checks print pending, not zero`: all ready lessons `check_state: "pending"`: `review.lessons_pending` equals the ready count, the text contains `pending`, and the blockers row does not print `0 of`.
- `open slots do not depend on issues`: world with slots and no issues: `open_slots.total` equals the fixture sum.
- `totals reconcile with and without the unit-plan rollup`: (a) `plan_job_cost 0`, unattributed 0.4: threshold passes; (b) job row for the plan carries 0.4 and unattributed 0.4: passes and the detail says `also on its job row`; (c) plan job row 0.3 vs unattributed 0.4: fails; (d) one lesson job cost differs from `calls_cost_usd`: fails and names the lesson.
The world needs a way to set these per test (mutate the returned `world.lessons[i]` and `world.extra_jobs`, as the GEN-8 test already mutates `tile_state`).
`full-run-report.int.test.ts` keeps its assertions (`total: 47, passed: 47`, 47 case rows) with the new fake.

**Step 8. `evals/src/full-run-deps.ts`.** Replace the `ports` object with `{ runs: runs_repo, calls: new PgModelCallLog(d), outlines: new PgOutlineRepo(d) }` where `const runs_repo = new PgRunRepo(d)`; delete the `generated_version` helper and the imports `PgIssueRepo`, `PgLessonDocReader`, `PgAlignmentRepo`, `LessonId`, `VersionId`, `LessonVersionRow` that become unused (`lessons` stays: `versions_for_s13: lessons`). Add `import { PgOutlineRepo } from "@ls/db/repos/outlines";`. `build_default_deps(env, provider_mode)` signature is unchanged (`s9.ts` and `full-run-main.ts` call it).

**Step 9. S3 observer: `s3-observe.ts`, `s3-assertions.ts`.**
1. In `observe(w, run_id, lesson_id)`: `const run = (await w.query<{ unit_id: string; prompt_version_id: string }>("select unit_id, prompt_version_id from run where id=$1", [run_id]))[0]`; `const row = w.rows.find((r) => r.lesson_id === lesson_id) ?? null`.
2. Replace the `first_pass` block: `const first_draft = calls.find((c) => c.purpose === "lesson_draft" && c.attempt === 1); const raw = first_draft?.status === "completed" ? first_draft.raw_output : null;` then `assess_initial_draft(raw, { row, unit_id: run.unit_id, schema_version: lesson?.schema_version ?? 1 })` (import from `../full-run-initial.ts`; pass `row: null` handling per Step 4.3). `initial_stage` = the stage, or `null` when there is no `first_draft` row at all. `schema_valid_first_pass` = `null` when stage is `no_output` or `initial_stage` is null, `true` when `compiled`, else `false`.
3. Provenance: `select p.id as prompt_version_id, p.number as prompt_number, p.locked_hash from run r join prompt_version p on p.id = r.prompt_version_id where r.id = $1`; observed `provenance: { prompt_version_id, prompt_number, locked_hash }` (all `null` when no row).
4. `s3-assertions.ts`: add to `S3Observed`: `initial_stage: "no_output" | "unparseable" | "schema_invalid" | "compile_error" | "compiled" | null;` and `provenance: { prompt_version_id: string | null; prompt_number: number | null; locked_hash: string | null };`. In `derive_trajectory`: `draft_ok` = a first draft call exists, its status is `completed`, `stop_reason !== "max_tokens"`, `initial_stage` is not `unparseable`/`schema_invalid`/`no_output`, and `reasons` has no `schema_invalid`/`truncated`; `compile_ok` = `initial_stage !== "compile_error" && !reasons.includes("compile_error")`. Do not touch `run_assertions`, the FC maps or any `expected.json`. Do not alter `FAILURE_KIND_TO_FC`/`CHECK_KIND_TO_FC`.
5. Tests: update the `S3Observed` literal in `s3-assertions.test.ts` (line ~27) with the two new fields; add `trajectory_names_compile_when_initial_draft_does_not_compile` (stage `compile_error` gives `first_failing_step: "compile"`), `trajectory_names_draft_when_initial_output_unparseable`, `trajectory_unchanged_for_compiled_initial_draft`. If any existing S3 test or `s3.int.test.ts` result changes after this step, stop and report; never edit an expected value to make it pass.

**Step 10. `s3.ts` + `s3-report.ts`: provenance and the M-31 line.**
- `s3.ts` `S3Actual` build: add `initial_stage: observed.initial_stage`, `prompt_versions: observed.provenance.prompt_version_id === null ? [] : [\`v${observed.provenance.prompt_number} locked ${observed.provenance.locked_hash.slice(0, 12)}\`]` (if `prompt_number` or `locked_hash` is null use `observed.provenance.prompt_version_id`), and `calls_completed: observed.calls.filter((x) => x.status === "completed").length`.
- `s3-report.ts` `S3Actual`: add required `initial_stage`, `prompt_versions: string[]`, `calls_completed: number`. Render lines (keep the six AC-4 fields in the first 40 lines, and keep existing field spellings):
  - `- prompt_version: ${recorded.length > 0 ? recorded.join(", ") : (r.prompt_version ?? "none recorded")}` where `recorded = uniq(all.flatMap((h) => h.actual.prompt_versions))`. The old `"none (stub)"` text is removed from this block.
  - `- provenance: recorded from the run rows of each case-repeat (prompt_version table, model_call rows). The "Suite S3" section above shows the runner's configured prompt_version and models, not what this run used.`
  - `- calls_recorded: ${completed} completed of ${total} (served_models above come from them)` where `completed` sums `calls_completed` and `total` sums `actual.calls.length`.
  - `- provider_mode: ${mode}` as before; when `mode === "real"` and `completed === 0` append ` (WARNING: no completed model call was recorded)`. Stub keeps ` (no model was called)`.
  - Replace the M-31 line with `- M-31 initial draft parses and compiles: ${compiled}/${all.length} (parse ${parsed}/${all.length}, no output ${none}; repairs used: ${repairs} of ${all.length})`, where `compiled` counts `initial_stage === "compiled"`, `parsed` counts `compile_error` or `compiled`, `none` counts `no_output` or null.
- Tests `s3-report.test.ts` (update the `actual()` helper with the new required fields): `shows the M-31 count as parse and compile` (replace the old `first-pass schema-valid: 3/4` test with the new line), `recorded provenance replaces none (stub)` (an input with `prompt_version: null`, `provider_mode: "real"` and `prompt_versions: ["v1 locked abcdef012345"]` prints `prompt_version: v1 locked abcdef012345` and does NOT contain `none (stub)`), `real mode with no completed call warns`, `stub mode says no model was called` (keep), `falls back to the runner value when no run recorded one` (the existing `prompt_version: pv_1` assertion).

**Step 11. S3 world check.** `s3-run.ts` needs no change (`observe(w, run_id, lesson_id)` keeps its signature). Run the S3 stub integration test (section 7). The stub run must still produce the same pass/fail as before: the WP-1 stub first draft is defective but, if it is schema-valid and compiles, its `initial_stage` is `compiled`; if it is not, the trajectory now names `draft`/`compile` instead of `checks`. In that case do NOT change the stub fixtures or expectations: record the finding in the report to the orchestrator.

**Step 12. Reconstruction command `evals/src/full-run-facts-main.ts`.** Usage `DATABASE_URL=<url of ls_nl112c> npx tsx evals/src/full-run-facts-main.ts <run_id>`. It calls `build_default_deps(process.env, "stub")`, then `collect_full_run_facts(run_id as RunId, d.ctx.ports)`, prints a plain-text stage summary to stdout (reuse the Stages/Failure rows from the renderer: export a small `render_stage_lines(facts): string[]` from `full-run-report.ts` and use it in both), and always closes the pool in `finally`. It must not call `build_full_run_report*`, `evidence`, `fs`, or any write. Exit code 2 with a one-line message when the run id argument or `DATABASE_URL` is missing.

**Step 13. Unit-plan cost rollup: `apps/worker/src/queue/claim-loop.ts`.** In the `job.kind === "unit_plan"` branch, before `await this.queue.finish(plan_outcome(job, out))`: compute `plan_cost = await this.plan_cost(job)` where the new private method sums `cost_usd` of `await this.calls.completed_for(job.job_id, "unit_plan", 1)` and `await this.calls.completed_for(job.job_id, "repair", 1)` (a null result adds 0; both calls use attempt 1 in `unit-plan-job.ts`, `request()` line ~190). Change `plan_outcome(job, out)` to `plan_outcome(job, out, cost: Usd)` and set `common.cost_usd = cost` (replacing `new Decimal(0)`). It applies to the stored, failed and capped outcomes alike (a failed plan still paid for its calls). Do not change any other outcome field. Test `claim-loop.test.ts` (extend the `unit_plan_job_routing` describe): `unit_plan_cost_rollup`: replace `w.calls.completed_for` on the world's `StubCalls` instance with a function returning `{ cost_usd: new Decimal("0.4") }` for purpose `unit_plan` and `{ cost_usd: new Decimal("0.1") }` for `repair`; after the drive, `w.queue.jobs[0]?.cost_usd.toString() === "0.5"`; and `unit_plan_cost_rollup_zero_when_no_completed_call` (default stub: `cost_usd` stays 0). The existing three routing tests must stay green unchanged. Do not edit `finalizer-doubles.ts` (shared).

**Step 14. Gates.** Run section 7. Then stop; do not commit doc changes (Part 2 is a separate lane).

## 6. Data and fixtures

Synthetic only; no model call, no key, no real student data.
- Unit and fake-world tests: the seeded `make_stub_world({ n: 47, seed: 86 })` (same LCG as today, `evals/src/testing/full-run-world.ts`); drafts and rows from the repo's own synthetic WP-1..WP-3 fixtures (`apps/worker/test/fixtures/stub-drafts/*.json` via `stub_drafts` in `evals/src/suites/s3-run.ts`; issued-outline grid via `load_issued_grid`).
- DB tests: rows seeded with `insert_row` into a fresh `create_test_db()` database (dropped in `afterAll`); lesson JSON is a hand-written object containing only `type`, `attrs` and `content` nodes, no prose from any real source.
- Reconstruction: READ-ONLY use of the kept database `ls_nl112c` (attempt 3) on `127.0.0.1:55440`. Get `DATABASE_URL` by sourcing `/tmp/nl112b/env` inside the shell (`set -a; . /tmp/nl112b/env; set +a`) and change only the database name in the URL to `ls_nl112c` if needed. Never print, log or copy that file's values. The command issues SELECTs only.

## 7. Checks

Iterate with the narrowest tests; run the lists once before the final commit.

No database needed:
```
npx vitest run evals/src/full-run-initial.test.ts evals/src/full-run-report.test.ts evals/src/suites/s3-report.test.ts evals/src/suites/s3-assertions.test.ts evals/src/suites/s3.test.ts evals/src/suites/s3-guards.test.ts packages/db/src/repos/runs-report.test.ts apps/worker/src/queue/claim-loop.test.ts
```
Database-backed (start the test Postgres on 127.0.0.1:55440 with `scripts/test-db.sh up`; NEVER run `down` or touch other databases; each test creates and drops its own `ls_t_*` database):
```
scripts/test-db.sh up
npx vitest run packages/db/src/repos/runs.int.test.ts packages/db/src/repos/runs-report.int.test.ts evals/src/full-run-report.int.test.ts evals/src/suites/s3.int.test.ts
```
Must stay green with no edit: everything above that existed before (`runs.int.test.ts`, `s3.int.test.ts`, `s3.test.ts`, `s3-guards.test.ts`, the three claim-loop routing tests), plus the S9 shell tests that import `full-run-report.ts` or `full-run-deps.ts`: `npx vitest run evals/src/runner.test.ts evals/src/cli.test.ts evals/src/suites/shells.test.ts evals/src/driver` (read the output; if one fails because of a changed `FullRunReadPorts` shape, fix the fake it uses, which must be inside an owned file; otherwise report).

Fast gates, once before the final commit (cheapest first): `npx eslint evals packages/db/src/repos apps/worker/src/queue` then `npm run typecheck` (root; runs each workspace's `tsc`). The type check must not report errors in files this slice does not own except those already failing on `main`; if it does, name them in the report.

Full suite: NOT required (no shared fixture, config or widely imported module changes; `FullRunReadPorts` is imported only by owned evals files). Say so in the report.

Reconstruction (acceptance, read-only, needs the kept database up):
```
set -a; . /tmp/nl112b/env; set +a        # do not print it; confirm DATABASE_URL names ls_nl112c, replace only the database name if not
npx tsx evals/src/full-run-facts-main.ts run_01M5W7VQFD6AEVPMPZA2Z4S9ZK
```
Passing looks like exactly: `initial draft parses (schema-valid) | 44/47`, `initial draft compiles | 44/47`, `initial draft had no output | 0`, `no repair needed ... | 19/47`, `repairs attempted | 28`, `repair recovered to ready | 11/28`, `repair output parses and compiles | 28/28`, `stored ready | 30/47`, `stored failed | 17/47`, `open content slots | 20 (13 quote_placeholder, 7 excerpt_slot) in 16 lessons`, failures `check_failed:proper_noun_unsourced` 15 and `check_failed:page_out_of_range` 2, and a check watermark line (its value is whatever the database holds: record it, do not assert it). Also compare: the sum of `invalid_issue_paths` should be 7 (audit: `initial_invalid_issue_paths.code_origins` 7); report any difference rather than adjusting. Totals line: lesson jobs cost + unit-plan call = the sum of stored calls, with `plan_job_cost 0` (this run predates the rollup, so the add-back is shown). If a number differs from the list above, the implementation is wrong or the data is: stop and report with the observed output; do not edit expectations.
Optional if reachable: the same command for attempt 2 (`run_01M5W6JK5XJQ7VE0WMR7HR1Z11`, `ls_nl112_dev`): expect `11/47` parses, `11/47` compiles, `no repair needed 0/47`, repairs attempted 47, repair output compiles 47/47, stored ready 8/47, slots `6 quote_placeholder` in 6 lessons.

Report evidence to the orchestrator: the vitest summaries, the lint/typecheck result and the pasted reconstruction output (no secrets).

## 8. Risks and requests

- **R-1 (request to integrator, shared surface).** The S3 `## Suite S3` header (`prompt_version: none (stub)` and the `provider_mode_note: "stub runs make no model call"` models line) is written by `evals/src/report.ts` from `EvalRunner.config` (`evals/src/runner.ts`, `evals/src/cli.ts` lines ~188-197), not by S3. This slice cannot edit them. It adds recorded provenance to the `## Detail S3` block and labels the header as runner config. A follow-up should let a suite supply provenance to the header (for example an optional `EvalSuite.provenance?()` in `evals/src/types.ts`) and drop the stub note when `provider_mode` is real. Requested, not added.
- **R-2 (limitation, follow-up).** "All findings" can only be as complete as what the worker stores. `failure_reasons_for` (`packages/core/src/pipeline/failure-reasons.ts`) records ONE `check_failed` reason with the first failing kind, and `fail-node.ts` calls it once. The report now prints every stored reason and the full chronology, but a lesson blocked by several kinds shows only the first. Storing every blocking kind needs a worker/core change outside this slice; request a ticket. The report states this limit in a one-line note under `## Failure chronology`: `stored reasons keep the first failing check kind per lesson`.
- **R-3 (file ownership stretch).** `evals/src/testing/full-run-world.ts` and the new `packages/db/src/repos/runs-report*.ts` files are not in the literal ownership list; they are the fake and the split-out parts of owned files. If the orchestrator's collision map lists them for another slice, tell me before building.
- **R-4 (behaviour change visible in the web UI).** `placeholders_left` in the run summary (`apps/web` "Placeholders left") now means slot nodes in the run's generated versions, so it no longer falls when a reviewer fills a slot later. This follows the handoff ("pin facts to the run's lesson versions"). The field name and type are unchanged, so no web edit is made.
- **R-5 (cost double-count hazard).** After Step 13 the plan job row carries the plan cost and `model_call` totals still include it. Any consumer that adds all job costs to `unattributed_cost_usd` would double count. In this repo only `full-run-report.ts` does; it now adds lesson jobs only (Step 4.9). `model-calls.ts` keeps `unattributed_cost_usd` as is.
- **R-6 (other slice).** The other slice's edits are in `packages/core/src/checks/**` only. This slice imports nothing from there (`full-run-initial.ts` uses `compile/**`, which is read only). No file overlap.
- **R-7 (S3 trajectory).** Step 9.4 makes the trajectory name the stage that actually failed (draft/compile) instead of `checks` when the initial draft did not compile. This is more accurate but could change a recorded S3 trajectory; the stub int test will show it (Step 11).
- **R-8 (run-id uniqueness).** `generated version = lowest number with run_id = this run`. If a run regenerates a lesson, the first generated version is used; later regenerations in the same run are ignored by design.
- No spec gap needs Innocent: every choice above is the recommended option under PD-32.

## 9. Readiness

**READY.** No `NEEDS-DECISION`, no `BLOCKED-ON`. The kept database `ls_nl112c` on 127.0.0.1:55440 must be reachable for the reconstruction step only.

---

# Part 2. Doc corrections: separate `lane::direct` list (do after Part 1 is merged and the reconstruction output exists)

One general agent; no tests; touch only the Markdown/JSON files below; before committing, `git diff --name-only` must show nothing that code or tests read (`evals/reports/*` are historical artifacts: do NOT edit them). Use the reconstruction output as the numbers; keep the original run artifacts unchanged.

1. `docs/testing/error-analysis/astra-audit-2026-10-26.json`: leave unchanged (it is the audit evidence).
2. `docs/delivery/error-analysis-real-run.md`: lines 13 and 18 say attempt 2 first-pass schema-valid was 0/47 and that every first draft failed on `blocks.N.cfu` (47/47). Replace with an "Audit note 2026-10-26" paragraph under the title: the original draft outputs of `run_01M5W6JK5XJQ7VE0WMR7HR1Z11` parse and compile 11/47 (`cfu` null issues: 71 issue rows; `code_origins`: 30), the old 0/47 came from treating `repairs === 0` as validity, and attempt 3 parses and compiles 44/47. Keep the original sentences struck through or quoted as "earlier claim, contradicted"; do not delete them. Line 64 ("all with 0 repairs, first pass valid") and line 74 ("Clean first pass 19 of 47") need the stage names used by the report: 19/47 is "no repair needed", not "schema-valid first pass".
3. `docs/delivery/real-model-results.md`: line 23 row "Clean first pass (no repair needed) | 0 of 47 (every first draft schema-invalid) | 19 of 47 (40%)": change the attempt-2 cell to `0 of 47 no repair needed (11 of 47 original drafts parse and compile)` and add rows `Initial draft parses and compiles | 11 of 47 | 44 of 47 (93.6%, meets the 90% M-31 target)` and `Stored ready | 8 of 47 | 30 of 47`; line 45: rewrite "The 90% first-pass target is not met: 40% were clean on the first pass" to say the M-31 parse-and-compile target is met (44/47) while 19/47 (40%) needed no repair and 30/47 (64%) ended ready; and note the report's earlier printed zero placeholders versus the 20 slot nodes (13 quote_placeholder, 7 excerpt_slot, 16 lessons).
4. `docs/devlog/2026-10-26-nl112-full-run-2.md`: line 14 ("First-pass schema-valid: 47 of 47 drafts parsed ... ") and line 32 ("first-pass 0/47") are contradicted both ways by direct validation (11/47). Append, do not rewrite, an `Audit note 2026-10-26` section stating the measured 11/47 and that both earlier statements are superseded. Same for `docs/devlog/2026-10-26-nl112-full-run.md` if it carries a first-pass figure. Add one new dev-log entry for this work in a new file `docs/devlog/2026-10-26-slice-b-report-stages.md` (Changed, Why, Checked, Remaining; 50-100 words) citing the reconstruction output.
5. `docs/ARCHITECTURE.md` lines 7, 127, 200; `SUBMISSION.md` line 22; `docs/delivery/demo-script.md` lines 18, 120, 126; `docs/delivery/2026-10-26-interview-prep.md` lines 18, 65; `docs/delivery/demo-decision-inventory.md` line 85: wherever "40% clean first pass" is offered as the failure of the 90% first-pass target, replace with the three separate figures (44/47 parse and compile meets the 90% M-31 target; 19/47 needed no repair; 30/47 ready) and keep "target not met" only for the ready rate if a ready-rate target exists. Keep "single run, n = 47". Do not claim lesson quality or reduced review time (handoff intro).
6. `docs/design/metrics-registry.md` M-31 (line 76): add one sentence to the definition column, "measured on the ORIGINAL draft output; repairs do not change it" (owner Innocent: if the file is treated as an agreed record, add the sentence as a dated clarification line instead of rewriting the row, and say so in the dev log).
7. `.claude/state/resume.md` line 9: replace the "30 of 47 lessons ready, 17 blocked ..." sentence's first-pass wording with the same three figures, and set the next action to the handoff's execution order step 3 onward. `docs/delivery/2026-10-26-astra-fix-handoff.md`: add a status line "Slice B (measurement) implemented, reconstruction: 44/47, 19/47, 30/47, 20 slot nodes" only after the reconstruction output exists.
8. `PROJECT-CHECKLIST.md` line 182 area and `.claude/state/icm-progress.md`: only if a row cites the old numbers (grep `0/47`, `47/47`, `first pass`); otherwise leave.
9. Context upkeep (rule `context-maintenance`): `.claude/reference/area-map.md` gets rows for `evals/src/full-run-initial.ts`, `evals/src/full-run-facts.ts`, `evals/src/full-run-facts-main.ts` and `packages/db/src/repos/runs-report.ts` (this is a doc edit under `.claude/`, lane::direct). Run `python3 ~/.claude/skills/icm-project/scripts/check_context.py /home/linuxuser/workspaces/inno-newsela` and fix any FAIL.

## Deviations (implementer, 2026-10-26)

- `FullRunFacts.checks_pending` and `checked_through` are review-scoped (ready lessons only), not run-wide from `report_facts`, so a failed lesson's missing check never makes the watermark read "incomplete". `report_facts` still returns the run-wide values.
- Lessons that never ran (tile_state not ready/failed) are not classified, so `no_output` counts only lessons that ran (GEN-8: zero ran gives zero, not 47).
- `placeholders_left` uses a lighter `placeholders_left(tx, run_id)` in `runs-report.ts` (same pinned-version rule, no issue/check reads) so the polled run summary stays cheap.
- `assess_initial_draft` takes `row: NormalizedRow | null` (Step 4.3) and returns `COMPILE_ERROR: row_missing`.
- Prettier was not applied (the repo's existing files do not pass `prettier --check`); eslint and tsc are clean on owned files.
