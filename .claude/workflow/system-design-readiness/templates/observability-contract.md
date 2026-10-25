# Observability contract — <system>

<!-- DO-6. Answers "what ran, and can we prove it was captured?" for EVERY workflow — user
operations, background jobs, validation runs, development experiments and runtime operations.
Contract: system-design-readiness/DESIGN-OUTPUTS.md → Observability contract. No tracing tool is
assumed; the constraints choose it. Keep correctness out of here (that is the evaluation plan).
Check: python3 <readiness>/scripts/design_outputs.py check-obs <this file> -->

> Owner: <name> · Status: draft / ready · Sources: <SD-1.10, SD-3.7, SD-4.7, SD-6.6, SD-7.6, SD-8.4, SD-8.7>

## Covered workflows

Workflow registry. Every entry point that does work gets a row with a stable `WF-n` ID, including
scripts and experiments. "Eval and metrics" names what the workflow inherits, or `n/a — <reason>`.

| Workflow | Entry point | Class | Emitting components | Correlation | Required records | Capture verification | Eval and metrics |
|---|---|---|---|---|---|---|---|
| WF-1 | <route, command, job, script> | <class> | <components> | <ID and where it is created> | <record names> | <test or check> | <suite; M-…> |

Workflow classes. Every class gets a row; an absent class states why.

| Class | Present | Workflows or reason |
|---|---|---|
| user-operation | | |
| background-job | | |
| validation | | |
| development-experiment | | |
| runtime-operation | | |

## Correlation across boundaries

<The ID that links one run end to end, where it is minted, and how it crosses each process, queue,
job and service boundary. What links an experiment's runs to its configuration.>

## Storage and access

<Where each kind of record lives, how long it is kept, who can read it, and the constraint that
chose it.>

## Content and redaction

<What each record may hold raw, redacted or never; where redaction happens; what may leave the
environment.>

## Missing instrumentation

<How a run that emitted nothing or an incomplete record becomes visible: a completeness check, a
count that must match, a test that fails. Silence must never look like "no traffic".>

## Capture verification

<How each workflow's capture is proved: a test that drives the real entry point (not the shared
adapter alone) and asserts the required records exist and forbidden values are absent.>

## Registering a new workflow

Before a new entry point or experiment runs, its author:

1. adds a `WF-n` row above with its class, emitters, correlation and required records;
2. names the evaluation suites and metrics it inherits (or `n/a — <reason>`);
3. adds its capture check, which fails if the records are missing;
4. cites the `WF-n` in the ticket's *Entry points added or changed* line.
