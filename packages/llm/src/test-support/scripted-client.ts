// NL-33 frozen test double: a ModelClient with a script, a pre-response hook and a call log.
import type { ProviderError } from "@ls/core/errors";
import type { FakeClock } from "@ls/core/ports/clock";
import type { ModelClient, ModelResponse, StructuredCallRequest } from "@ls/core/ports/model-client";

export type ScriptItem = ModelResponse | ProviderError | { wait_ms: number; then: ModelResponse | ProviderError };

export function response(over: Partial<ModelResponse> = {}): ModelResponse {
  return {
    raw_text: "{}",
    stop_reason: "end_turn",
    usage: { input_tokens: 100, output_tokens: 50, cache_read_tokens: 0, cache_write_tokens: 0 },
    requested_model: "claude-sonnet-5-5",
    served_model: "stub-model",
    provider_request_id: "req_provider_1",
    latency_ms: 12,
    ...over,
  };
}

export class ScriptedClient implements ModelClient {
  readonly calls: StructuredCallRequest[] = [];
  on_enter: (() => Promise<void>) | undefined;
  private readonly items: ScriptItem[] = [];

  constructor(private readonly clock: FakeClock) {}

  script(...items: ScriptItem[]): this {
    this.items.push(...items);
    return this;
  }

  async complete(req: StructuredCallRequest): Promise<ModelResponse> {
    this.calls.push(req);
    if (this.on_enter !== undefined) await this.on_enter();
    const item = this.items.shift();
    if (item === undefined) throw new Error("ScriptedClient: script exhausted");
    let out: ModelResponse | ProviderError;
    if ("wait_ms" in item && !(item instanceof Error)) {
      this.clock.advance(item.wait_ms);
      out = item.then;
    } else {
      out = item as ModelResponse | ProviderError;
    }
    if (out instanceof Error) throw out;
    return out;
  }
}
