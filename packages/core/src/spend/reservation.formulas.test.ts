// NL-35 AC-4 and AC-5 (implementer-written; the frozen file stays untouched).
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { InvariantViolation } from "../errors.ts";
import type { ModelPrice } from "../ports/common.ts";
import type { SpendSnapshot } from "../ports/spend.ts";
import { decide_reservation, max_call_cost, run_cap_for, settle_cost, user_day_cap_for } from "./reservation.ts";

const D = (s: string): Decimal => new Decimal(s);
const price: ModelPrice = {
  model_id: "m",
  input_per_mtok: D("2"),
  output_per_mtok: D("10"),
  cache_read_per_mtok: D("0.2"),
  cache_write_per_mtok: D("2.5"),
};

describe("formulas", () => {
  it("formulas_and_rounding: exact decimals", () => {
    const a = max_call_cost(price, 5700, 32000);
    expect(a).toBeInstanceOf(Decimal);
    expect(a.equals(D("0.334250"))).toBe(true);
    expect(max_call_cost(price, 5701, 32000).equals(D("0.334253"))).toBe(true);
    // rounds up: one extra token at the input price adds 2.5 micro-dollars -> 3 after rounding up
    expect(max_call_cost(price, 1, 0).equals(D("0.000003"))).toBe(true);
    expect(settle_cost(price, { input_tokens: 2000, output_tokens: 2000, cache_read_tokens: 0, cache_write_tokens: 0 }).equals(D("0.024"))).toBe(true);
    expect(settle_cost(price, { input_tokens: 2000, output_tokens: 2000, cache_read_tokens: 50000, cache_write_tokens: 4000 }).equals(D("0.044"))).toBe(true);
    expect(settle_cost(price, { input_tokens: 1, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0 }).equals(D("0.000002"))).toBe(true);
    const cap = run_cap_for(D("0.182"), 47, D("1.5"), D("0.16"));
    expect(cap).toBeInstanceOf(Decimal);
    expect(cap.equals(D("13.00"))).toBe(true);
    const day = user_day_cap_for(D("13.00"), D("2"));
    expect(day).toBeInstanceOf(Decimal);
    expect(day.equals(D("26.00"))).toBe(true);
  });

  it("nonpositive_amount: zero and negative amounts raise InvariantViolation", () => {
    const s: SpendSnapshot = {
      run_cap_usd: D("10"), run_settled_usd: D("0"), run_reserved_usd: D("0"),
      user_day_cap_usd: D("26"), user_day_settled_usd: D("0"), user_day_reserved_usd: D("0"),
      project_ceiling_usd: D("75"), project_settled_usd: D("0"), project_reserved_usd: D("0"),
    };
    expect(() => decide_reservation(s, D("0"))).toThrow(InvariantViolation);
    expect(() => decide_reservation(s, D("-1"))).toThrow(InvariantViolation);
  });
});
