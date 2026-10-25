# Observability thread

Observability runs through every stage of the interview, not just one question about tracing at
the end. Each stage settles part of what the running system must let someone see. The interview
document's **Observability map** keeps one row per stage, so a gap shows up at the stage that owns
it.

The framework is the eight steps of `system-design-readiness/GUIDELINE.md` (stages S1–S8). Read
its *Observability across the steps* section for the reasoning; this file is the question bank.

## Two rules that shape every question

1. **Did it run, or was it right?** Operational success (completed, degraded, timed out, failed;
   latency; errors) and output correctness (evals, review, quality metrics) are separate signals
   with separate owners. Never let one stand in for the other (GP-58).
2. **No default tool or architecture.** Do not assume LangSmith, Langfuse, OpenTelemetry, a hosted
   backend, a dashboard or a multi-agent design. A single local process may need only structured
   logs keyed by a run ID. The project's constraints choose the tool (GP-60, GP-63). If a project
   rule or issued brief already names one, cite it as a constraint.

## Questions by stage

Treat these as provisional question templates. Ask only the ones the project's depth and tiers
make applicable, rewrite them in the project's terms, and mark carried answers with their
citations. Items marked **AI** apply only when a model or agent makes or shapes a decision.

| Stage | What to establish | Readiness items |
|---|---|---|
| S1 Frame | What logs and traces may record raw, redacted or never. Who may read them. How long they are kept. What may be exported or sent to a vendor. Any issued rule on sensitive data. | SD-1.8, SD-1.10 |
| S2 Promises | For each key operation, what counts as operational success, and separately how correctness is judged. **AI:** which quality metrics, with baseline and target. | SD-2.8, SD-2.7, SD-2.3 |
| S3 Workload | The workload classes to count and their expected volumes, including background work such as ingestion, polling and scheduled jobs. **Every workflow and entry point the system has**: user operations, background jobs, validation and eval runs, development experiments, deploys, migrations and operator scripts. Each becomes a row in the observability contract or is excluded with a reason. | SD-3.1 – SD-3.7 |
| S4 Flow | The stages one run passes through. Where work waits or queues. Which boundaries are timed. How one run is linked end to end (a run or correlation ID). **AI:** each place a model or agent decides, so its step can be traced. | SD-4.7, SD-4.3, SD-4.4 |
| S5 Resources | Time and resource use per stage: CPU, database, model, external API. **AI:** tokens, calls and cost per successful outcome. | SD-5.1 – SD-5.3, SD-5.5 |
| S6 Failure | The signal that each failure or overload policy fired: errors, retries, timeouts, rate limits, queue age. The signal that recovery happened. Who or what notices: an alert, a health check, a person reading a log. | SD-6.6, SD-6.3, SD-6.5 |
| S7 Deployment | Where logs, metrics and traces live and are read: local files, self-hosted or hosted. Who can operate and debug them. The constraint that chose them. Whether the S1 policy allows what that location implies. | SD-7.6, SD-7.5 |
| S8 Validation | What is captured while it runs and how it is checked. Which measurements would trigger a design change, including the first bottleneck to watch. **AI:** what one run's trace holds (below), and whether reviewed traces may become eval cases. | SD-8.4, SD-8.6, SD-8.7, SD-8.1 |

## Model and agent runs (AI tier)

When a model or agent is involved, establish whether one run can be reconstructed from what is
recorded, and what that record holds:

- the run and its ordered steps, nested under one ID (GP-57);
- what each model or agent **saw**: the assembled input, meaning prompt, instructions, retrieved
  items and tool results, not just the user's text (GP-56);
- what each one **produced**: the raw output before parsing, and the parsed result;
- versions: model, prompt or template, tool definitions, retrieval index or corpus;
- tool calls with arguments and result status;
- failures, retries, refusals and the stop reason;
- latency, tokens and cost per step and per run.

Then check it against the S1 policy. Full assembled inputs may contain exactly what the policy
forbids, so decide what is redacted, at which point, and before any export (GP-59).

If no model or agent is involved, the Observability map rows still exist. The AI parts are `n/a`
with that reason.

## Where the answers go

Observability answers are design inputs, not engineering design. Record the policy, signals,
promises and constraints. Defer schemas, span names, libraries and dashboards to the design
handoff:

They land in one required output, the **observability contract** (DO-6 in
`system-design-readiness/DESIGN-OUTPUTS.md`), filled across the handoff:

| Handoff step | What it does with the observability answers |
|---|---|
| System-design reasoning | Places the run and stage structure, the operational and quality signals, the telemetry location and the policy into the design, and checks them against workload and cost |
| Architecture | Assigns which component emits which signal, how the run ID crosses boundaries, and where redaction happens: semantic contracts. Writes the workflow registry: one `WF-n` row per workflow from SD-3.7 |
| Code design | Fixes exact log, trace and metric fields, span names and the redaction function: exact contracts |
| Tickets (`to-tickets`) | Traces every observability requirement through every workflow to the ticket that integrates it, not only the ticket that builds the shared emitter |
| Implementation planning | Turns them into tasks, each with evidence that the signal is actually captured at the real entry point and that forbidden data is absent; registers any new entry point or experiment before it runs |
