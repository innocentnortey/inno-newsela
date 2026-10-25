"""System prompts live here, separate from agent/runner logic.

House rule (see .claude/rules/pydantic-ai-agents.md §3, §4): runner code
orchestrates; prompt code owns wording. Inject the TRIMMED output schema so the
model knows the exact shape to produce, and keep prompt size down.
"""

from __future__ import annotations

import json

from .models import ExtractionResult, llm_facing_schema


def build_extraction_system_prompt(allowed_predicates: list[str]) -> str:
    """Build the extraction agent's system prompt.

    - injects the LLM-facing output schema (pipeline fields already stripped)
    - constrains the model with an explicit allow-list (belt; the output model is
      the suspenders)
    """
    schema_json = json.dumps(llm_facing_schema(ExtractionResult), indent=2)
    allowed_block = "\n".join(f"- {p}" for p in allowed_predicates)

    return f"""You extract structured claims from a user's message.

Return ONLY data matching this JSON schema:
{schema_json}

ALLOWED PREDICATES (emit no others; skip anything that would need a different one):
{allowed_block}

Rules:
- Every claim needs a confidence_score in [0, 1] reflecting how directly the
  message states it.
- Do not infer sensitive attributes (health, religion, politics) from weak signals.
- If nothing qualifies, return an empty claims list. Do not invent claims.
"""
