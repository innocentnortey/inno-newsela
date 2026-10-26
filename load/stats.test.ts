// NL-118 (AC-2): percentile, error rate and recovery arithmetic.
import { describe, expect, it } from "vitest";
import { baseline_p95, error_rate, percentile, recovery_s, window_p95s } from "./stats.ts";

describe("stats", () => {
  it("percentile and error_rate", () => {
    const v = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(v, 95)).toBe(95);
    expect(error_rate(3, 300)).toBe(0.01);
    expect(error_rate(0, 0)).toBe(0);
    expect(() => percentile([], 95)).toThrow();
  });

  it("recovery_s settles, is already settled, or never settles", () => {
    const w = (xs: number[], from = 0) => xs.map((p95_ms, i) => ({ start_s: from + i, p95_ms }));
    // plateau ends at 10; back within 10% of baseline 100 from window 105
    const high = Array.from({ length: 95 }, () => 300);
    expect(recovery_s(w([...high, 105, 100], 10), 100, 10)).toBe(95);
    expect(recovery_s(w([100, 101, 99], 10), 100, 10)).toBe(0);
    expect(recovery_s(w([300, 300, 300], 10), 100, 10)).toBeNull();
    expect(recovery_s([], 100, 10)).toBeNull();
    // a dip then a spike does not count as recovered; the later settle does
    expect(recovery_s(w([100, 100, 400, 100, 100], 10), 100, 10)).toBe(3);
    expect(recovery_s(w([100, 100, 400], 10), 100, 10)).toBeNull();
  });

  it("window_p95s ignores failed samples; baseline needs 5 samples", () => {
    const s = [
      { t_ms: 100, ms: 10, ok: true },
      { t_ms: 200, ms: 9999, ok: false },
      { t_ms: 1100, ms: 20, ok: true },
    ];
    expect(window_p95s(s, 1)).toEqual([{ start_s: 0, p95_ms: 10, n: 1 }, { start_s: 1, p95_ms: 20, n: 1 }]);
    expect(baseline_p95(s, 5)).toBeNull();
    const five = Array.from({ length: 5 }, (_, i) => ({ t_ms: i, ms: i + 1, ok: true }));
    expect(baseline_p95(five, 5)).toBe(5);
  });
});
