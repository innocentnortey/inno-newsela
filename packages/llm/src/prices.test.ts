// NL-32 FROZEN (AC-8). Do not edit.
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { InvariantViolation } from "@ls/core/errors";
import { PRICE_TABLE } from "./prices.ts";

describe("prices [invariant AC-8]", () => {
  it("prices claude-sonnet-5-5 at 2.00 / 10.00 / 0.20 / 2.50 per Mtok as Decimal", () => {
    const p = PRICE_TABLE.price_for("claude-sonnet-5-5");
    expect(p.model_id).toBe("claude-sonnet-5-5");
    for (const v of [p.input_per_mtok, p.output_per_mtok, p.cache_read_per_mtok, p.cache_write_per_mtok]) {
      expect(v).toBeInstanceOf(Decimal);
      expect(typeof v).not.toBe("number");
    }
    expect(p.input_per_mtok.equals(new Decimal("2.00"))).toBe(true);
    expect(p.output_per_mtok.equals(new Decimal("10.00"))).toBe(true);
    expect(p.cache_read_per_mtok.equals(new Decimal("0.20"))).toBe(true);
    expect(p.cache_write_per_mtok.equals(new Decimal("2.50"))).toBe(true);
  });

  it("was confirmed on 2026-10-25", () => {
    expect(PRICE_TABLE.confirmed_on).toBe("2026-10-25");
    expect(PRICE_TABLE.prices.map((x) => x.model_id)).toEqual(["claude-sonnet-5-5", "stub-judge"]);
  });

  it("[boundary] an unknown model id throws InvariantViolation, never a zero price", () => {
    expect(() => PRICE_TABLE.price_for("claude-unknown-1")).toThrow(InvariantViolation);
    expect(() => PRICE_TABLE.price_for("claude-unknown-1")).toThrow("no price for claude-unknown-1");
    expect(() => PRICE_TABLE.price_for("")).toThrow(InvariantViolation);
  });
});
