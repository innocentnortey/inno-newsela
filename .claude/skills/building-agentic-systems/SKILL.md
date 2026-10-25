---
name: building-agentic-systems
description: Scaffold and reason about production LLM/agent software systems the way Nortorious builds them — typed PydanticAI agents with structured output, provenance-carrying Pydantic models, single-purpose agents chained into pipelines, and a central model router. Use when starting a new agentic/LLM feature or service, adding an extraction/synthesis agent, or designing the data models a model will populate. Provider-agnostic patterns with an Azure OpenAI + PydanticAI reference implementation.
type: capability
---

# Skill: Building Agentic Software Systems

The house style for building LLM/agent systems, distilled from Selph's ingestion engine. Invoke this when you're about to write a new agent, a new pipeline of agents, or the Pydantic models an LLM will fill.

## When to invoke

- "Build an agent that extracts / classifies / synthesizes X"
- "Set up the LLM client / model routing for this project"
- "Design the schema this model will output"
- Starting any greenfield feature where an LLM produces structured data

## What this skill gives you

1. **`reference.md`** — the patterns and the *why* behind each, provider-agnostic, with an Azure/PydanticAI appendix. Read it first on any non-trivial agentic build.
2. **`template/`** — a minimal, runnable scaffold of a typed-agent system you can copy and adapt: provenance-carrying models, a prompt module, a typed agent, and a central model router with one logged/retried call wrapper.

The always-on conventions are enforced by two root rules that load whenever you touch `.py`:
- `.claude/rules/pydantic-data-modeling.md` — provenance + confidence, `extra="forbid"`, domain types, validated IDs, LLM-facing vs storage schema split.
- `.claude/rules/pydantic-ai-agents.md` — structured output, one-agent-one-job, prompts-as-modules, schema-in-prompt, bounded fan-out, single logged call wrapper, alias-based routing.

## How to use the template

1. Copy `template/` into the new project (adapt package names to the project's taxonomy — don't paste a generic `src/` layout into a repo that has its own).
2. Fill `models.py` with the domain's real output shapes (keep the provenance/confidence base).
3. Write the system prompt in `prompts.py`; inject the trimmed output schema.
4. Wire the agent in `agents.py`; route it through `client.py`'s logged wrapper.
5. Point call sites at a logical alias, not a deployment name.

## What this skill deliberately does NOT cover

The **runtime-resilience / ops layer** — owned httpx transport with TCP keepalive, the single persistent runner loop, split connect-vs-timeout retry budgets, concurrency/pool constraint math — was left in Selph on purpose. Those matter for a *deployed, high-concurrency* service, not for authoring agents and models. When a project graduates to a hot deployed service, lift those from `SelphSchemaBuilder.ai/selph_shared/llm/` (`client.py`, `_runner.py`, `_runtime.py`) and Selph's `rules/concurrency.md`.

## Maintenance

This is a seedling extracted 2026-07 from Selph. As you build agentic systems in other Nortorious projects, append what generalizes back into `reference.md` and the template — and flag anything that turned out Selph-specific.
