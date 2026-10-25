import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { SecretStr } from "@ls/config/secret";
import { AnthropicMessagesAdapter } from "./anthropic.ts";
import { StubModelClient } from "./stub.ts";

const FIELDS = ["raw_text", "stop_reason", "usage", "requested_model", "served_model", "provider_request_id", "latency_ms"];
const base = {
  alias: "GENERATION" as const,
  system_blocks: [{ text: "s", cacheable: true, label: "locked" as const }],
  user_blocks: [{ text: "u", cacheable: false, label: "data" as const }],
  output_schema_name: "LessonDraft",
  output_json_schema: {},
  output_mode: "prompt_embedded" as const,
  max_output_tokens: 10,
  timeout_ms: 2000,
  effort: null,
  temperature: null,
};

describe("response_has_all_record_fields", () => {
  it("real mode (fake HTTP) and stub mode both fill every field", async () => {
    const server = createServer((_q, res) => {
      res.writeHead(200, { "content-type": "application/json", "request-id": "r1" });
      res.end(JSON.stringify({ id: "m", type: "message", role: "assistant", model: "claude-sonnet-5-5", content: [{ type: "text", text: "t" }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } }));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    try {
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const real = new AnthropicMessagesAdapter({ api_key: new SecretStr("sk-fake"), model_ids: { GENERATION: "claude-sonnet-5-5", REPAIR: "a", ASSIST: "b" }, http_timeout_ms: 2000, base_url: url });
      const stub = new StubModelClient().script("GENERATION", "*", [{ kind: "text", text: "t" }]);
      for (const c of [real, stub]) {
        const r = await c.complete(base);
        for (const f of FIELDS) expect(r).toHaveProperty(f);
        expect(r.provider_request_id).not.toBeNull();
        expect(Object.keys(r.usage).sort()).toEqual(["cache_read_tokens", "cache_write_tokens", "input_tokens", "output_tokens"]);
      }
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });
});
