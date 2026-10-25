// NL-33 security finding (non-frozen): a settle failure after a completed provider call never releases the reservation.
import { FakeClock } from "@ls/core/ports/clock";
import { FakeSpendLedger } from "@ls/core/testing/fake-spend";
import { describe, expect, it } from "vitest";
import { PaidCaller } from "./paid-call.ts";
import { ModelCallRecorder } from "./recorder.ts";
import { cost_math, ctx, prices, rendered, request, settings } from "./test-support/fixtures.ts";
import { MemoryModelCallLog } from "./test-support/memory-log.ts";
import { response, ScriptedClient } from "./test-support/scripted-client.ts";

const allowed = { allowed: true, reservation_id: "sr_9", refused_by: null, scope: null, remaining_usd: null, snapshot: {} } as never;

function setup() {
  const clock = new FakeClock();
  const client = new ScriptedClient(clock);
  const recorder = new ModelCallRecorder(client, new MemoryModelCallLog(), clock, prices, settings(), cost_math, { random: () => 0.5 });
  const spend = new FakeSpendLedger();
  const logged: string[] = [];
  const logger = { error: (e: string) => void logged.push(e) } as never;
  const caller = new PaidCaller(recorder, spend, prices, cost_math, logger);
  const call = () => caller.call({ ctx: ctx({ purpose: "lesson_draft", reservation_id: null }), req: request({ max_output_tokens: 32000 }), rendered: rendered("p", 1000), run_id: "run_1" as never, job_id: "job_1" as never, user_id: "usr_1" as never });
  return { client, spend, logged, call };
}

describe("PaidCaller settle failure after a completed call", () => {
  it("retries settle and succeeds without releasing", async () => {
    const { client, spend, call } = setup();
    spend.script.returns("reserve", allowed).throws("settle", new Error("db down")).returns("settle", {} as never).returns("release", {} as never);
    client.script(response());
    await call();
    expect(spend.script.calls.map((c) => c.method).filter((m) => m !== "release")).toEqual(["reserve", "settle", "settle"]);
  });

  it("when settle keeps failing: 3 attempts, no release before the rethrow, spend.settle_failed logged", async () => {
    const { client, spend, logged, call } = setup();
    const boom = new Error("db down");
    spend.script.returns("reserve", allowed).throws("settle", boom, boom, boom);
    client.script(response());
    await expect(call()).rejects.toBe(boom);
    expect(spend.script.calls.map((c) => c.method)).toEqual(["reserve", "settle", "settle", "settle"]);
    expect(logged).toEqual(["spend.settle_failed"]);
  });
});
