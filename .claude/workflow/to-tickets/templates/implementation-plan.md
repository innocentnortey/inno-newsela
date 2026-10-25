# Plan — [<PREFIX-NN>] <ticket title>

**Status:** planned <!-- planned / NEEDS-DECISION / BLOCKED-ON / built -->
**Issue:** <URL> · **Base revision:** <commit>

## Goal

<Quoted from the issue's "What to build", with a pointer to it.>

## Context

<At most six lines: the situation that produced this ticket, so a reader can tell later whether
the plan is still relevant.>

## Sources checked

<!-- Open every governing source, not only the issue. Each row: where it is, and what it obliges for
THIS ticket's workflows and components. n/a needs a reason. -->

| Source | Location | What it obliges here |
|---|---|---|
| Requirements | <PRD / requirements §…> | |
| Component contracts | <DO-4 location> | |
| Evaluation plan | <DO-5 location> | |
| Observability contract | <DO-6 location; rows WF-…> | |
| Key-metrics registry | <DO-7 location; M-…> | |
| Interface spec and readiness | <docs/contracts/INTERFACE.md: CON-… and status; SCR-… sign-off for frontend; `ticket_readiness.py` result; or n/a — <reason>> | |

## Source-contract reconciliation

<!-- List EVERY obligation the sources above place on this ticket, including the ones the issue
already states. Do not just copy the issue's acceptance criteria: the point is to catch what the
issue omitted. Dispositions:
  in-ticket       the issue already requires it — cite the AC-n
  added           the issue omitted it; this plan delivers it (name the step) and the issue gets a
                  comment proposing the added criterion
  other-ticket    another ticket owns it — name that ticket (check its AC actually covers it)
  needs-decision  a consequential conflict or gap; Status becomes NEEDS-DECISION
  blocked-on      a missing prerequisite; Status becomes BLOCKED-ON
  n/a             does not apply here — give the reason -->

| Obligation | Governing source | In ticket | Disposition | Plan step or owner |
|---|---|---|---|---|
| | | | | |

## Entry-point registration

<!-- Every entry point or experiment this ticket adds or changes must already have a WF-n row in
the observability contract, with the evaluation and metrics it inherits. If not, register it first
(or set Status: BLOCKED-ON). Write a single "None" row if there are none. -->

| Entry point | Workflow | Registered in contract | Inherits |
|---|---|---|---|
| None | — | — | — |

## Acceptance criteria

<The issue's criteria verbatim, then any criteria added by reconciliation marked "(plan-added)",
each with its verification method and evidence path.>

## File map

| File | Current or planned | Change |
|---|---|---|
| | | |

## Steps

1. 

## Risks and edge cases

- 

## Checks and evidence

| Check | Command | Evidence |
|---|---|---|
| Capture verification (each WF this ticket touches) | | |
| Evaluation check (if Evaluation is not N/A) | | |
| | | |

## Gates

<Human, external, paid or live gates, or None.>
