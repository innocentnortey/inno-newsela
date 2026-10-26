# Slice D: production section/part contract, per-code standards evidence, slot obligations

Plan for `fanout-implementer` (Sonnet). Date 2026-10-26. Base: `main` e7e72a3 **plus slice A and slice C already merged** (this slice runs after them). Plan path: `docs/plans/fanout/2026-10-26-astra/slice-D.md`. Readiness: **READY** (section 9; it needs the orchestrator's yes to the "extra files" in section 2).

## 1. Goal and sources

Four deliverables, all inside the existing pipeline (prompt rendering -> compile -> check):

1. **One section/part contract** taken from the worked pairs and used by the template, the prompt, the compiler and the S3 expectations. WP-1/WP-2: Learning in Action has exactly `Part A` and `Part B`. WP-3: Launch has a sample response; Learning in Action has a routine heading, a teacher tip and a Pulse Check.
2. **Per-code standards evidence.** A code counts as taught only when a teaching routine is tagged with that code; as checked only when an assessment item is tagged with it. Tags survive compilation. Origins (`outline`, `narrowed`, `added`) are decided from the pinned row and kept in front matter with an open confirmation. Parent/leaf codes are treated one way in the front matter, the rule and generation. Nothing is labelled "verified".
3. **Slot obligations.** A required excerpt slot that was never created is a blocking finding (not success). Open slots stay successful draft outcomes with human work; submit and approve stay blocked until they are filled.
4. **S3:** no change to `evals/cases/drafts/*/expected.json`, the 1.0 floor or any assertion. Proposed S3 changes are listed in section 8 for a recorded contract correction.

Sources (read before building):
- `docs/delivery/2026-10-26-astra-fix-handoff.md`, section *Align production lesson structure and standards evidence* (and the slot paragraph at its end); `docs/testing/error-analysis/astra-audit-2026-10-26.json` (23/30 stored-ready lessons raise `code_not_allowed`; 13 quote placeholders and 7 excerpt slots across 16 lessons; 30 initial drafts invalid on `code_origins`).
- `docs/data/worked-pairs.md`: WP-1 "Required output B" (section table, "Alignment map", "What the reviewer sees"), WP-2 same, WP-3 same. `evals/cases/drafts/wp-{1,2,3}/expected.json` (read only).
- `docs/source/04-lesson-structure-analysis.md` section 4 (How standards are shown: standards in Part headings and in routine headings such as `Pulse Check (RL.6.9)`; leaf codes only) and section 3b.
- `docs/plans/fanout/2026-10-26-astra/slice-A.md` and `slice-C.md` (assumptions below).

**What I assume slices A and C delivered (re-checked 2026-10-26 against their plan files; verify with `git log` before starting):**
- A: `packages/core/src/compile/labels.ts` exports `rationale_label(index, correct)` and `parse_rationale_label(text)`; `nodes.ts` `cfu_item` uses `rationale_label`; `schema_invalid.ts` reads that contract; `generation.ts` `generation_rules` is `rules.filter((r) => !NOT_ACTIONABLE_KINDS.has(r.kind))` with the four kinds `quote_placeholder_open`, `excerpt_slot_open`, `cross_lesson_link`, `code_not_allowed`; `apps/worker/src/wiring/check-parity.test.ts` exists and subtracts those four kinds. `grounding/sources.ts` no longer reads `text_cards`.
- C: `packages/prompts/src/inputs.ts` has `GenerationPromptContext`; `render.ts` has `pinned_blocks` and `template_block(t)`; `repair.md` still says every focus code is the `standard_code` of some `cfu_item` (this slice keeps that true, see D-2); C's test `draft_user_blocks_bytes_stable` hashes the user blocks including `template_block`.
If any of that is missing, stop and report; do not re-do their work.

## 2. Boundary

**Owned (create / modify), as the orchestrator gave them:**

| Path | Action |
|---|---|
| `packages/core/src/compile/standard-tags.ts` | create |
| `packages/core/src/compile/part-labels.ts` | create |
| `packages/core/src/compile/{templates,addresses,nodes,compile-draft}.ts` | modify |
| `packages/core/src/compile/{standard-tags,part-labels,compile-contract}.test.ts` | create |
| `packages/core/src/compile/{templates,addresses,compile-draft}.test.ts` | modify (add tests; one expectation fixed, see step 3) |
| `packages/core/src/checks/rules/alignment/**` | modify (`standards-view.ts`, `derive.ts`, `standard_not_taught.ts`, `standard_not_checked.ts`, `code_not_allowed.ts`, `test-support.ts`, the alignment tests; create `standards-evidence.test.ts`) |
| `apps/worker/src/generation/nodes/front-matter-standards.ts` and `.test.ts` | modify |
| `packages/prompts/locked/lesson-shape.md` | modify |
| Slot obligation code (found): `packages/core/src/checks/rules/links/{slots,cross_lesson_link}.ts`, new `links/slot-obligations.ts`, tests `links/{slot-obligations,cross-lesson}.test.ts` | modify / create |

**Extra files this slice must touch (the orchestrator must approve; each is a small, named edit; none overlaps a file A or C still edits after merge):**

| Path | Edit |
|---|---|
| `packages/core/src/checks/rules/structural/section_missing.ts` (+ `required-roles.test.ts`) | add the missing-required-slot finding (step 10). A edits only `schema_invalid.ts` in that folder. |
| `packages/prompts/src/inputs.ts` | `PromptSection` gets `parts?: readonly string[]` (C-owned file, already merged). |
| `packages/prompts/src/render.ts` | `template_block` prints the parts (C-owned, already merged). Update C's `draft_user_blocks_bytes_stable` literals only if they change (they must not; see step 6). |
| `apps/worker/src/generation/nodes/compile-check-node.ts` (+ `.test.ts`) | pass tagged codes into the front-matter builder; optional standards lookup (step 9). |
| `apps/worker/src/wiring/generation.ts` | (a) drop `code_not_allowed` from `NOT_ACTIONABLE_KINDS` and its comment lines; (b) pass `standards` as the new 4th argument of `new CompileCheckNode(...)`. Nothing else in the file. |
| `apps/worker/src/wiring/check-parity.test.ts` (A's) | change "four suppressed kinds" to three. |
| Fixture drafts (step 11): `packages/llm/src/fixtures/{draft-wp1,draft-wp1-repaired,draft-wp2}.json`, `apps/worker/test/fixtures/stub-drafts/{wp-1,wp-2}.json`, and `packages/core/tests/fixtures/draft-wp1.json` only if a test goes red | add teaching `routine_heading` blocks. Test data, not product code. |
| `.claude/reference/area-map.md` (append rows), `docs/devlog/2026-10-26-astra-slice-d.md` (create) | context upkeep (rule `context-maintenance`). |

**Read only:** `packages/schema/**`, `packages/editor-schema/**`, `packages/core/src/checks/{types,gates,registry,policy,context-loader,test-helpers}.ts`, `packages/core/src/checks/rules/structural/{doc-walk,expected}.ts`, `apps/worker/src/generation/nodes/{draft-node,repair-node,store-node,job-state,collaborators}.ts`, `evals/**` (expected.json, assertions, observer, S2 fixtures), `docs/**`.

**Must not touch:** `evals/**` in any way (expected.json, `s3-assertions.ts`, `s3-observe.ts`, the 1.0 floor, S2 fixtures); `packages/schema/**` and `packages/editor-schema/**` (no new node attribute, no `StoredLesson`/`Standard` field); `checks/types.ts` (no new `CheckKind`: a new kind is a CHG); `repair.md`; `draft-node.ts`; slice A/B/C files beyond the lines above; the `.env` files; `docs/source/restricted`.

## 3. Requirements table

| # | Requirement | Implementation | Verification |
|---|---|---|---|
| R1 | One production section/part contract from the worked pairs (handoff; WP-1/WP-2 B tables, `expected.json` parts `Part A`/`Part B`) | D-1: exact labels `Part A` / `Part B`. `templates.ts` lists `parts`; `template_block` renders them; `lesson-shape.md` states them; compile canonicalises; heading text is exactly `Part X` (the checker's `PART_RE` in `doc-walk.ts` requires it) | `templates.test.ts::parts_*`, `part-labels.test.ts`, `compile-contract.test.ts::wp1_wp2_parts`, `lesson-shape-contract.test.ts` |
| R2 | The real L5 draft used "Gather evidence" / "Plan and write"; assertions expect Part A/B; decide labels vs mapping | D-1: labels are canonical at the draft boundary (prompt + S3 stay strict on the raw draft); compile maps a descriptive label deterministically, keeps its words as a title routine and records the remap; the deviation stays visible to S3 | `part-labels.test.ts::descriptive_labels_map_by_order`, `compile-draft.test.ts::part_remaps_reported` |
| R3 | WP-3 sample response / teacher tip / routine headings; WP-1 `support_table` etc. "requested" components | `templates.ts` required roles (step 2); `lesson-shape.md` text (step 6) | `templates.test.ts::flex_day_asks_for_wp3_components`, `compile-contract.test.ts::wp3_components` |
| R4 | Required components and intended locations survive compilation | `compile-contract.test.ts` compiles the WP-1/WP-2/WP-3 drafts and checks every `expected.json` `required_roles` entry exists in the compiled section/part | same test |
| R5 | Block code metadata lost in compilation | D-5: codes travel as bracket tags on the heading the compiler already writes: teaching `routine_heading`, `Pulse Check (...)`, `Quick Write (...)`. One writer/reader module `standard-tags.ts` | `standard-tags.test.ts`, `compile-draft.test.ts::codes_survive_as_tags` |
| R6 | `standard_not_taught` passes every focus code when any teaching paragraph exists | Per-code: a code is taught only if a teaching tag names it AND that tag's part/section has teaching text (step 8) | `standards-evidence.test.ts::generic_teaching_plus_all_tagged_check_is_not_taught`, `taught-checked.test.ts` |
| R7 | Checking links mostly test CFU tags; unrelated assessment tagged with every standard cannot establish alignment | Coverage is per code; an item naming more than two codes covers none (D-6); Pulse Check remains required (D-2); Quick Write tags are supplementary links | `standards-evidence.test.ts::one_check_tagged_with_every_code_covers_none` |
| R8 | Origins and narrowed/added confirmations preserved | `build_front_matter_standards(row, rows, tagged)` derives `origin` from the row (never from the model's `code_origins`), sets `asserted_by: "generator"`, `confirmation: "open"` for narrowed/added | `front-matter-standards.test.ts::narrowed_leaf_*`, `::added_code_*`, `standards-evidence.test.ts::narrowed_leaf_keeps_open_confirmation` |
| R9 | Parent/leaf treated consistently; remove the `code_not_allowed` generation suppression | D-3: row-listed codes are valid at any level; a leaf of a listed parent is a narrowing; everything else is blocked. Builder replaces a narrowed parent with its leaf. Step 9 removes the suppression | `code-not-allowed.test.ts`, `check-parity.test.ts` (updated), `generation-rules.test.ts::code_not_allowed_is_actionable` |
| R10 | Narrowed leaf (L.6.4.b) keeps provenance and an unresolved confirmation | R8 plus existing `standard_confirmation` rule (level `confirmation`, gate `CONFIRMATION_OPEN`) | `standards-evidence.test.ts::narrowed_leaf_keeps_open_confirmation` (runs the rule and `submit_gate`) |
| R11 | Invalid codes stay blocked, including tagged-but-unrecorded ones | `code_not_allowed` also checks tagged codes that are not recorded (step 8) | `code-not-allowed.test.ts::unknown_tagged_code_is_blocked`, `::unlisted_leaf_blocked` |
| R12 | Do not label tags as verified; human semantic review explicit while the judge is off | No message contains "aligned" or "verified"; derived link rows keep `asserted_by` from the standard record and `confirmed_by: null` unless a person confirmed; the judge never writes a row; coverage keeps showing `generator_only` | `links-derived.test.ts::links_are_unconfirmed_and_never_judge`, `finding-shape.test.ts` (existing) |
| R13 | Every required slot obligation was created | Obligations: (a) row has an applied `writer_task` segment, (b) an incoming `homework_text`/`excerpt_slot` link targets this lesson. Missing slot -> blocking `section_missing` (step 10) | `slot-obligations.test.ts` |
| R14 | Missing required slots are not success because no slot issue exists | Same finding; `cross_lesson_link` gains an "absent slot" branch | `cross-lesson.test.ts::absent_slot_blocks_homework` |
| R15 | Open slots stay successful draft outcomes; surface work; block submit/approve | `generation_rules` still drops the three open-slot kinds; `section_missing` is not dropped; gates already block on any unresolved blocking issue | `slot-obligations.test.ts::gates_block_open_and_missing`, `generation-rules.test.ts::missing_slot_is_actionable_open_slot_is_not` |
| R16 | S3: do not weaken the 1.0 floor or expected.json | No `evals/**` edit. S2/S3 suites run unchanged and stay 100% | commands in section 7 |
| R17 | `code_origins` mismatches caused 30 initial schema failures (audit) | `lesson-shape.md` says one `code_origins` entry per `standard_codes` entry, empty when empty | `lesson-shape-contract.test.ts` |

## 4. Shared code to use (copied from the current code)

```ts
// @ls/schema/lesson-draft
export const DRAFT_ROLES = ["routine_heading","teacher_talk","sample_response","callout_purpose","callout_say","callout_watch","support_table","cfu_item","quick_write","text_evidence_needed","excerpt_slot","teacher_tip","homework","paragraph","list"] as const;
export type DraftBlock = { role: DraftRole; section: string; part: string | null; text: string; standard_codes: string[]; code_origins: ("outline"|"narrowed"|"added")[]; cfu: CfuItemDraft | null; minutes: number | null };
export type CfuItemDraft = { stem: string; options: string[]; key_index: number; rationales: string[]; standard_code: string };
// @ls/schema/lesson
export type Standard = { code: string; role: "focus"|"supporting"|"eld"; origin: "outline"|"outline-fixed"|"narrowed"|"added"; official_text: string; asserted_by: "outline"|"generator"|"judge"|"reviewer"; confirmation: "open"|"confirmed"|"removed"|null };
// compile (today)
export interface SectionSlot { name: string; minutes: number; required_roles: readonly DraftRole[] }      // step 2 adds parts?
export interface CompiledLesson { lesson: StoredLesson; content_hash: Sha256; teacher_word_count: number; placeholders: number; safety_tips: string[] }  // step 3 adds part_remaps
export type CompileErrorReason = "section_not_in_template" | "role_not_allowed" | "unknown_node";
export function compile_draft(draft: LessonDraft, ctx: CompileContext): CompiledLesson;
export function normalise_part_label(label: string): string;   // addresses.ts
export const QUICK_WRITE = "Quick Write"; export const PULSE_CHECK = "Pulse Check";                    // labels.ts
export function routine_icon(text: string): IconName;            // labels.ts
// checks (today)
export type StandardRow = { code: string; set: "CA_CCSS_ELA_6"|"CA_ELD_6"|"MSLS_6"; text: string; parent_code: string | null; is_leaf: boolean; eld_strand: string | null };
export type AlignmentLinkRow = { lesson_id; content_hash; code: string; address: string; role: "I"|"P"|"A"; origin: "outline"|"narrowed"|"added"; asserted_by: "outline"|"generator"|"judge"|"reviewer"; confirmed_by: string | null };
// alignment/standards-view.ts exports that OTHER code imports and must keep unchanged:
//   FRONT(ctx), recorded(ctx), listed_codes(ctx), focus_codes(ctx), cfu_tags(ctx): {code,address}[], covered(...), teaching_parts(lesson): string[]
//   (evals/src/suites/s3-observe.ts imports cfu_tags and teaching_parts: do not change their signatures or meaning)
// structural/doc-walk.ts: walk, node_text, section_nodes, visit_with_parts(section, fn({node,address,siblings,index})), find_cfu_items(section)
//   PART_RE = /^Part\s+([A-Z])$/  (heading text must be exactly "Part A")
// links/slots.ts: is_excerpt_filled, find_slot_node, slot_state_of(sections, slot_id), slot_state(lesson, slot_id): "open"|"filled"|"absent"
// worker: build_front_matter_standards(row: NormalizedRow, rows: readonly StandardRow[]): Standard[]   (step 9 adds a 3rd parameter)
//   new CompileCheckNode(loader, rules, policy)   (step 9 adds an optional 4th parameter)
// make_finding(kind, level, message, { address, code }) in alignment/finding.ts
```

Registry rule: one rule per `CheckKind`, no new kinds. Test helpers in `packages/core/src/checks/test-helpers.ts`: `p`, `routine(icon, text)`, `h`, `section(name, lesson_id, minutes, nodes)`, `cfu_item({code})`, `make_ctx`, `reading_lesson`, `eld_block`, `DEFAULT_POLICY`, `LESSON_ID`. Alignment helpers: `std_rows()`, `rec(code, over)`, `lesson_with(standards, tag)`, `wp1_ctx(over)` in `alignment/test-support.ts`. Links helpers: `link`, `l5(slot)`, `ctx_with_link(src, over)` in `links/test-support.ts`.

## 5. Steps

Decisions that shape every step (adopted under PD-32; all recorded again in section 8):
- **D-1 Part labels.** Canonical = exactly `Part A`, `Part B` (`Part C` allowed). Because `doc-walk.ts` only recognises a heading whose whole text is `Part <capital letter>`, a part heading can never carry a title or codes. A title goes in a `routine_heading` that opens the part.
- **D-2 Checking.** Each focus code still needs a `Pulse Check` tag (what `repair.md`, the prompt and S3's `cfu_tags` already assume). A `Quick Write (CODE)` tag is extra evidence, an `A` link, never a substitute.
- **D-3 Parent/leaf.** A code the row lists is valid at any level. A leaf whose parent the row lists is a *narrowing*. Anything else is blocked. When a leaf narrows a listed parent, the front matter records the leaf and drops the parent.
- **D-4 Narrowing is not offered by the prompt yet.** The prompt still says keep listed codes as listed, because the draft prompt carries no catalogue of valid leaves (`draft-node.ts` passes only the listed codes). The machinery is built and tested; turning narrowing on is a follow-up (section 8, request R-D4).
- **D-5 Carrier.** Tags in heading text. No editor-schema or `StoredLesson` change (same reasoning as slice A D-2: another package, hash churn, and a reviewer's edit could drop an attribute; text edits keep the tag visible).
- **D-6** One assessment item covers at most `MAX_CODES_PER_CHECK = 2` codes.

**Step 0. Baseline (no edits).** `git log --oneline -8`; confirm A and C are merged (section 1). Run `npx vitest run packages/core/src/compile packages/core/src/checks packages/prompts apps/worker/src/generation apps/worker/src/wiring` and note anything already red.

**Step 1. `compile/standard-tags.ts` (new) and test.** One module writes and reads the tag, so they cannot drift.
```ts
export const MAX_CODES_PER_CHECK = 2;
const CODE = /^[A-Z]{1,5}(?:\.[A-Za-z0-9]+)+$/;            // RL.6.1  L.6.4.b  W.6.2.f  ELD.PI.6.6b
export type ParsedTag = { label: string; codes: string[] };
/** "Label (A, B)" -> {label, codes}. strict: every token must look like a standard code; loose: any non-empty token. */
export function parse_tag(text: string, strict: boolean): ParsedTag | null;
/** "Label" + codes -> "Label (A, B)". Strips a tag the text already ends with, so a tag is never doubled. */
export function format_tag(label: string, codes: readonly string[]): string;
```
`parse_tag`: trim; match `/^(.*\S)\s*\(([^()]*)\)\s*$/`; split group 2 on `,`, trim, drop empty; null when no tokens, or (strict and some token fails `CODE`); return the label trimmed and the tokens de-duplicated in order. `format_tag(label, codes)`: `base = parse_tag(label, false)?.label ?? label.trim()`; de-duplicate and trim codes, drop empty; no codes -> `base`; else `` `${base} (${codes.join(", ")})` ``. Loose parsing is for `Pulse Check` and `Quick Write` so a malformed code in a check heading still surfaces as a blocked code instead of vanishing. Strict parsing is for other routine headings so a title such as `Turn and Talk (Pairs)` is not read as a code.
Test `standard-tags.test.ts`: `format_tag("Pulse Check", ["RL.6.2"])` is `Pulse Check (RL.6.2)`; formatting an already tagged label does not double it; `parse_tag("Introduce New Words (L.6.4.b)", true)` gives label and `["L.6.4.b"]`; `parse_tag("Turn and Talk (Pairs)", true)` is null; `parse_tag("Pulse Check (RL 6.1)", false)` returns the token `RL 6.1`; `parse_tag("Quick Write", false)` is null; duplicates collapse; round trip for `["RL.6.1","L.6.4.b"]`.

**Step 2. `compile/templates.ts` contract data.**
- `SectionSlot` gains `parts?: readonly string[]`; `slot(name, minutes, required_roles, parts?)` sets it only when given.
- `five(lesson_type)`: Launch unchanged; Literacy Lab unchanged; Learning in Action roles become `["routine_heading","teacher_talk","cfu_item","callout_purpose","callout_say","callout_watch","support_table"]` with `parts: ["Part A","Part B"]`; Look Back and Homework unchanged. (WP-1/WP-2 `expected.json`: Part A has teacher_talk plus a slot plus support_table, Part B has cfu_item plus support_table; slots are per row, so they are not template roles.)
- `flex()` (Flex Day and Assessment): Launch roles `["routine_heading","teacher_talk","sample_response"]` (WP-3 Launch needs `sample_response`); Learning in Action roles `[...LIA_ROLES, "routine_heading", "teacher_tip"]` via a new const `FLEX_LIA_ROLES`; no parts; Look Back unchanged. `Spark` keeps `LIA_ROLES` (no pair covers it) and no parts.
- Do not touch `structural/expected.ts` (duplicated table; it checks ELD callouts and a Pulse Check only).
Tests added to `templates.test.ts` (keep existing ones green): `parts_only_on_five_section_types` (Reading/Writing/Academic Discussion/Research/Presentation have `["Part A","Part B"]` on Learning in Action and nowhere else; Spark/Flex Day/Assessment have none); `flex_day_asks_for_wp3_components` (Launch contains `sample_response`; Learning in Action contains `routine_heading`, `teacher_tip`, `cfu_item`).

**Step 3. Part labels in compile.**
- `addresses.ts` `normalise_part_label`: when the trimmed label matches `/^(?:part\s+)?([A-Za-z])$/i` return `` `Part ${letter.toUpperCase()}` ``; otherwise keep today's fallback (`Part ${t}` / `Part ${rest}`). Fix the existing assertion in `addresses.test.ts` that says `normalise_part_label("part a")` is `"Part a"`: it becomes `"Part A"` (the old value produced a heading `doc-walk.ts` cannot read). This is a bug fix, not an expectation weakened to pass.
- New `compile/part-labels.ts`:
```ts
export type PartRemap = { section: string; from: string; to: string };
export type PartPlan = { label_of(raw: string): string; title_of(label: string): string | null; remaps: PartRemap[] };
export function plan_parts(section: string, parts: readonly (string | null)[]): PartPlan;
```
Algorithm for `plan_parts` (invariant: the same raw label always maps to the same canonical label; no two canonical labels collide):
  1. `raws` = distinct non-null values, trimmed, in order of first appearance.
  2. For each raw test `/^(?:part\s+)?([A-Za-z])(?:\s*[:.\-–—]\s*(.+))?$/i`. A match means a lettered label: canonical `Part ${UPPER}`, title = group 2 (trimmed) or null. `"A Plan"` must NOT match (no separator): it is descriptive.
  3. Letters claimed by lettered labels are reserved. Each descriptive raw, in order, takes the next unreserved letter from `A..Z`; its title is the raw text itself. More than 26 distinct parts: `throw new RangeError("too many parts")` (the worker already reports a `RangeError` from compile as `COMPILE_ERROR: structure_invalid`).
  4. `remaps` has one entry for every raw whose trimmed text differs from its canonical label (including `"Part A: Gather evidence"` and `"part a"`).
  5. `title_of(label)` returns the first non-null title seen for that label.
- `compile-draft.ts`: in the per-section loop build `plan = plan_parts(slot.name, blocks.map(b => b.part))`; pass to `build_nodes` a `part_of(b)` that returns `null` or `plan.label_of(b.part.trim())`; when a new non-null part label starts, push `N.part_heading(label)`, then if `plan.title_of(label)` is non-null and not yet emitted for this label, push `N.routine_title(title)`. Compare parts for "new part" by the canonical label. Collect `plan.remaps` over all sections into the new `CompiledLesson.part_remaps: PartRemap[]` (always present, empty when nothing changed). The remaps are for diagnostics and tests; no UI.
- `nodes.ts` (A already changed `cfu_item`; edit only these): `part_heading(label)` writes `text(normalise_part_label(label))` (already canonical, idempotent); add `routine_title(title: string): PMJson[]` returning `[{ type: "routine_heading", attrs: { icon: routine_icon(title) }, content: [text(title.trim())] }]`.
- Tests: `part-labels.test.ts` (`lettered_forms`: `"Part A"`, `"part b"`, `"C"` map to `Part A/B/C` with no title; `title_after_colon`: `"Part A: Gather evidence"` gives title `Gather evidence`; `descriptive_labels_map_by_order`: `"Gather evidence"`, `"Plan and write"` give `Part A`, `Part B` and remaps of two; `descriptive_skips_claimed_letters`: `["Part B","Plan"]` gives `Part B`, `Part A`; `a_plan_is_descriptive`; `same_raw_same_label`). In `compile-draft.test.ts`: `part_remaps_reported` (compile a WP-1 style draft whose Learning in Action blocks use `"Gather evidence"` / `"Plan and write"`: headings are exactly `Part A` and `Part B`, each followed by a `routine_heading` carrying the original words, addresses end `LearningInAction.PartA` / `.PartB`, `part_remaps.length === 2`); `canonical_labels_unchanged` (the existing WP-1 fixture compiles to the same JSON as before: `content_hash` of an unmodified draft is identical to main, so keep the existing hash/golden tests green).

**Step 4. Tags in nodes (R5).** In `nodes.ts` (after A's edit):
- `routine_heading(block)`: text is `format_tag(block.text.trim(), block.standard_codes)`; icon rule unchanged (`routine_icon(block.text)`, computed on the untagged text).
- `quick_write(block)`: heading text is `format_tag(QUICK_WRITE, block.standard_codes)`; icon stays `writing`. Paragraph handling unchanged.
- `cfu_item`: unchanged (`Pulse Check (${c.standard_code})`). Roles other than these three do not carry codes in the stored lesson; the prompt says so (step 6).
- Tests in `compile-draft.test.ts`: `codes_survive_as_tags`: a draft with a `routine_heading` block (`standard_codes: ["RL.6.1"]`, text `Percy's Voice`) in Learning in Action Part A, a `quick_write` block with `["RL.6.1"]`, and the existing `cfu_item` compile to headings `Percy's Voice (RL.6.1)`, `Quick Write (RL.6.1)`, `Pulse Check (RL.6.2)`; a heading whose model text already ends in `(RL.6.1)` is not doubled; a `routine_heading` with no codes compiles exactly as before.

**Step 5. `compile-contract.test.ts` (R4).** For `wp-1`, `wp-2`, `wp-3`: read `evals/cases/drafts/<wp>/expected.json` (resolve with `new URL("../../../../evals/cases/drafts/...", import.meta.url)` from `packages/core/src/compile/`; read only), compile the draft fixture, and assert for every `sections[].required_roles[]` entry that the compiled section (and, when `part` is set, the heading `Part A`/`Part B` region) contains the node for the role. Role to node table (put it in the test): `routine_heading` -> a `routine_heading` whose icon is not `cfu`; `teacher_talk` -> a paragraph with mark `teacher_talk`; `sample_response` -> paragraph with mark `sample_response`; `support_table` -> `collapsible` labelled `Additional Student Support`; `cfu_item` -> `routine_heading` icon `cfu`; `quick_write` -> `routine_heading` icon `writing`; `text_evidence_needed` -> `quote_placeholder`; `excerpt_slot` -> `excerpt_slot`; `teacher_tip` -> `teacher_tip`; `homework` -> any paragraph in the `Homework` section. Fixtures: WP-1 `packages/llm/src/fixtures/draft-wp1.json`, WP-2 `packages/llm/src/fixtures/draft-wp2.json`, WP-3 `evals/cases/drafts/_fixtures/good-wp-3.json` (strip keys starting `_` as the fixture README says). Rows: `packages/core/tests/fixtures/row-wp1.json` for WP-1; for WP-2 and WP-3 use the rows the existing grounding fixtures use (`build_ctx("wp2")` / `"wp3"` in `checks/rules/grounding/fixtures/build.ts` show how it loads them). Use `template_for(row.lesson_type)`. Also assert `placeholders` equals `expected.placeholders.exact` and the part addresses `...LearningInAction.PartA` / `.PartB` exist for WP-1 and WP-2. Never edit an expected file or relax these assertions; a failure means the fixture or compiler is wrong (WP-2 Look Back has only `quick_write` required; extra roles in the draft are fine).

**Step 6. Prompt rendering and the locked text.**
- `inputs.ts`: `PromptSection` gets `parts?: readonly string[]`.
- `render.ts` `template_block`: line is `section ${i+1}: ${s.name}, ${s.minutes} minutes, roles: ${roles}` and, only when `s.parts` is a non-empty array, `; parts: ${s.parts.join(", ")}` appended. When `parts` is absent the output must be byte-identical to today, so C's `draft_user_blocks_bytes_stable` and the frozen render tests need no edit. (`SectionTemplate` from core is assignable to `PromptSectionTemplate` structurally; do not change the draft/repair nodes.)
- `packages/prompts/locked/lesson-shape.md`: replace the file with exactly the text below (no backtick fences; all fifteen role names stay; `locked-contents.test.ts` checks both):

```
Lesson shape

A lesson is a list of sections. Each section holds blocks, and every block carries one role tag. The allowed roles are exactly these fifteen: routine_heading, teacher_talk, sample_response, callout_purpose, callout_say, callout_watch, support_table, cfu_item, quick_write, text_evidence_needed, excerpt_slot, teacher_tip, homework, paragraph, list.

Section names and minutes come from the template in the context block. Keep them in order and do not add or rename sections.

Each section must include the roles the template requires for it. A sample_response goes right after the question it answers. A Flex Day or Assessment lesson also needs, in Learning in Action, a routine_heading that names the activity and a teacher_tip that tells the teacher what to choose or prepare.

Parts. When a template line ends with parts (for example parts: Part A, Part B), every block in that section carries its part label in the part field, written exactly as listed: a capital P, a space and a capital letter, nothing else. Put all Part A blocks before the Part B blocks. A descriptive phrase is never the label. To give a part a title, make the first block of that part a routine_heading holding the title. In a section whose template line lists no parts, part is null.

A check for understanding uses the cfu_item role, with one question and its expected response as a single item. Every cfu_item block must also fill its cfu field: the question in stem, the answer options in options (at least two), key_index for the correct option, one entry in rationales for each option, and standard_code. A cfu_item whose cfu field is null is invalid.

Every focus code on the lesson card must be checked. Each focus code must appear, spelled exactly as listed on the card, in the standard_code of at least one cfu_item. Do not narrow it to a sub-code and do not replace it with another code. One cfu_item may list up to two codes in standard_code, separated by a comma and a space, only when its question really checks both. For more codes, write more cfu_item blocks.

Every focus code must also be taught. In each section or part where a focus code is taught, the routine_heading that opens it lists that code in its standard_codes, with teacher_talk or paragraph blocks under it. The lesson adds the brackets itself, so never type brackets or codes inside block text. A quick_write may list in standard_codes the codes it practises; that does not replace a cfu_item. No other role carries standard_codes.

code_origins has exactly one entry for each entry of standard_codes: outline for a code listed on the card. When standard_codes is empty, code_origins is empty.

Minutes go in the minutes field of the blocks. Within each section the minutes of its blocks must add up to exactly the minutes the template gives for that section, and the Homework section is 0. A block that takes no class time has minutes null.

Every Learning in Action section needs a callout_purpose, a callout_say, a callout_watch and a cfu_item, and its first teaching block comes before the check.

[keep the three paragraphs that follow in the current file unchanged: "Use quotation marks only around words ...", "Name only people ... " is part of that same paragraph, "Mention a page or chapter only when ...", and the last line "Use only the allowed roles. Output must match the schema exactly."]
```
(The bracketed last line is an instruction to you: copy those paragraphs verbatim from the current file after slice A/C; do not retype them from this plan, and do not include the bracketed sentence in the file.)
- New `packages/prompts/src/lesson-shape-contract.test.ts` (new file; do not edit the frozen tests): reads `lesson-shape.md` and asserts it contains the substrings `exactly as listed`, `Part A blocks before the Part B blocks`, `teacher_tip`, `one entry for each entry of standard_codes`, `up to two codes`; and a render test (`render-template-parts.test.ts`) with a template whose Learning in Action has `parts: ["Part A","Part B"]` showing the `; parts: Part A, Part B` suffix in the `kind=template` block, and a template without `parts` giving the old line.
- Consequence to state in the devlog: editing `lesson-shape.md` changes the shared `locked_hash` (every task prompt) and creates a new prompt version at next start (see slice C step 9). Runs must start on the new version. This triggers NL-134's rerun rule.

**Step 7. `alignment/standards-view.ts`: tags, obligations, teaching text.** Keep every existing export (section 4). Add:
```ts
import { MAX_CODES_PER_CHECK, parse_tag } from "../../../compile/standard-tags.ts";
export type DocTag = { kind: "teach" | "assess"; source: "pulse_check" | "quick_write" | "routine"; code: string; address: string; codes_in_tag: number };
export function doc_tags(lesson: StoredLesson): DocTag[];
export function tagged_codes(lesson: StoredLesson): string[];                 // distinct codes of doc_tags, first-appearance order
export function teaching_addresses(lesson: StoredLesson): Set<string>;       // like teaching_parts, over Launch, Literacy Lab, Learning in Action
export type Obligation = { code: string; parent: string | null };
export function focus_obligations(ctx: CheckContext): Obligation[];
export function assessment_codes(ctx: CheckContext, sources: readonly DocTag["source"][]): Set<string>;
```
`doc_tags`: for each section except `Homework`, `visit_with_parts(section, ...)`; for each node of type `routine_heading` with text `t = node_text(node).trim()`: if `node.attrs.icon === "cfu"` and loose-parse label is `Pulse Check` -> `assess/pulse_check`; else if loose-parse label is `Quick Write` -> `assess/quick_write`; else if strict-parse succeeds -> `teach/routine`. One `DocTag` per code, `address` is the visitor's address (part or section), `codes_in_tag` is the parsed code count. `cfu_tags(ctx)` stays exactly as it is (its regex is `Pulse Check (...)`); do not rebuild it on `doc_tags`.
`teaching_addresses`: refactor the body of `teaching_parts` into a private `teaching_text_addresses(lesson, names)`; `teaching_parts(lesson)` still returns the array for `["Literacy Lab","Learning in Action"]` (unchanged output); `teaching_addresses` returns a Set for `["Launch","Literacy Lab","Learning in Action"]`.
`focus_obligations(ctx)`: for each `F` in `ctx.row.focus_codes`: `leaves` = `recorded(ctx)` codes with role `focus` that start with `` `${F}.` ``; if `leaves.length > 0`, one obligation `{code: leaf, parent: F}` per leaf; else `{code: F, parent: null}`. Then each recorded focus code not equal to, nor under, any row focus code (an *added* code) becomes `{code, parent: null}`. De-duplicate by code. (A recorded leaf below a listed parent replaces the parent; if a reviewer removes the leaf, the parent obligation returns.)
`assessment_codes(ctx, sources)`: set of codes from `doc_tags(ctx.lesson)` with `kind === "assess"`, `source` in `sources`, and `codes_in_tag <= MAX_CODES_PER_CHECK`.
Tests in the new `standards-evidence.test.ts` come with step 8.

**Step 8. Rules and links (R6 to R12).**
- `standard_not_taught.ts`: for each obligation, taught when `doc_tags(ctx.lesson)` has a `teach` tag with that `code` whose `address` is in `teaching_addresses(ctx.lesson)`. Otherwise `make_finding("standard_not_taught","blocking", \`Standard ${code} has no teaching routine tagged with it at ${FRONT(ctx)} (standard_not_taught)\`, { address: FRONT(ctx), code })`. No obligations -> `[]`.
- `standard_not_checked.ts`: covered when the code is in `assessment_codes(ctx, ["pulse_check"])`. Message and address as today (`teaching_parts(ctx.lesson)[0] ?? FRONT(ctx)`). Quick Write is not accepted here (D-2).
- `code_not_allowed.ts`: replace the body. `const listed = listed_codes(ctx)`. For each `s` of `recorded(ctx)` and each tagged code `c` from `tagged_codes(ctx.lesson)` that is not a recorded code (origin `unrecorded`): allowed iff `std = ctx.standards.find(code)` exists and ( `listed.has(code)` or (`std.is_leaf && std.parent_code !== null && listed.has(std.parent_code)` and the code is recorded) or (`s.origin === "added"` and `row_list_empty(ctx, std.set)`) ). An unrecorded tagged code is allowed only if `listed.has(code)` and `std` exists (it is the row's own code). Finding message unchanged for recorded codes; for an unrecorded one use `` `Code ${c} is used in a heading but is not one of this lesson's standards at ${address} (code_not_allowed)` ``. Keep `row_list_empty` as is. Result: row-listed parents pass (the 23/30 audit false findings); unknown codes, unlisted codes, and the parent of a listed leaf (broadening) stay blocked.
- `derive.ts`: rewrite so that links come only from tags. Subjects = `focus_obligations` codes plus recorded `supporting` codes. For each subject: `origin` = recorded standard's origin (`outline-fixed` -> `outline`; unrecorded -> `outline`); `asserted_by` = recorded `asserted_by` or `"outline"`; `confirmed_by` as today. Teach rows: each `teach` tag naming the code and located in `teaching_addresses`, first distinct address role `"I"`, later distinct addresses `"P"`. Assess rows: each assess tag (Pulse Check or Quick Write) naming the code with `codes_in_tag <= MAX_CODES_PER_CHECK`, role `"A"`, address the tag's address. De-duplicate on `code|address|role`. No tags -> no rows (the old code invented I/P rows for every teaching part).
- `standard_confirmation.ts`, `standard_add_suggestion.ts`, `eld_label_mismatch.ts`, `judge_no.ts`: unchanged.
- Update existing alignment tests and `test-support.ts` (this is fixture maintenance, not a rule weakening): `lesson_with(standards, tag, teach)` now builds Learning in Action as `[routine("notes_section", \`Teaching (${teach})\`), p("Teach."), ...cfu_item(...)]` with `teach` defaulting to `"L.6.4.b"` (pass `null` to omit the teaching heading); `std_rows()` gains `r("W.6.2", null, false, "synthetic writing two")` for the unlisted-parent case. `taught-checked.test.ts`: expected `code` on findings becomes the leaf `L.6.4.b` (the obligation), e.g. "taught but unchecked gives one standard_not_checked" now expects `f[0].code === "L.6.4.b"`; "a parent is covered by a recorded leaf tag only" is replaced by the per-code tests below. `code-not-allowed.test.ts`: "flags a recorded non-leaf code" is replaced (a *listed* parent is now allowed) by the tests below. `links-derived.test.ts` keeps its assertions (they hold once `lesson_with` tags a teaching heading).
- New `standards-evidence.test.ts` (exact names):
  - `generic_teaching_plus_all_tagged_check_is_not_taught`: row focus `RL.6.1, RL.6.2, L.6.4.b`; lesson has a teaching paragraph and no teaching tags; one Pulse Check tagged with all three. Expect `standard_not_taught` for all three codes, `standard_not_checked` for all three (an item with more than two codes covers none), and `derive_alignment` returns no `A` row.
  - `one_check_tagged_with_every_code_covers_none`: same with exactly two codes on the item: both covered.
  - `teaching_tag_needs_teaching_text_at_its_address`: a tagged heading in a part with no non-CFU paragraph does not count.
  - `per_code_teaching_and_checking_pass`: each code has its own teaching heading and Pulse Check: no `standard_not_taught`, no `standard_not_checked`, `derive_alignment` has an `I` and an `A` row for each code.
  - `quick_write_tag_is_a_link_not_a_check`: a code tagged only on `Quick Write (...)` still raises `standard_not_checked` but derives an `A` row at `...LookBack`.
  - `narrowed_leaf_keeps_open_confirmation`: recorded `rec("L.6.4.b", {origin:"narrowed", asserted_by:"generator", confirmation:"open"})` under listed `L.6.4`: `standard_confirmation_rule` returns one `confirmation`-level finding with code `L.6.4.b`; `submit_gate` (import from `../../gates.ts`, state from `gate_state` in `test-helpers.ts`) refuses with `CONFIRMATION_OPEN`; derived rows for the leaf carry `origin: "narrowed"`, `asserted_by: "generator"`, `confirmed_by: null`.
  - `removed_leaf_returns_the_parent_obligation`: with the leaf `confirmation: "removed"`, `focus_obligations` yields `L.6.4`.
  - `links_are_unconfirmed_and_never_judge` (in `links-derived.test.ts`): every derived row has `asserted_by !== "judge"` and `confirmed_by === null` when `ctx.confirmations` is empty; no finding message from the alignment group matches `/aligned|verified/i`.
  - In `code-not-allowed.test.ts`: `listed_parent_is_allowed` (recorded `L.6.4` with `L.6.4` listed: `[]`); `leaf_of_listed_parent_is_allowed`; `unlisted_leaf_blocked` (`RL.6.7`, `allowed_codes: []`: one blocking finding); `unlisted_parent_blocked` (recorded `W.6.2`, not listed: blocking); `parent_of_listed_leaf_blocked` (row lists `L.6.4.b`, recorded `L.6.4`: blocking); `unknown_tagged_code_is_blocked` (a Pulse Check tagged `L.6.3a`, not recorded, not in `ctx.standards`: blocking, message contains `is used in a heading`); `added_code_allowed_only_when_row_list_empty` (row `focus_codes: []`, recorded `RL.6.7` origin `added`: `[]`; with a non-empty list: blocking).

**Step 9. Front matter (worker) and generation wiring.**
- `front-matter-standards.ts`: new signature `build_front_matter_standards(row: NormalizedRow, rows: readonly StandardRow[], tagged: readonly string[] = []): Standard[]`. Algorithm (invariants in brackets):
  1. Build the base list exactly as today (focus, then MSLS as `supporting`, then ELD; de-duplicated; a listed code with no official text in `rows` is skipped). Keep `listed_role: Map<code, role>` for every code the row lists (even one skipped for missing text). [Origin is decided from the row, never from the model's `code_origins`.]
  2. For each distinct `code` of `tagged`, in order, skipping any code in `listed_role`: look up `r = rows.find(code)`. If `r !== undefined && r.is_leaf && r.parent_code !== null && listed_role.has(r.parent_code)` it is a **narrowing**: `{ code, role: listed_role.get(parent), origin: "narrowed", official_text: r.text, asserted_by: "generator", confirmation: "open" }`, and the parent is marked replaced. Otherwise it is **added**: `role` is `"eld"` if `r?.set === "CA_ELD_6"`, else `"focus"` if `r?.set === "CA_CCSS_ELA_6"` and `row.focus_codes.length === 0`, else `"supporting"`; `origin: "added"`, `asserted_by: "generator"`, `confirmation: "open"`, `official_text: r?.text ?? ""`. [An unknown code is recorded with empty text so `code_not_allowed` and `standard_confirmation` surface it; it is never dropped.]
  3. Output: walk the base list; at a replaced parent emit its narrowed leaves (tag order) instead of the parent; then append the added codes. [A narrowed leaf replaces its parent, see D-3.]
- `compile-check-node.ts`: constructor gains an optional 4th parameter `standards?: { texts(codes: readonly string[]): Promise<StandardRow[]> }` (type `StandardRow` from `@ls/core/ports/standards`; `StandardRepo` satisfies it). In `run`, after the compile: `const tagged = tagged_codes(compiled.lesson)` (import from `@ls/core/checks/rules/alignment/standards-view`); `const unknown = tagged.filter((c) => !ctx.standards.some((s) => s.code === c))`; `const extra = unknown.length > 0 && this.standards !== undefined ? await this.standards.texts(unknown) : []`; `build_front_matter_standards(row, [...ctx.standards, ...extra], tagged)`. Everything else (rehash, loader, `run_checks`) is unchanged.
- `wiring/generation.ts`: in `wire_generation`, `new CompileCheckNode(loader, generation_rules(...), CHECK_POLICY, standards)` (`standards` is the `PgStandardRepo` already in scope). In the filter block: remove `"code_not_allowed"` from `NOT_ACTIONABLE_KINDS` and delete its two comment lines (A left them with a note "until the standards slice"). Keep `"quote_placeholder_open","excerpt_slot_open","cross_lesson_link"` and their comment (open slots are intended draft outcomes).
- Update A's `check-parity.test.ts`: wherever it subtracts "the four NOT_ACTIONABLE kinds" use the three remaining kinds, and `rationale_bypass_removed` compares against `CHECK_RULES` minus those three.
- Tests: `front-matter-standards.test.ts` (keep the four existing tests green) adds `narrowed_leaf_replaces_listed_parent` (row focus `["L.6.4"]`, rows include parent `L.6.4` and leaf `L.6.4.b` with `parent_code: "L.6.4"`, tagged `["L.6.4.b"]`: result is only the leaf with `origin "narrowed"`, `asserted_by "generator"`, `confirmation "open"`, role `focus`), `added_code_when_row_lists_none` (WP-3 style: `focus_codes: []`, tagged `["RL.6.7"]`: `origin "added"`, role `focus`), `added_code_when_row_lists_some` (role `supporting`), `unknown_tagged_code_is_recorded_with_empty_text`, `tagged_listed_code_is_not_added_again`, `origin_comes_from_the_row_not_the_model` (tag a listed leaf: `origin "outline"`). `compile-check-node.test.ts` adds `tagged_leaf_is_recorded_as_narrowed_and_asks_for_confirmation` (feed a draft whose Pulse Check names a leaf of a listed parent; with a `standards` stub returning that leaf row: front matter has the leaf as `narrowed`, `check_result.findings` has a `standard_confirmation`). New `apps/worker/src/wiring/generation-rules.test.ts`: `code_not_allowed_is_actionable` (`generation_rules(CHECK_RULES)` includes the `code_not_allowed` rule), `missing_slot_is_actionable_open_slot_is_not` (includes `section_missing`; excludes `quote_placeholder_open`, `excerpt_slot_open`, `cross_lesson_link`).

**Step 10. Slot obligations (R13 to R15).**
- `links/slots.ts`: add `export function count_excerpt_slots(sections: Sections): number` using the same `walk` and the same predicate as the `excerpts` list inside `find_slot_node` (`n.type === "excerpt_slot"` or `n.type === "quote"` with `attrs.origin === "excerpt_slot"`). Factor that predicate into one private function used by both so they cannot drift.
- New `links/slot-obligations.ts`:
```ts
export type SlotObligation = { needed: boolean; reasons: string[] };
export function excerpt_obligation(ctx: CheckContext): SlotObligation;
```
  `reasons` gets `"outline writer task"` when some `ctx.row.segments` entry has `kind === "writer_task"` and `applies === "apply"`, and `` `homework link from ${l.from_lesson_id}` `` for each `l` of `ctx.links` with `l.to_lesson_id === ctx.lesson_id` and `l.kind !== "page_continuation"`. `needed` is `reasons.length > 0`. At least one excerpt slot satisfies every reason (a writer task may name one excerpt; do not require one slot per segment).
- `structural/section_missing.ts`: at the end of `run`, `const ob = excerpt_obligation(ctx)`; if `ob.needed && count_excerpt_slots(ctx.lesson.sections) === 0` push `finding(\`Lesson is missing a required excerpt slot (${ob.reasons.join("; ")})\`, addr)` where `addr` is the address of the `Learning in Action` section if present, else the first section's address, else `ctx.lesson.lesson_id`. The kind stays `section_missing` (no new kind; it is generation-actionable, so a draft that skips a required slot goes to repair and then fails, instead of being stored as a clean lesson). Do not emit this finding for a lesson with a filled or open slot.
- `links/cross_lesson_link.ts`: after computing `state`, add before the existing `open` branch: `if (src !== undefined && state === "absent")` push a blocking finding `` `Homework at ${link.from_address} waits on ${link.to_lesson_id}, which has no excerpt slot to fill (cross_lesson_link)` `` with `address: link.from_address, related_lesson_id: link.to_lesson_id`, then `continue`. When `src === undefined` the existing branch still treats it as open.
- Tests. `slot-obligations.test.ts` (exact names): `writer_task_without_slot_is_blocking` (row with an `apply` writer_task segment, no slot: one `section_missing` finding, level `blocking`, message contains `outline writer task`); `ignored_or_show_only_writer_task_is_no_obligation`; `incoming_homework_link_requires_a_slot` (use `link` from `links/test-support.ts` with `ctx.lesson_id` set to `G6.U4.L5`); `open_slot_satisfies_the_obligation_but_still_blocks` (open `excerpt_slot` present: no `section_missing`; `excerpt_slot_open_rule` returns a blocking finding); `filled_slot_clears_both`; `gates_block_open_and_missing`: build issues with `merge_resolutions` for the missing-slot finding and for an open-slot finding and assert `submit_gate` and `approve_gate` both refuse with `BLOCKED`, and allow once the slot is filled; `count_excerpt_slots_counts_filled_quotes` (a `quote` with `origin: "excerpt_slot"` counts, a `quote_placeholder` does not). `cross-lesson.test.ts` adds `absent_slot_blocks_homework` (source lesson exists with no slot: one blocking `cross_lesson_link`; `submit_gate` refuses). `required-roles.test.ts` adds `missing_required_slot_names_the_section_address`.

**Step 11. Fixture drafts (test and demo data only).** The new rules make "teaching text exists" insufficient, so every fixture draft that is meant to pass the full check set needs a teaching routine per focus code. For each file in the section 2 table: for every code in that fixture row's `focus_codes`, make sure (a) a `routine_heading` block opens the section/part where it is taught, its `standard_codes` is that code and `code_origins` is `["outline"]`, with a `teacher_talk` block after it in the same section/part; (b) a `cfu_item` carries the code in `cfu.standard_code` (at most two codes per item). Do not delete or reorder other blocks; leave `minutes` of new blocks `null`. For the stub drafts that have `first_draft` and `draft` (worker `stub-drafts/*.json`), the `first_draft` is deliberately defective to drive the repair path: change only `draft` (the repaired one) and keep the first draft's defect. WP-1 teaching placement: `RL.6.1` in Part A (title routine `Percy's Voice`), `RL.6.2` in Part B (title routine), `L.6.4.b` in Literacy Lab on the existing morphology routine. WP-2: `W.6.2.a` Literacy Lab, `W.6.2.b` Part A, `W.6.2.f` Part B (match `expected.json` `taught_in`). If a fixture's CFU coverage is already incomplete on main (WP-1 has no Pulse Check for `RL.6.1`), do not invent a fix beyond this rule: report it, and add the missing `cfu_item` only in the `draft`/repaired variant. Before editing any fixture, `grep -rn "<fixture file name>"` and `grep -rn` for its content hash; if a golden or hash test pins the file's bytes, update that expectation in the same commit and say so (changing demo fixture content is intended; a hash literal elsewhere is not a reason to skip the change).

**Step 12. Context upkeep (rule `context-maintenance`).** Append rows to `.claude/reference/area-map.md` (A5 compile: `standard-tags.ts`, `part-labels.ts`; A6a: slot obligations in `links/slot-obligations.ts`; the alignment helpers). Write `docs/devlog/2026-10-26-astra-slice-d.md` (Changed, Why, Checked, Remaining; about 100 words): the D-1 to D-6 decisions, the new prompt version consequence, the open S3 proposals from section 8. State plainly that nothing was re-measured with a model and that no alignment is verified by a person or a judge.

**Step 13. Gates.** Section 7.

## 6. Data and fixtures

Synthetic only, from existing committed files: `packages/core/tests/fixtures/{row-wp1.json,draft-wp1.json}`, `packages/llm/src/fixtures/draft-wp{1,1-repaired,2}.json`, `evals/cases/drafts/_fixtures/good-wp-3.json` (read only), `evals/cases/drafts/wp-*/expected.json` (read only), `apps/worker/test/fixtures/stub-drafts/wp-{1,2}.json`, `checks/rules/grounding/fixtures/build.ts` for rows. Inline invented codes in tests (`L.6.3a`, `W.6.2`, `RL.6.7`) and inline text such as `Gather evidence` / `Plan and write` (the labels the real L5 draft used; no real draft text is copied). Do not read `docs/source/restricted`, the seeded-error key, or any `.env`.

## 7. Checks

While iterating (affected tests only):
```sh
npx vitest run packages/core/src/compile
npx vitest run packages/core/src/checks
npx vitest run packages/prompts
npx vitest run apps/worker/src/generation apps/worker/src/wiring
npx vitest run packages/core/src/checks/rules/alignment/standards-evidence.test.ts packages/core/src/checks/rules/links/slot-obligations.test.ts packages/core/src/compile/compile-contract.test.ts
```
Existing tests that must stay green (expectation edits are only the ones named in steps 3, 8, 9): `compile/compile-draft.test.ts` (including hash tests), `addresses.test.ts` (one line, step 3), `templates.test.ts`, `checks/{gates,registry,run-checks,context-loader,policy}.test.ts`, all `rules/structural/*.test.ts`, `rules/grounding/*.test.ts` (A's too), `rules/arc/*.test.ts`, `rules/safety/*.test.ts`, `rules/links/*.test.ts`, `packages/prompts/src/{render,locked,locked-contents,render-injection,render-shapes,render-repair,schemas}.test.ts`, `packages/ydoc` and `packages/schema` hash tests.

Evals that **must stay at 100% with no edit to `evals/**`** (they import `alignment/test-support.ts`, so step 8's `lesson_with` change is what keeps their recipes valid): 
```sh
npx vitest run evals/src/suites/s2.test.ts evals/src/suites/s3-assertions.test.ts evals/src/suites/s3.test.ts evals/src/suites/s3-guards.test.ts evals/src/suites/s3-report.test.ts evals/src/suites/s1.test.ts evals/src/suites/s4.test.ts evals/src/suites/provenance-s2s4.test.ts
npx vitest run evals/src/seed
```
If an S2 recipe goes red, fix `alignment/test-support.ts` or the rule, never the recipe or `evals/cases`. Database-dependent tests (`apps/worker/src/wiring/*.int.test.ts`, `apps/worker/test/wf-22-obligations.int.test.ts`, `evals/src/suites/s3.int.test.ts`) run only if Postgres is up; otherwise report them as not run.

Once before the final commit (cheapest first):
```sh
npx eslint packages/core/src/compile packages/core/src/checks packages/prompts/src apps/worker/src/generation apps/worker/src/wiring
npm run typecheck --workspace @ls/core
npx tsc -p packages/prompts/tsconfig.json --noEmit
npx tsc -p apps/worker/tsconfig.json --noEmit
npm run typecheck --workspace @ls/evals
npx vitest run packages/core/src/compile packages/core/src/checks packages/prompts apps/worker/src/generation apps/worker/src/wiring apps/worker/src/checks
```
Full suite: not run by the implementer. The orchestrator should run it once before the next deploy (locked hash, shared compile, fixture drafts reach the web e2e mocks and demo); say so in the report.

Passing means: every named test exists and passes; the S1/S2/S3/S4 suites above pass unchanged; no new lint or type errors; `git diff --stat -- evals` is empty.

## 8. Risks and requests

**Decision record (PD-32; Innocent's recorded decisions are not contradicted; record these in the devlog and, via the orchestrator, in the PRD decision table):**
- **D-1 exact labels vs mapping.** Canonical: exact `Part A` / `Part B`. Why: the worked pairs address parts as `LearningInAction.PartA`/`PartB`; `expected.json` and the S3 `required_blocks` assertion compare the raw draft `part` for equality; the checker's `PART_RE` accepts only a heading that is exactly `Part <letter>`; `docs/source/04` §3b (Part A/B, level-2 headings) agrees. The compiler's deterministic mapping exists so a real draft with descriptive names is kept rather than lost, and it keeps the model's words as a title routine; because S3 reads the raw draft, the deviation is still measured as a miss. **No change to any expected output or assertion is needed, so no contract correction to expected outputs is recorded.** The contract text for `part` (`docs/contracts/schemas/lesson-draft.schema.json` has only `string|null`) should get a description-only note: *a lane::direct follow-up for the orchestrator*, not done here.
- **D-2** Pulse Check stays the required check for each focus code; Quick Write is a link only. This leaves the pair's alignment map line "RL.6.1 checked in Look Back" (WP-1, `expected.json` `checked_in`) unmatched by the checker. See S3 proposals below.
- **D-3** parent/leaf as above. **D-4** narrowing not offered by the prompt yet. **D-5** tags in heading text. **D-6** at most two codes per assessment item.
- **D-7** No new `CheckKind`: a missing required slot is `section_missing` (generation-actionable); an absent target slot is `cross_lesson_link`. A new kind would be a CHG (`INTERFACE.md`, "a new kind is a CHG-N").
- **D-8** Nothing here verifies instructional alignment. A tag is a claim by the generator or the outline; `confirmed_by` stays null until a person confirms; the judge is disabled and writes no rows; coverage reports `generator_only`.

**Proposed S3 changes (NOT made here; each needs a recorded contract correction / `CHG` first):**
1. `taught_and_checked` enforces locations: for each `expected.focus_codes[]` use the stored tags (teach tag address vs `taught_in`, assess tag address vs `checked_in`, where `Look Back` may be satisfied by a `Quick Write` tag). Needs the observer (`s3-observe.ts`) to read `doc_tags`. Today it only needs "any teaching part" and "any Pulse Check".
2. Resolve WP-1's `RL.6.1 checked_in: Look Back` against the "Pulse Check per focus code" rule (D-2): either the pair is corrected to say Part B or Lab Pulse Check plus a Look Back Quick Write, or the checker accepts Quick Write alone. Innocent's call if he wants the pair kept word for word.
3. `origin_present` currently lets a narrowed code be absent; tighten only after D-4 turns narrowing on.
4. Add `part_remaps.length === 0` as an S3 observation (first-pass label compliance) once the compiler reports it through the observer.

**Requests to the integrator / orchestrator:**
- **R-D4** (turn narrowing on): `draft-node.ts` must add `idx.leaves_of(code)` rows to the prompt `standards` with their parent, `render.ts` must mark them as sub-codes of a listed parent, and `lesson-shape.md` must drop the "Do not narrow" sentence. Then WP-1/WP-2's `narrowed` expectations become reachable.
- **R-A1** (slice A's note): `student-blocks.ts` still has its own `Correct|Incorrect` regex; switch it to `parse_rationale_label` in a follow-up (not here).
- **Docs follow-ups** (lane::direct): description of `part` in the lesson-draft schema doc; PRD decision rows for D-1..D-8; resume checkpoint wording.

**Risks:**
- **Pass-rate drop is intended but large.** Per-code teaching tags make generation stricter; first-pass clean rate may fall until the new prompt is measured. Measure with the frozen S3 cases x3 and one whole-unit run after the candidate is fixed (handoff steps 5 and 6). Do not credit or blame it on model quality without replaying the stored drafts (handoff step 4).
- **Locked hash changes** (`lesson-shape.md`): a new prompt version appears; old pinned jobs raise `LockedLayerMismatch` (slice C step 9 explains).
- **Cross-slice collisions:** `generation.ts`, `render.ts`, `inputs.ts`, `check-parity.test.ts` are touched by A or C; this slice runs after both and edits only the lines named. If a merge conflict appears, keep both sides' lines.
- **Latent bug seen, not fixed:** `structural/expected.ts` `section_name_to_address` strips spaces without capitalising, so `section_missing` findings built there read `...LearninginAction`, while the compiler writes `...LearningInAction`. The new slot finding uses the stored section's own `address` to avoid it. Report to the integrator.
- **Intake-level narrowing provenance** (an author accepting `L.6.4 -> L.6.4.b` at intake) is not modelled: the row only holds code strings, so front matter marks such a code `outline`. WP-1's `L.6.4.b origin narrowed` therefore appears only when a reviewer or later prompt narrows after intake. Stated, not solved.
- **Fixture breadth (step 11):** if more tests than listed pin the old fixtures (web e2e mocks use the stub provider), fix the fixture, never a rule; list each in the report.
- `quote_placeholder` obligations cannot be derived from the row (the model decides where it would quote), so only excerpt-slot obligations are validated; S3 `placeholder_count` stays the measure for quote placeholders.

## 9. Readiness

**READY.** No `NEEDS-DECISION` for Innocent: the exact-label versus mapping question is answered by the worked pairs and the checker (D-1). Conditions: (1) the orchestrator accepts the "extra files" in section 2; (2) slices A and C are merged first, as assumed in section 1.

## Deviations (implementer, 2026-10-26)

- `standard_not_taught`/`standard_not_checked` report a narrowed leaf under the listed parent code (`code: L.6.4`, message names the leaf), one finding per code. The frozen S2 cases expect `code: "L.6.4"`; the plan's "code becomes the leaf" would have turned S2 red.
- `code_not_allowed` skips the unrecorded-tagged-code branch when `ctx.standards` is empty (frozen S2 `clean_reading` has a tagged Pulse Check, an empty row and no catalogue), allows a row-listed tagged code even when its catalogue row was not loaded (narrowed parent), and allows an unrecorded leaf of a listed parent (the advisory `standard_add_suggestion` case). `registry.test.ts` is unchanged.
- Fixture teaching tags use each draft's own CFU codes: `L.6.4` for the repaired/stub WP-1 drafts (the issued sheet lists the parent), `L.6.4.b` for the first llm draft; WP-2 tags `W.6.2.a`, `W.6.2.b`, and `W.6.2` (Part B) rather than `W.6.2.f`.
- Extra edits outside the list: `apps/worker/src/wiring/demo-stub.ts` (`FLEX_ROLES` keeps `routine_heading` in Learning in Action) and `apps/worker/src/checks/check-job-runner.int.test.ts` (adds a tagged teaching heading to the shared stored fixture for the alignment-rows assertion).
- Test names in `compile-contract.test.ts` are `wp1_components`, `wp2_components`, `wp3_components`.
- "text card(s)" wording in `lesson-shape.md` now says lesson card / data blocks (orchestrator instruction).
