import type { JsonValue, ModelAlias, TokenUsage } from "./common.ts";

export interface PromptBlock {
  text: string;
  cacheable: boolean;
  label: "locked" | "guidance" | "schema" | "examples" | "context" | "data" | "instruction";
}

export interface StructuredCallRequest {
  alias: ModelAlias;
  system_blocks: PromptBlock[]; // stable prefix first; cache_control on the last stable block
  user_blocks: PromptBlock[]; // outline data only inside labelled delimiters
  output_schema_name: string;
  output_json_schema: JsonValue;
  output_mode: "schema_enforced" | "prompt_embedded";
  max_output_tokens: number;
  timeout_ms: number;
  effort: "low" | "medium" | "high" | null;
  temperature: number | null;
}

export interface ModelResponse {
  raw_text: string; // saved verbatim before any parsing
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "refusal" | "tool_use";
  usage: TokenUsage;
  requested_model: string;
  served_model: string; // from the response body, never from the request
  provider_request_id: string | null;
  latency_ms: number;
}

export interface ModelClient {
  // raises ProviderError; never retries itself: ModelCallRecorder owns retries
  complete(req: StructuredCallRequest): Promise<ModelResponse>;
}
