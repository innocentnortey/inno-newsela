// One factory for the ModelClient used by both apps (RT-1). No env reads, no file reads, no logging:
// the key arrives already parsed inside ModelSettings and goes straight into the adapter.
import { ConfigError } from "@ls/config/errors";
import type { ModelSettings } from "@ls/config/settings";
import type { Clock } from "@ls/core/ports/clock";
import type { ModelClient } from "@ls/core/ports/model-client";
import { AnthropicMessagesAdapter } from "./anthropic.ts";
import { StubModelClient } from "./stub.ts";

export function build_model_client(model: ModelSettings, clock: Clock): ModelClient {
  if (model.model_provider_mode === "stub") return new StubModelClient({ clock });
  if (model.anthropic_api_key === null) {
    throw new ConfigError("ANTHROPIC_API_KEY", "required when MODEL_PROVIDER_MODE=real");
  }
  return new AnthropicMessagesAdapter({
    api_key: model.anthropic_api_key,
    model_ids: { GENERATION: model.model_generation_id, REPAIR: model.model_repair_id, ASSIST: model.model_assist_id },
    http_timeout_ms: model.model_call_timeout_ms,
  });
}
