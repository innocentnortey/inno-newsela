# Slice F1: contract matrix, one owner of sections / parts / required roles / minutes, canonical addresses, shared rationale contract

Plan for `fanout-implementer` (Sonnet). Date 2026-10-26. Base: `main` at `45a2a63` (slices A to D and the PD-39 rulings are merged). Plan path: `docs/plans/fanout/2026-10-26-contract/slice-F1.md`. Readiness: **READY** (section 9). F1 lands first; F2 (standards rows) and F3 (lifecycle tests) start from F1's merge.

## 1. Goal and sources

Four deliverables, one change set:

1. **The contract matrix**, written once, in the design owner `docs/design/code-design.md` (new section `## 10a. Lesson-contract matrix`, directly after the existing section 10 table "Where each contract lives in code"). It has six rows (CM-1 to CM-6), one per contract area of the follow-up handoff. F1 fills CM-1 completely and writes CM-2 to CM-6 as honest skeletons that F2/F3 complete. It is **not** a second specification: every cell cites its authority and the code that owns it.
2. **One production owner of sections, parts, required roles and minutes**: `packages/core/src/compile/templates.ts`. The duplicate table `packages/core/src/checks/rules/structural/expected.ts` is deleted. The prompt, the compiler and the three structural checks (`section_missing`, `minutes_out_of_range`, `schema_invalid`) read the template. Draft role to stored node is one explicit table (`compile/role-nodes.ts`), draft part label to stored heading is the existing `part-labels.ts` plan, and the tolerances become named constants.
3. **The canonical address helper** (`section_slug` in `compile/addresses.ts`, new wrapper `section_address`) replaces `expected.ts`'s `section_name_to_address`, so `LearninginAction` disappears from production findings; a wholly absent section's issue is shown to carry the address the compiler assigns and to resolve through `merge_resolutions` and the submit gate.
4. **The shared rationale contract** for student rendering: `safety/student-blocks.ts` stops using its own regex and uses `parse_rationale_label` through one new structural helper (`cfu_parts` in `structural/doc-walk.ts`) that `schema_invalid.ts` uses too.

Sources read for this plan (the implementer need not re-read them, only the code spans named in the steps):
- `docs/delivery/2026-10-26-contract-consistency-followup-handoff.md`: section 1 (matrix rows and the *Sections, parts, required roles and minutes* row), section 2 (address and `student-blocks.ts` paragraphs), the final paragraph of section 1 (oracles stay independently grounded).
- `docs/delivery/2026-10-26-astra-fix-handoff.md` (*Align production lesson structure and standards evidence*), `docs/plans/fanout/2026-10-26-astra/slice-D.md` (D-1 exact `Part A`/`Part B`; the "latent bug seen, not fixed" about `expected.ts`; R-A1 about `student-blocks.ts`), `docs/devlog/2026-10-26-astra-slice-d.md`.
- Authority for the rows, highest first (CLAUDE.md order): issued brief (`docs/source/`, only through `docs/source/04-lesson-structure-analysis.md` section 3b/3 node table, which the PRD cites); recorded decisions; PRD `docs/prd/newsela-prd.md` R-11 (templates 5/10/30/5 + Homework, Spark 15/30/5, Flex and assessments 5/40/5), R-15 (Pulse Check, Quick Write), R-21 (address `G6.U4.L5.LearningInAction.PartA`); worked pairs `docs/data/worked-pairs.md` WP-1/WP-2/WP-3 "Required output B" typed-block tables. Code and fixtures prove behaviour only.
- `docs/contracts/INTERFACE.md` CON-11 line 721 gives the address example `G6.U4.L4.LearningInAction.PartA`. **No `CHG-N` is needed**: no card text, OpenAPI file or kind list changes; the address fix brings the code into line with CON-11 and PRD R-21. If the implementer finds a card that promises the old address or a role list, stop and report (CHANGES.md procedure applies then).

## 2. Boundary

**Owned (create or modify):**

| Path | Action |
|---|---|
| `packages/core/src/compile/templates.ts` | modify: named tolerances (step 1) |
| `packages/core/src/compile/role-nodes.ts` | create: draft role to stored node table and matcher (step 2) |
| `packages/core/src/compile/addresses.ts` | modify: add `section_address`, use it in `assign_addresses` (step 3) |
| `packages/core/src/compile/{templates,role-nodes,addresses}.test.ts` | modify (templates, addresses) / create (role-nodes) |
| `packages/core/src/compile/compile-contract.test.ts` | modify: replace its local `present()` table with `role_present` (step 9) |
| `packages/core/src/compile/part-labels.ts`, `part-labels.test.ts` | read; modify only if a test in step 8 shows a defect (report it) |
| `packages/core/src/checks/rules/structural/expected.ts` | **delete** |
| `packages/core/src/checks/rules/structural/{section_missing,minutes_out_of_range,schema_invalid,doc-walk}.ts` | modify |
| `packages/core/src/checks/rules/structural/{required-roles,minutes-sections,schema-invalid}.test.ts` | modify (named expectation fixes only) |
| `packages/core/src/checks/rules/structural/{template-contract,absent-section}.test.ts` | create |
| `packages/core/src/checks/rules/safety/student-blocks.ts`, new `safety/student-blocks.test.ts` | modify / create |
| `packages/core/src/checks/test-helpers.ts` | modify: shared test fixture (step 5). F1 is its only writer in this wave; F2/F3 must not edit it until F1 merges |
| `packages/core/src/checks/fixtures/wp3-clean.json` | modify: test data (step 6) |
| `packages/prompts/src/render-production-template.test.ts` | create (test only; no change to `render.ts`) |
| `docs/design/code-design.md` | modify: section 2.1 rows for `templates.ts` and new `role-nodes.ts`; new section 10a (step 10) |
| `.claude/reference/area-map.md`, `docs/devlog/2026-10-26-contract-f1.md` | modify / create (step 11) |

**Fixture files F1 may touch only to add a block a template requires to a draft documented as "good" (list each in the report; grep for a hash pin first and update the pin in the same commit if one exists):** `packages/core/tests/fixtures/draft-wp1.json`, `apps/worker/test/fixtures/stub-drafts/{wp-1,wp-2}.json` (the `draft` key only; the stub `first_draft` is deliberately defective, leave it), `apps/worker/src/generation/nodes/testing/fixtures.ts`.

**Read only (shared surfaces):** `packages/schema/**` (`DraftRole`, `DRAFT_ROLES`, `DraftBlock`, `PMNode`), `packages/editor-schema/**`, `packages/core/src/compile/{nodes,compile-draft,labels,roles,standard-tags}.ts`, `packages/core/src/checks/{types,gates,registry,policy,context-loader}.ts`, `packages/prompts/src/{render,inputs}.ts`, `packages/prompts/locked/**`, `evals/**`, `docs/contracts/**`, `docs/data/worked-pairs.md`.

**Must not touch (other slices or frozen):**
- F2's files: `packages/core/src/compile/standard-tags.ts`, `packages/core/src/checks/rules/alignment/**`, `packages/core/src/checks/rules/links/**`, `apps/worker/src/generation/nodes/front-matter-standards.ts`, `checks/rules/alignment/code_not_allowed.ts`.
- `evals/**` in any way (S2 `rules.json`, `s2-fixtures.ts`, S3 `expected.json`, `s3-assertions.ts`, the 1.0 floor, S7). `packages/prompts/locked/**` (no locked-text change, so the locked hash and prompt version do not move). `packages/core/src/checks/policy.ts`, `types.ts` (no new `CheckKind`; a new kind is a CHG). `compile/nodes.ts` and `compile/compile-draft.ts` (F2 may need them for tags). `checks/rules/grounding/**` (see risk R-F1-3).
- If a test outside the owned files goes red only because `reading_lesson()` gained headings or marks (step 5), fix only the expectation string (an address) in that test file, record which file and why in the report. Do not change a rule to make it green.

## 3. Requirements table

| # | Requirement (source) | Implementation | Verification |
|---|---|---|---|
| R1 | One owning production definition for sections, parts, required roles, minutes; checks and prompt consume it (handoff s1 row 1) | `expected.ts` deleted; `section_missing`, `minutes_out_of_range`, `schema_invalid` call `template_for(ctx.lesson.type)` (steps 4, 6); prompt already renders the template (`render.ts template_block`) | `template-contract.test.ts::every_template_role_is_enforced`, `schema-invalid.test.ts` unknown-type case, `render-production-template.test.ts` |
| R2 | Explicit draft-role to stored-node mapping | `compile/role-nodes.ts` `ROLE_NODE` + `role_present` (step 2); used by `section_missing` and by `compile-contract.test.ts` | `role-nodes.test.ts::*`, `role-nodes.test.ts::compiled_roles_round_trip` |
| R3 | Explicit part obligations: draft part label to stored heading | `SectionSlot.parts` (exists), `plan_parts` (exists), new `parts_present` + part check in `section_missing` | `template-contract.test.ts::missing_part_is_reported`, `::descriptive_part_labels_satisfy_the_template` |
| R4 | Named tolerances; do not call prompt, check and S3 equivalent (handoff s1 row 1) | `SECTION_MINUTES_PROMPT_TOLERANCE = 0`, `SECTION_MINUTES_CHECK_TOLERANCE = 1` in `templates.ts`; S3's 5 documented, not changed | `templates.test.ts::minutes_tolerances_are_named`, `minutes-sections.test.ts::section_tolerance_boundary`, matrix CM-1 |
| R5 | Canonical address helper; `LearninginAction` gone from production | `section_address` in `addresses.ts`; `section_missing` uses it | `absent-section.test.ts::absent_section_address_is_the_compiled_address` |
| R6 | A wholly absent section's issue can be located and resolved | Same test goes through `merge_resolutions` and `submit_gate` | `absent-section.test.ts::absent_section_issue_resolves_through_the_gate` |
| R7 | `student-blocks.ts` uses the shared rationale contract; teacher and student rendering tested | `cfu_parts` in `doc-walk.ts`, used by `schema_invalid.ts` and `student-blocks.ts` | `student-blocks.test.ts::*` (section 7) |
| R8 | Frozen expected outcomes stay independently grounded | Oracle table in section 6; no oracle is read from `templates.ts` | review against section 6 |
| R9 | Matrix with all six handoff areas, consumers and verification | step 10 | `grep -c "^| CM-" docs/design/code-design.md` is 6; reviewer reads CM-1 against code |
| R10 | S1/S2/S3/S4/S7 frozen suites stay at 100% with no `evals/**` edit | step 5 keeps the S2 fixtures valid under the stricter rule | commands in section 7; `git diff --stat -- evals` empty |

## 4. Shared code to use (copied from the current code)

```ts
// packages/core/src/compile/templates.ts (today)
export interface SectionSlot { name: string; minutes: number; required_roles: readonly DraftRole[]; parts?: readonly string[] }
export interface SectionTemplate { lesson_type: string; sections: readonly SectionSlot[] }
export const SECTION_TEMPLATES: { templates: readonly SectionTemplate[] };
export function template_for(lesson_type: string): SectionTemplate | undefined;   // exact match on lesson_type
// Types in SECTION_TEMPLATES: Reading, Writing, Academic Discussion, Research, Presentation (five()), Spark, Flex Day, Assessment (flex()).
// five(): Launch 5 [routine_heading,teacher_talk,sample_response] | Literacy Lab 10 [routine_heading,cfu_item,callout_purpose,callout_say,callout_watch,support_table]
//   | Learning in Action 30 [routine_heading,teacher_talk,cfu_item,callout_purpose,callout_say,callout_watch,support_table] parts [Part A, Part B]
//   | Look Back 5 [quick_write,sample_response] | Homework 0 [homework]
// Spark: Launch 15 / LIA 30 (LIA_ROLES) / Look Back 5 [quick_write] / Homework 0. Flex Day and Assessment: Launch 5 / LIA 40 (FLEX_LIA_ROLES) / Look Back 5 [quick_write].

// packages/core/src/compile/addresses.ts (today)
export function section_slug(name: string): string;                       // "Learning in Action" -> "LearningInAction"
export function normalise_part_label(label: string): string;              // "a" -> "Part A"
export function part_address(section_address: string, part_label: string): string;   // "<section>.PartA"
export function assign_addresses(lesson: StoredLesson, unit_id: UnitId): StoredLesson;  // address = `${lesson.lesson_id}.${section_slug(s.name)}`

// packages/core/src/compile/part-labels.ts (exists)
export type PartRemap = { section: string; from: string; to: string };
export function plan_parts(section: string, parts: readonly (string | null)[]): PartPlan;

// packages/core/src/compile/labels.ts (exists)
export type RationaleLabel = { letter: string | null; correct: boolean; body: string };
export function parse_rationale_label(paragraph_text: string): RationaleLabel | null;
export const SUPPORT_LABEL = "Additional Student Support"; export const ELD_LABEL = "Integrated ELD Instructions";

// packages/schema/src/lesson.ts
export type PMMark = { type: string; attrs?: Record<string, unknown> | undefined };
export type PMNode = { type: string; attrs?: Record<string, unknown> | undefined; content?: PMNode[] | undefined; marks?: PMMark[] | undefined; text?: string | undefined };
// DraftRole union (packages/schema/src/lesson-draft.ts DRAFT_ROLES): routine_heading teacher_talk sample_response callout_purpose callout_say callout_watch
//   support_table cfu_item quick_write text_evidence_needed excerpt_slot teacher_tip homework paragraph list

// checks/rules/structural/doc-walk.ts (today; keep all)
export function walk(node, fn): void; export function node_text(node): string; export function section_nodes(section): PMNode[];
export type CfuItem = { address: string; heading: PMNode; blocks: PMNode[] };
export function find_cfu_items(section: Section): CfuItem[];     // PULSE_RE = /^Pulse Check(?: \(.+\))?$/ ; PART_RE = /^Part\s+([A-Z])$/

// checks/gates.ts
export function merge_resolutions(findings: readonly CheckFinding[], recorded: readonly RecordedResolution[]): GateIssue[];  // resolved iff same (kind, address, code) and kind not NON_RESOLVABLE
export function submit_gate(state: GateState): GateDecision;     // { allowed, refusals, details }
// checks/test-helpers.ts: p, h, routine, callout, eld_block, table(header), cfu_item({code?,options?,correct?,omit_rationale?}), section(name, lesson_id, minutes, nodes),
//   reading_lesson(overrides?, minutes?), make_ctx, make_row, finding, issue, gate_state, DEFAULT_POLICY, LESSON_ID = "G6.U4.L4"
// checks/rules/grounding/fixtures/build.ts: build_ctx("wp1"|"wp2"|"wp3"|"wp4", { mutate?: (draft: LessonDraft) => void }): CheckContext  (compiles the fixture draft with template_for(row.lesson_type))
// section_missing_rule.run(ctx, policy) / minutes_out_of_range_rule.run(ctx, policy) / schema_invalid_rule.run(ctx, policy)
```

Existing precedent to copy from: `compile/compile-contract.test.ts` (the `CASES` array, `json()`/`strip()` helpers, `region()` and the local `present()` that step 9 replaces), `checks/rules/structural/required-roles.test.ts` (rule-level tests), `checks/gates.test.ts` (how `merge_resolutions`, `issue`, `gate_state` and `submit_gate` are called), `packages/prompts/src/render-template-parts.test.ts` (how to render a template and read the `kind=template` block).

## 5. Steps

Decisions made here (PD-32; each is reversible in one file and recorded in the matrix and devlog):
- **D1.** Checks read `template_for`, exact match on `lesson_type`. `expected.ts` accepted any type containing `Assessment`; the stored `lesson.type` is always a template type (generation fails with `template_missing` for any other), so the difference is unreachable in production.
- **D2.** Every `required_roles` entry of the template is a **blocking** `section_missing` finding when the stored section has no matching node, at every stage (generation, background check, reviewer edit, submit, approve). Reason: the worked-pair "typed blocks" tables require these components (Launch `ask` + `sample_response`; Literacy Lab routine, check, ELD support, support table; Look Back Quick Write and `sample_response`), and the prompt already asks for exactly this list. Today only ELD callouts and a Pulse Check were checked. The message names the **draft role** (`callout_watch`, `cfu_item`), the same word the prompt and repair use.
- **D3.** Part obligation: a section whose template has `parts` must contain a level-2 heading with exactly each label (`Part A`, `Part B`). A missing part is reported at the section address (a missing part has no node to point at).
- **D4.** Tolerances: prompt exact (0), blocking check per section 1, lesson total 50 plus or minus 5 stays in `CHECK_POLICY` (SP-3 values, not moved). S3's section tolerance 5 stays in `evals/` (S3 measures first-output shape on the compiled lesson, not the blocking gate); documented in CM-1, not changed.
- **D5.** The `homework` role is lossy in the stored lesson (the compiler writes plain paragraphs for `homework` and `paragraph`). Its stored-node test is therefore "the Homework section has non-empty text". Stated in CM-1 as a known loss; no compiler change.
- **D6.** Fixture addresses in `test-helpers.ts` stay on the legacy slug (`LearninginAction`) because frozen S2 `rules.json` lines 188 and 348 and S7 expect it; production uses the canonical slug. The S2/S7 correction is request R-F1-2.
- **D7.** No locked prompt text changes (the locked hash and prompt version stay). The checks get stricter, so first-pass clean rates can fall; that is measured by the orchestrator's replay (request R-F1-1), never inferred.

**Step 0. Baseline (no edits).** `git log --oneline -3` (expect `45a2a63` or later), then run `npx vitest run packages/core/src/compile packages/core/src/checks packages/prompts apps/worker/src/generation apps/worker/src/wiring` and note anything already red (report it as pre-existing).

**Step 1. `templates.ts`: named tolerances.** Append to `templates.ts` (no change to the template data):
```ts
/** The draft prompt asks for block minutes that add up exactly to the section's minutes (locked lesson-shape.md). */
export const SECTION_MINUTES_PROMPT_TOLERANCE = 0;
/** Blocking `minutes_out_of_range` check, per stored section: |stored - template| above this blocks. A 3-minute Look Back (template 5) must flag. */
export const SECTION_MINUTES_CHECK_TOLERANCE = 1;
```
Doc-comment above both: the lesson total (50 plus or minus 5) is `CHECK_POLICY.minutes_target` / `minutes_tolerance` in `checks/policy.ts`; S3's section tolerance of 5 (`evals/src/suites/s3-assertions.ts`) measures a coarser first-output shape and is **not** equivalent to the check. Tests in `templates.test.ts` (names exact):
- `minutes_tolerances_are_named`: `SECTION_MINUTES_PROMPT_TOLERANCE` is 0, `SECTION_MINUTES_CHECK_TOLERANCE` is 1.
- `template_totals_equal_the_policy_target`: every template's minutes sum equals `CHECK_POLICY.minutes_target` (import `../checks/policy.ts`).
- `parts_are_exact_labels`: every `parts` entry matches `/^Part [A-Z]$/` (the checker's `PART_RE` in `doc-walk.ts`).

**Step 2. `compile/role-nodes.ts` (new): the draft-role to stored-node table.** Pure, no imports from `checks/`. Imports: `DraftRole` from `@ls/schema/lesson-draft`, `PMNode` from `@ls/schema/lesson`, `SUPPORT_LABEL` from `./labels.ts`.
```ts
export type RoleNode =
  | { readonly via: "node"; readonly node: string; readonly attrs?: Readonly<Record<string, string>>;
      readonly attrs_not?: Readonly<Record<string, string>>; readonly attrs_prefix?: Readonly<Record<string, string>> }
  | { readonly via: "mark"; readonly mark: "teacher_talk" | "sample_response" }
  | { readonly via: "text" };   // any non-empty text; the compiler keeps no node for this role
export const ROLE_NODE: Readonly<Record<DraftRole, RoleNode>>;
export function role_present(nodes: readonly PMNode[], role: DraftRole): boolean;
export function parts_present(nodes: readonly PMNode[]): string[];   // trimmed text of every top-level level-2 heading
```
`ROLE_NODE` exact content:

| Draft role | Stored node |
|---|---|
| `routine_heading` | `{via:"node", node:"routine_heading", attrs_not:{icon:"cfu"}}` |
| `teacher_talk` | `{via:"mark", mark:"teacher_talk"}` |
| `sample_response` | `{via:"mark", mark:"sample_response"}` |
| `callout_purpose` / `callout_say` / `callout_watch` | `{via:"node", node:"callout", attrs:{variant:"purpose" / "say" / "watch"}}` |
| `support_table` | `{via:"node", node:"collapsible", attrs_prefix:{label: SUPPORT_LABEL}}` (prefix, because `docs/source/04` line 62 lets the label carry a suffix such as "Additional Student Support: Finding Evidence") |
| `cfu_item` | `{via:"node", node:"routine_heading", attrs:{icon:"cfu"}}` |
| `quick_write` | `{via:"node", node:"routine_heading", attrs:{icon:"writing"}}` |
| `text_evidence_needed` | `{via:"node", node:"quote_placeholder"}` |
| `excerpt_slot` | `{via:"node", node:"excerpt_slot"}` |
| `teacher_tip` | `{via:"node", node:"teacher_tip"}` |
| `homework` | `{via:"text"}` |
| `paragraph` | `{via:"node", node:"paragraph"}` |
| `list` | `{via:"node", node:"bullet_list"}` |

`role_present`: flatten `nodes` depth-first (each node, then its `content`); `via:"node"`: true when some flattened node has `type === node`, every `attrs` entry equals (`String(n.attrs?.[k]) === v`), no `attrs_not` entry equals, and every `attrs_prefix` entry satisfies `String(n.attrs?.[k] ?? "").startsWith(v)`; `via:"mark"`: some flattened node has `type === "text"` and a `marks` entry with `type === mark`; `via:"text"`: some flattened node has `type === "text"` and `(text ?? "").trim() !== ""`. `parts_present`: the top-level nodes of type `heading` with `attrs?.level === 2`, text from the flattened text of that node, trimmed.

**Step 3. `addresses.ts`.** Add and use:
```ts
/** The one address of a section: `<lesson_id>.<section_slug(name)>`. Every writer and every finding for a section that may not exist uses this. */
export function section_address(lesson_id: string, name: string): string;
```
`assign_addresses` calls it (`address: section_address(lesson.lesson_id, s.name)`); behaviour unchanged. Test in `addresses.test.ts`: `section_address_matches_the_pattern`: `section_address("G6.U4.L5","Learning in Action")` is `"G6.U4.L5.LearningInAction"` (oracle: PRD R-21 and CON-11 line 721), `"Look Back"` gives `...LookBack`, `part_address(section_address(...), "Part A")` gives `...LearningInAction.PartA`. Do not edit `compile-draft.ts` (it builds the same string with `section_slug`; F2 may edit that file; leave it).

**Step 4. Delete `expected.ts`; rewrite the three structural rules.** `git rm packages/core/src/checks/rules/structural/expected.ts`.
- `section_missing.ts`: replace the `EXPECTED_SECTIONS` / `has_role` / `section_name_to_address` code with this algorithm (keep the closing slot-obligation block exactly as it is today):
  1. `const template = template_for(ctx.lesson.type); if (template === undefined) return [];` (import `template_for` from `../../../compile/templates.ts`, `role_present`, `parts_present` from `../../../compile/role-nodes.ts`, `section_address` from `../../../compile/addresses.ts`).
  2. For each `slot` of `template.sections` in order: `stored = ctx.lesson.sections.find((s) => s.name === slot.name)`. Absent: push finding `Section "${slot.name}" is missing` at `section_address(ctx.lesson.lesson_id, slot.name)` and `continue`. (Invariant: the address equals the one `compile_draft` assigns, so a recorded resolution and the editor agree.)
  3. `nodes = section_nodes(stored)`. For each `role` of `slot.required_roles` not satisfied by `role_present(nodes, role)`: push `Section "${slot.name}" is missing required role ${role}` at `stored.address`.
  4. For each `label` of `slot.parts ?? []` not in `parts_present(nodes)`: push `Section "${slot.name}" is missing part "${label}"` at `stored.address`.
  5. After the loop, the existing excerpt-slot obligation block, unchanged.
  Level and kind stay `blocking` / `section_missing`; `section_missing` stays resolvable (`NON_RESOLVABLE` in `gates.ts` is untouched).
- `minutes_out_of_range.ts`: import `template_for` and `SECTION_MINUTES_CHECK_TOLERANCE`; iterate `template.sections`; the section message becomes `"${name}" is ${stored} minutes; the template expects ${expected} (allowed difference ${SECTION_MINUTES_CHECK_TOLERANCE})`; total check unchanged (`policy.minutes_target`, `policy.minutes_tolerance`).
- `schema_invalid.ts`: the unknown-type guard becomes `template_for(ctx.lesson.type) === undefined`; same message `Unknown lesson type "..."`. In the same file use `cfu_parts` (step 7) for the CFU block.

**Step 5. `test-helpers.ts`: keep every frozen fixture valid under the stricter rule.** The S2 recipe `clean_reading` is `make_ctx(reading_lesson())` and expects zero blocking issues of any kind; `reading_lesson()` is also the base of the S2 `section_missing`, `minutes_out_of_range`, `vocabulary_word_missing` recipes. So `reading_lesson()` must itself satisfy the Reading template. Edits (only these):
1. Replace `import { section_name_to_address } from "./rules/structural/expected.ts"` by a local function in `test-helpers.ts`:
   `const fixture_section_address = (lesson_id: string, name: string): string => \`${lesson_id}.${name.replace(/\s+/g, "")}\`;` with a comment: legacy slug kept so frozen S2 `rules.json` (lines 188, 348) and S7 keep their addresses; production uses `section_address`; remove when the evals owner corrects those expectations (request R-F1-2). `section()` calls it.
2. Add exported helpers: `talk(t)` (a `paragraph` whose text node has `marks: [{ type: "teacher_talk" }]`), `sample(t)` (same with `sample_response`), `support_table_node()` (a `collapsible` with `attrs: { label: "Additional Student Support" }` containing `table(true)`).
3. `reading_lesson()` sections become (keep the existing nodes, add the new ones; use neutral lower-case sentences with no capitalised mid-sentence words, so no name, page or quote scan fires):
   - Launch: `routine("notes_section","Notes")`, `p("Warm up.")`, `talk("Say: begin the warm up.")`, `sample("Model answer for the warm up.")`.
   - Literacy Lab: `routine("notes_section","Language Study")`, `p("Lab.")`, `eld_block()`, `support_table_node()`, `...cfu_item({})`.
   - Learning in Action: `h(2,"Part A")`, `routine("notes_section","Close reading")`, `talk("Say: model the thinking.")`, `eld_block()`, `support_table_node()`, `h(2,"Part B")`, `...cfu_item({})`.
   - Look Back: `routine("writing","Quick Write")`, `p("Write.")`, `sample("Model answer for the quick write.")`.
   - Homework: unchanged `p("None.")`.
   Section minutes stay 5/10/30/5/0.
4. Run `npx vitest run packages/core/src/checks`. Expect shifts only where a test asserted a raw `reading_lesson()` address inside Learning in Action (the CFU now sits under `Part B`) or counted CFU items. Fix those expectations in place with the rule in section 2 and list them in the report. If a frozen **S2** case goes red (`npx vitest run evals/src/suites/s2.test.ts`) because of an address the fixtures shifted, **stop and report**; do not edit `evals/**`.

**Step 6. `wp3-clean.json`.** `packages/core/src/checks/fixtures/wp3-clean.json` is a hand-made stored Flex Day lesson that `minutes-sections.test.ts::WP-3 clean flex day has no finding from any structural rule` requires to be clean. It lacks teacher-talk marks. Authority: WP-3 B table (Launch `ask` + `sample_response`; Learning in Action `teacher_note` + `teacher_tip` + routine + check). Add `{"type":"teacher_talk"}` to the `marks` of the text node(s) of the existing Launch prompt paragraph and of one existing Learning in Action instruction paragraph (no new text). Keep the stored `address` values as they are in the file (legacy `LearninginAction`); `section_missing` uses `stored.address` for present sections, so they do not matter.

**Step 7. Shared rationale contract.** In `doc-walk.ts` add (and keep `find_cfu_items` as it is):
```ts
import { parse_rationale_label } from "../../../compile/labels.ts";
import type { RationaleLabel } from "../../../compile/labels.ts";
export type CfuParts = {
  stem: PMNode[];                                  // blocks before the lettered list (all blocks when there is no lettered list)
  list: PMNode | undefined;                        // first ordered_list with attrs.type === "A"
  rationales: { node: PMNode; label: RationaleLabel }[];   // paragraphs after the list whose text parse_rationale_label accepts
  extra: PMNode[];                                 // every other block after the list
};
export function cfu_parts(item: CfuItem): CfuParts;
```
`cfu_parts`: `list = item.blocks.find((b) => b.type === "ordered_list" && b.attrs?.type === "A")`; no list: `stem = item.blocks`, others empty. Otherwise `stem = blocks before list`; for each block after the list: a `paragraph` with `parse_rationale_label(node_text(b)) !== null` goes to `rationales`, anything else to `extra`.
- `schema_invalid.ts`: replace its inline "after the list / parse each paragraph" code with `cfu_parts(item).rationales` (same findings, same messages; the lettered-list-missing finding stays).
- `student-blocks.ts`: replace the filter with: for each CFU item `parts = cfu_parts(item)`; student text = `[...parts.stem, ...(parts.list ? [parts.list] : []), ...parts.extra]` filtered to nodes of type `ordered_list` or `paragraph`, mapped through `node_text`, joined with a space. Delete the `/^[A-Z]\.\s*(Correct|Incorrect)/` regex. Why positional: a stem such as "Correct the sentence below" sits before the list and must stay student text, whereas `parse_rationale_label` accepts an unlettered "Correct ..." (letter is optional) and would drop it if applied to every paragraph. Quick Write and Homework handling is unchanged.

**Step 8. Tests for the structure contract.** New file `checks/rules/structural/template-contract.test.ts` (use `build_ctx` with `mutate`, `section_missing_rule`, `DEFAULT_POLICY`; names exact):
- `every_template_role_is_enforced`: for each `[section, role]` in the **hand-written** list copied from the worked-pair B tables: `["Launch","teacher_talk"]`, `["Launch","sample_response"]`, `["Literacy Lab","cfu_item"]`, `["Literacy Lab","callout_say"]`, `["Literacy Lab","support_table"]`, `["Learning in Action","cfu_item"]`, `["Learning in Action","callout_watch"]`, `["Look Back","quick_write"]`, `["Look Back","sample_response"]`: `build_ctx("wp1", { mutate: (d) => { d.blocks = d.blocks.filter((b) => !(b.section === section && b.role === role)); } })` then `section_missing_rule.run(ctx, DEFAULT_POLICY)` returns findings whose messages include `Section "${section}" is missing required role ${role}` (assert exactly that message is present; other findings caused by the same removal are tolerated only if they are for the same section). Before the loop, assert the unmutated `build_ctx("wp1")` gives `[]` for the role/part findings (filter out any finding whose message starts `Lesson is missing a required excerpt slot`).
- `compiled_good_drafts_satisfy_the_template`: `build_ctx("wp1")`, `build_ctx("wp2")`, `build_ctx("wp3")` each give no finding whose message starts with `Section` from `section_missing_rule`.
- `homework_needs_text`: a Reading lesson from `reading_lesson()` whose Homework content is `[{ type: "paragraph" }]` gives one finding `Section "Homework" is missing required role homework`; with `p("Read pages.")` none.
- `missing_part_is_reported`: `build_ctx("wp1", { mutate })` where every block with `part === "Part B"` gets `part = "Part A"`: exactly one finding, message `Section "Learning in Action" is missing part "Part B"`, address = the stored Learning in Action section's address.
- `descriptive_part_labels_satisfy_the_template`: mutate so Learning in Action blocks with `part === "Part A"` become `"Gather evidence"` and `"Part B"` become `"Plan and write"`: no part finding (the compiler maps them, `plan_parts`), and `compile_draft(...).part_remaps` has 2 entries (compile the mutated draft directly the way `build_ctx` does, or read `part_remaps` from a second call).
- `flex_day_roles_are_enforced`: `build_ctx("wp3", { mutate })` removing `teacher_tip` blocks gives `Section "Learning in Action" is missing required role teacher_tip`; removing Launch `sample_response` gives the Launch finding.
- `unknown_type_is_not_a_section_problem`: `reading_lesson({ type: "Mystery" })` gives `[]` from `section_missing_rule` (schema_invalid reports it; existing test in `minutes-sections.test.ts` already covers the message).

New `checks/rules/structural/absent-section.test.ts` (names exact):
- `absent_section_address_is_the_compiled_address`: `const ctx = build_ctx("wp1")`; `const compiled_addr = ctx.lesson.sections.find((s) => s.name === "Learning in Action")!.address`; build a lesson without that section; `section_missing_rule.run` gives one finding with message `Section "Learning in Action" is missing`; assert `address === compiled_addr` **and** `address === "G6.U4.L4.LearningInAction"` (oracle: PRD R-21, CON-11 line 721, not the helper) and `address !== "G6.U4.L4.LearninginAction"`.
- `absent_section_issue_resolves_through_the_gate`: take that finding; `merge_resolutions([f], [])[0].resolved` is `false` and `submit_gate(gate_state({ issues: merged }))` refuses with `BLOCKED` whose `details.issues` lists it; `merge_resolutions([f], [{ kind: "section_missing", address: compiled_addr, code: null }])[0].resolved` is `true` and `submit_gate` then has `allowed === true`; a resolution recorded at the old address `G6.U4.L4.LearninginAction` leaves it unresolved (documents the old mismatch).

Add to `minutes-sections.test.ts`: `section_tolerance_boundary` (Reading lesson, `reading_lesson({}, { "Look Back": 4 })` and `6` give no section finding; `3` and `7` give one at `G6.U4.L4.LookBack`; oracle: WP-1 stored Look Back is 3 against 5 and must flag, S2 case `s2-rule-minutes_out_of_range`); and `minutes_message_names_the_tolerance` (message contains `allowed difference 1`). In the same file the existing `flags a missing Learning in Action as section_missing` expects the legacy literal: change its address assertion to `G6.U4.L4.LearningInAction` (production address now) and keep the message assertion. In `required-roles.test.ts` change the two role messages to the draft-role names (`callout_watch`, `cfu_item`) and replace the literal `"G6.U4.L4.LearninginAction"` / `"G6.U4.L4.LiteracyLab"` addresses by `lia.address` / `lab.address` read from the lesson (stored sections keep the fixture slug); the third test (`missing_required_slot_names_the_section_address`) stays as is.

New `compile/role-nodes.test.ts` (names exact; hand-written PM literals, oracle `docs/source/04-lesson-structure-analysis.md` node table lines 61-62: callout `variant` in purpose/say/watch, collapsible `label` in the two labels):
- `callout_variants_are_distinct`: a `callout` with `variant:"say"` satisfies `callout_say` and not `callout_purpose`.
- `support_table_is_not_the_eld_dropdown`: collapsible `label:"Additional Student Support"` and `"Additional Student Support: Finding Evidence"` satisfy `support_table`; `"Integrated ELD Instructions"` does not.
- `marks_not_headings`: a text node with mark `teacher_talk` satisfies `teacher_talk` and not `sample_response`; an unmarked paragraph satisfies neither.
- `routine_roles_by_icon`: `routine_heading` icon `notes_section` satisfies `routine_heading` only; icon `cfu` satisfies `cfu_item` only; icon `writing` satisfies `quick_write` only and also `routine_heading` (icon is not `cfu`).
- `slots_tips_lists`: `quote_placeholder`, `excerpt_slot`, `teacher_tip`, `bullet_list`, `paragraph` nodes satisfy `text_evidence_needed`, `excerpt_slot`, `teacher_tip`, `list`, `paragraph`.
- `homework_is_any_non_empty_text`: `{type:"paragraph"}` fails; a paragraph with text `"Read."` passes.
- `parts_present_reads_level_two_headings`: headings level 2 "Part A", "Part B " give `["Part A","Part B"]`; a level-3 "Part C" is ignored.
- `every_draft_role_has_a_mapping`: `DRAFT_ROLES.every((r) => ROLE_NODE[r] !== undefined)`.
- `compiled_roles_round_trip`: for the three compile-contract cases (reuse the `CASES` loading code: WP-1 `../../../llm/src/fixtures/draft-wp1.json`, WP-2 `.../draft-wp2.json`, WP-3 `../../../../evals/cases/drafts/_fixtures/good-wp-3.json`, strip `_` keys), compile and assert for every distinct `(section, role)` among the draft's blocks that `role_present(compiled section nodes, role)` is true. Input is the draft, output is the compiler's lesson, so a compiler change that drops a node the table expects fails here.

Prompt consumer test, new `packages/prompts/src/render-production-template.test.ts` (render pattern from `render-template-parts.test.ts`: `new PromptRenderer(LOCKED_DIR, new SchemaRegistry()).render_lesson_draft({ ...draft_input(wp2_row()), template })`, read the user block containing `kind=template`; import `SECTION_TEMPLATES`, `template_for` from `@ls/core/compile/templates`):
- `reading_template_is_rendered_from_the_worked_pair`: expected lines are **hand-written** from WP-1 "Required output B": `section 1: Launch, 5 minutes, roles: routine_heading, teacher_talk, sample_response`, `section 3: Learning in Action, 30 minutes, roles: routine_heading, teacher_talk, cfu_item, callout_purpose, callout_say, callout_watch, support_table; parts: Part A, Part B`, `section 4: Look Back, 5 minutes, roles: quick_write, sample_response`, `section 5: Homework, 0 minutes, roles: homework`.
- `every_production_template_is_rendered_in_full` (agreement check only, not an independent oracle): for each template, each section has a rendered line with the section name, `${minutes} minutes`, its `required_roles.join(", ")`, and `parts:` iff `parts` is defined.

**Step 9. `compile-contract.test.ts`.** Delete the local `present()`; import `role_present` from `./role-nodes.ts` and call `role_present(nodes, role)`; keep `region()`, `CASES`, the expected.json loading, the placeholder and part-address assertions untouched. Test names `wp1_components`, `wp2_components`, `wp3_components` stay.

**Step 10. The matrix document.** Edit `docs/design/code-design.md` only:
1. Section 2.1 table rows (lines about `templates.ts` and `addresses.ts`): `templates.ts` interface column becomes `SECTION_TEMPLATES`, `template_for`, `SECTION_MINUTES_PROMPT_TOLERANCE`, `SECTION_MINUTES_CHECK_TOLERANCE`; add a row `packages/core/src/compile/role-nodes.ts | Maps each draft role to the stored node that proves it (one table for compile tests and checks). | ROLE_NODE, role_present, parts_present | schema | A5 compile`; `addresses.ts` row adds `section_address`.
2. After the section 10 table insert the new section, exactly this (the implementer pastes it; F2/F3 later replace only the cells marked `F2 fills` / `F3 fills`):

```
## 10a. Lesson-contract matrix (follow-up handoff 2026-10-26, section 1)

One row per contract area. It adds no requirement: each row names the authority (order: issued brief, recorded decisions, PRD,
worked pairs; code and fixtures prove behaviour, never intent), the one code owner, what may be normalised, who reads the fact,
at which lifecycle stage it applies and the evidence. Status: `filled` or `skeleton (owner)`. Changes to an agreed CON card still
go through `docs/contracts/CHANGES.md`. A new fact is added here before a second table or regular expression is written elsewhere.

| ID / area / status | Authoritative requirement | Canonical representation and code owner | Permitted normalisation | Consumers (prompt · schema · compiler · editor · check · report) | Lifecycle applicability | Verification evidence |
|---|---|---|---|---|---|---|
| CM-1 Sections, parts, required roles and minutes. Status: filled (F1) | PRD R-11: Reading, Writing, Academic Discussion, Research, Presentation = Launch 5, Literacy Lab 10, Learning in Action 30, Look Back 5, Homework 0; Spark 15/30/5 (+ Homework 0); Flex Day and Assessment 5/40/5. `docs/source/04` section 3b: Learning in Action usually has Part A and Part B (WP-1 and WP-2 show it; Spark and flex days have none). Worked pairs WP-1/WP-2/WP-3 "Required output B": the typed blocks per section and part. PRD R-21 and CON-11: address `<lesson>.LearningInAction.PartA`. Section tolerance 1, total 50 plus or minus 5, and prompt "exactly" are design choices (NL-18/NL-20, SP-3 values), not brief text: label them choices | Template, parts and required draft roles: `packages/core/src/compile/templates.ts` (`SECTION_TEMPLATES`, `template_for`). Draft role to stored node: `compile/role-nodes.ts` (`ROLE_NODE`, `role_present`, `parts_present`). Draft part label to heading: `compile/part-labels.ts` (`plan_parts`). Addresses: `compile/addresses.ts` (`section_address`, `part_address`). Tolerances: `SECTION_MINUTES_PROMPT_TOLERANCE` = 0, `SECTION_MINUTES_CHECK_TOLERANCE` = 1 (templates.ts); lesson total in `checks/policy.ts` (50 plus or minus 5) | Part label: any lettered or descriptive label becomes `Part A`, `Part B` (descriptive text kept as a title routine; `part_remaps` reports it). Section name to address: `section_slug` only. Stored section minutes = sum of the draft blocks' minutes. Not permitted: a second table of sections or roles, matching on heading wording, renaming a role in a finding. Known loss: `homework` and `paragraph` both compile to plain paragraphs, so `homework` is checked as "Homework section has text" | prompt: `render.ts template_block` prints name, minutes, roles and `parts:` from the template; locked `lesson-shape.md` states exact minutes and the exact part label. schema: `DRAFT_ROLES`. compiler: `compile_draft` uses template names, order, parts and `check_role` (forbidden roles per section, `compile/roles.ts`). editor: `data-address` equals the stored section address. check: `section_missing` (absent section, absent required role, absent part), `minutes_out_of_range` (per section within 1, total within policy), `schema_invalid` (unknown lesson type). report: S3 `required_blocks` and `section_minutes` (evals) read expected.json, not the template | Same rule at every stage: generation (repair feedback), background check, reviewer edit, submit, approve; blocking and resolvable; no human-work exception | `compile/{templates,role-nodes,addresses}.test.ts`; `checks/rules/structural/{template-contract,absent-section,minutes-sections,required-roles}.test.ts`; `compile/compile-contract.test.ts` (expected.json from the worked pairs); `prompts/src/render-production-template.test.ts`. Not equivalent: S3 `section_minutes` allows 5 per section and measures first-output shape on the compiled lesson; it passes drafts the blocking check (1) rejects. A second S3 observation at the check tolerance is a proposed, unmade eval change |
| CM-2 Teaching and assessment evidence. Status: skeleton (F2 fills) | Brief ("aligned to teach the CA Core ELA/ELD standards"); PRD R-15, R-20; worked pairs WP-1/WP-2 "Alignment map" (taught_in / checked_in per code); `docs/source/04` section 4 | Today: code in heading text via `compile/standard-tags.ts` (compatibility codec), read by `checks/rules/alignment/standards-view.ts` (`doc_tags`, `focus_obligations`, `assessment_codes`) | F2 fills | F2 fills | F2 fills | F2 fills |
| CM-3 Standard identity and provenance. Status: skeleton (F2 fills) | PRD R-4 (resolve every code), R-20 (origin, asserted_by), HP-3 (confirmation of narrowed or added); WP-1 section A (codes and proposed leaves) | Today three parallel forms: `Standard` in `StoredLesson.front_matter.standards` (built by `apps/worker/src/generation/nodes/front-matter-standards.ts`), `DraftBlock.code_origins`, `cfu.standard_code` (comma lists), plus `alignment_link` rows | F2 fills | F2 fills | F2 fills | F2 fills |
| CM-4 Empty lists, narrowed and added standards. Status: skeleton (F2 fills) | WP-1 (narrowed `L.6.4.b`, confirmation open), WP-2 (narrowed writing leaves), WP-3 (no standards, generator may propose `RL.6.7`); PRD R-20 acceptance addition (open `narrowed` or `added` confirmation blocks Approve); `N/A` and lesson ids are never codes | Today: `lesson-shape.md` ("Do not narrow"), nullable `cfu.standard_code` (PD-39), `checks/rules/alignment/code_not_allowed.ts`, `standard_confirmation.ts` | F2 fills | F2 fills | F2 fills | F2 fills |
| CM-5 Readiness and human work. Status: skeleton (F3 verifies) | PRD R-12 (`text_evidence_needed`), R-33/R-34 (Submit and Approve block on unresolved blocking issues; cross-lesson link waits); CON-13, CON-14, CON-18 | Slot state `checks/rules/links/slots.ts`; obligations `links/slot-obligations.ts`; gates `checks/gates.ts`; generation filter `NOT_ACTIONABLE_KINDS` in `apps/worker/src/wiring/generation.ts` | F3 fills | F3 fills | F3 fills (states: required slot absent, slot open, source supplied, confirmation pending, approved) | F3 fills |
| CM-6 Source and context identity and metrics. Status: skeleton (owner not yet assigned) | Handoff section 1 and 3; PRD R-35 (provenance on every version) | Generation: pinned run context (`CompileCheckNode`, `pinned_prompt_context`); checks: `checks/context-loader.ts`; replay and reports: `evals/src/{replay-finals,full-run-facts}.ts` | not assigned | not assigned | not assigned | not assigned |
```
(Paste the table as one markdown table; rows must stay on single lines so later slices can edit one row without conflicts.)
3. Verify: `grep -c "^| CM-" docs/design/code-design.md` prints `6`.

**Step 11. Context upkeep (rule `context-maintenance`).** Append to `.claude/reference/area-map.md`: the A5 row gains `role-nodes.ts`; the A6a row gains "NL-CONTRACT-F1 deleted `rules/structural/expected.ts` (checks read `compile/templates.ts`), added `rules/structural/doc-walk.ts` `cfu_parts`". Create `docs/devlog/2026-10-26-contract-f1.md` (Changed, Why, Checked, Remaining; about 100 words) stating D1 to D7, that nothing was run against a model, that the checks are stricter so replay must re-measure (R-F1-1), and requests R-F1-1 to R-F1-3. The router (`.claude/README.md`) already routes design questions to `docs/design/`; no router change.

## 6. Data and fixtures, and where each new oracle comes from

Synthetic only. Existing files: `packages/llm/src/fixtures/draft-wp{1,2}.json`, `evals/cases/drafts/_fixtures/good-wp-3.json`, `evals/cases/drafts/wp-{1,2,3}/expected.json` (read only), `packages/core/tests/fixtures/draft-wp1.json`, `packages/core/src/checks/fixtures/wp3-clean.json`, `build_ctx` rows from the issued-sheet double. Inline text only for the new PM literals. Never read `docs/source/restricted`, seeded-error keys or any `.env`.

Checked in this plan: the three good drafts already hold every role the template requires, and Part A/Part B (WP-1 llm draft, WP-2 llm draft, WP-3 good draft; stub `draft` variants too). Two known gaps to fix as fixtures: `packages/core/tests/fixtures/draft-wp1.json` has **no `routine_heading` in Learning in Action** (the pair's Part A opens with the "Percy's Voice" routine) and `wp3-clean.json` has no teacher-talk marks (step 6). For the first, add one `routine_heading` block as the first Part A block of Learning in Action, copying the text, `standard_codes: []`, `code_origins: []`, `cfu: null`, `minutes: null` of the same block in `packages/llm/src/fixtures/draft-wp1.json`; grep for a hash pin first.

| New test | Oracle (not generated from `templates.ts`) |
|---|---|
| `every_template_role_is_enforced` | hand-written (section, role) list from WP-1/WP-2/WP-3 "Required output B" typed-block tables |
| `compiled_good_drafts_satisfy_the_template`, `compile-contract` | `evals/cases/drafts/wp-N/expected.json` (frozen, derived from the pairs) |
| `missing_part_is_reported`, `descriptive_part_labels_satisfy_the_template` | WP-1/WP-2 B tables: Learning in Action = Part A, Part B; slice-D D-1 |
| `absent_section_address_is_the_compiled_address` | literal `G6.U4.L4.LearningInAction` from PRD R-21 and CON-11 line 721 |
| `section_tolerance_boundary` | WP-1: stored Look Back 3 against 5 must flag (S2 `s2-rule-minutes_out_of_range`); boundary 4 and 6 clean is the declared choice of tolerance 1 |
| `role-nodes.test.ts` literals | `docs/source/04` node table (callout variants, collapsible labels) and the worked-pair node names |
| `render-production-template` first test | WP-1 B table (minutes and parts); the all-templates test is an agreement check and is labelled so |
| `student-blocks.test.ts` | the draft fixture's own `cfu.key_index`, `stem`, `options`, `rationales` (input of the compiler), not the compiler output |

## 7. Checks

Student-block tests (new `checks/rules/safety/student-blocks.test.ts`, names exact):
- `teacher_view_keeps_the_rationales`: compile the WP-1 fixture (`build_ctx("wp1")`), `find_cfu_items` on Literacy Lab; `cfu_parts(item).rationales` has one entry per draft option; `label.correct` is true exactly at the draft's `cfu.key_index` and `label.body` equals the draft rationale; `schema_invalid_rule.run` returns no CFU finding.
- `student_view_drops_the_rationales_and_keeps_stem_and_options`: `student_blocks(lesson)` entry for that item address contains the draft `stem` and each option string and none of the rationale bodies, nor `Correct:` / `Incorrect:`.
- `unlettered_rationale_is_not_student_text`: `cfu_item({})` from test-helpers (rationales `Correct: reason 1`, no letter): student text has no `reason`.
- `stem_that_starts_with_correct_stays_student_text`: an item whose stem paragraph is `Correct the sentence below.` placed before the list keeps that stem in the student text.
- `paragraph_after_the_rationales_is_student_text`: a non-rationale paragraph after the rationales is kept.
- `one_rationale_parser`: reads the non-test `.ts` files under `checks/rules/safety/` and `checks/rules/structural/` (`readdirSync`) and asserts none contains the substring `Correct|Incorrect` (the shared parser is `compile/labels.ts`; `grounding/name-scan.ts` is out of scope, request R-F1-3).

While iterating (affected tests only):
```sh
npx vitest run packages/core/src/compile
npx vitest run packages/core/src/checks
npx vitest run packages/prompts/src/render-production-template.test.ts packages/prompts/src/render-template-parts.test.ts
npx vitest run apps/worker/src/generation apps/worker/src/wiring
npx vitest run evals/src/suites/s2.test.ts evals/src/suites/s7.test.ts evals/src/suites/s3-assertions.test.ts evals/src/suites/s3.test.ts evals/src/suites/s1.test.ts evals/src/suites/s4.test.ts evals/src/suites/provenance-s2s4.test.ts
```
Must stay green (expectation edits are only the ones named in steps 5, 8): `compile/{compile-draft,labels,part-labels,templates,addresses}.test.ts` (compile hash tests unchanged: `compile_draft` output is not touched), `checks/{gates,registry,run-checks,context-loader,policy}.test.ts`, all of `checks/rules/**` (including F2-owned alignment and links tests: only an address-string fix if step 5 shifted it), `apps/worker/src/wiring/check-parity.test.ts`, `apps/worker/src/generation/nodes/compile-check-node.test.ts`, S1 12/12, S2 28/28 (`all_rule_cases_pass`, `mutation_turns_each_rule_red`), S7, S3 assertions and the S3 stub cases.

Once before the final commit (cheapest first):
```sh
npx eslint packages/core/src/compile packages/core/src/checks packages/prompts/src apps/worker/src/generation apps/worker/src/wiring
npm run typecheck --workspace @ls/core
npm run typecheck --workspace @ls/prompts
npm run typecheck --workspace @ls/worker
npm run typecheck --workspace @ls/evals
npx vitest run packages/core/src/compile packages/core/src/checks packages/prompts apps/worker/src/generation apps/worker/src/wiring
```
(if `@ls/worker` is not the workspace name, use `npx tsc -p apps/worker/tsconfig.json --noEmit`.) Database-dependent `*.int.test.ts` run only if Postgres is up; otherwise say "not run". Full suite: not run by the implementer; the orchestrator runs it before the next deploy (shared test helper and compile fixtures change). Passing means: every named test exists and passes; S1/S2/S3/S4/S7 pass unchanged; `git diff --stat -- evals` is empty; `git diff --stat -- packages/prompts/locked` is empty; `grep -rn "expected.ts\|EXPECTED_SECTIONS\|section_name_to_address" packages apps evals --include=*.ts` finds nothing outside the legacy local comment in `test-helpers.ts`.

## 8. Risks and requests

**What F2 and F3 may assume after F1 merges (F1 lands first; F2 and F3 branch from it):**
- `section_address(lesson_id, name)` and `part_address` are the only address builders; never concatenate a section name.
- `template_for`, `SectionSlot.parts`, the two named tolerances, `ROLE_NODE`, `role_present`, `parts_present`, `cfu_parts`; `expected.ts` no longer exists (do not recreate it).
- `section_missing` enforces every template role and part at every stage, is blocking and resolvable, and names the draft role. A fixture that is meant to be a valid lesson must satisfy the template.
- `reading_lesson()` in `test-helpers.ts` is now a complete Reading lesson: Learning in Action = `h2 Part A`, a routine, teacher talk, ELD group, support table, `h2 Part B`, one Pulse Check (`RL.6.1`); Literacy Lab also holds a Pulse Check. Helpers `talk`, `sample`, `support_table_node` exist. Fixture section addresses are still the legacy slug.
- Not changed, free for F2: `standard-tags.ts`, `alignment/**`, `links/**`, `front-matter-standards.ts`, `code_not_allowed.ts`, `compile/nodes.ts`, `compile/compile-draft.ts`, the locked prompt text and hash, `CheckKind`, `policy.ts`.
- F3 may build lifecycle tests on `build_ctx(...)` with `mutate`, and on the finding messages `Section "X" is missing required role <draft_role>` and `Section "X" is missing part "Part B"`.
- The matrix file `docs/design/code-design.md` section 10a: F2 edits only the CM-2 to CM-4 lines, F3 only CM-5 (and CM-6 if assigned), one row per line.

**Requests to the orchestrator:**
- **R-F1-1 (RUNTIME).** The checks are stricter, so first-pass and final clean rates on stored drafts can drop. After F1 and F2 merge, run the offline replay with F1 attributed separately (handoff section 3, items 4 and 5): expected shape is a small number of new `section_missing` findings naming `sample_response`, `teacher_talk`, `routine_heading`, `callout_*`, `support_table` or a missing part on stored drafts; report the count per role and the denominator (44 compiled of 47). If any one role accounts for most of them, that is a prompt or template question for Innocent, not a reason to loosen the check inside F1.
- **R-F1-2 (CONTRACT-QUESTION, choice made).** Two sources disagree: S2 `evals/cases/s2/rules.json` lines 188 and 348 and `evals/src/suites/s7-support.ts:56` expect `LearninginAction` (a fixture slug), while PRD R-21 and CON-11 line 721 say `LearningInAction`. Choice: production uses the canonical slug; the fixture slug survives only in `test-helpers.ts` (D6). A separate recorded S2/S7 correction by the evals owner (authority R-21/CON-11, scope three strings) then lets `test-helpers.ts` use `section_address` and the legacy function be deleted. Not done here because `evals/**` is not F1's.
- **R-F1-3 (not F1).** `checks/rules/grounding/name-scan.ts:119` has its own `OPTION_LABEL` regex for rationale labels (it also accepts `Correct.` and `Correct -`); it should call `parse_rationale_label` or share a label-prefix helper. Left to the grounding owner.
- **R-F1-4 (S3 proposal, not made).** A second S3 observation `section_minutes_at_check_tolerance` using `SECTION_MINUTES_CHECK_TOLERANCE` (1) would show how many first outputs pass the blocking check; S3 floors, `expected.json` and the existing `section_minutes` assertion stay untouched.
- **R-F1-5 (apps/web follow-up).** `apps/web/src/features/workspace/jump.ts` returns false for an address with no rendered element, so the issue for a wholly absent section cannot scroll anywhere. It stays listed and resolvable; a UI fallback (jump to the lesson top) is a web-owner change.

**Risks:**
- An existing recorded resolution for an absent-section `section_missing` at the old `LearninginAction` address will not match the new canonical address after the next check run (low: such a resolution had no section to point at). Stated, not migrated.
- The stricter role check also applies to hand-edited lessons: a reviewer who deletes the Launch sample response is blocked at Submit until the node returns or a named resolution is recorded. This follows the pairs; reversing it means removing roles from the template, in one file.
- `student-blocks.ts` now treats only paragraphs after the lettered list as rationales; a lesson with no lettered list keeps all its paragraphs as student text (the structural rule already blocks such a lesson).
- Stub `first_draft` fixtures stay defective by design; the worker generation tests that drive the repair path may count more or different first-pass findings. Fix a count only after confirming the new finding is a genuine template gap in that fixture, and say so in the report.

## 9. Readiness

**READY.** No `NEEDS-DECISION` for Innocent: the choices D1 to D7 follow the worked pairs, the PRD and the checker's own constraints, and none contradicts a recorded decision. Open items: R-F1-1 is `RUNTIME` (counts only a run can give; the work above is not dropped whatever the number); R-F1-2 is a `CONTRACT-QUESTION` with the reading chosen above and its cost stated. Conditions: the orchestrator accepts the F1 ownership of `checks/test-helpers.ts` and the three listed fixture files for this wave, and F2/F3 wait for F1's merge.

## Deviations

Recorded by the F1 implementer, 2026-10-26.

- **D8 (test-helpers, Literacy Lab check is untagged).** The plan has `reading_lesson()` put a tagged Pulse Check (`RL.6.1`) in Literacy Lab. That made 12 alignment and confirmation tests (`code-not-allowed`, `standards-evidence`, `confirmation`) red, because they rebuild only Learning in Action and relied on it being the only tagged check. `cfu_item` gained `untagged: true` (bare `Pulse Check` heading); the Literacy Lab check uses it. The template needs a `cfu_item` there, not a standard claim. No alignment test was edited.
- **D9 (`wp3-clean.json`).** The Flex Day fixture has no Learning in Action paragraph that could carry the `teacher_talk` mark, so one new paragraph (`Say: pairs name the tone before they write.`, marked) follows the "Tone Tracker" routine. Launch's first paragraph gained the mark, as planned.
- **D10 (`packages/core/tests/fixtures/draft-wp1.json` not edited).** Inserting the Learning in Action `routine_heading` block shifts block indices that grounding tests (`name-scan`, `source-trust`, `plants.json` P02/P04) address by position (8 tests went red). Grounding is not F1's. The block is added in memory instead, in `apps/worker/src/generation/nodes/testing/fixtures.ts` `load_draft("wp1")`. `build_ctx("wp1")` in `grounding/fixtures/build.ts` therefore still lacks the routine (one `section_missing` finding for it); F1's new tests use the canonical drafts (`packages/llm/src/fixtures/draft-wp1/2.json`, `evals/cases/drafts/_fixtures/good-wp-3.json`), which satisfy the templates.
- **D11 (draft-wp2 and draft-wp3/4 test fixtures).** `build_ctx("wp2")` (grounding fixture `draft-wp2.json`: no Learning in Action routine, no Part B), `build_ctx("wp3")` (no Launch sample response, no ELD callouts in Learning in Action) and `build_ctx("wp4")` do not satisfy the stricter templates. They are only used by grounding tests that do not run `section_missing`, so nothing is red; the plan's `compiled_good_drafts_satisfy_the_template` and `flex_day_roles_are_enforced` use the canonical drafts instead of `build_ctx`.
- **D12 (`schema-invalid.test.ts`).** Three tests addressed the Learning in Action Pulse Check as `blocks[16]`; they now find it by section and role. (No index shift occurs with D10, but the tests no longer depend on position.)
- **D13 (`apps/worker/src/wiring/demo-stub.ts` NOT edited, outside the boundary).** Its flex-day filter `FLEX_ROLES` drops Launch `sample_response` and has no `teacher_tip`, so the stub-mode demo's Flex Day lesson now ends `generation_failed` and `demo-stub.int.test.ts` "reaches draft lessons with no failed jobs" is red. The tested fix is in `/tmp/F1-demo-stub.patch` (reported to the integrator: add `sample_response` to Launch, `teacher_tip` to Learning in Action, and synthesise one `teacher_tip` draft block before the first `cfu_item`).
