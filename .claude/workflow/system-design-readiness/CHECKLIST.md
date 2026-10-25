# System Design Readiness Checklist

This lists the information a Gauntlet system design needs, grouped by the step of `GUIDELINE.md`
that uses it. The question it answers is: **is this already written down somewhere I can cite, and
if not, how do I get it?**

Each item has a stable ID (`SD-<step>.<n>`). Never renumber or reuse an ID; retire one by striking
it through and noting why.

---

## How to read an item

**Kind** says where the answer comes from, and so what to do when it's missing:

| Kind | Who can supply it | When it's missing |
|---|---|---|
| **Issued** | Only the assignment, the hiring partner or Gauntlet staff | **Go find it.** Check the issued sources again, then ask staff or the partner, and log it in the open questions. Never fill it with a plausible guess. |
| **External** | The outside world: vendor API docs, pricing pages, the legacy codebase, framework docs | **Research it.** Cite the page or file and the date you checked it. |
| **Decision** | Innocent | **Decide it.** Claude explains the concept and offers 2–4 options with a recommendation; the choice goes in the project's decision record. |
| **Measure** | Only running code: a spike, a benchmark, an eval | **Assume it for now.** Write a labelled assumption plus the test that will replace it. This never blocks the design. |

**Issued sources that are silent vs. ambiguous.** If the brief simply doesn't address something
(there's no latency target, say), the item becomes a **Decision**, with a note naming the sources
checked. If the brief addresses it but can't be pinned down (for example "design it for 30,000 to
50,000 users", relayed in the cohort session at [00:16:29], which doesn't say whether that means
registered, daily-active or concurrent users), the item is **Missing** and you go and ask. Ambiguity
is the gap that bites in the interview.

**Tier** says when the item is required:

| Tier | Required when |
|---|---|
| **Core** | Always. |
| **Full** | The step it feeds is set to *full* depth (see `GUIDELINE.md` → *Set the depth*). |
| **AI** | A model makes or shapes any decision in the system. |
| **Legacy** | The work is built inside an existing system (e.g. OpenEMR). |

"Usually found in" names where Gauntlet repos have kept this so far. Check the project's own
source ranking (its `CLAUDE.md`) first; it overrides these hints.

---

## Step 1 — Frame the problem

| ID | Information needed | Kind | Tier | Usually found in |
|---|---|---|---|---|
| SD-1.1 | Who the users are, what they're trying to do, and what a useful result looks like | Issued | Core | Brief / PRD, `USERS.md` |
| SD-1.2 | What the project must prove, and how it's judged (deliverables, demo, interview) | Issued | Core | Brief, portal page, `SUBMISSION.md` |
| SD-1.3 | What's ruled out: non-goals, forbidden approaches, out-of-scope features | Issued | Core | Brief, requirements doc's non-requirements, project `CLAUDE.md` |
| SD-1.4 | Required stack, existing systems, and integrations that must be used | Issued | Core | PRD, `legacy-integration-constraints.md` |
| SD-1.5 | Deadline, checkpoints, and who's building it | Issued | Core | Syllabus, portal page, `status.md` |
| SD-1.6 | Spending ceiling: hosting, model spend, paid APIs | Issued → Decision if silent | Core | Brief; otherwise decide |
| SD-1.7 | Economics: what one successful outcome earns or saves, and the margin. This sets the cost budget per outcome. Zach called this "step 1" [00:12:38] | Issued / External | Full | Brief, business-model source doc |
| SD-1.8 | Data-handling limits: personal or health data, synthetic-only, retention | Issued | Core | PRD, `synthetic-test-data.md` |
| SD-1.9 | **The hardest uncertainty**: what the project most needs to prove. This sets the depth of every later step | Decision | Core | Requirements doc, or decide now |
| SD-1.10 | Telemetry data policy: what logs and traces may record raw, redacted or never; who may read them; how long they're kept; what may leave the environment (for example to a hosted vendor). GP-59 | Issued → Decision if silent | Core | PRD, data-handling rules, `AUDIT.md`; otherwise decide |

## Step 2 — Measurable promises

| ID | Information needed | Kind | Tier | Usually found in |
|---|---|---|---|---|
| SD-2.1 | The 3–5 operations that matter most | Decision (from the PRD's use cases) | Core | PRD use cases, `USERS.md` |
| SD-2.2 | Correctness invariants for each of those operations: what must never happen | Issued + Decision | Core | Brief, requirements doc |
| SD-2.3 | Latency target per operation: which percentile, and where timing starts and stops | Issued → Decision if silent | Core | Brief, `KEY_METRICS.md` |
| SD-2.4 | Freshness: how old each kind of data may be when it's used. This is separate from latency | Decision | Core if data changes after ingestion | Requirements doc |
| SD-2.5 | Availability: which operations must keep working when a dependency is down | Decision | Core | Requirements doc |
| SD-2.6 | Recovery: how much data you can lose and how long recovery may take (RPO and RTO) | Decision | Full | Requirements doc |
| SD-2.7 | Quality metrics for model output (groundedness, correct refusal, tool choice), each with a baseline and target | Decision | AI | `KEY_METRICS.md` (`design-doc-defense.md` rule 6) |
| SD-2.8 | Operational success per key operation (completed, degraded, timed out, failed), defined separately from whether the output was correct. A run can succeed and still be wrong (GP-58) | Decision | Core | Requirements doc, `KEY_METRICS.md` |
| SD-2.9 | Key metrics: for each, its purpose, the decision it informs, its population or denominator, and whether a target is approved or the metric is measurement-only. Operational success, correctness, coverage, validation and safe refusal are separate metrics | Decision | Core | `KEY_METRICS.md`, key-metrics registry (`DESIGN-OUTPUTS.md` DO-7) |

## Step 3 — Workload model

| ID | Information needed | Kind | Tier | Usually found in |
|---|---|---|---|---|
| SD-3.1 | The user target **and which kind**: registered, daily-active or concurrent | Issued | Full; Core if the brief gives any number | Brief, staff answer |
| SD-3.2 | Actions per user per day, and requests per action | Measure | Full | Assume, then measure in the demo |
| SD-3.3 | Request mix: reads, writes, searches and model calls, with the share of each | Measure | Full | Assume, then measure |
| SD-3.4 | Peak factor, and how long a burst lasts | Issued → Decision if silent | Full | Brief; otherwise assume |
| SD-3.5 | Work that runs without users: ingestion, polling, re-indexing, scheduled jobs, and how much of it | External | Core if any exists | Vendor docs (how many markets or records, how often they update) |
| SD-3.6 | Request and record sizes, records per day, and how long they're kept | External / Measure | Full | Vendor docs, sample payloads |
| SD-3.7 | Every workflow and entry point that does work: user operations, background and scheduled jobs, validation and eval runs, development experiments, deploys, migrations and operator scripts. Each must be covered by the observability contract and the evaluation plan, or excluded with a reason | Decision | Core | Requirements doc, `ARCHITECTURE.md`, observability contract (DO-6) |

## Step 4 — Logical flow

| ID | Information needed | Kind | Tier | Usually found in |
|---|---|---|---|---|
| SD-4.1 | Who owns each authoritative record (data authority) | Issued for legacy, otherwise Decision | Core | `legacy-integration-constraints.md`, `ARCHITECTURE.md` |
| SD-4.2 | Every external dependency on the request path: its API docs, auth, schemas, and what it returns | External | Core | Vendor docs, codebase |
| SD-4.3 | Every place a model makes a decision, and why deterministic code (one rung lower) wouldn't do | Decision | AI | `ARCHITECTURE.md` (`design-doc-defense.md` rule 2) |
| SD-4.4 | What must happen during the request, what can be prepared beforehand, and what can run afterwards | Decision | Core | Requirements doc |
| SD-4.5 | What happens when a multi-step operation half succeeds | Decision | Core | Requirements doc |
| SD-4.6 | The seam into the legacy system (API, service layer or SQL), and what each option costs | External + Decision | Legacy | `ARCHITECTURE.md` (`legacy-integration-constraints.md` rule 4) |
| SD-4.7 | For each key operation, the stages one run passes through, where work waits or queues, and the stage boundaries that will be timed and linked under one run ID | Decision | Core | `ARCHITECTURE.md`, requirements doc |

## Step 5 — Resource demand

| ID | Information needed | Kind | Tier | Usually found in |
|---|---|---|---|---|
| SD-5.1 | CPU time per request, as distinct from elapsed time | Measure | Full | Spike benchmark |
| SD-5.2 | Database work: queries per request, how long each holds a connection, pool size | Measure | Full | Spike benchmark, trace |
| SD-5.3 | Model work per successful outcome: number of calls, tokens in and out, latency | Measure | AI | Spike, trace, `cost-analysis.md` |
| SD-5.4 | Model prices, rate limits and context limits for the candidate models | External | AI | Provider pricing and limits pages (date checked) |
| SD-5.5 | Third-party API quotas and rate limits | External | Core if any | Vendor docs (date checked) |
| SD-5.6 | How the runtime handles concurrency: event loop, worker count, process pool. Zach traced his own slowdown to "the single event loop thing" [00:49:43]; this is what the OpenEMR 50-user failure turned on | External | Full | Framework docs, server config |

## Step 6 — Overload and failure behaviour

| ID | Information needed | Kind | Tier | Usually found in |
|---|---|---|---|---|
| SD-6.1 | For each key operation under overload: wait, defer, degrade, throttle or fail fast | Decision | Core | Requirements doc |
| SD-6.2 | Timeout and retry policy per dependency, and which operations are safe to repeat (idempotent) | Decision | Core | Requirements doc |
| SD-6.3 | How each dependency fails: error codes, rate-limit responses, known outage behaviour | External | Core | Vendor docs, status pages |
| SD-6.4 | For each operation, what to do with stale or unreachable data: serve it labelled, or refuse | Decision | Core if there's external data | Requirements doc |
| SD-6.5 | Queue limits, and the oldest a queued job may get before it's useless | Decision | Full | Requirements doc |
| SD-6.6 | The signal that shows each failure or overload policy firing, and the signal that shows recovery (error and retry counts, queue age, health and readiness checks, alerts) | Decision | Core | Requirements doc, ops doc |

## Step 7 — Deployment

| ID | Information needed | Kind | Tier | Usually found in |
|---|---|---|---|---|
| SD-7.1 | Where it must run: an issued hosting requirement, or explicitly dropped | Issued | Core | Brief, decision record |
| SD-7.2 | The failure the deployment must survive: none, one replica, or one zone | Decision | Full | Requirements doc |
| SD-7.3 | How much one replica can handle while meeting the targets | Measure | Full | Load test |
| SD-7.4 | Prices for every paid component: hosting, database, storage, model, monitoring | External | Core | Pricing pages (date checked), `cost-analysis.md` |
| SD-7.5 | What Innocent can run and debug alone in the time available | Decision | Core | — |
| SD-7.6 | Where logs, metrics and traces are stored and read (local files, self-hosted, hosted vendor), and the constraint that chose it. No tool is assumed (GP-60, GP-63) | Decision | Core | `ARCHITECTURE.md` tool rows |

## Step 8 — Validation

| ID | Information needed | Kind | Tier | Usually found in |
|---|---|---|---|---|
| SD-8.1 | Ground truth for correctness evals: where the labelled cases come from | External / Decision | Core | Evaluation plan (`templates/evaluation-plan.md`; AI layers in `gauntlet-prd-workflow/templates/eval-plan.md`) |
| SD-8.2 | Test data that's realistic and allowed | Issued / External | Core | PRD, `synthetic-test-data.md` |
| SD-8.3 | Load-test tool, environment and request mix | Decision | Full | `load-baselines.md` or equivalent |
| SD-8.4 | What gets traced and measured while it runs | Decision | Core | `verification-evals-observability.md` |
| SD-8.5 | Which graded item each design claim's evidence goes into | Issued | Core | `SUBMISSION.md` |
| SD-8.6 | Which measurement would trigger a redesign. Zach: "you fix the thing that breaks first for whatever load that you're at" [00:46:19] | Decision | Core | Requirements doc |
| SD-8.7 | What one model or agent run's trace holds: the run and its steps; what each model or agent saw (assembled input) and produced (raw output); model, prompt and tool versions; tool calls and results; failures; latency, tokens and cost per step (GP-56, GP-57) | Decision | AI | `ARCHITECTURE.md`, eval plan capture list |
| SD-8.8 | Expected-answer authority and case provenance: who or what decides the correct answer for each evaluated behaviour (issued spec, named reviewer, deterministic rule, external reference; never the model under test), and how each case records where it came from | Issued → Decision if silent | Core | Brief / PRD acceptance criteria, evaluation plan (DO-5) |
| SD-8.9 | Development versus held-out separation: which cases may be read and tuned against while building, which are held out, and who may read the held-out set | Decision | AI | Evaluation plan (DO-5) |

---

## Readiness gate

The design can start when **every required item** (Core, plus the Full / AI / Legacy items that
apply) has one of these statuses:

| Status | Meaning | Allowed for |
|---|---|---|
| **Found** | Cited to a file and section (or a URL and the date checked) | Issued, External, Measure |
| **Decided** | Choice made and recorded in the project's decision record | Decision, and Issued items the sources are silent on |
| **Assumed** | A labelled stand-in, with the test that will replace it | Measure only |
| **N/A** | Doesn't apply, with a one-line reason | Any |

**Missing** blocks the design when it's on an Issued or External item. A missing Decision is closed
in the same session by the interview. A Measure item is never Missing, because it can always be
written as an Assumption.

The gate also needs the **design outputs register** (`DESIGN-OUTPUTS.md`): every required output
has an owner, a location and sources citing the readiness items it draws on
(`scripts/design_outputs.py check <register> --gate readiness`). READY means the design can start;
it does not mean the design is done. Tickets wait for the separate *ticket ready* gate.

Adding an item: give it the next free ID in its step, a Kind, a Tier and a "usually found in" hint.
Add a source line if it came from a session or a lecture.

Added 2026-10-08: SD-1.10, SD-2.8, SD-4.7, SD-6.6, SD-7.6 and SD-8.7, so observability is covered
at each step instead of only by SD-8.4. Sources: `principles/observability-in-practice.md`
(GP-56 – GP-63), `principles/evals-and-observability.md` (GP-22, GP-23) and
`.claude/rules/verification-evals-observability.md`. *Observability across the steps* in
`GUIDELINE.md` explains how they fit together.

Added 2026-10-11: SD-2.9, SD-3.7, SD-8.8 and SD-8.9, so key metrics, the full set of workflows,
who decides a correct answer and held-out separation are settled as inputs instead of being left
to whoever writes the tickets. They feed the required design outputs DO-5, DO-6 and DO-7
(`DESIGN-OUTPUTS.md`). The checklist now has 60 items.
