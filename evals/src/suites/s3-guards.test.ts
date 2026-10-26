// NL-109 AC-6: the cost guards. Pure.
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { InvariantViolation } from "@ls/core/errors";
import { check_estimate, check_running, estimate_usd, guard_limit, guard_line, run_cap } from "./s3-guards.ts";

describe("S3 cost guards", () => {
  it("estimate_usd(3,3) is 3.168", () => {
    expect(estimate_usd(3, 3).toString()).toBe("3.168");
  });
  it("limit is min(--max-usd or 5, the PD-29 ceiling)", () => {
    expect(guard_limit(null, {}).limit.toNumber()).toBe(5);
    expect(guard_limit(2, {}).limit.toNumber()).toBe(2);
    expect(guard_limit(10, {}).limit.toNumber()).toBe(10);
    expect(guard_limit(10, { BUILD_SPEND_CEILING_USD: "2" }).limit.toNumber()).toBe(2);
    expect(guard_limit(null, { BUILD_SPEND_CEILING_USD: "junk" }).limit.toNumber()).toBe(5);
  });
  it("--max-usd 0.01 refuses, naming the guard and that no call was made", () => {
    expect(() => check_estimate({ provider_mode: "stub", max_usd: 0.01 }, 3, 3, {})).toThrow(/S3 cost guard.*no model call was made/);
    expect(() => check_estimate({ provider_mode: "stub", max_usd: 0.01 }, 3, 3, {})).toThrow(InvariantViolation);
  });
  it("--max-usd 5 with repeat 3 passes; repeat 5 refuses at the default limit", () => {
    expect(() => check_estimate({ provider_mode: "real", max_usd: 5 }, 3, 3, {})).not.toThrow();
    expect(() => check_estimate({ provider_mode: "real", max_usd: null }, 3, 5, {})).toThrow(/S3 cost guard/);
  });
  it("BUILD_SPEND_CEILING_USD=2 refuses", () => {
    expect(() => check_estimate({ provider_mode: "real", max_usd: 5 }, 3, 3, { BUILD_SPEND_CEILING_USD: "2" })).toThrow(/S3 cost guard/);
  });
  it("the stub provider with no --max-usd is not guarded", () => {
    expect(() => check_estimate({ provider_mode: "stub" }, 3, 50, {})).not.toThrow();
  });
  it("the running budget stops when 0.40 or less is left, and the message names the guard", () => {
    expect(() => check_running(new Decimal("4.59"), new Decimal(5))).not.toThrow();
    expect(() => check_running(new Decimal("4.60"), new Decimal(5))).toThrow(/S3 cost guard: running total \$4\.60 reached the limit \$5\.00/);
  });
  it("run_cap is the smaller of $1.50 and what is left", () => {
    expect(run_cap(new Decimal(0), new Decimal(5))).toBe(1.5);
    expect(run_cap(new Decimal("4"), new Decimal(5))).toBe(1);
  });
  it("the printed guard line matches the documented form", () => {
    expect(guard_line(3, 3, guard_limit(null, {}))).toMatch(/^S3 guard: estimated reservation \$3\.17 for 9 runs; limit \$5\.00 /);
  });
});
