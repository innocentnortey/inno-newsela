# Error analysis — the protocol for zero-to-hero §9

> **NOT YET RUN.** This file is the plan. No traces have been read, no `FT-N` exists, and no result is claimed here.
> It is written now so the round can start the moment a full run (NL-112) and the frozen set exist.
> Status: **proposed**. It follows [`docs/design/eval-plan.md`](../../design/eval-plan.md) → *Failure categories*, which is the source.

## What this is, in plain words

Before anyone changes a prompt, a check or a model, we read what the system actually did wrong and name the kinds of
mistake we see. Each experiment (`XP-N`) then targets exactly one named kind (`FT-N`), changes one thing, and is scored
before and after. The §9 gate says the same thing: **no tuning change without a named failure type.**

## Inputs (needed before the round starts)

| Input | Where it comes from | State today |
|---|---|---|
| About 20 stored traces, drawn from the full-run unit and the three live lessons (rows 8, 9, 25) | the project Postgres (`llm_call`, job and check records; traces stay in our own database, PD-19); the full-run report from `npm run eval:full-run` | none yet: full run not done |
| Lessons the approver rated *rewritten* at Approve (HP-10) | frozen metrics rows | none yet: no measured review sessions |
| The frozen development set | `evals/cases/` (S1, S2, S4, S7 exist; others per `eval-plan.md`) | partly present; frozen status not yet declared |
| Starting categories FC-1 to FC-n | `docs/design/eval-plan.md` → *Failure categories* | exist as starting points only |

## Procedure

1. **Sample.** Pick about 20 traces: a mix of lesson types and outcomes, not only the failures. Record how they were
   picked (random seed or the selection rule) so the sample can be rebuilt. Rows 8, 9 and 25 were used to tune the
   draft prompt in SP-1, so they must not be the only evidence for any length or quality claim.
2. **Read each trace to its first failure only.** Stop at the first thing that went wrong in the sequence (intake,
   plan, draft, code check, repair, store). Later symptoms are usually consequences; counting them hides the cause.
   A trace with no failure is recorded as clean.
3. **Write the taxonomy from what was seen.** File each first failure under an `FT-N` that you name in the words of
   what happened. Start from FC-1..FC-n, then rename, split or merge them as the traces demand. Do not import a
   generic taxonomy.
4. **Table it.** Keep a models x failures table (model and prompt version down the side, `FT-N` across) with counts
   and *n*. Say "k of n traces", never a rate without its n.
5. **Pick targets.** An `XP-N` is allowed only against one `FT-N`, one changed variable, scored on the frozen set with
   score and cost before and after (GP-21, GP-51). Slots NL-128 to NL-130 are XP-1 to XP-3; unused slots are closed unused.
6. **Innocent reviews** the taxonomy and the table before experiments run (checklist §9 row: "Innocent ✓").

## Where things land

| Artifact | Path | Notes |
|---|---|---|
| Per-trace first-failure notes | `docs/testing/error-analysis/traces.md` (planned) | one row per trace: trace ID, lesson, first failure, `FT-N`, who read it |
| The taxonomy and the models x failures table | `docs/testing/error-analysis/taxonomy.md` (planned) | `FT-N` ids are stable once Innocent reviews them |
| Eval reports | `evals/reports/<kind>-<git sha>.md` (S11 held-out: `evals/local/reports/`, git-ignored) | written by `npm run eval:*` via `evals/src/runner.ts` |
| Experiments | `docs/testing/experiments/` (planned) | one file per `XP-N` |

Planned paths are labelled planned until they exist. No trace content from the restricted folder
(`docs/source/restricted`) is ever copied into any of these files.

## How a case is promoted to the golden set

Per `eval-plan.md` → *Case provenance*: a stored trace becomes a case with `provenance: promoted-trace` only after a
person has reviewed and corrected it. The case records `source:` (the trace ID), the reviewer, and `guards:` (the HP or
R it protects). **Unreviewed traces never become cases.** A case that would reproduce restricted content is rewritten
as a synthetic one per the `synthetic-test-data` rule (declared dimension, labelled expectation, reproducible script).

## What this plan does not claim

No failure rate, taxonomy, model comparison or improvement exists yet. Anything quoted from this folder before the
round is run would be invented.
