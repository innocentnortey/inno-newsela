# Typed-agent starter template

A minimal, provider-agnostic scaffold of an LLM/agent system in the Nortorious house style. Copy into a new project and adapt — don't paste the layout wholesale into a repo that already has its own taxonomy.

```
template/
├── models.py     # provenance + confidence base; a domain output model with extra="forbid"
├── prompts.py    # system prompts as a separate module; schema-in-prompt helper
├── agents.py     # one typed, single-purpose agent; structured output, no parsing
└── client.py     # model router (alias → deployment) + ONE logged/retried call wrapper
```

## Adapt in this order

1. `models.py` — replace `ExtractedClaim` with your real output shape; keep `SourcedModel` as the base so every derived value carries confidence + source.
2. `prompts.py` — write the system prompt; it injects the trimmed output schema.
3. `agents.py` — bind model + output type + prompt into one agent; expose a single async run function.
4. `client.py` — set your provider wiring at the marked point; point call sites at `ModelAlias`, never a deployment name.

## What's intentionally omitted

The deployed-service resilience layer (owned transport + TCP keepalive, a dedicated runner loop, split retry budgets, pool constraint math). This template is for *authoring* agents and models. When the service goes hot and concurrent, lift that layer from `SelphSchemaBuilder.ai/selph_shared/llm/`.

Framework note: examples use PydanticAI + an OpenAI-compatible provider. The *patterns* (typed output, one-job agents, prompts-as-modules, one call wrapper, alias routing) hold on any typed-agent framework — swap the `Agent`/provider lines, keep the structure.
