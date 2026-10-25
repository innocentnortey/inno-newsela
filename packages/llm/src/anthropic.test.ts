// NL-32 FROZEN (AC-1..AC-5). Do not edit.
// Fake HTTP server only: no real provider call, no real key.
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { inspect } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProviderError } from "@ls/core/errors";
import type { ModelResponse, StructuredCallRequest } from "@ls/core/ports/model-client";
import { SecretStr } from "@ls/config/secret";
import { AnthropicMessagesAdapter, type AnthropicMessagesAdapterInit } from "./anthropic.ts";

const MARKER = "sk-marker-KEY-4471";
const REQUESTED = "claude-sonnet-5-5";

interface Captured {
  method: string | undefined;
  url: string | undefined;
  headers: IncomingHttpHeaders;
  raw: string;
  body: Record<string, any>;
}
interface Reply {
  status?: number;
  headers?: Record<string, string>;
  json?: unknown;
  destroy?: boolean;
  hang?: boolean;
}

const servers: Server[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    servers.splice(0).map(
      (s) =>
        new Promise<void>((res) => {
          s.closeAllConnections();
          s.close(() => res());
        }),
    ),
  );
});

function ok_body(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: REQUESTED,
    content: [{ type: "text", text: "hello" }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 11, output_tokens: 7, cache_read_input_tokens: 3, cache_creation_input_tokens: 5 },
    ...over,
  };
}

async function fake_server(replies: Reply[]): Promise<{ url: string; captured: Captured[] }> {
  const captured: Captured[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      let body: Record<string, any> = {};
      try {
        body = JSON.parse(raw);
      } catch {
        /* not json */
      }
      captured.push({ method: req.method, url: req.url, headers: req.headers, raw, body });
      const reply = replies[Math.min(captured.length - 1, replies.length - 1)] ?? { json: ok_body() };
      if (reply.destroy) {
        req.socket.destroy();
        return;
      }
      if (reply.hang) return;
      res.writeHead(reply.status ?? 200, { "content-type": "application/json", ...(reply.headers ?? {}) });
      res.end(JSON.stringify(reply.json ?? ok_body()));
    });
  });
  servers.push(server);
  await new Promise<void>((res) => server.listen(0, "127.0.0.1", res));
  const port = (server.address() as AddressInfo).port;
  return { url: `http://127.0.0.1:${port}`, captured };
}

function adapter(base_url: string, key = MARKER): AnthropicMessagesAdapter {
  const init: AnthropicMessagesAdapterInit = {
    api_key: new SecretStr(key),
    model_ids: { GENERATION: REQUESTED, REPAIR: "claude-repair-x", ASSIST: "claude-assist-x" },
    http_timeout_ms: 5000,
    base_url,
  };
  return new AnthropicMessagesAdapter(init);
}

function req(over: Partial<StructuredCallRequest> = {}): StructuredCallRequest {
  return {
    alias: "GENERATION",
    system_blocks: [
      { text: "SYS-ONE", cacheable: true, label: "locked" },
      { text: "SYS-TWO", cacheable: true, label: "guidance" },
      { text: "SYS-THREE", cacheable: false, label: "schema" },
    ],
    user_blocks: [{ text: "USER-ONE", cacheable: false, label: "data" }],
    output_schema_name: "LessonDraft",
    output_json_schema: { type: "object", properties: { zz_schema_marker: { type: "string" } } },
    output_mode: "prompt_embedded",
    max_output_tokens: 1234,
    timeout_ms: 5000,
    effort: null,
    temperature: null,
    ...over,
  };
}

describe("request_shape_prompt_embedded [invariant AC-1]", () => {
  it("sends exactly one POST with cache_control on the last cacheable system block only", async () => {
    const { url, captured } = await fake_server([{ json: ok_body() }]);
    await adapter(url).complete(req());
    expect(captured).toHaveLength(1);
    const c = captured[0]!;
    expect(c.method).toBe("POST");
    expect(c.url).toContain("/v1/messages");
    const sys = c.body.system as Array<Record<string, any>>;
    expect(sys.map((b) => b.text)).toEqual(["SYS-ONE", "SYS-TWO", "SYS-THREE"]);
    expect(sys[0]!.cache_control).toBeUndefined();
    expect(sys[1]!.cache_control).toEqual({ type: "ephemeral" });
    expect(sys[2]!.cache_control).toBeUndefined();
    expect(c.body.max_tokens).toBe(1234);
    expect(c.body.model).toBe(REQUESTED);
    expect(c.body.messages).toHaveLength(1);
    expect(c.body.messages[0].role).toBe("user");
    expect(JSON.stringify(c.body.messages[0].content)).toContain("USER-ONE");
  });

  it("sends no schema parameter and omits effort and temperature when null", async () => {
    const { url, captured } = await fake_server([{ json: ok_body() }]);
    await adapter(url).complete(req());
    const b = captured[0]!.body;
    expect(b.output_config?.format).toBeUndefined();
    expect(b.output_config?.effort).toBeUndefined();
    expect(b.temperature).toBeUndefined();
    expect(captured[0]!.raw).not.toContain("zz_schema_marker");
  });

  it("passes effort and temperature only when non-null", async () => {
    const { url, captured } = await fake_server([{ json: ok_body() }]);
    await adapter(url).complete(req({ effort: "low", temperature: 0.25 }));
    const b = captured[0]!.body;
    expect(b.output_config.effort).toBe("low");
    expect(b.temperature).toBe(0.25);
    expect(b.output_config.format).toBeUndefined();
  });

  it("puts no cache_control anywhere when no system block is cacheable", async () => {
    const { url, captured } = await fake_server([{ json: ok_body() }]);
    await adapter(url).complete(
      req({ system_blocks: [{ text: "ONLY", cacheable: false, label: "locked" }] }),
    );
    expect(captured[0]!.raw).not.toContain("cache_control");
  });

  it("uses the model id of the requested alias", async () => {
    const { url, captured } = await fake_server([{ json: ok_body({ model: "claude-repair-x" }) }]);
    const r = await adapter(url).complete(req({ alias: "REPAIR" }));
    expect(captured[0]!.body.model).toBe("claude-repair-x");
    expect(r.requested_model).toBe("claude-repair-x");
  });

  it("[boundary] rejects the JUDGE alias without making a request", async () => {
    const { url, captured } = await fake_server([{ json: ok_body() }]);
    await expect(adapter(url).complete(req({ alias: "JUDGE" }))).rejects.toThrow();
    expect(captured).toHaveLength(0);
  });
});

describe("request_shape_schema_enforced [invariant AC-2]", () => {
  it("carries output_json_schema in the structured-output option and returns raw_text verbatim", async () => {
    const text = '  {"a": 1}\n\n';
    const { url, captured } = await fake_server([
      { json: ok_body({ content: [{ type: "text", text }] }) },
    ]);
    const schema = { type: "object", properties: { zz_schema_marker: { type: "string" } }, required: [] };
    const r = await adapter(url).complete(
      req({ output_mode: "schema_enforced", output_schema_name: "UnitPlanDraft", output_json_schema: schema }),
    );
    expect(captured).toHaveLength(1);
    const fmt = captured[0]!.body.output_config.format;
    expect(fmt.type).toBe("json_schema");
    expect(fmt.schema).toEqual(schema);
    expect(r.raw_text).toBe(text);
  });
});

describe("response_mapping [invariant AC-3]", () => {
  for (const stop of ["end_turn", "max_tokens", "stop_sequence", "refusal", "tool_use"] as const) {
    it(`maps stop_reason ${stop} and returns it (a refusal is not thrown)`, async () => {
      const { url } = await fake_server([{ json: ok_body({ stop_reason: stop }) }]);
      const r = await adapter(url).complete(req());
      expect(r.stop_reason).toBe(stop);
    });
  }

  it("maps all four usage counts", async () => {
    const { url } = await fake_server([{ json: ok_body() }]);
    const r = await adapter(url).complete(req());
    expect(r.usage).toEqual({ input_tokens: 11, output_tokens: 7, cache_read_tokens: 3, cache_write_tokens: 5 });
  });

  it("takes served_model from the response body, not the request", async () => {
    const { url } = await fake_server([{ json: ok_body({ model: "claude-served-other-9" }) }]);
    const r = await adapter(url).complete(req());
    expect(r.requested_model).toBe(REQUESTED);
    expect(r.served_model).toBe("claude-served-other-9");
  });

  it("takes provider_request_id from the request-id header", async () => {
    const { url } = await fake_server([{ headers: { "request-id": "req_hdr_42" }, json: ok_body() }]);
    const r = await adapter(url).complete(req());
    expect(r.provider_request_id).toBe("req_hdr_42");
  });

  it("concatenates text blocks verbatim", async () => {
    const { url } = await fake_server([
      { json: ok_body({ content: [{ type: "text", text: " a" }, { type: "text", text: "b\n" }] }) },
    ]);
    const r = await adapter(url).complete(req());
    expect(r.raw_text).toBe(" ab\n");
  });

  it("[boundary] treats missing cache token fields as zero", async () => {
    const { url } = await fake_server([
      { json: ok_body({ usage: { input_tokens: 2, output_tokens: 1 } }) },
    ]);
    const r: ModelResponse = await adapter(url).complete(req());
    expect(r.usage.cache_read_tokens).toBe(0);
    expect(r.usage.cache_write_tokens).toBe(0);
  });
});

describe("error_mapping [failure AC-4]", () => {
  const err_body = { type: "error", error: { type: "x", message: "m" } };
  const http_cases: Array<[number, Record<string, string>, string, boolean, number | null]> = [
    [429, { "retry-after": "7" }, "rate_limited", true, 7],
    [529, {}, "overloaded", true, null],
    [500, {}, "server_error", true, null],
    [502, {}, "server_error", true, null],
    [503, {}, "server_error", true, null],
    [400, {}, "bad_request", false, null],
    [422, {}, "bad_request", false, null],
    [401, {}, "auth", false, null],
    [403, {}, "auth", false, null],
  ];
  for (const [status, headers, kind, retryable, retry_after] of http_cases) {
    it(`maps HTTP ${status} to ${kind} with one request`, async () => {
      const { url, captured } = await fake_server([
        { status, headers: { ...headers, "request-id": "req_err_1" }, json: err_body },
      ]);
      const e = await adapter(url).complete(req()).then(
        () => null,
        (x: unknown) => x,
      );
      expect(e).toBeInstanceOf(ProviderError);
      const pe = e as ProviderError;
      expect(pe.kind).toBe(kind);
      expect(pe.retryable).toBe(retryable);
      expect(pe.http_status).toBe(status);
      expect(pe.retry_after_s).toBe(retry_after);
      expect(pe.provider_request_id).toBe("req_err_1");
      expect(captured).toHaveLength(1);
    });
  }

  it("maps an abort (client timeout) to timeout, not retryable, one request", async () => {
    const { url, captured } = await fake_server([{ hang: true }]);
    const e = await adapter(url).complete(req({ timeout_ms: 50 })).then(
      () => null,
      (x: unknown) => x,
    );
    expect(e).toBeInstanceOf(ProviderError);
    expect((e as ProviderError).kind).toBe("timeout");
    expect((e as ProviderError).retryable).toBe(false);
    expect(captured).toHaveLength(1);
  });

  it("maps a socket reset to connection, retryable, one request", async () => {
    const { url, captured } = await fake_server([{ destroy: true }]);
    const e = await adapter(url).complete(req()).then(
      () => null,
      (x: unknown) => x,
    );
    expect(e).toBeInstanceOf(ProviderError);
    expect((e as ProviderError).kind).toBe("connection");
    expect((e as ProviderError).retryable).toBe(true);
    expect(captured).toHaveLength(1);
  });
});

describe("key_never_leaks [negative AC-5]", () => {
  it("never exposes the key in errors, logs, stringified objects; sends it only as x-api-key", async () => {
    const sink: string[] = [];
    const grab = (...a: unknown[]) => {
      sink.push(a.map((x) => (typeof x === "string" ? x : inspect(x, { depth: 8 }))).join(" "));
    };
    for (const m of ["log", "info", "warn", "error", "debug", "trace"] as const) {
      vi.spyOn(console, m).mockImplementation(grab);
    }
    vi.spyOn(process.stdout, "write").mockImplementation(((c: unknown) => (grab(String(c)), true)) as never);
    vi.spyOn(process.stderr, "write").mockImplementation(((c: unknown) => (grab(String(c)), true)) as never);

    // The error bodies echo the key and the prompt, as a hostile or sloppy provider might.
    const echo = { type: "error", error: { type: "x", message: `bad key ${MARKER} while reading USER-ONE` } };
    const { url, captured } = await fake_server([
      { json: ok_body() },
      { status: 401, json: echo },
      { status: 429, headers: { "retry-after": "2" }, json: echo },
      { status: 500, json: echo },
      { status: 400, json: echo },
      { destroy: true },
    ]);
    const a = adapter(url);
    const artefacts: string[] = [];
    artefacts.push(JSON.stringify(await a.complete(req())));
    let errs = 0;
    for (let i = 0; i < 5; i++) {
      const e = await a.complete(req()).then(
        () => null,
        (x: unknown) => x,
      );
      expect(e).toBeInstanceOf(ProviderError);
      errs++;
      const pe = e as ProviderError;
      artefacts.push(pe.message, pe.stack ?? "", pe.name);
      artefacts.push(JSON.stringify(pe), inspect(pe, { depth: 10, showHidden: true }));
      for (const k of Object.getOwnPropertyNames(pe)) artefacts.push(String((pe as any)[k]));
      expect(pe.message).not.toContain("USER-ONE");
    }
    expect(errs).toBe(5);

    const secret = new SecretStr(MARKER);
    expect(String(secret)).toBe("[redacted]");
    expect(`${secret}`).toBe("[redacted]");
    expect(JSON.stringify({ secret })).not.toContain(MARKER);

    const init = {
      api_key: new SecretStr(MARKER),
      model_ids: { GENERATION: REQUESTED, REPAIR: REQUESTED, ASSIST: REQUESTED },
      http_timeout_ms: 1000,
      base_url: url,
    };
    artefacts.push(JSON.stringify(init), inspect(init, { depth: 10 }));
    artefacts.push(JSON.stringify(a), inspect(a, { depth: 10, showHidden: true }), String(a));

    for (const s of artefacts) expect(s).not.toContain(MARKER);
    for (const s of sink) expect(s).not.toContain(MARKER);

    // The key is sent only in x-api-key of each request.
    expect(captured.length).toBe(6);
    for (const c of captured) {
      expect(c.headers["x-api-key"]).toBe(MARKER);
      expect(c.raw).not.toContain(MARKER);
      expect(c.url).not.toContain(MARKER);
      for (const [name, value] of Object.entries(c.headers)) {
        if (name !== "x-api-key") expect(String(value)).not.toContain(MARKER);
      }
    }
  });
});
