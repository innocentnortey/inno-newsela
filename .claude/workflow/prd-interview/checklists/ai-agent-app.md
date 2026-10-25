# Checklist: AI-Agent Application PRD
- Version: 1.0.0
- Track: ai-agent-app
- Description: Detailed PRD interview for AI-agent applications — domain rigor, evals, verification, failure modes, security, ops.

## Phase 1: Constraints
### domain
- Prompt: Which domain — healthcare, insurance, finance, legal, or custom? What specific use cases?
- Required: true
- Section: problem-objective
- Escalate: verification, reliability, human-in-loop, audit, testing

### data-sources
- Prompt: What data sources / knowledge does the agent need access to?
- Required: true
- Section: tool-integration

### audience-tone
- Prompt: Reading level or age range, accessibility needs, and any terminology to use or avoid in agent output?
- Required: false
- Default: general audience; no reading-level, accessibility, or terminology constraints
- Section: audience-tone-constraints

### motion-profile
- Prompt: Which motion profile fits the agent's UI — product (restrained app UI), marketing (a landing page that can be expressive), game (playful, overshoot is correct), or editorial (reading-first, motion serves the text)?
- Required: false
- Default: product — restrained app-UI motion
- Section: motion-profile

### scale
- Prompt: Expected query volume, acceptable latency, concurrency, and LLM cost constraints?
- Required: true
- Section: non-functional-requirements

### reliability
- Prompt: What's the cost of a wrong answer here? What verification is non-negotiable?
- Required: true
- Section: verification-correctness

### human-in-loop
- Prompt: Where is a human required in the loop, and for what decisions?
- Required: false
- Default: no human-in-loop for v1; add if stakes are high
- Section: verification-correctness

### audit
- Prompt: Audit / compliance / logging requirements?
- Required: false
- Default: standard app logging; no regulated-audit trail
- Section: failure-modes-security

## Phase 2: Architecture
### agent-framework
- Prompt: LangChain / LangGraph / CrewAI / custom? Single- or multi-agent? State management needs?
- Required: false
- Default: custom, single-agent; revisit if tool count or coordination grows
- Section: system-architecture

### llm-selection
- Prompt: Which LLM (Claude / GPT / open-source)? Function-calling and context-window needs? Cost/query?
- Required: false
- Default: latest Claude for quality; revisit cost after a working prototype
- Section: system-architecture

### tools
- Prompt: What tools does the agent need? External APIs? Mock vs real data for dev? Per-tool error handling?
- Required: true
- Section: tool-integration

## Phase 3: Correctness & Verification
### eval-approach
- Prompt: How will you measure correctness? Ground-truth source? Automated vs human eval? CI integration?
- Required: true
- Section: verification-correctness

### verification
- Prompt: Which claims must be fact-checked, against what sources, at what confidence threshold? Escalation triggers?
- Required: false
- Default: no external fact-check for v1; flag low-confidence answers to the user
- Section: verification-correctness

### observability
- Prompt: Observability stack (LangSmith / Braintrust / other)? Key metrics? Real-time monitoring? Cost tracking?
- Required: false
- Default: structured logs + basic cost tracking; add tracing when traffic grows
- Section: observability-ops

## Phase 4: Refinement
### failure-modes
- Prompt: What happens when tools fail or a query is ambiguous? Rate-limiting, fallback, graceful degradation?
- Required: true
- Section: failure-modes-security

### security
- Prompt: Prompt-injection prevention? Data-leakage risks? API-key management? Audit logging?
- Required: false
- Default: input sanitization + secrets in env only; revisit before external exposure
- Section: failure-modes-security

### testing
- Prompt: Testing strategy — unit (tools), integration (agent flows), adversarial, regression?
- Required: true
- Section: testing-strategy

### deployment
- Prompt: Hosting, CI/CD for agent updates, monitoring/alerting, rollback strategy?
- Required: false
- Default: single-environment deploy; manual rollback; add CI/CD after v1
- Section: observability-ops

### iteration
- Prompt: How will you collect feedback and run an eval-driven improvement cycle? Open-source/licensing plans?
- Required: false
- Default: collect user feedback informally; eval-driven cycle once metrics exist
- Section: release-iteration

## Phase 5: Acceptance
### acceptance
- Prompt: For each core capability, state one concrete, testable acceptance criterion (input -> expected observable outcome).
- Required: true
- Section: acceptance-criteria

### use-cases-functional
- Prompt: List the specific agent capabilities/flows v1 must support (each becomes a requirement).
- Required: true
- Section: functional-requirements
