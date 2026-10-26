# Slice F4: trustworthy offline replay (pinned identity, read-only, output selection, provenance, denominators, attribution)

Planner: Opus-class, 2026-10-26. Repo `/home/linuxuser/workspaces/inno-newsela`, `main` at `45a2a63`. For `fanout-implementer` (Sonnet): every decision below is already made. Do not reopen them; if something here contradicts the code you see, stop and report, do not improvise.

## 1. Goal and sources

Deliver a corrected offline replay of the stored attempt-3 run (`run_01M5W7VQFD6AEVPMPZA2Z4S9ZK`, database `ls_nl112c`) and a dated correction of its report. Six obligations, from `docs/delivery/2026-10-26-contract-consistency-followup-handoff.md` section 3, items 1 to 5 and the three interpretation paragraphs after them (starting "The committed replay reports..."; "The 3/47 result is not a mathematical floor..."; "Expand actual boundary evidence", of which only the replay-side part is this slice):

| # | Obligation (handoff 3.n) | Deliverable |
|---|---|---|
| F4-1 | 3.1 pinned outline and accepted choices; compile row and general loader share one identity | `replay-finals-pin.ts` |
| F4-2 | 3.2 record omissions with timestamps; reproduce L31 safety-state difference; no lifecycle-equivalence claim | `replay-finals-lesson.ts`, `replay-finals-provenance.ts` |
| F4-3 | 3.3 read-only regardless of URL parameters; verify without printing credentials; stop on setup failure; keep the S1/S2 `eval_run` provenance note | `replay-finals-readonly.ts` |
| F4-4 | 3.4 output selection: original / effective / last repair / none, deterministic call order, truncation retry visible | `replay-finals.ts` (`select_output`) |
| F4-5 | 3.5 code commit + dirty-file hashes, schema/template/prompt/check identities, input hash; "historical outcome" vs "current-code reanalysis" | `replay-finals-provenance.ts`, record fields |
| F4-6 | interpretation paragraphs: both denominators (44 compiled / 47 total), reconcile "41 initial lessons fail", 3/47 is not a floor or forecast, the heading-lift is a simulation, A vs D attribution per commit boundary | `replay-finals.ts` helpers, `replay-finals-compare*.ts`, report correction section |

Sources read for this plan (the implementer need not re-read them all, but must read the owned files and the spans named in section 4): `evals/src/replay-finals-main.ts` (79 lines), `evals/src/replay-finals.ts` (103), `evals/src/replay-finals.test.ts` (60), `docs/testing/error-analysis/replay-2026-10-26.md` (180), `docs/devlog/2026-10-26-astra-replay.md` (9), `apps/worker/src/generation/nodes/compile-check-node.ts`, `apps/worker/src/generation/nodes/draft-node.ts`, `packages/core/src/checks/context-loader.ts`, `packages/core/src/checks/context-loader.test.ts` (fake-port precedent), `evals/src/full-run-facts.ts`, `packages/db/src/repos/{runs,model-calls,outlines,lessons,review-extras}.ts`, `packages/db/src/{pool,tx,testing/test-db}.ts`, `packages/db/migrations/0004_runs.sql`, `0005_traces.sql`, `0007_checks.sql`.

### Facts verified on the kept databases (read-only, via `docker exec newsela-test-postgres-1 psql -U ls -d <db> -c "begin read only; ...; rollback;"`, no credentials printed)

- `ls_nl112c`: one `run` (`run_01M5W7VQFD6AEVPMPZA2Z4S9ZK`, outline version `G6.U4.ov1`, prompt version `pr_01M5W7TNXN3RW5HBTC37H9SSPN`, `choices_hash` `746b10fb...`, 6 choices in `choices_json`), exactly one `outline_version` (`G6.U4.ov1`), 6 `intake_choice` rows. So in the real data a pinned replay and the current unpinned replay give the same outline; the pinning tests must therefore use fakes (section 5).
- `model_call` for the run: `lesson_draft` 47 rows / 47 jobs, `repair` 28 rows / 28 jobs (max 1 per job), `unit_plan` 1; all `status='completed'`; **`attempt = 1` on every row** (draft-node.ts:102 and repair-node.ts:51 hard-code `attempt: 1`), so `attempt` cannot order calls: order is `sent_at`, then `id`. **No `truncation_retry` row exists** in `ls_nl112c` or `ls_nl112_dev`; truncation selection is verifiable only on synthetic calls in unit tests, and the report must say the run never exercised it.
- `lesson_job` for the run: 47 `kind='lesson'` rows, `tile_state` ready 30 / failed 17, 19 with `repairs=0` and `tile_state='ready'` (= 47 - 28), 0 with `truncation_retries>0`. That 19 is the **historical outcome** first-pass-clean count.
- L31: `safety_flag` row `sf:G6.U4.L31:39` (status `open`) exists; it is created by `StoreNode` (`apps/worker/src/generation/nodes/store-node.ts:60-61`, `create_for_lesson`) **after** the generation gate ran. The original generation gate therefore saw no open flag. The current replay loads today's flags, so `safety_flag_open` for L31 in the old report (baseline 1, current 1) is an artefact of using present-day review state, not a generation-time verdict. This is the "L31 safety-state difference" to reproduce.
- Stray rows: `ls_nl112_dev.eval_run` holds `ev_01M5WGJNFD6JMQS1GAGQTWHGSH` (S1) and `ev_01M5WGJNN0NJCTJBY8EGP8K0HH` (S2), both started `2026-10-26 16:26:57 UTC`, `run_id` empty: the two accidental inserts of the devlog.
- Commit order (oldest first): `e7e72a3` base; `42f6989` C (repair request); `d727537` A (parity, source trust); `18a52cf` B (reports); `f236214` D steps 1-8; `99b8e77` D step 10; `88d6b97` D front matter + `code_not_allowed` unsuppressed; `f3aa33f`, `dda9f13`, `e6e0900` (docs, fixture, NL-120; the old report's "Current"); `f3ae6d7` replay tool; `6cc5e07` A name-at-start fix; `45a2a63` PD-39 rulings. Note `6cc5e07` sits **after** D in history, so "A alone" is `d727537`, and A's follow-up fix can only be seen as `88d6b97 -> 6cc5e07`.

## 2. Boundary

**Owned (the only files you may create or edit):**

Create:
- `evals/src/replay-finals-readonly.ts`, `evals/src/replay-finals-readonly.test.ts`, `evals/src/replay-finals-readonly.int.test.ts`
- `evals/src/replay-finals-pin.ts`, `evals/src/replay-finals-pin.test.ts`
- `evals/src/replay-finals-lesson.ts`, `evals/src/replay-finals-lesson.test.ts`
- `evals/src/replay-finals-provenance.ts`, `evals/src/replay-finals-provenance.test.ts`
- `evals/src/replay-finals-compare.ts`, `evals/src/replay-finals-compare.test.ts`, `evals/src/replay-finals-compare-main.ts`
- `evals/src/replay-finals-world.ts` (test-only fake-port builder, header comment says so; not collected as a test)

Modify:
- `evals/src/replay-finals.ts`, `evals/src/replay-finals.test.ts`, `evals/src/replay-finals-main.ts`
- `docs/testing/error-analysis/replay-2026-10-26.md` (append a new dated section at the end; keep every existing line)
- `docs/devlog/2026-10-26-astra-replay.md` (append an addendum; keep every existing line)
- New data artefacts under `docs/testing/error-analysis/replay-2026-10-26-f4/` (compact JSON from the tool, section 5)

**Shared surfaces, read only (never edit):** `packages/core/src/checks/context-loader.ts`, `packages/core/src/checks/**`, `packages/core/src/compile/**`, `packages/core/src/ports/**`, `apps/worker/src/generation/nodes/compile-check-node.ts`, `draft-node.ts`, `collaborators.ts`, `apps/worker/src/wiring/generation.ts`, `packages/db/**`, `packages/config/**`, `packages/prompts/**`, `packages/schema/**`, `.claude/**`, `docs/contracts/**`.

**Must not touch:** the untracked `evals/src/zz-replay.mts`, `zz-row.mts`, `zz-t.mts` (obsolete, owner has not confirmed cleanup; they may break `tsc`, see section 7), the dirty `apps/web/e2e/__screenshots__/**`, `tsconfig.tsbuildinfo`, `evals/reports/**`, anything owned by slices F1/F2 or D.

**Pinned-context seam: decision.** The replay needs no change to `context-loader.ts` or `compile-check-node.ts`: `CheckContextLoader` takes its ports in the constructor (`outlines`, `graph`), so the replay passes **pinned adapters** (section 4) and gets the pinned identity through the existing interface. That is the minimal seam and it touches no shared file. The production gap behind it is a **request to the owners of `context-loader.ts` / `compile-check-node.ts`**, section 8 (R-1), not work for this slice.

## 3. Requirements table

| ID | Requirement | Implementation | Verification (named test, command in section 7) |
|---|---|---|---|
| F4-1a | Replay loads the selected run's pinned outline version and accepted choices, not `lessons.source_outline_version` with latest-unit fallback and not `row_context(..., null)` | `load_run_pin` reads `PgRunRepo.get(run_id)` (`outline_version_id`, `choices_hash`, `prompt_version_id`, `created_at`) and `PgRunRepo.pinned_choices(run_id)`, the same call `DraftNode` makes (draft-node.ts:37). `PinnedOutlines.row_context` always passes `pin.choices`; `pinned_graph.source_outline_version` always returns `pin.outline_version_id` | `replay-finals-pin.test.ts`: `test_context_uses_pinned_outline_not_later_upload`, `test_row_context_receives_the_runs_choices_not_the_versions_stored_choices` |
| F4-1b | `CompileCheckNode`'s supplied row and the general `CheckContextLoader` use the same intended identity | The node's `row_context` comes from the same `PinnedOutlines`; after every run `assert_same_identity` compares version, `row_hash` and `canonical_json(row)` of the node's context with the loader's `CheckContext`; any difference throws `ReplayIdentityError` and aborts the replay (fail closed) | `test_same_identity_assert_throws_when_loader_follows_a_different_version`, `test_latest_unit_fallback_is_refused` |
| F4-1c | A later outline upload and changed intake choices do not change an earlier run's verdict | `replay_lesson` run twice over two fake worlds (before / after a later upload with a changed row and changed stored choices) | `replay-finals-lesson.test.ts`: `test_verdict_unchanged_by_later_upload_and_changed_choices`, control `test_unpinned_loader_would_follow_the_later_upload` (proves the test can fail) |
| F4-1d | Pinned choices are the ones the run hashed | `load_run_pin` recomputes `sha256(canonical_json(choices sorted by finding_id))` and compares to `run.choices_hash`; tries the parsed rows, then raw `choices_json`; neither matches -> `ReplayIdentityError("choices_hash_mismatch")` | `test_load_run_pin_*` in `replay-finals-pin.test.ts` |
| F4-2a | Omissions recorded with timestamps | `omissions(as_of, mode)` in provenance, written into the output JSON (`provenance.omissions[]` with `as_of` ISO) | `replay-finals-provenance.test.ts`: `test_omissions_carry_the_timestamp_and_mode` |
| F4-2b | L31 safety-state difference reproduced explicitly | Every record carries `state_probe` (kinds that appear only because of current review state). Default review context is `generation_time` (empty reviewer state); `--review-context current` reproduces the old report's context | `replay-finals-lesson.test.ts`: `test_open_safety_flag_blocks_only_with_current_review_context`, `test_state_probe_names_safety_flag_open`; real run: L31 under both modes (section 5, step 9) |
| F4-2c | No claim of lifecycle equivalence | Output JSON `provenance.claims` string and the report's "not claimed" list | review of the report section (checklist, section 5 step 11) |
| F4-3a | Read-only regardless of URL parameters | `read_only_database_url` parses the URL with `new URL`, **appends** `-c default_transaction_read_only=on` to any existing `options`, drops a top-level `default_transaction_read_only` parameter, keeps all other parameters; `ReadOnlyPgDatabase.with_tx` issues `SET TRANSACTION READ ONLY` as the first statement of every transaction (this covers every repo, which all use `db.with_tx`) | `replay-finals-readonly.test.ts` url cases; `replay-finals-readonly.int.test.ts`: `test_write_rejected_even_when_url_says_read_only_off` |
| F4-3b | Verify read-only state without printing credentials | `verify_read_only(db)` checks `show default_transaction_read_only = 'on'`, `show transaction_read_only = 'on'` inside a tx, and that `create temp table replay_ro_probe(x int)` fails with SQLSTATE `25006`; returns `{database, port, ...}` only; `redact(text, raw_url)` scrubs error text | `test_verify_*`, `test_redact_removes_password_user_and_url`, `test_main_output_has_no_credentials` (greps captured stdout/stderr of `connect_read_only` failure paths for the fake password) |
| F4-3c | On setup failure STOP; never fall back to an evidence database | `connect_read_only(env, factory)` reads **only** `env.DATABASE_URL`; a missing / invalid URL, failed connect, or failed verification throws `ReplaySetupError` once; main exits 3. No second URL is ever tried | `test_setup_failure_stops_and_never_tries_another_url` (spy factory called once; env also carries `TEST_DATABASE_URL`, which must not be used) |
| F4-3d | Retain the provenance note about the two accidental S1/S2 `eval_run` inserts | Kept verbatim in the devlog (existing item 4) and restated with ids in the addendum and in the report section | doc review; plus tool check: `row_counts` taken before and after the replay must be equal, else exit 5 (`test_row_counts_compare`) |
| F4-4 | Output selection separates original attempt, effective generated draft, last repair, no-output; deterministic order; successful truncation retry visible in final analysis | `select_output(calls, which)` replaces `pick_output` (section 4.2). Query selects `lesson_draft`, `truncation_retry`, `repair` with `id`, `attempt`, `status`, `stop_reason`, `sent_at` (UTC text, microseconds); helper sorts by `(sent_at, attempt, id)` by code-unit comparison, never `localeCompare` | `replay-finals.test.ts` `describe("select_output")` (8 named tests listed in step 3) |
| F4-5a | Record code commit + dirty-file hashes, schema/template/prompt/check identities, input hash | `collect_code_identity`, `tree_identity`, `input_hash` in provenance; written to `--out` JSON | `replay-finals-provenance.test.ts` tests (step 6) |
| F4-5b | Label "historical outcome" vs "current-code reanalysis" | Each record has `historical` (stored `lesson_job` values); output has `analysis: "current-code reanalysis"`, `historical_outcome` summary block; tables in the report carry the label in their heading | `test_historical_summary`, `test_calibrate_*` in `replay-finals.test.ts` |
| F4-6a | Publish both denominators | `Summary` gains `compiled`, `no_output`, `schema_invalid`, `compile_error`; `rate_text(count, s)` prints "n/47 total, n/44 compiled" | `test_summary_denominators`, `test_rate_text` |
| F4-6b | Reconcile "41 initial lessons fail" with 3/47 passing and 3 schema failures | `blocked_only_by` and the invariant `compiled - gen_pass = compiled-and-failing`; report section states: 44 compiled - 3 passing = 41 compiled-and-failing, plus 3 not compiled (schema failures) = 44 of 47 not passing | `test_blocked_only_by`; report section 5 step 10 |
| F4-6c | Wording: 3/47 is not a floor or forecast; heading-lift is a simulation | `lift_teaching_tags` doc comment and CLI printout say "simulation"; report correction replaces the sentences (list in step 10) | report review |
| F4-6d | Attribute slice A's cleared findings and slice D's new obligations separately, per commit boundary | `replay-finals-compare.ts` (`transitions`, `render_comparison`); worktree runs at the nine boundaries (step 9) | `replay-finals-compare.test.ts`; run outputs |

## 4. Shared code to use (copy these, do not paraphrase)

### 4.1 Imports and constructors already used by the current main (keep all of them; they exist at `e7e72a3` too, which matters for worktree runs)

```ts
import { read_secret_url } from "@ls/config/env";                     // read_secret_url(env, name, protocols): SecretStr
import { PgDatabase } from "@ls/db/pool";                             // new PgDatabase(settings, pool_max, acquire_timeout_ms, pool_name)
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { CheckContextLoader } from "@ls/core/checks/context-loader";  // ctor(outlines, standards, graph, reader, suggestions, flags, alignment, clock); load(lesson_id, lesson, content_hash): Promise<CheckContext>
import { CHECK_RULES, run_checks } from "@ls/core/checks/registry";   // run_checks(ctx, rules, policy): CheckResult
import { CHECK_POLICY } from "@ls/core/checks/policy";
import { PgLessonDocReader } from "@ls/db/repos/lesson-doc-reads";    // new PgLessonDocReader({ db } as never)
import { PgLessonRepo } from "@ls/db/repos/lessons";                  // used as the LessonGraphRepo
import { PgOutlineRepo, PgStandardRepo } from "@ls/db/repos/outlines";
import { PgAlignmentRepo, PgSafetyFlagRepo, PgSuggestionRepo } from "@ls/db/repos/review-extras";
import { CompileCheckNode } from "@ls/worker/generation/nodes/compile-check-node"; // ctor(loader, rules, policy, standards?)
import { generation_rules } from "@ls/worker/wiring/generation";      // generation_rules(rules): CheckRule[]
```

The current `new PgDatabase({ database_url, pg_pool_max: 2, build_id: "replay", log_level: "info" } as never, 2, 5000, "worker")` call and the `d = { db, ids, clock } as never` deps object stay as they are.

New imports (all exist at `e7e72a3`, verified): `import { PgRunRepo } from "@ls/db/repos/runs"` (`get(run_id): Promise<RunRow|null>`, `pinned_choices(run_id): Promise<IntakeChoiceRow[]>`), `import { PgPromptRepo } from "@ls/db/repos/prompts"` (`get(id)` returns a row with `locked_hash`), `import { canonical_json } from "@ls/schema/content-hash"`, `import { LOCKED_DIR, locked_hash } from "@ls/prompts/locked"` (`locked_hash(dir): string`).

Types to import with `import type`: `OutlineRepo`, `RowContext`, `IntakeChoiceRow` from `@ls/core/ports/outlines`; `LessonGraphRepo` from `@ls/core/ports/lesson-graph`; `StandardRepo` from `@ls/core/ports/standards`; `CheckContext`, `CheckFinding`, `CheckRule` from `@ls/core/checks/types`; `OutlineVersionId` from `@ls/core/ports/common`. The remaining port types (`LessonDocReader`, `SuggestionRepo`, `SafetyFlagRepo`, `AlignmentRepo`, `Clock`) are at `@ls/core/ports/{lesson-docs,suggestions,safety-flags,alignment,clock}`.

### 4.2 Shapes you must reproduce exactly

Current `replay-finals.ts` exports to keep unchanged: `KindCounts`, `delta`, `lift_teaching_tags` (the function body stays; only its doc comment is reworded to say "simulation"), `ReplayFinding`. `replay-finals.ts` must keep importing nothing from the project (node builtins such as `node:crypto` are allowed) so it still copies into an old worktree.

New/changed types in `replay-finals.ts`:

```ts
export type Which = "original" | "effective" | "last_repair" | "final";
export type CallPurpose = "lesson_draft" | "truncation_retry" | "repair";
export type StoredCall = { id: string; purpose: string; attempt: number; status: string; stop_reason: string | null; raw_output: string | null; sent_at: string };
export type OutputSource = { call_id: string; purpose: CallPurpose; attempt: number; sent_at: string; stop_reason: string | null };
export type NoOutputReason =
  | "no_draft_call" | "draft_call_has_no_output" | "truncated_without_completed_retry"
  | "retry_truncated" | "no_repair_call" | "repair_has_no_output";
export type Picked =
  | { raw_output: string; source: OutputSource }
  | { raw_output: null; reason: NoOutputReason };
export function select_output(calls: readonly StoredCall[], which: Which): Picked;
export function order_calls(calls: readonly StoredCall[]): StoredCall[];   // (sent_at, attempt, id) ascending, code-unit comparison
export type HistoricalOutcome = { tile_state: string; repairs: number; truncation_retries: number; failure_reasons: string[] };
export type ReviewContextMode = "generation_time" | "current";
export type StateProbe = {
  review_state: { safety_flags: string[]; pending_suggestions: number; confirmations: number; previous_lesson_flags: string[]; unit_coverage_cells: number; first_stored_at: string | null };
  gen_added_blocking_kinds: string[];
  review_added_blocking_kinds: string[];
};
export type IdentityTrace = {
  pinned_outline_version: string; loader_outline_version: string; node_row_hash: string; loader_row_hash: string;
  stored_source_version: string | null; latest_unit_version: string | null; unpinned_would_differ: boolean; choices_hash: string;
};
export type ReplayRecord = {
  lesson: string; which: Which; status: string;
  source: OutputSource | null; no_output_reason: NoOutputReason | null;
  schema_issues: string[]; compile_error: string | null;
  gen: ReplayFinding[] | null; review: ReplayFinding[] | null;
  review_context: ReviewContextMode;
  identity: IdentityTrace | null; state_probe: StateProbe | null;
  historical: HistoricalOutcome;
};
export type Summary = {
  lessons: number; compiled: number; not_compiled: number;
  no_output: number; schema_invalid: number; compile_error: number;   // no_output + schema_invalid + compile_error === not_compiled
  gen_pass: number; review_pass: number; gen_blocking: KindCounts; review_blocking: KindCounts;
};
export function summarize(records: readonly ReplayRecord[]): Summary;
export function rate_text(count: number, s: Summary): string;           // `${count}/${s.lessons} of all, ${count}/${s.compiled} of compiled`
export function blocked_only_by(records: readonly ReplayRecord[], gate: "gen" | "review", kinds: readonly string[]): { failing: number; only_listed: number };
export function historical_summary(records: readonly ReplayRecord[]): { lessons: number; ready: number; failed: number; clean_first_pass: number; repaired: number };
export function calibrate(records: readonly ReplayRecord[]): { agree: number; historical_clean_but_replay_fails: string[]; historical_repaired_but_replay_passes: string[] };
export function stable_json(v: unknown): string;                          // sorted keys, no whitespace
export function sha256_hex(s: string): string;
export function input_hash(inputs: unknown): string;                      // sha256_hex(stable_json(inputs))
```

`ReplayFinding` stays `{ kind, level, message, address, code, matched? }` in the type, but the tool **never writes `matched`** to disk (CheckFinding doc in `packages/core/src/checks/types.ts`: "In memory only"), and writes `message` only with `--messages`.

`historical_summary.clean_first_pass` = `tile_state === "ready" && repairs === 0 && truncation_retries === 0` (the same rule as `evals/src/full-run-facts.ts:160`, minus its draft-stage test). `calibrate` uses records of `which: "effective"`, `agree` counts lessons where (`historical clean_first_pass`) equals (`gen !== null` and no blocking in `gen`).

### 4.3 Pinned adapters (`replay-finals-pin.ts`), signatures

```ts
export class ReplayIdentityError extends Error {
  constructor(readonly code: "outline_version_mismatch" | "latest_unit_fallback" | "row_mismatch" | "choices_hash_mismatch" | "run_not_found" | "unsupported_call", detail: string);
}
export interface RunPin {
  run_id: string; unit_id: string; outline_version_id: OutlineVersionId;
  choices: IntakeChoiceRow[]; choices_hash: string; choices_hash_basis: "parsed" | "raw_json";
  prompt_version_id: string; prompt_locked_hash: string | null; created_at: string; // ISO
}
export class PinTrace { loader_row_hash: string | null; stored_source_version: string | null; latest_unit_version: string | null; reset(): void }
export async function load_run_pin(deps: {
  runs: { get(run_id: string): Promise<{ outline_version_id: string; unit_id: string; choices_hash: string; prompt_version_id: string; created_at: Date } | null>; pinned_choices(run_id: string): Promise<IntakeChoiceRow[]> };
  prompts: { get(id: string): Promise<{ locked_hash: string } | null> };
  raw_choices_json(run_id: string): Promise<unknown>;     // `select choices_json from run where id=$1` through the read-only db
}, run_id: string): Promise<RunPin>;
export class PinnedOutlines implements OutlineRepo { constructor(real: OutlineRepo, pin: RunPin, trace: PinTrace) }
export function pinned_graph(real: LessonGraphRepo, pin: RunPin, trace: PinTrace): LessonGraphRepo;
export function assert_same_identity(node_rc: RowContext, ctx: CheckContext, trace: PinTrace, pin: RunPin): IdentityTrace;
```

`PinnedOutlines` implements **every** `OutlineRepo` method (list from `packages/core/src/ports/outlines.ts`: `list_units, insert_version, version, rows, choices, upsert_choice, mark_confirmed, generate_gate_inputs, row_context, links`):
- `rows(v)` and `row_context(v, lesson_id, _choices)`: if `v !== pin.outline_version_id` throw `ReplayIdentityError("outline_version_mismatch")`; `row_context` delegates to `real.row_context(pin.outline_version_id, lesson_id, pin.choices)` (the third argument from the caller is ignored on purpose, including `null`), and stores `row_hash` in `trace.loader_row_hash` when the call came from the loader (the node's own call is made with `trace` detached: see step 4).
- `list_units()`: records `trace.latest_unit_version` from `real.list_units()` for the pinned unit **then throws** `ReplayIdentityError("latest_unit_fallback")` if the loader calls it (the loader only calls it when `source_outline_version` is null, which the pinned graph never returns).
- every write method and the rest: throw `ReplayIdentityError("unsupported_call", "<method>")`.

`pinned_graph`: `source_outline_version(lesson_id)` stores `await real.source_outline_version(lesson_id)` in `trace.stored_source_version` and returns `pin.outline_version_id`; `dependencies` and `dependants` delegate to `real` (the cross-lesson omission is applied afterwards on the context, so the counts of what was dropped can be recorded).

`assert_same_identity` throws `ReplayIdentityError("outline_version_mismatch")` unless `node_rc.outline_version_id === ctx.outline_version_id === pin.outline_version_id`, throws `("row_mismatch")` unless `node_rc.row_hash === trace.loader_row_hash` and `canonical_json(node_rc.row) === canonical_json(ctx.row)`; returns the `IdentityTrace`, with `unpinned_would_differ = (stored_source_version ?? latest_unit_version) !== pin.outline_version_id`.

### 4.4 Read-only (`replay-finals-readonly.ts`), signatures

```ts
export class ReplaySetupError extends Error { constructor(readonly code: "database_url_missing" | "database_url_invalid" | "connect_failed" | "read_only_not_enforced", message: string) }
export function read_only_database_url(raw: string): string;      // throws ReplaySetupError("database_url_invalid"); never echoes raw in the message
export function redact(text: string, raw_url: string): string;     // replaces the whole url, the password and the user name with "<redacted>"
export class ReadOnlyPgDatabase extends PgDatabase {              // overrides with_tx: first statement of every tx is "SET TRANSACTION READ ONLY"
  override with_tx<T>(fn: TxFunction<T>, advisory_lock?: string | null): Promise<T>;
}
export interface ReadOnlyEvidence { database: string; port: number | null; default_transaction_read_only: "on"; transaction_read_only: "on"; write_probe: "rejected_25006"; server_version: string }
export async function verify_read_only(db: Pick<PgDatabase, "with_tx">): Promise<ReadOnlyEvidence>;
export async function connect_read_only(env: Record<string, string | undefined>, factory?: (url: string) => Pick<PgDatabase, "with_tx" | "close">): Promise<{ db: ...; evidence: ReadOnlyEvidence }>;
export async function row_counts(db: Pick<PgDatabase, "with_tx">): Promise<Record<string, number>>; // run, lesson_job, model_call, eval_run, issue, lesson_version, safety_flag, intake_choice, outline_version
```

`TxFunction` and `Tx` come from `@ls/db/tx` (`Tx.query<R>(text, values?) => Promise<{ rows: R[]; rowCount: number }>`; `run_in_tx` issues `BEGIN` before calling your function, so `SET TRANSACTION READ ONLY` is legal as its first statement). `pool.ts` declares `with_tx<T>(fn: TxFunction<T>, advisory_lock: string | null = null)`. The pg error for a write in a read-only transaction has `.code === "25006"`.

`read_only_database_url` algorithm (invariant in brackets):
1. `new URL(raw)`; protocol must be `postgres:` or `postgresql:` [bad input fails closed without printing it].
2. Remove the top-level search parameter `default_transaction_read_only` if present [a URL cannot switch it off that way].
3. `existing = u.searchParams.get("options") ?? ""`; set `options` to `existing.trim() === "" ? "-c default_transaction_read_only=on" : existing.trim() + " -c default_transaction_read_only=on"` [libpq applies options left to right, so the appended `on` wins over an earlier `off`; every other parameter, including `sslmode`, is preserved].
4. Return `u.toString()`.

### 4.5 The two pieces of production semantics that `select_output` mirrors

- `DraftNode.run` (draft-node.ts:77-87): a first `lesson_draft` call whose `stop_reason !== "max_tokens"` is accepted; with `max_tokens` there is exactly one `truncation_retry` call, accepted unless it also stops with `max_tokens` (then the job ends with brake `truncation_retry` and **no draft**).
- `ModelCallLog.completed_for(job_id, purpose, attempt)` (model-calls.ts:70-81): usable = `status='completed' AND raw_output IS NOT NULL`, latest wins by `ORDER BY sent_at DESC, id DESC`.

## 5. Steps

Work in this order. After each step run that step's tests (section 7) before moving on. `replay-finals-main.ts` is a thin driver: no logic that a test could not reach.

### Step 1. `replay-finals.ts`: types, `select_output`, summaries, hashes

1. Add the types of 4.2. `usable(c) = c.status === "completed" && c.raw_output !== null`.
2. `order_calls` sorts by `sent_at` (fixed-width UTC text, compared with `<`/`>`), then `attempt`, then `id`. [Equal timestamps and `attempt` always 1 must still give one order, whatever the input order.]
3. `select_output(calls, which)` over `order_calls(calls)`. Let `drafts` = usable `lesson_draft`, `retries` = usable `truncation_retry`, `repairs` = usable `repair`; "last" = last element in order (matches `completed_for` DESC).
   - `original`: last of `drafts` -> `{raw_output, source}`; else if any `lesson_draft` call exists -> `draft_call_has_no_output`; else `no_draft_call`. (A truncated first draft is still the original attempt; `source.stop_reason` shows it.)
   - `effective` (what `DraftNode` accepted): `d = last of drafts`. No `lesson_draft` call -> `no_draft_call`; calls exist but none usable -> `draft_call_has_no_output`; `d.stop_reason !== "max_tokens"` -> `d` (any truncation_retry row is ignored: it cannot have been accepted); `d.stop_reason === "max_tokens"`: no usable retry -> `truncated_without_completed_retry`; last retry has `stop_reason === "max_tokens"` -> `retry_truncated`; else that retry.
   - `last_repair`: last of `repairs`; else some `repair` call exists -> `repair_has_no_output`; else `no_repair_call`.
   - `final`: last of `repairs` when any; otherwise the `effective` result (including its `reason`). [A successful truncation retry with no repair is therefore the final output; the old code returned the truncated first draft.]
4. `summarize` as specified (4.2): `compiled = records.filter(r => r.gen !== null).length`; `no_output` = records with `no_output_reason !== null`; `schema_invalid` = records with `no_output_reason === null && schema_issues.length > 0`; `compile_error` = records with `compile_error !== null`; invariant `no_output + schema_invalid + compile_error === not_compiled`. Existing fields keep their meaning (the old `toMatchObject` test must stay valid).
5. `rate_text`, `blocked_only_by` (among compiled records with at least one blocking finding in the gate: `failing` = their count; `only_listed` = those whose every blocking kind is in `kinds`), `historical_summary`, `calibrate`, `stable_json`, `sha256_hex` (`createHash("sha256")` from `node:crypto`), `input_hash`.
6. Reword the `lift_teaching_tags` comment: it is a **simulation of a model that follows the heading instruction**, not a measurement and not a forecast. Remove `pick_output`.

Tests (modify `replay-finals.test.ts`; keep the `lift_teaching_tags` describe and the `delta`/`summarize` cases; replace the `pick_output` describe):
`select_output`: `test_original_is_the_last_usable_draft_even_when_truncated`; `test_effective_is_the_truncation_retry_when_the_first_call_hit_max_tokens`; `test_effective_is_none_when_the_retry_is_also_truncated` (`retry_truncated`); `test_effective_ignores_a_stray_retry_when_the_first_call_finished` ; `test_final_is_last_repair_else_effective` (cases: draft+repair -> repair; draft only -> draft; truncated draft + successful retry, no repair -> the retry output, **the regression the old `pick_output` failed**; truncated + retry + repair -> repair); `test_order_is_sent_at_then_id_whatever_the_input_order` (shuffled input, identical `sent_at`, all `attempt` 1, ids `mc_b` < `mc_c`); `test_non_completed_calls_are_ignored` (status `failed`/`lost` with a `raw_output` string are not picked); `test_no_output_reasons` (table: each `NoOutputReason` produced exactly once across original/effective/last_repair).
`summarize`: `test_summary_denominators` (3 records: compiled 2, one `no_output`, one schema failure, one compile_error -> `lessons` = total, `compiled`, and the three counts add up to `not_compiled`), `test_rate_text`, `test_blocked_only_by`, `test_historical_summary`, `test_calibrate_names_the_disagreeing_lessons`, `test_input_hash_ignores_key_order_and_changes_with_an_output`.
Run: `npx vitest run evals/src/replay-finals.test.ts`.

### Step 2. `replay-finals-readonly.ts` and its tests

Implement 4.4. `verify_read_only` runs three separate `with_tx` calls: (a) `show default_transaction_read_only` and `show transaction_read_only` plus `select current_database() as db, inet_server_port() as port, current_setting('server_version') as v`; (b) the write probe `create temp table replay_ro_probe (x int)` inside `try`: success -> throw `ReplaySetupError("read_only_not_enforced")` (the throw rolls the tx back), error with code `25006` -> proceed, any other error -> `ReplaySetupError("read_only_not_enforced")` too. `connect_read_only`: `DATABASE_URL` missing/blank -> `database_url_missing`; build `read_only_database_url`; `read_secret_url({ DATABASE_URL: url }, "DATABASE_URL", ["postgres:", "postgresql:"])`; construct the default factory `new ReadOnlyPgDatabase({ database_url, pg_pool_max: 2, build_id: "replay", log_level: "info" } as never, 2, 5000)`; run `verify_read_only`; any failure -> close the db if it exists, throw `ReplaySetupError` whose message went through `redact(…, raw)`. **It reads no other environment variable.**
`row_counts`: one `select count(*)::int` per table in a fixed order, tolerating no missing table (a missing table is a setup error).

Tests, `replay-finals-readonly.test.ts` (fake `with_tx`): `test_url_without_query_gets_options`; `test_url_with_existing_query_keeps_params_and_appends_options` (`?sslmode=disable` and `?sslmode=disable&options=-c%20statement_timeout%3D5` -> decoded `options` is `-c statement_timeout=5 -c default_transaction_read_only=on`, `sslmode` kept); `test_url_asking_for_read_only_off_is_overridden` (`options=-c%20default_transaction_read_only%3Doff` ends with `-c default_transaction_read_only=on`; top-level `default_transaction_read_only=off` removed); `test_invalid_and_non_postgres_urls_throw_without_echoing` (message does not contain the input); `test_with_tx_sets_transaction_read_only_first` (record the statements of a fake client: first is `SET TRANSACTION READ ONLY`); `test_verify_rejects_when_default_is_off`; `test_verify_rejects_when_the_write_probe_succeeds`; `test_verify_accepts_25006`; `test_redact_removes_password_user_and_url`; `test_setup_failure_stops_and_never_tries_another_url` (env has `DATABASE_URL` = fake bad one and `TEST_DATABASE_URL` = another; factory spy called exactly once with a URL derived from `DATABASE_URL`; second URL never seen); `test_missing_database_url_throws`; `test_connect_error_text_has_no_credentials` (fake factory throws an Error whose message contains `postgres://u:s3cret@h/d`; the thrown message contains neither `s3cret` nor the URL); `test_row_counts_compare` (helper `same_counts(a, b)` or an equivalent pure comparison the main uses).
`replay-finals-readonly.int.test.ts` (real Postgres via `create_test_db()` from `@ls/db/testing/test-db`, same pattern as `evals/src/full-run-report.int.test.ts`; `afterAll` drops it): `test_write_rejected_even_when_url_says_read_only_off` — take `t.url`, append `?options=-c%20default_transaction_read_only%3Doff` (or `&options=…` when it already has a query), call `connect_read_only({ DATABASE_URL: thatUrl })`; expect `evidence.write_probe === "rejected_25006"`; `await expect(db.with_tx(tx => tx.query("create table replay_must_not_exist (x int)"))).rejects.toMatchObject({ code: "25006" })`; a `select 1` succeeds; the table does not exist afterwards (`t.db.with_tx` on the unrestricted handle). `test_setup_failure_does_not_fall_back`: `connect_read_only({ DATABASE_URL: "postgres://u:p@127.0.0.1:1/none" })` rejects with `ReplaySetupError` code `connect_failed` and the message contains no `:p@`.
Run: `npx vitest run evals/src/replay-finals-readonly`.

### Step 3. `replay-finals-pin.ts` and `replay-finals-world.ts`

Implement 4.3. `load_run_pin`: `run = await deps.runs.get(run_id)`; null -> `ReplayIdentityError("run_not_found")`; `choices = await deps.runs.pinned_choices(run_id)`; `sorted` = by `finding_id` code-unit order; `hash(parsed) = sha256_hex(canonical_json(sorted))`; if equal to `run.choices_hash` -> basis `parsed`; else `raw = await deps.raw_choices_json(run_id)`, sort the raw array by `finding_id`, `sha256_hex(canonical_json(…))`; equal -> basis `raw_json`; else `ReplayIdentityError("choices_hash_mismatch")` (the run's recorded hash is the authority; if neither form matches, stop and report to the orchestrator, do not loosen). `canonical_json` and the hashing come from `@ls/schema/content-hash` and `node:crypto` (`createHash("sha256")`), the same as `apps/web/src/server/services/run-service.ts:148` (`sha256_hex(canonical_json(sorted))`).
`prompt_locked_hash` = `(await deps.prompts.get(run.prompt_version_id))?.locked_hash ?? null`.

`replay-finals-world.ts` (test-only): builds the fake ports for `CheckContextLoader`, following `packages/core/src/checks/context-loader.test.ts` lines 62-135 (`outlines`, `standards`, `graph`, `reader`, `suggestions`, `flags`, `alignment`, cast with `as never`). Fixtures: `packages/core/tests/fixtures/row-wp1.json` (parsed with `NormalizedRow.parse`) and `draft-wp1.json` (parsed with `LessonDraft.parse`; set the Look Back block's `minutes` to 5 exactly as `good_wp1_draft()` in `apps/worker/src/generation/nodes/testing/fixtures.ts:42` does), lesson id `G6.U4.L4`, outline version ids `G6.U4.ov1` (the run's) and `G6.U4.ov2` (the later upload). Options: `later_upload: boolean` (adds `ov2` whose L4 row has a different `title` and `focus_codes: ["W.6.2"]`, makes `list_units().latest_outline_version_id` and the graph's `source_outline_version` return `ov2`, and changes the stored `intake_choice` set returned by `outlines.choices`), `flags: SafetyFlagRow[]`. Standard rows come from a local copy of `standard_rows(row)` (see fixtures.ts:82: `{ code, set, text: "Official text of <code>", parent_code: null, is_leaf: true, eld_strand: null }`). `standards.index()` returns `{ leaves_of: (c) => [c], text_of: () => null, resolve: () => { throw new Error("x"); } }`.

Tests, `replay-finals-pin.test.ts`: `test_context_uses_pinned_outline_not_later_upload` (real `CheckContextLoader` over `PinnedOutlines` + `pinned_graph` in the `later_upload` world: `ctx.outline_version_id === "G6.U4.ov1"`, `ctx.row.title` is the ov1 title, `allowed_codes` from ov1); `test_row_context_receives_the_runs_choices_not_the_versions_stored_choices` (spy on the real fake's third argument: deep-equals `pin.choices`, and the returned `choices` are the pin's); `test_latest_unit_fallback_is_refused` (graph fake returning null cannot happen through `pinned_graph`, so call `PinnedOutlines.list_units` through a loader whose graph is the unpinned fake and expect `ReplayIdentityError` code `latest_unit_fallback`); `test_rows_of_another_version_are_refused`; `test_same_identity_assert_throws_when_loader_follows_a_different_version` (hand a `CheckContext` with `outline_version_id: "G6.U4.ov2"` and expect `ReplayIdentityError` `outline_version_mismatch`; another with a different row hash -> `row_mismatch`); `test_identity_trace_reports_what_unpinned_production_would_have_used` (`unpinned_would_differ` true in the later-upload world, false otherwise); `test_load_run_pin_accepts_matching_hash`, `test_load_run_pin_falls_back_to_raw_json_hash`, `test_load_run_pin_stops_on_hash_mismatch`, `test_load_run_pin_stops_when_run_missing`; `test_unsupported_methods_throw`.
Run: `npx vitest run evals/src/replay-finals-pin.test.ts`.

### Step 4. `replay-finals-lesson.ts` (per-lesson replay)

```ts
export interface LoaderPorts { outlines: OutlineRepo; standards: StandardRepo; graph: LessonGraphRepo; reader: LessonDocReader; suggestions: SuggestionRepo; flags: SafetyFlagRepo; alignment: AlignmentRepo; clock: Clock }
export interface ReplayJob { job_id: string; run_id: string; lesson_id: string; status: string; historical: HistoricalOutcome; calls: StoredCall[] }
export interface InputItem { lesson: string; row_hash: string; standards_sha256: string; selections: { which: Which; call_id: string | null; output_sha256: string | null; reason: NoOutputReason | null }[] }
export function apply_review_context(ctx: CheckContext, mode: ReviewContextMode): { ctx: CheckContext; omitted: { links: number; linked_lessons: number; dependency_states: number } };
export function make_replay_env(ports: LoaderPorts, pin: RunPin, opts: { lift: boolean; review_context: ReviewContextMode; messages: boolean; first_stored_at: (lesson_id: string) => Promise<string | null> }): {
  replay_job(job: ReplayJob, whiches: readonly Which[]): Promise<{ records: ReplayRecord[]; input: InputItem }>;
  trace_omissions(): { links: number; linked_lessons: number; dependency_states: number };   // totals over the whole replay
};
```

`apply_review_context` always sets `links: []`, `linked_lessons: []`, `linked_states: {}` (cross-lesson omission, counts recorded before clearing, as the old `loader` wrapper did). In mode `generation_time` it also sets `pending_suggestions: []`, `safety_flags: []`, `confirmations: []`, `previous_lesson_flags: []`, `unit_coverage: []` [at generation time the lesson was not stored yet: StoreNode creates flags afterwards, and no reviewer state existed]. In mode `current` those five fields keep what the database holds now.

`replay_job` per `which` (algorithm; invariant in brackets):
1. `picked = select_output(job.calls, which)`; if `lift`, apply `lift_teaching_tags` to a non-null output [simulation, label the record via the top-level `lift` flag in provenance]. Null output -> record with `no_output_reason`, `gen`/`review` null, `identity` null.
2. Build the same stub state as the current main (`job: { job_id, run_id, unit_id, lesson_id, schema_version: 1, prompt_version_id: "replay", outline_version_id: pin.outline_version_id }`, `context: { row_context, standards, raw_output, calls: [] }`). `row_context` is obtained **once per lesson** from `PinnedOutlines` with the trace detached (so the loader's later call is the one recorded in `trace.loader_row_hash`): `rc = await pinned.row_context(pin.outline_version_id, lesson_id, null)`. `standards` = `await ports.standards.texts(codes)` where `codes` is `[...new Set([...row.focus_codes, ...row.eld_codes, ...row.msls_codes].flatMap(c => idx.leaves_of(c)))]` (copy from current main lines 56-57).
3. Node: `new CompileCheckNode(loader, generation_rules(CHECK_RULES), CHECK_POLICY, ports.standards as never)`, where `loader.load` calls the real `CheckContextLoader` (built over `PinnedOutlines` and `pinned_graph`), keeps the raw context in `raw`, and returns `apply_review_context(raw, mode).ctx`. `trace.reset()` before each `node.run`.
4. When `res.check_result` and a context was loaded: `ident = assert_same_identity(rc, raw, trace, pin)` [throws -> the whole replay aborts]; `gen = shape(res.check_result.findings)`; `review = shape(run_checks(applied, CHECK_RULES, CHECK_POLICY).findings)`.
5. `state_probe`: `empty = apply_review_context(raw, "generation_time").ctx`, `cur = apply_review_context(raw, "current").ctx`; `gen_added_blocking_kinds` = sorted blocking kinds in `run_checks(cur, generation_rules(CHECK_RULES), CHECK_POLICY)` that are absent from the same call on `empty`; `review_added_blocking_kinds` likewise with `CHECK_RULES`. `review_state` counts come from `raw` (`safety_flags` -> flag ids, `previous_lesson_flags` -> ids), `first_stored_at` from `opts.first_stored_at(lesson_id)` (min `stored_at` of the lesson's `lesson_version`, ISO, null when none) [this timestamps when the flag could first have existed; there is no `created_at` on `safety_flag`].
6. `shape` copies `kind, level, address, code` and `message` only when `opts.messages`; it never copies `matched`.
7. `input` item: `row_hash` = `rc.row_hash`, `standards_sha256` = `sha256_hex(stable_json(standards))`, per selection `output_sha256` = `sha256_hex(raw_output text actually replayed, after lift)`.

Tests, `replay-finals-lesson.test.ts` (real `CompileCheckNode`, real rules, fake ports from `replay-finals-world.ts`): `test_verdict_unchanged_by_later_upload_and_changed_choices` (replay the same stored output in world A (no upload) and world B (`later_upload: true`); `deepEqual` on `gen`, `review`, `schema_issues`, `compile_error`; both `identity.loader_outline_version === "G6.U4.ov1"`; in B `unpinned_would_differ === true`); `test_unpinned_loader_would_follow_the_later_upload` (control: a plain `CheckContextLoader` over world B's raw fakes returns the ov2 title, so the pinning is what makes the previous test pass); `test_open_safety_flag_blocks_only_with_current_review_context` (world with one open flag: mode `generation_time` has no `safety_flag_open` in `gen`, mode `current` has it, both from the same output); `test_state_probe_names_safety_flag_open` (probe `gen_added_blocking_kinds` contains `safety_flag_open` in both modes; `review_state.safety_flags` lists the flag id); `test_cross_lesson_fields_are_always_cleared_and_counted`; `test_missing_output_gives_a_no_output_record` (`no_output_reason` set, `gen === null`, no throw); `test_identity_error_aborts_the_replay` (a loader fake that returns another version -> `replay_job` rejects with `ReplayIdentityError`); `test_records_never_carry_matched_or_message_by_default` (use a draft that triggers a grounding finding if one is cheap to build from `packages/core/src/checks/rules/grounding` tests; otherwise assert on a `safety_flag_open` finding that `message` is absent unless `messages: true`; do not invent a new draft fixture beyond that).
Run: `npx vitest run evals/src/replay-finals-lesson.test.ts`.

### Step 5. `replay-finals-provenance.ts`

```ts
export interface DirtyFile { status: string; path: string; sha256: string | null }
export interface CodeIdentity { commit: string; commit_date: string; dirty_files: DirtyFile[]; dirty_other_count: number; tracked_diff_sha256: string }
export interface TreeIdentity { sha256: string; files: Record<string, string> }  // rel path -> sha256, "absent" when the directory does not exist
export function parse_porcelain_z(s: string): { status: string; path: string }[];  // `git status --porcelain=v1 -z --untracked-files=all`; handles rename entries (two NUL fields) and untracked
export function collect_code_identity(root: string, run?: (cmd: string, args: string[]) => string): CodeIdentity;
export function tree_identity(root: string, rel_dir: string): TreeIdentity;        // non-test files only
export function collect_identities(root: string): { schema: TreeIdentity; template_and_compile: TreeIdentity; checks: TreeIdentity; check_wiring: TreeIdentity; prompt_locked_hash_current: string };
export function omissions(as_of: Date, mode: ReviewContextMode, counts: { links: number; linked_lessons: number; dependency_states: number }): { item: string; effect: string; as_of: string }[];
export interface ReplayProvenance { /* see below */ }
```

- `collect_code_identity`: `git rev-parse HEAD`, `git show -s --format=%cI HEAD`, `git status --porcelain=v1 -z --untracked-files=all`. Dirty files are listed (with `sha256` of the working-tree content, `null` when deleted) only when their path starts with one of `packages/`, `apps/worker/`, `apps/collab/`, `evals/src/`, `evals/cases/`, `scripts/`, `docs/testing/`; all other dirty paths (the screenshots, `tsconfig.tsbuildinfo`) are only counted in `dirty_other_count`. `tracked_diff_sha256` = sha256 of `git diff HEAD -- packages apps/worker apps/collab evals/src evals/cases scripts`. The default `run` is `execFileSync(cmd, args, { encoding: "utf8", cwd: root })` as in `evals/src/git-sha.ts`. `root` is resolved from `import.meta.url` exactly as `git-sha.ts` does (`path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")`), so a copy of the file inside a worktree reports that worktree.
- `tree_identity`: recursive walk, exclude `node_modules`, any `*.test.ts`, any `*.int.test.ts`, directories named `fixtures`, `testing`, `tests`, and files named `test-helpers.ts`; hash = sha256 of lines `"<relpath>\0<file sha256>\n"` sorted by relpath (code-unit order). Directory missing -> `{ sha256: "absent", files: {} }`.
- `collect_identities` directories: `schema` = `packages/schema/src`; `template_and_compile` = `packages/core/src/compile`; `checks` = `packages/core/src/checks`; `check_wiring` = a synthetic identity over the three files `apps/worker/src/wiring/generation.ts`, `apps/worker/src/generation/nodes/compile-check-node.ts`, `apps/worker/src/generation/nodes/front-matter-standards.ts` (absent files recorded as `"absent"`); `prompt_locked_hash_current` = `locked_hash(LOCKED_DIR)`.
- `omissions` returns exactly these five items (strings are free text but each must name the item and the affected kinds): (1) cross-lesson links, linked lessons and dependency states cleared (affects `cross_lesson_link`, `linked_text_changed` and the waiting phase; counts from `counts`); (2) reviewer state: in `generation_time` mode safety flags, pending suggestions, confirmations, previous-lesson flags and unit coverage are emptied (the lesson was not stored yet); in `current` mode they are today's values (`as_of` = the database time) and are **not** what the original gate saw; (3) standards texts come from today's database, not versioned; (4) prompt is not re-rendered: drafts were written under the run's prompt version, `prompt_locked_hash` of the run vs current is recorded; (5) no model call, no cost, no repair is re-executed: a repair prompt built from new findings would differ. Every item's `as_of` is `as_of.toISOString()`.
- `ReplayProvenance` fields (all required): `tool: "replay-finals"`, `label: string` (from `--label`), `analysis: "current-code reanalysis"`, `claims: "Re-checks stored model outputs on the code at <commit>; it is not the original run's metric, not a forecast, and not a full lifecycle equivalent."`, `started_at`, `finished_at`, `db_now`, `read_only: ReadOnlyEvidence`, `row_counts_before`, `row_counts_after`, `run: { run_id, unit_id, outline_version_id, prompt_version_id, prompt_locked_hash, choices_hash, choices_hash_basis, choices_count, created_at }`, `code: CodeIdentity`, `identities`, `review_context`, `lift: boolean`, `whiches`, `input_hash`, `omissions`, `calls_by_purpose: Record<string, number>` (counts of rows per `purpose` for the run, so the report can say the truncation path was not exercised).

Tests, `replay-finals-provenance.test.ts` (temp dir via `fs.mkdtempSync`, fake `run`): `test_parse_porcelain_z_handles_rename_untracked_and_modified`; `test_code_identity_lists_only_code_paths_and_counts_the_rest`; `test_tree_identity_excludes_tests_fixtures_and_changes_with_content`; `test_tree_identity_absent_directory`; `test_tree_identity_order_independent` (create files in two orders, same hash); `test_omissions_carry_the_timestamp_and_mode`; `test_omissions_name_every_cleared_field`.
Run: `npx vitest run evals/src/replay-finals-provenance.test.ts`.

### Step 6. `replay-finals-main.ts` (thin driver)

Keep the header comment, update it. CLI: `--run <run_id>` (required), `--which original,effective,last_repair,final` (comma list; default `effective,final`; `initial` and `both` are **rejected** with the usage text, no silent alias), `--lift-tags`, `--review-context generation_time|current` (default `generation_time`), `--label <text>`, `--out <file.json>`, `--messages`. Flow:
1. `connect_read_only(process.env)`; on `ReplaySetupError` print `replay setup failed: <code>` plus the redacted message and `process.exit(3)`. Print `evidence.database`, `evidence.port` and the read-only flags; never the URL.
2. `row_counts_before`; `PgRunRepo`, `PgPromptRepo`, repos as in 4.1; `pin = await load_run_pin({ runs, prompts, raw_choices_json }, run_id)`. `ReplayIdentityError` -> print code, exit 4.
3. Jobs: `select id, run_id, lesson_id, status, tile_state, repairs, truncation_retries, failure_reasons_json from lesson_job where run_id=$1 and kind='lesson' and lesson_id is not null order by lesson_id`; `failure_reasons` strings by `r.check_kind ? \`${r.check}:${r.check_kind}\` : r.check` (copied one-liner of `reason_key`, `evals/src/full-run-facts.ts:100`, **not imported**: that file does not exist at `e7e72a3`). Calls: `select id, purpose, attempt, status, stop_reason, raw_output, to_char(sent_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as sent_at from model_call where job_id=$1 and purpose in ('lesson_draft','truncation_retry','repair')`. All queries go through the read-only db; `first_stored_at` = `select to_char(min(stored_at) at time zone 'UTC', …) from lesson_version where lesson_id=$1`.
4. For every job: `replay_job`; collect records and inputs. Compute `input_hash` over `{ run: {run_id, outline_version_id, choices_hash, prompt_version_id}, review_context, lift, whiches, lessons: inputs }` (**not** over code identity, so the same stored inputs give the same `input_hash` at every commit).
5. `row_counts_after`; if different from before, print the differing tables and `process.exit(5)` after writing nothing.
6. Output JSON (`--out`): `{ provenance, summaries: Record<Which, Summary>, historical_outcome: historical_summary(records), calibration: calibrate(records of "effective") , records }`. `provenance.finished_at` set last. Print to stdout: for each `which`, `rate_text` for `gen_pass` and `review_pass`, the denominators, `not_compiled` split, and the label line `analysis: current-code reanalysis (historical outcome printed separately)`.
No credentials, no raw outputs, no lesson text in any printed or written field.

### Step 7. `replay-finals-compare.ts` (+ `-compare-main.ts`)

```ts
export interface Boundary { label: string; commit: string; code_dirty: boolean; input_hash: string; summaries: Record<string, Summary>; records: ReplayRecord[] }
export function load_boundary(path: string): Boundary;   // reads the tool's --out JSON; throws if analysis !== "current-code reanalysis" or review_context differs between files (caller checks)
export function transitions(prev: readonly ReplayRecord[], next: readonly ReplayRecord[], gate: "gen" | "review"): { newly_blocked: string[]; newly_unblocked: string[]; still_blocked: number; still_passing: number };
export function render_comparison(bs: readonly Boundary[], which: Which): string;   // markdown, see below
```
A lesson "passes" a gate when `gen`/`review` is not null and has no blocking finding; a lesson that did not compile does not pass. `render_comparison` emits, for `which`: (a) a header table (label, commit, dirty?, `input_hash` first 12 chars, and a **warning line if the `input_hash` values differ**); (b) per gate a table "lessons passing" with `rate_text` per boundary (both denominators); (c) per gate a per-kind table of lessons with a blocking finding, one column per boundary, and one `delta` column for each consecutive pair (`delta()` from `replay-finals.ts`); (d) per consecutive pair the `transitions` counts and the lesson ids of `newly_blocked` / `newly_unblocked`. It ends with the fixed sentence: "Attribution is order-dependent: slice D's commits sit on top of slice A's, so there is no D-without-A run; each step shows what that commit changed on top of the previous one." CLI: `npx tsx evals/src/replay-finals-compare-main.ts --which final a.json b.json ...` prints the markdown.
Tests, `replay-finals-compare.test.ts` (inline synthetic records): `test_transitions_by_lesson`, `test_not_compiled_is_not_passing`, `test_render_has_both_denominators_in_every_pass_cell`, `test_render_warns_when_input_hash_differs`, `test_render_per_kind_delta_column`.
Run: `npx vitest run evals/src/replay-finals-compare.test.ts`.

### Step 8. Typecheck and lint pass (section 7), then commit the code and tests alone (`test(evals): trustworthy replay ...`), so the worktree runs below use a committed tool.

### Step 9. Run the replay (RUNTIME; no model call, no spend)

Environment: build `DATABASE_URL` for `ls_nl112c` without printing it, from the repo's committed test-server default, once per shell:
`export DATABASE_URL="$(npx tsx -e 'import { TEST_DATABASE_URL as t } from "@ls/db/testing/test-db"; const u = new URL(t); u.pathname = "/ls_nl112c"; process.stdout.write(u.toString())')"` (run from the repo root; never `echo` it). The server is `newsela-test-postgres-1` on `127.0.0.1:55440` and is up. Never connect to a database to write.

a. **HEAD run, both contexts.** From the repo root, for `--review-context generation_time` and `--review-context current`, each with and without `--lift-tags`, `--which effective,final`, `--label "HEAD 45a2a63..."` and `--out` to `/tmp/newsela-f4/head-<mode>[-lift].json`. Expect: `provenance.read_only` shows `rejected_25006`; `row_counts_before` equals `row_counts_after`; `calls_by_purpose` is `{lesson_draft: 47, repair: 28, unit_plan: 1}` (outcome handling: any `truncation_retry` row would be a surprise; report it and show the lesson's `source.purpose`); `identity.unpinned_would_differ` is false for all 47 (single outline version; if any is true, report which and why).
b. **Calibration (RUNTIME).** At the base commit (below) with `--review-context generation_time`, `effective` `gen_pass` is expected to be 19 of 47 (47 total, 44 compiled, so also 19/44 of compiled) and `calibration.agree` should be 47. Outcomes: equal -> state "reproduces the historical first-pass count lesson by lesson". Different count or `historical_clean_but_replay_fails` / `historical_repaired_but_replay_passes` non-empty -> list the lessons in the report, and do not call it a reproduction; check whether L31 (`G6.U4.L31`) is the only difference and say so with its `state_probe`.
c. **Per-commit boundaries**, via temporary worktrees. Existing registered worktrees belong to other tickets (`git worktree list` shows `newsela-GEN-8`, `NL-109`, `SP-1..3`): touch only yours. For each `<sha>` in this list, with label in brackets: `e7e72a3` [base], `42f6989` [C: control, rules unchanged], `d727537` [A], `18a52cf` [B: control], `f236214` [D1], `99b8e77` [D2], `88d6b97` [D3], `6cc5e07` [A follow-up], `45a2a63` [PD-39 = HEAD]:
   ```
   git worktree add --detach /tmp/newsela-f4/wt-<sha> <sha>
   scripts/link-node-modules.sh /tmp/newsela-f4/wt-<sha>
   cp evals/src/replay-finals.ts evals/src/replay-finals-readonly.ts evals/src/replay-finals-pin.ts evals/src/replay-finals-lesson.ts evals/src/replay-finals-provenance.ts evals/src/replay-finals-main.ts /tmp/newsela-f4/wt-<sha>/evals/src/
   (cd /tmp/newsela-f4/wt-<sha> && npx tsx evals/src/replay-finals-main.ts --run run_01M5W7VQFD6AEVPMPZA2Z4S9ZK --which effective,final --label "<label> <sha>" --out /tmp/newsela-f4/<sha>.json)
   git worktree remove --force /tmp/newsela-f4/wt-<sha>
   ```
   (`DATABASE_URL` stays exported.) Copy **only** the six non-test files; the copied files show up as untracked in that worktree's `dirty_files`, which is expected and must be mentioned in the report. If a run fails at an old commit because an import does not exist there, stop and report the missing symbol: do not patch the old commit and do not weaken the tool (all imports in 4.1 were checked at `e7e72a3`; `generation_rules`, `CHECK_RULES`, `CHECK_POLICY`, `CompileCheckNode` all exist there, and `CompileCheckNode`'s fourth constructor argument is simply ignored by older code). After the loop `git worktree prune` and confirm `git worktree list` equals the pre-run list.
d. **Comparison.** `npx tsx evals/src/replay-finals-compare-main.ts --which final /tmp/newsela-f4/e7e72a3.json ... /tmp/newsela-f4/45a2a63.json` and the same with `--which effective`. If the `input_hash` values differ across files, stop: the inputs moved (check the `calls_by_purpose` and the run's `choices_hash`).
e. **L31.** From the HEAD runs (both modes) extract L31's `effective` and `final` records: `gen` blocking kinds in `generation_time` vs `current`, `state_probe.review_state.safety_flags` (`sf:G6.U4.L31:39`), `first_stored_at` (the proxy for when the flag could first exist). Expected: `safety_flag_open` absent in `generation_time` and present in `current`; `safety_note_without_tip` and `standard_not_taught` present in both. If not, report the actual kinds.
f. **Commit the compact artefacts** (no `message`, no `matched`, no raw output): copy the nine `--out` files plus the two HEAD-mode files into `docs/testing/error-analysis/replay-2026-10-26-f4/` as `<label-slug>-<sha>.json`; write the `render_comparison` output to `docs/testing/error-analysis/replay-2026-10-26-f4/comparison-<which>.md`. Check the size (`du -sh` should be well under 1 MB; if the records are too large, drop `records` for the control commits `42f6989` and `18a52cf` and keep their summaries).

### Step 10. Report correction (docs only, `docs/testing/error-analysis/replay-2026-10-26.md`)

Append, after the last line, a section `## Correction and re-run (slice F4, 2026-10-26)`. Do not edit or delete any earlier line (an earlier sentence being corrected is quoted and answered, not erased). Required content, in this order:

1. **What this section replaces and what it keeps.** One paragraph. The earlier tables are kept as originally published; where they conflict with this section, this section governs.
2. **Labels.** "Historical outcome" = what the run itself stored (`lesson_job`): 47 lessons, 30 ready / 17 failed, 28 repaired, 19 clean first pass (47 - 28). "Current-code reanalysis" = stored outputs re-checked on the code at a named commit. Every table below states which one it is. The reanalysis is never the original run's metric.
3. **Provenance table.** One row per boundary run: commit, dirty/untracked code paths (say "only the six copied tool files" for the worktree runs), `identities` (first 12 chars of schema / template_and_compile / checks / check_wiring hashes and the current vs run `prompt_locked_hash`), `input_hash` (first 12; identical across rows), review context mode, `db_now`, database name and port from the tool (no URL). A line stating the earlier report named its states `e6e0900` / `f3aa33f` and that later dirty rulings and `6cc5e07` / `45a2a63` are different candidates.
4. **Pinned inputs.** The run's outline version `G6.U4.ov1`, `choices_hash`, 6 choices, `choices_hash_basis`; `unpinned_would_differ` false for all 47 in this database (one outline version, so this run's numbers do not change from pinning); the pinned-adapter design and R-1.
5. **Both denominators.** Tables per `which` with `rate_text` cells, e.g. effective drafts under the generation gate: pass / 47 total / 44 compiled.
6. **Reconciliation of "41 initial lessons fail".** From the tool output, with the actual numbers: of 47 stored outputs, 44 compile (3 schema failures, none lack output); at HEAD 3 pass the generation gate, so 44 - 3 = 41 compiled lessons fail and 3 more never compile, i.e. 44 of 47 do not pass; "34 of the 41 are blocked only by the four slice D kinds" recomputed with `blocked_only_by(records, "gen", ["standard_not_taught", "standard_not_checked", "code_not_allowed", "section_missing"])` at the HEAD row of the table (quote the new number and say if it differs from 34; at HEAD the PD-39 rulings are applied, so the number refers to the kinds' presence, say which commit).
7. **Attribution table** from `comparison-final.md` / `comparison-effective.md` (summarised, with the files linked): what A (`e7e72a3 -> d727537`) cleared (`proper_noun_unsourced`, `page_out_of_range`, `schema_invalid` as the tool shows), what each D commit added, what `6cc5e07` changed (name-at-start fix; `proper_noun_unsourced` 0 -> n), what PD-39 changed; the two controls (`42f6989`, `18a52cf`) must show **no** change in verdicts (state it, or list the lessons that moved if they did). Include the order-dependence sentence. Slice A's clearing and slice D's obligations are separate rows and are never summed into one "net".
8. **L31 safety state, reproduced.** The table from step 9e. State plainly that the old report's L31 `safety_flag_open` was produced by today's review state (the flag was created by `StoreNode` after the generation gate), so it is not a generation-time verdict; the default replay now uses an empty review state and the `current` mode is the opt-in view.
9. **Output selection.** The definitions (original / effective / last repair / none, with the five `NoOutputReason`s), the call order rule and the call-count facts: this run has 47 drafts, 28 repairs, **0 truncation retries**, so the truncation-retry path is covered by unit tests only and no number in this report depends on it. The old `initial` columns equal `effective` here because no first draft hit `max_tokens`.
10. **Omissions with timestamps.** The five items from `provenance.omissions` with their `as_of`, and the sentence: "This replay does not establish lifecycle equivalence: no cross-lesson links, no reviewer state at generation time, no re-run repairs, no prompt rendering, standards texts as of the replay time."
11. **Wording corrections.** A table: *earlier sentence -> correction*. At least these:
    - "Treat 6% as the floor, not the forecast." -> 3/47 is neither a floor nor a forecast. It is a point measurement of old outputs written under the previous prompt, re-checked on one commit; a model given the new prompt may do better or worse.
    - "A what-if that fixes only the heading tags (below) lifts it to 6/47 initial and 9/47 final" -> the heading-lift mutates the stored drafts; it is a simulation of a model that follows an instruction, not a measurement.
    - "The replay reproduces the real first-pass number exactly." -> restate with the lesson-by-lesson `calibrate` result from step 9b, and note it was measured under a different review context than the original gate.
    - "Slice A did what it promised: the 15 name and 2 page false positives are gone" and "Slices B and C do not touch the rule sets" -> restate from the attribution table and the controls.
    - "Current = e6e0900 ... the checker code is unchanged since f3aa33f" -> name the exact commits and dirty state from the provenance table.
    - "41 initial lessons fail" -> as in item 6.
    - The earlier audit replay that cleared 17 terminal name/page blockers under a narrower patch is a **different experiment** from this one and did not claim that all 47 would pass the strengthened standards rules; do not combine the two.
12. **What is not claimed** (bullet list): not a forecast; not a floor; no model call; no lifecycle equivalence; the heading-lift is a simulation; attribution is order-dependent; reviewer-state numbers (`current` mode) are today's, not the run's; production `CheckContextLoader` is not pinned (R-1).

### Step 11. Devlog addendum (`docs/devlog/2026-10-26-astra-replay.md`, append only)

Add `**Addendum 2026-10-26 (slice F4).**` with Changed / Why / Checked / Remaining in about 100 words: the tool changes (pinned identity, read-only enforcement, output selection, provenance, denominators), the correction section link, the test result, and the remaining items (R-1; D-only attribution impossible; truncation path unexercised by data). Restate the provenance note: "Accidental writes: two `eval_run` rows in `ls_nl112_dev` (`ev_01M5WGJNFD6JMQS1GAGQTWHGSH` S1 and `ev_01M5WGJNN0NJCTJBY8EGP8K0HH` S2, 2026-10-26 16:26:57 UTC, stub provider) from the first `eval:golden` attempt; no other change; the replay now compares row counts before and after and fails if they differ." Do not edit the existing four paragraphs.

## 6. Data and fixtures

- Unit and int tests: synthetic only. Row and draft from `packages/core/tests/fixtures/row-wp1.json` and `draft-wp1.json` (WP-1, issued sample data, no student or staff data); all other values inline. The int test uses a throwaway `ls_t_<hex>` database from `create_test_db()` (server `127.0.0.1:55440`, started by `scripts/test-db.sh up`; it is already up).
- Real-data evidence: `ls_nl112c` run `run_01M5W7VQFD6AEVPMPZA2Z4S9ZK` (model-written lessons from the Newsela issued sample outline G6.U4, produced by NL-112 attempt 3), read only. `ls_nl112_dev` (attempt 2) is **not** replayed by this slice; mention it only for the S1/S2 provenance note.
- Checked-in artefacts hold finding kinds, levels, addresses, codes and counts only: no `matched`, no `message`, no raw model output, no lesson text.

## 7. Checks

Iterating (per step): `npx vitest run evals/src/replay-finals` (all files in the family; add `.test.ts`/`.int.test.ts` suffix to narrow). Expected: all pass; the int test needs the Postgres on 55440.

Must stay green (not edited here, run once to prove nothing shifted): `npx vitest run packages/core/src/checks/context-loader.test.ts apps/worker/src/generation/nodes/compile-check-node.test.ts evals/src/full-run-facts` (the last pattern only if a file of that name exists; otherwise `evals/src/full-run-report.test.ts`).

Once before the final commit of the code (fast gates, cheapest first): `npx eslint evals/src/replay-finals*.ts` then `npx tsc -p evals/tsconfig.json --noEmit`, then the iterating tests again. Known noise: the untracked `evals/src/zz-replay.mts` "no longer typechecks" (devlog). If `tsc` reports errors, filter by file: errors only in `zz-*.mts` are pre-existing and not yours (report them, do not delete or edit those files); any error in an `replay-finals*` file is yours to fix. No full suite (nothing shared changed; build-loop-test-scope).

Docs: `python3 ~/.claude/skills/icm-project/scripts/check_context.py /home/linuxuser/workspaces/inno-newsela` reports no FAIL; every link you added in the report and devlog resolves.

Proof it works on data: step 9 outputs (a)-(f). Passing means: read-only evidence present, row counts unchanged, identical `input_hash` across the nine boundaries, controls unchanged, and calibration described honestly whichever way it came out.

## 8. Risks and requests

- **R-1 (request to the owners of `packages/core/src/checks/context-loader.ts`, `apps/worker/src/generation/nodes/compile-check-node.ts` and `collaborators.ts`; not done here).** In production the generation gate is not pinned to the run. `CompileCheckNode` compiles with the pinned row (`ctx.row_context.row`, compile-check-node.ts:41) and then calls `loader.load(job.lesson_id, compiled.lesson, compiled.content_hash)` (line 67), where `CheckContextLoader.load` picks `graph.source_outline_version(lesson_id)` and, for a lesson with no stored generated/adopted version, falls back to the unit's latest outline version (context-loader.ts:36-41) and reads choices with `row_context(version, lesson_id, null)` (line 58). After a later upload, a first generation (or any regeneration under an older pin) compiles against one row and checks against another. Proposed minimal seam: `CheckContextLoaderPort.load(lesson_id, lesson, content_hash, pin?: { outline_version_id: OutlineVersionId; choices: readonly IntakeChoiceRow[] })`; when `pin` is given the loader skips both lookups and calls `row_context(pin.outline_version_id, lesson_id, pin.choices)`; `CompileCheckNode` passes `{ outline_version_id: ctx.row_context.outline_version_id, choices: ctx.row_context.choices }`; test: a later-upload fake world as in `replay-finals-world.ts`. This replay does not depend on it (its adapters already pin); once it lands, `PinnedOutlines`/`pinned_graph` can shrink to a call-site pin. `unpinned_would_differ` in the output is the measured exposure for this run (false for all 47 here).
- **Collision surface:** none by file. The slice owns only `replay-finals*` and two docs; the report/devlog are not owned by D or A. The `.claude` router rows and `.claude/reference/area-map.md` need rows for the new `evals/src/replay-finals-*.ts` files and the new artefact folder, and the resume file needs a pointer to the correction section: **request to the integrator / coordinating writer** (context-maintenance rule), not edited here.
- **Calibration may move** when the default review context changes from today's state to `generation_time` (L31 is the only lesson with an open flag in this database; step 9b says what to do for each outcome). That is a finding, not a failure of the slice.
- **Old-commit runs** depend on imports existing at each commit; checked for `e7e72a3` and the current main imports; the first failing import stops the run and is reported.
- **`PgDatabase` subclass:** `ReadOnlyPgDatabase` overrides only `with_tx`; if some repo bypasses `with_tx`, the URL option and `verify_read_only` still hold. `ping()` and `close()` are inherited.
- **Spec gap (stated, not decided for Innocent):** the handoff asks to "reproduce L31's safety-state difference" but does not say which context is the "right" default. Adopted (PD-32): the generation-gate replay uses the state that existed at the gate (empty reviewer state); the live-state view is the `current` option and is reported alongside.
- **No-decision items adopted:** `initial` is retired as a name (it meant "first lesson_draft output"; now `original`/`effective`); `matched` is never written; the compact artefacts are committed, the full local outputs stay in `/tmp`.

## 9. Readiness

**READY.** No product decision is needed and no prerequisite is missing: the pinned-context seam is achieved through the loader's constructor ports (no shared file edited), the kept databases and the test Postgres are reachable (checked read-only on 2026-10-26), and every symbol imported by the tool exists at the oldest boundary commit `e7e72a3` (checked with `git show e7e72a3:<file>`). Open items by class:
- RUNTIME: calibration outcome (step 9b); L31 kinds (step 9e); the exact numbers of the 41/44/3 reconciliation and of the attribution tables; whether any `unpinned_would_differ` is true (expected none). Each has its stated handling.
- CONTRACT-QUESTION: none.
- FREEDOM: internal helper names beyond those listed; markdown layout of `render_comparison` beyond the required tables and sentence.
