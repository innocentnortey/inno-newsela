import { describe, expect, it } from "vitest";
import { ProviderError } from "@ls/core/errors";
import { FakeClock } from "@ls/core/ports/clock";
import type { StructuredCallRequest } from "@ls/core/ports/model-client";
import type { JudgeRequest } from "@ls/core/ports/judge-client";
import { LessonDraft } from "@ls/schema/lesson-draft";
import { StubJudgeClient, StubModelClient, wp1_lesson_draft_text } from "./stub.ts";

function req(over: Partial<StructuredCallRequest> = {}): StructuredCallRequest {
  return {
    alias: "GENERATION",
    system_blocks: [{ text: "abcdefgh", cacheable: true, label: "locked" }],
    user_blocks: [{ text: "ijkl", cacheable: false, label: "data" }],
    output_schema_name: "LessonDraft",
    output_json_schema: {},
    output_mode: "prompt_embedded",
    max_output_tokens: 100,
    timeout_ms: 1000,
    effort: null,
    temperature: null,
    ...over,
  };
}

describe("StubModelClient default", () => {
  it("is deterministic, records calls, consumes the queue and runs on_enter first", async () => {
    const order: string[] = [];
    const stub = new StubModelClient({ on_enter: () => void order.push("enter") });
    stub.script("GENERATION", "lesson_draft", [{ kind: "text", text: "12345678" }, { kind: "text", text: "x", stop_reason: "max_tokens" }]);
    const a = await stub.complete(req());
    const b = await stub.complete(req());
    expect(order).toEqual(["enter", "enter"]);
    expect(a).toEqual({
      raw_text: "12345678",
      stop_reason: "end_turn",
      usage: { input_tokens: 3, output_tokens: 2, cache_read_tokens: 0, cache_write_tokens: 0 },
      requested_model: "stub-requested-generation",
      served_model: "stub-model",
      provider_request_id: "stub-req-1",
      latency_ms: 0,
    });
    expect(b.stop_reason).toBe("max_tokens");
    expect(stub.calls).toHaveLength(2);
    await expect(stub.complete(req())).rejects.toThrow("unscripted stub call: GENERATION");
  });

  it("falls back to the wildcard purpose, throws scripted errors, and waits on the fake clock", async () => {
    const clock = new FakeClock();
    const stub = new StubModelClient({ clock });
    stub.script("REPAIR", "*", [
      { kind: "error", error: new ProviderError({ kind: "overloaded" }) },
      { kind: "delay", ms: 500, then: { kind: "text", text: "ok" } },
    ]);
    await expect(stub.complete(req({ alias: "REPAIR", output_schema_name: "Other" }))).rejects.toBeInstanceOf(ProviderError);
    let done = false;
    const p = stub.complete(req({ alias: "REPAIR" })).then((r) => ((done = true), r));
    await Promise.resolve();
    expect(done).toBe(false);
    clock.advance(500);
    expect((await p).raw_text).toBe("ok");
  });

  it("supports script functions", async () => {
    const stub = new StubModelClient().script("ASSIST", "assist", (r) => ({ kind: "text", text: r.alias }));
    expect((await stub.complete(req({ alias: "ASSIST", output_schema_name: "AssistRewrite" }))).raw_text).toBe("ASSIST");
  });
});

describe("wp1_fixture_valid", () => {
  it("parses with LessonDraft", () => {
    expect(LessonDraft.safeParse(JSON.parse(wp1_lesson_draft_text())).success).toBe(true);
  });
});

describe("judge_stub", () => {
  it("returns scripted verdicts, throws scripted errors, then runs dry", async () => {
    const j = new StubJudgeClient([{ verdict: "yes" }, { verdict: "no", rationale: "r" }, new ProviderError({ kind: "timeout" })]);
    const jr = { question: "teaches_standard", code: "X" } as unknown as JudgeRequest;
    const a = await j.verdict(jr);
    expect(a.verdict).toBe("yes");
    expect(a.rationale).toBe("stub rationale");
    expect(a.served_model).toBe("stub-judge");
    expect(a.provider_request_id).toBe("stub-judge-1");
    expect(JSON.parse(a.raw_text)).toEqual({ verdict: "yes", rationale: "stub rationale" });
    expect((await j.verdict(jr)).rationale).toBe("r");
    await expect(j.verdict(jr)).rejects.toBeInstanceOf(ProviderError);
    await expect(j.verdict(jr)).rejects.toThrow();
    expect(j.calls).toHaveLength(4);
  });
});
