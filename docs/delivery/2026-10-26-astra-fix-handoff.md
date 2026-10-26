# Newsela generation and review fixes for Claude

Prepared for Innocent and the VPS Claude session on 2026-10-26. Status: independently analysed and reproduced; application fixes are not implemented by this handoff. Astra performed the code analysis; the parent Codex session independently validated stored outputs and replayed checks. Scope is the synced `e7e72a3` snapshot plus its pending grounding patch.

The immediate problem is disagreement between the generator, compiler, checks and reports. The latest 17 failed jobs can all be explained by checker false positives on their final drafts. Separate defects can let unsupported content pass and create unnecessary work when a ready draft reaches review. Fix these boundaries before increasing repair attempts or spending on another full-unit run.

The business objective is fewer **reviewer minutes per approved lesson**, while still catching errors. A draft that passes generation checks is an input to review. It is not proof of instructional quality, standards alignment, or reduced review effort.

## Corrected evidence

Sources are read-only snapshots of the kept VPS databases, not a new model run. Aggregate results, snapshot hashes and per-failed-lesson replay results are in [the audit evidence](../testing/error-analysis/astra-audit-2026-10-26.json).

| Measure | Attempt 2 | Attempt 3 |
|---|---:|---:|
| Initial drafts that parse and compile | **11/47 (23.4%)** | **44/47 (93.6%)** |
| Ready with no repair in the recorded run | 0/47 | **19/47 (40.4%)** |
| Recorded repairs | 47 | 28 |
| Recorded ready after the pipeline | 8/47 | **30/47 (63.8%)** |
| Recorded failed jobs | 39 | 17 |
| Repair recovery | 8/47 | **11/28 (39.3%)** |

Attempt 2 is `run_01M5W6JK5XJQ7VE0WMR7HR1Z11` in `ls_nl112_dev`. Attempt 3 is `run_01M5W7VQFD6AEVPMPZA2Z4S9ZK` in `ls_nl112c`. All 47 attempt-2 repair outputs and all 28 attempt-3 repair outputs parse and compile. The schema and compiler files are unchanged between attempt 3's `64fe0e9` and the audited HEAD.

The 90% parse-and-compile target is met by attempt 3's **44/47**. Its **19/47** no-repair result measures a different stage. Earlier statements that attempt 2 was either 0/47 or 47/47 schema-valid are contradicted by direct validation of stored initial outputs. Correct those claims with an audit note; preserve the original run artifacts as historical evidence.

On the exact attempt-3 final outputs, the committed name checker reproduces 15 blocked lessons. Its matched words include **Nothing, Switching, Copying, Too, Retelling and Dismissive**, following compiler-generated answer labels. The pending name correction removes those 15 false blocks. The two page failures are **L21**, `pp. 219-233`, and **L22**, `Chapter 15 and one` in a sentence about one other text. The pending parser corrections remove both.

The pending patch yields **47/47 final outputs with no generation blockers in the offline replay**. This does not change the database's 30 ready/17 failed states. Replay reconstructed stored outline, arc and standards context; cross-lesson links and mutable review/lifecycle state were omitted. It is not a fresh production run or proof of semantic quality.

Full-rule replay exposes the next boundary: **27/30 stored-ready lessons raise structural `schema_invalid` findings**, and **23/30 raise `code_not_allowed` findings**. Those counts overlap. Intentional human work is separate: the 30 saved ready versions contain **13 quote placeholders and 7 excerpt slots across 16 lessons**, although the report prints zero placeholders.

## Fix the compiler and checker disagreement first

**Cause.** [CFU compilation](../../packages/core/src/compile/nodes.ts) writes rationales such as `B. Incorrect: Switching…`. The name scanner interprets some ordinary words after those labels as proper names. Separately, [the structural rule](../../packages/core/src/checks/rules/structural/schema_invalid.ts) recognizes a rationale only when it starts with `Correct` or `Incorrect`; the compiler's letter prefix makes valid rationales appear absent. An unmodified compiled WP-1 fixture reproduces four false findings across two CFUs.

[Generation wiring](../../apps/worker/src/wiring/generation.ts) suppresses the rationale findings during generation, but background and review checks retain them. This transfers a code mismatch into reviewer work.

**Change.** Complete the narrow label-normalization and page-parser corrections already present in the synced working tree. Make structural checking understand the compiler's canonical rationale representation, retaining exactly-one-correct and one-rationale-per-option validation. Remove the rationale-specific generation bypass once full-check parity passes. Prefer structured rationale fields or semantic text over repeated parsing of display labels where feasible.

**Acceptance.** Compile real draft CFUs and run the full checker: valid rationales pass; a missing rationale, duplicate correct option, and genuine invented name still fail. Test a genuine name both first and later after a label. Exercise generation, background checking and submission on the same content hash. Accept the observed page formats while rejecting pages immediately outside their ranges. Cover mixed chapter-number notation and chapter lists; do not substitute a broad name whitelist or blanket grounding exemption.

The existing pending tests passed locally: **4 files, 37 tests**, covering surface forms, name scanning, planted grounding errors and clean drafts. This is useful regression evidence, not complete lifecycle verification.

## Prevent generated source cards from validating themselves

**Cause.** [The compiler](../../packages/core/src/compile/compile-draft.ts) assigns `text_cards: draft.text_cards`; [context loading](../../packages/core/src/checks/context-loader.ts) supplies those cards to checks; [source construction](../../packages/core/src/checks/rules/grounding/sources.ts) accepts their metadata as support for names, quotations and page ranges.

**Reproduction.** In a compiled WP-1 context, a CFU rationale mentioning unsupported `Medusa` and `p. 999` triggers both name and page blockers. Adding a generated card with `author: "Medusa"` and `pages: "p. 999"` removes both blockers without any change to trusted outline data. Astra reproduced this in memory. The pending restriction on bare page ranges does not prevent explicit `p. 999` metadata from taking this path.

**Change.** Build the authoritative source set from the pinned outline and independently supplied or reviewer-approved source records. Generated cards may reference those records or propose metadata for confirmation; they cannot expand their own grounding allowlist. Apply the same boundary to drafting, repair, background checks and approval.

**Acceptance.** A forged card cannot clear the reproduction's findings. Legitimately supplied metadata remains usable. Test the corresponding quotation path, source provenance and edits to a source record. Retain a visible resolution route for a reviewer who supplies genuine supporting evidence.

## Make reports describe the stage actually measured

**Cause.** [Full-run reporting](../../evals/src/full-run-report.ts) infers first-pass schema validity from `repairs === 0`, rather than validating the original draft. It can reject a valid draft repaired for a content finding and can count some no-output failures as valid. S3's observer checks parsing but not compilation, although M-31 defines both.

[Run summary queries](../../packages/db/src/repos/runs.ts) count placeholder issue rows rather than actual slot nodes. Reporting can run before asynchronous checking has populated those rows, and several facts use current lesson state rather than the version belonging to the run.

**Change.** Report separate counts and denominators for initial parse/schema validity, initial compilation, initial generation-check cleanliness, repairs/recovery, stored-ready outcomes, review blockers and open content slots. Pin facts to the run's lesson versions/content hashes. Record a check-completion watermark; incomplete checking is pending, not zero. Break failures down by check kind, retaining first-failure chronology and all findings rather than collapsing everything to `check_failed`.

**Acceptance.** Attempt 3's initial parse-and-compile result reconstructs as 44/47, distinct from 19/47 no-repair and 30/47 ready. A valid draft needing content repair stays schema-valid; no-output failure does not count valid. The 20 existing slot nodes appear independently of whether issues have been created. Later lesson edits do not rewrite historical run results. Verify totals against stored calls, including the unit-plan call; the current report adds its cost because the job rollup still omits it.

Correct the delivery docs, resume checkpoint and error-analysis claims after the calculations are fixed. The S3 report's `provider_mode: real` alongside `prompt_version: none (stub)` and a stub model note also needs real provenance from its recorded run/calls.

## Give the existing repair attempt usable evidence

**Cause.** [RepairNode](../../apps/worker/src/generation/nodes/repair-node.ts) sends the draft, template, generic findings and schema paths. [The renderer](../../packages/prompts/src/render.ts) does not include the trusted row, accepted intake choices, source metadata, allowed ranges or standards context, despite instructions requiring repair to obey those facts. The new `matched` finding field is dropped by RepairNode and is not rendered.

**Change.** Supply repair with the same pinned authoritative context used for generation, plus precise structured findings and the offending span/reference. Preserve data delimiters. Keep one repair initially; false findings and missing evidence must be corrected before evaluating an additional attempt. If matched text enters a recorded rendered prompt, replace comments claiming it is never stored with an accurate storage boundary.

**Acceptance.** Rendered repair requests contain the correct pinned sources and precise defect evidence. A repair preserves supported names and references while correcting unsupported ones. Verify prompt-version identity and measure recovery by defect category. Do not attribute benefits of parser/check fixes to improved model repair.

## Align production lesson structure and standards evidence

**Cause.** S3's **0/9 predates both prompt rounds** and is not the current score. However, current templates still omit WP-1/WP-2's required Part A/Part B structure and WP-3's requested sample-response/teacher-tip/routine-heading components. The actual latest L5 draft uses meaningful part names such as “Gather evidence” and “Plan and write,” while assertions require Part A/Part B. Missing stored drafts also produce cascading “all blocks absent” symptoms.

The standards path has a deeper gap. [The teaching check](../../packages/core/src/checks/rules/alignment/standard_not_taught.ts) passes every focus code when any teaching paragraph exists. Checking links primarily test CFU tags. Block code/origin metadata is lost through compilation, and [front matter](../../apps/worker/src/generation/nodes/front-matter-standards.ts) rebuilds outline codes only. Generation suppresses `code_not_allowed` because persisted parent codes conflict with a leaf-only checker. S3 permits some expected codes to be absent and does not enforce expected teaching/checking locations.

**Change.** Establish one production section/part contract from the worked-pair requirements and feed it through prompt rendering, compilation and checking. Resolve whether exact part labels or an explicit structural mapping are canonical; document a contract correction if needed, rather than editing expected outputs just to pass. Preserve per-code teaching and assessment links, origins and narrowed/added-code confirmations. Resolve parent/leaf treatment consistently; do not label all tags as verified instructional alignment.

**Acceptance.** The required components and intended locations survive compilation. A legitimate narrowed leaf retains provenance and an unresolved confirmation; invalid codes remain blocked. Generic teaching text plus unrelated assessment content tagged with every standard cannot establish verified alignment. Keep human semantic review explicit while the judge is disabled and uncalibrated.

Intentional empty quote/excerpt slots should remain successful draft outcomes with later human work. Validate that every required slot obligation was created; store the draft, surface the work, and block the appropriate submission/approval action until it is resolved. Do not treat missing required slots as success merely because no slot issue exists.

## Execution and evidence order

1. Preserve the synced pending changes and current VPS work. Compare the current VPS diff before applying anything; this audit covers a snapshot, not a live checkout. Recover baseline facts from the existing calls without new model spending.
2. Land and test the narrow false-positive corrections and compiler/full-check parity. Close source-card self-authorization before treating an improved pass rate as trustworthy. Repair the metric calculations and historical explanations alongside these changes.
3. Complete trusted repair context, the production structure contract, required slot obligations and standards provenance. Keep genuine human review gates intact.
4. Replay the same stored initial and final drafts to isolate the effect of each change. Use synthetic regressions for the named mechanisms. Audit the ordinary generation → edit → checks → submit → approve path with actual compiler output and version/hash pinning.
5. Run the frozen S3 cases × 3 repeats on the final candidate within the user's existing spending authorization and remaining project headroom. Verify the S3 guard against cumulative spend: its current implementation notes that project headroom is not read. Do not weaken its 1.0 floor or its expected outputs to get a pass.
6. Apply NL-134's version-based rerun rule after the candidate is fixed. Measure one final whole-unit run if required, with code/prompt/schema/check identities and reconciled cost. Offline replay is not a substitute for this integration measurement.
7. Complete a human lesson-quality sample, measured review sessions and the blind seeded-error review before claiming productivity gains or dependable error catching.

Suggested work boundaries are checker/compiler parity, source trust, measurement, repair context, and structure/alignment. Each should name its observed failure type and compare before/after on fixed evidence. The current audit is evidence for that work; it is not Innocent's human review of the taxonomy, seeded errors or lessons.

## Ticket disposition

| Ticket | Honest disposition |
|---|---|
| NL-112 | May finish as a measured baseline only after its exact verification/reconciliation criteria pass. Record actual run history and deviations from the one-run boundary; do not retroactively imply the later runs were prospectively controlled experiments. |
| NL-109 | Suite execution exists; 0/9 is historical. Explicit all-repeat placeholder/link criteria and the 1.0 floor cannot be claimed satisfied by an honest failing report. Re-measure the final candidate. |
| NL-120 | Existing prose needs corrected facts, trace selection/first failures, an observed FT taxonomy, a model/version table and recorded human review or the exact PD-32 fallback label. |
| NL-128 to NL-130 and NL-134 | Need explicit changes, fixed comparison evidence, cost and keep/revert decisions. Do not invent completed experiment records for the earlier mixed prompt rounds. |
| NL-135 | Still requires the actual blind human review. This audit does not open the seed key or replace that exercise. |

## Reproduction and limits

The read-only export used `BEGIN READ ONLY` and selected model-call raw outputs/metadata, lesson-job outcomes, outline rows, standards and generated versions from the two named databases. It omitted credentials, provider keys, restricted source files and seeded-error keys. Raw exports and the replay helper remain in the local temporary evidence directory recorded in the aggregate JSON; on the VPS, re-read the kept database records if those temporary files are unavailable.

To reproduce the decisive metric, validate each original `purpose = 'lesson_draft'` output with `LessonDraft.safeParse`, then `compile_draft` against its pinned outline row and template. Do not select the repair output or infer success from the job's repair count. To reproduce checker effects, compile the last draft/repair per job, rebuild front matter and check context from the stored inputs, compare committed and pending grounding rules, and then run the full review rules. Fetch lifecycle/link state for an exact end-to-end replay; the audit's offline replay intentionally did not claim that equivalence.

Local regression command:

```sh
npx vitest run packages/core/src/checks/rules/grounding/surface-forms.test.ts packages/core/src/checks/rules/grounding/name-scan.test.ts packages/core/src/checks/rules/grounding/plants.test.ts packages/core/src/checks/rules/grounding/clean-drafts.test.ts
```

Result: 4 files, 37 tests passed. Dependencies were installed with scripts disabled; the local Node 24.14 runtime emitted engine warnings for some dependencies. The targeted checker tests executed successfully. No full application suite, new model generation, human review or production mutation was performed by this audit.
