# Stage map

The whole interview is laid out at setup. The first one or two stages get concrete questions.
Later stages get their topics, checklist items, dependencies and **provisional** questions, which
earlier answers turn into concrete ones. The user sees the full map from the start, so nothing
arrives as a surprise and nothing is silently skipped.

## Default stages

Stages S1–S8 are the eight steps of `system-design-readiness/GUIDELINE.md`. That guideline is
the interview's framework for design inputs, and the product questions sit in the step that uses
them. Observability is a thread through all eight stages (`observability.md`), with one row per
stage in the document's **Observability map**. A project may merge, split or rename stages at setup when its
sources call for it. Every checklist item and every question must still belong to exactly one
stage, and the change is noted in the stage map.

| Stage | Topics | Checklist items | Pack sections | Depends on |
|---|---|---|---|---|
| S1 Frame | Problem, users, useful result, what must be proved, scope and non-goals, required stack, deadline, budget, economics, data limits, telemetry policy, **hardest uncertainty** | SD-1.1 – SD-1.10 | problem-objective, users-scope, audience-tone-constraints, open-questions | — |
| S2 Requirements and promises | Functional requirements, each with an observable acceptance criterion; the operations that matter; invariants; latency, freshness, availability, recovery; operational success kept apart from output quality; key metrics, the decision each informs, its population and approved target or measurement-only | SD-2.1 – SD-2.9 | functional-requirements, acceptance-criteria, non-functional-requirements, motion-profile | S1 |
| S3 Workload and data | User target and its kind, actions and request mix, peaks, background work, record sizes and retention; every workflow and entry point, experiments, validation runs and operator scripts included | SD-3.1 – SD-3.7 | — | S1 (depth), S2 (operations) |
| S4 Flow and dependencies | Record ownership, external dependencies, model decision points, what happens during vs before vs after a request, partial failure, legacy seam, run stages and waits | SD-4.1 – SD-4.7 | tool-integration, system-architecture (constraints only) | S2 |
| S5 Resources and cost | CPU, database and model work per request; model and API limits; runtime concurrency; prices | SD-5.1 – SD-5.6, SD-7.4 | — | S3, S4 |
| S6 Failure, overload and security | Overload policy, timeouts and retries, dependency failure modes, stale data, queue limits, security and privacy failures, failure and recovery signals | SD-6.1 – SD-6.6 | failure-modes-security | S4 |
| S7 Deployment and operations | Where it runs, the failure it survives, replica capacity, what the team can operate, where telemetry lives and why, release | SD-7.1 – SD-7.3, SD-7.5, SD-7.6 | observability-ops, release-iteration | S1, S5 |
| S8 Validation and evidence | Ground truth, who decides a correct answer and where cases come from, held-out separation, test data, load-test plan, what is captured while it runs, model and agent run traces, where each claim's evidence goes, redesign triggers | SD-8.1 – SD-8.9 | verification-correctness, testing-strategy | S2, S6 |
| S9 Close | PRD revision review and explicit approval, design-outputs register complete, readiness check, handoff | — | — | S1–S8 |

`scripts/interview.py skeleton` assigns these default stages (step N → SN, with SD-7.4 in S5).

## Stage states

| State | Meaning |
|---|---|
| `prepared` | Concrete questions written and ready. Setup prepares S1, and S2 when S1 leaves it unambiguous. |
| `provisional` | Topics, checklist items, dependencies and provisional questions only. |
| `active` | The stage the current batch comes from. |
| `done` | Every question and checklist item in it is closed. |
| `n/a` | Ruled out with a reason (its checklist rows are `n/a` with that reason). |

## Depth: how S1 refines everything after it

SD-1.9, the hardest uncertainty, is the first open S1 question unless a source already settles it.
Its answer sets each later stage to **full**, **light** or **n/a**, using the guideline's *Set the
depth* rule:

- **full** — the stage's provisional questions become concrete, one per open item.
- **light** — one or two questions that state the answer in a sentence and confirm it; remaining
  items in the stage are usually `assumed` (Measure) or `n/a` with the depth as the reason.
- **n/a** — no questions; every checklist row in it is `n/a` citing the depth decision.

The tier answers in S1 do the same at item level. If no model makes a decision, the AI-tier items
become `n/a`. If nothing is built inside an existing system, the Legacy items become `n/a`.

Depth also sets the observability thread. A **light** stage still gets its Observability map row,
usually answered in a sentence. An **n/a** stage gets its row marked `n/a` with the depth decision
as the reason. A system with no model keeps every row, and its model and agent run parts are `n/a`.

## Promoting a provisional question

After each batch, for each provisional question whose dependencies are now answered:

1. Rewrite it concretely using the answers. Keep its ID.
2. Set it to `ready`, or `retired` with a reason if the answers made it moot.
3. Add any new question the answers exposed, with the next free ID and its dependencies.
4. Update the stage's depth and state in the stage map.

A provisional question is a planning aid. Never quote one, or its proposed default, as a
requirement in an owner document.

## Batching

- One stage per turn, at most four questions. A stage with more open questions takes several
  batches.
- Carried answers for the stage are shown as a short review list with their citations, apart from
  the four questions. The user can accept them in a word or reopen one.
- Required, high-stakes or graded questions are asked directly with no default. Lower-stakes ones
  may offer a labelled proposed default the user can accept in a word.
- When an answer raises the stakes (for example sensitive data or a costly wrong answer), escalate
  the related verification, failure, security and audit questions to required in their stages.
