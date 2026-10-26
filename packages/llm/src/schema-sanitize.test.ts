// GEN-8: the schema sent to Anthropic carries no unsupported keyword; 400/422 schema complaints are diagnosable.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { ProviderError } from "@ls/core/errors";
import type { StructuredCallRequest } from "@ls/core/ports/model-client";
import { SecretStr } from "@ls/config/secret";
import { AnthropicMessagesAdapter, safe_provider_detail } from "./anthropic.ts";
import { sanitize_schema_for_anthropic, UNSUPPORTED_KEYWORDS } from "./schema-sanitize.ts";

const servers: Server[] = [];
afterEach(() => {
  for (const s of servers.splice(0)) {
    s.closeAllConnections();
    s.close();
  }
});

async function server(status: number, json: unknown): Promise<{ url: string; bodies: Array<Record<string, any>> }> {
  const bodies: Array<Record<string, any>> = [];
  const s = createServer((rq, rs) => {
    const chunks: Buffer[] = [];
    rq.on("data", (c: Buffer) => chunks.push(c));
    rq.on("end", () => {
      bodies.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      rs.writeHead(status, { "content-type": "application/json" });
      rs.end(JSON.stringify(json));
    });
  });
  servers.push(s);
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${(s.address() as AddressInfo).port}`, bodies };
}

const SCHEMA = {
  type: "object",
  properties: {
    minimum: { type: "string", minLength: 1, maxLength: 9 }, // a property literally named "minimum"
    day: { type: "integer", minimum: 1, maximum: 9007199254740991 },
    list: { type: "array", items: { type: "number", exclusiveMinimum: 0, multipleOf: 2 }, minItems: 2, maxItems: 5 },
    one: { type: "array", items: { type: "string" }, minItems: 1 },
  },
  required: ["day"],
} as const;

function req(over: Partial<StructuredCallRequest> = {}): StructuredCallRequest {
  return {
    alias: "GENERATION",
    system_blocks: [{ text: "S", cacheable: true, label: "locked" }],
    user_blocks: [{ text: "USER-ONE", cacheable: false, label: "data" }],
    output_schema_name: "X",
    output_json_schema: SCHEMA as never,
    output_mode: "schema_enforced",
    max_output_tokens: 100,
    timeout_ms: 5000,
    effort: null,
    temperature: null,
    ...over,
  };
}
const adapter = (base_url: string) =>
  new AnthropicMessagesAdapter({
    api_key: new SecretStr("sk-test-key-0000"),
    model_ids: { GENERATION: "m", REPAIR: "m", ASSIST: "m" },
    http_timeout_ms: 5000,
    base_url,
  });

describe("sanitize_schema_for_anthropic", () => {
  it("removes unsupported keywords, keeps minItems 0/1 and property names that look like keywords", () => {
    const out = sanitize_schema_for_anthropic(SCHEMA as never) as any;
    expect(out.properties.day).toEqual({ type: "integer" });
    expect(out.properties.minimum).toEqual({ type: "string" });
    expect(out.properties.list).toEqual({ type: "array", items: { type: "number" } });
    expect(out.properties.one.minItems).toBe(1);
    expect(out.required).toEqual(["day"]);
    expect(SCHEMA.properties.day.minimum).toBe(1); // input untouched
  });

  it("sends the sanitised schema in output_config.format for a schema_enforced call", async () => {
    const { url, bodies } = await server(200, {
      id: "m", type: "message", role: "assistant", model: "m", content: [{ type: "text", text: "{}" }],
      stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
    });
    await adapter(url).complete(req());
    const sent = bodies[0]!.output_config.format.schema;
    expect(JSON.stringify(sent)).not.toMatch(new RegExp(`"(${UNSUPPORTED_KEYWORDS.join("|")})":\\s*[0-9]`));
    expect(sent.properties.day).toEqual({ type: "integer" });
  });
});

describe("provider 400/422 detail", () => {
  it("keeps a request-parameter complaint, truncated to 300 chars with key-like text removed", async () => {
    const msg = `output_config.format.schema: For 'integer' type, properties maximum, minimum are not supported sk-ant-api03-ABCDEFGH12345678 ${"x".repeat(400)}`;
    const { url } = await server(400, { type: "error", error: { type: "invalid_request_error", message: msg } });
    const e = (await adapter(url).complete(req()).catch((x: unknown) => x)) as ProviderError;
    expect(e).toBeInstanceOf(ProviderError);
    expect(e.message).toBe("HTTP 400");
    expect(e.safe_detail).toContain("output_config.format.schema: For 'integer' type");
    expect(e.safe_detail).not.toContain("sk-ant");
    expect(e.safe_detail!.length).toBeLessThanOrEqual(300);
  });

  it("drops text that does not name a request parameter (it could echo user content), and 5xx/401 text", async () => {
    const echo = { type: "error", error: { type: "x", message: "bad input USER-ONE" } };
    const { url } = await server(400, echo);
    const e = (await adapter(url).complete(req()).catch((x: unknown) => x)) as ProviderError;
    expect(e.safe_detail).toBeNull();
    const s401 = await server(401, { type: "error", error: { type: "x", message: "output_config.x: nope" } });
    const e2 = (await adapter(s401.url).complete(req()).catch((x: unknown) => x)) as ProviderError;
    expect(e2.safe_detail).toBeNull();
    expect(safe_provider_detail(undefined)).toBeNull();
  });
});
