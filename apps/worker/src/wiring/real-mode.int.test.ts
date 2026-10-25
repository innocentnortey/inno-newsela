// RT-1 AC-8 FROZEN (risk::security: spend). Do not edit. Needs the test Postgres (scripts/test-db.sh up).
// Real-mode settings with a counting StubModelClient behind them: no provider call, no real key (canary only).
import { afterEach, describe, expect, it } from "vitest";
import type { ModelClient } from "@ls/core/ports/model-client";
import type { StubModelClient } from "@ls/llm/stub";
import { make_world, plan_for, World } from "../../test/support/world.ts";

const CANARY = "sk-ant-CANARY-4417";
const worlds: World[] = [];
afterEach(async () => {
  for (const w of worlds.splice(0)) await w.close();
});

function counting() {
  const state = { calls: 0 };
  const wrap = (inner: StubModelClient): ModelClient => ({ complete: (req) => (state.calls++, inner.complete(req)) });
  return { state, wrap };
}
const REAL = { MODEL_PROVIDER_MODE: "real", ANTHROPIC_API_KEY: CANARY };

describe("RT-1 spend ceiling in real mode", () => {
  it("ceiling_refuses_before_provider_call (invariant: AC-8)", async () => {
    const { state, wrap } = counting();
    const w = await make_world({ env: REAL, wrap });
    worlds.push(w);
    expect(w.deps.settings.model.model_provider_mode).toBe("real");
    expect(w.deps.settings.spend.build_spend_ceiling_usd.toString()).toBe("75");
    w.stub.script("GENERATION", "unit_plan", (req) => plan_for(w.rows, req));
    const run_id = await w.start_run([8]);
    await w.query(
      `insert into spend_reservation (id, run_id, job_id, user_id, purpose, reserved_usd, settled_usd, status, day, created_at)
       values ('sr_seed', null, null, 'usr_synthetic_author', 'seed', 74.99, 74.99, 'settled', to_char(now() at time zone 'utc','YYYY-MM-DD'), now())`,
    );
    await w.drive_until(() => w.run_finished(run_id), 20_000);
    expect(state.calls).toBe(0);
    expect(await w.query("select 1 from model_call")).toHaveLength(0);
    expect(await w.query("select 1 from spend_reservation where id <> 'sr_seed'")).toHaveLength(0);
    expect(w.lines.join("\n")).not.toContain(CANARY);
  }, 60_000);

  it("ledger_allows_the_same_call_under_the_ceiling (regression: control, test is not vacuous)", async () => {
    const { state, wrap } = counting();
    const w = await make_world({ env: REAL, wrap });
    worlds.push(w);
    w.stub.script("GENERATION", "unit_plan", (req) => plan_for(w.rows, req));
    const run_id = await w.start_run([8]);
    await w.drive_until(async () => state.calls > 0 || (await w.run_finished(run_id)), 20_000);
    expect(state.calls).toBeGreaterThan(0);
  }, 60_000);
});
