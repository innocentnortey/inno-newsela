// NL-33 frozen tests (risk::security). Labels: [invariant] [failure/refusal] [negative].
import { create_logger } from "@ls/obs/logger";
import { ProviderError } from "@ls/core/errors";
import { FakeClock } from "@ls/core/ports/clock";
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { ModelCallRecorder } from "./recorder.ts";
import { UnscriptedStubCall } from "./stub.ts";
import { cost_math, ctx, KEY_MARKER, prices, rendered, request, settings } from "./test-support/fixtures.ts";
import { MemoryModelCallLog } from "./test-support/memory-log.ts";
import { response, ScriptedClient } from "./test-support/scripted-client.ts";

class SleepLogClock extends FakeClock {
  readonly slept: number[] = [];
  override sleep(ms: number): Promise<void> {
    this.slept.push(ms);
    this.advance(ms);
    return Promise.resolve();
  }
}

function setup(extras: { logger?: ReturnType<typeof create_logger>; random?: () => number } = {}) {
  const clock = new SleepLogClock();
  const client = new ScriptedClient(clock);
  const log = new MemoryModelCallLog();
  const recorder = new ModelCallRecorder(client, log, clock, prices, settings(), cost_math, { random: () => 0.5, ...extras });
  const only_row = () => [...log.rows.values()][0]!;
  return { clock, client, log, recorder, only_row };
}
const rate_limited = (retry_after_s: number | null = null) => new ProviderError({ kind: "rate_limited", http_status: 429, retry_after_s });

describe("ModelCallRecorder", () => {
  it("row_exists_before_send [invariant]: the sent row, with the full prompt, exists when the client is entered", async () => {
    const { client, log, recorder } = setup();
    let seen: Array<Record<string, unknown>> = [];
    client.on_enter = async () => {
      seen = [...log.rows.values()].map((r) => ({ ...r }));
    };
    client.script(response({ raw_text: "STUB-TEXT", served_model: "stub-model" }));
    const prompt = "synthetic prompt A\nwith two lines";
    await recorder.call(ctx(), request({ alias: "REPAIR" }), rendered(prompt));

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      status: "sent", rendered_prompt: prompt, purpose: "lesson_draft", alias: "REPAIR",
      requested_model: "claude-sonnet-5-5", attempt: 1, reservation_id: "sr_1",
    });
    const final = [...log.rows.values()];
    expect(final).toHaveLength(1);
    expect(final[0]).toMatchObject({ id: seen[0]!["id"], status: "completed", raw_output: "STUB-TEXT", served_model: "stub-model" });
  });

  it("row_exists_before_send [invariant]: if the row cannot be written nothing is sent", async () => {
    const { client, log, recorder } = setup();
    log.insert_sent = () => Promise.reject(new Error("db down"));
    client.script(response());
    await expect(recorder.call(ctx(), request(), rendered())).rejects.toThrow("db down");
    expect(client.calls).toHaveLength(0);
  });

  it("raw_saved_before_parse [invariant]: raw output, usage and cost are stored before the caller parses", async () => {
    const { client, log, recorder, only_row } = setup();
    client.script(response({ raw_text: "this is not json" }));
    const recorded = await recorder.call(ctx(), request(), rendered());
    expect(() => JSON.parse(recorded.raw_output)).toThrow(); // the caller's parser fails right after

    expect(only_row()).toMatchObject({ status: "completed", raw_output: "this is not json" });
    expect(only_row().usage).toEqual({ input_tokens: 100, output_tokens: 50, cache_read_tokens: 0, cache_write_tokens: 0 });
    expect(only_row().cost_usd?.toFixed(6)).toBe("0.000350");
    const checkpoint = await recorder.checkpoint("job_1" as never, "lesson_draft", 1);
    expect(checkpoint).toMatchObject({ model_call_id: recorded.model_call_id, raw_output: "this is not json" });
    expect(await recorder.checkpoint("job_1" as never, "lesson_draft", 2)).toBeNull();
    expect(log.rows.size).toBe(1);
  });

  it("cost_from_usage [invariant]: cost is the SERVED model's price over the response usage, cache tokens included", async () => {
    const cases: Array<[number, number, string]> = [
      [0, 0, "0.000350"],
      [10000, 0, "0.001350"],
      [10000, 4000, "0.006350"],
    ];
    let previous = new Decimal(0);
    for (const [cache_read, cache_write, expected] of cases) {
      const { client, recorder, only_row } = setup();
      client.script(response({
        requested_model: "claude-sonnet-5-5", served_model: "stub-model",
        usage: { input_tokens: 100, output_tokens: 50, cache_read_tokens: cache_read, cache_write_tokens: cache_write },
      }));
      const recorded = await recorder.call(ctx(), request(), rendered());
      expect(recorded.cost_usd.toFixed(6)).toBe(expected);
      expect(only_row().cost_usd?.toFixed(6)).toBe(expected);
      expect(recorded.cost_usd.greaterThanOrEqualTo(previous)).toBe(true);
      previous = recorded.cost_usd;
    }
  });

  it("retry_policy [failure/refusal]: 429 with retry_after_s 5 waits exactly 5 s then succeeds with retries 1", async () => {
    const { client, clock, recorder, only_row, log } = setup();
    client.script(rate_limited(5), response());
    const recorded = await recorder.call(ctx(), request(), rendered());
    expect(clock.slept).toEqual([5000]);
    expect(recorded.retries).toBe(1);
    expect(client.calls).toHaveLength(2);
    expect(log.rows.size).toBe(1);
    expect(only_row()).toMatchObject({ status: "completed", retries: 1 });
  });

  it("retry_policy [failure/refusal]: 529 and 5xx back off 1 s x 2^n with jitter inside +/-20 percent", async () => {
    const make = (kind: "overloaded" | "server_error", status: number) => new ProviderError({ kind, http_status: status });
    for (const [random, factor] of [[0.5, 1], [0, 0.8], [1, 1.2]] as const) {
      const { client, clock, recorder } = setup({ random: () => random });
      client.script(make("overloaded", 529), make("server_error", 500), make("server_error", 503), response());
      const recorded = await recorder.call(ctx(), request(), rendered());
      expect(recorded.retries).toBe(3);
      expect(clock.slept).toHaveLength(3);
      [1000, 2000, 4000].forEach((base, i) => expect(clock.slept[i]).toBeCloseTo(base * factor, 6));
    }
  });

  it("retry_policy [failure/refusal]: after PROVIDER_MAX_RETRIES the call fails, one row failed error:rate_limited:429, no message text", async () => {
    const { client, clock, recorder, only_row, log } = setup();
    const err = new ProviderError({ kind: "rate_limited", http_status: 429, message: "provider says: SENSITIVE-MESSAGE-5530" });
    client.script(err, err, err, err, response());
    await expect(recorder.call(ctx(), request(), rendered())).rejects.toBe(err);
    expect(client.calls).toHaveLength(4); // 1 send + 3 retries
    expect(clock.slept).toHaveLength(3);
    expect(log.rows.size).toBe(1);
    expect(only_row()).toMatchObject({ status: "failed", stop_reason: "error:rate_limited:429", retries: 3 });
    expect(JSON.stringify(only_row())).not.toContain("SENSITIVE-MESSAGE-5530");
  });

  it("timeout_and_truncation_not_retried [failure/refusal]: a 240 s timeout is one attempt, row failed error:timeout", async () => {
    const { client, clock, recorder, only_row } = setup();
    client.script({ wait_ms: 240000, then: new ProviderError({ kind: "timeout" }) }, response());
    await expect(recorder.call(ctx(), request({ timeout_ms: 240000 }), rendered())).rejects.toMatchObject({ kind: "timeout" });
    expect(client.calls).toHaveLength(1);
    expect(clock.slept).toEqual([]);
    expect(only_row()).toMatchObject({ status: "failed", stop_reason: "error:timeout" });
  });

  it("timeout_and_truncation_not_retried [failure/refusal]: a connection error is retried like a 5xx", async () => {
    const { client, recorder } = setup();
    client.script(new ProviderError({ kind: "connection" }), response());
    const recorded = await recorder.call(ctx(), request(), rendered());
    expect(client.calls).toHaveLength(2);
    expect(recorded.retries).toBe(1);
  });

  it("timeout_and_truncation_not_retried [failure/refusal]: max_tokens is returned untouched, never retried", async () => {
    const { client, clock, recorder, only_row } = setup();
    client.script(response({ stop_reason: "max_tokens", raw_text: "{\"cut\":" }), response());
    const recorded = await recorder.call(ctx(), request(), rendered());
    expect(recorded).toMatchObject({ stop_reason: "max_tokens", raw_output: "{\"cut\":", retries: 0 });
    expect(client.calls).toHaveLength(1);
    expect(clock.slept).toEqual([]);
    expect(only_row()).toMatchObject({ status: "completed", stop_reason: "max_tokens" });
  });

  it("no_secrets_or_text_in_logs [negative]: no log line or table field holds the key, the prompt or the output", async () => {
    const lines: string[] = [];
    const logger = create_logger({ service: "worker", build_id: "t", write: (l) => lines.push(l) });
    const PROMPT = "RESTRICTED-MARKER-5530 prompt body";
    const OUTPUT = "DISTINCT-OUTPUT-5530";
    const ok = setup({ logger });
    ok.client.script(response({ raw_text: OUTPUT }));
    await ok.recorder.call(ctx(), request(), rendered(PROMPT));

    const bad = setup({ logger });
    bad.client.script(new ProviderError({ kind: "bad_request", http_status: 400, message: `${KEY_MARKER} RESTRICTED-MARKER-5530 ${OUTPUT}` }));
    await expect(bad.recorder.call(ctx(), request(), rendered(PROMPT))).rejects.toBeInstanceOf(ProviderError);

    const forbidden = [KEY_MARKER, "RESTRICTED-MARKER-5530", OUTPUT, "prompt body"];
    const model_call_lines = lines.map((l) => JSON.parse(l) as Record<string, unknown>).filter((o) => o["event"] === "model_call");
    expect(model_call_lines).toHaveLength(2);
    for (const line of lines) for (const f of forbidden) expect(line).not.toContain(f);
    for (const log of [ok.log, bad.log]) {
      for (const row of log.rows.values()) {
        const { rendered_prompt: _p, raw_output: _o, ...rest } = row;
        for (const f of forbidden) expect(JSON.stringify(rest)).not.toContain(f);
      }
    }
    const success = model_call_lines.find((o) => (o["extra"] as Record<string, unknown>)["status"] === "completed")!;
    for (const k of ["service", "build_id", "request_id", "run_id", "lesson_id", "job_id"]) expect(success).toHaveProperty(k);
    for (const k of ["model_call_id", "purpose", "alias", "served_model", "input_tokens", "output_tokens", "cost_usd", "latency_ms", "retries", "status"]) {
      expect(success["extra"]).toHaveProperty(k);
    }
    const failure = model_call_lines.find((o) => (o["extra"] as Record<string, unknown>)["status"] === "failed")!;
    expect(failure).toBeDefined();
  });

  it("unexpected_client_error_reason [negative]: a plain Error stores its class name only; an UnscriptedStubCall stores its safe reason", async () => {
    const lines: string[] = [];
    const logger = create_logger({ service: "worker", build_id: "t", write: (l) => lines.push(l) });
    const stored: string[] = [];
    const a = setup({ logger });
    const fail_a = a.log.fail.bind(a.log);
    a.log.fail = async (id, e) => { stored.push(e.message); await fail_a(id, e); };
    a.client.script(new Error("secret sk-ant-abc") as never);
    await expect(a.recorder.call(ctx(), request(), rendered())).rejects.toThrow("secret");
    expect(stored).toEqual(["unexpected client error: Error"]);
    expect(stored.join()).not.toContain("sk-ant");
    expect(lines.join("\n")).not.toContain("sk-ant");

    const b = setup({ logger });
    const fail_b = b.log.fail.bind(b.log);
    b.log.fail = async (id, e) => { stored.push(e.message); await fail_b(id, e); };
    b.client.script(new UnscriptedStubCall("GENERATION", "unit_plan") as never);
    await expect(b.recorder.call(ctx(), request(), rendered())).rejects.toBeInstanceOf(UnscriptedStubCall);
    expect(stored[1]).toBe("unexpected client error: unscripted stub call: GENERATION/unit_plan");
    const failed = lines.map((l) => JSON.parse(l) as { extra?: Record<string, unknown> }).filter((o) => o.extra?.["status"] === "failed");
    expect(failed.map((o) => o.extra?.["reason"])).toEqual(["Error", "unscripted stub call: GENERATION/unit_plan"]);
  });
});
