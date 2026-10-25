"""One typed, single-purpose agent.

House rules (see .claude/rules/pydantic-ai-agents.md):
  - structured output, never string-parsing (§1)
  - one agent = one job (§2)
  - every call goes through the single logged/retried wrapper in client.py (§7)
  - request a logical alias, not a deployment name (§8)
"""

from __future__ import annotations

from pydantic_ai import Agent

from .client import ModelAlias, build_agent_model, run_agent_logged
from .models import ExtractionResult
from .prompts import build_extraction_system_prompt


def make_extraction_agent(allowed_predicates: list[str]) -> Agent:
    """Build the extraction agent: model + typed output + system prompt."""
    return Agent(
        build_agent_model(ModelAlias.EXTRACT),   # alias → deployment via the router
        output_type=ExtractionResult,            # validated output, not free text
        system_prompt=build_extraction_system_prompt(allowed_predicates),
    )


async def extract_claims(message: str, allowed_predicates: list[str]) -> ExtractionResult:
    """Run extraction on one message. Returns a validated ExtractionResult.

    A single-purpose entry point — classify / validate / synthesize would each be
    their own agent + function, chained by the pipeline that calls them.
    """
    agent = make_extraction_agent(allowed_predicates)
    result = await run_agent_logged(agent, message, label="extract_claims")
    return result.output
