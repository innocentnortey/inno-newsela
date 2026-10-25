import { describe, expect, it } from "vitest";
import { route_after_checks } from "./route-after-checks.ts";
import type { NextStep } from "./state.ts";

const rows: [boolean, boolean, boolean, number, NextStep][] = [];
for (const sv of [true, false])
  for (const c of [true, false])
    for (const p of [true, false])
      for (const r of [0, 1]) {
        const ok = sv && c && p;
        rows.push([sv, c, p, r, ok ? "store" : r < 1 ? "repair" : "fail"]);
      }

describe("table", () => {
  it.each(rows)(
    "schema=%s compiled=%s passed=%s rounds=%s -> %s",
    (sv, c, p, r, want) => {
      expect(
        route_after_checks({
          schema_valid: sv,
          compiled: c,
          check_passed: p,
          repair_rounds: r,
          max_repair_rounds: 1,
        }),
      ).toBe(want);
    },
  );
});

describe("wp1_one_repair", () => {
  it("G6.U3.L4 minutes_out_of_range gets exactly one repair", () => {
    const base = { schema_valid: true, compiled: true, max_repair_rounds: 1 };
    // round 0: check failed (minutes_out_of_range on lesson G6.U3.L4)
    expect(
      route_after_checks({ ...base, check_passed: false, repair_rounds: 0 }),
    ).toBe("repair");
    expect(
      route_after_checks({ ...base, check_passed: true, repair_rounds: 1 }),
    ).toBe("store");
    expect(
      route_after_checks({ ...base, check_passed: false, repair_rounds: 1 }),
    ).toBe("fail");
  });
});
