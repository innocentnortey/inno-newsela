# Evaluation plan — <system>

<!-- DO-5. Answers "was it right?" — never "did it run?" (that is the observability contract).
Contract: system-design-readiness/DESIGN-OUTPUTS.md → Evaluation plan. Every section below is
required; write "N/A — <reason>" only where the contract allows it. A deterministic system keeps
this short; it does not delete it. AI and retrieval systems add the component layers from
gauntlet-prd-workflow/templates/eval-plan.md under Scoring.
Check: python3 <readiness>/scripts/design_outputs.py check-eval <this file> -->

> Owner: <name> · Status: draft / ready · Sources: <SD-8.1, SD-8.8, SD-8.9, SD-2.7, PRD §…>

## Expected-answer authority

| Behaviour evaluated | Who or what decides the correct answer | Where that authority is written |
|---|---|---|
| <e.g. route selection> | <issued spec / named reviewer / deterministic rule / external reference> | <PRD §4.2, D-12> |

## Case provenance

<Where cases come from — issued, hand-written, synthetic from a known source, promoted from a
reviewed trace — and the field each case uses to record its origin (e.g. `provenance:` in the case
file). Unreviewed traces never become cases.>

## Development and held-out separation

<Which cases may be read and tuned against while building; which are held out; who may read the
held-out set and how it is kept out of agent context. Or: N/A — <nothing is tuned against cases,
because …>.>

## Scoring

| Suite | Grader (assertion / invariant / trajectory / judge / human) | Case score | Roll-up |
|---|---|---|---|
| | | | |

## Failure categories

| Category | Means | Fix lives in |
|---|---|---|
| | | |

## Baselines

| Suite | Baseline | Source |
|---|---|---|
| | <value, or "none yet — Plan: first run of …"> | |

## Acceptance conditions

| Suite | Accepts when | Metric (DO-7) | Approved by |
|---|---|---|---|
| | <invariant for safety/refusal; threshold only if approved> | <M-n> | <decision ID> |

## Verification and evidence

| Suite | Command or procedure | Evidence a reviewer sees |
|---|---|---|
| | | <report path, run ID> |
