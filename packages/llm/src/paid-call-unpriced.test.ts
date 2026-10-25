import { FakeClock } from "@ls/core/ports/clock";
import { FakeSpendLedger } from "@ls/core/testing/fake-spend";
import { describe, expect, it } from "vitest";
import { PaidCaller } from "./paid-call.ts";
import { ModelCallRecorder, UnpricedModelError } from "./recorder.ts";
import { cost_math, ctx, PRICE, prices, rendered, request, settings } from "./test-support/fixtures.ts";
import { MemoryModelCallLog } from "./test-support/memory-log.ts";
import { response, ScriptedClient } from "./test-support/scripted-client.ts";

const allowed = { allowed: true, reservation_id: "sr_9", refused_by: null, scope: null, remaining_usd: null, snapshot: {} } as never;

describe("PaidCaller unpriced served model", () => {
  it("settles at the reserved max cost (never releases) and still throws", async () => {
    const clock = new FakeClock();
    const client = new ScriptedClient(clock);
    const log = new MemoryModelCallLog();
    const recorder = new ModelCallRecorder(client, log, clock, prices, settings(), cost_math, { random: () => 0.5 });
    const spend = new FakeSpendLedger();
    spend.script.returns("reserve", allowed).returns("settle", {} as never).returns("release", {} as never);
    client.script(response({ served_model: "mystery-model-without-price" }));
    const caller = new PaidCaller(recorder, spend, prices, cost_math);
    await expect(caller.call({ ctx: ctx({ purpose: "lesson_draft", reservation_id: null }), req: request({ max_output_tokens: 32000 }), rendered: rendered("p", 1000), run_id: "run_1" as never, job_id: "job_1" as never, user_id: "usr_1" as never })).rejects.toBeInstanceOf(UnpricedModelError);
    const calls = spend.script.calls;
    expect(calls.map((c) => c.method)).toEqual(["reserve", "settle"]);
    expect((calls[1]!.args[1] as { toFixed(n: number): string }).toFixed(6)).toBe(cost_math.max_call_cost(PRICE, 1000, 32000).toFixed(6));
  });
});
