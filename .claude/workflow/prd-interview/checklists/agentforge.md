# Checklist: AgentForge (Gauntlet weekly sprint)
- Version: 1.0.0
- Track: agentforge
- Description: Gauntlet AgentForge sprint interview — the ai-agent-app track hardened with the PRD's hard gates and graded engineering requirements. Graded decisions have no defaults. Output feeds USERS.md, AUDIT.md, ARCHITECTURE.md and KEY_METRICS.md, not a replacement PRD.

## Phase 1: Brief & Users
### prd-hard-gates
- Prompt: Walk this week's PRD — which hard-gate deliverables does it require (files, deployed URL, videos, interviews, posts), with which deadlines, and what changed from last week's gates?
- Required: true
- Section: problem-objective

### carry-forward
- Prompt: What from previous weeks must this sprint build on or pay down — grader feedback, open TECH_DEBT.md items, architecture that has to be extended rather than replaced?
- Required: true
- Section: release-iteration

### domain-stakes
- Prompt: What is the domain, and what does a wrong or leaked answer cost here? (Clinical: patient harm, PHI exposure.)
- Required: true
- Section: problem-objective
- Escalate: human-in-loop, adversarial-testing, audit

### target-user
- Prompt: Who exactly is the narrow user (role, day shape, patient load), and what are they doing in the 30 seconds before they open the agent and right after they read its answer?
- Required: true
- Section: users-scope

### use-cases
- Prompt: List the specific use cases. For each — why is a conversational agent the right shape instead of a query, dashboard, sorted list or better chart view?
- Required: true
- Section: functional-requirements

### out-of-scope
- Prompt: What is explicitly out of scope this week — including things the agent must refuse to do?
- Required: true
- Section: users-scope

## Phase 2: Architecture decisions (no defaults)
### complexity-rung
- Prompt: For each capability — which rung does it need (single call / call with tools / ReAct loop / planner / multi-agent) and why would one rung lower fail? What stays deterministic code?
- Required: true
- Section: system-architecture
- Escalate: agentic-eval-plan

### integration-point
- Prompt: Where does the agent live in the legacy system (module, iframe, sidecar service), how does it read data (API vs database), and what core code, if any, changes?
- Required: true
- Section: system-architecture

### agent-framework
- Prompt: Which orchestration approach (LangGraph, raw tool-calling, other) and why — including state, checkpointing and how multi-turn memory works?
- Required: true
- Section: system-architecture

### llm-selection
- Prompt: Which model(s) for which roles, and why — tool-calling and structured-output needs, context window, latency, cost per interaction? Is any judge on a different model family?
- Required: true
- Section: system-architecture

### tools
- Prompt: List every tool — its one job, its description (when to use / when not to), input and output schema, error shape, idempotency, and the data source it touches.
- Required: true
- Section: tool-integration

### authorization
- Prompt: Who may ask what? Roles, patient/record scoping, how identity reaches the agent without being self-asserted, where the check runs between the model's tool request and execution, and which negative test proves it.
- Required: true
- Section: failure-modes-security

### loop-brakes
- Prompt: Values for the four brakes — max iterations, wall-clock timeout, token/dollar budget, circuit breaker on repeated calls — plus the happy-path stop and the latency budget per use case.
- Required: true
- Section: non-functional-requirements

## Phase 3: Verification & Evals
### verification-layer
- Prompt: Which verification rungs does each output path use (citation to source record, code-enforced domain rules, LLM judge, human)? What does each rung miss, and what does the agent say when evidence is missing?
- Required: true
- Section: verification-correctness

### human-in-loop
- Prompt: Which decisions or findings must a human approve, what evidence do they see, and what happens while they haven't?
- Required: false
- Default: no human approval step this week; the agent is advisory and read-only
- Section: verification-correctness

### agentic-eval-plan
- Prompt: (Only if there is an agent loop or retrieval — required when complexity-rung is a loop or above, or any RAG.) Define the Evaluation Plan in this domain using gauntlet-prd-workflow/templates/eval-plan.md: end-to-end evals (task completion, time to resolution, escalation to a human) and component evals for each layer present — retrieval (recall, precision, ranking by usefulness), agent behaviour (routing, planning, tool arguments, stopping), answer (correctness, grounding, citations, aggregation). For each: domain example, ground truth source, pass bar — and the trace fields observability must capture now so the eval can run later. Which are implemented at MVP, which deferred?
- Required: false
- Default: n/a — no agent loop or retrieval in this system
- Section: verification-correctness

### eval-suite
- Prompt: Describe the eval set — tool-selection, argument and final-answer cases; the boundary / invariant / regression each guards; ground-truth source; refusal cases; one-command run; CI gating.
- Required: true
- Section: testing-strategy

### adversarial-testing
- Prompt: Which adversarial cases are in the suite — prompt injection (direct and via uploaded content), unauthorized cross-record extraction, tool misuse, cost amplification?
- Required: false
- Default: a handful of unauthorized-access and direct-injection cases in the eval set
- Section: testing-strategy

### key-metrics
- Prompt: Which small set of metrics would you defend to a hospital CTO? Split quality (groundedness, correct refusal, tool accuracy) from operations (p95 latency, cost per interaction), each with baseline and target.
- Required: true
- Section: non-functional-requirements

## Phase 4: Engineering requirements (graded, not optional)
### correlation-ids
- Prompt: How is a correlation ID minted per agent invocation and carried into every log line, tool call, LLM call and downstream request?
- Required: true
- Section: observability-ops

### schemas-contracts
- Prompt: Which strict schemas (Pydantic / Zod) define every tool input/output and API request/response, and how do they stay the source of truth (generated specs, contract tests)?
- Required: true
- Section: tool-integration

### observability-dashboard
- Prompt: Which observability backend, and which dashboard panels — total requests, error rate, p50/p95 latency, tool-call counts, retries, verification pass/fail, plus agent-specific ones?
- Required: true
- Section: observability-ops

### alerts
- Prompt: Define at least three alerts — p95 latency, error rate, tool-failure rate — with thresholds, what each means, and the on-call response.
- Required: true
- Section: observability-ops

### health-ready
- Prompt: What does /health check versus /ready, and which real dependencies does /ready probe (legacy system API, LLM provider, observability backend, local stores)?
- Required: true
- Section: observability-ops

### api-collection
- Prompt: Which runnable API collection (Postman / Bruno) covers the core endpoints, and can a grader run every workflow from it without reading source?
- Required: true
- Section: testing-strategy

### load-baselines
- Prompt: How will you load-test the deployed agent at 10 and 50 concurrent users (tool, scenario), record p50/p95/p99 and error rate, and capture CPU, memory and throughput baselines?
- Required: true
- Section: non-functional-requirements

### phi-logging
- Prompt: How is PHI kept out of logs and traces (what is redacted, where, before export), and which test drives real flows while asserting no seeded identifiers appear?
- Required: true
- Section: failure-modes-security

### audit
- Prompt: Audit-logging, retention, breach-notification and BAA implications — including third parties beyond the LLM provider (observability, OCR, embeddings)?
- Required: false
- Default: access and agent actions logged with identifiers only; BAA assumed for the LLM provider only, other vendors noted as gaps
- Section: failure-modes-security

## Phase 5: Delivery
### failure-modes
- Prompt: What happens when a tool fails, a record is incomplete, the model returns something unexpected, or a provider rate-limits — and how is that shown to the user?
- Required: true
- Section: failure-modes-security

### deployment
- Prompt: Where is it deployed (the same infrastructure every week), what is the public URL, how do updates ship, and how do you roll back?
- Required: true
- Section: release-iteration

### cost-analysis
- Prompt: How is actual dev spend tracked, and what are production projections at 100 / 1K / 10K / 100K users — with the architecture change each tier forces?
- Required: true
- Section: non-functional-requirements

### demo-and-defense
- Prompt: What does the 3–5 minute demo show (including eval results), and which PRD interview questions are you rehearsing?
- Required: false
- Default: demo follows the top use case end to end, then eval results; rehearse the PRD's interview-preparation questions verbatim
- Section: release-iteration

### tech-debt
- Prompt: Which shortcuts are you taking for the early submission, and by which week must each be paid down?
- Required: false
- Default: track every shortcut in TECH_DEBT.md with a due week
- Section: open-questions

## Phase 6: Acceptance
### functional-list
- Prompt: List the capabilities this week must ship, each traced to a use case above (no capability without a use case).
- Required: true
- Section: functional-requirements

### acceptance
- Prompt: For each capability, state at least one concrete, testable acceptance criterion (input -> expected observable outcome), including one refusal or failure case.
- Required: true
- Section: acceptance-criteria
