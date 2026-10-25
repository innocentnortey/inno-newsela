// NL-33 frozen fixtures: cost math, prices, settings, context and request builders (synthetic data only).
import { SecretStr } from "@ls/config/secret";
import type { ModelSettings } from "@ls/config/settings";
import { InvariantViolation } from "@ls/core/errors";
import type { ModelPrice, TokenUsage } from "@ls/core/ports/common";
import type { StructuredCallRequest } from "@ls/core/ports/model-client";
import Decimal from "decimal.js";

export const PRICE: ModelPrice = {
  model_id: "claude-sonnet-5-5",
  input_per_mtok: new Decimal("2.00"),
  output_per_mtok: new Decimal("10.00"),
  cache_read_per_mtok: new Decimal("0.20"),
  cache_write_per_mtok: new Decimal("2.50"),
};
export const SERVED_PRICE: ModelPrice = {
  model_id: "stub-model",
  input_per_mtok: new Decimal("1.00"),
  output_per_mtok: new Decimal("5.00"),
  cache_read_per_mtok: new Decimal("0.10"),
  cache_write_per_mtok: new Decimal("1.25"),
};

export const cost_math = {
  settle_cost: (p: ModelPrice, u: TokenUsage): Decimal =>
    p.input_per_mtok.mul(u.input_tokens).add(p.output_per_mtok.mul(u.output_tokens))
      .add(p.cache_read_per_mtok.mul(u.cache_read_tokens)).add(p.cache_write_per_mtok.mul(u.cache_write_tokens)).div(1_000_000),
  max_call_cost: (p: ModelPrice, input_tokens: number, output_cap: number): Decimal =>
    p.input_per_mtok.mul(input_tokens).add(p.output_per_mtok.mul(output_cap)).div(1_000_000),
};

export const prices = {
  price_for: (model_id: string): ModelPrice => {
    if (model_id === "claude-sonnet-5-5") return PRICE;
    if (model_id === "stub-model") return SERVED_PRICE;
    throw new InvariantViolation("no price", { model_id });
  },
};

export const KEY_MARKER = "sk-marker-KEY-5530";

export function settings(over: Partial<ModelSettings> = {}): ModelSettings {
  return {
    model_provider_mode: "stub",
    anthropic_api_key: new SecretStr(KEY_MARKER),
    model_generation_id: "claude-sonnet-5-5",
    model_repair_id: "claude-sonnet-5-5",
    model_assist_id: "claude-sonnet-5-5",
    model_effort: "medium",
    model_call_timeout_ms: 240000,
    provider_max_retries: 3,
    ...over,
  };
}

export function ctx(over: Record<string, unknown> = {}) {
  return {
    run_id: "run_1", lesson_id: "G6.U4.L1", job_id: "job_1", attempt: 1, purpose: "lesson_draft" as const,
    request_id: "req_1", experiment_id: null, reservation_id: "sr_1",
    ...over,
  } as never;
}

export function request(over: Partial<StructuredCallRequest> = {}): StructuredCallRequest {
  return {
    alias: "GENERATION", system_blocks: [], user_blocks: [], output_schema_name: "lesson", output_json_schema: {},
    output_mode: "schema_enforced", max_output_tokens: 32000, timeout_ms: 240000, effort: null, temperature: null,
    ...over,
  };
}

export const rendered = (text = "synthetic prompt A", input_tokens_estimate = 1000) => ({ text, input_tokens_estimate });
