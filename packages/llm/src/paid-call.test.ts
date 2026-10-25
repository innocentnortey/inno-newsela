// NL-33 frozen tests (risk::security). Labels: [failure/refusal] [invariant].
import { ProviderError, SpendRefused } from "@ls/core/errors";
import { FakeClock } from "@ls/core/ports/clock";
import { FakeSpendLedger } from "@ls/core/testing/fake-spend";
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { PaidCaller } from "./paid-call.ts";
import { ModelCallRecorder } from "./recorder.ts";
import { cost_math, ctx, PRICE, prices, rendered, request, settings } from "./test-support/fixtures.ts";
import { MemoryModelCallLog } from "./test-support/memory-log.ts";
import { response, ScriptedClient } from "./test-support/scripted-client.ts";

const SNAPSHOT = {} as never;
const allowed = { allowed: true, reservation_id: "sr_9", refused_by: null, scope: null, remaining_usd: null, snapshot: SNAPSHOT } as never;
const refused = { allowed: false, reservation_id: null, refused_by: "run_cap", scope: null, remaining_usd: new Decimal(0), snapshot: SNAPSHOT } as never;

function setup() {
  const clock = new FakeClock();
  const client = new ScriptedClient(clock);
  const log = new MemoryModelCallLog();
  const recorder = new ModelCallRecorder(client, log, clock, prices, settings(), cost_math, { random: () => 0.5 });
  const spend = new FakeSpendLedger();
  const caller = new PaidCaller(recorder, spend, prices, cost_math);
  const call = (purpose: "lesson_draft" | "truncation_retry" | "repair", cap: number) =>
    caller.call({ ctx: ctx({ purpose, reservation_id: null }), req: request({ max_output_tokens: cap }), rendered: rendered("p", 1000), run_id: "run_1" as never, job_id: "job_1" as never, user_id: "usr_1" as never });
  return { client, log, spend, caller, call };
}
const methods = (s: FakeSpendLedger) => s.script.calls.map((c) => c.method);

describe("PaidCaller", () => {
  it("refused_sends_nothing [failure/refusal]: a refused reserve raises SpendRefused, writes no row, never calls the client", async () => {
    const { client, log, spend, call } = setup();
    spend.script.returns("reserve", refused);
    client.script(response());
    const err = await call("lesson_draft", 32000).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SpendRefused);
    expect(err).toMatchObject({ refused_by: "run_cap" });
    expect((err as SpendRefused).amount_usd.toFixed(6)).toBe(cost_math.max_call_cost(PRICE, 1000, 32000).toFixed(6));
    expect(log.rows.size).toBe(0);
    expect(client.calls).toHaveLength(0);
    expect(methods(spend)).toEqual(["reserve"]);
  });

  it("reserve_call_settle_or_release [invariant]: draft, truncation retry and repair each reserve their own worst case, then settle against the call", async () => {
    const amounts: string[] = [];
    for (const [purpose, cap] of [["lesson_draft", 32000], ["truncation_retry", 48000], ["repair", 32000]] as const) {
      const { client, log, spend, call } = setup();
      spend.script.returns("reserve", allowed).returns("settle", {} as never).returns("release", {} as never);
      client.script(response());
      const recorded = await call(purpose, cap);
      const [reserve, settle, release] = spend.script.calls;
      expect(methods(spend)).toEqual(["reserve", "settle", "release"]);
      const req = reserve!.args[0] as { amount_usd: Decimal; purpose: string };
      expect(req.amount_usd.toFixed(6)).toBe(cost_math.max_call_cost(PRICE, 1000, cap).toFixed(6));
      expect(req.purpose).toBe(purpose);
      amounts.push(req.amount_usd.toFixed(6));
      expect(settle!.args).toEqual(["sr_9", recorded.cost_usd, recorded.model_call_id]);
      expect(release!.args).toEqual(["sr_9"]);
      expect([...log.rows.values()][0]!.reservation_id).toBe("sr_9");
    }
    expect(new Set(amounts).size).toBe(2); // 32000 and 48000 differ; repair equals draft
    expect(amounts[1]).not.toBe(amounts[0]);
  });

  it("reserve_call_settle_or_release [invariant]: when the call throws the reservation is released and never settled", async () => {
    const { client, spend, call } = setup();
    spend.script.returns("reserve", allowed).returns("release", {} as never);
    const err = new ProviderError({ kind: "bad_request", http_status: 400 });
    client.script(err);
    await expect(call("lesson_draft", 32000)).rejects.toBe(err);
    expect(methods(spend)).toEqual(["reserve", "release"]);
    expect(spend.script.calls[1]!.args).toEqual(["sr_9"]);
  });
});
