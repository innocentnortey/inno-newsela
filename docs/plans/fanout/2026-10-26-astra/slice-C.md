# Slice C: give the existing repair attempt usable evidence

Plan for `fanout-implementer` (Sonnet). Date 2026-10-26. Base `main` e7e72a3 plus uncommitted edits by slice A under `packages/core/src/checks/**`. Readiness: **READY** (see section 9).

## 1. Goal and sources

Today `RepairNode` sends the model only the draft, the template, generic finding lines (`kind: message @ address`) and schema paths. `repair.md` tells the model to obey the lesson card, page range and allowed names, but none of that is in the request, and the new `CheckFinding.matched` field (the name or page reference that tripped a grounding check) is dropped. After this slice:

1. A repair request carries the **same pinned authoritative blocks as the generation request** (lesson meta, template, standards, title, segments, homework, pages, text_set, vocabulary, focus/eld/msls codes, arc header, neighbours, unit rules, links, plan entries, reviewer note), built by **one shared function**, so the two cannot drift.
2. Each finding line also carries the exact flagged name or reference (`matched`) and the standard `code` when present, in a parseable format.
3. Data delimiters are preserved (every block goes through `data_block`).
4. One repair only (unchanged: `max_repair_rounds: 1`).
5. The repair locked text says what to fix and what to leave alone.

Sources:
- `docs/delivery/2026-10-26-astra-fix-handoff.md`, section "Give the existing repair attempt usable evidence" (Cause, Change, Acceptance) and "Execution and evidence order" step 3 and 4.
- `docs/testing/error-analysis/astra-audit-2026-10-26.json`: evidence that repair recovered 11/28 in attempt 3 (39.3%); its replay says parser/check fixes explain the remaining failures, so do not claim model-repair gains from this slice.
- `docs/design/observability.md`, section "Content and redaction": rendered prompt and raw output are stored raw on every `model_call` by design (R-48, SD-8.7).
- Code read: `apps/worker/src/generation/nodes/{repair-node,draft-node,job-state,compile-check-node}.ts`, `packages/prompts/src/{render,inputs,data-block,locked}.ts`, `packages/prompts/locked/repair.md`, and the frozen tests listed in section 3.

## 2. Boundary

**Owned (create or modify):**
- MODIFY `apps/worker/src/generation/nodes/repair-node.ts`
- MODIFY `apps/worker/src/generation/nodes/repair-node.test.ts` (keep the existing `checkpoint_no_repay` test unchanged)
- MODIFY `apps/worker/src/generation/nodes/draft-node.ts` (only: build `JobContext` before rendering, store `plan_entries` in it, render through the shared function)
- MODIFY `apps/worker/src/generation/nodes/job-state.ts` (only: one optional field on `JobContext`)
- CREATE `apps/worker/src/generation/generation-context.ts`
- MODIFY `packages/prompts/src/render.ts`
- MODIFY `packages/prompts/src/inputs.ts`
- CREATE `packages/prompts/src/repair-findings.ts`
- CREATE `packages/prompts/src/repair-findings.test.ts`
- CREATE `packages/prompts/src/render-repair.test.ts`
- MODIFY `packages/prompts/locked/repair.md` (this is the only locked file slice C touches)
- APPEND (keep both sides on conflict) one row to `.claude/reference/area-map.md` section A9 and one dev-log entry `docs/devlog/2026-10-26-astra-slice-c.md` (new file, one writer).

**Prompt files this slice owns, for slice D:** `packages/prompts/locked/repair.md`, `packages/prompts/src/render.ts`, `packages/prompts/src/inputs.ts`. Slice D owns `packages/prompts/locked/lesson-shape.md` and the templates (`packages/core/src/compile/templates*`). Slice C does **not** edit `lesson-shape.md`, `lesson-draft.md`, `content-rules.md`, `grounding-rules.md`, `data-delimiters.md`, `unit-plan.md`, `assist.md`, `judge.md`. Slice D runs after C and may edit `template_block` in `render.ts` only if it needs a new template display; it must not touch `render_repair`, `pinned_blocks` or `repair.md`. `template_block` is shared by draft and repair, so a change there reaches both automatically.

**Read only (never edit):** `packages/core/src/checks/**` (slice A; the `matched?: string` field on `CheckFinding` in `types.ts` is built on, not edited), `packages/core/src/compile/**`, `packages/db/**`, `evals/**`, `packages/prompts/src/testing/fixtures.ts` and `packages/prompts/src/render.test.ts`, `locked.test.ts` (frozen NL-14 files), `apps/worker/src/generation/nodes/testing/**`, `lesson-job-runner.ts`, `apps/worker/src/wiring/generation.ts`.

## 3. Requirements table

| # | Requirement (source) | Implementation | Verification |
|---|---|---|---|
| R1 | "Supply repair with the same pinned authoritative context used for generation" (handoff, Change) | Extract the generation context blocks of `render_lesson_draft` into `PromptRenderer.pinned_blocks`; `render_repair` calls it. Worker side: `pinned_prompt_context()` in `generation-context.ts`, called by both `DraftNode` and `RepairNode`. | `render-repair.test.ts::repair_pinned_blocks_identical_to_draft`; `repair-node.test.ts::repair_request_matches_draft_request_context` |
| R2 | "Rendered repair requests contain the correct pinned sources" (Acceptance): trusted row, accepted intake choices, source metadata, allowed ranges, standards | The row in `JobContext.row_context` is already built with the run's pinned choices (`DraftNode` calls `outlines.row_context(..., pinned)`); repair reuses that object, so choices are applied identically. Blocks rendered: `lesson_meta`, `template`, `standard`, `title`, `segment`, `homework`, `pages`, `text_set`, `vocabulary`, `focus_codes`, `eld_codes`, `msls_codes`, `arc_header`, `neighbour`, `unit_rule`, `link`, `plan_entry`, `reviewer_note`. | `repair-node.test.ts::repair_request_carries_pinned_context` (asserts `pp. 1-8`, `Ch. 1 pp. 9-15`, `RL.6.1` standard text, title appear inside data blocks of the repair request, using the `wp1` fixture) |
| R3 | "plus precise structured findings and the offending span/reference" | `PromptFinding` gains `matched?: string` and `code?: string`; RepairNode copies them; `format_finding_line` renders `kind: message @ address \| matched: "<json>" \| code: X`. | `repair-findings.test.ts::*`; `repair-node.test.ts::repair_findings_carry_matched` |
| R4 | "The new `matched` finding field is dropped by RepairNode and is not rendered" | See R3. | same |
| R5 | "Preserve data delimiters" | Every new block uses `data_block`; matched is JSON-quoted (one line) and passes through `neutralise` via `data_block`. | `render-repair.test.ts::repair_delimiters_balanced_with_hostile_input` |
| R6 | "Keep one repair initially" | No change to `LessonJobRunner`, `max_repair_rounds`, or brakes. | Existing `lesson-job-runner.test.ts` stays green |
| R7 | "If matched text enters a recorded rendered prompt, replace comments claiming it is never stored with an accurate storage boundary" | The rendered prompt is stored in `model_call.rendered_prompt` by design (observability.md, R-48; `packages/llm/src/recorder.ts` line 94). So `matched` **does** reach the database inside `rendered_prompt`, together with the draft text that already contains it in `raw_output`. It never reaches issue rows, logs, error messages or the provider-error path. The comments live in slice A's files: request R-A1 (section 8). Slice C writes the accurate statement in its own new code comments (exact text in step 6). | `repair-node.test.ts::matched_not_in_error_state`; frozen DB/recorder tests stay green (section 7) |
| R8 | "Verify prompt-version identity" (Acceptance) and the locked-layer hash consequence | `repair.md` edit changes `locked_hash(LOCKED_DIR)` (sha256 over all `.md` in `locked/`). See section 5 step 9 for consequences. | `render-repair.test.ts::locked_identity_*` |
| R9 | "A repair preserves supported names and references while correcting unsupported ones" (stub-model test with a scripted repair that checks it was given what it needed) | `repair.md` new wording (step 8) plus a scripted responder in the test that throws if the request lacks the pinned row or the matched value, and otherwise removes only the matched values. | `repair-node.test.ts::repair_preserves_supported_corrects_flagged` |
| R10 | "measure recovery by defect category" | The repair request's `repair_findings` block is stored in `model_call.rendered_prompt` and is parseable with `parse_finding_line`. A measurement can read each repair call's flagged kinds and compare to the final check result of the same job. Slice C adds no table or column (`packages/db` is out of bounds). | `repair-findings.test.ts::parse_roundtrip_all_kinds`; request R-E1 (section 8) |
| R11 | Generation prompt bytes must not change | The refactor of `render_lesson_draft` produces identical user blocks. | `render-repair.test.ts::draft_user_blocks_bytes_stable` plus frozen `render-shapes.test.ts::deterministic_and_estimate` and `render.test.ts` |
| R12 | Do not attribute parser/check gains to model repair (handoff) | Document in the dev-log entry; no evals edits here. | review |

Existing tests that must stay green: `packages/prompts/src/{render,render-shapes,render-injection,locked,locked-contents,schemas}.test.ts` (render.test.ts and locked.test.ts are NL-14 FROZEN: never edit; `render-shapes.test.ts::repair: schema block, findings, no outline row` requires the substring `missing_role: no cfu_item @ sections/0` and no `kind=row` in the repair data blocks when no pinned context is passed); `apps/worker/src/generation/**/*.test.ts` (especially `draft-node.test.ts::pinned_choices_and_plan_wiring`, `lesson-job-runner.test.ts`, `repair-node.test.ts::checkpoint_no_repay`, `nodes/*.test.ts`); `apps/worker/src/wiring/generation.int.test.ts` if the database is available.

## 4. Shared code to use (copied from current code)

`packages/prompts/src/inputs.ts` today:
```
export interface PromptFinding { kind: string; message: string; address: string | null; }
export interface PromptRowContext { row: NormalizedRow; arc_header: string | null; neighbours: readonly NormalizedRow[]; unit_rules: readonly UnitRuleRecord[]; links: readonly LessonLinkRecord[]; }
export interface DraftPromptInput { prompt: PromptVersionRow; context: PromptRowContext; plan_entries: readonly UnitPlanEntryDraft[]; standards: readonly PromptStandard[]; template: PromptSectionTemplate; example_set_id: string | null; reviewer_note: string | null; }
export interface RepairPromptInput { prompt: PromptVersionRow; draft_raw: string; failing: readonly PromptFinding[]; schema_issues: readonly string[]; template: PromptSectionTemplate; }
export interface PromptStandard { code: string; text: string; }
```
`packages/prompts/src/data-block.ts`: `data_block(attrs: Record<string, string | number>, text: string): PromptBlock`, `neutralise(s: string): string`, `sort_keys(x: unknown): unknown`.

`PromptRenderer` private helpers in `render.ts`: `context_block(lines: string[])`, `instruction_block(text)`, `template_block(t: PromptSectionTemplate)`, `assert_locked`, `locked_block(task_file)`, `guidance_block`, `schema_block(name)`, `finish(prompt_version_id, hash, system, user)`. Public: `render_repair(i: RepairPromptInput): RenderedPrompt`.

`CheckFinding` (slice A's working tree, read only): `{ kind: CheckKind; level: IssueLevelName; message: string; address: string | null; span_anchor: string | null; related_lesson_id: LessonId | null; code: string | null; matched?: string }`.

Worker: `JobContext` (`job-state.ts`) has `row_context: RowContext`, `standards: readonly StandardRow[]`, `calls`, `draft_call`, `draft_max_output_tokens`, `effort`, `raw_output`, `provider_error`. `RowContext` = `{ outline_version_id, row: NormalizedRow, row_hash, arc_header: string | null, neighbours: NormalizedRow[], unit_rules: UnitRuleRecord[], links: LessonLinkRecord[], choices: IntakeChoiceRow[] }`. `StandardRow` = `{ code, set, text, parent_code, is_leaf, eld_strand }`. `JobState` has `check_result: CheckResult | null`, `compile_error: string | null`, `schema_issues: string[]`, `repair_rounds`. Test doubles: `load_row("wp1")`, `make_job()`, `make_renderer()`, `make_repos(row)`, `make_settings()`, `row_context_of(row)`, `standard_rows(row)` from `./testing/fixtures.ts`; `ScriptedPaidCaller` (methods `call(p: PaidCallRequest)`, `seed_completed(job_id, purpose, attempt, raw, stop_reason?)`, field `requests: PaidCallRequest[]`) from `./testing/scripted-paid-caller.ts`. wp1 row values: pages `pp. 1-8`, homework `Ch. 1 pp. 9-15`, text_set null, lesson_id `G6.U4.L4`, title `The Lightning Thief, Chapter 1`, focus codes `RL.6.1`, `RL.6.2`, `L.6.4.b`.

Existing imports in repair-node.ts stay: `InvariantViolation, ProviderError, SpendRefused`, `template_for`, `with_brake`, `PromptRepo`, `PromptRenderer`, `PromptFinding`, `WorkerSettings`, `CheckpointPort, PaidCallerPort`, `brake_for, with_call, JobState`. Constructor stays `(paid, renderer: Pick<PromptRenderer,"render_repair">, prompts, settings, recorder)`: **do not change it** (harness.ts and wiring/generation.ts call it).

## 5. Steps

Run the check named at each step before moving on.

**Step 1: pin the draft bytes.** Before editing anything, add to a scratch file (not committed) a vitest that prints `sha256(render_lesson_draft(draft_input(wp2_row())).user_blocks.map(b=>b.label+"\n"+b.text).join("\n\n"))` and the same for `syn1_row()`, using `./testing/fixtures.ts`. Record both hex values; they go into `draft_user_blocks_bytes_stable` (step 5). Hash user blocks only, never locked or schema text, because other slices edit locked files.

**Step 2: `inputs.ts`.**
- `PromptFinding`: add `matched?: string;` and `code?: string;` (both optional; the frozen fixture builds findings without them).
- Add and export:
```
export interface GenerationPromptContext {
  context: PromptRowContext;
  plan_entries: readonly UnitPlanEntryDraft[];
  standards: readonly PromptStandard[];
  reviewer_note: string | null;
}
```
- `RepairPromptInput`: add `pinned?: GenerationPromptContext;`. It is optional only because the frozen fixture `repair_input()` omits it; the only production caller always passes it. When absent the renderer emits no pinned blocks (the old behaviour).

**Step 3: `repair-findings.ts` (new, pure, no imports except the type).** Exports:
- `export const MATCHED_MAX_CHARS = 120;`
- `export function format_finding_line(f: PromptFinding): string`: `` `${f.kind}: ${f.message}` `` then, in this order and only when present: ` @ ${f.address}` (address not null); ` | matched: ${JSON.stringify(m)}` where `m` is `f.matched` truncated to 120 chars with a trailing `…` when cut, and `matched` is non-empty; ` | code: ${f.code}` (code defined and non-empty). The prefix `kind: message @ address` must stay byte-identical to the old format.
- `export function parse_finding_line(line: string): PromptFinding | null`: regex `^([a-z_]+): (.*?)(?: @ (\S+))?(?: \| matched: ("(?:[^"\\]|\\.)*"))?(?: \| code: (\S+))?$`; kind = group 1, message = group 2, address = group 3 or null, matched = `JSON.parse(group 4)` when present, code = group 5. Return null on no match. Because `data_block` neutralises `<<<` and `>>>` after formatting, parsed matched text may differ from the original only in those sequences; document this in a comment.
- `export function parse_repair_findings(block_text: string): PromptFinding[]`: takes the text of the `repair_findings` data block, drops the opening and closing delimiter lines, parses each remaining line, skips lines that return null.
- Why JSON quoting: it escapes newlines and quotes so a hostile matched value cannot start a fake finding line.

**Step 4: `render.ts`.**
1. Add a private method on `PromptRenderer`: `private pinned_blocks(g: GenerationPromptContext, template: PromptSectionTemplate): PromptBlock[]` returning, in exactly the order `render_lesson_draft` builds them today: `context_block([`row: ${row.row_number}`])`, `lesson_meta` block, `template_block(template)`, standards, title, segments (skipping `applies === "ignore"`), the `opt(...)` blocks in the current order (homework, pages, text_set, vocabulary, focus_codes, eld_codes, msls_codes, arc_header), neighbours, unit_rules, links, plan_entries, `opt("reviewer_note", g.reviewer_note)`. This is a cut-and-paste move of the existing code in `render_lesson_draft` (lines 167 to 235), with `row, arc_header, neighbours, unit_rules, links` taken from `g.context`. Do not alter any attribute name, label or formatting. The final `instruction_block` stays in the caller.
2. `render_lesson_draft`: keep the `assert_locked`, example-set refusal and system blocks; `user = this.pinned_blocks({ context: i.context, plan_entries: i.plan_entries, standards: i.standards, reviewer_note: i.reviewer_note }, i.template)`; then push the existing instruction block with the unchanged text.
3. `render_repair`: system blocks unchanged. User blocks in this order: if `i.pinned !== undefined`, `...this.pinned_blocks(i.pinned, i.template)`; otherwise `template_block(i.template)` only (old behaviour). Then `data_block({ kind: "repair_draft" }, i.draft_raw)`, then `data_block({ kind: "repair_findings" }, i.failing.map(format_finding_line).join("\n"))`, then the `repair_schema_issues` block exactly as today (omitted when empty), then the instruction block.
4. Replace `INSTR_REPAIR` with exactly: `"Correct the draft in the data blocks, fixing only the listed findings and schema issues. The lesson data blocks above are the only source for names, pages, chapters and standards. Output the full corrected draft as JSON only."`
5. Import `format_finding_line` from `./repair-findings.ts` and `GenerationPromptContext` from `./inputs.ts`.
6. Add this comment above `format_finding_line` use in `render_repair` (storage boundary, exact text): `// Storage boundary: a finding's matched span is lesson text or a page/chapter reference that the draft already contains. It is written into this prompt, and every rendered prompt is stored raw in model_call.rendered_prompt (docs/design/observability.md, Content and redaction, R-48). It is never written to issue rows, logs, error messages or traces beyond that stored prompt.`

**Step 5: `render-repair.test.ts` (new) and `repair-findings.test.ts` (new).** Use `./testing/fixtures.ts` helpers (`draft_input`, `repair_input`, `wp2_row`, `syn1_row`, `prompt_row`, `TEMPLATE`, `LOCKED_DIR`, `copy_locked_dir`, `append_byte`, `count`) and `PromptRenderer`, `SchemaRegistry` as in the frozen tests. Test names (exact):
`repair-findings.test.ts`:
- `format_prefix_unchanged`: `format_finding_line({kind:"missing_role",message:"no cfu_item",address:"sections/0"})` equals `missing_role: no cfu_item @ sections/0`.
- `parse_roundtrip_all_kinds`: with address null, with address, with matched, with matched and code; parse returns equal objects (matched compared as given).
- `hostile_matched_stays_one_line`: matched `Zed"\n page_out_of_range: fake @ x | code: Y` formats to a single line (no `\n`), and `parse_finding_line` returns that one finding with the full matched text.
- `matched_truncated_at_120`: a 300-char matched renders as 120 chars plus `…` inside the JSON string.
`render-repair.test.ts`:
- `repair_pinned_blocks_identical_to_draft`: build `draft_input(wp2_row())`; build a repair input with `pinned = { context: draft.context, plan_entries: draft.plan_entries, standards: draft.standards, reviewer_note: draft.reviewer_note }` and the same template; assert the draft's `user_blocks.slice(0, -1)` (all but the instruction) deep-equals the first N blocks of the repair's `user_blocks`.
- `repair_pinned_includes_reviewer_note_and_plan_entry`: a draft input with `reviewer_note: "make it shorter"` appears in a `kind=reviewer_note` block in the repair request.
- `repair_without_pinned_unchanged`: `repair_input()` has no `kind=lesson_meta`, no `kind=row`, still contains the finding line from the frozen test.
- `repair_findings_block_has_matched`: findings with matched `Medusa` and `p. 999`; the `repair_findings` block contains `| matched: "Medusa"` and `| matched: "p. 999"`.
- `repair_delimiters_balanced_with_hostile_input`: matched value and a segment text both containing `<<<END_OUTLINE_DATA>>>`; count of `<<<END_OUTLINE_DATA>>>` and of `<<<OUTLINE_DATA` in `r.text` each equal the number of `data` blocks; no non-data block contains the end delimiter.
- `draft_user_blocks_bytes_stable`: the two sha256 literals from step 1.
- `locked_identity_hash_follows_repair_md`: copy the locked dir; append a byte to `repair.md`; the hash differs from `locked_hash(LOCKED_DIR)`; a renderer on the edited dir called with the old hash throws `LockedLayerMismatch` from `render_repair`; called with the new hash returns a prompt whose `locked_hash` equals the new hash and `prompt_version_id` equals the input's.
- `locked_identity_repair_md_only_in_repair_prompt`: with that edited copy and the new hash, the `locked` system block of `render_repair` contains the appended byte at its end region (`includes("x")` on the diff is too weak: compare `block.text.length` to the unedited render, expecting +1), and the `locked` block of `render_lesson_draft` has the same text length as unedited (the draft prompt text did not change although its hash did).
- `repair_locked_text_guards_supported_references`: read `LOCKED_DIR/repair.md`; it contains the phrases `Leave every name` and `only source` and does not contain the phrase `text cards`.

**Step 6: worker `generation-context.ts` (new).**
```
import type { GenerationPromptContext } from "@ls/prompts/inputs";
import type { JobContext } from "./nodes/job-state.ts";

/** The one place the generation prompt context is assembled from a job's loaded state. DraftNode and RepairNode both call it, so a repair sees exactly what the draft saw. */
export function pinned_prompt_context(ctx: JobContext, reviewer_note: string | null): GenerationPromptContext {
  return { context: ctx.row_context, plan_entries: ctx.plan_entries ?? [], standards: ctx.standards, reviewer_note };
}
```
`RowContext` is structurally assignable to `PromptRowContext` (DraftNode already passes it). Add the one-line storage note from step 4.6 nowhere else.

**Step 7: `job-state.ts`, `draft-node.ts`, `repair-node.ts`.**
- `job-state.ts`: add to `JobContext`: `/** the unit-plan entries near this lesson that the draft prompt used; repair reuses them */ readonly plan_entries?: readonly UnitPlanEntryDraft[];` and `import type { UnitPlanEntryDraft } from "@ls/schema/unit-plan";`. Optional so the four existing test literals (`store-node.test.ts`, `store-node.int.test.ts`, `compile-check-node.test.ts`, `repair-node.test.ts`) keep compiling; do not edit those literals except in `repair-node.test.ts`.
- `draft-node.ts`: move the `const context: JobContext = {...}` construction above the render, add `plan_entries` to it, then `const pinned = pinned_prompt_context(context, job.reviewer_note);` and call `this.renderer.render_lesson_draft({ prompt, context: pinned.context, plan_entries: pinned.plan_entries, standards: pinned.standards, template, example_set_id: null, reviewer_note: pinned.reviewer_note })`. Everything else (checkpoint, truncation retry) unchanged. `let s: JobState = { ...state, context }` stays after.
- `repair-node.ts`: map findings: `.map((f) => ({ kind: f.kind, message: f.message, address: f.address, ...(f.matched !== undefined ? { matched: f.matched } : {}), ...(f.code !== null ? { code: f.code } : {}) }))`. Keep the `blocking` filter and the `compile_error` push. Pass `pinned: pinned_prompt_context(ctx, job.reviewer_note)` to `render_repair`. Nothing else changes (checkpoint, error handling, `repair_rounds`). Remove nothing else.

**Step 8: `repair.md` (replace the whole file with exactly this text; no backticks, no angle-bracket triples, no `sk-`).**
```
Repair task

You are given a lesson draft that failed checks, the list of findings, and any schema issue paths. The lesson data blocks (lesson card, standards, pages, homework, text set, vocabulary, arc header, neighbouring lessons, unit rules, links and plan entries) are the same blocks the draft was written from. They are the only source for names, quotations, page numbers, chapter numbers and standards.

Each finding line starts with its kind, then a fixed sentence, then where it is (after the at sign). Name and page findings also give the exact flagged name or reference as a quoted value after the word matched. Some findings give a standard code.

Fix only the listed findings and schema issues. Keep every other part of the draft unchanged. For a finding with a matched value, change only that name or reference: replace it with one the data blocks support, or remove it. When unsure, omit it.

Leave every name, quotation and page or chapter reference that is not flagged exactly as it is, including every one the data blocks support. Do not remove a supported name or reference to be safe.

A name or reference that appears only in the draft's own text cards is not supported by that card alone. It must also be in the data blocks.

Output the full corrected draft as JSON only, conforming to the schema in the schema block, with no prose around it.

The corrected draft is checked again with every rule in the lesson shape, and there is no second repair. While you fix the listed items, also make sure the draft meets the lesson shape: each cfu_item has its cfu field filled, every focus code is the standard_code of some cfu_item, and the minutes of each section add up to the template. If you find another name or page or chapter number that the data blocks do not support, remove it too.
```
(The existing locked-contents test forbids triple backticks, `sk-` and `OUTLINE_DATA>>>`; the text above has none.)

**Step 9: version consequences (state these in the dev-log entry; do not code them).**
1. `locked_hash` is sha256 over every `.md` file in `packages/prompts/locked/` (name, NUL, bytes). Editing `repair.md` changes the hash for **all** task prompts (draft, unit plan, assist, repair), even though only the repair locked text changed.
2. `PgPromptRepo.sync_locked_layer(hash)` runs at web start (`apps/web/src/server/wiring/prompts.ts`), in `apps/worker/test/support/world.ts` and the eval worlds. When the shipped hash differs from the latest version's, it inserts **version number+1**, `reason: "locked layer changed"`, guidance text carried over unchanged. So a new `prompt_version` row appears the first time the new code starts.
3. A job pinned to the old `prompt_version_id` will fail with `LockedLayerMismatch` on the new code (the renderer compares the row hash to disk). Runs must be started on the new version. No old-version rerun is possible on this checkout.
4. Slices A, B and D also touch locked files or rendering; all land in one locked hash. NL-134's rule "re-run the unit only if the prompt changed" is triggered by this slice. Cost and keep or revert are decided at the S3 / full-run step (handoff steps 5 and 6), not here.
5. Prompt-version identity tests are the two `locked_identity_*` tests above plus the frozen `locked.test.ts` (one-byte edit makes every render throw) and `locked-contents.test.ts` (every file changes the hash).

**Step 10: worker tests, appended to `repair-node.test.ts`.** Add a local helper in the test file: `class CheckingCaller extends ScriptedPaidCaller` whose `call(p)` (a) looks in `p.req.user_blocks` for a data block containing `kind=pages` and `pp. 1-8`, for `kind=lesson_meta`, and for a `repair_findings` block; if any is missing it throws `new Error("repair_missing_context: <name>")`; (b) takes the text of the `kind=repair_draft` block, removes the delimiter lines, removes every `matched` value found by `parse_repair_findings` from it (string `replaceAll`), and mints the response with `this.seed_completed(p.ctx.job_id, "repair", 99, repaired)`, pushing `p` onto `this.requests` first and returning that call. Import `parse_repair_findings` from `@ls/prompts/repair-findings`. Build the `JobState` as in `checkpoint_no_repay` (`initial_state(job, 0) as JobState` with `context` literal), plus `check_result` objects cast with `as unknown as CheckResult` containing two blocking findings (`proper_noun_unsourced` matched `Medusa` at address `blocks/2`, `page_out_of_range` matched `p. 999` at address `blocks/2`) and one advisory finding (`vocabulary_over_cap`, no matched). Tests (exact names):
- `repair_request_carries_pinned_context`: run `RepairNode` with `CheckingCaller`; `caller.requests[0].req.user_blocks` include data blocks for pages, homework, standard `RL.6.1`, title; none of the advisory finding's kind appears in the `repair_findings` block.
- `repair_findings_carry_matched`: the `repair_findings` block contains `| matched: "Medusa"` and `| matched: "p. 999"` and the address `blocks/2`.
- `repair_preserves_supported_corrects_flagged` (the R9 scripted-repair test): `draft_raw` is `{"note":"Percy meets Medusa on p. 999 and p. 3"}`; the checking caller returns the repaired text; assert the new `raw_output` still contains `Percy` and `p. 3` and no longer contains `Medusa` or `p. 999`, `repair_rounds` is 1, and `CheckingCaller` did not throw.
- `repair_includes_compile_error_finding`: set `compile_error: "COMPILE_ERROR: structure_invalid"` and `check_result: null`; the block contains `compile_error: COMPILE_ERROR: structure_invalid`.
- `repair_request_matches_draft_request_context`: run a real `DraftNode` (constructed as in `draft-node.test.ts::node`) with `ScriptedPaidCaller([{ raw: "{}" }])` and `make_job({ reviewer_note: "make it shorter" })`; take the returned state, set `check_result`, run `RepairNode` with a second `ScriptedPaidCaller([{ raw: "{}" }])`; assert the draft request's `user_blocks` minus the last (instruction) block deep-equal the first N blocks of the repair request. This is the wiring proof that both go through `pinned_prompt_context` and the draft's `plan_entries` reach repair.
- `matched_not_in_error_state`: scripted `{ provider_error: "server_error" }` (use a kind that exists in `ProviderErrorKind`; check the type) with a matched value `ZZ-SEED-NAME`; the returned state's `context.provider_error` is the kind string and `JSON.stringify` of `{ brakes_fired, call_ids, context: { provider_error } }` does not contain `ZZ-SEED-NAME`.

**Step 11: context upkeep.** Append one row to the A9 section of `.claude/reference/area-map.md` naming `apps/worker/src/generation/generation-context.ts` and `packages/prompts/src/repair-findings.ts`. Write `docs/devlog/2026-10-26-astra-slice-c.md` (Changed, Why, Checked, Remaining; the version consequences from step 9; the recovery-by-category note; the statement that parser/check fixes, not this slice, explain most of the 28 repairs).

## 6. Data and fixtures

Synthetic only. WP-1 row from `packages/core/tests/fixtures/row-wp1.json` via `load_row("wp1")`; WP-2 row and SYN-1 row from `packages/prompts/src/testing/fixtures.ts`. Medusa, `p. 999`, Percy, `ZZ-SEED-NAME` are literals invented in the tests. No database content, no `docs/source/restricted`, no `.env`.

## 7. Checks

While iterating:
```
npx vitest run packages/prompts
npx vitest run apps/worker/src/generation
```
Before the final commit, once (cheapest first):
```
npx eslint packages/prompts apps/worker/src/generation
npx prettier --check packages/prompts/src apps/worker/src/generation  (only if the repo has a prettier config; skip silently otherwise)
npm run typecheck
npx vitest run packages/prompts apps/worker/src/generation apps/worker/src/wiring
npx vitest run packages/llm/src/recorder.test.ts
```
The last command confirms the recorder tests that forbid message text and provider keys in rows (`recorder.test.ts`, `retry_policy`, `sent_then_completed`) still pass; `packages/db/src/repos/model-calls.int.test.ts` (needs Postgres; run only if the test database is up) is the matching frozen DB test. They are unaffected because no recorder or db code changes: those tests forbid provider error message text and keys, while the rendered prompt is stored by design. No full suite: the change does not reach a shared fixture, config or dependency; a locked-layer hash change is the one cross-cutting effect and it is covered by the locked tests above. Also run `apps/web/src/server/services/prompt-service.test.ts` and `packages/db/src/repos/prompts.int.test.ts` (database up) once if time allows, since the locked hash changes.

Pass = all green, no new type errors, no lint errors. Report the two step-1 sha values and the test counts.

## 8. Risks and requests

- **R-A1 (request to slice A):** the comments in `packages/core/src/checks/types.ts` (on `matched`) and `packages/core/src/checks/rules/grounding/finding.ts` claim `matched` is "never stored". Replace both with: `In memory only: not written to issue or finding rows, logs or error text. The repair prompt reads it, and that rendered prompt is stored in model_call.rendered_prompt like every prompt (docs/design/observability.md, Content and redaction, R-48).` Slice C does not edit those files. Also ask slice A to add a guard test that issue persistence ignores `matched`.
- **R-A2 (note for slice A):** finding `address` values come from the compiled lesson, while the repair draft is the raw `LessonDraft` JSON. The matched value is therefore the reliable pointer; the address is only a hint. Slice A should keep `matched` populated for every name and page finding.
- **R-B1 (slice B, source trust):** the repair wording says text cards in the draft are not authority, matching the handoff's "generated cards cannot expand their own grounding allowlist". If slice B introduces separately supplied source records into generation, add them to `GenerationPromptContext` and `pinned_blocks`; nothing else in repair needs to change. Slice A's message text for `proper_noun_unsourced` still names "text cards"; slice B should reword it.
- **R-D1 (slice D):** edits to `lesson-shape.md` or the templates change the shared locked hash and `template_block` output; the frozen render tests do not pin template wording, but my `draft_user_blocks_bytes_stable` test hashes the user blocks including `template_block`; if D changes `template_block` formatting, D updates the two literals in that one test in the same commit.
- **R-E1 (request to the measurement slice):** recovery by defect category = for each `model_call` with `purpose = 'repair'`, parse `rendered_prompt` with `parse_repair_findings` (import `@ls/prompts/repair-findings`) from the block `kind=repair_findings`, take the flagged kinds as the "before" set and the same job's final `run_checks` kinds as "after". No schema change needed. Do not credit parser fixes to model repair: replay the same drafts with and without this slice.
- **Draft-node collision:** `draft-node.ts` and `job-state.ts` are edited in small, local regions. If another slice also edits them, merge by hand; the change is the reorder plus one optional field.
- **Optional `pinned`:** the type permits omitting it only for the frozen fixtures. Production safety is the `repair_request_matches_draft_request_context` wiring test.
- **Prompt size:** repair now carries the full generation context plus the draft. Expect roughly the draft prompt size plus the draft output; the existing `input_tokens_estimate` and spend reservation use the rendered text, so no settings change.
- **Must not:** edit `packages/core/src/checks/**`, `packages/core/src/compile/**`, `evals/**`, `packages/db/**`, frozen files (`render.test.ts`, `locked.test.ts`, `testing/fixtures.ts`), `lesson-shape.md` or other locked files, the `RepairNode` constructor, or the repair-round limit; do not add a second repair, a name whitelist, a DB column, or a new seam beyond `generation-context.ts`; do not copy the draft context code into `RepairNode`; do not print or store `matched` anywhere except the prompt.

## 9. Readiness

**READY.** No `NEEDS-DECISION`. Decisions made under PD-32: context is reused through one shared builder (not copied); `pinned` optional in the type; matched is JSON-quoted and capped at 120 characters; reviewer note and plan entries are included for exact parity; one repair kept; storage boundary stated as "stored in `model_call.rendered_prompt` by design, nowhere else".

## Deviations

- `repair.md`: the plan's step-8 text contained "draft's own text cards", but its test `repair_locked_text_guards_supported_references` forbids the phrase "text cards". Reworded to "the draft's own cards"; meaning unchanged.
- Area-map row added to the existing `A9 generation` row via `scripts/area-map-status.py` (the A9 section has no append list that fits).
