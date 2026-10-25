# PRD interview — <project / scope>

> Skill: `prd-interview` v2.1.0 · Coverage checklist: `system-design-readiness/CHECKLIST.md`
> (inspected YYYY-MM-DD) · Question pack: <generic-prd / ai-agent-app / project pack / none>
> This document records the interview. Each answer names the document that owns it; when they
> disagree, the owner wins and this record is corrected. Format:
> `prd-interview/references/interview-document.md`.

## Resume here

- **Interview state:** setup / interviewing / waiting-on-sources / complete
- **Current stage:** S1 — Frame
- **Next batch:** Q-001, Q-002 (text in *Next batch*)
- **Blocked on:** <needs-research items and whom they wait on, or "nothing">
- **PRD approval:** draft, not approved / approved YYYY-MM-DD by <name>, revision <id>
- **Readiness verdict:** not run / NOT READY / READY — <path to the readiness report>
- **Last updated:** YYYY-MM-DD, batch <n>

## Sources read

| Source | Location | Authority | Revision or date read |
|---|---|---|---|
| <issued brief / PRD draft / decision record / …> | <path or URL> | <what it owns> | <rev / date> |

## Artifact map

| Work | Owner document | Location | State |
|---|---|---|---|
| Product requirements | PRD | <path> | exists / planned: <path> / unknown — ask |
| Decisions | Decision record | <path> | |
| Open questions | Open-questions list | <path> | |
| Design inputs | Requirements doc / readiness report | <path> | |
| Implementation planning | <tickets / plans> | <system or path> | |
| Coverage audit | `to-tickets` coverage audit | <path> | |

### Design outputs

<!-- Required. The seven outputs every design produces (system-design-readiness/DESIGN-OUTPUTS.md).
The interview records WHO owns each, WHERE it will live and WHICH answers feed it; the design fills
it. Answered questions never stand in for a missing row. A small project may point several rows
at named sections of one document (path#Heading). n/a needs its reason in Notes. -->

| ID | Output | Owner | Location | Sources | Status | Notes |
|---|---|---|---|---|---|---|
| DO-1 | System design | <name> | <path or path#Heading / unknown — ask> | <SD-x.y; Q-…> | planned | — |
| DO-2 | Architecture | | | | planned | — |
| DO-3 | Code design | | | | planned | — |
| DO-4 | Component contracts | | | | planned | — |
| DO-5 | Evaluation plan | | | SD-8.1, SD-8.8, SD-8.9, SD-2.7 | planned | — |
| DO-6 | Observability contract | | | SD-1.10, SD-3.7, SD-4.7, SD-8.4, SD-8.7 | planned | — |
| DO-7 | Key-metrics registry | | | SD-2.9, SD-2.8, SD-2.7 | planned | — |

## Stage map

| Stage | Topics | Checklist items | Depends on | Depth | State |
|---|---|---|---|---|---|
| S1 Frame | | SD-1.1 – SD-1.10 | — | full | prepared |
| S2 Requirements and promises | | SD-2.1 – SD-2.9 | S1 | | prepared / provisional |
| S3 Workload and data | | SD-3.1 – SD-3.7 | S1, S2 | | provisional |
| S4 Flow and dependencies | | SD-4.1 – SD-4.7 | S2 | | provisional |
| S5 Resources and cost | | SD-5.1 – SD-5.6, SD-7.4 | S3, S4 | | provisional |
| S6 Failure, overload and security | | SD-6.1 – SD-6.6 | S4 | | provisional |
| S7 Deployment and operations | | SD-7.1 – SD-7.3, SD-7.5, SD-7.6 | S1, S5 | | provisional |
| S8 Validation and evidence | | SD-8.1 – SD-8.9 | S2, S6 | | provisional |
| S9 Close | PRD approval, design-outputs register check, readiness check, handoff | — | S1–S8 | — | provisional |

## Next batch

**Stage S1 — Frame.** Carried answers to review: Q-00x (<one-line answer, citation>), …

1. **Q-001** — <question text, with a two-sentence explanation and 2–4 options when it is a decision>
2. **Q-002** — <…>

## Questions

### Q-001 — <short title>
- Stage: S1
- Layer: product / design-input / design
- Purpose: <what the answer decides or unlocks>
- Sources: SD-1.9
- Depends on: —
- Status: ready
- Evidence: —
- Answer: —
- Decision: —
- Affects: <owner document and section>
- History:
  - YYYY-MM-DD setup — drafted

## Observability map

<!-- One row per stage. Questions to draw from: prd-interview/references/observability.md.
Keep "did it run" and "was it right" in separate questions. No tool is assumed. -->

| Stage | What must be known | Items | Questions | Disposition | Evidence, reason or plan |
|---|---|---|---|---|---|
| S1 | What may be recorded raw / redacted / never; who reads it; retention; export | SD-1.8, SD-1.10 | | TBD | |
| S2 | Operational success per operation, kept apart from output correctness | SD-2.8, SD-2.7 | | TBD | |
| S3 | Every workflow and entry point to cover (jobs, validation, experiments, operator scripts); volumes to count | SD-3.1 – SD-3.7 | | TBD | |
| S4 | Run stages, waits and queues, timed boundaries, one run ID | SD-4.7, SD-4.3 | | TBD | |
| S5 | Time and resource use per stage; tokens and cost per outcome (AI) | SD-5.1 – SD-5.3 | | TBD | |
| S6 | Failure, overload and recovery signals | SD-6.6, SD-6.3, SD-6.5 | | TBD | |
| S7 | Where telemetry lives, who operates it, the constraint that chose it | SD-7.6, SD-7.5 | | TBD | |
| S8 | Runtime capture, model/agent run trace (AI), redesign triggers | SD-8.4, SD-8.7, SD-8.6 | | TBD | |

## Checklist coverage

<!-- Replace these rows with the output of `python3 scripts/interview.py skeleton`, then give
every row a disposition during setup. Never delete a row. -->

| ID | Kind | Tier | Stage | Disposition | Evidence, reason or plan | Questions |
|---|---|---|---|---|---|---|

## Batch log

| Batch | Date | Stage | Questions | Consequential inference | Reconciled into |
|---|---|---|---|---|---|
| 0 | YYYY-MM-DD | setup | — | <what the sweep established> | — |
