# Building Agentic Systems — Reference

The patterns behind a trustworthy LLM/agent system, and *why* each exists. Provider-agnostic; the Azure OpenAI + PydanticAI appendix at the bottom is the concrete reference implementation (Selph).

---

## The shape of a good agentic system

```
raw input ──► [classify] ──► [extract A] ──► [extract B] ──► [validate] ──► [resolve refs] ──► store
                  │              │               │              │              │
             single-purpose agents, each returning a validated model, each behind one logged call wrapper
                                                                                    │
                        every stored claim carries confidence + a link back to the raw input ◄──┘
```

Two spines hold it up: **typed agents** (the compute) and **provenance-carrying models** (the data). Get those right and the system is auditable, evolvable, and debuggable. Get them wrong and you have a pile of string-parsing and un-traceable "facts."

---

## Data modeling: never store an un-sourced claim

The single most valuable discipline. Every value the system *infers* (as opposed to *observes*) carries:

- a **confidence** (0–1),
- a **source reference** — the id(s) of the raw record it was derived from.

Raw records are append-only ground truth. Derived layers point back to them. A claim with no source link is invalid by construction.

Why this is worth the overhead:
- **Auditable** — you can always answer "what evidence supports this?"
- **Revocable** — a bad inference can be retracted without corrupting the evidence.
- **Non-hardening** — model output never silently becomes "fact"; it stays a confidence-weighted, sourced claim.

Supporting habits (full list in `rules/pydantic-data-modeling.md`):
- `extra="forbid"` on any LLM-filled schema — invented fields raise, not vanish.
- Purpose-built types for imprecise values (fuzzy timestamps, ranges) instead of primitives that fake certainty.
- Validated ID types (a `str` subclass with a core-schema validator), never ad-hoc string checks.
- The schema the LLM *sees* excludes pipeline-assigned fields (ownership, timestamps, ids); those are stamped on afterward.
- Flattened text projections (`@computed_field`) for embedding/logging, deriving from real fields with an explicit non-semantic exclusion set.

---

## Agent construction: typed, single-purpose, one call path

**Structured output, never parsing.** An agent returns a validated model. A bad generation is a validation error the framework retries — not corrupt data downstream. Dynamic shapes → build the output model dynamically and pass it as the output type; never fall back to `dict`.

**One agent, one job.** Classify / extract-entities / extract-memories / validate / synthesize are separate agents chained together. Small agents are testable, swappable, and fail legibly. Resist the mega-agent.

**Prompts in their own modules.** `build_*_system_prompt(...)` lives in a `_prompts_*.py` file. Runner code orchestrates; prompt code owns wording. Prompt iteration then doesn't churn control flow.

**Schema-in-prompt, trimmed.** Put the (trimmed) output JSON schema in the system prompt with an explicit constraint block. Trim to what the model must produce — strip pipeline fields, cap examples — because prompt size drives latency and content-filter risk.

**Constrain with an allow-list, belt and suspenders.** When an agent may only emit certain types, say so imperatively in the prompt AND enforce it in the output model.

**Bounded fan-out.** Parallelize independent work into small per-agent units, but gate concurrency with a semaphore. Snapshot shared config once per run for determinism.

**One logged, retried call wrapper.** Every `agent.run()` goes through a single function that logs attempt/success/error (label, model, prompt size, duration, tokens), applies the timeout and concurrency gate, and splits retry budgets by failure class (content-filter → fail fast; transient connection → retry). One place to change policy, one place observability lives.

**Route by logical alias.** Call sites request `SYNTHESIS` / `CLASSIFIER`; a central router maps alias → one-or-more deployments and load-balances. Model swaps and added balancing targets are one-line router changes.

---

## Why single-purpose chains beat one big agent

- **Isolable failure** — when phase 2 is wrong, you know it's phase 2, not "the agent."
- **Independent model choice** — cheap classifier model for phase 0, stronger model for extraction, top model for user-facing synthesis. The alias router makes this trivial.
- **Independent iteration** — tune one prompt without regressing the others.
- **Testable units** — each agent has a clear input→typed-output contract.

---

## Azure OpenAI + PydanticAI appendix (Selph's concrete implementation)

Where to read the real code: `SelphSchemaBuilder.ai/selph_shared/llm/` and `selph_core/observe/extraction/`.

- **Agent:** `Agent(OpenAIChatModel(...), output_type=SomeModel, system_prompt=...)`; run via `run_agent_logged(agent, prompt)` → `result.output` is the typed model. **`system_prompt=` is fine only for single-shot agents. For any multi-turn agent that passes its own `message_history`, you MUST use `instructions=` instead — PydanticAI drops `system_prompt` on every turn after the first when explicit history is supplied. See `.claude/rules/pydantic-ai-agents.md` §9.**
- **Provider:** `AzureProvider(http_client=owned_client)`; one owned `httpx.AsyncClient` per (endpoint, credential), reused across calls.
- **Routing:** `ModelAlias` (logical names) + `LLMClient` N-target pool; aliases with >1 deployment round-robin. `SELPH_LLM_TARGETS_JSON` for fully explicit setups.
- **Observability:** `logfire.configure()` + `logfire.instrument_pydantic_ai()` at import; the logged wrapper adds token/cost fields.
- **Dynamic output models:** `build_phase1_output_model(types)` constructs the output schema at runtime from the active type set; the trimmed schema is `json.dumps`'d into the prompt.

**Left in Selph on purpose** (the deployed-service ops layer): owned-transport TCP keepalive + connect-timeout fast-fail, the single persistent `_runner.py` event loop (fixes cross-loop httpx socket reuse), split retry budgets in `_runtime.py`, and the pool/concurrency constraint math in `rules/concurrency.md`. Lift these only when a project becomes a hot, high-concurrency deployed service.
