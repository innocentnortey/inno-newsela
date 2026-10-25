# The living interview document

One Markdown file per interview scope, kept in the target project. It holds the questions, their
stages, the answers and their history, the evidence, checklist coverage and the next batch. A
fresh session must be able to resume from this file alone.

**It records; it does not own.** Product requirements stay in the PRD, decisions in the project's
decision record, design inputs in the requirements doc or readiness report. Every answer names the
document it changed (`Affects`). If the interview document and an owner disagree, the owner wins
and the interview document is corrected.

Start from `templates/interview.md`. Keep the section order below so the checker and the next
session can find things.

## Sections

| Section | Job |
|---|---|
| **Resume here** | Interview state, current stage, next batch IDs, blockers, PRD approval, readiness verdict, last update. Read first on resume. |
| **Sources read** | Every document swept, its authority and the revision or date read. A source that changed since its date is re-swept on resume. |
| **Artifact map** | Where each downstream artifact lives or will live: PRD, decision record, open questions, requirements / design inputs, readiness report, implementation plans, coverage audit. Mark each `exists`, `planned: <path>` or `unknown — ask`. Its **Design outputs** subsection is the register of the seven required design outputs (below). |
| **Stage map** | Every stage, its topics, checklist items, dependencies, depth and state. Complete from setup on. |
| **Next batch** | The exact questions to ask next (at most four) and the carried answers to review with them. |
| **Questions** | One block per question, by stable ID. |
| **Observability map** | One row per stage (S1–S8): what that stage must settle about observability, its readiness items, questions, disposition and evidence. See `observability.md`. |
| **Checklist coverage** | One row per readiness checklist item. No item may be missing. |
| **Batch log** | One row per batch: date, stage, questions, the consequential inference, documents reconciled. |

## Design outputs

The register of the seven outputs every design must produce: system design, architecture, code
design, component contracts, evaluation plan, observability contract and key-metrics registry.
Contract and gates: `system-design-readiness/DESIGN-OUTPUTS.md`. What the interview settles for
each, and what it leaves to design: `design-outputs.md`.

```markdown
| ID | Output | Owner | Location | Sources | Status | Notes |
|---|---|---|---|---|---|---|
| DO-5 | Evaluation plan | Innocent | docs/design/system-design.md#Evaluation plan | SD-8.1, SD-8.8; Q-021 | planned | — |
| DO-3 | Code design | — | — | — | n/a | one 60-line script; the architecture names its two functions |
```

This is the project's only register. `system-design-readiness` and `to-tickets` read it here and
update each row's status as the design fills it (`planned` → `draft` → `ready`).

## Question IDs

`Q-001`, `Q-002`, … in order of creation. Never renumber or reuse an ID. The stage is a field, so a
question can move between stages without changing its ID. A question that no longer applies is
`retired` with a reason; it is not deleted.

## Question block

```markdown
### Q-007 — Latency target for the quote operation
- Stage: S2
- Layer: design-input
- Thread: observability
- Purpose: Sets the promise the workload and capacity steps size against.
- Sources: SD-2.3; pack:ai-agent-app/scale
- Depends on: Q-004
- Status: answered
- Evidence: docs/decisions.md D-12 (user answer, batch 3, 2026-10-09)
- Answer: p95 under 2 s, timed from request received to decision record written.
- Decision: D-12
- Affects: docs/requirements.md §4 latency table
- History:
  - 2026-10-09 batch 3 — answered (user): "p95 under 2 s, request in to record written."
```

| Field | Content |
|---|---|
| Stage | The stage ID from the stage map. |
| Layer | `product` (what and why; owned by the PRD), `design-input` (a fact, promise, constraint or policy the design must meet), or `design` (how it is built). The interview settles product and design-input questions only. A `design` question is recorded and `deferred` to system-design reasoning. |
| Thread | Optional. `observability` when the question settles part of the Observability map; list it in that row's Questions cell too. |
| Purpose | What the answer decides or unlocks. One sentence. |
| Sources | Checklist IDs (`SD-x.y`), pack questions (`pack:<track>/<id>`), or `project` for a project-specific question. |
| Depends on | Question IDs whose answers this one needs, or `—`. |
| Status | See the table below. |
| Evidence | File and section, a URL with the date checked, or the decision record entry. For a user answer, the batch and date. |
| Answer / Proposed default | The current answer. Before it is answered, an optional `Proposed default:` labelled as a proposal, never as a requirement. |
| Decision | The resulting decision ID or one-line conclusion. For `deferred`, where it went. For `retired`, why. |
| Affects | The owning document and section the answer changed or will change. |
| History | Append-only. One line per answer, change or status move that matters, with date, batch and who supplied it. |

## Question status

| Status | Meaning | Open? |
|---|---|---|
| `provisional` | Drafted for a later stage. Wording waits on earlier answers. Never presented as a requirement. | yes |
| `ready` | Concrete wording; every dependency is answered. Queued for a batch. | yes |
| `asked` | In the batch currently with the user. | yes |
| `answered` | The user answered. Evidence names the batch or decision entry. | no |
| `carried` | Settled by an existing document before the interview asked. Evidence cites it. Shown to the user for review; the user can reopen it. | no |
| `deferred` | Moved out of the interview, with its destination in `Decision` (for example system-design reasoning, or a named owner). | no |
| `retired` | No longer applies. `Decision` gives the reason. | no |
| `revisit` | An answer it depends on changed. Must be re-checked before the interview completes. | yes |

## Checklist coverage

Generate the rows with `python3 scripts/interview.py skeleton` so every item of
`system-design-readiness/CHECKLIST.md` is present, then give each row a disposition during setup.

```markdown
| ID | Kind | Tier | Stage | Disposition | Evidence, reason or plan | Questions |
|---|---|---|---|---|---|---|
| SD-1.1 | Issued | Core | S1 | answered | brief §2 "advisors comparing contracts" | Q-002 |
| SD-3.2 | Measure | Full | S3 | assumed | Assumed 10 actions/user/day, no data yet. Plan: count actions in the demo-session trace. | Q-011 |
| SD-4.6 | External + Decision | Legacy | S4 | n/a | Legacy tier does not apply: no existing system is extended. | — |
| SD-1.6 | Issued → Decision if silent | Core | S1 | needs-decision | Brief silent on spend (checked brief, portal). | Q-005 |
```

| Disposition | Meaning | Required in the evidence cell |
|---|---|---|
| `answered` | Settled, with evidence: an issued or external source, or a recorded user decision. Equals readiness *Found* or *Decided*. | The citation or decision entry. |
| `needs-decision` | The user must decide. | What was checked and the question that will close it. |
| `needs-research` | A fact must be found: an external source to research, or an issued fact to request from whoever issued the brief. Never filled with a guess. | Where to look or whom to ask. |
| `assumed` | A labelled stand-in for something only running code can tell. Allowed only for items whose Kind includes **Measure**. Equals readiness *Assumed*. | The value, its basis, and `Plan:` naming the measurement that replaces it. |
| `n/a` | Does not apply. Equals readiness *N/A*. | The one-line reason, including tiers ruled out. |

Every row keeps its disposition even when its tier does not apply; an inapplicable tier is an
`n/a` with that reason, never a missing row. Keep `|` out of cells (use `/`).

## Observability map

One row for every stage that appears in the checklist coverage (S1–S8 by default). It uses the
same five dispositions and the same evidence rules as the coverage table. A row is `answered`
only when that stage's observability questions are settled. The row's `n/a` needs a reason, such
as "S5 light: single local process; per-stage timing comes from the run log (Q-021)".

```markdown
| Stage | What must be known | Items | Questions | Disposition | Evidence, reason or plan |
|---|---|---|---|---|---|
| S1 | What may be recorded, who reads it, retention, export | SD-1.8, SD-1.10 | Q-004 | answered | D-3: no raw user text in logs; 30-day local retention |
| S4 | Run stages, waits, timed boundaries, run ID | SD-4.7, SD-4.3 | Q-015 | needs-decision | Flow known; which boundaries to time is open |
| S8 | Runtime capture, AI run trace, redesign triggers | SD-8.4, SD-8.6, SD-8.7 | Q-030, Q-031 | assumed | Extractor p95 assumed 3 s. Plan: measure in benchmark run B-1 |
```

The questions to draw from, stage by stage, are in `observability.md`. Keep operational success
and output correctness in separate questions and separate evidence.

## Answer changes

When the user changes an answer:

1. Append a History line: `YYYY-MM-DD batch N — changed (user): "<new>" (was: "<old>")`. Keep the
   old answer in History; replace only the current `Answer`.
2. Find everything downstream: questions whose `Depends on` names this ID, coverage rows that cite
   it, and every `Affects` section reconciled from it.
3. Set those questions to `revisit` and add to the History of each:
   `revisit — Q-007 changed on YYYY-MM-DD`.
4. List the affected conclusions and owner sections in the batch log, and reconcile the owners
   (or queue the change for their owner, see SKILL.md step 5).

## Completion gate

The interview is **complete** when all of these hold:

1. Every checklist row has a disposition of `answered`, `assumed` (Measure items, with a plan) or
   `n/a` (with a reason). No `needs-decision` or `needs-research` remains.
2. Every Observability map row has a closed disposition, with a row for every stage in the
   coverage table. Operational success and output correctness are settled separately; for a
   model or agent system, SD-8.7 says what one run's trace holds and S1 says what it may hold.
3. Every question is `answered`, `carried`, `deferred` or `retired`. None is `provisional`,
   `ready`, `asked` or `revisit`.
4. Every external fact carries a source and the date it was checked.
5. No value is written as a measurement unless it was measured; assumptions are labelled.
6. Every answer that changes an owner document has been reconciled into it, or is queued with its
   owner named in the batch log.
7. Every required design output has a register row with an owner, a known location and sources,
   or is `n/a` with a reason. **Answered questions never stand in for a missing row.**

`python3 scripts/interview.py check <doc> --complete` checks 1–3, 7 and the structure, including a
missing or incomplete Observability map. Items 4–6 and the content of the observability answers
are judgement; confirm them before declaring completion.

Completion is not PRD approval, not design readiness and not ticket readiness. Approval is the
user's explicit word on the revised PRD; design readiness is the `system-design-readiness`
verdict; ticket readiness is the separate gate that every design output is `ready`
(`DESIGN-OUTPUTS.md` → *Four gates*). Record each in **Resume here** when it happens.
