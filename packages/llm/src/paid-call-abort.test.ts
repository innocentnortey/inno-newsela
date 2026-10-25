// NL-79 carry-in: PaidCaller abort seam (signal released when the job lease is lost).
import { FakeClock } from "@ls/core/ports/clock";
import { FakeSpendLedger } from "@ls/core/testing/fake-spend";
import { ProviderError } from "@ls/core/errors";
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { PaidCaller } from "./paid-call.ts";
import { ModelCallRecorder } from "./recorder.ts";
import { cost_math, ctx, prices, rendered, request, settings } from "./test-support/fixtures.ts";
import { MemoryModelCallLog } from "./test-support/memory-log.ts";
import { response, ScriptedClient } from "./test-support/scripted-client.ts";

const SNAPSHOT = {} as never;
const allowed = { allowed: true, reservation_id: "sr_9", refused_by: null, scope: null, remaining_usd: new Decimal(1), snapshot: SNAPSHOT } as never;

function setup() {
  const clock = new FakeClock();
  const client = new ScriptedClient(clock);
  const recorder = new ModelCallRecorder(client, new MemoryModelCallLog(), clock, prices, settings(), cost_math, { random: () => 0.5 });
  const spend = new FakeSpendLedger();
  spend.script.returns("reserve", allowed).returns("settle", {} as never).returns("release", {} as never);
  const caller = new PaidCaller(recorder, spend, prices, cost_math);
  const call = (signal?: AbortSignal) =>
    caller.call({
      ctx: ctx({ purpose: "lesson_draft", reservation_id: null }), req: request({ max_output_tokens: 1000 }), rendered: rendered("p", 1000),
      run_id: "run_1" as never, job_id: "job_1" as never, user_id: "usr_1" as never, ...(signal ? { signal } : {}),
    });
  return { client, spend, call };
}
const methods = (s: FakeSpendLedger) => s.script.calls.map((c) => c.method);

describe("PaidCaller abort seam", () => {
  const tick = () => new Promise((r) => setTimeout(r, 10));

  it("abort while the call is pending rejects promptly with the reason and does not release before the call ends", async () => {
    const { client, spend, call } = setup();
    client.on_enter = () => new Promise<void>(() => undefined); // the provider call never returns
    const ac = new AbortController();
    const reason = new Error("lease lost");
    const pending = call(ac.signal).catch((e: unknown) => e);
    await tick();
    ac.abort(reason);
    expect(await pending).toBe(reason);
    await tick();
    expect(methods(spend)).toEqual(["reserve"]); // still held: the call is not over (swept at the next claim-loop start)
  });

  it("abort then late completion settles the reservation at the recorded cost, once, with no release", async () => {
    const { client, spend, call } = setup();
    let finish!: () => void;
    client.on_enter = () => new Promise<void>((r) => (finish = r));
    client.script(response());
    const ac = new AbortController();
    const reason = new Error("lease lost");
    const pending = call(ac.signal).catch((e: unknown) => e);
    await tick();
    ac.abort(reason);
    expect(await pending).toBe(reason);
    expect(methods(spend)).toEqual(["reserve"]);
    finish();
    await tick();
    await tick();
    expect(methods(spend)).toEqual(["reserve", "settle"]);
    expect(spend.script.calls[1]!.args[0]).toBe("sr_9");
  });

  it("abort then late failure releases once and never settles", async () => {
    const { client, spend, call } = setup();
    let finish!: () => void;
    client.on_enter = () => new Promise<void>((r) => (finish = r));
    client.script(new ProviderError({ kind: "bad_request", http_status: 400 }));
    const ac = new AbortController();
    const reason = new Error("lease lost");
    const pending = call(ac.signal).catch((e: unknown) => e);
    await tick();
    ac.abort(reason);
    expect(await pending).toBe(reason);
    finish();
    await tick();
    await tick();
    expect(methods(spend)).toEqual(["reserve", "release"]);
  });

  it("an already aborted signal rejects before reserving", async () => {
    const { spend, call } = setup();
    const ac = new AbortController();
    ac.abort();
    await expect(call(ac.signal)).rejects.toThrow("aborted");
    expect(methods(spend)).toEqual([]);
  });

  it("no signal: reserve, settle, release as before", async () => {
    const { client, spend, call } = setup();
    client.script(response());
    await call();
    expect(methods(spend)).toEqual(["reserve", "settle", "release"]);
  });
});
