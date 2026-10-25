"""Domain models an LLM will populate.

House rules (see .claude/rules/pydantic-data-modeling.md):
  - every *derived* value carries confidence + a source link
  - LLM-filled schemas use extra="forbid" (invented fields raise, not vanish)
  - pipeline-assigned fields (ids, ownership, timestamps) are excluded from the
    schema the LLM sees and stamped on afterward
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, computed_field


class SourcedModel(BaseModel):
    """Base for anything the system INFERS from raw input.

    Never persist a derived claim without a confidence and a traceable path back
    to the raw record(s) it came from. A claim with no source is invalid.
    """

    model_config = ConfigDict(extra="forbid")

    confidence_score: float = Field(ge=0.0, le=1.0)
    source_reference: list[str] = Field(
        default_factory=list,
        description="IDs of the raw records this claim was derived from.",
    )

    # Pipeline-assigned — stamped after extraction, NEVER filled by the LLM.
    # Excluded from the schema shown to the model.
    tenant_id: str | None = Field(
        default=None, json_schema_extra={"x-llm-exclude": True}
    )


def attach_tenant_id(node: SourcedModel, tenant_id: str) -> None:
    """Stamp the pipeline-assigned tenant id after extraction."""
    object.__setattr__(node, "tenant_id", tenant_id)


def llm_facing_schema(model: type[BaseModel]) -> dict:
    """JSON schema with x-llm-exclude fields stripped — this is what goes in the
    prompt. Keeps ownership/audit fields out of the model's view and trims prompt
    size. Extend to also cap example lists for large schemas."""
    schema = model.model_json_schema()
    props = schema.get("properties", {})
    for name in [k for k, v in props.items() if v.get("x-llm-exclude")]:
        props.pop(name, None)
        if name in schema.get("required", []):
            schema["required"].remove(name)
    return schema


# ── Example domain output model — replace with your real shape ────────────────
class ExtractedClaim(SourcedModel):
    """One structured claim extracted from a message."""

    subject: str = Field(description="Who/what the claim is about.")
    predicate: str = Field(description="The relationship or attribute asserted.")
    value: str = Field(description="The asserted value, verbatim where possible.")

    @computed_field  # flattened text form for embedding / logging
    @property
    def as_text(self) -> str:
        return f"{self.subject} {self.predicate} {self.value}"


class ExtractionResult(BaseModel):
    """Top-level typed output the agent returns."""

    model_config = ConfigDict(extra="forbid")
    claims: list[ExtractedClaim] = Field(default_factory=list)
