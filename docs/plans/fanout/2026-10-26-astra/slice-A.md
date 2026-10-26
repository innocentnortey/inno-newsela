# Slice A: checker and compiler parity, and source trust

Plan for `fanout-implementer` (Sonnet). Date 2026-10-26. Base `main` e7e72a3 plus the **uncommitted grounding edits that must be preserved** (see section 2). Readiness: **READY** (section 9). Plan path: `docs/plans/fanout/2026-10-26-astra/slice-A.md`.

## 1. Goal and sources

Make the generator, compiler and checker agree, and stop a generated text card from approving its own names, quotations and page ranges. Four deliverables:

1. Finish and harden the pending label-normalisation (`name-scan.ts`) and page-parser (`page-refs.ts`) corrections.
2. Make `schema_invalid` read the compiler's canonical rationale representation (`B. Incorrect: ...`) through **one shared label contract** used by both the writer and the reader.
3. Delete the rationale-specific generation bypass in `apps/worker/src/wiring/generation.ts` once full-check parity is proved; keep the rest of that filter and say why.
4. Build the grounding source set from the pinned outline row, arc header and official standards text only. A text card (generated or edited) contributes nothing to it.

Sources (read before building):
- `docs/delivery/2026-10-26-astra-fix-handoff.md`, sections *Fix the compiler and checker disagreement first*, *Prevent generated source cards from validating themselves*, *Execution and evidence order* (step 2: land the narrow corrections and parity, then close source-card self-authorisation, before trusting any improved pass rate).
- `docs/testing/error-analysis/astra-audit-2026-10-26.json` (attempt 3: 15 false name blocks, 2 false page blocks, 27/30 stored-ready lessons with `schema_invalid`).
- `docs/plans/fanout/2026-10-26-astra/slice-C.md` (asks of slice A in its section 8: R-A1, R-A2).
- Code: `packages/core/src/checks/rules/structural/schema_invalid.ts`, `packages/core/src/compile/{nodes,labels,compile-draft}.ts`, `packages/core/src/checks/{context-loader,types,gates}.ts`, `packages/core/src/checks/rules/grounding/*.ts`, `apps/worker/src/wiring/generation.ts`, `apps/worker/src/generation/nodes/compile-check-node.ts`, `apps/collab/src/commands/submit-gate.ts`, `apps/worker/src/checks/check-job-runner.ts`.

## 2. Boundary

**Preserve first.** The working tree already holds uncommitted edits in `packages/core/src/checks/rules/grounding/{finding,name-scan,page-refs,page_out_of_range,proper_noun_unsourced,sources}.ts` and `packages/core/src/checks/types.ts`, plus the untracked `surface-forms.test.ts`. Edit them **in place**. Never run `git checkout`, `git stash`, `git reset`, `git clean` or `git restore` on any of them; never delete or recreate `surface-forms.test.ts`. Also leave the untracked `evals/src/zz-*.mts` and `docs/` files alone. `evals/src/zz-replay.mts` imports `generation_rules` from `@ls/worker/wiring/generation`: **keep that export name and path**.

**Owned (create / modify):**

| Path | Action |
|---|---|
| `packages/core/src/compile/labels.ts` | modify: add rationale label contract (section 4) |
| `packages/core/src/compile/nodes.ts` | modify: `cfu_item` builds the label with `rationale_label` (same output string) |
| `packages/core/src/compile/compile-draft.ts` | modify comment only: `text_cards` is model-proposed and not a grounding source |
| `packages/core/src/compile/labels.test.ts` | create |
| `packages/core/src/checks/rules/structural/schema_invalid.ts` | modify |
| `packages/core/src/checks/rules/structural/schema-invalid.test.ts` | modify (add tests) |
| `packages/core/src/checks/rules/grounding/{name-scan,page-refs,sources,finding,page_out_of_range,proper_noun_unsourced,quote_unmatched}.ts` | modify (pending edits are the starting point) |
| `packages/core/src/checks/rules/grounding/surface-forms.test.ts` | modify (extend; keep every existing test unless a step below says it changes) |
| `packages/core/src/checks/rules/grounding/source-trust.test.ts` | create |
| `packages/core/src/checks/types.ts` | modify comments only (the `matched` comment; `text_cards` comment). Do not change any type |
| `packages/core/src/checks/context-loader.ts` | modify comment only on `text_cards` line (loader behaviour and the returned key set stay identical so `context-loader.test.ts` stays green) |
| `apps/worker/src/wiring/generation.ts` | modify: the check-wiring block only (lines 41 to 61: constants, `generation_rules`) |
| `apps/worker/src/wiring/check-parity.test.ts` | create |

**Read only (shared surfaces):** `packages/schema/**` (`TextCardRecord`, `StoredLesson`, `LessonDraft`), `packages/editor-schema/**`, `packages/core/src/checks/{gates,registry,policy}.ts`, `packages/core/src/checks/test-helpers.ts`, `packages/core/tests/fixtures/**`, `apps/worker/src/generation/nodes/**`, `apps/collab/**`, `packages/db/**`, `packages/prompts/**`.

**Must not touch (other slices):**
- Slice B: `evals/**`, `packages/db/**` (including `packages/db/src/repos/runs.ts`). No overlap with this slice's files.
- Slice C: `apps/worker/src/generation/nodes/repair-node.ts`, `packages/prompts/**` (including `locked/*.md`, `src/render.ts`), `generation-context.ts`.
- Slice D (runs AFTER this slice): structure, alignment, slot obligations. Do not change `standard_not_taught`, `section_missing`, `templates.ts`, `addresses.ts`, block code/origin carrying in compile, or `front-matter-standards.ts`. D will build on this slice's `labels.ts`, `nodes.ts` and `schema_invalid.ts`.
- Slice E (standards): the `code_not_allowed` suppression stays (section 5, step 9).

## 3. Requirements table

| # | Requirement (source) | Implementation | Verification |
|---|---|---|---|
| R1 | Genuine invented name **first and later** after a label still fails; ordinary words after labels do not (handoff Acceptance; audit: Nothing, Switching, Copying, Too, Retelling, Dismissive) | Keep `blank_option_labels` in `name-scan.ts`; widen the letter class to `[A-Za-z]`. Known limit, decided (D-1): a name that is first after a label is flagged only when `compromise` recognises it as a person, place or organisation, exactly as for any sentence-initial word without a label | `surface-forms.test.ts::names_after_labels` (section 5, step 2) |
| R2 | Pages immediately outside range rejected; observed page formats accepted | Keep the pending `page_re` (bracketed quote between page and dash; "top of" before the second page); keep `extract_bare_pages`; add explicit boundary tests | `surface-forms.test.ts::page_boundaries` |
| R3 | Mixed chapter notation and chapter lists, no broad whitelist | Rewrite the chapter reader as a list reader (step 3): "and", "&" and "," make separate chapters; "-", "to", "through" make a range; later items must use the same notation as the first; words up to forty | `surface-forms.test.ts::chapter_lists`, `::chapter_notation` |
| R4 | `schema_invalid` understands the compiler's rationale (`B. Incorrect: ...`), keeps exactly-one-correct and one-rationale-per-option | One label contract in `compile/labels.ts` (`rationale_label`, `parse_rationale_label`), used by `nodes.ts` and `schema_invalid.ts` (steps 4 to 6). Structured field **not** adopted (D-2) | `schema-invalid.test.ts::compiled_*`, `labels.test.ts::*` |
| R5 | Unmodified compiled WP-1 gives no false `schema_invalid` (handoff: four false findings today) | Same | `schema-invalid.test.ts::compiled_wp1_has_no_findings` |
| R6 | Remove the rationale-specific generation bypass after parity | Step 9 | `check-parity.test.ts::*` |
| R7 | Same content hash gives the same findings in generation, background check and submission | Test through the real `CheckContextLoader` and the three rule-set shapes (step 10) | `check-parity.test.ts::same_hash_same_findings` |
| R8 | Source set = pinned outline plus independently supplied or reviewer-approved records; generated cards cannot expand it (names, quotations, page ranges) | `build_sources` stops reading `ctx.text_cards`. Outline row, arc header and official standards text remain. Provenance entries are returned (step 7) | `source-trust.test.ts::forged_card_*` |
| R9 | Forged `Medusa` / `p. 999` card reproduction cannot clear findings | Same | `source-trust.test.ts::forged_card_cannot_clear_name_and_page` |
| R10 | Quotation path, source provenance, edits to a source record | Same | `::forged_card_title_cannot_license_quote`, `::source_entries_have_trusted_origins`, `::editing_cards_changes_nothing` |
| R11 | Legitimately supplied metadata still works | Names, authors and pages in the outline row (`text_set`, `title`, `pages`, `homework`, segments) and the arc header keep working. D-3 records why a card alone is not a supply channel | `::outline_supplied_metadata_still_grounds` |
| R12 | A visible reviewer resolution route remains | No code change: `proper_noun_unsourced`, `page_out_of_range`, `quote_unmatched` stay resolvable (`gates.ts` `NON_RESOLVABLE` does not list them). Prove it | `source-trust.test.ts::reviewer_resolution_clears_forged_card_findings` |
| R13 | Same boundary for drafting, repair, background checks and approval | All four paths reach grounding only through `CheckContextLoader.load` then `build_sources`. One choke point; plus a guard that no grounding rule reads `text_cards` | `source-trust.test.ts::no_grounding_rule_reads_text_cards`, `check-parity.test.ts::forged_card_same_in_all_paths` |
| R14 | Slice C asks (R-A1): fix the "never stored" comments | Step 8 | read in review; no test |

## 4. Shared code to use (copied from current code)

```ts
// packages/core/src/checks/types.ts (unchanged shapes)
export type CheckRule = { readonly kind: CheckKind; readonly level: IssueLevelName; run(ctx: CheckContext, policy: CheckPolicy): CheckFinding[]; };
export type CheckFinding = { kind: CheckKind; level: IssueLevelName; message: string; address: string | null; span_anchor: string | null;
  related_lesson_id: LessonId | null; code: string | null; matched?: string; };
// CheckContext carries: lesson, row: NormalizedRow, arc_header: string | null, standards: StandardRow[], text_cards: TextCardRecord[], ...

// packages/core/src/checks/rules/grounding/finding.ts
export function make_finding(kind: CheckKind, level: IssueLevelName, message: string, address: string | null, matched?: string): CheckFinding

// packages/core/src/checks/rules/grounding/name-scan.ts
export type NameIndex = { S: Set<string>; L: Set<string> };
export function build_name_index(source_texts: string[], field_texts: string[]): NameIndex
export function blank_option_labels(text: string): string
export function scan_names(raw_text: string, index: NameIndex): string[]

// packages/core/src/checks/rules/grounding/page-refs.ts
export type Range = { from: number; to: number };
export type Ref = { kind: "page" | "chapter"; from: number; to: number; match: string };
export function extract_refs(text: string): Ref[]
export function extract_bare_pages(text: string): Range | null
export function ref_in_range(ref: Ref, ranges: Range[]): boolean

// packages/core/src/checks/rules/grounding/sources.ts (today)
export type Sources = { texts: string[]; ranges: { page: Range[]; chapter: Range[] } };
export function build_sources(ctx: CheckContext): Sources

// packages/core/src/checks/gates.ts
export function merge_resolutions(findings: readonly CheckFinding[], recorded: readonly RecordedResolution[]): GateIssue[]
export function submit_gate(state: GateState): GateDecision
// RecordedResolution = { kind: CheckKind; address: string | null; code: string | null }

// apps/worker/src/wiring/generation.ts (today)
export function generation_rules(rules: readonly CheckRule[]): CheckRule[]

// compile: packages/core/src/compile/compile-draft.ts
export function compile_draft(draft: LessonDraft, ctx: CompileContext): CompiledLesson
// CompileContext = { row: NormalizedRow; template: SectionTemplate; unit_id: UnitId; schema_version: number }
// packages/core/src/compile/labels.ts today: export const CORRECT = "Correct:"; export const INCORRECT = "Incorrect:";
```

Test fixtures and helpers that exist: `build_ctx(name: "wp1"|"wp2"|"wp3"|"wp4", opts: { grid?; mutate?: (draft: LessonDraft) => void })` and `load_draft(name)` in `packages/core/src/checks/rules/grounding/fixtures/build.ts` (compiles the real draft with the issued outline); `make_ctx`, `reading_lesson`, `cfu_item`, `finding`, `gate_state`, `DEFAULT_POLICY` in `packages/core/src/checks/test-helpers.ts`; drafts `packages/core/tests/fixtures/draft-wp{1,3,4}.json` and `.../grounding/fixtures/draft-wp2.json`; row `packages/core/tests/fixtures/row-wp1.json` (title "The Lightning Thief, Chapter 1", pages "pp. 1-8"). In the WP-1 draft, `blocks[16]` is a `cfu_item` and `blocks[1]` is plain text (the existing `plants.test.ts` and `name-scan.test.ts` mutate exactly these). Loader doubles: copy the `build()` helper pattern at `packages/core/src/checks/context-loader.test.ts` lines 70 to 145.

**New contract to add in `packages/core/src/compile/labels.ts` (exact names):**

```ts
export type RationaleLabel = { letter: string | null; correct: boolean; body: string };
/** "B. Incorrect:" for option index 1; "A. Correct:" for index 0 when correct. The only writer of the label. */
export function rationale_label(index: number, correct: boolean): string;
/** Reads a CFU rationale paragraph's text. Returns null when the paragraph does not start with a rationale label. */
export function parse_rationale_label(paragraph_text: string): RationaleLabel | null;
```

## 5. Steps

Work in this order; run the named tests after each step.

**Step 1. Inventory (no edits).** Run the baseline: `npx vitest run packages/core/src/checks packages/core/src/compile`. Note any failure; the pending tests (surface-forms, name-scan, plants, clean-drafts) pass today (4 files, 37 tests per the handoff). Anything else red at the start is not yours; report it.

**Step 2. Names after labels (`name-scan.ts`).**
- Change `OPTION_LABEL` letter class from `[A-Da-d]` to `[A-Za-z]` (a CFU may have more than four options). Keep the rest of the pattern.
- Do not add any word list. Do not touch `allow-list.ts`.
- Decision D-1 (verified by a probe with the installed `compromise` 14.19.0, 2026-10-26): with the label blanked, `Grover`, `Athena`, `Kevin` as the first word are tagged as people and are flagged by the existing sentence-initial pass; an unknown invented name such as `Medusa` or `Zeus` as the first word is **not** tagged (it is also not flagged without a label; it is a property of sentence-initial words). The same names mid-sentence are flagged. Write tests with names `compromise` knows for the "first" case, and `Medusa` for the "later" case. Record the limit in a comment above `blank_option_labels` and in section 8.
- Add to `surface-forms.test.ts` a `describe("names_after_labels")` with: `"B. Incorrect: Grover would wait."` flags `["Grover"]`; `"B. Incorrect: Athena would wait."` flags `["Athena"]`; `"C. Incorrect: Waiting is what Medusa would do."` flags `["Medusa"]` (already present: keep); `"E. Incorrect: Switching books is hard."` flags nothing (letter E); a multi-paragraph text where the label sits on the second line (`"A. Correct: Percy fights.\nB. Incorrect: Nothing suggests care."`) flags nothing; and a round-trip test: for `i` in 0..5 and both correctness values, `blank_option_labels(rationale_label(i, c) + " Switching")` trimmed equals `"Switching"` (import `rationale_label` from `../../../compile/labels.ts`; add it after step 4 exists, or order this test after step 4).

**Step 3. Page and chapter reading (`page-refs.ts`).**
- Pages: keep the pending `page_re` unchanged. Keep `extract_bare_pages` and its use in `sources.ts`.
- Numbers: replace the hand-written `NUM_WORDS` / `NUM` with values generated from one table that covers one to forty (units one to nineteen, tens twenty to forty, hyphenated "twenty-one" through "thirty-nine"). Build the regex alternation from the keys sorted longest first so "twenty-two" wins over "twenty". `to_num` stays.
- Chapters become a list reader. Algorithm (invariants in brackets):
  1. Find a head with `/\b(?:chapters?|chs?)\.?\s*/gi` followed by a first item (a number, or a number, a range operator and a number). [Same trigger words as today.]
  2. An **item** is `NUM` or `NUM <op> NUM` with `<op>` one of `-`, `–`, `—`, `to`, `through`. A range item gives one `Ref` with `from`/`to` (swap if reversed). [A range means every number between is claimed.]
  3. After an item, continue the list only if the next text is a separator `,`, `, and`, `and` or `&` (any spaces) followed by another item. Each later item gives its **own** `Ref`. [An "and" list names separate chapters. "Chapters 3 and 5" claims 3 and 5, not 4. This replaces the pending code that read "and" as a range.]
  4. A later item is dropped, and the list ends, if (a) it uses a different notation from the first item (digits against words), or (b) it is followed by `\s+(?:other|another|more|additional|further)\b`. [Fixes "Chapter 15 and one other text" and "Chapter 15 and 3 other texts"; mixed notation is never guessed.]
  5. Every `Ref` from one list gets `match` = the whole matched list text (trimmed by the caller). [Repair evidence shows the phrase.]
- Existing expectations that **change** in `surface-forms.test.ts` (update, do not delete): `"Chapters 3 and 4"` now yields two refs `[{3,3},{4,4}]`; `"chapters one and two"` yields `[{1,1},{2,2}]`. Keep the `"Chapter 15 and one other text"` test (one ref `{15,15}`) and the bare-pages test.
- Add tests (`describe("chapter_lists")`, `describe("chapter_notation")`, `describe("page_boundaries")`):
  - `"Chapters 3, 4 and 9"` gives refs 3, 4, 9 (three refs). `"Chapters 3-5 and 9"` gives `{3,5}` and `{9,9}`. `"Chapters 3 and five"` gives only `{3,3}` (mixed notation stops the list). `"Ch. 15"`, `"chapter fifteen"`, `"Chapter 15"` all give `{15,15}`. `"chapter twenty-three"` gives `{23,23}`. `"chapters one through three"` gives `{1,3}`.
  - Range checks with `ref_in_range`: outline text `"Chapters 3 and 5"` then lesson `"Chapter 4"` is **rejected**; lesson `"Chapter 5"` accepted. Outline `"Chapters 3-5"`, lesson `"Chapter 6"` rejected, `"Chapter 2"` rejected, `"Chapter 5"` accepted.
  - Pages, with ranges built from `extract_refs("pp. 224-233")`: `p. 223` rejected, `p. 224` accepted, `p. 233` accepted, `p. 234` rejected; `pp. 224-234` rejected; `pp. 219-233` accepted only when ranges also include `219-224` (existing test). With the WP-1 row (`pp. 1-8`): `p. 8` accepted, `p. 9` rejected, `p. 0` rejected.
- Residual, decided (D-4): a page after "and" ("pages 8 and 999") is still unread because "pages 3 and 4 students" cannot be told from a list without a word list. Say so in a comment above `page_re`. Do not extend `page_re` to "and".

**Step 4. Rationale label contract (`compile/labels.ts`).**
- Add the two functions from section 4. Behaviour:
  - `rationale_label(index, correct)` returns `` `${String.fromCharCode(65 + index)}. ${correct ? CORRECT : INCORRECT}` `` (for example `"B. Incorrect:"`). It must produce the exact string `nodes.ts` writes today, so no content hash changes.
  - `parse_rationale_label(text)`: match `/^\s*(?:([A-Za-z])[.)]\s*)?(Correct|Incorrect)\b/`. Return null if no match. `correct` is `m[2] === "Correct"` (case-sensitive, "Incorrect" never counts as "Correct"). `letter` is `m[1]` uppercased, or null. `body` is the rest of the text with `^\s*[:.\-–—]?\s*` removed and trimmed.
- Do not add either function to `ALL_LABELS`.

**Step 5. Writer uses the contract (`compile/nodes.ts`).** In `cfu_item`, replace the template string `` `${letter}. ${label}` `` with `rationale_label(i, i === c.key_index)`; remove the now-unused `letter`/`label` locals and unused `CORRECT`/`INCORRECT` imports. Output JSON must be identical: `compile-draft.test.ts` (including lines 172 to 173) and every content-hash test stay green without edits.

**Step 6. Reader uses the contract (`schema_invalid.ts`).** Replace `RATIONALE_RE` and the rationale logic in the CFU loop:
1. Find the lettered `ordered_list` as today; if none, keep the message `"CFU item has no lettered options"` and `continue`.
2. Let `n` = count of `list_item` children (as today). Let `after` = the blocks that come **after** the list in `item.blocks` (the stem is before it and is no longer scanned).
3. For each `paragraph` in `after`, call `parse_rationale_label(node_text(p))`. Keep only non-null results as `rationales` (invariant: only paragraphs that start with a label are rationales).
4. `correct` = number of rationales with `correct === true`. If `correct !== 1`, push `"CFU item must have exactly one Correct option (found ${correct})"` (message unchanged).
5. A rationale counts as present only if its `body` is not empty (a label with no explanation is a missing rationale; D-5). Let `present` be those.
6. Push `"CFU item is missing a rationale for each option"` (message unchanged) when any of these holds: `present.length !== n`; or the lettered rationales' letters are not exactly `A..` the first `n` letters each once (a duplicated letter such as A, A, C, D, or a letter beyond `n`). Unlettered rationales (older fixtures such as `Correct: reason 1`) skip the letter test and are only counted. If some are lettered and some not, apply the letter test to the lettered ones and require `present.length === n`.
7. Keep all heading and table checks and the unknown-type check byte-for-byte.
- Tests in `schema-invalid.test.ts` (new `describe("compiled rationales")`; keep every existing test unchanged and green):
  - `compiled_wp1_has_no_findings`: `build_ctx("wp1")` then `schema_invalid_rule.run(ctx, DEFAULT_POLICY)` is `[]` for wp1, wp2, wp3 and wp4 (use `build_ctx` for each; wp3 and wp4 may have no CFU, that is fine).
  - `compiled_missing_rationale_text_is_flagged`: `build_ctx("wp1", { mutate: (d) => { d.blocks[16]!.cfu!.rationales[2] = ""; } })` gives exactly one finding with message `"CFU item is missing a rationale for each option"`.
  - `compiled_deleted_rationale_paragraph_is_flagged`: take `build_ctx("wp1")`, deep-copy `ctx.lesson` (`structuredClone`), remove the paragraph whose text starts `"C. Incorrect:"` from its section content, run the rule on `{ ...ctx, lesson: copy }`: one finding, same message.
  - `compiled_duplicate_correct_is_flagged`: in a deep copy, change the text node `"B. Incorrect:"` to `"B. Correct:"`: one finding `"CFU item must have exactly one Correct option (found 2)"`.
  - `compiled_zero_correct_is_flagged`: change `"A. Correct:"` to `"A. Incorrect:"`: one finding `"... (found 0)"`.
  - `duplicate_letter_is_flagged`: change `"C. Incorrect:"` to `"B. Incorrect:"`: one finding `"CFU item is missing a rationale for each option"`.
  - `more_than_four_options_pass`: `build_ctx("wp1", { mutate })` adding a fifth option and rationale to `blocks[16].cfu` (`options.push("E option")`, `rationales.push("fifth reason")`): no findings. (Letters A to E.)
  - `genuine_name_in_compiled_rationale_still_fails`: run `proper_noun_unsourced_rule` on `build_ctx("wp1", { mutate: (d) => { d.blocks[16]!.cfu!.rationales[3] = "Grover would not follow this."; } })`: at least one blocking finding with `matched` `"Grover"`; and with `rationales[3] = "The story never mentions Medusa here."` a blocking finding with `matched` `"Medusa"`. Import `proper_noun_unsourced_rule` from `../grounding/proper_noun_unsourced.ts`.
- `compile/labels.test.ts` (new): `rationale_label_matches_compiler` (for index 0..3 and both flags, the compiled WP-1 text nodes equal the labels: reuse `compile_draft` of `draft-wp1.json` as `compile-draft.test.ts` does, and compare the set of strong-marked rationale labels to `rationale_label(i, i === key_index)`); `parse_round_trip` (parse `rationale_label(i, c) + " because x"` returns `{ letter, correct: c, body: "because x" }`); `parse_rejects_non_labels` (`"Which statement"`, `"Correctly said"` return null; `"Incorrect"` is `correct: false`; `"Correct answer"` is `correct: true`); `parse_unlettered` (`"Correct: reason 1"` gives `letter: null`).

**Step 7. Source trust (`grounding/sources.ts`).**
- New shape, with provenance:
  ```ts
  export type SourceOrigin = "outline_row" | "arc_header" | "standard";
  export type SourceEntry = { origin: SourceOrigin; text: string };
  export type Sources = { entries: SourceEntry[]; texts: string[]; ranges: { page: Range[]; chapter: Range[] } };
  ```
  `texts` stays (it is `entries.map((e) => e.text)`) so `proper_noun_unsourced.ts` and `quote_unmatched.ts` keep working without signature change.
- In `build_sources`: keep the row fields as they are (`title`, `homework`, `pages`, `text_set`, `arc`, non-instruction `segments`, `vocabulary`) with origin `outline_row`; `ctx.arc_header` with origin `arc_header`; `ctx.standards[].text` with origin `standard`. **Delete the whole `for (const c of ctx.text_cards)` loop.** Keep range extraction and the pending bare-pages line; update its comment to: "The outline row's `pages` cell is the only stated page range. A text card is written by the model and is never a source."
- Replace the doc comment of `build_sources` to state the rule: sources are the pinned outline row, its arc header and official standards text; a text card in the lesson is model-proposed and never widens them.
- Messages: change the three wordings to drop "text cards": in `proper_noun_unsourced.ts` use `"Proper name is not in this lesson's outline row, arc header or standards"`; in `quote_unmatched.ts` use `` `Quoted passage of ${words} words is not in this lesson's outline row, arc header or standards` ``. (No test or code in the repo matches the old text; the docs that quote it are historical.)
- Comments only (no type changes): `CheckContext.text_cards` in `types.ts` gets `/** Model-proposed records stored with the lesson (reader display, rights status). Untrusted: grounding rules must not read them. */`; the `text_cards: lesson.text_cards` line in `context-loader.ts` gets a one-line comment saying the same; `compile-draft.ts` line `text_cards: draft.text_cards,` gets `// Model-proposed record for the reviewer; not a grounding source (see checks/rules/grounding/sources.ts).`
- Do not change `arc_repeat.ts` (it reads linked lessons' cards for an advisory repeat check, not for grounding).
- New `source-trust.test.ts` (exact test names):
  - `forged_card_cannot_clear_name_and_page`: `plain = build_ctx("wp1", { mutate: (d) => { d.blocks[16]!.cfu!.rationales[3] += " The story never mentions Medusa on p. 999."; } })`. Run `proper_noun_unsourced_rule` and `page_out_of_range_rule` with `CHECK_POLICY`: expect a blocking `proper_noun_unsourced` finding with `matched` `"Medusa"` and a blocking `page_out_of_range` finding with `matched` `"p. 999"`. Then build `forged` the same way **and** push `{ title: "The Lightning Thief", author: "Medusa", edition: null, chapter: "Chapter 999", pages: "p. 999", kind: "off-platform-text", content_available: false }` onto `d.text_cards` in the mutate function. Expect the **same** findings (`toEqual` on kind, level, address, matched) as `plain`.
  - `forged_card_title_cannot_license_quote`: mutate `d.blocks[1]!.text += " Read “holds the sky above the busy city” aloud."` and add a card whose `title` is `"Zeus holds the sky above the busy city"`. `quote_unmatched_rule` returns one blocking finding. Without the card, the same.
  - `source_entries_have_trusted_origins`: for `build_sources(build_ctx("wp1"))` every entry's `origin` is in `["outline_row","arc_header","standard"]`, `entries` is non-empty, and no entry text equals any text-card field of the draft unless that text is also in the outline row.
  - `editing_cards_changes_nothing`: `a = build_ctx("wp1")`; `b = { ...a, text_cards: [forged card], lesson: { ...a.lesson, text_cards: [forged card] } }`; `build_sources(a)` and `build_sources(b)` are deep equal. (This stands for a reviewer or a regeneration editing the stored card.)
  - `outline_supplied_metadata_still_grounds`: take `plain`'s context and replace `ctx.row` with `{ ...ctx.row, text_set: "Percy Jackson by Rick Riordan", pages: "224–233" }`. A rationale that contains `"as Rick Riordan writes on p. 230"` produces no `proper_noun_unsourced` finding for `Riordan` and no `page_out_of_range` finding; `p. 234` in the same place still produces `page_out_of_range`. (This is the supply path: the pinned outline row.)
  - `reviewer_resolution_clears_forged_card_findings`: with `forged` from the first test, `findings = [...name rule, ...page rule]`; `merge_resolutions(findings, [])` leaves them unresolved, and `submit_gate(gate_state({ issues }))` refuses with `refusals[0] === "BLOCKED"`; after `merge_resolutions(findings, findings.map((f) => ({ kind: f.kind, address: f.address, code: f.code })))` every issue is `resolved: true` and `submit_gate` allows. Import `merge_resolutions`, `submit_gate` from `../../gates.ts` and `gate_state` from `../../test-helpers.ts`.
  - `no_grounding_rule_reads_text_cards`: with `node:fs` read every non-test `.ts` file in `packages/core/src/checks/rules/grounding/` (use `import.meta.url` and `readdirSync`), exclude names ending `.test.ts` and the `fixtures` directory; assert none contains the string `text_cards`.
- Existing tests that this can turn red, and what to do: `clean-drafts.test.ts` (the wp2 title quote now must come from the outline row; the row text contains `“The Hare and the Lion”`, so it should stay green), `plants.test.ts`, `name-scan.test.ts`. If one goes red because a name or quote was grounded only by the fixture card, do **not** restore the card path and do **not** edit the expected result; put the fixture's name into a mutated row cell in that test only if the plant is about something else, and report it in your final message. A needed expected-output change is an escalation (section 8), not an edit.

**Step 8. Comments for slice C (R-A1).** Replace the `matched` comments with exactly this text in `types.ts` (field `matched`) and in `finding.ts` (doc comment of `make_finding`, second sentence): `In memory only: not written to issue or finding rows, logs or error text. The repair prompt reads it, and that rendered prompt is stored in model_call.rendered_prompt like every prompt (docs/design/observability.md, Content and redaction, R-48).` Keep `matched` populated for every `proper_noun_unsourced` and `page_out_of_range` finding (already so). Slice C's second ask (a guard test that issue persistence ignores `matched`) lives in `packages/db` and is not in this slice; see section 8.

**Step 9. Remove the rationale bypass (`apps/worker/src/wiring/generation.ts`).**
- Delete the constant `CFU_RATIONALE_MESSAGES` and the `.map(...)` branch for `schema_invalid`. `generation_rules` becomes: `return rules.filter((r) => !NOT_ACTIONABLE_KINDS.has(r.kind));` (same export name, same signature).
- Delete the comment lines 48 and 49 about `schema_invalid`. Keep the other three comment entries.
- Keep `NOT_ACTIONABLE_KINDS` exactly: `quote_placeholder_open`, `excerpt_slot_open`, `cross_lesson_link`, `code_not_allowed`. What stays, and why:
  - `quote_placeholder_open`, `excerpt_slot_open`, `cross_lesson_link`: open slots are generated on purpose (WP-1, WP-2) and block Submit/Approve through the background and gate path. Slice D owns the rule that required slot obligations were created; do not change these here.
  - `code_not_allowed`: **stays until slice E.** `front-matter-standards.ts` writes the outline's focus, ELD and MSLS codes including parent codes into front matter, while the checker accepts leaf codes only (`allowed_codes` is `idx.leaves_of`). Removing the suppression now would fail every lesson at generation. Update that comment line to say "until the standards slice (E) resolves parent and leaf treatment". The background and submit paths still raise it (23/30 stored-ready lessons per the audit), which is a known open item, not a regression.
- Update the head comment to say the filter no longer touches any rule's findings, only drops whole rule kinds.

**Step 10. Parity test (`apps/worker/src/wiring/check-parity.test.ts`, new).** Purpose: one compiled lesson, one content hash, the three real entry shapes. Build:
1. Compile the real WP-1 draft: `LessonDraft.parse` of `packages/core/tests/fixtures/draft-wp1.json`, row `NormalizedRow.parse` of `row-wp1.json`, `template_for(row.lesson_type)`, `compile_draft(draft, { row, template, unit_id: "G6.U4", schema_version: SCHEMA_VERSION })`. Read the fixtures with `fileURLToPath(new URL("../../../../packages/core/tests/fixtures/...", import.meta.url))` (the same relative pattern `apps/worker/src/generation/nodes/testing/fixtures.ts` uses at its line 24).
2. Build a real `CheckContextLoader` (`@ls/core/checks/context-loader`) with small doubles for its eight ports, copied from the pattern in `packages/core/src/checks/context-loader.test.ts` lines 70 to 145, with: `source_outline_version` returning the version id, `rows` returning the arc header, the row and one neighbour record, `row_context` returning `{ outline_version_id, row, row_hash, arc_header: "Arc one", neighbours: [], unit_rules: [], links: [], choices: [] }`, `standards.index()` returning `leaves_of: (c) => [c]`, `standards.texts` returning `[]`, `dependencies`/`dependants` empty, `latest_derived` null, the rest empty.
3. For each case compute `ctx = await loader.load(lesson_id, compiled.lesson, compiled.content_hash)` **separately for each of three callers** (three `load` calls, mirroring `compile-check-node.ts`, `check-job-runner.ts` and `submit-gate.ts`):
   - generation: `generation_rules(CHECK_RULES)` through `run_checks(ctx, rules, CHECK_POLICY).findings`;
   - background: `run_checks(ctx, CHECK_RULES, CHECK_POLICY).findings`;
   - submission: `CHECK_RULES.flatMap((r) => r.run(ctx, CHECK_POLICY))`, then sort with the same order as `run_checks` is not needed: compare after mapping to `${kind}|${level}|${address}|${message}|${matched ?? ""}` strings and sorting.
- Tests (exact names):
  - `same_hash_same_findings`: the three `ctx.content_hash` values equal `compiled.content_hash`; background keys equal submission keys; generation keys equal the background keys with the four `NOT_ACTIONABLE` kinds removed.
  - `generation_has_no_schema_invalid_and_background_agrees`: neither the generation nor the background list contains `schema_invalid` for the compiled WP-1.
  - `rationale_bypass_removed`: `generation_rules(CHECK_RULES).map((r) => r.kind)` equals `CHECK_RULES.map((r) => r.kind)` minus the four suppressed kinds, and for the `schema_invalid` rule `generation_rules(...)` returns the **same object** as in `CHECK_RULES` (`toBe`). That fails if anyone re-wraps it.
  - `forged_card_same_in_all_paths`: compile a draft whose `blocks[16].cfu.rationales[3]` ends with `" The story never mentions Medusa on p. 999."` and whose `text_cards` includes the forged card from `source-trust.test.ts`; in all three shapes the findings include `proper_noun_unsourced` with `matched` `Medusa` and `page_out_of_range` with `matched` `p. 999`.
  - `edited_card_after_generation_does_not_change_findings`: same content, but the loaded `lesson` has `text_cards` replaced with the forged card after compile (a later edit); findings keys equal the unforged ones.
- Note: the test reuses one lesson object for the three callers. The real generation path adds front-matter standards before hashing and the background path reads the lesson from the stored doc; both feed the same `loader.load(lesson_id, lesson, hash)` and the same `build_sources`, which is the choke point under test.

**Step 11. Gates.** Run the checks in section 7. Report test counts and anything red that you did not cause.

## 6. Data and fixtures

Synthetic only. Everything comes from existing committed fixtures: `packages/core/tests/fixtures/{draft-wp1,draft-wp3,draft-wp4}.json`, `row-wp1.json`, `outline/issued.csv` (synthetic issued sample via `load_issued_grid`), `grounding/fixtures/draft-wp2.json`. Invented names (`Medusa`, `Zeus`, `Grover`, `Athena`) and pages (`p. 999`) are inline in tests and appear in no data file. Do not read `docs/source/restricted`. Do not open the seeded-error key.

## 7. Checks

While iterating (affected tests only; the full suite is not needed, build-loop rule):
```sh
npx vitest run packages/core/src/checks packages/core/src/compile
npx vitest run apps/worker/src/wiring/check-parity.test.ts apps/worker/src/wiring/shells.test.ts apps/worker/src/wiring/judge-off.test.ts apps/worker/src/generation
```
Existing tests that must stay green unchanged: everything under `packages/core/src/compile/`, `packages/core/src/checks/context-loader.test.ts` (the loader's key set is untouched), `gates.test.ts`, `registry.test.ts`, `run-checks.test.ts`, all `structural/*.test.ts`, `grounding/{clean-drafts,plants,name-scan,quotes,quote-span,placeholders,injection,finding-shape}.test.ts`, `packages/ydoc` and `packages/schema` hash tests (labels do not change). Expected edits to existing tests: only the two list-reading expectations named in step 3.

Once before the final commit, the affected tests plus the fast gates:
```sh
npx eslint packages/core/src/checks packages/core/src/compile apps/worker/src/wiring
npm run typecheck --workspace @ls/core
npx tsc -p apps/worker/tsconfig.json --noEmit
npx vitest run packages/core/src/checks packages/core/src/compile apps/worker/src/wiring apps/worker/src/checks apps/worker/src/generation apps/collab/src/commands
```
(The repo has no formatter script; the lint run is the style gate. `apps/worker/src/wiring/generation.int.test.ts` and `real-mode.int.test.ts` need Postgres; run them only if the environment has it, otherwise say they were not run. The full suite is not required: the change reaches `packages/core` checks and compile only, not config or lockfiles.)

Passing means: all named tests above exist and pass; the original 37 pending tests still pass (with the two updated expectations); no new lint or type errors.

## 8. Risks and requests

**Decisions made under PD-32 (no input from Innocent needed):**
- D-1 (names first after a label): accept `compromise`'s sentence-initial limit (verified by probe: `Zeus` and `Medusa` as first word are not tagged; `Grover`, `Athena`, `Kevin` are). The alternatives (a dictionary or a word list) are the broad whitelist the handoff forbids. A name that only ever appears as the first word of a rationale and is unknown to `compromise` is therefore not caught by the heuristic; it is caught when it also appears mid-sentence anywhere in the lesson, and by the human review gate. Record this in the devlog; it belongs in the error-analysis taxonomy as a known miss.
- D-2 (structured rationale field): **not adopted.** A paragraph attribute would need an editor-schema change (`packages/editor-schema`, another track's package), would change the content hash of every stored lesson and the frozen WP expected outputs, and a reviewer editing the text in the editor would silently drop it. The chosen design keeps the stored text byte-identical and makes writer and reader share one contract (`rationale_label` / `parse_rationale_label`) with a round-trip test, so the two cannot drift again.
- D-3 (card as supply channel): there is no store of independently supplied or reviewer-approved source records today, and creating one needs a contract and a database table that are outside this slice. The only trusted supply channel that exists is the pinned outline row (`text_set`, `title`, `pages`, `homework`, segments) plus official standards text. A card field can only restate what the row already says, so it adds nothing and is ignored. The reviewer route for genuine evidence is the existing recorded resolution (CON-13), proved by `reviewer_resolution_clears_forged_card_findings`.
- D-4 (pages after "and"): stays unread (documented in a comment).
- D-5 (empty rationale body counts as missing).

**Cross-slice requests and warnings:**
- **Slice C / prompts (not this slice's files):** `packages/prompts/locked/lesson-shape.md` (lines 17 and 19) and `repair.md` still say names "appear on the lesson card or in the text cards". After this slice, a name that only a generated card carries is flagged. Slice C already plans the repair wording; the draft prompt wording needs the same change by the owner of `packages/prompts`. Until then, the model is told cards are a source and the checker says they are not, which will cost repairs.
- **Expected effect on pass rates:** lessons whose only support for a name or page was a model-written card will now fail the name or page check. That is the intended change. The next replay of the 47 stored finals (slice D or the orchestrator, using `evals/src/zz-replay.mts`) must report the blockers separately from the earlier 47/47 and must not credit this to model quality. Handoff step 4: replay the same stored drafts to isolate each change.
- **Slice C ask R-A1:** done in step 8. **R-A1 second half** (a guard that issue persistence ignores `matched`) belongs to `packages/db/src/repos/issue-repo.ts`, which no slice owns. Request to the orchestrator: assign it to slice B or the integrator.
- **Slice D (runs after):** D inherits `labels.ts` (`rationale_label`, `parse_rationale_label`), `nodes.ts` and `schema_invalid.ts`. D must not re-add a regex for rationale labels elsewhere. `student-blocks.ts` still has its own `^[A-Z]\.\s*(Correct|Incorrect)` regex; it agrees with the compiler's output and was left alone to keep this slice narrow. D may switch it to `parse_rationale_label`.
- **Slice E:** `code_not_allowed` suppression stays; E removes it with the parent and leaf decision.
- **Related self-approval not fixed here:** `build_name_index` adds to `L` every token the lesson itself writes in lowercase, so a model that writes "medusa" once in lowercase can make "Medusa" pass. That is the lesson validating itself in a smaller way than cards; it is outside the handoff text for this slice. Recommend the integrator opens a follow-up.
- **Docs for the orchestrator (not edited by this slice):** area map and router rows for `compile/labels.ts` and the new tests, one devlog entry, and the handoff/`resume.md` wording about the bypass.

**Collision with other slices:** none on files (B: `evals/**` and `packages/db/src/repos/runs.ts`; C: `repair-node.ts`, `packages/prompts/src/render.ts`; both are outside the owned list). C reads `checks/types.ts` for `matched`: step 8 changes only that field's comment. D edits compile and checks after this slice merges.

## 9. Readiness

**READY.** No `NEEDS-DECISION` for Innocent. Decisions D-1 to D-5 are adopted under PD-32 and recorded above.

## Deviations

- `grounding/finding-shape.test.ts` (listed as must-stay-green) was already red at the start: the pending `matched` field made `Object.keys(f)` 8 keys. Narrow edit: the key check ignores the optional in-memory `matched` key; the other 7 keys, null extras and no-planted-text assertions are unchanged.
- Coordinator request (slice C, R-A1 follow-up): added `packages/db/src/repos/issue-repo-matched.test.ts`, a DB-free guard that `issue-repo.ts` and the migrations never mention `matched`. `issue-repo.ts` itself is unchanged.
- `forged_card_title_cannot_license_quote` asserts findings are non-empty, blocking and identical with and without the card (the WP-1 quote yields two findings, not one as the plan assumed).
