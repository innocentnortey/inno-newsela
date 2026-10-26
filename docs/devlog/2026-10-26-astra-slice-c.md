# 2026-10-26 ASTRA slice C: repair gets usable evidence

**Changed.** A repair request now carries the same pinned authoritative blocks as the generation request (lesson meta, template, standards, title, segments, homework, pages, text set, vocabulary, codes, arc header, neighbours, unit rules, links, plan entries, reviewer note). `PromptRenderer.pinned_blocks` builds them for both prompts; the worker side uses `pinned_prompt_context` (`apps/worker/src/generation/generation-context.ts`), and `DraftNode` now stores `plan_entries` in `JobContext` so repair reuses them. Finding lines gain `| matched: "<json>"` (capped at 120 characters) and `| code: X` (`packages/prompts/src/repair-findings.ts`, with a parser). `repair.md` and the repair instruction now say to fix only the listed items and leave supported names and references alone. One repair only, unchanged.

**Why.** The audit showed repair recovered 11 of 28 drafts with no pinned context and no flagged span. Most of the remaining failures are explained by parser and check fixes (slice A), not by the model, so none of that is credited to this slice.

**Storage boundary.** The matched span enters the rendered prompt, and every rendered prompt is stored raw in `model_call.rendered_prompt` by design (observability.md, R-48). It reaches no issue row, log, error message or provider-error path.

**Version consequences.** `locked_hash` covers every `.md` file in `packages/prompts/locked/`, so editing `repair.md` changes the hash for all task prompts. `sync_locked_layer` inserts a new prompt version (number+1, "locked layer changed") the first time the new code starts. A job pinned to the old version fails with `LockedLayerMismatch` on the new code, so runs must start on the new version. Slices A, B and D land in the same hash; the NL-134 "re-run only if the prompt changed" rule is triggered. Cost and keep or revert are decided at the full-run step.

**Recovery by category.** Each repair call's `repair_findings` block is stored in `rendered_prompt` and parses with `parse_repair_findings`; compare its kinds to the same job's final check kinds. No schema change.

**Checked.** prompts, worker generation and wiring, recorder, prompt-service tests green; typecheck of `@ls/prompts` and `@ls/worker` clean.

**Remaining.** Slice A comment wording (R-A1) and the measurement slice (R-E1).
