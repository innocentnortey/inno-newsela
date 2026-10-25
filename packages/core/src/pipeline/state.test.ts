import { describe, expect, it } from "vitest";
import { initial_state, wall_clock_exceeded, with_brake } from "./state.ts";

describe("state", () => {
  it("initial_state sets fields", () => {
    const s = initial_state({ unit_id: "G6.U3" }, 1000);
    expect(s).toMatchObject({
      job: { unit_id: "G6.U3" },
      context: null,
      draft: null,
      compiled: null,
      check_result: null,
      call_ids: [],
      schema_issues: [],
      brakes_fired: [],
      repair_rounds: 0,
      truncation_retries: 0,
      rate_limit_retries: 0,
      started_at: 1000,
      cost_usd: "0",
      outcome: null,
    });
  });
  it("with_brake adds", () => {
    const s = with_brake(initial_state({ unit_id: "u" }, 0), "cancelled");
    expect(s.brakes_fired).toEqual(["cancelled"]);
  });
  it("with_brake is idempotent", () => {
    const s = with_brake(initial_state({ unit_id: "u" }, 0), "cancelled");
    expect(with_brake(s, "cancelled")).toBe(s);
  });
  it("with_brake does not mutate input", () => {
    const s0 = initial_state({ unit_id: "u" }, 0);
    const snap = JSON.stringify(s0);
    with_brake(s0, "circuit_breaker");
    expect(JSON.stringify(s0)).toBe(snap);
  });
  it("wall clock is strict", () => {
    const s = { started_at: 100 };
    expect(wall_clock_exceeded(s, 600100, 600000)).toBe(false);
    expect(wall_clock_exceeded(s, 600101, 600000)).toBe(true);
  });
});
