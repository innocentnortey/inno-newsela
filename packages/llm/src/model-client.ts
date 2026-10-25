import { InvariantViolation } from "@ls/core/errors";
import type { ModelAlias } from "@ls/core/ports/common";
import type { ModelSettings } from "@ls/config/settings";

export type { ModelClient, StructuredCallRequest, PromptBlock, ModelResponse } from "@ls/core/ports/model-client";
export type { ModelAlias } from "@ls/core/ports/common";

export function model_id_for(
  alias: ModelAlias,
  settings: Pick<ModelSettings, "model_generation_id" | "model_repair_id" | "model_assist_id">,
): string {
  switch (alias) {
    case "GENERATION":
      return settings.model_generation_id;
    case "REPAIR":
      return settings.model_repair_id;
    case "ASSIST":
      return settings.model_assist_id;
    default:
      throw new InvariantViolation("no Anthropic model id for JUDGE");
  }
}
