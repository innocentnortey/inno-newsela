# Slice F2: one standards-evidence contract, one standard-identity mapping, narrowed/added decision, no empty-catalogue hole

Plan for `fanout-implementer` (Sonnet). Date 2026-10-26. Base: `main` at `45a2a63` **plus slice F1 merged** (F1 lands first: `docs/plans/fanout/2026-10-26-contract/slice-F1.md`). Plan path: `docs/plans/fanout/2026-10-26-contract/slice-F2.md`. Readiness: **READY** (section 9; it needs the orchestrator's yes to the "extra files" in section 2).

## 1. Goal and sources

Eight deliverables from `docs/delivery/2026-10-26-contract-consistency-followup-handoff.md` section 1 rows 2 to 5 and section 2:

1. **One semantic evidence contract** (code, origin, activity identity, location, "is the activity really there") read by every rule from one function, `read_evidence`, instead of five readers that each parse heading text. The heading tag stays as the compatibility codec (`compile/standard-tags.ts`). Evidence is credited to the tagged activity's own span, not to arbitrary text elsewhere in the section. No persistence change (decision F2-D1; the round trip is tested).
2. **One standard-identity mapping** (`compile/standard-identity.ts`): comma lists, placeholder tokens, origin from the pinned row and the official index, front-matter standards. The worker's `build_front_matter_standards` becomes a thin delegate.
3. **One decision on empty / narrowed / added standards** (F2-D3) implemented in prompt, draft schema, compiler, loader, checks and approval: narrowing is allowed and confirmed (approved design); additions are accepted and confirmed but not solicited; code-less rows stay valid.
4. **Two-code cap and ELD** (F2-D4): authority recorded, ELD resolved from the official set only, forged ELD-looking strings validated like any other code.
5. **`callout_say`** (F2-D5): the difference between `teaching_parts` (S3 / judge seed) and production evidence is made intentional and tested.
6. **Assessment locations** (F2-D6): a Quick Write is an assessment location (WP-1 checks RL.6.1 in Look Back); WP-2 narrowed leaves with checklist items are supported.
7. **The empty-catalogue gap closed** (F2-D7): tagged codes are always resolved against the official standards; missing lookup context never means valid; the frozen S2 `clean_reading` setup is corrected under the recorded procedure, in its own commit.
8. **A's three-word residual** (F2-D8): exact words and contexts recorded, review policy stated, no whitelist, blocking impact reassessed.

Sources read for this plan (the implementer need not re-read them, but the decisions cite them):
- Handoff (governing): section 1 rows "Teaching and assessment evidence", "Standard identity/provenance", "Empty lists, narrowed and added standards", and the closing paragraph of section 1 (oracles independent of the code); section 2 bullets 1 to 5 and the `callout_say` / cap / location / no-catalogue bullets.
- Authority for the narrowing/adding decision: `docs/prd/newsela-prd.md` R-19, R-20 (rows at lines 287-288); `docs/design/hard-problems.md` HP-3 (options A to D, recommendation B, "Decision to record": PD-6, R-19 wording, R-20 AC, R-34); `docs/data/worked-pairs.md` WP-1 B "Alignment map" and C table, WP-2 "Alignment map" and C table, WP-3; `evals/cases/drafts/wp-{1,2,3}/expected.json` (read only).
- Where the code stands: `docs/plans/fanout/2026-10-26-astra/slice-D.md` (its section 8 and *Deviations*), `docs/devlog/2026-10-26-astra-slice-d.md` (*Known limit*), `docs/testing/error-analysis/replay-2026-10-26.md`.
- Procedure for the S2 correction: `docs/contracts/CHANGES.md` (CHG rows are for agreed CON cards; CON-13 lists only the check kinds, not rule semantics, so no CHG is needed; the correction is recorded in a devlog, the way slice D recorded its S6 correction).

## 2. Boundary

**Owned (create / modify):**

| Path | Action |
|---|---|
| `packages/core/src/compile/standard-tags.ts` (+ `.test.ts`) | modify: add `is_code_shaped` (step 1) |
| `packages/core/src/compile/standard-identity.ts` (+ `standard-identity.test.ts`) | create (step 1) |
| `packages/core/src/compile/nodes.ts`, `compile-draft.ts` | modify only the standards parts named in step 2 (F1 does not touch them) |
| `packages/core/src/compile/compile-draft.test.ts` | modify: add the tests named in step 2 |
| `packages/core/src/checks/rules/alignment/evidence.ts` (+ `evidence.test.ts`) | create (step 3) |
| `packages/core/src/checks/rules/alignment/{standards-view,standard_not_taught,standard_not_checked,code_not_allowed,derive,standard_add_suggestion,test-support}.ts` | modify (steps 3, 4) |
| `packages/core/src/checks/rules/alignment/{standards-evidence,code-not-allowed,taught-checked,links-derived,advisory}.test.ts` | modify (named edits only) |
| `packages/core/src/checks/rules/alignment/standards-decision.test.ts` | create (step 5) |
| `packages/core/src/checks/rules/links/slot-obligations.ts` (+ `.test.ts`) | modify: `obligation_address` (step 8) |
| `packages/core/src/checks/context-loader.ts` (+ `context-loader.test.ts`) | modify: standards loading only (step 4) |
| `apps/worker/src/generation/nodes/front-matter-standards.ts` (+ `.test.ts`) | modify: delegate (step 5) |
| `packages/schema/src/lesson-draft.ts` (+ `lesson-draft.test.ts`) | modify: one `superRefine` rule (step 2) |
| `packages/prompts/locked/lesson-shape.md` | modify: standards paragraphs (step 6) |
| `packages/prompts/src/lesson-shape-contract.test.ts` | modify: phrase list (step 6) |
| `packages/core/src/checks/rules/grounding/name-scan.ts` | modify: comment only (step 9) |
| `packages/core/src/checks/rules/grounding/surface-forms.test.ts` | modify: the one residual test's title and comment only (step 9) |
| `packages/core/src/checks/rules/grounding/name-scan-residual.test.ts` | create (step 9) |
| `docs/testing/error-analysis/name-scan-residual-2026-10-26.md` | create (step 9) |
| `docs/design/code-design.md` | modify: replace only the three lines `| CM-2 ...`, `| CM-3 ...`, `| CM-4 ...` of section 10a (step 11) |
| `docs/devlog/2026-10-26-contract-f2.md`, `docs/devlog/2026-10-26-contract-f2-s2-correction.md`, `.claude/reference/area-map.md` | create / append (step 11) |

**Extra files this slice must touch (the orchestrator must approve; each is a small named edit; none is edited by F1, which was checked against F1's plan section 2):**

| Path | Edit |
|---|---|
| `apps/worker/src/generation/nodes/draft-node.ts` (+ `draft-node.test.ts`, `apps/worker/src/generation/nodes/testing/fixtures.ts`) | load the sub-codes of listed focus parents into the prompt standards (step 6). `testing/fixtures.ts` is also edited by F1 (the `draft` fixtures only); F2 edits its `standards` double only. Re-read the file after F1 merged. |
| `packages/prompts/locked/repair.md` | one sentence (step 6). Same locked hash change as `lesson-shape.md`, so one new prompt version for both. |
| `packages/core/src/checks/rules/structural/section_missing.ts` | the closing slot-obligation block only: call `obligation_address(ctx)` (step 8). F1 keeps that block unchanged ("keep the closing slot-obligation block exactly as it is today"). |
| `packages/ydoc/src/evidence-roundtrip.test.ts` | new test file (step 10). ydoc depends on core, so the Yjs round trip cannot live in core. |
| `evals/src/suites/s2-fixtures.ts` | **only** the `clean_reading` recipe (and any other recipe proven red by running S2 after step 4), in a separate commit, with the recorded procedure (step 12). |

**Read only (shared surfaces):** `packages/schema/src/lesson.ts` (`Standard`, `StoredLesson`, `PMNode`), `packages/editor-schema/**`, `packages/core/src/checks/{types,gates,registry,policy}.ts`, `packages/core/src/checks/test-helpers.ts` (F1's shape after merge), `packages/core/src/checks/rules/structural/doc-walk.ts`, `packages/core/src/ports/standards.ts`, `packages/core/src/intake/standards-index.ts`, `packages/core/data/standards/*.json`, `apps/worker/src/generation/nodes/{compile-check-node,repair-node,job-state}.ts`, `apps/worker/src/wiring/generation.ts`, `packages/prompts/src/{render,inputs}.ts`, all of `evals/**` except the one recipe above, `docs/**` other than the files in the table.

**Must not touch:** `evals/cases/**` (S2 `rules.json`, S3 `expected.json`), `evals/src/suites/s3-*.ts` (the S3 observer change is request R-F2-2), `evals/src/suites/s6-*.ts`, the S3 1.0 floor, any threshold; `apps/web/**`; `packages/editor-schema/**` and `packages/schema/src/lesson.ts` (no new node attribute, no `StoredLesson` change); `checks/types.ts` (no new `CheckKind`; a new kind is a CHG); `checks/rules/structural/*` other than the one block above (F1); `checks/test-helpers.ts` (F1's; add helpers to `alignment/test-support.ts` instead); `checks/rules/safety/**`; `.env` files; `docs/source/restricted`.

## 3. Requirements table

| # | Requirement (source) | Implementation | Verification |
|---|---|---|---|
| R1 | One semantic evidence contract for code, origin, activity identity and location (handoff s1 row 2) | `alignment/evidence.ts` `read_evidence(lesson): EvidenceItem[]`; every alignment rule, `derive_alignment`, `tagged_codes`, `cfu_tags` and the loader read it (steps 3, 4) | `evidence.test.ts::*`, `standards-evidence.test.ts::*` |
| R2 | Check the actual associated teaching/activity, not arbitrary text in the same section (row 2) | an item is `substantiated` only by the nodes between its heading and the next routine/part heading (step 3) | `evidence.test.ts::teaching_text_in_another_routine_of_the_same_section_does_not_count`, `standards-evidence.test.ts::tagged_heading_with_no_text_under_it_is_not_taught` |
| R3 | Formatting or heading renaming must not silently add or remove coverage (row 2) | kind comes from the `icon` attribute and the `Quick Write` label, never from a title; a removed tag removes the evidence and the rule says so | `evidence.test.ts::renaming_a_title_keeps_the_evidence`, `::renaming_a_pulse_check_keeps_it_an_assessment_while_the_icon_is_cfu`, `::removing_the_tag_removes_the_evidence`, `::a_parenthetical_that_is_not_a_code_adds_nothing` |
| R4 | If persistence changes, define old-document compatibility and the edit/save/export round trip (s1 last paragraph of the contract section) | no persistence change (F2-D1); old documents read identically; round trip tested through the editor schema, the Yjs doc and the export bundle schema | `evidence.test.ts::old_documents_read_the_same`, `packages/ydoc/src/evidence-roundtrip.test.ts::*` |
| R5 | One authoritative mapping between `standard_codes`, `code_origins`, `cfu.standard_code` (comma lists) and front matter (row 3) | `compile/standard-identity.ts` (`clean_codes`, `derive_origin`, `standards_for_lesson`); `nodes.ts` and the worker delegate use it (steps 1, 2, 5) | `standard-identity.test.ts::*`, `front-matter-standards.test.ts::delegates_to_the_core_mapping` |
| R6 | Derive known provenance from pinned inputs; never invent origins or teaching text | origin from the row lists and the official index, never from the model's `code_origins`; the model's claim is compared and reported (`identity_notes`) (steps 1, 2) | `standard-identity.test.ts::origin_comes_from_the_row_not_the_model`, `compile-draft.test.ts::identity_notes_report_a_wrong_origin_claim` |
| R7 | Reject unresolved inconsistencies with actionable diagnostics | draft schema rejects a `cfu_item` whose `standard_codes` and `cfu.standard_code` both name codes and differ (issue path `blocks[i].standard_codes`); unknown tagged codes are blocking `code_not_allowed` naming the address (steps 2, 4) | `lesson-draft.test.ts::cfu_codes_must_agree_when_both_given`, `code-not-allowed.test.ts::unknown_tagged_code_is_blocked` |
| R8 | A code-less assessment is valid where allowed (null CFU code); on a row with a focus obligation null cannot make the obligation disappear (s2 bullet 1) | step 2 (compile), step 3 (rules); no change to the nullable field | `standards-decision.test.ts::code_less_row_null_cfu_is_valid`, `::null_cfu_code_cannot_satisfy_a_focus_obligation` |
| R9 | `N/A` and lesson ids never become codes (row 4) | `is_placeholder_code` in compile and in the evidence reader (steps 1 to 3) | `standard-identity.test.ts::placeholders_are_never_codes`, `compile-draft.test.ts::placeholder_codes_never_reach_a_heading`, `evidence.test.ts::placeholders_in_a_heading_are_not_codes` |
| R10 | Prompt, schema, loader, checker and approval implement the same narrowed/added/empty decision (row 4) | F2-D3: prompt (step 6), front matter (step 5), `code_not_allowed` (step 4), existing confirmation gate | `standards-decision.test.ts::*`, `lesson-shape-contract.test.ts`, `draft-node.test.ts::sub_codes_of_listed_parents_reach_the_prompt` |
| R11 | Valid proposed leaves/additions stay distinguishable from invalid codes and keep their human confirmation | recorded `narrowed`/`added` with `confirmation: "open"` is accepted by `code_not_allowed` and refused by `submit_gate`/`approve_gate` with `CONFIRMATION_OPEN`; unknown or unlisted codes are `code_not_allowed` (blocking) | `standards-decision.test.ts::narrowed_and_added_codes_block_approval_until_confirmed`, `::unknown_code_is_blocked_not_recorded_as_valid` |
| R12 | Two-code cap: authority and meaning (s2 bullet 3) | F2-D4 recorded in the matrix and devlog: an engineering rule from slice D (D-6), not brief/PRD text; a structural claim, not proof; messages never say "aligned" or "verified" | `standards-evidence.test.ts::links_are_unconfirmed_and_never_judge` (existing), matrix row CM-2 |
| R13 | ELD resolved from the actual standards set; forged or malformed ELD-looking strings cannot evade validation; tests: two content + ELD, three content codes, unknown codes | `is_eld` reads only `ctx.standards[].set === "CA_ELD_6"` (step 3) | `standards-evidence.test.ts::two_content_codes_plus_a_real_eld_code_cover_all_three`, `::three_content_codes_cover_none`, `::an_unknown_code_is_content_and_is_blocked`, `::a_forged_eld_looking_code_is_not_eld`, `::a_real_eld_code_is_recognised_only_through_the_catalogue` |
| R14 | `callout_say`: difference between `teaching_addresses` and `teaching_parts` intentional and tested, or removed (s2 bullet 2) | F2-D5: `teaching_addresses` is removed (evidence replaces it); `teaching_parts` stays as the documented S3/judge-seed observation (step 7) | `standards-evidence.test.ts::teaching_parts_differs_from_evidence_only_for_launch_and_say_callouts` |
| R15 | WP-1 checks RL.6.1 in Look Back using a Quick Write; `standard_not_checked` and `derive_alignment` agree (s2 bullet 4) | F2-D6: Quick Write is an assessment location in both (step 3) | `standards-evidence.test.ts::wp1_look_back_quick_write_checks_rl_6_1`, `::quick_write_counts_as_a_check` |
| R16 | WP-2 narrowed writing leaves with checklist evidence | step 3 and step 5 | `standards-evidence.test.ts::wp2_narrowed_leaves_with_checklist_items` |
| R17 | The empty-catalogue bypass is gone; a bogus tag on a no-code row is caught edit -> save -> background check -> submit/approve (s2 last bullet) | loader loads tagged codes; `code_not_allowed` has no `standards.length === 0` branch (step 4) | `context-loader.test.ts::tagged_codes_are_always_looked_up` (describe block, 5 tests named in step 4), `code-not-allowed.test.ts::empty_catalogue_never_means_valid` |
| R18 | If the frozen S2 fixture lacks essential context, correct its setup under the recorded procedure | step 12, separate commit, recorded | `npx vitest run evals/src/suites/s2.test.ts` unchanged expectations |
| R19 | A's three-word residual: exact words, contexts, review policy; test documents a limitation; reassess blocking impact without whitelists | step 9 | `name-scan-residual.test.ts::*`, the doc |
| R20 | A wholly absent Learning in Action section: the slot finding is located and resolvable at the canonical address | `obligation_address` (step 8) | `slot-obligations.test.ts::absent_learning_in_action_locates_the_slot_finding_at_the_canonical_address` |

## 4. Shared code to use (copied from the current code)

```ts
// @ls/schema/lesson
export type PMNode = { type: string; attrs?: Record<string, unknown>; content?: PMNode[]; marks?: PMMark[]; text?: string };
export type Standard = { code: string; role: "focus"|"supporting"|"eld"; origin: "outline"|"outline-fixed"|"narrowed"|"added";
  official_text: string; asserted_by: "outline"|"generator"|"judge"|"reviewer"; confirmation: "open"|"confirmed"|"removed"|null };
// @ls/schema/lesson-draft
export type CfuItemDraft = { stem: string; options: string[]; key_index: number; rationales: string[]; standard_code: string | null };
export type DraftBlock = { role: DraftRole; section: string; part: string | null; text: string; standard_codes: string[];
  code_origins: ("outline"|"narrowed"|"added")[]; cfu: CfuItemDraft | null; minutes: number | null };
// @ls/schema/ids
export const LESSON_ID_RE = /^G\d{1,2}\.U\d{1,2}\.(L\d{1,3}|FLEX-\d{1,2}[a-z]?)$/;
// compile/standard-tags.ts (today)
export const MAX_CODES_PER_CHECK = 2;
export type ParsedTag = { label: string; codes: string[] };
export function parse_tag(text: string, strict: boolean): ParsedTag | null;      // strict: every token must look like a code
export function format_tag(label: string, codes: readonly string[]): string;
// compile/labels.ts
export const ELD_LABEL = "Integrated ELD Instructions"; export const PULSE_CHECK = "Pulse Check"; export const QUICK_WRITE = "Quick Write";
// checks/rules/structural/doc-walk.ts
export function walk(node: PMNode, fn: (n: PMNode) => void): void;
export function node_text(node: PMNode): string;
export type SectionEvent = { node: PMNode; address: string; siblings: PMNode[]; index: number };
export function visit_with_parts(section: Section, fn: (e: SectionEvent) => void): void;   // address = section address or `${section.address}.PartA`
// ports/standards.ts
export interface StandardRow { code: string; set: "CA_CCSS_ELA_6"|"CA_ELD_6"|"MSLS_6"; text: string; parent_code: string | null; is_leaf: boolean; eld_strand: string | null }
export interface StandardsIndex { resolve(code, sheet_label?): StandardResolution; leaves_of(code: string): string[]; text_of(code: string): string | null }
export interface StandardRepo { index(): Promise<StandardsIndex>; texts(codes: readonly string[]): Promise<StandardRow[]> }  // texts returns only codes it finds
// checks/types.ts: CheckContext has lesson, row (focus_codes, eld_codes, msls_codes), allowed_codes, standards: StandardRow[], confirmations
// alignment/standards-view.ts exports that OTHER code imports and must keep (name, args, meaning):
//   FRONT(ctx), recorded(ctx), listed_codes(ctx), focus_obligations(ctx): {code, parent}[], tagged_codes(lesson): string[],
//   cfu_tags(ctx): {code, address}[]   (evals/src/suites/s3-observe.ts), teaching_parts(lesson): string[] (s3-observe.ts, apps/web judge seed, judge-capture.test.ts)
// gates: merge_resolutions(findings, recorded), submit_gate(state), approve_gate(state); test-helpers: gate_state, cfu_item, routine, p, section, make_ctx, reading_lesson
```
Data facts checked for this plan: `packages/core/data/standards/eld-6.json` holds `set: "CA_ELD_6"` rows including tier codes (`ELD.PI.6.1.Em`), so "is this an ELD code" is answerable from the official rows; `ccss-ela-6.json` rows carry `parent_code` and `is_leaf`; MSLS codes look like `MSLS 2.1a` (with a space, so they are not code-shaped under `parse_tag` strict mode, only readable inside a Pulse Check/Quick Write tag).

## 5. Steps

Decisions (PD-32 adoption; no product decision is needed; each is recorded again in the devlog):

- **F2-D1 Semantic authority.** The authority is `read_evidence` (one reader) plus the persisted `alignment_link` rows it feeds (typed: code, address, role, origin, asserted_by, confirmed_by). The heading tag is the codec and also what the teacher sees (`docs/source/04` section 4 shows standards in headings), so it stays. A typed node attribute would need an `editor-schema` change (schema version, hash, Yjs, web editor); that is not unavoidable: nothing in the handoff needs it once (a) the kind of evidence comes from structure (icon, Quick Write label) not wording, (b) evidence is tied to its own span, (c) a removed tag is a visible finding. If a later measurement shows reviewers losing tags, the typed attribute is the escalation (request R-F2-3).
- **F2-D2 Identity.** Wire format unchanged (`cfu.standard_code` stays `string | null`, comma list). Replacing it by an array would invalidate every stored draft and the 47 stored replays. The comma list is parsed in exactly one function. The model's `code_origins` is a claim; origin is derived from the row and the official index; contradictions are reported, not trusted.
- **F2-D3 Empty / narrowed / added.** Authority: PRD R-19 and R-20, HP-3 option B (PD-6 decided): a code is in the row's lists, or a leaf of a listed parent (`narrowed`), or proposed for a list the row left empty (`added`); `narrowed` and `added` block Approve until a named reviewer confirms. Decision: (a) **narrowing is allowed**: the prompt offers the sub-codes of listed parents (data blocks from the official index) and no longer says "Do not narrow"; (b) **additions are accepted and confirmed but not solicited**: for a code-less row the prompt still says to leave codes empty and use a null CFU code, because the draft prompt has no catalogue to propose from and unprompted codes would be recalled from memory; if a draft or reviewer nevertheless tags a real standard on a row whose list is empty, it is recorded `added` with an open confirmation (generation) and, if only typed in by hand, blocked as `code_not_allowed` (the reviewer path to add a code is the existing "add?" advisory, which exists only for leaves of listed parents; request R-F2-1 records the gap); (c) unknown codes are always `code_not_allowed`. `N/A` and lesson ids are not codes.
- **F2-D4 Cap and ELD.** `MAX_CODES_PER_CHECK = 2` has no brief or PRD source; it is slice D's engineering rule D-6 ("unrelated assessment content tagged with every standard cannot establish alignment", handoff Astra section "Align production lesson structure"). Meaning: a **structural plausibility bound** (an item naming more than two content standards is too broad to count as the check of each). It is not evidence that the question tests the skill; the judge is off and links stay `confirmed_by: null`. ELD codes (official set `CA_ELD_6`) do not count toward the cap, as PD-39 ruled.
- **F2-D5 `callout_say`.** Production evidence counts Say callouts and Launch as teaching text. `teaching_parts` (S3's "any teaching part" observation and the judge seed) keeps its meaning: paragraphs only, Literacy Lab and Learning in Action. The difference is intentional, documented in the code comment, and tested. S3 is stricter on this point, which is the safe direction.
- **F2-D6 Assessment locations.** Authority: WP-1 "Alignment map" (RL.6.1 checked in Look Back by a Quick Write tagged RL.6.1; Part B's Pulse Check is tagged RL.6.2 only) and `expected.json` `checked_in: "Look Back"`; PRD V-2 (every focus standard has a teaching and a checking link). Slice D's rule "Pulse Check only" (D-2) was an implementation assumption, not a source. Decision: a **Quick Write is an assessment item like a Pulse Check**, both for `standard_not_checked` and for the `A` links `derive_alignment` already emits. The prompt keeps a `cfu_item` as the usual check and says a Quick Write that lists the code also counts. S3's `cfu_tags` still sees only Pulse Checks, so S3 stays the stricter observer until the evals owner corrects it (R-F2-2, a contract correction in `evals/**`, not made here).
- **F2-D7 Lookup.** `ctx.standards` is always built from the official rows for: the leaves of the row's listed codes, the recorded codes, and every tagged code. A tagged code with no official row is unknown and blocking. A row-listed code that has no loaded row stays valid because the row is pinned input validated at intake (that is not lookup context).
- **F2-D8 Residual.** No detection change; policy recorded (step 9).

**Step 0. Baseline and F1 check (no edits).**
```sh
git log --oneline -12            # F1's merge commit must be there; if not, stop and report
git grep -n "Close reading" packages/core/src/checks/test-helpers.ts      # F1 plan step 5.3 puts this routine in Learning in Action; needed by step 12
git grep -n "section_address" packages/core/src/compile/addresses.ts      # F1 helper, used in step 8
npx vitest run packages/core/src/compile packages/core/src/checks packages/prompts apps/worker/src/generation apps/worker/src/wiring
```
Note anything already red. Re-read `compile/nodes.ts` and `compile/compile-draft.ts` as they are on `main` now (F1 does not edit them, but slice D's current text is the base: `routine_heading(block)`, `cfu_item(block)`, `quick_write(block)` in `nodes.ts`; `build_nodes` and `compile_draft` in `compile-draft.ts`).

**Step 1. `compile/standard-tags.ts` addition and `compile/standard-identity.ts` (new).**

In `standard-tags.ts` add and export (the `CODE` regex already exists, unexported): `export function is_code_shaped(token: string): boolean { return CODE.test(token); }`. Test in `standard-tags.test.ts`: `is_code_shaped_matches_parse_strict`: `RL.6.1`, `L.6.4.b`, `ELD.PI.6.6b`, `ELD.PI.6.6b.Em` are shaped; `MSLS 2.1a`, `N/A`, `G6.U4.L4`... note `G6.U4.L4` **is** code-shaped (`G6` then `.U4`, `.L4`), which is exactly why placeholders are filtered by `is_placeholder_code` first, never by shape: add that case as `a_lesson_id_is_code_shaped_so_it_is_filtered_by_identity`.

New `compile/standard-identity.ts`:
```ts
import { LESSON_ID_RE } from "@ls/schema/ids";
import type { LessonDraft } from "@ls/schema/lesson-draft";
import type { Standard } from "@ls/schema/lesson";
import type { NormalizedRow } from "@ls/schema/outline";
import type { StandardRow } from "../ports/standards.ts";

export type DraftOrigin = "outline" | "narrowed" | "added";
export type RowCodes = Pick<NormalizedRow, "focus_codes" | "eld_codes" | "msls_codes">;

/** Tokens that mean "no code". Never a claim about a standard. */
export function is_placeholder_code(token: string, lesson_id: string): boolean;
/** "RL.6.1, RL.6.2" / "RL.6.1;RL.6.2" / ["RL.6.1"] / null -> trimmed distinct tokens in order, empty tokens dropped. The only parser of cfu.standard_code. */
export function split_code_list(raw: string | readonly string[] | null | undefined): string[];
/** split_code_list, then placeholders moved to `dropped`. */
export function clean_codes(raw: string | readonly string[] | null | undefined, lesson_id: string): { codes: string[]; dropped: string[] };

export type CodeClass = { origin: DraftOrigin; role: Standard["role"]; resolved: boolean; replaces: string | null };
/** Origin from the pinned row and the official rows, never from the model. */
export function classify_code(code: string, row: RowCodes, catalogue: readonly StandardRow[]): CodeClass;
/** The Standard[] a lesson records: focus, then MSLS (supporting), then ELD from the row; then the tagged codes (narrowed leaves replace their parent; others are added). */
export function standards_for_lesson(row: RowCodes, catalogue: readonly StandardRow[], tagged: readonly string[]): Standard[];

export type IdentityNote = {
  kind: "placeholder_code_dropped" | "codes_on_uncarried_role" | "origin_claim_contradicts_row";
  section: string; block_index: number; code: string | null; detail: string;
};
/** Catalogue-free checks of the draft's own claims against the pinned row (used by compile_draft). */
export function identity_notes(draft: LessonDraft, row: RowCodes): IdentityNote[];
```
Rules:
1. `is_placeholder_code(token, lesson_id)`: trim; true when it matches `/^(?:n\s*\/\s*a|na|none|null|nil|tbd|no\s+codes?|not\s+applicable|[-–—]+)$/i`, or equals `lesson_id`, or matches `LESSON_ID_RE`. (A standard code never matches these; `G6.U4.L4` is code-shaped, so placeholders are tested **before** shape.)
2. `split_code_list`: if an array, treat each element as a raw string; split on `/[,;]/`; trim; drop `""`; de-duplicate keeping first order.
3. `classify_code(code, row, catalogue)`: `listed = [...focus, ...msls, ...eld]` with their roles (focus `focus`, msls `supporting`, eld `eld`). If `code` is in `listed`: `{origin:"outline", role: that role, resolved:true, replaces:null}`. Else `r = catalogue.find(code)`. If `r` is a leaf with `parent_code` in `listed`: `{origin:"narrowed", role: role of the parent, resolved:true, replaces: r.parent_code}`. Else `{origin:"added", role: r?.set==="CA_ELD_6" ? "eld" : (r?.set==="CA_CCSS_ELA_6" && row.focus_codes.length===0 ? "focus" : "supporting"), resolved: r !== undefined, replaces:null}`. (This is the logic that today lives in `front-matter-standards.ts` steps 1 to 3; copy its behaviour exactly, it has 10 passing tests.)
4. `standards_for_lesson(row, catalogue, tagged)`: move the body of `build_front_matter_standards` here unchanged in behaviour: base list from the row (a listed code with no official text is skipped; `origin:"outline"`, `asserted_by:"outline"`, `confirmation:null`); each distinct tagged code not listed is classified with `classify_code`; narrowed -> `{origin:"narrowed", asserted_by:"generator", confirmation:"open", official_text:r.text}` replacing its parent in place; added -> `{origin:"added", asserted_by:"generator", confirmation:"open", official_text: r?.text ?? ""}` appended after the base; an unknown code is kept with empty text (the check then blocks it).
5. `identity_notes(draft, row)` (no catalogue): for each block `b` at index `i`: (a) any token of `b.standard_codes` or of `split_code_list(b.cfu?.standard_code)` for which `is_placeholder_code(token, draft.lesson_id)` is true -> `placeholder_code_dropped`; (b) `b.standard_codes.length > 0` and `b.role` not in `["routine_heading","quick_write","cfu_item"]` -> `codes_on_uncarried_role` (compile ignores them; the prompt says only those three roles carry codes); (c) for each `b.standard_codes[k]` with `b.code_origins[k]`: let `listed` be the row's three lists; if the code is listed and the claim is not `outline`, or the code is not listed and the claim is `outline` -> `origin_claim_contradicts_row`. `detail` never contains draft text, only role, section, code and claim.

Tests, `standard-identity.test.ts` (names exact):
- `split_handles_comma_semicolon_array_and_null`: `"RL.6.1, RL.6.2"`, `"RL.6.1;RL.6.2"`, `["RL.6.1","RL.6.2"]`, `null`, `""`, duplicates collapse.
- `placeholders_are_never_codes`: `N/A`, `n/a`, `NA`, `None`, `null`, `-`, `—`, `G6.U4.L4`, `G6.U4.FLEX-1a` are placeholders for lesson `G6.U4.L4`/`G6.U4.FLEX-1a`; `clean_codes("RL.6.1, N/A", id)` gives codes `["RL.6.1"]`, dropped `["N/A"]`.
- `real_codes_are_not_placeholders`: `RL.6.1`, `L.6.4.b`, `ELD.PI.6.6b`, `MSLS 2.1a`, `W.6.2`.
- `origin_comes_from_the_row_not_the_model`: row lists `RL.6.1`; `classify_code("RL.6.1", ...)` is `outline` whatever any draft claims; a leaf of a listed parent is `narrowed` with `replaces` set; `RL.6.7` on a row that lists `RL.6.1` is `added`/`supporting`; on a code-less row it is `added`/`focus`; an unknown code is `added`, `resolved:false`.
- `narrowed_leaf_replaces_its_parent`, `added_code_is_recorded_with_an_open_confirmation`, `unknown_code_is_kept_with_empty_text`, `listed_code_is_not_added_again` (port of the worker tests; same fixtures rows built inline).
- `identity_notes_report_each_inconsistency`: one block per note kind; assert `kind`, `section`, `block_index`, `code`, and that no `detail` contains the block text.

**Step 2. Compile and draft schema.**

`nodes.ts` (edit only these three functions; add an optional last parameter `lesson_id: string = ""` to each):
- `routine_heading(block, lesson_id)`: codes are `clean_codes(block.standard_codes, lesson_id).codes`; text is `format_tag(block.text.trim(), codes)`; icon rule unchanged (`routine_icon(block.text)`).
- `quick_write(block, lesson_id)`: same codes, `format_tag(QUICK_WRITE, codes)`, icon `writing`.
- `cfu_item(block, lesson_id)`: `const codes = clean_codes(c.standard_code, lesson_id).codes;` heading text `format_tag(PULSE_CHECK, codes)` (a null or all-placeholder code gives plain `Pulse Check`; a comma list gives `Pulse Check (A, B)`, the format `parse_tag` reads). Nothing else in the function changes (rationale labels belong to F1/A).

`compile-draft.ts`: `build_nodes` gets `lesson_id` and passes it to those three calls; `CompiledLesson` gains `identity_notes: IdentityNote[]` (always present) computed once by `identity_notes(draft, ctx.row)` before section building. `compile_draft`'s behaviour for drafts with plain codes is unchanged, so the compile hash tests stay green (assert it, see below).

`packages/schema/src/lesson-draft.ts`, `DraftBlock.superRefine`: add, after the existing `code_origins` rule: for `b.role === "cfu_item"` and `b.cfu !== null`, when `b.standard_codes.length > 0` and `split_code_list(b.cfu.standard_code)` is non-empty, require the two sets of codes equal (compare as sorted distinct trimmed strings); otherwise `ctx.addIssue({ code: "custom", path: ["standard_codes"], message: "cfu_item standard_codes must match cfu.standard_code" })`. Implement the comparison with a local 3-line splitter in this file (schema must not import core); keep it identical to `split_code_list` (comma and semicolon). An empty `standard_codes`, or a null/empty `cfu.standard_code`, is **not** a disagreement (a model may leave one side empty). The emitted JSON schema does not change (a `superRefine` is invisible to it); confirm with `npx vitest run packages/schema`.

Tests:
- `compile-draft.test.ts`: `cfu_codes_split_and_formatted` (`standard_code: "RL.6.1; RL.6.2"` compiles to `Pulse Check (RL.6.1, RL.6.2)`); `placeholder_codes_never_reach_a_heading` (cfu `"N/A"`, a routine_heading with `standard_codes: ["G6.U4.L4"]` and `code_origins: ["outline"]`, a quick_write with `["none"]`: headings are `Pulse Check`, the routine's own text, `Quick Write`); `identity_notes_report_a_wrong_origin_claim` (a row listing `RL.6.1`, a block claiming `added` for it: one `origin_claim_contradicts_row`); `plain_drafts_compile_to_the_same_hash` (compile `packages/core/tests/fixtures/draft-wp1.json` with `row-wp1.json` and compare `content_hash` with the value the existing hash test in this file already pins; if the file pins none, compare with the hash computed on `main` before your edit and write it into the test as a literal).
- `lesson-draft.test.ts`: `cfu_codes_must_agree_when_both_given` (block `["RL.6.1"]` with cfu `"RL.6.2"` fails with issue path `blocks.0.standard_codes`; `["RL.6.1","RL.6.2"]` with `"RL.6.2, RL.6.1"` passes; `[]` with `"RL.6.1"` passes; `["RL.6.1"]` with `null` passes).

**Step 3. `alignment/evidence.ts` (new) and the rules that read it.**

```ts
export type EvidenceKind = "teach" | "assess";
export type EvidenceActivity = "routine" | "pulse_check" | "quick_write";
export type EvidenceItem = {
  code: string;
  kind: EvidenceKind;
  activity: EvidenceActivity;
  address: string;                 // as visit_with_parts gives it: section address or `${section.address}.PartA`
  section: string;                 // Section.name
  ordinal: number;                 // 1-based position of the heading among ALL routine_headings of the section (not persisted)
  tag_codes: readonly string[];    // every code the same heading names, placeholders dropped
  substantiated: boolean;
};
export const TEACHING_SECTIONS: readonly string[] = ["Launch", "Literacy Lab", "Learning in Action"];
export function read_evidence(lesson: StoredLesson): EvidenceItem[];
```
`read_evidence` algorithm (invariants in brackets):
1. For every section except `Homework`, `visit_with_parts(section, ({node, address, siblings, index}) => ...)`; act only on `node.type === "routine_heading"`; increment that section's ordinal for every routine heading, tagged or not. [Identity of an activity is its place among routine headings, not its wording.]
2. `t = node_text(node).trim()`; `loose = parse_tag(t, false)`.
3. Classify (first match wins): (a) `node.attrs?.icon === "cfu"` -> `assess / pulse_check`, tokens from `loose`; (b) `loose !== null && /^quick write$/i.test(loose.label)` -> `assess / quick_write`; (c) otherwise `strict = parse_tag(t, true)`; if non-null -> `teach / routine`. Anything else adds no item. [The kind comes from the icon attribute and the fixed `Quick Write` label the compiler writes; a title or a "(Pairs)" parenthetical never becomes evidence, and renaming a Pulse Check heading keeps it an assessment as long as its icon is `cfu`.]
4. Tokens: drop every token for which `is_placeholder_code(token, lesson.lesson_id)`; if none remain, no item. One item per remaining code; all share `tag_codes`.
5. Span: the siblings after `index` up to, not including, the next `routine_heading` or `heading` sibling (the same boundary `find_cfu_items` uses). [Evidence belongs to this activity, not to the section.]
6. `substantiated`: teach -> `has_teaching_text(span)`; pulse_check -> `span.some((n) => n.type === "ordered_list")`; quick_write -> `span[0]` is a `paragraph` with non-empty `node_text`.
7. `has_teaching_text(nodes)`: true if any node yields a non-empty `paragraph` when walking its subtree **excluding** subtrees of `teacher_tip`, `table`, and any `collapsible` other than the one labelled `ELD_LABEL`; inside the ELD collapsible only a `callout` with `attrs.variant === "say"` counts. [This is slice D's rule (PD-39: Say callouts are teaching; purpose, watch and the support table are not), applied to the span.]
8. Helpers exported from `standards-view.ts` (rewritten on top of `read_evidence`, same names, same meaning): `tagged_codes(lesson)` = distinct `code`s in order; `cfu_tags(ctx)` = items with `activity === "pulse_check"` mapped to `{code, address}` (S3 imports it; unsubstantiated items included, as today); `teaching_parts` unchanged (see step 7).
9. `is_eld(ctx, code)` = `ctx.standards.some((s) => s.code === code && s.set === "CA_ELD_6")` **only** (remove the `startsWith("ELD.")`, `ctx.row.eld_codes` and recorded-role clauses). `tag_covers(ctx, item)` = `item.kind === "assess" && item.substantiated && item.tag_codes.filter((c) => !is_eld(ctx, c)).length <= MAX_CODES_PER_CHECK`. `assessment_codes(ctx, activities)` = codes of items with `activity` in `activities` and `tag_covers`. [A forged `ELD.XX.9.9` or an ELD code with no catalogue row counts as a content code: fail closed.]
10. Delete `DocTag`, `doc_tags` and `teaching_addresses` from `standards-view.ts` (only slice D's own files used them: `derive.ts`, `standard_not_taught.ts`; `git grep -n "doc_tags\|teaching_addresses"` must show no other user).

Rules:
- `standard_not_taught.ts`: for each `focus_obligations(ctx)` entry `o`: taught iff an item exists with `kind === "teach"`, `TEACHING_SECTIONS.includes(item.section)`, `item.substantiated` and `item.code === o.code`. Not taught -> finding as today (`code: o.parent ?? o.code`, address `FRONT(ctx)`, one per reported code). Message: default unchanged `Standard ${leaf} has no teaching routine tagged with it at ${FRONT(ctx)} (standard_not_taught)`; if an item for the leaf exists in a teaching section but is not substantiated: `Standard ${leaf} is tagged on the routine heading at ${address} but no teaching text follows that heading before the next routine (standard_not_taught)`; else if it exists only in other sections: `Standard ${leaf} is tagged only at ${address}, which is not Launch, Literacy Lab or Learning in Action (standard_not_taught)`.
- `standard_not_checked.ts`: checked iff `assessment_codes(ctx, ["pulse_check","quick_write"])` has `o.code`. Finding address as today (`teaching_parts(ctx.lesson)[0] ?? FRONT(ctx)`). Message default: `Standard ${leaf} has no Pulse Check or Quick Write tagged with it at ${address} (standard_not_checked)`; if an assess item names it but fails the cap: `Standard ${leaf} is tagged only on an item that names more than two standards, at ${item_address} (standard_not_checked)`; if it fails `substantiated`: `Standard ${leaf} is tagged on an item at ${item_address} that has no question or prompt under it (standard_not_checked)`. Fix any test that matched the old sentence `has no Pulse Check item tagged with it` (`git grep -n "Pulse Check item tagged"`); they check the kind, not the wording, but verify.
- `derive.ts`: subjects unchanged (`focus_obligations` codes plus recorded `supporting`). Teach rows: items `kind === "teach"`, in `TEACHING_SECTIONS`, `substantiated`, naming the code; first distinct address `I`, later distinct addresses `P`. Assess rows: items `kind === "assess"` with `tag_covers`, role `A`, address = the item's address (both `pulse_check` and `quick_write`). De-duplicate on `code|address|role`. `origin`, `asserted_by`, `confirmed_by` exactly as today. No tags -> no rows.
- `standard_add_suggestion.ts`: unchanged (it uses `cfu_tags`).

Test-support (`alignment/test-support.ts`, owned): add W.6.2 leaves to `std_rows()`: `r("W.6.2.a","W.6.2",true,"synthetic writing two a")`, `.b`, `.f`; add an ELD tier row `eld("ELD.PI.6.6b.Em","PI","synthetic strand one emerging")`. (Rows are synthetic; codes copy the official form.)

Tests in `evidence.test.ts` (names exact; build lessons with `section`, `routine`, `p`, `cfu_item`, `eld_block`, `callout` from `checks/test-helpers.ts`):
- `reads_codes_from_pulse_check_quick_write_and_routine_headings`: one lesson with `Percy (RL.6.1)` (notes_section), `Pulse Check (RL.6.2, L.6.4.b)` (cfu), `Quick Write (RL.6.1)` (writing): items have the right `kind`/`activity`, one per code, shared `tag_codes`.
- `a_routine_heading_is_credited_only_with_its_own_text`: `[routine(Voice (RL.6.1)), p("text"), routine("Next"), p("more")]` -> first item substantiated; `[routine(Voice (RL.6.1)), routine("Next"), p("text")]` -> not.
- `teaching_text_in_another_routine_of_the_same_section_does_not_count`: the second shape above, plus `standard_not_taught_rule` reports the "no teaching text follows" message.
- `say_callout_after_the_heading_is_teaching_text` and `purpose_and_watch_callouts_are_not_teaching_text` (use `eld_block()` after the heading; purpose/watch only: not substantiated; add a say callout with text: substantiated).
- `renaming_a_title_keeps_the_evidence`: `Percy (RL.6.1)` and `Percy's voice, renamed (RL.6.1)` give the same item except nothing (same code, kind, address, ordinal).
- `renaming_a_pulse_check_keeps_it_an_assessment_while_the_icon_is_cfu`: heading `Quick check (RL.6.1)` with icon `cfu` is `assess/pulse_check`; the same text with icon `notes_section` is `teach/routine`.
- `removing_the_tag_removes_the_evidence`: `Pulse Check` (no tag) gives no item and, with the code a focus obligation, `standard_not_checked_rule` returns a finding (the loss is visible).
- `a_parenthetical_that_is_not_a_code_adds_nothing`: `Turn and Talk (Pairs)` and `Notes (L.6.4 b)` give no item.
- `placeholders_in_a_heading_are_not_codes`: `Pulse Check (N/A)`, `Pulse Check (G6.U4.L4)`, `Pulse Check (RL.6.1, N/A)` give no item / one item.
- `a_malformed_code_in_a_pulse_check_is_still_read`: `Pulse Check (RL 6.1)` gives an item with code `RL 6.1` (so `code_not_allowed` can block it).
- `ordinal_counts_routine_headings_per_section`, `homework_is_never_read`, `quick_write_needs_a_prompt_paragraph`, `pulse_check_needs_options`.
- `old_documents_read_the_same`: the stored fixture `packages/ydoc/tests/fixtures/stored-wp1.json` (read it with `JSON.parse`; it predates the tags, so it has untagged `Pulse Check` headings) gives no items and no throw, and a copy of it with one heading text edited to `Pulse Check (RL.6.1)` gives one item. (Old documents have no tags: the same findings appear as for any lesson without evidence; nothing is migrated.)

Tests in `standards-evidence.test.ts` (modify/add; keep the existing ones that still hold; the file's helper `ctx_with(focus, lia, standards, look_back)` stays):
- Replace `quick_write_tag_is_a_link_not_a_check` by `quick_write_counts_as_a_check` (a code tagged only on `Quick Write (...)` with prompt text: no `standard_not_checked`; `derive_alignment` has an `A` row at `...LookBack`) and add `quick_write_with_three_codes_covers_none`, `unsubstantiated_quick_write_covers_none` (heading with no paragraph under it).
- `wp1_look_back_quick_write_checks_rl_6_1` (the pair's alignment map): row focus `RL.6.1, RL.6.2, L.6.4.b`; teaching routines tagged per code (RL.6.1 and RL.6.2 in Learning in Action Part A and Part B, L.6.4.b in Literacy Lab); Pulse Checks tagged `RL.6.2` (Part B) and `L.6.4.b` (Literacy Lab) only; Look Back `Quick Write (RL.6.1)` + prompt paragraph. Expect no `standard_not_taught`, no `standard_not_checked`, and an `A` row for `RL.6.1` at the Look Back address.
- `wp2_narrowed_leaves_with_checklist_items`: row focus `W.6.2` (parent), recorded `W.6.2.a`, `W.6.2.b`, `W.6.2.f` as `rec(code, {origin:"narrowed", asserted_by:"generator", confirmation:"open"})`, one tagged teaching routine with text and one Pulse Check per leaf: no taught/checked findings; `standard_confirmation_rule` gives three `confirmation` findings; `submit_gate` refuses with `CONFIRMATION_OPEN`.
- `tagged_heading_with_no_text_under_it_is_not_taught` (the R2 case through `standard_not_taught_rule`).
- ELD and cap (R13): `two_content_codes_plus_a_real_eld_code_cover_all_three` (item `RL.6.1, RL.6.2, ELD.PI.6.6b`, catalogue from `std_rows()` which has the ELD row: no `standard_not_checked` for the two content codes); `three_content_codes_cover_none` (`RL.6.1, RL.6.2, L.6.4.b`); `an_unknown_code_is_content_and_is_blocked` (`RL.6.1, RL.6.2, ZZ.9.9`: covers none, and `code_not_allowed_rule` returns a blocking finding for `ZZ.9.9`); `a_forged_eld_looking_code_is_not_eld` (`RL.6.1, RL.6.2, ELD.PI.9.9` with no such catalogue row: covers none, `code_not_allowed` blocks `ELD.PI.9.9`); `a_real_eld_code_is_recognised_only_through_the_catalogue` (same real item with `ctx.standards = []`: counts as content, so three codes cover none). The existing `eld_codes_do_not_count_toward_the_two_code_limit` stays and must pass.
- `null_cfu_code_cannot_satisfy_a_focus_obligation` is in step 5's file.

**Step 4. `code_not_allowed` and the loader (the empty-catalogue gap).**

`code_not_allowed.ts`, replace the body of `run` (keep `row_list_empty`, the export and the recorded-code loop as they are):
1. Recorded loop: unchanged (needs a catalogue row; listed, leaf-of-listed-parent, or `added` while the row's list for that set is empty).
2. Tagged loop: iterate `read_evidence(ctx.lesson)` items **without** the `ctx.standards.length === 0` guard. For each distinct code (first item's address is the finding address): skip if recorded; `std = ctx.standards.find(...)`; `row_listed = focus ∪ eld ∪ msls`. If `std === undefined`: skip only when `row_listed.has(code)` (pinned input validated at intake), otherwise **block** with `Code ${code} is used in a heading but is not in the official standards list; correct or remove the tag at ${address} (code_not_allowed)`. If `std !== undefined`: skip when `listed_codes(ctx).has(code)` or it is a leaf whose `parent_code` is in `listed_codes(ctx)` (the advisory `standard_add_suggestion` case); otherwise block with `Code ${code} is used in a heading but is not one of this lesson's standards; remove the tag at ${address} (code_not_allowed)`.
3. No other path returns "valid" for a missing catalogue: delete the comment "With no catalogue rows loaded there is nothing to judge a tagged code against".

`context-loader.ts`: `import { tagged_codes } from "./rules/alignment/standards-view.ts";` and build the standards list as `[...new Set([...allowed_codes, ...lesson.front_matter.standards.map((s) => s.code), ...tagged_codes(lesson)])]`. Nothing else in the loader changes (the pinned-version logic belongs to F3).

Tests:
- `code-not-allowed.test.ts`: add `empty_catalogue_never_means_valid` (`make_ctx`-style context with `standards: []`, `row.focus_codes: []`, a Pulse Check tagged `RL.9.9`: one blocking finding, message contains `official standards list`); `real_but_unlisted_code_on_a_code_less_row_is_blocked` (catalogue has `RL.6.7`, nothing recorded: blocking, message contains `not one of this lesson's standards`); `row_listed_code_without_a_loaded_row_is_valid` (row lists `L.6.4`, tag `L.6.4`, `standards: []`: `[]`); keep `an_item_with_no_code_on_a_row_with_no_codes_is_not_flagged`.
- `context-loader.test.ts`: new `describe("tagged_codes_are_always_looked_up")` using the file's `build()` double (give it a row copy with `focus_codes: []`: `NormalizedRow.parse({ ...row_wp1, focus_codes: [] })` in the `versions` option) and `run_checks(ctx, CHECK_RULES, CHECK_POLICY)`, `merge_resolutions`, `submit_gate`, `approve_gate`, `gate_state` (import from `./gates.ts` and `./test-helpers.ts`). Five tests, names exact:
  1. `loads_official_rows_for_tagged_codes`: lesson with `Pulse Check (RL.6.1)` and a double whose `texts` records its argument: the argument contains `RL.6.1` and `ctx.standards` holds its row.
  2. `bogus_tag_on_a_no_code_row_blocks_submit_and_approve`: lesson edited to add `routine("notes_section", "Extra (RL.9.99)")` + `p("text")`, double knows no `RL.9.99`: the result has a blocking `code_not_allowed` for `RL.9.99`; `submit_gate(gate_state({ issues: merge_resolutions(findings, []) }))` and the `approve_gate` equivalent both refuse with `BLOCKED`, `details.issues` listing it. (This is the handoff's edit -> save -> background check -> submit/approve path: the edit is the changed stored lesson, the loader and `run_checks` are the background check, the two gates are the submit/approve decision.)
  3. `real_unlisted_code_typed_on_a_no_code_row_is_blocked`: the double knows `RL.6.7` (non-recorded): blocking.
  4. `recorded_added_code_on_a_no_code_row_passes_the_code_check_and_waits_for_confirmation`: front matter records `RL.6.7` `origin:"added"`, `asserted_by:"generator"`, `confirmation:"open"`, tagged on a teaching routine and a Pulse Check: no `code_not_allowed`; one `standard_confirmation`; `submit_gate` with `open_confirmations: 1` refuses `CONFIRMATION_OPEN`.
  5. `no_code_row_with_null_cfu_code_is_clean`: lesson with plain `Pulse Check` and no tags: no `code_not_allowed`, no `standard_*` finding.
  Update `wp1_lesson4_context` only if its `texts`-call expectations changed (it should not: the tagged `RL.6.1` is already in the union).
- Run S2 now: `npx vitest run evals/src/suites/s2.test.ts`. Expect **only** `s2-clean-lesson` (recipe `clean_reading`) to go red, with a `code_not_allowed` blocking finding for the dangling `RL.6.1` tag (RUNTIME: the exact list comes from the run; any other red S2 case is handled in step 12 the same way, never by editing `evals/cases`).

**Step 5. Front matter delegate and the decision tests.**
- `front-matter-standards.ts`: body becomes `return standards_for_lesson(row, rows, tagged);` (import from `@ls/core/compile/standard-identity`), keep the exported name and signature `build_front_matter_standards(row: NormalizedRow, rows: readonly StandardRow[], tagged: readonly string[] = []): Standard[]` and its doc comment. The ten existing tests must pass unchanged; add `delegates_to_the_core_mapping` (same inputs through both functions give `toEqual` results for a narrowing, an addition and an unknown code).
- `compile-check-node.ts` is **not** edited: it already calls `tagged_codes(compiled.lesson)` (now placeholder-free) and the builder.
- New `alignment/standards-decision.test.ts` (names exact; use `compile_draft` with `template_for`, `standards_for_lesson` with `std_rows()`, the rules from `checks/registry.ts` `CHECK_RULES` through `run_checks`, `gate_state`, `submit_gate`, `approve_gate`):
  - `code_less_row_null_cfu_is_valid`: row `row-wp3.json` (focus []), the `draft-wp3.json` fixture with its `cfu.standard_code` set to `null` and block codes `[]`: compiled heading is plain `Pulse Check`, no `code_not_allowed`, no `standard_not_checked`, no `standard_not_taught`.
  - `null_cfu_code_cannot_satisfy_a_focus_obligation`: row focus `RL.6.1`, every CFU null: `standard_not_checked` for `RL.6.1`.
  - `narrowed_leaf_through_the_shared_mapping`: row focus `L.6.4`; draft tags `L.6.4.b` on the routine and the CFU; `standards_for_lesson` records `L.6.4.b` `narrowed`/`generator`/`open` and drops the parent; checks give only a `standard_confirmation`; no `code_not_allowed`.
  - `added_code_on_a_code_less_row_is_recorded_open`: row focus [] and a draft tagging `RL.6.7` (routine + CFU): recorded `added`, role `focus`, open; no `code_not_allowed`; one `standard_confirmation`.
  - `added_code_on_a_row_with_a_list_is_blocked`: row focus `RL.6.1`, draft tags `RL.6.7`: recorded `added`, role `supporting`; `code_not_allowed` blocks it (R-19: additions only for an empty list).
  - `unknown_code_is_blocked_not_recorded_as_valid`: tag `L.6.3a`: recorded with empty text; `code_not_allowed` blocks.
  - `placeholder_and_lesson_id_never_become_codes`: CFU `"N/A"` and a routine with `["G6.U4.FLEX-1a"]`: no tagged code, `identity_notes` has two `placeholder_code_dropped`.
  - `narrowed_and_added_codes_block_approval_until_confirmed`: with the narrowed case, `submit_gate` and `approve_gate` refuse with `CONFIRMATION_OPEN`; marking the standard `confirmation: "confirmed"` (and `confirmed_by` in `ctx.confirmations`) clears it.

**Step 6. Prompt text, sub-codes in the prompt, repair sentence.** (A new locked hash and prompt version result; say so in the devlog; NL-134's rerun rule applies.)

`packages/prompts/locked/lesson-shape.md`: replace exactly these three paragraphs (find them by their first words) and leave every other paragraph byte for byte:

1. Replace the paragraph beginning `Every focus code on the lesson card must be checked.` with:
```
Every focus code on the lesson card must be checked. The usual check is a cfu_item whose standard_code names the code, spelled exactly as listed on the card (or the sub-code that replaces it, see Sub-codes below). A quick_write that lists the code in its standard_codes also counts as a check of it. One cfu_item, or one quick_write, may name up to two codes, only when its question or task really checks both; for more codes, write more items. A code that is an ELD code does not count toward that limit of two. Listing every code on one item checks none of them. For a cfu_item, standard_codes either stays empty or lists the same codes as its standard_code. If the lesson card lists no standard codes (a Flex Day), do not choose standards yourself: set standard_code to null on every cfu_item and keep standard_codes empty; never write N/A, none or the lesson id as a code.
```
2. After the paragraph beginning `Every focus code must also be taught.` (keep it unchanged) insert a new paragraph:
```
Sub-codes. When the card lists a code that has sub-codes (for example L.6.4 has L.6.4.a and L.6.4.b), the standard data blocks also show those sub-codes. You may teach and check a sub-code instead of the listed code when the lesson card's own plan or notes point to it. Then use the sub-code everywhere you would have used the listed code, spelled exactly as the data block spells it, and give it narrowed in code_origins. A sub-code is a proposal that a reviewer must confirm before the lesson is approved. Use only sub-codes of a code that is on the card, and only codes that appear in the standard data blocks; never invent a code.
```
3. Replace the paragraph beginning `code_origins has exactly one entry` with:
```
code_origins has exactly one entry for each entry of standard_codes: outline for a code listed on the card, narrowed for a sub-code of a listed code. The lesson re-derives each origin from the card, so a wrong entry is replaced, but the number of entries must match. When standard_codes is empty, code_origins is empty.
```
`packages/prompts/locked/repair.md`: in the last paragraph replace `every focus code is the standard_code of some cfu_item` with `every focus code is checked by a cfu_item whose standard_code names it or by a quick_write that lists it`. (Only that clause.)

`lesson-shape-contract.test.ts`: keep the existing phrases except none is removed by the edits above (`set standard_code to null`, `never write N/A`, `does not count toward that limit of two`, `does not count as teaching`, `callout_say`, `up to two codes`, `one entry for each entry of standard_codes` all remain). Add phrases: `Sub-codes.`, `narrowed in code_origins`, `must confirm`, `also counts as a check`, `do not choose standards yourself`, `either stays empty or lists the same codes`. Add `it("no longer forbids narrowing")`: `expect(shape).not.toContain("Do not narrow")`. Also run the whole prompts folder: `locked-contents.test.ts` and `render-repair.test.ts` may pin text; fix a pinned sentence only where it quotes the changed clause.

`draft-node.ts` (extra file; read it first, F1 may have changed nothing here): after `const codes = [...]` and before `const standards = await this.standards.texts(codes)`:
```ts
const idx = await this.standards.index();
const sub_codes = [...new Set(row.focus_codes.flatMap((c) => idx.leaves_of(c)))].filter((c) => !codes.includes(c));
const standards = await this.standards.texts([...codes, ...sub_codes]);
```
(`leaves_of` returns `[]` for a leaf, so only listed parents add rows; ELD and MSLS lists add none.) `JobContext.standards` then also feeds repair and `CompileCheckNode`; both only look rows up by code, so no other edit. `apps/worker/src/generation/nodes/testing/fixtures.ts`: the `standards` double (`{ texts: ... } as unknown as StandardRepo`) gains `index: async () => ({ leaves_of: (c: string) => LEAVES[c] ?? [], text_of: () => null, resolve: () => { throw new Error("unused"); } })` with `const LEAVES: Record<string, string[]> = { "L.6.4": ["L.6.4.a", "L.6.4.b"] }` and `standard_rows(row)` in the same file gains the two leaf rows when the row lists `L.6.4` (copy the shape of the existing rows there). Test `draft-node.test.ts::sub_codes_of_listed_parents_reach_the_prompt`: for the WP-1-style row listing `L.6.4`, the rendered user blocks contain `standard` data blocks for `L.6.4.a` and `L.6.4.b`; for a row that lists only leaves (`RL.6.1`), no extra block. Update any existing draft-node test that asserts the exact `texts` argument.

**Step 7. `teaching_parts` versus evidence (R14).** In `standards-view.ts` keep `teaching_parts` and its private helper unchanged in behaviour, and put above it this comment: `/** S3's "any teaching part" observation and the judge seed: paragraphs only, Literacy Lab and Learning in Action. Production evidence (evidence.ts) also counts Launch and Say callouts and is per routine. The difference is intentional; S3 is the stricter observer here. */`. Test `teaching_parts_differs_from_evidence_only_for_launch_and_say_callouts` in `standards-evidence.test.ts`: (a) a Literacy Lab routine tagged `L.6.4.b` followed by a paragraph: the address is in `teaching_parts` **and** the item is substantiated; (b) a Learning in Action routine whose only text is a Say callout: item substantiated, address **not** in `teaching_parts`; (c) a Launch routine with a paragraph: item substantiated, `teaching_parts` has no Launch address. No S3 file changes.

**Step 8. Slot obligation address (R20).** In `links/slot-obligations.ts` add `import { section_address } from "../../../compile/addresses.ts"` (F1 added it; stop and report if absent) and:
```ts
/** Where the "missing required excerpt slot" finding sits: the stored Learning in Action section, else the address the compiler would give it, else the lesson id. */
export function obligation_address(ctx: CheckContext): string {
  return ctx.lesson.sections.find((s) => s.name === "Learning in Action")?.address
    ?? section_address(ctx.lesson_id, "Learning in Action");
}
```
In `structural/section_missing.ts`, replace the three-line `const where = ... ;` of the closing slot-obligation block by `const where = obligation_address(ctx);` (import it from `../links/slot-obligations.ts`, which is already imported for `excerpt_obligation`). Tests in `slot-obligations.test.ts`: `absent_learning_in_action_locates_the_slot_finding_at_the_canonical_address` (a lesson without the Learning in Action section and a row with an applied writer task: the finding address is `G6.U4.L4.LearningInAction`, the same string `assign_addresses` gives a compiled section; `merge_resolutions` with a recorded resolution at that address and kind `section_missing` marks it resolved) and `stored_learning_in_action_address_wins` (a stored section keeps its own address).

**Step 9. A's residual (R19).** No detection change.
- `name-scan.ts`: extend the existing doc comment above `blank_option_labels` with: `Known residual (2026-10-26, see docs/testing/error-analysis/name-scan-residual-2026-10-26.md): a capitalised plain noun that is the first word after a label, is in no source, and appears in lower case nowhere in the lesson (Length, Preference, Describes) cannot be told from an invented name by the tagger and is flagged. It stays blocking in CFU text: Medusa, Brindle and Quillon fall in the same class and must stay caught. Policy: repair is told the exact word; a reviewer can resolve it; no word list.`
- `surface-forms.test.ts`: change only the title of the test `flags a plain noun the tagger cannot tell from a name when nothing in the lesson uses it` to `documents the residual: ...` keeping its body, and replace its one-line comment by `// Known residual, see name-scan.ts: a limitation, not a correct classification.`
- `name-scan-residual.test.ts` (new; names exact): `residual_words_are_flagged_only_when_nothing_in_the_lesson_uses_them` (for `Length does not matter.`, `Preference is not evidence.`, `Describes the setting only.` after `B. Incorrect: `: flagged with an empty index; not flagged when a lowercase use exists in the field texts); `invented_names_stay_flagged_in_the_same_position` (Medusa, Brindle, Quillon flagged in the same frame: the reason no blanket exemption is possible); `residual_finding_is_resolvable_by_a_named_reviewer` (build a `proper_noun_unsourced` finding with `proper_noun_unsourced_rule.run` on `build_ctx("wp1", { mutate })` whose first CFU rationale is `Length does not matter.`; `merge_resolutions([f], [{ kind: "proper_noun_unsourced", address: f.address, code: f.code }])[0].resolved` is `true`; `NON_RESOLVABLE` from `../../gates.ts` does not contain `proper_noun_unsourced`; read how `name-scan.test.ts` builds `planted()` and `run()` and copy that); `finding_carries_the_exact_word_for_repair` (`f.code` is `Length`).
- Doc `docs/testing/error-analysis/name-scan-residual-2026-10-26.md` (about 40 lines): **Words:** Length, Preference, Describes. **Context:** the first capitalised word after a stripped rationale label (`B. Incorrect: <Word> ...`) in a CFU rationale, absent from every source, and with no lowercase occurrence in the lesson's own fields or the sources; the tagger (`compromise`) has the word in no name lexicon and tags it like `Medusa`. **Evidence:** commit `6cc5e07` test `names_after_labels` (the lesson's own lowercase use clears all three; with none, `Length` is flagged); replay `docs/testing/error-analysis/replay-2026-10-26.md` shows `proper_noun_unsourced` in 0 of 47 final drafts and 1 of 47 initial drafts (which word is **not recorded**: RUNTIME, to be added from the corrected replay that prints `matched`, handoff section 3 item 4). **False-positive / missed-name:** the same position holds both (`Length` false positive; `Medusa`, `Brindle` missed-name guard). **Policy:** keep blocking where the checker blocks today (CFU choices); do not downgrade by word class because the classes coincide; do not add a whitelist; generation: the finding gives repair the exact word; review: the finding is resolvable (`NON_RESOLVABLE` excludes it) with a named person's recorded resolution. **Reassessment of blocking impact:** measured impact on the only stored run is 0 final drafts; a severity change is not warranted by that number; reopen if a real run's final drafts show any of the three words blocking (record the count then). **Not covered:** names later in a sentence, which the existing tests cover.

**Step 10. Round trip (R4).** New `packages/ydoc/src/evidence-roundtrip.test.ts` (imports `lesson_to_ydoc`, `ydoc_to_lesson` from `./convert.ts`, `read_evidence` from `@ls/core/checks/rules/alignment/evidence`, `compile_draft`, `template_for`, `StoredLesson`, `ExportedLessonRecord` from `@ls/schema/export` if it parses a full record, else `StoredLesson` only). Tests (names exact):
- `compiled_wp1_evidence_survives_the_yjs_round_trip`: compile `packages/core/tests/fixtures/draft-wp1.json` with `row-wp1.json` (`unit_id: "G6.U4"`, `schema_version` from `SCHEMA_VERSION`), set `front_matter.standards` with `standards_for_lesson`; `read_evidence(ydoc_to_lesson(lesson_to_ydoc(lesson), lesson.schema_version))` `toEqual` `read_evidence(lesson)`.
- `edited_heading_text_round_trips_with_the_tag`: change one routine heading's text node to a new title keeping the ` (RL.6.1)` suffix, round trip: same items except nothing changes.
- `export_bundle_keeps_the_evidence`: `JSON.parse(JSON.stringify(lesson))` parsed by `StoredLesson.parse` gives the same `read_evidence`.
These prove: edit (text change), save (Yjs encode/decode), export (JSON + schema parse) leave coverage unchanged, and that no persistence field was added.

**Step 11. Matrix rows, devlog, area map (rule `context-maintenance`).**
- `docs/design/code-design.md` section 10a: replace the three lines beginning `| CM-2 `, `| CM-3 ` and `| CM-4 ` (F1 wrote them as skeletons with `F2 fills` cells; each stays on one line, seven cells). Use exactly these (shown wrapped here; write each as one line):

`| CM-2 Teaching and assessment evidence. Status: filled (F2) | Brief ("aligned to teach the CA Core ELA/ELD standards"); PRD R-15, R-20, V-2; worked pairs WP-1/WP-2 "Alignment map" (taught_in / checked_in per code; WP-1 checks RL.6.1 by a Quick Write in Look Back); `docs/source/04` section 4. The two-code cap is slice D's engineering rule D-6 (no brief or PRD source) and a structural plausibility bound, not proof that an item tests a skill | Code, kind, activity, address, ordinal, tag codes and "is the activity really there": `checks/rules/alignment/evidence.ts` `read_evidence` (one reader). Codec: `compile/standard-tags.ts` (`parse_tag`, `format_tag`). Typed links: `alignment_link` rows from `alignment/derive.ts` | Heading tag text is a codec, never a classifier: kind comes from the `icon` attribute and the `Quick Write` label. Placeholder tokens (`N/A`, lesson ids) are not codes. Evidence belongs to the tagged heading's own span (next routine/part heading). No persistence field added; old untagged documents read as having no evidence | prompt: `lesson-shape.md` (routine_heading carries the teaching code, cfu_item or quick_write the check). compiler: `nodes.ts` writes tags via `format_tag`. check: `standard_not_taught`, `standard_not_checked`, `code_not_allowed`, `derive_alignment`, `standard_add_suggestion`. report/eval: S3 `cfu_tags` (Pulse Check only) and `teaching_parts` (paragraphs, two sections) are deliberately narrower observations | Same rule at every stage: generation (repair feedback), background check, reviewer edit, submit, approve; blocking; resolvable by a named person | `alignment/{evidence,standards-evidence,standards-decision}.test.ts`; `packages/ydoc/src/evidence-roundtrip.test.ts` (edit/save/export). Not equivalent: S3 `taught_and_checked` accepts any teaching part and a Pulse Check; a corrected S3 observer is request R-F2-2 |`

`| CM-3 Standard identity and provenance. Status: filled (F2) | PRD R-4, R-20 (origin, asserted_by), HP-3; WP-1 section A (listed parent, proposed leaf) | One mapping: `compile/standard-identity.ts` (`split_code_list`, `clean_codes`, `classify_code`, `standards_for_lesson`, `identity_notes`). `Standard` in `front_matter.standards` is the stored form; `apps/worker/.../front-matter-standards.ts` delegates | Origin is derived from the pinned row and the official rows, never from the model's `code_origins` (a claim, reported by `identity_notes`). `cfu.standard_code` is a comma/semicolon list parsed in one function; a cfu_item whose `standard_codes` and `cfu.standard_code` both name codes and differ fails the draft schema. Wire format unchanged | prompt: `lesson-shape.md`. schema: `lesson-draft.ts`. compiler: `nodes.ts`, `compile_draft` (`identity_notes`). worker: `CompileCheckNode`. check: `code_not_allowed`, `standard_confirmation`. | Generation and every later stage use the stored `Standard` entries | `standard-identity.test.ts`, `front-matter-standards.test.ts`, `lesson-draft.test.ts`, `compile-draft.test.ts` |`

`| CM-4 Empty lists, narrowed and added standards. Status: filled (F2) | PRD R-19, R-20 and HP-3 option B (PD-6): a code is listed, a leaf of a listed parent (`narrowed`) or proposed for an empty list (`added`); narrowed and added block Approve until a named reviewer confirms; WP-1 `L.6.4.b`, WP-2 writing leaves, WP-3 optional `RL.6.7`; `N/A` and lesson ids are never codes | Prompt offers sub-codes of listed parents (`draft-node.ts` loads `leaves_of`); `standards_for_lesson` records narrowed/added with an open confirmation; `code_not_allowed` accepts recorded narrowed/added and blocks unknown or unlisted codes; gates refuse `CONFIRMATION_OPEN` | A null `cfu.standard_code` is valid on a code-less row and cannot satisfy a focus obligation. Additions are accepted and confirmed but not solicited: the draft prompt has no catalogue to propose from (request R-F2-1) | prompt `lesson-shape.md` + `repair.md`; schema nullable code; compiler; loader (always looks up tagged codes); checks; approval gates | Generation, background check, reviewer edit, submit, approve | `standards-decision.test.ts`, `context-loader.test.ts::tagged_codes_are_always_looked_up`, `code-not-allowed.test.ts`, `draft-node.test.ts` |`

- `docs/devlog/2026-10-26-contract-f2.md` (Changed, Why, Checked, Remaining; about 100 words): decisions F2-D1 to F2-D8, "new prompt version at next start (NL-134 rerun rule)", "nothing re-measured with a model; no alignment verified by a person or judge", and requests R-F2-1 to R-F2-3.
- `.claude/reference/area-map.md`: append to the A5 row `standard-identity.ts`; to the A6a row `rules/alignment/evidence.ts` (single evidence reader), `NL-CONTRACT-F2`.

**Step 12. S2 setup correction (separate commit, recorded).** Only after steps 1 to 11 are committed and S2 was run in step 4.
1. In `alignment/test-support.ts` (already committed in the first commit) add `export function clean_reading_ctx(): CheckContext`: `const base = make_ctx(reading_lesson());` take `base.lesson`; in its `Learning in Action` section rename the first `routine_heading` whose text is `Close reading` (F1's `reading_lesson()`) to `Close reading (RL.6.1)` (edit its single text node; the step 0 grep proved it exists); set `front_matter.standards` to `[rec("RL.6.1")]`; return `{ ...base, lesson, row: { ...base.row, focus_codes: ["RL.6.1"] }, standards: std_rows() }`. Add the test `clean_reading_ctx_has_zero_blocking_findings` to `standards-decision.test.ts` (`run_checks(clean_reading_ctx(), CHECK_RULES, DEFAULT_POLICY).blocking === 0`). If it reports a blocking finding other than the standards kinds, fix `clean_reading_ctx` (setup only), not a rule.
2. Second commit, only `evals/src/suites/s2-fixtures.ts` and `docs/devlog/2026-10-26-contract-f2-s2-correction.md`: change `clean_reading: () => make_ctx(reading_lesson()),` to `clean_reading: () => clean_reading_ctx(),` and add `clean_reading_ctx` to the existing import from `@ls/core/checks/rules/alignment/test-support`. If step 4's S2 run showed other red cases, correct each recipe the same way (give it the catalogue and a listed, recorded, taught code) and list it in the record.
3. The record (devlog, ~120 words): **Authority** handoff section 2 last bullet ("correct its setup under the recorded contract procedure rather than retaining a production validation hole") and F2-D7. **Scope** one recipe line(s) in `s2-fixtures.ts`; no change to `evals/cases/s2/*.json`, no expectation, assertion, threshold or floor. **Why** the recipe built a lesson with a tagged Pulse Check, no listed code, no recorded code and an empty catalogue, which `code_not_allowed` accepted only through the bypass; the correct clean lesson lists RL.6.1, records it, teaches it, checks it and carries the catalogue. **Checked** `npx vitest run evals/src/suites/s2.test.ts` (28 of 28 expected, as D reported) and `evals/src/suites/s1.test.ts`.

## 6. Data and fixtures

Synthetic only, existing files: `packages/core/tests/fixtures/{row-wp1.json,row-wp3.json,draft-wp1.json,draft-wp3.json}`, `packages/llm/src/fixtures/draft-wp{1,1-repaired,2}.json`, `apps/worker/test/fixtures/stub-drafts/wp-{1,2}.json`, `packages/ydoc/tests/fixtures/stored-wp1.json`, `packages/core/src/checks/rules/grounding/fixtures/build.ts` (`build_ctx`), `evals/cases/drafts/wp-*/expected.json` (read only, the independent oracle for WP-1/WP-2: `focus_codes[].taught_in/checked_in`, `origin_expected`). Facts checked: all six good/stub drafts above have a `teacher_talk` block directly after each tagged `routine_heading`, so the span rule keeps them clean; `draft-wp3.json` (core fixtures) is a code-less Flex row whose CFU carries `RL.6.7` (use it only after setting that to `null` where a test says so); `good-wp-3.json` (evals) tags `RL.6.7` as `added`. Inline invented codes: `ZZ.9.9`, `RL.9.99`, `ELD.PI.9.9`, `L.6.3a`. Real codes used from the official form: `RL.6.1`, `L.6.4.b`, `W.6.2.a`, `ELD.PI.6.6b`. Do not read `docs/source/restricted`, the seeded-error key or any `.env`. The oracles for the new tests are the worked pairs and the PRD rows named in section 1, written by hand in the tests, not generated from `templates.ts` or from the new functions.

## 7. Checks

While iterating (affected tests only):
```sh
npx vitest run packages/core/src/compile
npx vitest run packages/core/src/checks
npx vitest run packages/schema
npx vitest run packages/prompts
npx vitest run packages/ydoc/src/evidence-roundtrip.test.ts packages/ydoc/src/convert.test.ts
npx vitest run apps/worker/src/generation apps/worker/src/wiring apps/worker/src/judge
npx vitest run evals/src/suites/s1.test.ts evals/src/suites/s2.test.ts evals/src/suites/s3-assertions.test.ts evals/src/suites/s3.test.ts evals/src/suites/s3-guards.test.ts evals/src/suites/s3-report.test.ts evals/src/suites/s4.test.ts evals/src/suites/s6.test.ts evals/src/suites/s7.test.ts
```
Must stay green (expectation edits only the ones named): `compile/{compile-draft,compile-contract,labels,part-labels,templates,addresses}.test.ts`, every `checks/rules/**` test (F1's structural tests included), `checks/{gates,registry,run-checks,policy}.test.ts`, `apps/worker/src/wiring/check-parity.test.ts`, `apps/worker/src/generation/nodes/*.test.ts`, `apps/worker/src/judge/judge-capture.test.ts` (uses `teaching_parts`), S1 12/12, S2 28/28 (after the step 12 commit), the S3 stub cases. Other tests that build a context with a tagged code and no catalogue will now show a `code_not_allowed` finding (RUNTIME: find them by running the folders above and `apps/worker/src/checks`; candidates are `checks/registry.test.ts`, `checks/run-checks.test.ts`, `apps/worker/src/generation/nodes/testing/fixtures.ts` users, `evals/src/suites/s7-support.ts`). Fix each by giving the **test context** the catalogue and a listed, recorded code (a helper in `alignment/test-support.ts`), never by weakening the rule; list each file in the report. Database tests (`*.int.test.ts`) run only if Postgres is up; otherwise report them as "not run".

Once before the final commit (cheapest first):
```sh
npx eslint packages/core/src packages/schema/src packages/prompts/src packages/ydoc/src apps/worker/src/generation apps/worker/src/wiring
npm run typecheck --workspace @ls/core
npm run typecheck --workspace @ls/schema
npm run typecheck --workspace @ls/prompts
npm run typecheck --workspace @ls/ydoc
npx tsc -p apps/worker/tsconfig.json --noEmit
npm run typecheck --workspace @ls/evals
npx vitest run packages/core/src/compile packages/core/src/checks packages/schema packages/prompts packages/ydoc apps/worker/src/generation apps/worker/src/wiring apps/worker/src/judge
```
Full suite: not run by the implementer. Why it is needed before deploy: the locked prompt hash changes, `CfuItemDraft`-adjacent schema validation changes, and `code_not_allowed` is stricter for every context; the orchestrator runs it once before the next deploy. Passing means: every named test exists and passes; S1/S2/S3/S4 pass with no change to `evals/cases/**`; `git diff --stat -- evals` shows exactly `evals/src/suites/s2-fixtures.ts` (second commit); no new lint or type errors.

Commits (four): (1) core, schema, worker delegate, tests, matrix rows (steps 1 to 5, 7 to 11); (2) prompt and draft-node (step 6; the locked hash changes here only); (3) the S2 setup correction (step 12); docs-only items may ride with (1). Do not squash (3) into another commit.

## 8. Risks and requests

- **Replay and pass-rate shift (RUNTIME, expected shape).** Per-activity evidence is stricter than address-level evidence, the loader now loads tagged codes, and the draft schema rejects a disagreeing cfu_item. On the 47 stored attempt-3 drafts expect: unchanged or slightly more `standard_not_taught` ("no teaching text follows that heading"); possibly a few new `schema_invalid` for disagreeing cfu codes; no change in `proper_noun_unsourced`. Whatever the numbers, none of the work is dropped; report them as current-code reanalysis, attributed to F2 separately from F1 (handoff section 3 items 4 and 5).
- **New prompt version.** Editing `lesson-shape.md` and `repair.md` changes `locked_hash`; old pinned jobs raise `LockedLayerMismatch` (expected; handoff section 5 item 6). Queued old jobs must be finished with their own artifact first (orchestrator).
- **R-F2-1 (product follow-up, not blocking).** Additions are not solicited on code-less rows because the prompt has no catalogue to propose from, and a reviewer cannot add a real code to a code-less row (the "add?" advisory exists only for leaves of listed parents). To make HP-3's "generator proposes for an empty list" real, the draft prompt needs a candidate list for empty-list rows (a `StandardRepo` listing method and a size decision) and a reviewer add path. Owner: Innocent decides if wanted; recommendation: defer, because WP-3 marks RL.6.7 `optional_added`.
- **R-F2-2 (evals owner; contract correction, not made here).** `s3-observe.ts`/`s3-assertions.ts` should (a) count a Quick Write as a check (WP-1 `checked_in: Look Back`) using `assessment_codes`, (b) enforce `taught_in`/`checked_in` using `read_evidence` addresses, (c) tighten `origin_present` for narrowed leaves now that narrowing is offered. `expected.json` and the 1.0 floor stay; until then S3 is stricter than production on checks and looser on locations.
- **R-F2-3 (escalation).** If measurement shows reviewers removing tags or renaming headings so that coverage disappears, the next step is a typed `standards` attribute on `routine_heading` through a `CHG` plus an `editor-schema` bump; not planned now.
- **Collisions.** `compile/nodes.ts` and `compile-draft.ts` (F1 does not edit them), `alignment/**`, `links/**`, `code_not_allowed.ts` are F2's. `section_missing.ts` (F1's) gets one call-site edit after F1 merged. `testing/fixtures.ts` is also edited by F1 (the `draft` fixtures); F2 edits only the `standards` double and `standard_rows`. `docs/design/code-design.md` section 10a: F2 replaces only CM-2 to CM-4 (single lines). `test-helpers.ts` is F1's and is not edited here.
- **Latent issues seen, not fixed here.** (1) F1 keeps fixture section addresses on the legacy slug `LearninginAction`; the S2/S7 correction is R-F1-2. (2) `homework` and `paragraph` both compile to plain paragraphs (F1 matrix note). (3) `Standard.role` for an `added` code on a row with a list is `supporting`; that is the slice D rule and is kept. (4) The cap counts content codes by catalogue; an MSLS code counts as content.
- **Spec gap.** HP-3 says additions apply "per list" (U7(b)), including empty ELD lists; this slice records them if present but solicits none (R-F2-1).

## 9. Readiness

**READY.** No `NEEDS-DECISION` for Innocent: F2-D3 follows PRD R-19/R-20 and HP-3 (decided, PD-6); F2-D6 follows WP-1 and PRD V-2; the cap (F2-D4) is documented as an engineering choice. Open items: R-F2-1 is a recorded product follow-up (no obligation depends on it); the replay shift and the list of tests that need a catalogue are `RUNTIME` (counts only a run can give; every step and test above stays). Conditions: (1) F1 is merged first (step 0 checks it; stop and report if `section_address` or the `Close reading` routine is missing); (2) the orchestrator approves the extra files in section 2, in particular `draft-node.ts` and `repair.md` (without them the prompt cannot offer sub-codes and the locked text would disagree with the checker); (3) the S2 correction goes in its own commit with the record.

## Deviations

- **D1 (step 1 test).** The plan said `G6.U4.L4` is code-shaped. `CODE = /^[A-Z]{1,5}(?:\.[A-Za-z0-9]+)+$/` requires letters only before the first dot, so it is not. The test asserts `false` (title `a_lesson_id_is_filtered_by_identity_whatever_its_shape`). `is_placeholder_code` still runs before shape everywhere, so behaviour is as planned.
- **D2 (step 9 test).** The plan said the residual finding's `code` is the word. The finding carries the exact word in `matched` (`code` is `null`; the resolution key is address + null code). `finding_carries_the_exact_word_for_repair` asserts `matched === "Length"`; the resolvable test records the resolution with the finding's own `code`.
- **D3 (step 3 test support).** `std_rows()` also gets `ELD.PI.6.10` and `ELD.PI.6.7` rows (not only `ELD.PI.6.6b.Em`): the existing test `eld_codes_do_not_count_toward_the_two_code_limit` names them, and under F2-D4 an ELD code is recognised only through the catalogue.
- **D4 (step 2 hash test).** No hash was pinned in `compile-draft.test.ts`; the literals for wp1, wp3 and wp4 were computed from the unmodified compiler at `a554848` (temporary detached worktree) and written into `plain_drafts_compile_to_the_same_hash`.
