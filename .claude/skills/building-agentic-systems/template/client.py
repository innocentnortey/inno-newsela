"""Model router + the single logged/retried call wrapper.

House rules (see .claude/rules/pydantic-ai-agents.md §7, §8):
  - call sites request a LOGICAL alias; the router maps alias → deployment
  - every agent.run() goes through ONE wrapper: logging, timeout, concurrency
    gate, and retry policy split by failure class live HERE and nowhere else

This is the *authoring* layer. The deployed-service resilience layer (owned
httpx transport, dedicated runner loop, pool constraint math) is intentionally
omitted — lift it from SelphSchemaBuilder.ai/selph_shared/llm/ when the service
becomes hot and concurrent.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

_log = logging.getLogger("agentic.llm")

# ── Logical aliases: call sites use these, never a raw deployment name ────────
class ModelAlias:
    CLASSIFY = "classify"     # cheap structured control
    EXTRACT = "extract"       # constrained extraction
    SYNTHESIZE = "synthesize" # user-facing generation


# alias → deployment/model name. Swapping a model or adding a load-balancing
# target is a one-line change here, not a sweep across call sites.
_ALIAS_TO_DEPLOYMENT: dict[str, str] = {
    ModelAlias.CLASSIFY: os.getenv("MODEL_CLASSIFY", "gpt-4.1-mini"),
    ModelAlias.EXTRACT: os.getenv("MODEL_EXTRACT", "gpt-4.1"),
    ModelAlias.SYNTHESIZE: os.getenv("MODEL_SYNTHESIZE", "gpt-5"),
}


def build_agent_model(alias: str) -> OpenAIChatModel:
    """Resolve a logical alias to a concrete model.

    Provider wiring point — swap OpenAIProvider for AzureProvider(http_client=...)
    with an owned client when moving to Azure / a deployed service.
    """
    deployment = _ALIAS_TO_DEPLOYMENT[alias]
    provider = OpenAIProvider(api_key=os.environ["OPENAI_API_KEY"])
    return OpenAIChatModel(deployment, provider=provider)


# ── The single call wrapper ───────────────────────────────────────────────────
_CALL_TIMEOUT_SECS = float(os.getenv("LLM_CALL_TIMEOUT", "180"))
_CALL_CONCURRENCY = int(os.getenv("LLM_CALL_CONCURRENCY", "16"))
_sem = asyncio.Semaphore(_CALL_CONCURRENCY)

_CONNECT_ATTEMPTS = 3   # transient connection errors: retry
_TIMEOUT_ATTEMPTS = 2   # slow generations: fewer retries
# Content-filter / validation errors: fail through immediately (0 retries) — a
# retry won't help and just burns budget.


def _is_content_filter(err: Exception) -> bool:
    return "content_filter" in str(err).lower() or "content management" in str(err).lower()


async def run_agent_logged(agent: Agent, prompt: str, *, label: str = "agent"):
    """Every agent call routes through here: log, gate concurrency, time out,
    and apply retry budgets split by failure class."""
    connect_left, timeout_left = _CONNECT_ATTEMPTS, _TIMEOUT_ATTEMPTS
    attempt = 0
    while True:
        attempt += 1
        t0 = time.perf_counter()
        try:
            async with _sem:
                result = await asyncio.wait_for(agent.run(prompt), _CALL_TIMEOUT_SECS)
            dur_ms = round((time.perf_counter() - t0) * 1000, 1)
            _log.info("llm.call_ok", extra={"label": label, "attempt": attempt, "duration_ms": dur_ms})
            return result
        except asyncio.TimeoutError as e:
            timeout_left -= 1
            _log.warning("llm.timeout", extra={"label": label, "attempt": attempt, "left": timeout_left})
            if timeout_left <= 0:
                raise
        except Exception as e:  # noqa: BLE001 — classify then re-raise
            if _is_content_filter(e):
                _log.error("llm.content_filter", extra={"label": label, "error": str(e)[:200]})
                raise  # fail through — no retry
            connect_left -= 1
            _log.warning("llm.error", extra={"label": label, "attempt": attempt, "left": connect_left, "error": str(e)[:200]})
            if connect_left <= 0:
                raise
            await asyncio.sleep(0.5 * attempt)  # small backoff before retry
