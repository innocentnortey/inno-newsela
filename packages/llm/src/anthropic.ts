import Anthropic, { APIConnectionError, APIConnectionTimeoutError, APIError, APIUserAbortError } from "@anthropic-ai/sdk";
import { InvariantViolation, ProviderError } from "@ls/core/errors";
import type { ProviderErrorKind } from "@ls/core/errors";
import type { ModelClient, ModelResponse, StructuredCallRequest } from "@ls/core/ports/model-client";
import type { SecretStr } from "@ls/config/secret";

export interface AnthropicMessagesAdapterInit {
  api_key: SecretStr;
  model_ids: Readonly<Record<"GENERATION" | "REPAIR" | "ASSIST", string>>;
  http_timeout_ms: number;
  /** Tests only (local fake server). Never set from the environment. */
  base_url?: string;
}

const STOP_REASONS = ["end_turn", "max_tokens", "stop_sequence", "refusal", "tool_use"] as const;

function error_of(kind: ProviderErrorKind, status: number | null, retry_after_s: number | null, id: string | null) {
  // Fixed message only: SDK messages can echo the response body or request.
  return new ProviderError({
    kind,
    message: status === null ? `provider error: ${kind}` : `HTTP ${status}`,
    http_status: status,
    retry_after_s,
    provider_request_id: id,
  });
}

export function map_error(e: unknown): ProviderError {
  if (e instanceof ProviderError) return e;
  if (e instanceof APIUserAbortError || e instanceof APIConnectionTimeoutError) {
    return error_of("timeout", null, null, null);
  }
  if (e instanceof APIConnectionError) return error_of("connection", null, null, null);
  if (e instanceof APIError && typeof e.status === "number") {
    const status = e.status;
    const id = e.headers?.get("request-id") ?? null;
    if (status === 429) {
      const raw = e.headers?.get("retry-after");
      const n = raw === null || raw === undefined || raw.trim() === "" ? NaN : Number(raw);
      return error_of("rate_limited", status, Number.isFinite(n) ? n : null, id);
    }
    if (status === 529) return error_of("overloaded", status, null, id);
    if (status === 401 || status === 403) return error_of("auth", status, null, id);
    if (status >= 500) return error_of("server_error", status, null, id);
    return error_of("bad_request", status, null, id);
  }
  return error_of("connection", null, null, null);
}

export class AnthropicMessagesAdapter implements ModelClient {
  readonly #client: Anthropic;
  readonly #model_ids: Readonly<Record<"GENERATION" | "REPAIR" | "ASSIST", string>>;

  constructor(init: AnthropicMessagesAdapterInit) {
    this.#client = new Anthropic({
      // SDK 1.3.0 sends `apiKey` as a Bearer token; Anthropic's API key header is x-api-key, so the key
      // goes there only. apiKey/authToken are null so the SDK never reads ANTHROPIC_* from the environment.
      apiKey: null,
      authToken: null,
      defaultHeaders: { "x-api-key": init.api_key.reveal() },
      baseURL: init.base_url ?? "https://api.anthropic.com",
      logLevel: "off",
      maxRetries: 0,
      timeout: init.http_timeout_ms,
    });
    this.#model_ids = init.model_ids;
  }

  async complete(req: StructuredCallRequest): Promise<ModelResponse> {
    if (req.alias === "JUDGE") throw new InvariantViolation("no Anthropic model id for JUDGE");
    if (req.user_blocks.length === 0) throw new InvariantViolation("empty user_blocks");
    const requested_model = this.#model_ids[req.alias];
    const last = req.system_blocks.findLastIndex((b) => b.cacheable);
    const system = req.system_blocks.map((b, i) => ({
      type: "text" as const,
      text: b.text,
      ...(i === last ? { cache_control: { type: "ephemeral" as const } } : {}),
    }));
    const enforced = req.output_mode === "schema_enforced";
    const output_config =
      req.effort !== null || enforced
        ? {
            ...(req.effort !== null ? { effort: req.effort } : {}),
            ...(enforced
              ? { format: { type: "json_schema" as const, schema: req.output_json_schema as Record<string, unknown> } }
              : {}),
          }
        : undefined;
    const params = {
      model: requested_model,
      max_tokens: req.max_output_tokens,
      system,
      messages: [{ role: "user" as const, content: req.user_blocks.map((b) => ({ type: "text" as const, text: b.text })) }],
      ...(req.temperature !== null ? { temperature: req.temperature } : {}),
      ...(output_config !== undefined ? { output_config } : {}),
    };
    const t0 = performance.now();
    let data: Anthropic.Message;
    let response: Response;
    try {
      ({ data, response } = await this.#client.messages.create(params, { timeout: req.timeout_ms }).withResponse());
    } catch (e) {
      throw map_error(e);
    }
    const latency_ms = Math.round(performance.now() - t0);
    const request_id = response.headers.get("request-id");
    let stop_reason: ModelResponse["stop_reason"];
    if (data.stop_reason === null) stop_reason = "end_turn";
    else if ((STOP_REASONS as readonly string[]).includes(data.stop_reason)) {
      stop_reason = data.stop_reason as ModelResponse["stop_reason"];
    } else {
      throw new ProviderError({
        kind: "server_error",
        message: "unknown stop_reason",
        provider_request_id: request_id,
      });
    }
    return {
      raw_text: data.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join(""),
      stop_reason,
      usage: {
        input_tokens: data.usage.input_tokens,
        output_tokens: data.usage.output_tokens,
        cache_read_tokens: data.usage.cache_read_input_tokens ?? 0,
        cache_write_tokens: data.usage.cache_creation_input_tokens ?? 0,
      },
      requested_model,
      served_model: data.model,
      provider_request_id: request_id,
      latency_ms,
    };
  }
}
